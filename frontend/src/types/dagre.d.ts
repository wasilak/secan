// Minimal module declaration for @dagrejs/dagre to satisfy TypeScript in CI
declare module '@dagrejs/dagre' {
  const dagre: any;
  export default dagre;

  // basic graphlib types used by the utility (partial)
  export namespace graphlib {
    class Graph {
      constructor(options?: any);
      setGraph(obj: any): void;
      setDefaultEdgeLabel(fn: () => any): void;
      setNode(id: string, obj: any): void;
      setEdge(source: string, target: string): void;
      node(id: string): any;
    }
  }

  export function layout(g: any): void;

}
