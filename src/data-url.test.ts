import { describe, it, expect } from 'vitest';
import { dataUrlToArrayBuffer } from './data-url';

describe('dataUrlToArrayBuffer', () => {
  it('round-trips a base64 data URL back to its original bytes', () => {
    const original = new Uint8Array([0, 1, 2, 253, 254, 255, 65, 66, 67]);
    const base64 = btoa(String.fromCharCode(...original));
    const dataUrl = `data:image/png;base64,${base64}`;

    const result = new Uint8Array(dataUrlToArrayBuffer(dataUrl));

    expect(Array.from(result)).toEqual(Array.from(original));
  });

  it('handles an empty base64 payload', () => {
    const result = dataUrlToArrayBuffer('data:image/png;base64,');
    expect(result.byteLength).toBe(0);
  });
});
