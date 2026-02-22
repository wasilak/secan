/**
 * Formatter utilities for node data display
 *
 * Provides functions for formatting uptime, load average, and rates
 */

/**
 * Format uptime in milliseconds to human-readable short format
 *
 * Examples:
 * - 5 days, 3 hours -> "5d 3h"
 * - 2 hours, 45 minutes -> "2h 45m"
 * - 30 minutes -> "30m"
 * - 45 seconds -> "45s"
 *
 * @param milliseconds - Uptime in milliseconds
 * @returns Human-readable uptime string
 */
export function formatUptime(milliseconds: number): string {
  if (milliseconds === 0 || !Number.isFinite(milliseconds)) {
    return '0s';
  }

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

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
 * Get color for load average based on CPU count
 *
 * Color coding:
 * - Green: < 1.0 per CPU (healthy)
 * - Yellow: 1.0 - 1.5 per CPU (moderate load)
 * - Red: > 1.5 per CPU (high load)
 *
 * @param load - Load average value
 * @param cpuCount - Number of CPUs (defaults to 1)
 * @returns Color string for Mantine theme
 */
export function getLoadColor(load: number, cpuCount: number = 1): string {
  if (!Number.isFinite(load) || cpuCount <= 0) {
    return 'gray';
  }

  const normalized = load / cpuCount;

  if (normalized > 1.5) {
    return 'red';
  } else if (normalized >= 1.0) {
    return 'yellow';
  } else {
    return 'green';
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
