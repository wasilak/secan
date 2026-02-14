import { AppShell as MantineAppShell, Burger, Group, Text, NavLink, Avatar, Menu, ActionIcon } from '@mantine/core';
import { useDisclosure, useHotkeys } from '@mantine/hooks';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  IconDashboard, 
  IconServer, 
  IconLogout, 
  IconUser,
  IconChevronDown,
  IconKeyboard,
} from '@tabler/icons-react';
import { ThemeSelector } from './ThemeSelector';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { SpotlightSearch } from './SpotlightSearch';

/**
 * AppShell component provides the main layout structure for the application.
 * 
 * Features:
 * - Header with app title and user controls
 * - Collapsible sidebar with navigation menu
 * - User information display
 * - Logout button
 * - Theme selector integration
 * - Responsive design with mobile support
 * - Keyboard shortcuts support
 */
export function AppShell() {
  const [opened, { toggle }] = useDisclosure();
  const [shortcutsOpened, { open: openShortcuts, close: closeShortcuts }] = useDisclosure(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Keyboard shortcut to open help
  useHotkeys([
    ['?', openShortcuts],
    ['shift+/', openShortcuts],
  ]);

  // TODO: Replace with actual user data from auth context
  const user = {
    username: 'admin',
    roles: ['admin'],
  };

  const handleLogout = () => {
    // TODO: Implement actual logout logic
    console.log('Logout clicked');
    navigate('/login');
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <MantineAppShell
      header={{ height: { base: 56, sm: 60 } }}
      navbar={{
        width: { base: '100%', sm: 250, md: 280 },
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding={{ base: 'sm', sm: 'md', lg: 'lg' }}
    >
      {/* Header */}
      <MantineAppShell.Header>
        <Group 
          h="100%" 
          px={{ base: 'sm', sm: 'md' }} 
          justify="space-between" 
          component="header" 
          role="banner"
          wrap="nowrap"
        >
          <Group gap="xs" wrap="nowrap">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              aria-label={opened ? 'Close navigation menu' : 'Open navigation menu'}
            />
            <Text 
              size="xl"
              fw={700} 
              component="h1"
              style={{ whiteSpace: 'nowrap' }}
            >
              Cerebro
            </Text>
          </Group>

          <Group gap="xs" wrap="nowrap">
            <ThemeSelector />
            
            {/* Keyboard shortcuts button - hidden on mobile */}
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={openShortcuts}
              aria-label="View keyboard shortcuts"
              title="Keyboard shortcuts (?)"
              visibleFrom="sm"
            >
              <IconKeyboard size={20} />
            </ActionIcon>
            
            {/* User menu */}
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  aria-label="User menu"
                >
                  <Group gap="xs" wrap="nowrap">
                    <Avatar size="sm" radius="xl" color="blue" aria-hidden="true">
                      {user.username.charAt(0).toUpperCase()}
                    </Avatar>
                    <IconChevronDown size={16} aria-hidden="true" style={{ display: 'none' }} className="hide-mobile" />
                  </Group>
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>
                  <Group gap="xs">
                    <IconUser size={16} aria-hidden="true" />
                    {user.username}
                  </Group>
                </Menu.Label>
                
                <Menu.Item c="dimmed" disabled>
                  Roles: {user.roles.join(', ')}
                </Menu.Item>

                <Menu.Divider />

                <Menu.Item
                  leftSection={<IconKeyboard size={16} aria-hidden="true" />}
                  onClick={openShortcuts}
                >
                  Keyboard Shortcuts
                </Menu.Item>

                <Menu.Divider />

                <Menu.Item
                  leftSection={<IconLogout size={16} aria-hidden="true" />}
                  onClick={handleLogout}
                  color="red"
                >
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </MantineAppShell.Header>

      {/* Sidebar Navigation */}
      <MantineAppShell.Navbar 
        p={{ base: 'sm', sm: 'md' }} 
        component="nav" 
        role="navigation" 
        aria-label="Main navigation"
      >
        <MantineAppShell.Section grow>
          <NavLink
            href="/"
            label="Dashboard"
            leftSection={<IconDashboard size={20} aria-hidden="true" />}
            active={isActive('/')}
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
              if (opened) toggle();
            }}
            aria-current={isActive('/') ? 'page' : undefined}
          />

          {/* Cluster navigation will be populated dynamically */}
          <NavLink
            label="Clusters"
            leftSection={<IconServer size={20} aria-hidden="true" />}
            childrenOffset={28}
            defaultOpened={location.pathname.startsWith('/cluster')}
          >
            {/* TODO: Populate with actual clusters from API */}
            <Text size="sm" c="dimmed" p="xs">
              No clusters configured
            </Text>
          </NavLink>
        </MantineAppShell.Section>

        <MantineAppShell.Section>
          <Text size="xs" c="dimmed" ta="center" role="contentinfo">
            Cerebro v0.1.0
          </Text>
        </MantineAppShell.Section>
      </MantineAppShell.Navbar>

      {/* Main Content */}
      <MantineAppShell.Main component="main" role="main">
        <Outlet />
      </MantineAppShell.Main>

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcuts opened={shortcutsOpened} onClose={closeShortcuts} />
      
      {/* Spotlight Search - must be inside router context */}
      <SpotlightSearch />
    </MantineAppShell>
  );
}
