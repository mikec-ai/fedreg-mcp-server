import type { ZodTypeAny } from 'zod';
import { DocumentSearchParamsSchema, FacetsParamsSchema, PIDocumentSearchParamsSchema } from './fr-client.js';
import {
  EcfrSearchParamsSchema,
  EcfrCountsParamsSchema,
  EcfrSuggestionsParamsSchema,
  EcfrVersionsQuerySchema,
  EcfrNodeQuerySchema,
  EcfrCorrectionsQuerySchema,
  EcfrCorrectionsForTitleQuerySchema,
} from './ecfr-client.js';

/**
 * Registry mapping a corpus endpoint id (e.g. 'fr.documents.search') to the Zod
 * schema describing its request params. `getCorpus()` renders each registered
 * schema into the entry's `params` field, so `describe_schema` and `search_api`
 * surface the contract — and the same schemas validate inputs in the SDK clients.
 *
 * Populated incrementally as schemas are authored.
 */
export const PARAM_SCHEMAS: Record<string, ZodTypeAny> = {
  'fr.documents.search': DocumentSearchParamsSchema,
  'fr.documents.facets': FacetsParamsSchema,
  'fr.publicInspection.search': PIDocumentSearchParamsSchema,
  'ecfr.search.results': EcfrSearchParamsSchema,
  'ecfr.search.counts_daily': EcfrCountsParamsSchema,
  'ecfr.search.counts_titles': EcfrCountsParamsSchema,
  'ecfr.search.counts_hierarchy': EcfrCountsParamsSchema,
  'ecfr.search.suggestions': EcfrSuggestionsParamsSchema,
  'ecfr.versions': EcfrVersionsQuerySchema,
  'ecfr.ancestry': EcfrNodeQuerySchema,
  'ecfr.full': EcfrNodeQuerySchema,
  'ecfr.admin.corrections': EcfrCorrectionsQuerySchema,
  'ecfr.admin.corrections_for_title': EcfrCorrectionsForTitleQuerySchema,
};
