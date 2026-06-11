import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validate } from '../src/sdk/validate.js';

const schema = z.object({
  significant: z.union([z.literal(0), z.literal(1)]).optional(),
}).strict();

describe('validate', () => {
  it('returns parsed data when valid', () => {
    expect(validate(schema, { significant: 1 }, 'fr.documents.search')).toEqual({ significant: 1 });
  });

  it('throws ValidationError with a path-qualified message (footgun guard)', () => {
    expect(() => validate(schema, { significant: true }, 'fr.documents.search'))
      .toThrowError(/fr\.documents\.search\.significant/);
  });

  it('rejects unknown keys under strict (typo guard)', () => {
    expect(() => validate(schema, { significnt: 1 }, 'fr.documents.search')).toThrow();
  });
});
