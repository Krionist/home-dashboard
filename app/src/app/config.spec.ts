import { describe, it, expect } from 'vitest';
import { parseConfig } from './config';

const ok = {
  haUrl: 'http://ha:8123',
  pages: [{ name: 'Home', columns: [{ size: 'small', widgets: [{ type: 'longhorn', title: 'L' }] }] }],
};

describe('parseConfig', () => {
  it('accepts a valid config', () => {
    expect(parseConfig(ok).pages[0].name).toBe('Home');
  });
  it('rejects missing haUrl', () => {
    expect(() => parseConfig({ pages: [] })).toThrow(/haUrl/);
  });
  it('rejects unknown widget types', () => {
    const bad = { ...ok, pages: [{ name: 'X', columns: [{ size: 'full', widgets: [{ type: 'nope' }] }] }] };
    expect(() => parseConfig(bad)).toThrow(/unknown widget type "nope"/);
  });
});
