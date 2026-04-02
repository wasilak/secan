/**
 * Application version fetched from backend API
 * Falls back to 'v1.2.4' if API is unavailable
 */
let cachedVersion: string | null = null;

export async function getAppVersion(): Promise<string> {
  if (cachedVersion) {
    return cachedVersion;
  }

  try {
    const response = await fetch('/api/version');
    if (response.ok) {
      const data = await response.json();
      cachedVersion = `v${data.version}`;
      return cachedVersion;
    }
  } catch (error) {
    console.warn('Failed to fetch version from API:', error);
  }

  return 'v1.2.4'; // Fallback
}

// For backwards compatibility, export a synchronous constant (will be overridden after first async call)
export const APP_VERSION = 'v1.2.4';
