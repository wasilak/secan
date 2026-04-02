/**
 * Centralized notification utilities for consistent styling and positioning
 * All notifications in the application should use these functions
 */

import { notifications } from '@mantine/notifications';
import { ReactNode } from 'react';

interface NotificationOptions {
  title: string;
  message: string;
  icon?: ReactNode;
  autoClose?: number | false;
}

/**
 * Show a success notification (green)
 */
export function showSuccessNotification(options: NotificationOptions) {
  notifications.show({
    title: options.title,
    message: options.message,
    color: 'green',
    icon: options.icon,
    autoClose: options.autoClose ?? 5000,
  });
}

/**
 * Show an error notification (red)
 */
export function showErrorNotification(options: NotificationOptions) {
  notifications.show({
    title: options.title,
    message: options.message,
    color: 'red',
    icon: options.icon,
    autoClose: options.autoClose ?? 5000,
  });
}

/**
 * Show an info notification (blue)
 */
export function showInfoNotification(options: NotificationOptions) {
  notifications.show({
    title: options.title,
    message: options.message,
    color: 'blue',
    icon: options.icon,
    autoClose: options.autoClose ?? 5000,
  });
}

/**
 * Show a warning notification (orange)
 */
export function showWarningNotification(options: NotificationOptions) {
  notifications.show({
    title: options.title,
    message: options.message,
    color: 'orange',
    icon: options.icon,
    autoClose: options.autoClose ?? 5000,
  });
}

/**
 * Show a special notification (violet/purple)
 * Used for special cases like "Cannot Relocate"
 */
export function showSpecialNotification(options: NotificationOptions) {
  notifications.show({
    title: options.title,
    message: options.message,
    color: 'violet',
    icon: options.icon,
    autoClose: options.autoClose ?? 5000,
  });
}
