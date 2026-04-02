/**
 * Formatter utilities for node data display
 *
 * Provides functions for formatting uptime, load average, and rates
 */

/**
 * Format uptime in milliseconds to detailed human-readable format
 *
 * Examples:
 * - 5 days, 3 hours, 24 minutes -> "5 days, 3 hours, 24 minutes"
 * - 2 hours, 45 minutes -> "2 hours, 45 minutes"
 * - 30 minutes -> "30 minutes"
 *
 * @param milliseconds - Uptime in milliseconds
 * @returns Detailed human-readable uptime string
 */
export function formatUptimeDetailed(milliseconds: number): string {
  if (milliseconds === 0 || !Number.isFinite(milliseconds)) {
    return '0 minutes';
  }

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} day${days > 1 ? 's' : ''}`);
  }
  if (hours % 24 > 0) {
    parts.push(`${hours % 24} hour${hours % 24 > 1 ? 's' : ''}`);
  }
  if (minutes % 60 > 0) {
    parts.push(`${minutes % 60} minute${minutes % 60 > 1 ? 's' : ''}`);
  }

  return parts.length > 0 ? parts.join(', ') : '0 minutes';
}

/**
 * Format load average to string with 2 decimal places
 *
 * @param load - Load average value
 * @returns Formatted load average string
 */
export function formatLoadAverage(load: number): string {
  if (!Number.isFinite(load)) {
    return 'N/A';
  }
  return load.toFixed(2);
}

/**
 * Get color for load average based on absolute thresholds
 *
 * Color coding:
 * - Green: load < 4 (healthy)
 * - Yellow: load < 6 (moderate)
 * - Red: load >= 6 (high)
 * - Dimmed: undefined (no data)
 *
 * @param load - Load average value (5-minute), or undefined if unavailable
 * @returns Color string for Mantine theme
 */
export function getLoadColor(load: number | undefined): string {
  if (load === undefined || !Number.isFinite(load)) {
    return 'dimmed';
  }

  if (load < 4) {
    return 'green';
  } else if (load < 6) {
    return 'yellow';
  } else {
    return 'red';
  }
}

/**
 * Format rate from count and time in milliseconds
 *
 * Calculates operations per second and formats with appropriate suffix
 *
 * Examples:
 * - 1500 operations in 1000ms -> "1.5k/s"
 * - 50 operations in 1000ms -> "50.00/s"
 * - 0 operations -> "0/s"
 *
 * @param count - Number of operations
 * @param timeMs - Time period in milliseconds
 * @returns Formatted rate string
 */
export function formatRate(count: number, timeMs: number): string {
  if (timeMs === 0 || !Number.isFinite(count) || !Number.isFinite(timeMs)) {
    return '0/s';
  }

  const perSecond = (count / timeMs) * 1000;

  if (perSecond > 1000) {
    return `${(perSecond / 1000).toFixed(2)}k/s`;
  }

  return `${perSecond.toFixed(2)}/s`;
}

/**
 * Format bytes to human-readable size
 *
 * Examples:
 * - 1024 -> "1.00 KB"
 * - 1048576 -> "1.00 MB"
 * - 1073741824 -> "1.00 GB"
 *
 * @param bytes - Size in bytes
 * @returns Formatted size string
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const k = 1024;
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  const unitIndex = Math.min(i, units.length - 1);

  return `${(bytes / Math.pow(k, unitIndex)).toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format bytes to human-readable size (with undefined handling)
 *
 * Examples:
 * - 1024 -> "1.00 KB"
 * - undefined -> "N/A"
 *
 * @param bytes - Size in bytes (can be undefined)
 * @returns Formatted size string or "N/A"
 */
export function formatBytesOptional(bytes: number | undefined): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return 'N/A';
  return formatBytes(bytes);
}

/**
 * Format percentage value
 *
 * Examples:
 * - 75.6 -> "76"
 * - undefined -> "N/A"
 *
 * @param value - Percentage value
 * @returns Formatted percentage string (without % symbol)
 */
export function formatPercent(value: number | undefined): string {
  if (value === undefined || value === null || isNaN(value)) return 'N/A';
  return `${Math.round(value)}`;
}

/**
 * Format percentage from used/total ratio
 *
 * Examples:
 * - (50, 100) -> 50
 * - (0, 0) -> 0
 *
 * @param used - Used amount
 * @param total - Total amount
 * @returns Percentage as number
 */
export function formatPercentRatio(used: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((used / total) * 100);
}

/**
 * Format number with optional decimals
 *
 * Examples:
 * - (123.456, 2) -> "123.46"
 * - (undefined, 0) -> "N/A"
 *
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted number string or "N/A"
 */
export function formatNumber(value: number | undefined, decimals: number = 0): string {
  if (value === undefined || value === null || isNaN(value)) return 'N/A';
  return value.toFixed(decimals);
}

/**
 * Format number with thousands separator
 *
 * Examples:
 * - 1000 -> "1,000"
 * - 1234567 -> "1,234,567"
 * - undefined -> "N/A"
 *
 * @param num - Number to format (can be undefined)
 * @returns Formatted number with commas or "N/A"
 */
export function formatNumberWithCommas(num: number | undefined): string {
  if (num === undefined || num === null || isNaN(num)) return 'N/A';
  return num.toLocaleString();
}

/**
 * Format milliseconds to human-readable time
 *
 * Examples:
 * - 500 -> "500ms"
 * - 5000 -> "5.00s"
 * - 300000 -> "5.00m"
 * - 7200000 -> "2.00h"
 *
 * @param ms - Time in milliseconds
 * @returns Formatted time string
 */
export function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(2)}m`;
  return `${(ms / 3600000).toFixed(2)}h`;
}

/**
 * Format timestamp to locale string
 *
 * Examples:
 * - 1609459200000 -> "1/1/2021, 12:00:00 AM" (locale-dependent)
 *
 * @param millis - Timestamp in milliseconds
 * @returns Formatted date and time string
 */
export function formatTimestamp(millis: number): string {
  return new Date(millis).toLocaleString();
}

/**
 * Format timestamp for charts (time only)
 *
 * Examples:
 * - 1609459200000 -> "12:00 AM"
 *
 * @param timestamp - Timestamp in milliseconds
 * @returns Formatted time string (HH:MM)
 */
export function formatChartTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
