// SOLMAR HEAT — make.fun gta6-01 entry, v2 (full 3D open-world crime game).
// Hands in game/ and screenshots/ to the output directory and writes
// dossier.json with the kit's buildDossier. Node 24 runs this file as-is.
// The output directory comes from MAKEFUN_OUTPUT_DIR and defaults to /output,
// so `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` works locally too.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = resolve(fileURLToPath(new URL('.', import.meta.url)));
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});

writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`SOLMAR HEAT dossier written: ${join(out, 'dossier.json')} (${dossier.length} bytes)`);
