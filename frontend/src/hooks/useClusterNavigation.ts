import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';
import { ClusterSection, defaultSection } from '../routes/clusterRoutes';
import {
  buildClusterSectionUrl,
  extractSectionFromPath,
} from '../utils/urlBuilders';

/**
 * Custom hook for cluster navigation
 *
 * Provides a consistent interface for navigating within cluster views, including:
 * - Section navigation (overview, statistics, nodes, etc.)
 * - Modal navigation (node details, index details, shard details)
 * - Modal closing with navigation back to section
 *
 * Modals are driven by search params (?nodeModal=id, ?indexModal=name, ?indexTab=tab)
 * rather than path changes so ClusterView never remounts when opening/closing modals.
 * Deep-linking works because the params are part of the URL.
 *
 * Requirements: 2.0, 2.1
 */
export function useClusterNavigation() {
  const navigate = useNavigate();
  const { id: clusterId } = useParams<{ id: string }>();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get current section from URL path
  const currentSection = useCallback((): ClusterSection | undefined => {
    const section = extractSectionFromPath(location.pathname, location.search);
    return section;
  }, [location.pathname, location.search]);

  // Get active modal from search params
  const activeModal = useCallback(
    (): { type: 'node' | 'index' | 'shard'; id: string } | null => {
      const nodeId = searchParams.get('nodeModal');
      if (nodeId) return { type: 'node', id: nodeId };

      const indexName = searchParams.get('indexModal');
      if (indexName) return { type: 'index', id: indexName };

      const shardId = searchParams.get('shardModal');
      if (shardId) return { type: 'shard', id: shardId };

      return null;
    },
    [searchParams]
  );

  // Get current section with fallback to default
  const getSectionOrDefault = useCallback((): ClusterSection => {
    const section = currentSection();
    return section || defaultSection;
  }, [currentSection]);

  /**
   * Navigate to a cluster section
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
   * Open node modal via search param — no path change, no remount.
   */
  const navigateToNode = useCallback(
    (nodeId: string) => {
      const params = new URLSearchParams(searchParams);
      params.set('nodeModal', nodeId);
      // Close other modals if open
      params.delete('indexModal');
      params.delete('indexTab');
      params.delete('shardModal');
      setSearchParams(params, { replace: false });
    },
    [searchParams, setSearchParams]
  );

  /**
   * Open index modal via search param — no path change, no remount.
   */
  const navigateToIndex = useCallback(
    (indexName: string, indexSection?: string) => {
      const params = new URLSearchParams(searchParams);
      params.set('indexModal', indexName);
      if (indexSection) {
        params.set('indexTab', indexSection);
      } else {
        params.delete('indexTab');
      }
      // Close other modals if open
      params.delete('nodeModal');
      params.delete('shardModal');
      setSearchParams(params, { replace: false });
    },
    [searchParams, setSearchParams]
  );

  /**
   * Open shard modal via search param — no path change, no remount.
   */
  const navigateToShard = useCallback(
    (shardId: string) => {
      const params = new URLSearchParams(searchParams);
      params.set('shardModal', shardId);
      setSearchParams(params, { replace: false });
    },
    [searchParams, setSearchParams]
  );

  /**
   * Close any open modal by removing modal search params.
   * Uses browser back if we navigated forward to open the modal,
   * otherwise just strips the params.
   */
  const closeModal = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete('nodeModal');
    params.delete('indexModal');
    params.delete('indexTab');
    params.delete('shardModal');
    setSearchParams(params, { replace: false });
  }, [searchParams, setSearchParams]);

  const getCurrentSection = useCallback((): ClusterSection => {
    return getSectionOrDefault();
  }, [getSectionOrDefault]);

  const isModalOpen = useCallback((): boolean => {
    return activeModal() !== null;
  }, [activeModal]);

  return {
    navigateToSection,
    navigateToNode,
    navigateToIndex,
    navigateToShard,
    closeModal,
    currentSection,
    activeModal,
    getCurrentSection,
    isModalOpen,
    clusterId,
  };
}

export type UseClusterNavigationReturn = ReturnType<typeof useClusterNavigation>;
