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
 * Using official Elasticsearch role names: https://www.elastic.co/docs/deploy-manage/distributed-architecture/clusters-nodes-shards/node-roles
 */
const ROLE_ICONS: Record<string, { icon: typeof IconDatabase; color: string; label: string }> = {
  master: { icon: IconCrown, color: 'yellow', label: 'master' },
  data: { icon: IconDatabase, color: 'blue', label: 'data' },
  ingest: { icon: IconTransform, color: 'grape', label: 'ingest' },
  ml: { icon: IconBolt, color: 'orange', label: 'ml' },
  coordinating: { icon: IconServer, color: 'gray', label: 'coordinating' },
  remote_cluster_client: { icon: IconCloud, color: 'cyan', label: 'remote_cluster_client' },
  transform: { icon: IconTransform, color: 'teal', label: 'transform' },
  data_content: { icon: IconFileText, color: 'indigo', label: 'data_content' },
  data_hot: { icon: IconDatabase, color: 'red', label: 'data_hot' },
  data_warm: { icon: IconDatabase, color: 'orange', label: 'data_warm' },
  data_cold: { icon: IconDatabase, color: 'blue', label: 'data_cold' },
  data_frozen: { icon: IconDatabase, color: 'cyan', label: 'data_frozen' },
  voting_only: { icon: IconCrown, color: 'gray', label: 'voting_only' },
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
 * RoleFilterToggle component - clickable roles that toggle on/off
 * Displays as a legend-style filter with icons and text labels
 */
export function RoleFilterToggle({
  roles,
  selectedRoles,
  onToggle,
}: {
  roles: string[];
  selectedRoles: string[];
  onToggle: (role: string) => void;
}) {
  return (
    <Group gap="md" wrap="wrap">
      {roles.map((role) => {
        const roleInfo = getRoleIcon(role);
        const Icon = roleInfo.icon;
        const isSelected = selectedRoles.includes(role);

        return (
          <Group
            key={role}
            gap={6}
            style={{
              cursor: 'pointer',
              opacity: isSelected ? 1 : 0.5,
              transition: 'opacity 150ms ease',
            }}
            onClick={() => onToggle(role)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggle(role);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <Icon
              size={16}
              color={`var(--mantine-color-${roleInfo.color}-6)`}
              style={{ transition: 'opacity 150ms ease' }}
            />
            <Text size="xs" style={{ transition: 'opacity 150ms ease' }}>
              {roleInfo.label}
            </Text>
          </Group>
        );
      })}
    </Group>
  );
}

/**
 * Centralized role colors for use in charts and other components
 */
export const ROLE_COLORS: Record<string, string> = {
  master: 'var(--mantine-color-yellow-6)',
  data: 'var(--mantine-color-blue-6)',
  ingest: 'var(--mantine-color-grape-6)',
  ml: 'var(--mantine-color-orange-6)',
  coordinating: 'var(--mantine-color-gray-6)',
  remote_cluster_client: 'var(--mantine-color-cyan-6)',
  transform: 'var(--mantine-color-teal-6)',
  data_content: 'var(--mantine-color-indigo-6)',
  data_hot: 'var(--mantine-color-red-6)',
  data_warm: 'var(--mantine-color-orange-6)',
  data_cold: 'var(--mantine-color-blue-6)',
  data_frozen: 'var(--mantine-color-cyan-6)',
  voting_only: 'var(--mantine-color-gray-6)',
};
