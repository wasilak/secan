import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Group, Box, Modal } from '@mantine/core';
import { DroppableContainer } from './DroppableContainer';
import { SortableItemData } from './SortableItem';

export interface ComponentTemplate {
  name: string;
  hasSettings: boolean;
  hasMappings: boolean;
  hasAliases: boolean;
  fullJson?: object;
}

export interface SortableTransferListProps {
  availableItems: ComponentTemplate[];
  selectedIds: string[];
  onSelectedChange: (selectedIds: string[]) => void;
  onPreview?: (itemName: string, fullJson: object) => void;
}

const AVAILABLE_ID = 'available';
const SELECTED_ID = 'selected';

function toSortableItem(template: ComponentTemplate): SortableItemData {
  return {
    id: template.name,
    name: template.name,
    hasSettings: template.hasSettings,
    hasMappings: template.hasMappings,
    hasAliases: template.hasAliases,
  };
}

export function SortableTransferList({
  availableItems,
  selectedIds,
  onSelectedChange,
  onPreview,
}: SortableTransferListProps) {
  const [previewItem, setPreviewItem] = useState<{ name: string; json: object } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const availableTemplates = useMemo(
    () => availableItems.filter((t) => !selectedSet.has(t.name)),
    [availableItems, selectedSet]
  );

  const selectedTemplates = useMemo(
    () => availableItems.filter((t) => selectedSet.has(t.name)),
    [availableItems, selectedSet]
  );

  const availableItemsData = useMemo(
    () => availableTemplates.map(toSortableItem),
    [availableTemplates]
  );

  const selectedItemsData = useMemo(
    () => selectedTemplates.map(toSortableItem),
    [selectedTemplates]
  );

  const findContainer = (id: string): string | null => {
    if (selectedSet.has(id)) return SELECTED_ID;
    if (availableTemplates.some((t) => t.name === id)) return AVAILABLE_ID;
    return null;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    if (activeContainer === AVAILABLE_ID && overContainer === SELECTED_ID) {
      const activeItem = availableTemplates.find((t) => t.name === active.id);
      if (activeItem) {
        onSelectedChange([...selectedIds, activeItem.name]);
      }
    } else if (activeContainer === SELECTED_ID && overContainer === AVAILABLE_ID) {
      onSelectedChange(selectedIds.filter((id) => id !== active.id));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);

    if (activeContainer === SELECTED_ID && overContainer === SELECTED_ID) {
      const oldIndex = selectedIds.indexOf(active.id as string);
      const newIndex = selectedIds.indexOf(over.id as string);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        onSelectedChange(arrayMove(selectedIds, oldIndex, newIndex));
      }
    }
  };

  const handleToggle = (id: string) => {
    if (selectedSet.has(id)) {
      onSelectedChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onSelectedChange([...selectedIds, id]);
    }
  };

  const handlePreview = (id: string) => {
    const item = availableItems.find((t) => t.name === id);
    if (item && onPreview) {
      onPreview(item.name, item.fullJson || {});
    } else if (item) {
      setPreviewItem({ name: item.name, json: item.fullJson || {} });
    }
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <Group grow align="flex-start">
          <DroppableContainer
            id={AVAILABLE_ID}
            title="Available"
            items={availableItemsData}
            selectedIds={selectedSet}
            onToggle={handleToggle}
            onPreview={handlePreview}
            emptyMessage="No more component templates"
            showCheckbox={true}
            showDragHandle={false}
          />

          <DroppableContainer
            id={SELECTED_ID}
            title="Selected (composed_of)"
            items={selectedItemsData}
            selectedIds={selectedSet}
            onToggle={handleToggle}
            onPreview={handlePreview}
            emptyMessage="Drag items here to add"
            showCheckbox={true}
            showDragHandle={true}
          />
        </Group>
      </DndContext>

      <Modal
        opened={!!previewItem}
        onClose={() => setPreviewItem(null)}
        title={`Component Template: ${previewItem?.name}`}
        size="lg"
      >
        {previewItem && (
          <Box style={{ maxHeight: 400, overflow: 'auto' }}>
            <pre style={{ margin: 0, padding: 16, background: 'var(--mantine-color-gray-0)', borderRadius: 4 }}>
              {JSON.stringify(previewItem.json, null, 2)}
            </pre>
          </Box>
        )}
      </Modal>
    </>
  );
}