// Coral Bay Heist — the hand-in program for make.fun's gta6-01 bounty.
//
// The game itself is plain static files under game/ (index.html plus ES
// modules, three.js vendored under game/vendor/, no network request at all),
// with 3-4 real rendered screenshots under screenshots/. This program copies
// both folders next to this file into the output directory and writes the
// dossier the judge reads, using the vendored make.fun library.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output; without it,
// the program writes to /output.
//
// Node 22, standard library only.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root: the directory this file lives in.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

// Copy the whole static game, then the screenshots beside it.
mkdirSync(outputDir, { recursive: true });
cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

// The scorer's own caps: the dossier text is capped at 160 KiB, at most 4
// screenshots of at most 256 KiB each, and game/ holds at most 993 files
// totalling 48 MiB with no path over 1000 bytes. These numbers mirror the
// gate so an entry this program accepts is one the scorer accepts.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
