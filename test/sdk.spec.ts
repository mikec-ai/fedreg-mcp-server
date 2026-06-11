import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAgent } from 'undici';
import { buildSdk } from '../src/sdk/bindings.js';

const FR_ORIGIN = 'https://www.federalregister.gov';
const ECFR_ORIGIN = 'https://www.ecfr.gov';

let agent: MockAgent;

function sdk() {
  return buildSdk({
    frBaseUrl: `${FR_ORIGIN}/api/v1`,
    ecfrBaseUrl: `${ECFR_ORIGIN}/api`,
    userAgent: 'test/0.0',
    timeoutMs: 5000,
    retries: 0,
    cacheTtlMs: 0,
    cacheMaxItems: 0,
    dispatcher: agent,
  });
}

describe('FederalRegisterClient', () => {
  beforeEach(() => {
    agent = new MockAgent();
    agent.disableNetConnect();
  });
  afterEach(async () => { await agent.close(); });

  it('builds documents.search with flattened conditions', async () => {
    agent.get(FR_ORIGIN).intercept({
      path: (p) =>
        p.startsWith('/api/v1/documents.json')
        && p.includes('conditions%5Bterm%5D=methane')
        && p.includes('conditions%5Bagencies%5D%5B%5D=environmental-protection-agency')
        && p.includes('conditions%5Bpublication_date%5D%5Bgte%5D=2024-01-01')
        && p.includes('per_page=50')
        && p.includes('order=newest'),
      method: 'GET',
    }).reply(200, { results: [] });

    const out = await sdk().fr.documents.search({
      conditions: {
        term: 'methane',
        agencies: ['environmental-protection-agency'],
        publication_date: { gte: '2024-01-01' },
      },
      per_page: 50,
      order: 'newest',
    }) as { results: unknown[] };
    expect(out.results).toEqual([]);
  });

  it('fetches a single document by number', async () => {
    agent.get(FR_ORIGIN)
      .intercept({ path: '/api/v1/documents/2024-12345.json', method: 'GET' })
      .reply(200, { document_number: '2024-12345' });

    const out = await sdk().fr.documents.get('2024-12345') as { document_number: string };
    expect(out.document_number).toBe('2024-12345');
  });

  it('lists agencies', async () => {
    agent.get(FR_ORIGIN)
      .intercept({ path: '/api/v1/agencies', method: 'GET' })
      .reply(200, [{ slug: 'epa' }]);

    const out = await sdk().fr.agencies.list() as Array<{ slug: string }>;
    expect(out[0]?.slug).toBe('epa');
  });

  it('validates params before any HTTP call: rejects the significant boolean footgun', () => {
    expect(() => sdk().fr.documents.search({ conditions: { significant: true } } as never))
      .toThrow(/fr\.documents\.search\.conditions\.significant/);
  });

  it('rejects an unknown (misspelled) condition key under strict', () => {
    expect(() => sdk().fr.documents.search({ conditions: { significnt: 1 } } as never))
      .toThrow(/Unrecognized key.*significnt/);
  });

  it('rejects an invalid facet bucket', () => {
    expect(() => sdk().fr.documents.facets({ facet: 'hourly' } as never))
      .toThrow(/fr\.documents\.facets\.facet/);
  });

  it('builds documents.facets with the bucket interpolated into the path', async () => {
    agent.get(FR_ORIGIN).intercept({
      path: (p) =>
        p.startsWith('/api/v1/documents/facets/daily')
        && p.includes('conditions%5Bagencies%5D%5B%5D=epa'),
      method: 'GET',
    }).reply(200, { count: 1 });

    const out = await sdk().fr.documents.facets({ facet: 'daily', conditions: { agencies: ['epa'] } }) as { count: number };
    expect(out.count).toBe(1);
  });
});

describe('EcfrClient', () => {
  beforeEach(() => {
    agent = new MockAgent();
    agent.disableNetConnect();
  });
  afterEach(async () => { await agent.close(); });

  it('runs a search.results call', async () => {
    agent.get(ECFR_ORIGIN).intercept({
      path: (p) =>
        p.startsWith('/api/search/v1/results')
        && p.includes('query=methane')
        && p.includes('agency_slugs%5B%5D=environmental-protection-agency'),
      method: 'GET',
    }).reply(200, { results: [] });

    const out = await sdk().ecfr.search.results({
      query: 'methane',
      agency_slugs: ['environmental-protection-agency'],
    }) as { results: unknown[] };
    expect(out.results).toEqual([]);
  });

  it('fetches structure for a title on a date', async () => {
    agent.get(ECFR_ORIGIN)
      .intercept({ path: '/api/versioner/v1/structure/2024-01-01/title-40.json', method: 'GET' })
      .reply(200, { type: 'title' });

    const out = await sdk().ecfr.structure('2024-01-01', 40) as { type: string };
    expect(out.type).toBe('title');
  });

  it('returns full title XML as string', async () => {
    agent.get(ECFR_ORIGIN)
      .intercept({ path: '/api/versioner/v1/full/2024-01-01/title-40.xml', method: 'GET' })
      .reply(200, '<TITLE/>', { headers: { 'content-type': 'application/xml' } });

    const out = await sdk().ecfr.full('2024-01-01', 40);
    expect(typeof out).toBe('string');
    expect(out).toContain('<TITLE');
  });

  it('validates search.results params: rejects unknown param and missing query', () => {
    expect(() => sdk().ecfr.search.results({ query: 'x', not_a_real_param: 1 } as never))
      .toThrow(/Unrecognized key.*not_a_real_param/);
    expect(() => sdk().ecfr.search.results({} as never)).toThrow(/query/);
  });

  it('builds versions with the nested issue_date flattened to the wire form', async () => {
    agent.get(ECFR_ORIGIN).intercept({
      path: (p) =>
        p.startsWith('/api/versioner/v1/versions/title-40.json')
        && p.includes('issue_date%5Bgte%5D=2023-01-01'),
      method: 'GET',
    }).reply(200, { content_versions: [] });

    const out = await sdk().ecfr.versions(40, { issue_date: { gte: '2023-01-01' } }) as { content_versions: unknown[] };
    expect(out.content_versions).toEqual([]);
  });

  it('serializes a node-selector query into the full() path', async () => {
    agent.get(ECFR_ORIGIN).intercept({
      path: (p) => p.startsWith('/api/versioner/v1/full/2024-01-01/title-40.xml') && p.includes('part=60'),
      method: 'GET',
    }).reply(200, '<TITLE/>', { headers: { 'content-type': 'application/xml' } });

    const out = await sdk().ecfr.full('2024-01-01', 40, { part: 60 });
    expect(out).toContain('<TITLE');
  });
});
