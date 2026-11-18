// SOLMAR HEAT — gta6-01 entry program (Node 22, standard library only).
// It hands the game in: copies the playable static game/ folder and the
// screenshots/ folder from beside this file into the output directory, then
// writes dossier.json there with the kit's vendored dossier builder. The
// output is fully deterministic: same input files, same bytes out, every run.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Resolve the repository root (the folder holding this file) and the target.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy one folder tree into the output, creating the destination first.
function copyTree(name: string): void {
  const from = join(repoRoot, name);
  if (!existsSync(from)) return;
  mkdirSync(join(outDir, name), { recursive: true });
  cpSync(from, join(outDir, name), { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree('game');
copyTree('screenshots');

// Fail loudly if a screenshot is missing or over the gate's per-file cap,
// instead of shipping a build the scorer would refuse on arrival.
for (const name of ['1-menu.jpg', '2-downtown.jpg', '3-chase.jpg', '4-mission.jpg']) {
  const shot = join(outDir, 'screenshots', name);
  if (!existsSync(shot)) throw new Error(`missing screenshot: screenshots/${name}`);
  if (statSync(shot).size > 262144) throw new Error(`screenshot too large: screenshots/${name}`);
}

// The gate's caps (reference/gate.json): the dossier text cap shapes the
// bytes; the other limits refuse entries the scorer would refuse anyway.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
