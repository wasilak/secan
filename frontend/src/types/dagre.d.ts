// Minimal module declaration for @dagrejs/dagre to satisfy TypeScript in CI
declare module '@dagrejs/dagre' {
  // Minimal Dagre types used by our utilities
  export interface DagreNodeCoord {
    x: number;
    y: number;
    width?: number;
    height?: number;
  }

  export interface DagreGraph {
    setGraph(obj: unknown): void;
    setDefaultEdgeLabel(fn: () => unknown): void;
    setNode(id: string, obj: { width?: number; height?: number } | unknown): void;
    setEdge(source: string, target: string): void;
    node(id: string): DagreNodeCoord | undefined;
  }

  export interface Dagre {
    graphlib: {
      Graph: new (options?: unknown) => DagreGraph;
    };
    layout: (g: unknown) => void;
  }

  const dagre: Dagre;
  export default dagre;

}
