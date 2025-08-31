export function omitUndefined<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;            // drop undefined
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = omitUndefined(v as any);       // recurse for nested
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
