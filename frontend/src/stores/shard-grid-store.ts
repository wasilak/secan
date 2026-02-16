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
  
  // UI State
  selectedShard: ShardInfo | null;
  relocationMode: boolean;
  destinationIndicators: Map<string, ShardInfo>; // nodeId -> destination indicator shard
  
  // Loading State
  loading: boolean;
  error: Error | null;
  
  // Actions
  setNodes: (nodes: NodeWithShards[]) => void;
  setIndices: (indices: IndexMetadata[]) => void;
  setUnassignedShards: (shards: ShardInfo[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  
  selectShard: (shard: ShardInfo | null) => void;
  enterRelocationMode: (shard: ShardInfo) => void;
  exitRelocationMode: () => void;
  calculateDestinations: (shard: ShardInfo, nodes: NodeWithShards[]) => void;
  
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
  selectedShard: null,
  relocationMode: false,
  destinationIndicators: new Map<string, ShardInfo>(),
  loading: false,
  error: null,
};

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
  
  // Shard selection
  selectShard: (shard) => set({ selectedShard: shard }),
  
  // Enter relocation mode
  // Requirements: 5.1, 5.2, 5.3
  enterRelocationMode: (shard) => {
    const { nodes } = get();
    const destinations = calculateValidDestinations(shard, nodes);
    
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
  
  // Reset all state
  reset: () => set(initialState),
}));
