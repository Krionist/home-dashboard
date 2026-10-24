import { describe, it, expect } from 'vitest';
import { cameraSrc } from './camera';

describe('cameraSrc', () => {
  it('appends the cache-buster with & when the picture already has a token', () => {
    expect(cameraSrc('http://ha:8123', '/api/camera_proxy/camera.x?token=abc', 7)).toBe(
      'http://ha:8123/api/camera_proxy/camera.x?token=abc&_=7',
    );
  });
  it('uses ? when there is no query', () => {
    expect(cameraSrc('http://ha:8123', '/p.jpg', 1)).toBe('http://ha:8123/p.jpg?_=1');
  });
  it('is empty without a picture', () => {
    expect(cameraSrc('http://ha:8123', undefined, 1)).toBe('');
  });
});
