import React from 'react';
import { Stack, Text, Group, Badge, Loader, Alert, Tabs, Paper } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { ManagedModal } from './ManagedModal';
import { CodeEditor } from './CodeEditor';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';
import { getErrorMessage } from '../lib/errorHandling';
import { DURATIONS, EASINGS } from '../lib/transitions';

/**
 * TemplateDetailsModal component
 *
 * Displays full details of a single index template across four tabs:
 * - Overview: key metadata fields
 * - Settings: template settings JSON in a read-only Monaco editor
 * - Mappings: template mappings JSON in a read-only Monaco editor
 * - Composed: list of component templates for composable templates
 *
 * Requirements: DETAIL-01, DETAIL-02, DETAIL-03, DETAIL-04, DETAIL-05, NAV-01
 */
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
                  {/* Simulate button added in Wave 3 (SIM-03) */}
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
                  <Text c="dimmed">
                    This is a legacy template. Composition is not applicable.
                  </Text>
                ) : detail.composedOf.length === 0 ? (
                  <Text c="dimmed">
                    No component templates. Drag-and-drop selector coming in the next step.
                  </Text>
                ) : (
                  <Stack gap="xs">
                    {detail.composedOf.map((name) => (
                      <Paper key={name} p="sm" withBorder>
                        <Text size="sm">{name}</Text>
                      </Paper>
                    ))}
                    {/* dnd-kit drag-and-drop added in Wave 3 (SIM-04) */}
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
