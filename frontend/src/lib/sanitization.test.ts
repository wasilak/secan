import { describe, it, expect } from 'vitest';
import {
  sanitizeHtml,
  sanitizeUrl,
  sanitizeJson,
  validateIndexName,
  validateJson,
  sanitizeString,
  escapeHtml,
  validateClusterId,
} from './sanitization';

describe('sanitizeHtml', () => {
  it('should escape HTML tags', () => {
    const input = '<script>alert("xss")</script>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('should escape HTML entities', () => {
    const input = '<div>Hello & goodbye</div>';
    const result = sanitizeHtml(input);
    expect(result).toContain('&lt;div&gt;');
    expect(result).toContain('&amp;');
  });

  it('should handle plain text', () => {
    const input = 'Hello World';
    const result = sanitizeHtml(input);
    expect(result).toBe('Hello World');
  });
});

describe('sanitizeUrl', () => {
  it('should encode special characters', () => {
    const input = 'hello world?test=1&foo=bar';
    const result = sanitizeUrl(input);
    expect(result).toBe('hello%20world%3Ftest%3D1%26foo%3Dbar');
  });

  it('should handle plain text', () => {
    const input = 'helloworld';
    const result = sanitizeUrl(input);
    expect(result).toBe('helloworld');
  });
});

describe('sanitizeJson', () => {
  it('should escape quotes', () => {
    const input = 'hello "world"';
    const result = sanitizeJson(input);
    expect(result).toContain('\\"');
  });

  it('should escape backslashes', () => {
    const input = 'hello\\world';
    const result = sanitizeJson(input);
    expect(result).toContain('\\\\');
  });
});

describe('validateIndexName', () => {
  it('should accept valid index names', () => {
    expect(validateIndexName('my-index').valid).toBe(true);
    expect(validateIndexName('my_index').valid).toBe(true);
    expect(validateIndexName('myindex123').valid).toBe(true);
  });

  it('should reject empty names', () => {
    const result = validateIndexName('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('should reject names starting with invalid characters', () => {
    expect(validateIndexName('_myindex').valid).toBe(false);
    expect(validateIndexName('-myindex').valid).toBe(false);
    expect(validateIndexName('+myindex').valid).toBe(false);
  });

  it('should reject . and ..', () => {
    expect(validateIndexName('.').valid).toBe(false);
    expect(validateIndexName('..').valid).toBe(false);
  });

  it('should reject names with invalid characters', () => {
    expect(validateIndexName('my/index').valid).toBe(false);
    expect(validateIndexName('my\\index').valid).toBe(false);
    expect(validateIndexName('my*index').valid).toBe(false);
    expect(validateIndexName('my?index').valid).toBe(false);
    expect(validateIndexName('my index').valid).toBe(false);
    expect(validateIndexName('my,index').valid).toBe(false);
    expect(validateIndexName('my#index').valid).toBe(false);
  });

  it('should reject uppercase names', () => {
    expect(validateIndexName('MyIndex').valid).toBe(false);
    expect(validateIndexName('MYINDEX').valid).toBe(false);
  });

  it('should reject names that are too long', () => {
    const longName = 'a'.repeat(256);
    expect(validateIndexName(longName).valid).toBe(false);
  });

  it('should accept names at max length', () => {
    const maxName = 'a'.repeat(255);
    expect(validateIndexName(maxName).valid).toBe(true);
  });
});

describe('validateJson', () => {
  it('should accept valid JSON', () => {
    expect(validateJson('{"key": "value"}').valid).toBe(true);
    expect(validateJson('{"number": 123}').valid).toBe(true);
    expect(validateJson('[]').valid).toBe(true);
    expect(validateJson('null').valid).toBe(true);
  });

  it('should reject invalid JSON', () => {
    expect(validateJson('not json').valid).toBe(false);
    expect(validateJson('{invalid}').valid).toBe(false);
    expect(validateJson('').valid).toBe(false);
  });

  it('should provide error messages', () => {
    const result = validateJson('invalid');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('sanitizeString', () => {
  it('should trim whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('should remove control characters', () => {
    const input = 'hello\x00\x01\x02world';
    const result = sanitizeString(input);
    expect(result).toBe('helloworld');
  });

  it('should preserve newlines and tabs', () => {
    expect(sanitizeString('hello\nworld')).toBe('hello\nworld');
    expect(sanitizeString('hello\tworld')).toBe('hello\tworld');
  });

  it('should limit length', () => {
    const longString = 'a'.repeat(2000);
    const result = sanitizeString(longString, 100);
    expect(result.length).toBe(100);
  });

  it('should use default max length', () => {
    const longString = 'a'.repeat(2000);
    const result = sanitizeString(longString);
    expect(result.length).toBe(1000);
  });
});

describe('escapeHtml', () => {
  it('should escape HTML entities', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
  });

  it('should handle multiple entities', () => {
    const input = '<div class="test">Hello & goodbye</div>';
    const result = escapeHtml(input);
    expect(result).toBe('&lt;div class=&quot;test&quot;&gt;Hello &amp; goodbye&lt;/div&gt;');
  });

  it('should handle plain text', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});

describe('validateClusterId', () => {
  it('should accept valid cluster IDs', () => {
    expect(validateClusterId('cluster-1').valid).toBe(true);
    expect(validateClusterId('my_cluster').valid).toBe(true);
    expect(validateClusterId('prod123').valid).toBe(true);
    expect(validateClusterId('PROD-123').valid).toBe(true);
  });

  it('should reject empty IDs', () => {
    const result = validateClusterId('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('should reject IDs with invalid characters', () => {
    expect(validateClusterId('cluster/1').valid).toBe(false);
    expect(validateClusterId('cluster 1').valid).toBe(false);
    expect(validateClusterId('cluster@1').valid).toBe(false);
  });

  it('should reject IDs that are too long', () => {
    const longId = 'a'.repeat(101);
    expect(validateClusterId(longId).valid).toBe(false);
  });

  it('should accept IDs at max length', () => {
    const maxId = 'a'.repeat(100);
    expect(validateClusterId(maxId).valid).toBe(true);
  });
});
