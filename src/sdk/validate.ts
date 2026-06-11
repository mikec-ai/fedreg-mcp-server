import type { ZodType } from 'zod';

/**
 * Parse `params` against `schema`, returning typed data. On failure, throw a
 * `ValidationError` with a one-line, path-qualified message.
 *
 * The message is formatted HERE, before the error crosses the sandbox RPC
 * boundary: `dispatch` (src/sdk/runtime.ts) copies only `{ name, message, status }`,
 * and `ZodError.message` is a multi-line JSON dump — so the readable, actionable
 * message an agent sees has to be produced at this seam.
 */
export function validate<T>(schema: ZodType<T>, params: unknown, ctx: string): T {
  const result = schema.safeParse(params);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const path = issue?.path?.length ? `${ctx}.${issue.path.join('.')}` : ctx;
  const err = new Error(`${path}: ${issue?.message ?? 'invalid parameters'}`);
  err.name = 'ValidationError';
  throw err;
}
