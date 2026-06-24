// Generate the TypeScript projection of the canonical game-definition JSON
// Schema. The schema is the contract; this file's output is committed and a CI
// drift guard fails if it falls out of sync (see .github/workflows/ci.yml).
//
// Usage: pnpm gen:types
import { compileFromFile } from 'json-schema-to-typescript';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = resolve(root, 'shared/schemas/game-definition.schema.json');
const outPath = resolve(root, 'shared/src/types/game.generated.d.ts');

const banner = `/* eslint-disable */
/**
 * GENERATED — DO NOT EDIT BY HAND.
 *
 * TypeScript projection of shared/schemas/game-definition.schema.json (the
 * single-source structural contract). The schema intentionally leaves some
 * objects open (e.g. \`features\`, \`paytable\`); the hand-written types in
 * \`game.ts\` add the precise shapes on top and are checked against this
 * projection by the conformance assertion at the bottom of \`game.ts\`.
 *
 * Regenerate with: pnpm gen:types  (CI fails if this drifts from the schema).
 */`;

const ts = await compileFromFile(schemaPath, {
  bannerComment: banner,
  additionalProperties: false,
  declareExternallyReferenced: true,
  style: { singleQuote: true, semi: true },
});

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, ts);
console.log(`Wrote ${outPath}`);
