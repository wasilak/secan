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

/**
 * RoleOption component for rendering role options in MultiSelect
 */
export function RoleOption({ role }: { role: string }) {
  const roleInfo = getRoleIcon(role);
  const Icon = roleInfo.icon;
  
  return (
    <Group gap="xs">
      <Icon size={16} color={`var(--mantine-color-${roleInfo.color}-6)`} />
      <Text size="sm">{roleInfo.label}</Text>
    </Group>
  );
}

/**
 * RoleFilterToggle component - clickable roles that toggle on/off
 * Active (selected) roles show in color, inactive roles in grayscale
 */
export function RoleFilterToggle({ 
  roles, 
  selectedRoles, 
  onToggle 
}: { 
  roles: string[]; 
  selectedRoles: string[];
  onToggle: (role: string) => void;
}) {
  return (
    <Group gap="xs" wrap="wrap">
      {roles.map((role) => {
        const roleInfo = getRoleIcon(role);
        const Icon = roleInfo.icon;
        const isSelected = selectedRoles.includes(role);
        
        return (
          <Group 
            key={role} 
            gap={6}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 150ms ease',
              backgroundColor: isSelected ? `var(--mantine-color-${roleInfo.color}-0)` : 'var(--mantine-color-gray-1)',
              border: `1px solid ${isSelected ? `var(--mantine-color-${roleInfo.color}-3)` : 'var(--mantine-color-gray-2)'}`,
              opacity: isSelected ? 1 : 0.6,
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
              color={isSelected ? `var(--mantine-color-${roleInfo.color}-6)` : 'var(--mantine-color-gray-6)'} 
              style={{ transition: 'color 150ms ease' }}
            />
            <Text 
              size="xs" 
              fw={isSelected ? 500 : 400}
              style={{ transition: 'font-weight 150ms ease' }}
            >
              {roleInfo.label}
            </Text>
          </Group>
        );
      })}
    </Group>
  );
}
