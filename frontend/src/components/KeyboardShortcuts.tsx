import { Modal, Stack, Text, Table, Group, Code, Title } from '@mantine/core';
import { IconKeyboard } from '@tabler/icons-react';

interface KeyboardShortcutsProps {
  opened: boolean;
  onClose: () => void;
}

/**
 * KeyboardShortcuts component displays available keyboard shortcuts
 * 
 * Features:
 * - List all keyboard shortcuts
 * - Organized by category
 * - Platform-specific shortcuts (Cmd/Ctrl)
 * 
 * Requirements: 32.3, 32.4
 */
export function KeyboardShortcuts({ opened, onClose }: KeyboardShortcutsProps) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcuts = [
    {
      category: 'Navigation',
      items: [
        { keys: [`${modKey}`, 'K'], description: 'Open command palette' },
        { keys: [`${modKey}`, 'P'], description: 'Open command palette (alternative)' },
        { keys: ['Esc'], description: 'Close command palette' },
        { keys: ['↑', '↓'], description: 'Navigate through search results' },
        { keys: ['Enter'], description: 'Select highlighted item' },
      ],
    },
    {
      category: 'General',
      items: [
        { keys: ['Tab'], description: 'Move focus to next element' },
        { keys: ['Shift', 'Tab'], description: 'Move focus to previous element' },
        { keys: ['Space'], description: 'Activate focused button or link' },
        { keys: ['Enter'], description: 'Submit form or activate button' },
        { keys: ['Esc'], description: 'Close modal or dialog' },
      ],
    },
    {
      category: 'Tables',
      items: [
        { keys: ['Click'], description: 'Sort table column' },
        { keys: ['Enter'], description: 'Navigate to row details' },
        { keys: ['Space'], description: 'Select row (when applicable)' },
      ],
    },
  ];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconKeyboard size={24} />
          <Title order={3}>Keyboard Shortcuts</Title>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="xl">
        {shortcuts.map((section) => (
          <div key={section.category}>
            <Text size="lg" fw={600} mb="sm">
              {section.category}
            </Text>
            <Table>
              <Table.Tbody>
                {section.items.map((item, idx) => (
                  <Table.Tr key={idx}>
                    <Table.Td width="40%">
                      <Group gap="xs">
                        {item.keys.map((key, keyIdx) => (
                          <Group gap={4} key={keyIdx}>
                            <Code>{key}</Code>
                            {keyIdx < item.keys.length - 1 && <Text size="sm">+</Text>}
                          </Group>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{item.description}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        ))}

        <Text size="sm" c="dimmed">
          Press <Code>?</Code> at any time to view this help dialog.
        </Text>
      </Stack>
    </Modal>
  );
}
