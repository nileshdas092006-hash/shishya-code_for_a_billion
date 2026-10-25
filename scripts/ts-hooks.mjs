// Lets Node run this project's TypeScript files directly (Node 24 strips types natively).
// Our source imports "./fraction" or "./skills" (a folder) without an extension, so this hook retries such
// imports with ".ts", then "/index.ts". No dependency needed.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/.test(specifier)) throw error;
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      return nextResolve(`${specifier}/index.ts`, context);
    }
  }
}

// Our source imports JSON files (fixtures) the way Next.js and Vitest do, without `with { type: "json" }`.
export async function load(url, context, nextLoad) {
  if (url.endsWith(".json")) return nextLoad(url, { ...context, importAttributes: { ...context.importAttributes, type: "json" } });
  return nextLoad(url, context);
}
