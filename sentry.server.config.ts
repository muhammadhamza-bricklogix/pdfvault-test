/**
 * Sentry has been retired in favour of ECS CloudWatch. This file is
 * kept as an empty module so any leftover dynamic `import()` from
 * `instrumentation.ts` (previous shape) resolves cleanly during the
 * cutover window. Safe to delete once the file no longer appears in
 * any bundle graph — check with `bun run build` and remove if unused.
 */
export {};
