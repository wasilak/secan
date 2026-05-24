import React, { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  Group,
  Badge,
  Loader,
  Alert,
  Tabs,
  Paper,
  Button,
  Divider,
  Box,
  ActionIcon,
} from '@mantine/core';
import { IconAlertCircle, IconGripVertical } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation } from '@tanstack/react-query';
import { createTwoFilesPatch } from 'diff';
import { parseDiff, Diff, Hunk } from 'react-diff-view';
import 'react-diff-view/style/index.css';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ManagedModal } from './ManagedModal';
import { CodeEditor } from './CodeEditor';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';
import { getErrorMessage } from '../lib/errorHandling';
import { DURATIONS, EASINGS } from '../lib/transitions';
import type { SimulateTemplateRequest, SimulateTemplateResponse } from '../types/api';

/**
 * TemplateDetailsModal component
 *
 * Displays full details of a single index template across four tabs:
 * - Overview: key metadata fields + simulate diff
 * - Settings: template settings JSON in a read-only Monaco editor
 * - Mappings: template mappings JSON in a read-only Monaco editor
 * - Composed: dnd-kit sortable list of component templates
 *
 * Requirements: DETAIL-01, DETAIL-02, DETAIL-03, DETAIL-04, DETAIL-05, NAV-01, SIM-03, SIM-04
 */

interface SortableComponentItemProps {
  id: string;
}

function SortableComponentItem({ id }: SortableComponentItemProps): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <Paper ref={setNodeRef} style={style} p="sm" withBorder {...attributes}>
      <Group gap="sm">
        <ActionIcon variant="transparent" c="dimmed" style={{ cursor: 'grab' }} {...listeners}>
          <IconGripVertical size={16} />
        </ActionIcon>
        <Text size="sm">{id}</Text>
      </Group>
    </Paper>
  );
}

interface TemplateDetailsModalProps {
  templateName: string | null;
  clusterId: string;
  onClose: () => void;
}

