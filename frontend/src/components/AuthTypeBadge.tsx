import { Badge, Group } from '@mantine/core';
import {
  IconUserKey,
  IconShieldCheck,
  IconHierarchy,
  IconUserOff,
} from '@tabler/icons-react';

/**
 * Visual identity map for authentication types.
 * Follows the same pattern as RoleIcons.tsx.
 */
const AUTH_TYPE_MAP: Record<
  string,
  { icon: React.ComponentType<{ size?: number }>; color: string; label: string }
> = {
  local: { icon: IconUserKey, color: 'blue', label: 'Local' },
  oidc: { icon: IconShieldCheck, color: 'violet', label: 'OIDC' },
  ldap: { icon: IconHierarchy, color: 'orange', label: 'LDAP' },
  open: { icon: IconUserOff, color: 'gray', label: 'Anonymous' },
};

const FALLBACK = { icon: IconUserKey, color: 'gray', label: 'Unknown' };

interface AuthTypeBadgeProps {
  authType: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

/**
 * AuthTypeBadge displays the authentication method with a distinctive icon and colour.
 *
 * Supported values: "local", "oidc", "ldap", "open".
 * Unknown values fall back to a neutral gray badge.
 */
export function AuthTypeBadge({ authType, size = 'sm' }: AuthTypeBadgeProps) {
  const def = AUTH_TYPE_MAP[authType] ?? FALLBACK;
  const Icon = def.icon;
  const iconSize = size === 'xs' ? 10 : size === 'sm' ? 12 : size === 'md' ? 14 : 16;

  return (
    <Badge
      size={size}
      variant="light"
      color={def.color}
      leftSection={
        <Group gap={0} align="center">
          <Icon size={iconSize} />
        </Group>
      }
      style={{ textTransform: 'none' }}
    >
      {def.label}
    </Badge>
  );
}

/**
 * Returns the raw color name for the given auth type (for use outside Badge, e.g. Avatar ring).
 */
export function getAuthTypeColor(authType: string): string {
  return AUTH_TYPE_MAP[authType]?.color ?? 'gray';
}
