// Minimal module declaration for @dagrejs/dagre to satisfy TypeScript in CI
declare module '@dagrejs/dagre' {
  const dagre: unknown;
  export default dagre;

  // basic graphlib types used by the utility (partial)
  export namespace graphlib {
    class Graph {
      constructor(options?: unknown);
      setGraph(obj: unknown): void;
      setDefaultEdgeLabel(fn: () => unknown): void;
      setNode(id: string, obj: unknown): void;
      setEdge(source: string, target: string): void;
      node(id: string): unknown;
    }
  }

  export function layout(g: unknown): void;

}
