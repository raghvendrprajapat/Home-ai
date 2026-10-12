import { accessSync, constants, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

// Runner SDK tools need not be on PATH. Prefer the named latest toolchain; if
// absent, accept a single installed version rather than guessing among many.
const root = process.argv[2];
if (!root) throw new Error('An explicit Android SDK root is required.');
const tools = resolve(root, 'cmdline-tools');
const usable = bin => {
  try {
    for (const name of ['sdkmanager', 'apkanalyzer']) accessSync(resolve(bin, name), constants.X_OK);
    return true;
  } catch { return false; }
};
const latest = resolve(tools, 'latest', 'bin');
if (usable(latest)) process.stdout.write(latest + '\n');
else {
  const candidates = readdirSync(tools).map(name => resolve(tools, name, 'bin')).filter(usable);
  if (candidates.length !== 1) throw new Error(`Expected one usable SDK toolchain or latest; found ${candidates.length}.`);
  process.stdout.write(candidates[0] + '\n');
}
