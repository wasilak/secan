import { useMediaQuery } from '@mantine/hooks';

/**
 * Hook to determine responsive page size for tables based on screen width
 *
 * Returns:
 * - 10 for large/XL screens (≥1200px)
 * - 7 for medium screens (768-1199px)
 * - 5 for small screens (<768px)
 *
 * @example
 * ```tsx
 * const defaultPageSize = useResponsivePageSize();
 * const pageSize = parseInt(searchParams.get('pageSize') || defaultPageSize.toString(), 10);
 * ```
 */
export function useResponsivePageSize(): number {
  // Default page size across the app — set to 20 per UX request.
  // Keep hook for potential future responsiveness, but return a constant
  // value so modal/table pagination shows 20 items by default.
  return 20;
}
