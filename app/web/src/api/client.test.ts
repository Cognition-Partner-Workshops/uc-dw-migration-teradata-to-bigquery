import { describe, expect, it } from 'vitest';
import { resolveBaseUrl } from './client';

describe('resolveBaseUrl', () => {
  it('keeps absolute URLs', () => {
    expect(resolveBaseUrl('https://api.dreamhouse.example')).toBe('https://api.dreamhouse.example');
  });
  it('resolves a relative base against the page origin', () => {
    expect(resolveBaseUrl('/api')).toBe(`${window.location.origin}/api`);
    expect(resolveBaseUrl('/api/')).toBe(`${window.location.origin}/api`);
  });
});
