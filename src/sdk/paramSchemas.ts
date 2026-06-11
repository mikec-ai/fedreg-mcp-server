import type { ZodTypeAny } from 'zod';

/**
 * Registry mapping a corpus endpoint id (e.g. 'fr.documents.search') to the Zod
 * schema describing its request params. `getCorpus()` renders each registered
 * schema into the entry's `params` field, so `describe_schema` and `search_api`
 * surface the contract — and the same schemas validate inputs in the SDK clients.
 *
 * Populated incrementally as schemas are authored (Phase 1+). Empty here so the
 * Phase 0 plumbing is a pure no-op.
 */
export const PARAM_SCHEMAS: Record<string, ZodTypeAny> = {};
