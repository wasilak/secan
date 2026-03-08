import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useCallback } from 'react';
import { ClusterSection, defaultSection } from '../routes/clusterRoutes';
import {
  buildClusterSectionUrl,
  buildNodeModalUrl,
  buildIndexModalUrl,
  buildShardModalUrl,
  extractSectionFromPath,
  extractNodeIdFromPath,
  extractIndexNameFromPath,
  extractShardIdFromPath,
} from '../utils/urlBuilders';

/**
 * Custom hook for cluster navigation
 *
 * Provides a consistent interface for navigating within cluster views, including:
 * - Section navigation (overview, statistics, nodes, etc.)
 * - Modal navigation (node details, index details, shard details)
 * - Modal closing with navigation back to section
 *
 * This hook abstracts React Router details and URL building, making it easy to
 * navigate throughout the cluster view without worrying about path construction.
 *
 * Requirements: 2.0, 2.1
 *
 * @returns Object containing navigation methods and utilities
 *
 * @example
 * const { navigateToSection, navigateToNode, closeModal } = useClusterNavigation();
 *
 * // Navigate to statistics section
 * navigateToSection('statistics');
 *
 * // Open node modal
 * navigateToNode('node-1');
 *
 * // Close modal and return to current section
 * closeModal();
 */
export function useClusterNavigation() {
  const navigate = useNavigate();
  const { id: clusterId } = useParams<{ id: string }>();
  const location = useLocation();

  // Get current section from URL path
  const currentSection = useCallback((): ClusterSection | undefined => {
    const section = extractSectionFromPath(location.pathname, location.search);
    return section;
  }, [location.pathname, location.search]);

  // Get active modal from URL path
  const activeModal = useCallback(
    (): { type: 'node' | 'index' | 'shard'; id: string } | null => {
      const nodeId = extractNodeIdFromPath(location.pathname);
      if (nodeId) {
        return { type: 'node', id: nodeId };
      }

      const indexName = extractIndexNameFromPath(location.pathname);
      if (indexName) {
        return { type: 'index', id: indexName };
      }

      const shardId = extractShardIdFromPath(location.pathname);
      if (shardId) {
        return { type: 'shard', id: shardId };
      }

      return null;
    },
    [location.pathname]
  );

  // Get current section with fallback to default
  const getSectionOrDefault = useCallback((): ClusterSection => {
    const section = currentSection();
    return section || defaultSection;
  }, [currentSection]);

  /**
   * Navigate to a cluster section
   *
   * @param section - The section to navigate to
   */
  const navigateToSection = useCallback(
    (section: ClusterSection) => {
      if (!clusterId) {
        console.warn('navigateToSection: clusterId not available');
        return;
      }

      const url = buildClusterSectionUrl(clusterId, section);
      navigate(url);
    },
    [clusterId, navigate]
  );

  /**
   * Navigate to a node modal (overlay on current section)
   *
   * @param nodeId - The ID of the node to display
   */
  const navigateToNode = useCallback(
    (nodeId: string) => {
      if (!clusterId) {
        console.warn('navigateToNode: clusterId not available');
        return;
      }

      const section = currentSection() || 'nodes';
      const url = buildNodeModalUrl(clusterId, nodeId, section);
      navigate(url);
    },
    [clusterId, navigate, currentSection]
  );

  /**
   * Navigate to an index modal (overlay on current section)
   *
   * @param indexName - The name of the index to display
   * @param indexSection - The index modal section (general/advanced/mappings)
   */
  const navigateToIndex = useCallback(
    (indexName: string, indexSection?: string) => {
      if (!clusterId) {
        console.warn('navigateToIndex: clusterId not available');
        return;
      }

      const section = currentSection() || 'indices';
      const url = buildIndexModalUrl(clusterId, indexName, indexSection, section);
      
      // Preserve existing search params EXCEPT indexTab and index params
      // (we want to use the new indexSection parameter, not old values)
      const currentParams = new URLSearchParams(location.search);
      currentParams.delete('indexTab');
      currentParams.delete('index');
      
      const preservedParams = currentParams.toString();
      const finalUrl = preservedParams ? `${url}&${preservedParams}` : url;
      
      navigate(finalUrl);
    },
    [clusterId, navigate, currentSection, location.search]
  );

  /**
   * Navigate to a shard modal (overlay on current section)
   *
   * @param shardId - The ID of the shard to display
   */
  const navigateToShard = useCallback(
    (shardId: string) => {
      if (!clusterId) {
        console.warn('navigateToShard: clusterId not available');
        return;
      }

      const section = currentSection() || 'shards';
      const url = buildShardModalUrl(clusterId, shardId, section);
      navigate(url);
    },
    [clusterId, navigate, currentSection]
  );

  /**
   * Close any open modal and navigate back to current section
   *
   * Preserves the current section context while removing any modal overlay.
   * If no section is active, defaults to 'overview'.
   * Also preserves all existing search params (filters, pagination, etc.)
   */
  const closeModal = useCallback(() => {
    if (!clusterId) {
      console.warn('closeModal: clusterId not available');
      return;
    }

    const section = getSectionOrDefault();
    const url = buildClusterSectionUrl(clusterId, section);
    // Preserve existing search params when closing modal
    navigate(url + location.search);
  }, [clusterId, getSectionOrDefault, navigate, location.search]);

  /**
   * Get current section safely, with default fallback
   */
  const getCurrentSection = useCallback((): ClusterSection => {
    return getSectionOrDefault();
  }, [getSectionOrDefault]);

  /**
   * Check if a modal is currently open
   */
  const isModalOpen = useCallback((): boolean => {
    return activeModal() !== null;
  }, [activeModal]);

  return {
    // Navigation methods
    navigateToSection,
    navigateToNode,
    navigateToIndex,
    navigateToShard,
    closeModal,

    // State queries
    currentSection,
    activeModal,
    getCurrentSection,
    isModalOpen,
    clusterId,
  };
}

export type UseClusterNavigationReturn = ReturnType<typeof useClusterNavigation>;
