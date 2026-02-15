import { Tooltip, Group, Text } from '@mantine/core';
import {
  IconDatabase,
  IconCrown,
  IconFileText,
  IconTransform,
  IconCloud,
  IconBolt,
  IconServer,
} from '@tabler/icons-react';

/**
 * Role icon mapping
 */
const ROLE_ICONS: Record<string, { icon: typeof IconDatabase; color: string; label: string }> = {
  master: { icon: IconCrown, color: 'yellow', label: 'Master' },
  data: { icon: IconDatabase, color: 'blue', label: 'Data' },
  ingest: { icon: IconTransform, color: 'grape', label: 'Ingest' },
  ml: { icon: IconBolt, color: 'orange', label: 'ML' },
  remote_cluster_client: { icon: IconCloud, color: 'cyan', label: 'Remote Client' },
  transform: { icon: IconTransform, color: 'teal', label: 'Transform' },
  data_content: { icon: IconFileText, color: 'indigo', label: 'Data Content' },
  data_hot: { icon: IconDatabase, color: 'red', label: 'Data Hot' },
  data_warm: { icon: IconDatabase, color: 'orange', label: 'Data Warm' },
  data_cold: { icon: IconDatabase, color: 'blue', label: 'Data Cold' },
  data_frozen: { icon: IconDatabase, color: 'cyan', label: 'Data Frozen' },
  voting_only: { icon: IconCrown, color: 'gray', label: 'Voting Only' },
};

/**
 * Get icon for a role
 */
export function getRoleIcon(role: string) {
  return ROLE_ICONS[role] || { icon: IconServer, color: 'gray', label: role };
}

/**
 * RoleIcon component displays a single role icon with tooltip
 */
export function RoleIcon({ role, size = 16 }: { role: string; size?: number }) {
  const roleInfo = getRoleIcon(role);
  const Icon = roleInfo.icon;

  return (
    <Tooltip label={roleInfo.label} withArrow>
      <Icon size={size} color={`var(--mantine-color-${roleInfo.color}-6)`} />
    </Tooltip>
  );
}

/**
 * RoleIcons component displays multiple role icons
 */
export function RoleIcons({ roles, size = 16 }: { roles: string[]; size?: number }) {
  return (
    <Group gap={4}>
      {roles.map((role) => (
        <RoleIcon key={role} role={role} size={size} />
      ))}
    </Group>
  );
}

/**
 * RoleLegend component displays a legend of all role icons
 */
export function RoleLegend({ roles }: { roles: string[] }) {
  return (
    <Group gap="md" wrap="wrap">
      <Text size="sm" fw={500} c="dimmed">
        Role Legend:
      </Text>
      {roles.map((role) => {
        const roleInfo = getRoleIcon(role);
        const Icon = roleInfo.icon;
        return (
          <Group key={role} gap={4}>
            <Icon size={16} color={`var(--mantine-color-${roleInfo.color}-6)`} />
            <Text size="xs" c="dimmed">
              {roleInfo.label}
            </Text>
          </Group>
        );
      })}
    </Group>
  );
}
