import { describe, it, expect } from 'vitest';
import { DocumentSearchParamsSchema, DocumentSearchConditionsSchema, FacetsParamsSchema, PIDocumentSearchParamsSchema } from '../src/sdk/fr-client.js';
import { EcfrSearchParamsSchema, EcfrVersionsQuerySchema, EcfrCorrectionsQuerySchema } from '../src/sdk/ecfr-client.js';
import { describeSchema } from '../src/tools/describeSchema.js';
import { searchApi } from '../src/tools/searchApi.js';

describe('DocumentSearch schemas', () => {
  it('parses the field-dictionary.json documented example (R2)', () => {
    // mirrors schema/field-dictionary.json fr.documents.search example
    expect(DocumentSearchParamsSchema.safeParse({
      conditions: { term: 'methane', agencies: ['environmental-protection-agency'], publication_date: { gte: '2024-01-01' } },
      per_page: 50,
      order: 'newest',
    }).success).toBe(true);
  });

  it('accepts every calibration-verified condition form', () => {
    const forms = [
      { significant: 1 },
      { cfr: { title: 21 } },
      { cfr: { title: '21' } },
      { type: ['RULE'] },
      { type: 'RULE' },
      { sections: ['environment'] },
      { regulation_id_number: '2060-AV16' },
      { agency_ids: [145] },
      { correction: 1 },
      { near: { location: '20001', within: 25 } },
    ];
    for (const c of forms) {
      expect(DocumentSearchConditionsSchema.safeParse(c).success).toBe(true);
    }
  });

  it('rejects the significant boolean footgun', () => {
    expect(DocumentSearchConditionsSchema.safeParse({ significant: true }).success).toBe(false);
  });

  it('rejects an unknown condition key (strict typo guard)', () => {
    expect(DocumentSearchConditionsSchema.safeParse({ significnt: 1 }).success).toBe(false);
  });
});

describe('FacetsParams schema', () => {
  it('parses the documented example and rejects an invalid facet', () => {
    expect(FacetsParamsSchema.safeParse({ facet: 'monthly', conditions: { agencies: ['nuclear-regulatory-commission'] } }).success).toBe(true);
    expect(FacetsParamsSchema.safeParse({ facet: 'hourly' }).success).toBe(false);
  });
});

describe('PIDocumentSearchParams schema', () => {
  it('accepts the public-inspection conditions and rejects unknown keys', () => {
    expect(PIDocumentSearchParamsSchema.safeParse({ conditions: { agencies: ['federal-aviation-administration'], special_filing: 1 } }).success).toBe(true);
    expect(PIDocumentSearchParamsSchema.safeParse({ conditions: { available_on: '2026-06-11' } }).success).toBe(true);
    expect(PIDocumentSearchParamsSchema.safeParse({ conditions: { agency_ids: [145] } }).success).toBe(true);
    expect(PIDocumentSearchParamsSchema.safeParse({ conditions: { nope: 1 } }).success).toBe(false);
  });
});

describe('EcfrSearchParams schema', () => {
  it('parses the documented example and the hierarchy form', () => {
    expect(EcfrSearchParamsSchema.safeParse({ query: 'greenhouse gas', agency_slugs: ['environmental-protection-agency'], per_page: 20 }).success).toBe(true);
    expect(EcfrSearchParamsSchema.safeParse({ query: 'greenhouse gas', hierarchy: { title: '40' } }).success).toBe(true);
  });

  it('requires query and rejects unknown params (strict)', () => {
    expect(EcfrSearchParamsSchema.safeParse({ hierarchy: { title: '40' } }).success).toBe(false);
    expect(EcfrSearchParamsSchema.safeParse({ query: 'x', not_a_real_param: 1 }).success).toBe(false);
  });
});

describe('eCFR auxiliary schemas (Phase 3)', () => {
  it('versions: nested issue_date parses; flattened-string key and unknown key rejected', () => {
    expect(EcfrVersionsQuerySchema.safeParse({ issue_date: { gte: '2023-01-01' } }).success).toBe(true);
    expect(EcfrVersionsQuerySchema.safeParse({ 'issue_date[gte]': '2023-01-01' }).success).toBe(false);
    expect(EcfrVersionsQuerySchema.safeParse({ nope: 1 }).success).toBe(false);
  });

  it('counts/suggestions share the full search schema (accept date/last_modified, reject unknown)', () => {
    // All eCFR search sub-endpoints accept the same param vocabulary (verified live).
    expect(EcfrSearchParamsSchema.safeParse({ query: 'x', date: '2024-01-01', hierarchy: { title: '40' } }).success).toBe(true);
    expect(EcfrSearchParamsSchema.safeParse({ query: 'x', last_modified_after: '2024-01-01' }).success).toBe(true);
    expect(EcfrSearchParamsSchema.safeParse({ query: 'x', bogus: 1 }).success).toBe(false);
    expect(EcfrSearchParamsSchema.safeParse({ hierarchy: { title: '40' } }).success).toBe(false); // query required
  });

  it('corrections rejects unknown keys', () => {
    expect(EcfrCorrectionsQuerySchema.safeParse({ title: 40 }).success).toBe(true);
    expect(EcfrCorrectionsQuerySchema.safeParse({ titel: 40 }).success).toBe(false);
  });
});

describe('params surfacing (registry wiring)', () => {
  it('describe_schema returns a rendered params contract for fr.documents.search', () => {
    const r = describeSchema({ path: 'fr.documents.search' });
    expect(r.found).toBe(true);
    if (r.found) {
      const p = r.entries[0]?.params ?? '';
      expect(p).toContain('significant?: 0 | 1');
      expect(p).toContain('cfr?:');
      expect(p).toContain('Use the integer 1');
    }
  });

  it('search_api surfaces params on the eCFR search hit', () => {
    const { hits } = searchApi({ query: 'search the code of federal regulations text', k: 5 });
    const hit = hits.find(h => h.id === 'ecfr.search.results');
    expect(hit?.params).toContain('hierarchy?:');
  });
});
