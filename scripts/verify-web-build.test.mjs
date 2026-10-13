import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { verifyWebBuild } from './verify-web-build.mjs';
function fixture(run) {
  const root=mkdtempSync(join(tmpdir(),'gharplan-build-gate-'));mkdirSync(join(root,'assets'));writeFileSync(join(root,'index.html'),'<script type="module" src="/assets/main.js"></script>');
  try {run(root,(name,text)=>writeFileSync(join(root,'assets',name),text));}finally{rmSync(root,{recursive:true,force:true});}
}
test('production gate rejects a crash hook even in an otherwise lazy chunk',()=>fixture((root,put)=>{
  put('main.js','export const main=1;');put('lazy.js','window.dispatchEvent(new Event("gharplan-e2e-render-fault"));');assert.throws(()=>verifyWebBuild(root),/crash hook/);
}));
test('production gate follows static shared modules, excludes lazy payloads and rejects oversized initial graph',()=>fixture((root,put)=>{
  const payload='export const data="'+randomBytes(700*1024).toString('base64')+'";';
  put('main.js','import "./shared.js";import("./heavy.js");');put('shared.js','export const shared=1;');put('heavy.js',payload);
  assert.equal(verifyWebBuild(root).initialModules,2);put('shared.js','export * from "./heavy.js";');assert.throws(()=>verifyWebBuild(root),/600000-byte/);
}));
