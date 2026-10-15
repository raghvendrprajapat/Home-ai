import console from 'node:console';
import {execFileSync} from 'node:child_process';
import process from 'node:process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyVersions} from './versions.mjs';
const repository=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const git=args=>execFileSync('git',args,{cwd:repository,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
let baseSha=process.env.GHARPLAN_ASSET_BASE_SHA;
if(process.env.GITHUB_ACTIONS==='true'){
  if(process.env.GITHUB_EVENT_NAME==='workflow_dispatch'&&!baseSha)baseSha=git(['rev-parse','HEAD^']);
  if(!baseSha)throw Error('catalog-CI-baseline-required');
}else if(!baseSha)baseSha=git(['rev-parse','--verify','refs/remotes/origin/main^{commit}']);
console.log(JSON.stringify(await verifyVersions({repository,baseSha})));
