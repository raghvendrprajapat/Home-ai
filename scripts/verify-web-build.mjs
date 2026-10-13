import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import process from 'node:process';
import ts from 'typescript';
export function verifyWebBuild(directory) {
  const root = resolve(directory), inside = file => file.startsWith(root + sep);
  const forbidden = /gharplan-e2e-render-fault|Controlled E2E render fault|FaultGate/;
  for (const name of readdirSync(resolve(root, 'assets'))) {
    if (name.endsWith('.js') && forbidden.test(readFileSync(resolve(root, 'assets', name), 'utf8'))) throw new Error('Test crash hook leaked into production.');
  }
  const html = readFileSync(resolve(root, 'index.html'), 'utf8'), entries = [...html.matchAll(/(?:src|href)="([^"\s]+\.js)"/g)].map(match => match[1]);
  if (!entries.length) throw new Error('Production entry JavaScript is missing.');
  const visited = new Set(); let initialGzipBytes = 0;
  const visit = file => {
    if (!inside(file) || visited.has(file)) { if (!inside(file)) throw new Error('Build import escaped its directory.'); return; }
    visited.add(file); const source = readFileSync(file, 'utf8'); initialGzipBytes += gzipSync(source).length;
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    for (const statement of ast.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      const module = statement.moduleSpecifier;
      if (!module || !ts.isStringLiteral(module)) continue;
      if (!module.text.startsWith('.')) throw new Error('Unexpected external static build dependency.');
      visit(resolve(dirname(file), module.text));
    }
  };
  for (const entry of entries) visit(resolve(root, entry.replace(/^\//, '')));
  if (initialGzipBytes > 600000) throw new Error('Initial JavaScript exceeds the 600000-byte gzip gate.');
  return { initialGzipBytes, initialModules: visited.size, crashHooks: 'absent', limitBytes: 600000 };
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) process.stdout.write(JSON.stringify(verifyWebBuild(process.argv[2] ?? 'apps/web/dist')) + '\n');
