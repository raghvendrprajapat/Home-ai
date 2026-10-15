import console from 'node:console';
import process from 'node:process';
import {runPipeline} from './pipeline.mjs';
if(process.argv.length!==3||!['build','check'].includes(process.argv[2]))throw Error('Usage: node tools/asset-pipeline/cli.mjs build|check');
const catalog=await runPipeline({check:process.argv[2]==='check'});
console.log(JSON.stringify({mode:process.argv[2],assets:catalog.assets.length,validatorErrors:catalog.assets.reduce((n,e)=>n+e.inspection.validator.errors,0),validatorWarnings:catalog.assets.reduce((n,e)=>n+e.inspection.validator.warnings,0),rightsRecords:catalog.assets.length,delivery:'local-static',textures:0,compression:'none'}));
