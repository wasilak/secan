import { memo, useCallback, useMemo } from 'react';
import { Group, Stack, Menu, ActionIcon, Avatar, Text, Divider, Tooltip } from '@mantine/core';
import { IconUser, IconLogout, IconSun, IconMoon, IconDeviceDesktop } from '@tabler/icons-react';
import { useTheme, type Theme } from '../hooks/useTheme';
import { useMantineColorScheme } from '@mantine/core';

interface DrawerControlsProps {
  collapsed: boolean;
  user: {
    username: string;
    roles: string[];
  };
  onLogout: () => void;
}

/**
 * DrawerControls component displays user menu and theme selector at the bottom of the drawer.
 * 
 * Features:
 * - Shows icon-only when drawer is collapsed
 * - Shows icons with labels when drawer is expanded
 * - User menu with logout functionality
 * - Theme selector for light/dark/system modes
 * - Memoized for performance optimization
 * 
 * Requirements: 4.1, 4.2, 4.5, 4.6
 */
export const DrawerControls = memo(function DrawerControls({ collapsed, user, onLogout }: DrawerControlsProps) {
  const { theme, setTheme } = useTheme();
  const { colorScheme } = useMantineColorScheme();

  // Memoize theme icon to avoid recalculation on every render
  const themeIcon = useMemo(() => {
    if (theme === 'system') {
      return <IconDeviceDesktop size={20} />;
    }
    return colorScheme === 'dark' ? <IconMoon size={20} /> : <IconSun size={20} />;
  }, [theme, colorScheme]);

  // Memoize user initial
  const userInitial = useMemo(() => user.username.charAt(0).toUpperCase(), [user.username]);

  // Memoize roles string
  const rolesString = useMemo(() => user.roles.join(', '), [user.roles]);

  // Memoize theme change handler
  const handleThemeChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
  }, [setTheme]);

  if (collapsed) {
    // Icon-only display when drawer is collapsed
    return (
      <Stack gap="xs" align="center">
        <Divider style={{ width: '100%' }} />
        
        {/* Theme selector - icon only */}
        <Menu shadow="md" width={200} position="right">
          <Menu.Target>
            <Tooltip label="Change theme" position="right">
              <ActionIcon
                variant="subtle"
                size="lg"
                aria-label="Toggle theme"
              >
                {themeIcon}
              </ActionIcon>
            </Tooltip>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Label>Theme</Menu.Label>
            
            <Menu.Item
              leftSection={<IconSun size={16} />}
              onClick={() => handleThemeChange('light')}
              bg={theme === 'light' ? 'var(--mantine-color-blue-light)' : undefined}
            >
              Light
            </Menu.Item>
            
            <Menu.Item
              leftSection={<IconMoon size={16} />}
              onClick={() => handleThemeChange('dark')}
              bg={theme === 'dark' ? 'var(--mantine-color-blue-light)' : undefined}
            >
              Dark
            </Menu.Item>
            
            <Menu.Item
              leftSection={<IconDeviceDesktop size={16} />}
              onClick={() => handleThemeChange('system')}
              bg={theme === 'system' ? 'var(--mantine-color-blue-light)' : undefined}
            >
              System
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>

        {/* User menu - icon only */}
        <Menu shadow="md" width={200} position="right">
          <Menu.Target>
            <Tooltip label={user.username} position="right">
              <ActionIcon
                variant="subtle"
                size="lg"
                aria-label="User menu"
              >
                <Avatar size="sm" radius="xl" color="blue">
                  {userInitial}
                </Avatar>
              </ActionIcon>
            </Tooltip>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Label>
              <Group gap="xs">
                <IconUser size={16} aria-hidden="true" />
                {user.username}
              </Group>
            </Menu.Label>
            
            <Menu.Item c="dimmed" disabled>
              Roles: {rolesString}
            </Menu.Item>

            <Menu.Divider />

            <Menu.Item
              leftSection={<IconLogout size={16} aria-hidden="true" />}
              onClick={onLogout}
              color="red"
            >
              Logout
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Stack>
    );
  }

  // Full display with labels when drawer is expanded
  return (
    <Stack gap="sm">
      <Divider />
      
      {/* Theme selector with label */}
      <Menu shadow="md" width={200}>
        <Menu.Target>
          <Group
            gap="sm"
            style={{ 
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: 'var(--mantine-color-gray-light-hover)',
              }
            }}
            role="button"
            aria-label="Toggle theme"
            tabIndex={0}
          >
            {themeIcon}
            <Text size="sm">
              Theme: {theme.charAt(0).toUpperCase() + theme.slice(1)}
            </Text>
          </Group>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Theme</Menu.Label>
          
          <Menu.Item
            leftSection={<IconSun size={16} />}
            onClick={() => handleThemeChange('light')}
            bg={theme === 'light' ? 'var(--mantine-color-blue-light)' : undefined}
          >
            Light
          </Menu.Item>
          
          <Menu.Item
            leftSection={<IconMoon size={16} />}
            onClick={() => handleThemeChange('dark')}
            bg={theme === 'dark' ? 'var(--mantine-color-blue-light)' : undefined}
          >
            Dark
          </Menu.Item>
          
          <Menu.Item
            leftSection={<IconDeviceDesktop size={16} />}
            onClick={() => handleThemeChange('system')}
            bg={theme === 'system' ? 'var(--mantine-color-blue-light)' : undefined}
          >
            System
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {/* User menu with label */}
      <Menu shadow="md" width={200}>
        <Menu.Target>
          <Group
            gap="sm"
            style={{ 
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: 'var(--mantine-color-gray-light-hover)',
              }
            }}
            role="button"
            aria-label="User menu"
            tabIndex={0}
          >
            <Avatar size="sm" radius="xl" color="blue">
              {userInitial}
            </Avatar>
            <Text size="sm">{user.username}</Text>
          </Group>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>
            <Group gap="xs">
              <IconUser size={16} aria-hidden="true" />
              {user.username}
            </Group>
          </Menu.Label>
          
          <Menu.Item c="dimmed" disabled>
            Roles: {rolesString}
          </Menu.Item>

          <Menu.Divider />

          <Menu.Item
            leftSection={<IconLogout size={16} aria-hidden="true" />}
            onClick={onLogout}
            color="red"
          >
            Logout
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Stack>
  );
});
