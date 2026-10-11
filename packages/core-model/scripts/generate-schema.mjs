import { readFile, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import standalone from 'ajv/dist/standalone/index.js';
const schemaPath = new URL('../../../docs/examples/project.schema.json', import.meta.url);
const outputPath = new URL('../src/generated/project-validator.js', import.meta.url);
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const ajv = new Ajv({ strict: true, allErrors: true, code: { source: true, esm: true, lines: true } });
addFormats(ajv);
let output = standalone(ajv, ajv.compile(schema));
// Ajv's ESM export mode still emits CJS helper loads. Convert only literal package loads.
const imports = new Map();
output = output.replace(/require\("([^"]+)"\)/g, (_, dependency) => {
  if (!imports.has(dependency)) imports.set(dependency, `dependency_${imports.size}`);
  return imports.get(dependency);
});
output = '// Generated from docs/examples/project.schema.json. Run pnpm schema:generate; do not edit.\n' +
  [...imports].map(([path, name]) => `import ${name}_module from ${JSON.stringify(path + '.js')};\nconst ${name} = typeof ${name}_module === "function" ? { default: ${name}_module } : ${name}_module;`).join('\n') + '\n' + output;
if (process.argv.includes('--check')) {
  if (await readFile(outputPath, 'utf8') !== output) throw new Error('Project schema validator is stale; run pnpm schema:generate.');
} else await writeFile(outputPath, output);
