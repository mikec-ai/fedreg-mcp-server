import type { ZodTypeAny } from 'zod';

/**
 * Render a Zod schema as a compact, human-readable parameter contract for the
 * agent-facing docs surfaced by `describe_schema` and `search_api`.
 *
 * Reads Zod 3 internals (`_def.typeName`, …) in the same style as
 * `src/server/zodToJsonSchema.ts`. Crucially it propagates descriptions through
 * `ZodOptional`/`ZodDefault`/`ZodEffects` wrappers — a `.describe(...).optional()`
 * field keeps its description, which the JSON-Schema converter currently drops.
 */

interface Unwrapped {
  inner: ZodTypeAny;
  optional: boolean;
  description?: string;
}

/** Peel Optional/Nullable/Default/Effects wrappers, capturing optionality and the nearest description. */
function unwrap(node: ZodTypeAny): Unwrapped {
  let s: ZodTypeAny = node;
  let optional = false;
  let description: string | undefined;
  for (;;) {
    const def = (s as any)._def;
    if (!def) break;
    if (description === undefined && typeof def.description === 'string') description = def.description;
    const t = def.typeName;
    if (t === 'ZodOptional' || t === 'ZodNullable' || t === 'ZodDefault') { optional = true; s = def.innerType; }
    else if (t === 'ZodEffects') { s = def.schema; }
    else break;
  }
  return { inner: s, optional, description };
}

function renderType(node: ZodTypeAny, indent: number): string {
  const def = (node as any)._def;
  switch (def?.typeName) {
    case 'ZodString': return 'string';
    case 'ZodNumber': return 'number';
    case 'ZodBoolean': return 'boolean';
    case 'ZodLiteral': return JSON.stringify(def.value);
    case 'ZodEnum': return (def.values as string[]).map((v) => `'${v}'`).join(' | ');
    // Parenthesize an array whose element is a union, e.g. (A | B)[]. The ' | ' heuristic
    // is safe because enum/literal values in these schemas never contain that separator.
    case 'ZodArray': {
      const inner = renderType(unwrap(def.type).inner, indent);
      return inner.includes(' | ') ? `(${inner})[]` : `${inner}[]`;
    }
    case 'ZodUnion': {
      const parts = (def.options as ZodTypeAny[]).map((o) => renderType(unwrap(o).inner, indent));
      return [...new Set(parts)].join(' | ');
    }
    case 'ZodRecord': return `Record<${def.keyType ? renderType(unwrap(def.keyType).inner, indent) : 'string'}, ${renderType(unwrap(def.valueType).inner, indent)}>`;
    case 'ZodObject': {
      const shape = def.shape() as Record<string, ZodTypeAny>;
      const pad = ' '.repeat(indent + 2);
      const lines = Object.entries(shape).map(([key, value]) => {
        const u = unwrap(value);
        const typeStr = renderType(u.inner, indent + 2);
        const desc = u.description ? `  — ${u.description}` : '';
        return `${pad}${key}${u.optional ? '?' : ''}: ${typeStr}${desc}`;
      });
      return `{\n${lines.join('\n')}\n${' '.repeat(indent)}}`;
    }
    // Loud fallback: an unhandled Zod node renders as unsupported<Type> so the coverage
    // drift-guard test fails rather than silently shipping a meaningless agent contract.
    default: return `unsupported<${(def && def.typeName) || 'unknown'}>`;
  }
}

export function renderParams(schema: ZodTypeAny): string {
  return renderType(unwrap(schema).inner, 0);
}
