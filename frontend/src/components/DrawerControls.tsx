import { memo, useState, useCallback } from 'react';
import { Group, Stack, Menu, ActionIcon, Text, Divider, Tooltip, Avatar } from '@mantine/core';
import { IconLogout, IconSettings } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { UserSettingsModal } from './UserSettingsModal';
import type { User } from '../contexts/AuthContext';

interface DrawerControlsProps {
  collapsed: boolean;
  user?: User | null;
  onLogout?: () => void;
}

/**
 * DrawerControls renders the user / settings section at the bottom of the navigation drawer.
 *
 * Behaviour:
 * - Always shows a settings entry point (so theme can be changed in any auth mode)
 * - When auth is enabled: avatar + username dropdown with "User settings" and "Logout"
 * - When auth is disabled (open mode): plain settings icon / row
 * - Collapsed: icon-only mode
 *
 * Requirements: 8.0
 */
export const DrawerControls = memo(function DrawerControls({
  collapsed,
  user,
  onLogout,
}: DrawerControlsProps) {
  const { isAuthEnabled } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleOpenSettings = useCallback(() => setSettingsOpen(true), []);
  const handleCloseSettings = useCallback(() => setSettingsOpen(false), []);

  // Modal rendered once outside both branches so it survives collapsed ↔ expanded transitions.
  const modal = (
    <UserSettingsModal
      opened={settingsOpen}
      onClose={handleCloseSettings}
      user={user ?? null}
    />
  );

  // ── Collapsed (icon-only) ────────────────────────────────────────────────
  if (collapsed) {
    return (
      <>
        {modal}
        <Stack gap="xs" align="center">
          <Divider style={{ width: '100%' }} />

          {isAuthEnabled && user ? (
            // Auth enabled: show avatar that opens settings
            <Tooltip label="User settings" position="right">
              <ActionIcon
                variant="subtle"
                size="lg"
                aria-label="User settings"
                onClick={handleOpenSettings}
              >
                <Avatar name={user.username} size="sm" />
              </ActionIcon>
            </Tooltip>
          ) : (
            // Open/anonymous mode: plain settings icon
            <Tooltip label="Settings" position="right">
              <ActionIcon
                variant="subtle"
                size="lg"
                aria-label="Settings"
                onClick={handleOpenSettings}
              >
                <IconSettings size={20} />
              </ActionIcon>
            </Tooltip>
          )}
        </Stack>
      </>
    );
  }

  // ── Expanded ─────────────────────────────────────────────────────────────
  return (
    <>
      {modal}
      <Stack gap="sm">
        <Divider />

        {isAuthEnabled && user && onLogout ? (
          // Auth enabled: avatar + username dropdown
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <Group
                gap="sm"
                style={{ cursor: 'pointer', padding: '8px', borderRadius: '4px' }}
                role="button"
                aria-label="User menu"
                tabIndex={0}
              >
                <Avatar name={user.username} size="md" />
                <Text size="sm" fw={500}>
                  {user.username}
                </Text>
              </Group>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Item leftSection={<IconSettings size={16} />} onClick={handleOpenSettings}>
                User Settings
              </Menu.Item>

              <Menu.Divider />

              <Menu.Item leftSection={<IconLogout size={16} />} onClick={onLogout} color="red">
                Logout
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : (
          // Open/anonymous mode: simple settings row
          <Group
            gap="sm"
            style={{ cursor: 'pointer', padding: '8px', borderRadius: '4px' }}
            role="button"
            aria-label="User Settings"
            tabIndex={0}
            onClick={handleOpenSettings}
          >
            <IconSettings size={20} />
            <Text size="sm">User Settings</Text>
          </Group>
        )}
      </Stack>
    </>
  );
});
