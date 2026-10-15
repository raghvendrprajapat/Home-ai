import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {assertImmutable} from './pipeline.mjs';

export async function verifyVersions({repository,baseSha,catalogPath='apps/web/public/catalog/catalog.json'}) {
  if(!/^[a-f0-9]{40}$/.test(baseSha))throw Error('catalog-baseline-sha');
  const git=args=>execFileSync('git',args,{cwd:repository,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  git(['cat-file','-e',`${baseSha}^{commit}`]);
  const current=JSON.parse(await readFile(resolve(repository,catalogPath),'utf8'));
  if(!git(['ls-tree',baseSha,'--',catalogPath]).trim())return {baseSha,historicalVersions:0};
  const previous=JSON.parse(git(['show',`${baseSha}:${catalogPath}`]));assertImmutable(previous,current);
  return {baseSha,historicalVersions:previous.assets.length};
}
