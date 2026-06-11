import { describe, it, expect } from 'vitest';
import { parse } from 'acorn';
import { PARAM_SCHEMAS } from '../src/sdk/paramSchemas.js';
import { getCorpus } from '../src/search/corpus.js';
import { describeSchema } from '../src/tools/describeSchema.js';

const registeredIds = Object.keys(PARAM_SCHEMAS);

// Every object-param ("Bucket B") endpoint should have a registered schema.
const BUCKET_B = [
  'fr.documents.search',
  'fr.documents.facets',
  'fr.publicInspection.search',
  'ecfr.search.results',
  'ecfr.search.counts_daily',
  'ecfr.search.counts_titles',
  'ecfr.search.counts_hierarchy',
  'ecfr.search.suggestions',
  'ecfr.versions',
  'ecfr.ancestry',
  'ecfr.full',
  'ecfr.admin.corrections',
  'ecfr.admin.corrections_for_title',
];

describe('param-schema coverage (drift guard)', () => {
  it('registers a schema for every Bucket B endpoint', () => {
    const unregistered = BUCKET_B.filter(id => !registeredIds.includes(id));
    expect(unregistered).toEqual([]);
  });

  it('every registered id resolves to a real corpus endpoint', () => {
    const { entries } = getCorpus();
    const orphans = registeredIds.filter(id => !entries.has(id));
    expect(orphans).toEqual([]);
  });

  it('every registered endpoint surfaces a non-empty params contract via describe_schema', () => {
    const empty = registeredIds.filter(id => {
      const r = describeSchema({ path: id });
      return !(r.found && (r.entries[0]?.params ?? '').length > 0);
    });
    expect(empty).toEqual([]);
  });

  it('renders no unsupported-type token for any registered endpoint', () => {
    const offenders = registeredIds.filter(id => {
      const r = describeSchema({ path: id });
      return (r.found ? (r.entries[0]?.params ?? '') : '').includes('unsupported<');
    });
    expect(offenders).toEqual([]);
  });

  // Mechanically extract each endpoint's documented example object and parse it
  // against the registered schema — so a dictionary example can't drift out of
  // sync with its schema (the failure mode the per-schema example tests guard,
  // here applied to every endpoint automatically).
  it('every registered endpoint parses its own field-dictionary example', () => {
    const { entries } = getCorpus();
    const failures: string[] = [];
    for (const id of registeredIds) {
      const example = entries.get(id)?.example;
      if (!example) { failures.push(`${id}: no example`); continue; }
      const code = example.replace(/^await\s+/, '');
      try {
         
        const ast = parse(code, { ecmaVersion: 'latest' }) as any;
        const call = ast.body[0]?.expression;
        // the params object is always the last object-literal argument of the call
         
        const objArg = [...(call?.arguments ?? [])].reverse().find((a: any) => a.type === 'ObjectExpression');
        if (!objArg) { failures.push(`${id}: example has no object-literal argument`); continue; }
         
        const value = Function(`return (${code.slice(objArg.start, objArg.end)})`)() as unknown;
        if (!PARAM_SCHEMAS[id]!.safeParse(value).success) failures.push(`${id}: example fails its schema`);
      } catch (e) {
        failures.push(`${id}: ${String(e)}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
