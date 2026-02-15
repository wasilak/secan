/**
 * Unit tests for formatter utilities
 */

import { describe, it, expect } from 'vitest';
import {
  formatUptime,
  formatUptimeDetailed,
  formatLoadAverage,
  getLoadColor,
  formatRate,
} from './formatters';

describe('formatUptime', () => {
  it('should format days and hours', () => {
    const fiveDaysThreeHours = 5 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000;
    expect(formatUptime(fiveDaysThreeHours)).toBe('5d 3h');
  });

  it('should format hours and minutes', () => {
    const twoHoursFortyFiveMinutes = 2 * 60 * 60 * 1000 + 45 * 60 * 1000;
    expect(formatUptime(twoHoursFortyFiveMinutes)).toBe('2h 45m');
  });

  it('should format minutes only', () => {
    const thirtyMinutes = 30 * 60 * 1000;
    expect(formatUptime(thirtyMinutes)).toBe('30m');
  });

  it('should format seconds only', () => {
    const fortyFiveSeconds = 45 * 1000;
    expect(formatUptime(fortyFiveSeconds)).toBe('45s');
  });

  it('should handle zero', () => {
    expect(formatUptime(0)).toBe('0s');
  });

  it('should handle undefined', () => {
    expect(formatUptime(NaN)).toBe('0s');
  });

  it('should handle very large numbers', () => {
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    expect(formatUptime(oneYear)).toContain('d');
  });
});

describe('formatUptimeDetailed', () => {
  it('should format days, hours, and minutes', () => {
    const fiveDaysThreeHoursTwentyFourMinutes = 
      5 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000 + 24 * 60 * 1000;
    expect(formatUptimeDetailed(fiveDaysThreeHoursTwentyFourMinutes))
      .toBe('5 days, 3 hours, 24 minutes');
  });

  it('should format hours and minutes', () => {
    const twoHoursFortyFiveMinutes = 2 * 60 * 60 * 1000 + 45 * 60 * 1000;
    expect(formatUptimeDetailed(twoHoursFortyFiveMinutes))
      .toBe('2 hours, 45 minutes');
  });

  it('should format minutes only', () => {
    const thirtyMinutes = 30 * 60 * 1000;
    expect(formatUptimeDetailed(thirtyMinutes)).toBe('30 minutes');
  });

  it('should handle singular forms', () => {
    const oneDayOneHourOneMinute = 
      1 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000 + 1 * 60 * 1000;
    expect(formatUptimeDetailed(oneDayOneHourOneMinute))
      .toBe('1 day, 1 hour, 1 minute');
  });

  it('should handle zero', () => {
    expect(formatUptimeDetailed(0)).toBe('0 minutes');
  });

  it('should handle undefined', () => {
    expect(formatUptimeDetailed(NaN)).toBe('0 minutes');
  });
});

describe('formatLoadAverage', () => {
  it('should format load with 2 decimal places', () => {
    expect(formatLoadAverage(1.234567)).toBe('1.23');
  });

  it('should format zero', () => {
    expect(formatLoadAverage(0)).toBe('0.00');
  });

  it('should format large numbers', () => {
    expect(formatLoadAverage(15.678)).toBe('15.68');
  });

  it('should handle undefined', () => {
    expect(formatLoadAverage(NaN)).toBe('N/A');
  });

  it('should handle infinity', () => {
    expect(formatLoadAverage(Infinity)).toBe('N/A');
  });
});

describe('getLoadColor', () => {
  it('should return green for low load', () => {
    expect(getLoadColor(0.5, 1)).toBe('green');
    expect(getLoadColor(0.9, 1)).toBe('green');
  });

  it('should return yellow for moderate load', () => {
    expect(getLoadColor(1.0, 1)).toBe('yellow');
    expect(getLoadColor(1.3, 1)).toBe('yellow');
  });

  it('should return red for high load', () => {
    expect(getLoadColor(1.6, 1)).toBe('red');
    expect(getLoadColor(5.0, 1)).toBe('red');
  });

  it('should normalize by CPU count', () => {
    expect(getLoadColor(4.0, 4)).toBe('yellow'); // 1.0 per CPU
    expect(getLoadColor(5.0, 4)).toBe('yellow'); // 1.25 per CPU
    expect(getLoadColor(7.0, 4)).toBe('red'); // 1.75 per CPU
  });

  it('should handle edge cases', () => {
    expect(getLoadColor(NaN, 1)).toBe('gray');
    expect(getLoadColor(1.0, 0)).toBe('gray');
    expect(getLoadColor(1.0, -1)).toBe('gray');
  });
});

describe('formatRate', () => {
  it('should format rate per second', () => {
    expect(formatRate(50, 1000)).toBe('50.00/s');
  });

  it('should format rate with k suffix for large numbers', () => {
    expect(formatRate(1500, 1000)).toBe('1.50k/s');
    expect(formatRate(5000, 1000)).toBe('5.00k/s');
  });

  it('should handle zero count', () => {
    expect(formatRate(0, 1000)).toBe('0.00/s');
  });

  it('should handle zero time', () => {
    expect(formatRate(100, 0)).toBe('0/s');
  });

  it('should calculate rate correctly for different time periods', () => {
    expect(formatRate(100, 2000)).toBe('50.00/s'); // 100 ops in 2 seconds
    expect(formatRate(100, 500)).toBe('200.00/s'); // 100 ops in 0.5 seconds
  });

  it('should handle edge cases', () => {
    expect(formatRate(NaN, 1000)).toBe('0/s');
    expect(formatRate(100, NaN)).toBe('0/s');
    expect(formatRate(Infinity, 1000)).toBe('0/s');
  });
});
