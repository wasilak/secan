import { determineAllowedLod } from '../TopologyController';

describe('determineAllowedLod', () => {
  it('downgrades L2 to L1 when viewport can show more than one node (conservative)', () => {
    // Use a zoom that would normally produce L2
    const zoom = 1.0;
    // Large viewport so capacity > 1
    const viewportWidth = 2000;
    const viewportHeight = 1200;
    const res = determineAllowedLod(zoom, viewportWidth, viewportHeight, 'L2');
    expect(res).toBe('L1');
  });

  it('allows L2 when viewport fits only one node partially', () => {
    const zoom = 2.0; // zoomed in
    const viewportWidth = 300; // small viewport in world coords at zoom
    const viewportHeight = 200; // short height so only one row fits
    const res = determineAllowedLod(zoom, viewportWidth, viewportHeight, 'L2');
    // For tiny viewport at high zoom we expect L2 allowed
    expect(res).toBe('L2');
  });

  it('preserves L1 and L0', () => {
    expect(determineAllowedLod(1.0, 800, 600, 'L1')).toBe('L1');
    expect(determineAllowedLod(1.0, 800, 600, 'L0')).toBe('L0');
  });
});
