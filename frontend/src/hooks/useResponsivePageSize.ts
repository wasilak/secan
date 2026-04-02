import { useMediaQuery } from '@mantine/hooks';

/**
 * Hook to determine responsive page size for tables based on screen width
 *
 * Returns:
 * - 10 for large/XL screens (≥1200px)
 * - 7 for medium screens (768-1199px)
 * - 10 for small screens (<768px) — prefer slightly larger pages by default
 *
 * @example
 * ```tsx
 * const defaultPageSize = useResponsivePageSize();
 * const pageSize = parseInt(searchParams.get('pageSize') || defaultPageSize.toString(), 10);
 * ```
 */
export function useResponsivePageSize(): number {
  const isLarge = useMediaQuery('(min-width: 1200px)');
  const isMedium = useMediaQuery('(min-width: 768px)');

  if (isLarge) return 10;
  if (isMedium) return 7;
  return 10;
}
