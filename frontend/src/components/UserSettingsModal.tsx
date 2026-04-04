import { useState, useEffect } from 'react';
import {
  Avatar,
  Badge,
  Center,
  Group,
  Stack,
  Text,
  Tabs,
  SegmentedControl,
  Box,
  Divider,
  Alert,
} from '@mantine/core';
import { AnimatePresence, motion } from 'framer-motion';
import {
  IconUser,
  IconSettings,
  IconKey,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconInfoCircle,
} from '@tabler/icons-react';
import { ManagedModal } from './ManagedModal';
import { AuthTypeBadge, getAuthTypeColor } from './AuthTypeBadge';
import { useTheme } from '../hooks/useTheme';
import { DURATIONS, EASINGS } from '../lib/transitions';
import type { User } from '../contexts/AuthContext';

interface UserSettingsModalProps {
  opened: boolean;
  onClose: () => void;
  user: User | null;
}

// ── Profile Tab ───────────────────────────────────────────────────────────────

function ProfileTab({ user }: { user: User | null }) {
  const isAuthenticated = user !== null && user.username !== 'open';

  if (!isAuthenticated) {
    return (
      <Stack gap="lg" pt="md">
        <Group gap="md" align="center">
          <Avatar size="xl" color="gray" />
          <Stack gap={6}>
            <Text fw={600} size="xl" lh={1.2} c="dimmed">
              Unauthenticated
            </Text>
            <AuthTypeBadge authType="open" size="sm" />
          </Stack>
        </Group>
      </Stack>
    );
  }

  const authColor = getAuthTypeColor(user.auth_type);

  return (
    <Stack gap="lg" pt="md">
      {/* User identity header */}
      <Group gap="md" align="center">
        <Avatar
          name={user.username}
          size="xl"
          color={authColor}
          style={{
            ring: 3,
            boxShadow: `0 0 0 3px var(--mantine-color-${authColor}-4)`,
          }}
        />
        <Stack gap={6}>
          <Text fw={600} size="xl" lh={1.2}>
            {user.username}
          </Text>
          <AuthTypeBadge authType={user.auth_type} size="sm" />
        </Stack>
      </Group>

      <Divider />

      {/* Groups */}
      <Stack gap="xs">
        <Text size="sm" fw={500} c="dimmed">
          Groups
        </Text>
        {user.roles.length === 0 ? (
          <Text size="sm" c="dimmed" fs="italic">
            No groups assigned
          </Text>
        ) : (
          <Group gap="xs" wrap="wrap">
            {user.roles.map((role) => (
              <Badge key={role} size="sm" variant="outline" color="gray" style={{ textTransform: 'none' }}>
                {role}
              </Badge>
            ))}
          </Group>
        )}
      </Stack>
    </Stack>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab() {
  const { theme, setTheme } = useTheme();
  const [selected, setSelected] = useState<'light' | 'dark' | 'system'>(theme);

  // Stay in sync if theme changes externally (e.g. OS preference change)
  useEffect(() => {
    setSelected(theme);
  }, [theme]);

  const handleChange = (value: string) => {
    const t = value as 'light' | 'dark' | 'system';
    // Update local state immediately so the CSS transition starts before
    // setTheme triggers a Mantine context re-render (which would cause
    // FloatingIndicator's ResizeObserver to reposition the indicator and
    // cancel the in-flight transition).
    setSelected(t);
    setTimeout(() => setTheme(t), 0);
  };

  return (
    <Stack gap="lg" pt="md">
      <Stack gap="xs">
        <Text size="sm" fw={500} c="dimmed">
          Theme
        </Text>
        <SegmentedControl
          value={selected}
          onChange={handleChange}
          transitionDuration={500}
          transitionTimingFunction="linear"
          data={[
            {
              value: 'light',
              label: (
                <Center style={{ gap: 6 }}>
                  <IconSun size={14} />
                  <span>Light</span>
                </Center>
              ),
            },
            {
              value: 'dark',
              label: (
                <Center style={{ gap: 6 }}>
                  <IconMoon size={14} />
                  <span>Dark</span>
                </Center>
              ),
            },
            {
              value: 'system',
              label: (
                <Center style={{ gap: 6 }}>
                  <IconDeviceDesktop size={14} />
                  <span>System</span>
                </Center>
              ),
            },
          ]}
        />
      </Stack>
    </Stack>
  );
}

// ── API Keys Tab ──────────────────────────────────────────────────────────────

function ApiKeysTab() {
  return (
    <Stack gap="lg" pt="md">
      <Alert icon={<IconInfoCircle size={16} />} color="gray" variant="light">
        API key management is coming soon. You will be able to generate and revoke
        personal access tokens for programmatic access.
      </Alert>
    </Stack>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

/**
 * UserSettingsModal provides a tabbed interface for user profile, app settings, and API keys.
 *
 * Tabs:
 * - Profile: read-only identity (username, auth type, groups)
 * - Settings: theme selector
 * - API Keys: placeholder
 */
export function UserSettingsModal({ opened, onClose, user }: UserSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<string | null>('profile');

  return (
    <ManagedModal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconUser size={18} />
          <Text fw={600}>User Settings</Text>
        </Group>
      }
      size="lg"
      centered
    >
      <AnimatePresence mode="wait">
        {opened && (
          <motion.div
            key="user-settings-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: DURATIONS.slow, ease: EASINGS.default }}
          >
            <Box pb="md">
              <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                  <Tabs.Tab value="profile" leftSection={<IconUser size={14} />}>
                    Profile
                  </Tabs.Tab>
                  <Tabs.Tab value="settings" leftSection={<IconSettings size={14} />}>
                    User Settings
                  </Tabs.Tab>
                  <Tabs.Tab value="apikeys" leftSection={<IconKey size={14} />}>
                    API Keys
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="profile">
                  <ProfileTab user={user} />
                </Tabs.Panel>

                <Tabs.Panel value="settings">
                  <SettingsTab />
                </Tabs.Panel>

                <Tabs.Panel value="apikeys">
                  <ApiKeysTab />
                </Tabs.Panel>
              </Tabs>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </ManagedModal>
  );
}
