// SOLMAR HEAT — make.fun entry builder.
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json with the kit's buildDossier. Node 22+, stdlib only.
// Deterministic: same inputs always produce byte-identical outputs.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const ROOT = dirname(fileURLToPath(import.meta.url));

function outDir(): string {
  const env = process.env.MAKEFUN_OUTPUT_DIR;
  if (env && env.trim() !== '') return resolve(env);
  return join(ROOT, 'output');
}

function fail(msg: string): never {
  console.error(`main.ts: ${msg}`);
  process.exit(1);
}

function main(): void {
  const out = outDir();
  const gameDir = join(ROOT, 'game');
  const shotsDir = join(ROOT, 'screenshots');
  if (!existsSync(gameDir)) fail('game/ directory is missing');
  if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
  if (!existsSync(shotsDir)) fail('screenshots/ directory is missing');

  const shots = readdirSync(shotsDir)
    .filter((n) => !n.startsWith('.'))
    .sort();
  if (shots.length !== 4) fail(`screenshots/ must hold exactly 4 images, found ${shots.length}`);
  for (const name of shots) {
    if (!/\.(jpg|jpeg|png)$/i.test(name)) fail(`screenshots/${name} is not a JPG or PNG`);
    const size = statSync(join(shotsDir, name)).size;
    if (size > 256 * 1024) fail(`screenshots/${name} is ${size} bytes, over the 256 KiB limit`);
  }

  // Fresh output directory every run, so stale files can never leak in.
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'game'), { recursive: true });
  mkdirSync(join(out, 'screenshots'), { recursive: true });
  cpSync(gameDir, join(out, 'game'), { recursive: true });
  cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

  const dossier = buildDossier(ROOT, {
    text_max_bytes: 1000000,
    screenshots: { max: 4, max_bytes: 262144 },
  });
  writeFileSync(join(out, 'dossier.json'), dossier);

  const gameFiles = readdirSync(join(out, 'game'), { recursive: true }) as string[];
  console.log(`main.ts: wrote ${out}`);
  console.log(`main.ts: game files: ${gameFiles.length}, screenshots: ${shots.length}`);
  console.log(`main.ts: dossier.json: ${dossier.length} bytes`);
}

main();
