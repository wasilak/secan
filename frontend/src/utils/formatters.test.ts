/**
 * Unit tests for formatter utilities
 */

import { describe, it, expect } from 'vitest';
import {
  formatUptimeDetailed,
  formatLoadAverage,
  getLoadColor,
  formatRate,
} from './formatters';

describe('formatUptimeDetailed', () => {
  it('should format days, hours, and minutes', () => {
    const fiveDaysThreeHoursTwentyFourMinutes =
      5 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000 + 24 * 60 * 1000;
    expect(formatUptimeDetailed(fiveDaysThreeHoursTwentyFourMinutes)).toBe(
      '5 days, 3 hours, 24 minutes'
    );
  });

  it('should format hours and minutes', () => {
    const twoHoursFortyFiveMinutes = 2 * 60 * 60 * 1000 + 45 * 60 * 1000;
    expect(formatUptimeDetailed(twoHoursFortyFiveMinutes)).toBe('2 hours, 45 minutes');
  });

  it('should format minutes only', () => {
    const thirtyMinutes = 30 * 60 * 1000;
    expect(formatUptimeDetailed(thirtyMinutes)).toBe('30 minutes');
  });

  it('should handle singular forms', () => {
    const oneDayOneHourOneMinute = 1 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000 + 1 * 60 * 1000;
    expect(formatUptimeDetailed(oneDayOneHourOneMinute)).toBe('1 day, 1 hour, 1 minute');
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
  it('should return green for load < 4', () => {
    expect(getLoadColor(0)).toBe('green');
    expect(getLoadColor(1.5)).toBe('green');
    expect(getLoadColor(3.99)).toBe('green');
  });

  it('should return yellow for load >= 4 and < 6', () => {
    expect(getLoadColor(4)).toBe('yellow');
    expect(getLoadColor(5)).toBe('yellow');
    expect(getLoadColor(5.99)).toBe('yellow');
  });

  it('should return red for load >= 6', () => {
    expect(getLoadColor(6)).toBe('red');
    expect(getLoadColor(10)).toBe('red');
    expect(getLoadColor(100)).toBe('red');
  });

  it('should return dimmed for undefined or non-finite values', () => {
    expect(getLoadColor(undefined)).toBe('dimmed');
    expect(getLoadColor(NaN)).toBe('dimmed');
    expect(getLoadColor(Infinity)).toBe('dimmed');
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
