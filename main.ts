// SOLMAR HEAT — make.fun gta6-01 entrypoint.
//
// Job: stage the playable game and its screenshots into the grader's output
// directory, then build the dossier from that staged copy.
//
// Safety note that shapes everything below: in the grading sandbox the output
// directory is a mount point. Removing it (or trying to) fails with EBUSY and
// the whole run is rejected. So this program only ever creates directories and
// overwrites files inside them — it never deletes the output root, and it
// never clears the root's contents either. Re-running into the same output
// directory is therefore harmless.

import { cpSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

// The scorer's gate caps, mirrored so this program refuses exactly where the
// scorer would. Keys match the vendored library's caps argument.
const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function bail(message: string): never {
  process.stderr.write(`main.ts: ${message}\n`);
  process.exit(1);
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

// Where this entry lives: derived from the module URL so the program works no
// matter which directory the grader launches it from.
const entryDir: string = dirname(fileURLToPath(import.meta.url));

// Where the staged entry goes: the grader names it, /output is the fallback.
const outputDir: string = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

const sourceGame: string = join(entryDir, "game");
const sourceShots: string = join(entryDir, "screenshots");
const sourceIndex: string = join(sourceGame, "index.html");

if (!isDirectory(sourceGame)) {
  bail(`missing game directory beside the entrypoint: ${sourceGame}`);
}
if (!isFile(sourceIndex)) {
  bail(`missing game/index.html beside the entrypoint: ${sourceIndex}`);
}
if (!isDirectory(sourceShots)) {
  bail(`missing screenshots directory beside the entrypoint: ${sourceShots}`);
}

const stagedGame: string = join(outputDir, "game");
const stagedShots: string = join(outputDir, "screenshots");

try {
  // Create-only staging: recursive mkdir is a no-op when the directory (or
  // the mount point itself) already exists.
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(stagedGame, { recursive: true });
  mkdirSync(stagedShots, { recursive: true });

  // Byte-exact recursive copies that overwrite whatever a previous run left.
  cpSync(sourceGame, stagedGame, { recursive: true, force: true });
  cpSync(sourceShots, stagedShots, { recursive: true, force: true });

  // The dossier describes the staged copy, so it is built from the output
  // directory and written back there verbatim.
  const dossierBytes: Uint8Array = buildDossier(outputDir, GATE_CAPS);
  writeFileSync(join(outputDir, "dossier.json"), dossierBytes);

  process.stdout.write(
    `SOLMAR HEAT ready: staged game/ and screenshots/ from ${entryDir} ` +
      `into ${outputDir}; dossier.json is ${dossierBytes.length} bytes\n`,
  );
} catch (err) {
  const detail: string = err instanceof Error ? err.message : String(err);
  bail(`staging failed: ${detail}`);
}
