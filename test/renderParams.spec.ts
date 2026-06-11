import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { renderParams } from '../src/sdk/renderParams.js';

describe('renderParams', () => {
  it('renders fields, optionality, and scalar types', () => {
    const out = renderParams(z.object({
      term: z.string().optional(),
      per_page: z.number().optional(),
      flag: z.boolean(),
    }));
    expect(out).toContain('term?: string');
    expect(out).toContain('per_page?: number');
    expect(out).toContain('flag: boolean');
  });

  it('preserves a description on a .describe().optional() field (R4)', () => {
    const out = renderParams(z.object({
      significant: z.union([z.literal(0), z.literal(1)])
        .describe('Use the integer 1, not the boolean true.').optional(),
    }));
    expect(out).toContain('significant?: 0 | 1');
    expect(out).toContain('Use the integer 1, not the boolean true.');
  });

  it('renders enums, arrays, unions, records, and nested objects', () => {
    const out = renderParams(z.object({
      type: z.enum(['RULE', 'PRORULE']).optional(),
      agencies: z.array(z.string()).optional(),
      cfr: z.object({ title: z.union([z.number(), z.string()]).optional() }).strict().optional(),
      query: z.record(z.string()).optional(),
    }));
    expect(out).toContain("type?: 'RULE' | 'PRORULE'");
    expect(out).toContain('agencies?: string[]');
    expect(out).toContain('title?: number | string');
    expect(out).toContain('Record<string, string>');
  });
});
