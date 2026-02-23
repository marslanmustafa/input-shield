import { defineConfig } from 'tsup';

export default defineConfig([
  // Main bundle — zero deps, tree-shakeable
  {
    entry: { index: 'src/index.ts', zod: 'src/zod.ts', email: 'src/email.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: true,       // per-chunk splitting for tree-shaking
    treeshake: true,
    minify: false,         // don't minify — let bundlers do it
    target: 'es2020',
    outExtension({ format }) {
      return { js: format === 'cjs' ? '.cjs' : '.mjs' };
    },
  },
  // Zod integration — separate subpath, zod is a peerDep (not bundled)
  {
    entry: { zod: 'src/zod.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    splitting: false,
    external: ['zod'],     // CRITICAL: never bundle zod into the output
    target: 'es2020',
    outExtension({ format }) {
      return { js: format === 'cjs' ? '.cjs' : '.mjs' };
    },
  },
]);
