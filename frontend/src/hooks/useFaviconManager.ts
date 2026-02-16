import { useEffect } from 'react';

/**
 * Custom hook to manage favicon based on cluster health status
 * 
 * @param clusterHealth - The cluster health status ('green', 'yellow', 'red', or null)
 * 
 * When clusterHealth is null, displays neutral favicon (for clusters list or unknown state)
 * When clusterHealth is 'green', displays green favicon
 * When clusterHealth is 'yellow', displays yellow favicon
 * When clusterHealth is 'red', displays red favicon
 */
export function useFaviconManager(clusterHealth: 'green' | 'yellow' | 'red' | null): void {
  useEffect(() => {
    const faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    
    if (!faviconLink) {
      console.warn('Favicon link element not found');
      return;
    }
    
    // Determine which favicon to use based on cluster health
    let faviconPath: string;
    
    if (clusterHealth === null) {
      faviconPath = '/favicon-neutral.svg';
    } else if (clusterHealth === 'green') {
      faviconPath = '/favicon-green.svg';
    } else if (clusterHealth === 'yellow') {
      faviconPath = '/favicon-yellow.svg';
    } else if (clusterHealth === 'red') {
      faviconPath = '/favicon-red.svg';
    } else {
      // Fallback to neutral for any unexpected value
      faviconPath = '/favicon-neutral.svg';
    }
    
    // Update favicon href
    faviconLink.href = faviconPath;
  }, [clusterHealth]);
}
