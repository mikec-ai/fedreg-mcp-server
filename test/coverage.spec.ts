import { describe, it, expect } from 'vitest';
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
});
