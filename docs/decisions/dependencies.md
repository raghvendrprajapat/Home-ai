# PH0-T01 dependency register

Checked against official npm version metadata and official GitHub repositories on 2026-10-11, before installation. These exact versions are selected for the skeleton; the lockfile pins their transitive dependencies. Package metadata is license evidence, supplemented by the installed-package license inventory during verification.

| Dependency | Exact version | License | Purpose | Evidence |
|---|---|---|---|---|
| Node.js | 24.19.0 | MIT, with bundled third-party notices | Verified Krypton LTS runtime | [Official release](https://github.com/nodejs/node/releases/tag/v24.19.0) |
| pnpm | 11.19.0 | MIT | Workspace and frozen-lockfile installs | [Version metadata](https://registry.npmjs.org/pnpm/11.19.0) |
| react | 19.3.0 | MIT | Web shell | [Version metadata](https://registry.npmjs.org/react/19.3.0) |
| react-dom | 19.3.0 | MIT | Browser mounting | [Version metadata](https://registry.npmjs.org/react-dom/19.3.0) |
| vite | 8.3.4 | MIT | Web development server and production build | [Version metadata](https://registry.npmjs.org/vite/8.3.4) |
| @vitejs/plugin-react | 6.1.2 | MIT | React JSX transformation with Vite 8 | [Version metadata](https://registry.npmjs.org/@vitejs%2Fplugin-react/6.1.2) |
| typescript | 6.0.3 | Apache-2.0 | Strict checking across all packages | [Version metadata](https://registry.npmjs.org/typescript/6.0.3) |
| eslint | 10.12.0 | MIT | Source/configuration linting | [Version metadata](https://registry.npmjs.org/eslint/10.12.0) |
| @eslint/js | 10.0.1 | MIT | JavaScript lint recommendations | [Version metadata](https://registry.npmjs.org/@eslint%2Fjs/10.0.1) |
| typescript-eslint | 8.71.1 | MIT | TypeScript lint parsing and rules | [Version metadata](https://registry.npmjs.org/typescript-eslint/8.71.1) |
| vitest | 5.0.3 | MIT | Smoke-test runner; future pure-engine tests use Node | [Version metadata](https://registry.npmjs.org/vitest/5.0.3) |
| jsdom | 30.1.2 | MIT | DOM for the web smoke test | [Version metadata](https://registry.npmjs.org/jsdom/30.1.2) |
| @testing-library/react | 16.3.3 | MIT | Render the actual React shell and query accessibility roles | [Version metadata](https://registry.npmjs.org/@testing-library%2Freact/16.3.3) |
| @testing-library/dom | 10.4.2 | MIT | Required React Testing Library peer | [Version metadata](https://registry.npmjs.org/@testing-library%2Fdom/10.4.2) |
| @types/react | 19.3.0 | MIT | React types | [Version metadata](https://registry.npmjs.org/@types%2Freact/19.3.0) |
| @types/react-dom | 19.3.0 | MIT | Browser renderer types | [Version metadata](https://registry.npmjs.org/@types%2Freact-dom/19.3.0) |
| @types/node | 24.19.2 | MIT | Node 24 tooling types | [Version metadata](https://registry.npmjs.org/@types%2Fnode/24.19.2) |

Compatibility decisions:

- Node 24.19.0 meets pnpm's >=22.13, Vite/plugin's >=22.12 and jsdom's >=24.15 requirements.
- TypeScript 7.0.2 is excluded: typescript-eslint 8.71.1 declares support for >=4.8.4 and <6.1.0. TypeScript 6.0.3 is within that supported range.
- React and react-dom share the exact version; type packages match their major/minor. Vite 8 satisfies the plugin and Vitest peer ranges.
- Optional compiler, browser-test, coverage and canvas peers are not installed. No renderer, backend, Android, asset or billing dependency is needed in PH0-T01.
- No geometry algorithms exist yet. fast-check and independent geometry fixtures start in their own tasks, not as empty or tautological tests here.

## CI actions

Official release tags were resolved to immutable commits; all three actions have MIT license metadata.

| Action | Release | Commit |
|---|---|---|
| actions/checkout | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| actions/setup-node | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| pnpm/action-setup | v6.1.0 | `ea17c68df8912ef543352723c149a84f56e3d413` |

Sources: each action's official GitHub `releases/latest`, tag-ref and license endpoints. New dependencies must be entered here before installation, with purpose, exact version and license evidence. GPL/AGPL code and non-commercial assets are prohibited by AGENTS.md. This task introduces no 3D assets.

## Resolved registry inventory

After lockfile-only resolution and before installing packages, all 210 resolved registry package versions were checked against official npm license metadata and recorded in `dependency-licenses.json`. The check found no unknown licenses and no GPL/AGPL candidates. It includes optional platform packages, so its count can exceed the installed package count.

Licenses present: MIT, MIT-0, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, BlueOak-1.0.0 and CC0-1.0. Preserve applicable bundled license/notice files when distributing dependency code. MPL-2.0 file-level obligations still apply if such code is modified/distributed; this task does not modify third-party code. Registry metadata is not a legal opinion or proof that every bundled file was inspected.
