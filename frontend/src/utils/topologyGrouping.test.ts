import { describe, it, expect } from 'vitest';
import { calculateNodeGroups } from './topologyGrouping';
import type { NodeInfo } from '../types/api';

function makeNode(name: string, tags: string[]): NodeInfo {
  return { name, tags } as unknown as NodeInfo;
}

describe('calculateNodeGroups — label grouping by attribute', () => {
  const nodes = [
    makeNode('n1', ['az_group:eu-west-1a']),
    makeNode('n2', ['az_group:eu-west-1b']),
    makeNode('n3', ['az_group:eu-west-1c']),
    makeNode('n4', ['az_group:eu-west-1a']),
    makeNode('n5', []), // no attribute at all
  ];

  it('creates one group per attribute value, "other" only for nodes without the attribute', () => {
    // config.value is the representative tag passed by GroupingControl
    const groups = calculateNodeGroups(nodes, {
      attribute: 'label',
      value: 'az_group:eu-west-1a',
    });

    expect(Array.from(groups.keys()).sort()).toEqual([
      'eu-west-1a',
      'eu-west-1b',
      'eu-west-1c',
      'other',
    ]);
    expect(groups.get('eu-west-1a')?.map((n) => n.name)).toEqual(['n1', 'n4']);
    expect(groups.get('eu-west-1b')?.map((n) => n.name)).toEqual(['n2']);
    expect(groups.get('eu-west-1c')?.map((n) => n.name)).toEqual(['n3']);
    expect(groups.get('other')?.map((n) => n.name)).toEqual(['n5']);
  });

  it('ignores unrelated attributes when grouping', () => {
    const mixed = [
      makeNode('a', ['az_group:eu-west-1a', 'rack:r1']),
      makeNode('b', ['rack:r2']),
    ];
    const groups = calculateNodeGroups(mixed, {
      attribute: 'label',
      value: 'az_group:eu-west-1a',
    });

    expect(groups.get('eu-west-1a')?.map((n) => n.name)).toEqual(['a']);
    expect(groups.get('other')?.map((n) => n.name)).toEqual(['b']);
  });
});
