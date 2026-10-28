import path from 'node:path';

export const layers = Object.freeze({
  geometry: Object.freeze([]),
  'core-model': Object.freeze(['@gharplan/geometry', 'ajv', 'ajv-formats', 'immer']),
  persistence: Object.freeze(['@gharplan/geometry', '@gharplan/core-model', 'immer', '@capacitor/core', '@capacitor/filesystem']),
});
const testLibraries = ['vitest', 'fast-check', 'fake-indexeddb'];
const root = path.resolve(import.meta.dirname, '..').replaceAll('\\', '/');
const slash = value => value.replaceAll('\\', '/');
const beneath = (value, parent) => value === parent || value.startsWith(parent + '/');
const packageName = value => value.startsWith('@') ? value.split('/').slice(0, 2).join('/') : value.split('/')[0];

/** Static architectural admission, not a security sandbox or mutation proof. */
export function boundaryViolation(filename, dependency) {
  const file = slash(filename), test = /\.test\.[cm]?[jt]sx?$/.test(file);
  const relative = path.posix.relative(root, file), layer = /^packages\/([^/]+)\/src\//.exec(relative)?.[1];
  const renderer = /^apps\/web\/src\/(editor|render3d)\//.test(relative);
  const app = relative.startsWith('apps/web/src/');
  const pureUi = relative === 'apps/web/src/i18n/messages.ts' || relative === 'apps/web/src/perf/metrics.ts';
  if (!layer && !app) return null;
  if (layer && !Object.hasOwn(layers, layer)) return 'Register this package layer before importing dependencies.';
  if (typeof dependency !== 'string') return 'Calculated module loads are forbidden in protected layers; use a literal import.';
  const specifier = slash(dependency);
  // Six consumer tests read shipped catalog/SVG/GLB files (D83 adds decoded furniture/immutable-bed comparisons);
  // this exact-file exception admits no production Node import or arbitrary test filesystem access.
  if (test && ['apps/web/src/catalog/catalog.test.ts', 'apps/web/src/catalog/api.test.ts', 'apps/web/src/catalog/modern-furniture.test.ts', 'apps/web/src/samples/showcase.test.ts', 'apps/web/src/catalog/furniture-symbols.test.ts', 'apps/web/src/catalog/furniture-wave.test.ts', 'apps/web/src/catalog/catalog-wave-d91.test.ts'].includes(relative) && specifier === 'node:fs/promises') return null;
  if (specifier.startsWith('/') || /^[A-Za-z][A-Za-z\d+.-]*:/.test(specifier))
    return 'Rooted or URL module imports bypass public package boundaries; use an admitted bare or relative specifier.';
  if (/^@gharplan\//.test(specifier) && specifier.split('/').length !== 2)
    return 'Import workspace packages through their public entry point, never a private subpath.';
  if (pureUi) return specifier === '@gharplan/geometry' ? null : 'Pure UI helpers cannot import UI state, storage, native or application orchestration.';
  if (specifier === '.' || specifier.startsWith('./') || specifier.startsWith('../')) {
    const target = path.posix.resolve(path.posix.dirname(file), specifier);
    if (layer) {
      if (beneath(target, `${root}/packages/${layer}/src`)) return null;
      if (test && target.endsWith('.json') && (beneath(target, `${root}/docs/examples`) || beneath(target, `${root}/tests/fixtures`))) return null;
      return 'Relative imports must stay inside this package; use an allowed public workspace entry point.';
    }
    if (!renderer) {
      if (beneath(target, `${root}/apps/web/src`) || target.endsWith('.json') && beneath(target, `${root}/docs/examples`)) return null;
      return 'App imports cannot reach package implementation files; use the public workspace entry point.';
    }
    if (beneath(target, `${root}/apps/web/src/editor`) || beneath(target, `${root}/apps/web/src/render3d`) ||
        target === `${root}/apps/web/src/perf/metrics` || target === `${root}/apps/web/src/i18n/messages`) return null;
    if (test && target.endsWith('.json') && (beneath(target, `${root}/docs/examples`) || beneath(target, `${root}/tests/fixtures`))) return null;
    return 'Render adapters cannot import app orchestration/storage; receive model data and emit commands instead.';
  }
  if (specifier.split('/').some(part => part === '.' || part === '..')) return 'Bare package imports cannot traverse into another package.';
  if (!layer && !renderer) return null;
  const name = packageName(specifier);
  if (layer) {
    if (layers[layer].includes(name) || test && testLibraries.includes(name)) return null;
    return `Dependency ${name} is not admitted in ${layer}; pure layers cannot depend on UI, storage or native adapters.`;
  }
  if (['@gharplan/core-model', '@gharplan/geometry', 'react', 'konva', 'three'].includes(name) || test && ['vitest', 'fast-check'].includes(name)) return null;
  return `Render adapters cannot depend on ${name}; storage and application orchestration belong above them.`;
}

export const importBoundaries = {
  meta: { type: 'problem', schema: [], messages: { forbidden: '{{reason}}' } },
  create(context) {
    const report = (node, reason) => { if (reason) context.report({ node, messageId: 'forbidden', data: { reason } }); };
    const check = (node, source) => {
      const reason = boundaryViolation(context.filename, source?.type === 'Literal' ? source.value : undefined);
      report(node, reason);
    };
    const named = (node, names) => node.type === 'Identifier' && names.includes(node.name) || node.type === 'MemberExpression' &&
      node.object.type === 'Identifier' && ['window', 'self', 'globalThis'].includes(node.object.name) &&
      names.includes(node.computed ? node.property.value : node.property.name);
    const moduleBase = node => node?.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier' && node.property.name === 'url' &&
      node.object.type === 'MetaProperty' && node.object.meta.name === 'import' && node.object.property.name === 'meta';
    return {
      ImportDeclaration: node => check(node, node.source),
      ExportNamedDeclaration: node => { if (node.source) check(node, node.source); },
      ExportAllDeclaration: node => check(node, node.source),
      ImportExpression: node => check(node, node.source),
      TSImportType: node => check(node, node.source),
      TSImportEqualsDeclaration: node => { if (node.moduleReference.type === 'TSExternalModuleReference') check(node, node.moduleReference.expression); },
      CallExpression: node => { if (node.callee.type === 'Identifier' && node.callee.name === 'require') check(node, node.arguments[0]); },
      NewExpression: node => {
        if (!named(node.callee, ['Worker', 'SharedWorker'])) return;
        const url = node.arguments[0];
        if (url?.type === 'NewExpression' && named(url.callee, ['URL']) && moduleBase(url.arguments[1])) check(node, url.arguments[0]);
        else if (boundaryViolation(context.filename, undefined)) report(node, 'Workers must use a literal new URL(..., import.meta.url) so their layer can be checked.');
      },
    };
  },
};
