import { create } from 'zustand';
import type { ShardInfo, NodeWithShards, IndexMetadata } from '../types/api';

/**
 * Shard grid state interface
 * Manages state for shard grid visualization and relocation mode
 */
interface ShardGridState {
  // Data
  nodes: NodeWithShards[];
  indices: IndexMetadata[];
  unassignedShards: ShardInfo[];
  
  // Cache state - Requirements: 9.7
  cachedData: {
    nodes: NodeWithShards[];
    indices: IndexMetadata[];
    unassignedShards: ShardInfo[];
  } | null;
  cacheTimestamp: number | null;
  cacheTTL: number; // Time-to-live in milliseconds
  
  // UI State
  selectedShard: ShardInfo | null;
  relocationMode: boolean;
  destinationIndicators: Map<string, ShardInfo>; // nodeId -> destination indicator shard
  
  // Loading State
  loading: boolean;
  error: Error | null;
  
  // Polling State - Requirements: 7.2, 7.3
  isPolling: boolean;
  pollingIntervalId: number | null;
  pollingStartTime: number | null;
  relocatingShards: Set<string>; // Set of "index:shard:primary" keys for tracking
  
  // Actions
  setNodes: (nodes: NodeWithShards[]) => void;
  setIndices: (indices: IndexMetadata[]) => void;
  setUnassignedShards: (shards: ShardInfo[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  
  // Cache actions - Requirements: 9.7
  setCacheData: (nodes: NodeWithShards[], indices: IndexMetadata[], unassignedShards: ShardInfo[]) => void;
  getCachedData: () => { nodes: NodeWithShards[]; indices: IndexMetadata[]; unassignedShards: ShardInfo[] } | null;
  isCacheValid: () => boolean;
  invalidateCache: () => void;
  setCacheTTL: (ttl: number) => void;
  
  selectShard: (shard: ShardInfo | null) => void;
  enterRelocationMode: (shard: ShardInfo) => void;
  exitRelocationMode: () => void;
  calculateDestinations: (shard: ShardInfo, nodes: NodeWithShards[]) => void;
  
  // Polling actions - Requirements: 7.2, 7.3
  startPolling: (intervalId: number) => void;
  stopPolling: () => void;
  addRelocatingShard: (shard: ShardInfo) => void;
  removeRelocatingShard: (shard: ShardInfo) => void;
  isShardRelocating: (shard: ShardInfo) => boolean;
  
  // Reset state
  reset: () => void;
}

/**
 * Initial state for shard grid
 */
const initialState = {
  nodes: [],
  indices: [],
  unassignedShards: [],
  cachedData: null,
  cacheTimestamp: null,
  cacheTTL: 30000, // Default 30 seconds cache TTL - Requirements: 9.7
  selectedShard: null,
  relocationMode: false,
  destinationIndicators: new Map<string, ShardInfo>(),
  loading: false,
  error: null,
  isPolling: false,
  pollingIntervalId: null,
  pollingStartTime: null,
  relocatingShards: new Set<string>(),
};

/**
 * Generate a unique key for a shard
 * Used for tracking relocating shards
 */
function getShardKey(shard: ShardInfo): string {
  return `${shard.index}:${shard.shard}:${shard.primary}`;
}

/**
 * Calculate valid destination nodes for shard relocation
 * 
 * A valid destination node must:
 * - Not be the source node
 * - Not already host the same shard (same index and shard number)
 * - Be a data node (have 'data' role)
 * 
 * Requirements: 5.3, 5.4, 5.6
 */
function calculateValidDestinations(
  shard: ShardInfo,
  nodes: NodeWithShards[]
): Map<string, ShardInfo> {
  const destinations = new Map<string, ShardInfo>();
  
  for (const node of nodes) {
    // Skip source node
    if (node.id === shard.node || node.name === shard.node) {
      continue;
    }
    
    // Skip if node already has this shard (same index and shard number)
    const nodeShards = node.shards.get(shard.index) || [];
    const hasThisShard = nodeShards.some(s => s.shard === shard.shard);
    if (hasThisShard) {
      continue;
    }
    
    // Skip non-data nodes
    if (!node.roles.includes('data')) {
      continue;
    }
    
    // Create destination indicator
    // This is a virtual shard showing where the shard would be relocated
    destinations.set(node.id, {
      ...shard,
      node: node.id,
      state: 'STARTED', // Show as if it would be in STARTED state
    });
  }
  
  return destinations;
}

/**
 * Zustand store for shard grid state management
 * 
 * This store manages:
 * - Shard grid data (nodes, indices, unassigned shards)
 * - Selection state for shard operations
 * - Relocation mode and destination indicators
 * - Loading and error states
 * 
 * Requirements: 3.1
 */
export const useShardGridStore = create<ShardGridState>((set, get) => ({
  ...initialState,
  
  // Data setters
  setNodes: (nodes) => set({ nodes }),
  setIndices: (indices) => set({ indices }),
  setUnassignedShards: (shards) => set({ unassignedShards: shards }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  
  // Cache actions - Requirements: 9.7
  setCacheData: (nodes, indices, unassignedShards) => {
    set({
      cachedData: { nodes, indices, unassignedShards },
      cacheTimestamp: Date.now(),
    });
  },
  
  getCachedData: () => {
    const { cachedData, cacheTimestamp, cacheTTL } = get();
    
    // Check if cache is valid
    if (!cachedData || !cacheTimestamp) {
      return null;
    }
    
    const now = Date.now();
    const cacheAge = now - cacheTimestamp;
    
    // Return cached data if still valid
    if (cacheAge < cacheTTL) {
      return cachedData;
    }
    
    // Cache expired
    return null;
  },
  
  isCacheValid: () => {
    const { cacheTimestamp, cacheTTL } = get();
    
    if (!cacheTimestamp) {
      return false;
    }
    
    const now = Date.now();
    const cacheAge = now - cacheTimestamp;
    
    return cacheAge < cacheTTL;
  },
  
  invalidateCache: () => {
    set({
      cachedData: null,
      cacheTimestamp: null,
    });
  },
  
  setCacheTTL: (ttl) => {
    set({ cacheTTL: ttl });
  },
  
  // Shard selection
  selectShard: (shard) => set({ selectedShard: shard }),
  
  // Enter relocation mode
  // Requirements: 5.1, 5.2, 5.3
  enterRelocationMode: (shard) => {
    const { nodes } = get();
    console.log('[enterRelocationMode] Shard:', shard);
    console.log('[enterRelocationMode] Nodes:', nodes);
    const destinations = calculateValidDestinations(shard, nodes);
    console.log('[enterRelocationMode] Destinations:', destinations);
    
    set({
      selectedShard: shard,
      relocationMode: true,
      destinationIndicators: destinations,
    });
  },
  
  // Exit relocation mode
  // Requirements: 5.13
  exitRelocationMode: () => {
    set({
      selectedShard: null,
      relocationMode: false,
      destinationIndicators: new Map(),
    });
  },
  
  // Calculate destination indicators
  // Requirements: 5.3, 5.4, 5.6
  calculateDestinations: (shard, nodes) => {
    const destinations = calculateValidDestinations(shard, nodes);
    set({ destinationIndicators: destinations });
  },
  
  // Polling actions - Requirements: 7.2, 7.3
  startPolling: (intervalId) => {
    set({
      isPolling: true,
      pollingIntervalId: intervalId,
      pollingStartTime: Date.now(),
    });
  },
  
  stopPolling: () => {
    const { pollingIntervalId } = get();
    if (pollingIntervalId !== null) {
      clearInterval(pollingIntervalId);
    }
    set({
      isPolling: false,
      pollingIntervalId: null,
      pollingStartTime: null,
    });
  },
  
  addRelocatingShard: (shard) => {
    const { relocatingShards } = get();
    const key = getShardKey(shard);
    const newSet = new Set(relocatingShards);
    newSet.add(key);
    set({ relocatingShards: newSet });
  },
  
  removeRelocatingShard: (shard) => {
    const { relocatingShards } = get();
    const key = getShardKey(shard);
    const newSet = new Set(relocatingShards);
    newSet.delete(key);
    set({ relocatingShards: newSet });
  },
  
  isShardRelocating: (shard) => {
    const { relocatingShards } = get();
    const key = getShardKey(shard);
    return relocatingShards.has(key);
  },
  
  // Reset all state
  reset: () => set(initialState),
}));
