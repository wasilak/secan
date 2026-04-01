import { determineAllowedLod } from '../TopologyController';

describe('determineAllowedLod', () => {
  it('passes L2 through unchanged regardless of viewport size', () => {
    // Previously had a capacity guard; now removed — backend controls LOD data
    const zoom = 1.0;
    const viewportWidth = 2000;
    const viewportHeight = 1200;
    const res = determineAllowedLod(zoom, viewportWidth, viewportHeight, 'L2');
    expect(res).toBe('L2');
  });

  it('allows L2 at high zoom', () => {
    const zoom = 2.0;
    const viewportWidth = 300;
    const viewportHeight = 200;
    const res = determineAllowedLod(zoom, viewportWidth, viewportHeight, 'L2');
    expect(res).toBe('L2');
  });

  it('preserves L1 and L0', () => {
    expect(determineAllowedLod(1.0, 800, 600, 'L1')).toBe('L1');
    expect(determineAllowedLod(1.0, 800, 600, 'L0')).toBe('L0');
  });
});
