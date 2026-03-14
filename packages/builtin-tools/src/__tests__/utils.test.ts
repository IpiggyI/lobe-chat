import { describe, expect, it } from 'vitest';

import { filterDisabledToolIds } from '../utils';

describe('filterDisabledToolIds', () => {
  it('should return original array when disabled list is empty', () => {
    const toolIds = ['a', 'b', 'c'];
    const result = filterDisabledToolIds(toolIds, []);

    expect(result).toBe(toolIds); // same reference, not a copy
  });

  it('should remove disabled IDs from the array', () => {
    const result = filterDisabledToolIds(['a', 'b', 'c', 'd'], ['b', 'd']);

    expect(result).toEqual(['a', 'c']);
  });

  it('should handle disabled IDs not present in toolIds', () => {
    const result = filterDisabledToolIds(['a', 'b'], ['x', 'y']);

    expect(result).toEqual(['a', 'b']);
  });

  it('should return empty array when all tools are disabled', () => {
    const result = filterDisabledToolIds(['a', 'b'], ['a', 'b']);

    expect(result).toEqual([]);
  });

  it('should handle empty toolIds array', () => {
    const result = filterDisabledToolIds([], ['a']);

    expect(result).toEqual([]);
  });
});
