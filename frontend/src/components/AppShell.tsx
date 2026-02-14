import { AppShell as MantineAppShell, Burger, Group, Text, NavLink, Avatar, Menu, ActionIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  IconDashboard, 
  IconServer, 
  IconLogout, 
  IconUser,
  IconChevronDown 
} from '@tabler/icons-react';
import { ThemeSelector } from './ThemeSelector';

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
 */
export function AppShell() {
  const [opened, { toggle }] = useDisclosure();
  const navigate = useNavigate();
  const location = useLocation();

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
      header={{ height: 60 }}
      navbar={{
        width: 250,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      {/* Header */}
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
            />
            <Text size="xl" fw={700}>
              Cerebro
            </Text>
          </Group>

          <Group gap="sm">
            <ThemeSelector />
            
            {/* User menu */}
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  aria-label="User menu"
                >
                  <Group gap="xs">
                    <Avatar size="sm" radius="xl" color="blue">
                      {user.username.charAt(0).toUpperCase()}
                    </Avatar>
                    <IconChevronDown size={16} />
                  </Group>
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>
                  <Group gap="xs">
                    <IconUser size={16} />
                    {user.username}
                  </Group>
                </Menu.Label>
                
                <Menu.Item c="dimmed" disabled>
                  Roles: {user.roles.join(', ')}
                </Menu.Item>

                <Menu.Divider />

                <Menu.Item
                  leftSection={<IconLogout size={16} />}
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
      <MantineAppShell.Navbar p="md">
        <MantineAppShell.Section grow>
          <NavLink
            href="/"
            label="Dashboard"
            leftSection={<IconDashboard size={20} />}
            active={isActive('/')}
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
              if (opened) toggle();
            }}
          />

          {/* Cluster navigation will be populated dynamically */}
          <NavLink
            label="Clusters"
            leftSection={<IconServer size={20} />}
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
          <Text size="xs" c="dimmed" ta="center">
            Cerebro v0.1.0
          </Text>
        </MantineAppShell.Section>
      </MantineAppShell.Navbar>

      {/* Main Content */}
      <MantineAppShell.Main>
        <Outlet />
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
