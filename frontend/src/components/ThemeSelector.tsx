import { ActionIcon, Menu, useMantineColorScheme } from '@mantine/core';
import { IconSun, IconMoon, IconDeviceDesktop } from '@tabler/icons-react';
import { useTheme, type Theme } from '../hooks/useTheme';

/**
 * ThemeSelector component provides a UI for switching between light, dark, and system themes.
 * 
 * Features:
 * - Displays current theme with appropriate icon
 * - Menu with options for light, dark, and system modes
 * - Persists theme preference to localStorage
 * - Applies theme changes immediately
 */
export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const { colorScheme } = useMantineColorScheme();

  // Get icon based on current resolved theme
  const getIcon = () => {
    if (theme === 'system') {
      return <IconDeviceDesktop size={20} />;
    }
    return colorScheme === 'dark' ? <IconMoon size={20} /> : <IconSun size={20} />;
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  return (
    <Menu shadow="md" width={200}>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          size="lg"
          aria-label="Toggle theme"
          title="Change theme"
        >
          {getIcon()}
        </ActionIcon>
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
  );
}
