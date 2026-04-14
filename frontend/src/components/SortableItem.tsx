import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Paper, Group, Text, ThemeIcon, Badge, Box } from '@mantine/core';
import { IconGripVertical } from '@tabler/icons-react';

export interface SortableItemData {
  id: string;
  name: string;
  hasSettings: boolean;
  hasMappings: boolean;
  hasAliases: boolean;
}

interface SortableItemProps {
  item: SortableItemData;
  isSelected: boolean;
  onToggle: (id: string) => void;
  onPreview: (id: string) => void;
  showCheckbox?: boolean;
  showDragHandle?: boolean;
  isDragging?: boolean;
}

export function SortableItem({
  item,
  isSelected,
  onToggle,
  onPreview,
  showCheckbox = true,
  showDragHandle = true,
  isDragging = false,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSorting,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-checkbox]') || target.closest('[data-drag-handle]')) {
      return;
    }
    onPreview(item.id);
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      withBorder
      p="xs"
      onClick={handleClick}
      data-item-id={item.id}
      className="sortable-item"
      shadow={isSorting || isDragging ? 'md' : undefined}
      {...attributes}
    >
      <Group gap="xs" wrap="nowrap">
        {showDragHandle && (
          <Box
            data-drag-handle
            style={{ cursor: 'grab', display: 'flex' }}
            {...listeners}
          >
            <ThemeIcon variant="subtle" color="gray" size="sm">
              <IconGripVertical size={14} />
            </ThemeIcon>
          </Box>
        )}

        {showCheckbox && (
          <input
            type="checkbox"
            data-checkbox
            checked={isSelected}
            onChange={() => onToggle(item.id)}
            onClick={(e) => e.stopPropagation()}
            style={{ cursor: 'pointer' }}
          />
        )}

        <Text size="sm" fw={500} style={{ flex: 1, cursor: 'pointer' }}>
          {item.name}
        </Text>

        <Group gap={4}>
          {item.hasSettings && <Badge size="xs" color="blue">S</Badge>}
          {item.hasMappings && <Badge size="xs" color="green">M</Badge>}
          {item.hasAliases && <Badge size="xs" color="violet">A</Badge>}
        </Group>
      </Group>
    </Paper>
  );
}