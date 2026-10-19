import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

/**
 * D76 anti-cheat guard. `tests/acceptance/` is written by an independent agent from docs/specs/phase1-quality.md,
 * which commits MANIFEST.sha256 ("<sha256>  <path>" per file). Any edited, added or removed file fails the check, so
 * the builder cannot weaken the acceptance tests without it showing up in review.
 */
export function guardAcceptance(directory) {
  const manifestPath = join(directory, 'MANIFEST.sha256');
  const files = [];
  const walk = folder => { for (const name of readdirSync(folder)) { const path = join(folder, name); if (statSync(path).isDirectory()) walk(path); else files.push(relative(directory, path).split(sep).join('/')); } };
  if (existsSync(directory)) walk(directory);
  const listed = files.filter(file => file !== 'MANIFEST.sha256');
  if (!existsSync(manifestPath)) return listed.length ? [`tests/acceptance has ${listed.length} file(s) but no MANIFEST.sha256`] : [];
  const problems = [], expected = new Map();
  for (const [index, line] of readFileSync(manifestPath, 'utf8').split('\n').entries()) {
    if (!line.trim()) continue;
    const match = /^([0-9a-f]{64}) {2}([A-Za-z0-9._/-]+)$/.exec(line);
    if (!match) { problems.push(`MANIFEST.sha256 line ${index + 1} is not "<sha256>  <path>"`); continue; }
    if (match[2] === 'MANIFEST.sha256' || match[2].split('/').includes('..')) { problems.push(`MANIFEST.sha256 line ${index + 1} names an invalid path`); continue; }
    expected.set(match[2], match[1]);
  }
  for (const [file, hash] of expected) {
    if (!listed.includes(file)) { problems.push(`${file} is listed but missing`); continue; }
    const actual = createHash('sha256').update(readFileSync(join(directory, file))).digest('hex');
    if (actual !== hash) problems.push(`${file} was changed after the independent author committed it`);
  }
  for (const file of listed) if (!expected.has(file)) problems.push(`${file} is not in MANIFEST.sha256`);
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const directory = fileURLToPath(new URL('../tests/acceptance/', import.meta.url));
  const problems = guardAcceptance(directory);
  if (problems.length) { for (const problem of problems) console.error(`acceptance guard: ${problem}`); process.exit(1); }
  console.log(JSON.stringify({ acceptanceGuard: 'ok', files: existsSync(join(directory, 'MANIFEST.sha256')) ? readFileSync(join(directory, 'MANIFEST.sha256'), 'utf8').split('\n').filter(Boolean).length : 0 }));
}