export function TemplateDetailsModal({
  templateName,
  clusterId,
  onClose,
}: TemplateDetailsModalProps): React.ReactElement | null {
  const { data: detail, isLoading, error } = useQuery({
    queryKey: queryKeys.cluster(clusterId).template(templateName ?? ''),
    queryFn: () => apiClient.getTemplate(clusterId, templateName!),
    enabled: !!templateName,
  });

  const [simulateResult, setSimulateResult] = useState<SimulateTemplateResponse | null>(null);

  const simulateMutation = useMutation({
    mutationFn: () => {
      const body: SimulateTemplateRequest = {
        indexPatterns: detail?.indexPatterns,
        template: detail?.template,
      };
      return apiClient.simulateTemplate(clusterId, body);
    },
    onSuccess: (result) => setSimulateResult(result),
  });

  const [composedOrder, setComposedOrder] = useState<string[]>([]);

  useEffect(() => {
    if (detail?.composedOf) {
      setComposedOrder(detail.composedOf);
    }
  }, [detail?.composedOf]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setComposedOrder((prev) =>
        arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id)))
      );
    }
  };

  if (!templateName) {
    return null;
  }

  const hasSettings =
    detail?.template?.settings !== undefined &&
    Object.keys(detail.template.settings).length > 0;

  const hasMappings =
    detail?.template?.mappings !== undefined &&
    Object.keys(detail.template.mappings).length > 0;

  return (
    <AnimatePresence>
      <ManagedModal
        opened={!!templateName}
        onClose={onClose}
        title={templateName}
        size="xl"
        centered
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{
            duration: DURATIONS.slow,
            ease: EASINGS.default,
          }}
        >
          {isLoading && (
            <Group justify="center" py="xl">
              <Loader />
            </Group>
          )}

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red">
              {getErrorMessage(error)}
            </Alert>
          )}

          {detail && !isLoading && (
            <Tabs defaultValue="overview">
              <Tabs.List>
                <Tabs.Tab value="overview">Overview</Tabs.Tab>
                <Tabs.Tab value="settings">Settings</Tabs.Tab>
                <Tabs.Tab value="mappings">Mappings</Tabs.Tab>
                <Tabs.Tab value="composed">Composed</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="overview" pt="md">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Name:</Text>
                    <Text size="sm" fw={500}>{detail.name}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Type:</Text>
                    <Badge size="sm" variant="light" color={detail.composable ? 'blue' : 'gray'}>
                      {detail.composable ? 'Composable' : 'Legacy'}
                    </Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Priority / Order:</Text>
                    <Text size="sm" fw={500}>
                      {detail.priority !== undefined
                        ? detail.priority
                        : detail.order !== undefined
                          ? detail.order
                          : 'N/A'}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Version:</Text>
                    <Text size="sm" fw={500}>{detail.version ?? 'N/A'}</Text>
                  </Group>
                  <Group justify="space-between" align="flex-start">
                    <Text size="sm" c="dimmed">Index Patterns:</Text>
                    <Group gap="xs" justify="flex-end" style={{ flex: 1 }}>
                      {detail.indexPatterns.map((pattern) => (
                        <Badge key={pattern} size="sm" variant="outline">
                          {pattern}
                        </Badge>
                      ))}
                    </Group>
                  </Group>

                  <Divider my="sm" />
                  <Group justify="flex-end">
                    <Button
                      variant="light"
                      loading={simulateMutation.isPending}
                      onClick={() => simulateMutation.mutate()}
                      disabled={!detail}
                    >
                      Simulate
                    </Button>
                  </Group>

                  {simulateMutation.isError && (
                    <Alert icon={<IconAlertCircle size={16} />} color="red" mt="sm">
                      Simulate failed: {getErrorMessage(simulateMutation.error)}
                    </Alert>
                  )}

                  {simulateResult && (() => {
                    const before = JSON.stringify(detail?.template ?? {}, null, 2);
                    const after = JSON.stringify(simulateResult.template, null, 2);
                    const patch = createTwoFilesPatch('current', 'simulated', before, after);
                    const files = parseDiff(patch);
                    const file = files[0];
                    if (!file) return <Text c="dimmed" mt="sm">No differences found.</Text>;
                    return (
                      <Box mt="sm" style={{ overflow: 'auto', maxHeight: 400 }}>
                        <Text size="xs" c="dimmed" mb="xs">
                          Diff: current template body → simulated result
                        </Text>
                        <Diff viewType="unified" diffType={file.type} hunks={file.hunks}>
                          {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
                        </Diff>
                      </Box>
                    );
                  })()}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="settings" pt="md">
                {hasSettings ? (
                  <CodeEditor
                    value={JSON.stringify(detail.template?.settings, null, 2)}
                    language="json"
                    height="400px"
                    readOnly
                    showCopyButton
                  />
                ) : (
                  <Text c="dimmed">No settings defined</Text>
                )}
              </Tabs.Panel>

              <Tabs.Panel value="mappings" pt="md">
                {hasMappings ? (
                  <CodeEditor
                    value={JSON.stringify(detail.template?.mappings, null, 2)}
                    language="json"
                    height="400px"
                    readOnly
                    showCopyButton
                  />
                ) : (
                  <Text c="dimmed">No mappings defined</Text>
                )}
              </Tabs.Panel>

              <Tabs.Panel value="composed" pt="md">
                {!detail.composable ? (
                  <Text c="dimmed">This is a legacy template. Composition is not applicable.</Text>
                ) : composedOrder.length === 0 ? (
                  <Text c="dimmed">No component templates are assigned to this template.</Text>
                ) : (
                  <Stack gap="xs">
                    <Text size="xs" c="dimmed" mb="xs">
                      Drag to reorder component template priority (display only).
                    </Text>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={composedOrder}
                        strategy={verticalListSortingStrategy}
                      >
                        {composedOrder.map((name) => (
                          <SortableComponentItem key={name} id={name} />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </Stack>
                )}
              </Tabs.Panel>
            </Tabs>
          )}
        </motion.div>
      </ManagedModal>
    </AnimatePresence>
  );
}
