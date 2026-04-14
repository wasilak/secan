import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Paper, Stack, Text, Box } from '@mantine/core';
import { SortableItem, SortableItemData } from './SortableItem';

interface DroppableContainerProps {
  id: string;
  title: string;
  items: SortableItemData[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onPreview: (id: string) => void;
  emptyMessage?: string;
  showCheckbox?: boolean;
  showDragHandle?: boolean;
}

export function DroppableContainer({
  id,
  title,
  items,
  selectedIds,
  onToggle,
  onPreview,
  emptyMessage = 'No items',
  showCheckbox = true,
  showDragHandle = true,
}: DroppableContainerProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <Paper
      ref={setNodeRef}
      withBorder
      p="md"
      style={{
        minHeight: 200,
        backgroundColor: isOver ? 'var(--mantine-color-blue-light)' : undefined,
        borderColor: isOver ? 'var(--mantine-color-blue-6)' : undefined,
        transition: 'background-color 0.2s, border-color 0.2s',
      }}
    >
      <Text fw={600} mb="sm" size="sm">
        {title} ({items.length})
      </Text>

      {items.length === 0 ? (
        <Box py="xl" style={{ textAlign: 'center' }}>
          <Text c="dimmed" size="sm">
            {emptyMessage}
          </Text>
        </Box>
      ) : (
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <Stack gap="xs">
            {items.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                isSelected={selectedIds.has(item.id)}
                onToggle={onToggle}
                onPreview={onPreview}
                showCheckbox={showCheckbox}
                showDragHandle={showDragHandle}
              />
            ))}
          </Stack>
        </SortableContext>
      )}
    </Paper>
  );
}