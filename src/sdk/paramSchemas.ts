import type { ZodTypeAny } from 'zod';
import { DocumentSearchParamsSchema, FacetsParamsSchema } from './fr-client.js';
import { EcfrSearchParamsSchema } from './ecfr-client.js';

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
  'ecfr.search.results': EcfrSearchParamsSchema,
};
