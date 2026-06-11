import { z } from 'zod';
import { HttpClient } from '../util/httpClient.js';
import { validate } from './validate.js';

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

/** Picks for the count/suggestion endpoints, which accept a subset of the search params. */
export const EcfrCountsParamsSchema = EcfrSearchParamsSchema.pick({ query: true, agency_slugs: true, hierarchy: true }).strict();
export const EcfrSuggestionsParamsSchema = EcfrSearchParamsSchema.pick({ query: true }).strict();

/** Query for ecfr.versions; nested issue_date filter (flatten() serializes it to issue_date[...]). */
export const EcfrVersionsQuerySchema = z.object({
  issue_date: z.object({
    on: z.string().optional(),
    gte: z.string().optional(),
    lte: z.string().optional(),
  }).strict().describe('Issue-date filter, e.g. { gte: "2023-01-01" }.').optional(),
  identifier: z.string().optional(),
}).strict();
export type EcfrVersionsQuery = z.infer<typeof EcfrVersionsQuerySchema>;

/** Open node selector for ancestry/full: a flat map of hierarchy level -> value. */
export const EcfrNodeQuerySchema = z.record(z.union([z.string(), z.number()]));

export const EcfrCorrectionsQuerySchema = z.object({
  date: z.string().optional(),
  title: z.union([z.number(), z.string()]).optional(),
  error_corrected_date: z.string().optional(),
}).strict();
export type EcfrCorrectionsQuery = z.infer<typeof EcfrCorrectionsQuerySchema>;

export const EcfrCorrectionsForTitleQuerySchema = z.object({
  date: z.string().optional(),
}).strict();
export type EcfrCorrectionsForTitleQuery = z.infer<typeof EcfrCorrectionsForTitleQuerySchema>;

export class EcfrClient {
  constructor(private readonly http: HttpClient) {}

  admin = {
    agencies: () => this.http.call({ path: '/admin/v1/agencies.json' }),
    corrections: (query?: EcfrCorrectionsQuery) => {
      const q = validate(EcfrCorrectionsQuerySchema, query ?? {}, 'ecfr.admin.corrections');
      return this.http.call({ path: '/admin/v1/corrections.json', query: flatten(q as Record<string, unknown>) });
    },
    corrections_for_title: (title: number, query?: EcfrCorrectionsForTitleQuery) => {
      const q = validate(EcfrCorrectionsForTitleQuerySchema, query ?? {}, 'ecfr.admin.corrections_for_title');
      return this.http.call({ path: `/admin/v1/corrections/title/${title}.json`, query: flatten(q as Record<string, unknown>) });
    },
  };

  titles = {
    list: () => this.http.call({ path: '/versioner/v1/titles.json' }),
  };

  structure = (date: string, title: number) =>
    this.http.call({ path: `/versioner/v1/structure/${date}/title-${title}.json` });

  ancestry = (date: string, title: number, query?: Record<string, string | number>) => {
    const q = query === undefined ? undefined : validate(EcfrNodeQuerySchema, query, 'ecfr.ancestry');
    return this.http.call({ path: `/versioner/v1/ancestry/${date}/title-${title}.json`, query: q });
  };

  versions = (title: number, query?: EcfrVersionsQuery) => {
    const q = validate(EcfrVersionsQuerySchema, query ?? {}, 'ecfr.versions');
    return this.http.call({ path: `/versioner/v1/versions/title-${title}.json`, query: flatten(q as Record<string, unknown>) });
  };

  /** Returns XML as a string. Large for whole titles; prefer structure/ancestry first. */
  full = (date: string, title: number, query?: Record<string, string | number>) => {
    const q = query === undefined ? undefined : validate(EcfrNodeQuerySchema, query, 'ecfr.full');
    return this.http.call<string>({ path: `/versioner/v1/full/${date}/title-${title}.xml`, query: q, accept: 'xml' });
  };

  search = {
    results: (params: EcfrSearchParams) => {
      const p = validate(EcfrSearchParamsSchema, params, 'ecfr.search.results');
      return this.http.call({ path: '/search/v1/results', query: flatten(p as unknown as Record<string, unknown>) });
    },
    counts_daily: (params: Pick<EcfrSearchParams, 'query' | 'agency_slugs' | 'hierarchy'>) => {
      const p = validate(EcfrCountsParamsSchema, params, 'ecfr.search.counts_daily');
      return this.http.call({ path: '/search/v1/counts/daily', query: flatten(p as Record<string, unknown>) });
    },
    counts_titles: (params: Pick<EcfrSearchParams, 'query' | 'agency_slugs' | 'hierarchy'>) => {
      const p = validate(EcfrCountsParamsSchema, params, 'ecfr.search.counts_titles');
      return this.http.call({ path: '/search/v1/counts/titles', query: flatten(p as Record<string, unknown>) });
    },
    counts_hierarchy: (params: Pick<EcfrSearchParams, 'query' | 'agency_slugs' | 'hierarchy'>) => {
      const p = validate(EcfrCountsParamsSchema, params, 'ecfr.search.counts_hierarchy');
      return this.http.call({ path: '/search/v1/counts/hierarchy', query: flatten(p as Record<string, unknown>) });
    },
    suggestions: (params: Pick<EcfrSearchParams, 'query'>) => {
      const p = validate(EcfrSuggestionsParamsSchema, params, 'ecfr.search.suggestions');
      return this.http.call({ path: '/search/v1/suggestions', query: flatten(p as Record<string, unknown>) });
    },
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
