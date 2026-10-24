import { describe, it, expect } from 'vitest';
import { resolveSearch } from './search';

const bangs = [{ shortcut: '!yt', url: 'https://yt/?q={QUERY}' }];

describe('resolveSearch', () => {
  it('uses a matching bang and strips it', () => {
    expect(resolveSearch('!yt cats & dogs', bangs)).toBe('https://yt/?q=cats%20%26%20dogs');
  });
  it('falls back to DuckDuckGo', () => {
    expect(resolveSearch('hello world', bangs)).toBe('https://duckduckgo.com/?q=hello%20world');
  });
});
