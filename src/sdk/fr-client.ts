import { z } from 'zod';
import { HttpClient } from '../util/httpClient.js';
import { validate } from './validate.js';

const DateFilter = z.object({
  is: z.string().optional(),
  gte: z.string().optional(),
  lte: z.string().optional(),
  year: z.number().optional(),
}).strict();

const DocType = z.enum(['RULE', 'PRORULE', 'NOTICE', 'PRESDOCU']);

/**
 * Conditions for fr.documents.search / fr.documents.facets. `.strict()` over a
 * key set calibrated against the live API: the Federal Register API rejects
 * unknown condition keys with HTTP 400, so strictness converts that remote 400
 * into a local, actionable error rather than relaxing anything. The set includes
 * `sections` and `regulation_id_number`, which the prior interface omitted.
 */
export const DocumentSearchConditionsSchema = z.object({
  term: z.string().describe('Full-text query. Quote a multi-word value for an exact-phrase match.').optional(),
  agencies: z.array(z.string()).describe('Agency slugs, e.g. "environmental-protection-agency" (see fr.agencies.list).').optional(),
  agency_ids: z.array(z.union([z.number(), z.string()])).describe('Numeric agency ids (distinct from the `agencies` slug filter).').optional(),
  publication_date: DateFilter.describe('Filter by publication date; string dates are YYYY-MM-DD, year is a number.').optional(),
  effective_date: DateFilter.describe('Filter by effective date (rules).').optional(),
  type: z.union([z.array(DocType), DocType]).describe("Document type(s): 'Rule'=RULE, 'Proposed Rule'=PRORULE, 'Notice'=NOTICE, 'Presidential Document'=PRESDOCU. One value or an array.").optional(),
  topics: z.array(z.string()).optional(),
  sections: z.array(z.string()).describe('FederalRegister.gov sections, e.g. "money", "environment".').optional(),
  significant: z.union([z.literal(0), z.literal(1)], {
    errorMap: () => ({ message: 'must be the integer 0 or 1, not a boolean (true silently returns the wrong count)' }),
  }).describe('1 = Significant under EO 12866. Use the integer 1, NOT the boolean true (a boolean silently returns the wrong count).').optional(),
  cfr: z.object({
    title: z.union([z.number(), z.string()]).optional(),
    part: z.union([z.number(), z.string()]).optional(),
  }).strict().describe('Restrict to a CFR title/part, e.g. { title: 21 }.').optional(),
  docket_id: z.string().describe('Single agency docket id (singular; "docket_ids" is rejected by the API).').optional(),
  regulation_id_number: z.string().optional(),
  president: z.string().optional(),
  presidential_document_type: z.array(z.string()).optional(),
}).strict();
export type DocumentSearchConditions = z.infer<typeof DocumentSearchConditionsSchema>;

export const DocumentSearchParamsSchema = z.object({
  conditions: DocumentSearchConditionsSchema.optional(),
  fields: z.array(z.string()).describe('Response fields to return (see fr.document.* fields).').optional(),
  per_page: z.number().describe('Results per page (max 1000).').optional(),
  page: z.number().describe('Page number (pagination is capped at the first 2000 results).').optional(),
  order: z.enum(['relevance', 'newest', 'oldest', 'executive_order_number']).optional(),
}).strict();
export type DocumentSearchParams = z.infer<typeof DocumentSearchParamsSchema>;

export const FacetsParamsSchema = z.object({
  conditions: DocumentSearchConditionsSchema.optional(),
  facet: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'agency', 'topic', 'section', 'subject', 'type'])
    .describe('Aggregation bucket. Interpolated into the request path, so it must be one of these values.'),
}).strict();
export type FacetsParams = z.infer<typeof FacetsParamsSchema>;

/** Conditions for fr.publicInspection.search — a DIFFERENT shape from documents.search. */
export const PIDocumentSearchConditionsSchema = z.object({
  available_on: z.string().describe('On public inspection as of this date (YYYY-MM-DD).').optional(),
  agencies: z.array(z.string()).describe('Agency slugs.').optional(),
  agency_ids: z.array(z.union([z.number(), z.string()])).describe('Numeric agency ids (distinct from the `agencies` slug filter).').optional(),
  type: z.array(z.string()).describe('Document type(s) on public inspection.').optional(),
  special_filing: z.union([z.literal(0), z.literal(1)]).describe('1 = special filing.').optional(),
  docket_id: z.string().optional(),
}).strict();

