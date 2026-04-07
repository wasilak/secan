import { describe, it, expect } from 'vitest';
import {
  asRecord,
  asArray,
  numOrUndefined,
  numOrZero,
  parseTimestamp,
  getDataArray,
  pickFirstString,
} from './normalize';

describe('normalize helpers', () => {
  it('asRecord returns object for records and {} otherwise', () => {
    expect(asRecord({ a: 1 })).toHaveProperty('a', 1);
    expect(asRecord(null)).toEqual({});
    expect(asRecord(123)).toEqual({});
    expect(asRecord([1, 2])).toEqual({});
  });

  it('asArray returns array or empty array', () => {
    expect(asArray([1, 2, 3])).toEqual([1, 2, 3]);
    expect(asArray({ data: 1 })).toEqual([]);
    expect(asArray(null)).toEqual([]);
  });

  it('numOrUndefined and numOrZero behave as expected', () => {
    expect(numOrUndefined(undefined)).toBeUndefined();
    expect(numOrUndefined(null)).toBeUndefined();
    expect(numOrUndefined('42')).toBe(42);
    expect(Number.isNaN(numOrUndefined('abc') as number)).toBe(true);

    expect(numOrZero(undefined)).toBe(0);
    expect(numOrZero(null)).toBe(0);
    expect(numOrZero('5')).toBe(5);
  });

  it('parseTimestamp handles date/time/timestamp values', () => {
    expect(parseTimestamp({ date: '2020-01-02' })).toBe('2020-01-02');
    expect(parseTimestamp({ time: '2021-03-04' })).toBe('2021-03-04');
    const iso = parseTimestamp({ timestamp: 1633036800 });
    expect(iso).toBe(new Date(1633036800 * 1000).toISOString());
    // numeric string should also parse
    const iso2 = parseTimestamp({ timestamp: '1633036800' });
    expect(iso2).toBe(new Date(Number('1633036800') * 1000).toISOString());
    expect(parseTimestamp({})).toBeUndefined();
  });

  it('getDataArray returns array from raw or envelope', () => {
    expect(getDataArray([1, 2, 3])).toEqual([1, 2, 3]);
    expect(getDataArray({ data: ['a'] })).toEqual(['a']);
    expect(getDataArray({ data: 'not-array' })).toEqual([]);
    expect(getDataArray(null)).toEqual([]);
  });

  it('pickFirstString returns first non-null/undefined string value', () => {
    const rec = { a: null, b: 'hello', c: 3 } as Record<string, unknown>;
    expect(pickFirstString(rec, ['a', 'b', 'c'])).toBe('hello');
    expect(pickFirstString({}, ['x', 'y'], 'fallback')).toBe('fallback');
    expect(pickFirstString({ k: 5 }, ['k'])).toBe('5');
  });
});
