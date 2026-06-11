import { z } from 'zod';
import { HttpClient } from '../util/httpClient.js';

const EcfrHierarchy = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  chapter: z.string().optional(),
  subchapter: z.string().optional(),
  part: z.string().optional(),
  subpart: z.string().optional(),
  section: z.string().optional(),
  appendix: z.string().optional(),
}).strict();

/**
 * Params for ecfr.search.*. `.strict()` over the documented param set: the eCFR
 * search API also rejects unknown params with HTTP 400, so strictness yields a
 * local error instead. `hierarchy` values are STRINGS.
 */
export const EcfrSearchParamsSchema = z.object({
  query: z.string().describe('Search query. Quote a multi-word value for an exact-phrase match (changes the result count).'),
  agency_slugs: z.array(z.string()).optional(),
  date: z.string().describe('Point-in-time date (YYYY-MM-DD).').optional(),
  last_modified_after: z.string().optional(),
  last_modified_before: z.string().optional(),
  last_modified_on_or_after: z.string().optional(),
  last_modified_on_or_before: z.string().optional(),
  hierarchy: EcfrHierarchy.describe('Restrict the search to a CFR location; values are STRINGS, e.g. { title: "40", part: "60" }.').optional(),
  per_page: z.number().describe('Results per page (default 20, max 1000).').optional(),
  page: z.number().optional(),
  order: z.enum(['relevance', 'hierarchy', 'newest', 'oldest']).optional(),
}).strict();
export type EcfrSearchParams = z.infer<typeof EcfrSearchParamsSchema>;

export class EcfrClient {
  constructor(private readonly http: HttpClient) {}

  admin = {
    agencies: () => this.http.call({ path: '/admin/v1/agencies.json' }),
    corrections: (query?: { date?: string; title?: number; error_corrected_date?: string }) =>
      this.http.call({ path: '/admin/v1/corrections.json', query: flatten(query ?? {}) }),
    corrections_for_title: (title: number, query?: { date?: string }) =>
      this.http.call({ path: `/admin/v1/corrections/title/${title}.json`, query: flatten(query ?? {}) }),
  };

  titles = {
    list: () => this.http.call({ path: '/versioner/v1/titles.json' }),
  };

  structure = (date: string, title: number) =>
    this.http.call({ path: `/versioner/v1/structure/${date}/title-${title}.json` });

  ancestry = (date: string, title: number, query?: Record<string, string | number>) =>
    this.http.call({ path: `/versioner/v1/ancestry/${date}/title-${title}.json`, query });

  versions = (title: number, query?: { issue_date?: { on?: string; lte?: string; gte?: string }; identifier?: string }) =>
    this.http.call({ path: `/versioner/v1/versions/title-${title}.json`, query: flatten(query ?? {}) });

  /** Returns XML as a string. Large for whole titles; prefer structure/ancestry first. */
  full = (date: string, title: number, query?: Record<string, string | number>) =>
    this.http.call<string>({ path: `/versioner/v1/full/${date}/title-${title}.xml`, query, accept: 'xml' });

  search = {
    results: (params: EcfrSearchParams) =>
      this.http.call({ path: '/search/v1/results', query: flatten(params as unknown as Record<string, unknown>) }),
    counts_daily: (params: Pick<EcfrSearchParams, 'query' | 'agency_slugs' | 'hierarchy'>) =>
      this.http.call({ path: '/search/v1/counts/daily', query: flatten(params) }),
    counts_titles: (params: Pick<EcfrSearchParams, 'query' | 'agency_slugs' | 'hierarchy'>) =>
      this.http.call({ path: '/search/v1/counts/titles', query: flatten(params) }),
    counts_hierarchy: (params: Pick<EcfrSearchParams, 'query' | 'agency_slugs' | 'hierarchy'>) =>
      this.http.call({ path: '/search/v1/counts/hierarchy', query: flatten(params) }),
    suggestions: (params: Pick<EcfrSearchParams, 'query'>) =>
      this.http.call({ path: '/search/v1/suggestions', query: flatten(params) }),
  };
}

function flatten(input: Record<string, unknown>): Record<string, string | number | boolean | string[] | undefined> {
  const out: Record<string, string | number | boolean | string[] | undefined> = {};
  function walk(obj: Record<string, unknown>, prefix: string) {
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null) continue;
      const key = prefix ? `${prefix}[${k}]` : k;
      if (Array.isArray(v)) out[`${key}[]`] = v.map(String);
      else if (typeof v === 'object') walk(v as Record<string, unknown>, key);
      else out[key] = v as string | number | boolean;
    }
  }
  walk(input, '');
  return out;
}