export const PIDocumentSearchParamsSchema = z.object({
  conditions: PIDocumentSearchConditionsSchema.optional(),
  fields: z.array(z.string()).optional(),
  per_page: z.number().optional(),
  page: z.number().optional(),
}).strict();
export type PIDocumentSearchParams = z.infer<typeof PIDocumentSearchParamsSchema>;

export class FederalRegisterClient {
  constructor(private readonly http: HttpClient) {}

  documents = {
    search: (params: DocumentSearchParams = {}) => {
      const p = validate(DocumentSearchParamsSchema, params, 'fr.documents.search');
      return this.http.call({ path: '/documents.json', query: flattenConditions(p as Record<string, unknown>) });
    },

    get: (documentNumber: string, fields?: string[]) =>
      this.http.call({
        path: `/documents/${encodeURIComponent(documentNumber)}.json`,
        query: fields ? { 'fields[]': fields } : undefined,
      }),

    getMany: (documentNumbers: string[], fields?: string[]) =>
      this.http.call({
        path: `/documents/${documentNumbers.map(encodeURIComponent).join(',')}.json`,
        query: fields ? { 'fields[]': fields } : undefined,
      }),

    facets: (params: FacetsParams) => {
      const p = validate(FacetsParamsSchema, params, 'fr.documents.facets');
      return this.http.call({
        path: `/documents/facets/${encodeURIComponent(p.facet)}`,
        query: flattenConditions({ conditions: p.conditions } as Record<string, unknown>),
      });
    },
  };

  publicInspection = {
    current: (fields?: string[]) =>
      this.http.call({
        path: '/public-inspection-documents/current.json',
        query: fields ? { 'fields[]': fields } : undefined,
      }),

    search: (params: PIDocumentSearchParams = {}) => {
      const p = validate(PIDocumentSearchParamsSchema, params, 'fr.publicInspection.search');
      return this.http.call({ path: '/public-inspection-documents.json', query: flattenConditions(p as Record<string, unknown>) });
    },

    get: (documentNumber: string, fields?: string[]) =>
      this.http.call({
        path: `/public-inspection-documents/${encodeURIComponent(documentNumber)}.json`,
        query: fields ? { 'fields[]': fields } : undefined,
      }),

    getMany: (documentNumbers: string[], fields?: string[]) =>
      this.http.call({
        path: `/public-inspection-documents/${documentNumbers.map(encodeURIComponent).join(',')}.json`,
        query: fields ? { 'fields[]': fields } : undefined,
      }),
  };

  agencies = {
    list: () => this.http.call({ path: '/agencies' }),
    get: (slug: string) => this.http.call({ path: `/agencies/${encodeURIComponent(slug)}` }),
  };

  issues = {
    get: (publicationDate: string) =>
      this.http.call({ path: `/issues/${encodeURIComponent(publicationDate)}.json` }),
  };

  suggestedSearches = {
    list: (sections?: string) =>
      this.http.call({ path: '/suggested_searches', query: sections ? { sections } : undefined }),
    get: (section: string) =>
      this.http.call({ path: `/suggested_searches/${encodeURIComponent(section)}` }),
  };

  images = {
    get: (identifier: string) =>
      this.http.call({ path: `/images/${encodeURIComponent(identifier)}` }),
  };
}

function flattenConditions(input: Record<string, unknown>): Record<string, string | number | boolean | string[] | undefined> {
  const out: Record<string, string | number | boolean | string[] | undefined> = {};
  function walk(obj: Record<string, unknown>, prefix: string) {
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null) continue;
      const key = prefix ? `${prefix}[${k}]` : k;
      if (Array.isArray(v)) {
        out[`${key}[]`] = v.map(String);
      } else if (typeof v === 'object') {
        walk(v as Record<string, unknown>, key);
      } else {
        out[key] = v as string | number | boolean;
      }
    }
  }
  walk(input, '');
  // fields[] convention
  if ('fields' in out && Array.isArray(out.fields)) {
    out['fields[]'] = out.fields as string[];
    delete out.fields;
  }
  return out;
}
