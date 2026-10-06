import path from 'node:path';
import fs from 'node:fs/promises';
import {projectSocialIncidents} from '../functions/src/engines/socialIncidentCore.js';
const flags=new Map();
for(let i=2;i<process.argv.length;i+=2){
 if(!['--statistics','--out'].includes(process.argv[i])||!process.argv[i+1])throw Error('Usage: node scripts/review-social-incidents.mjs --statistics statistics.json [--out review.json]');
 flags.set(process.argv[i],process.argv[i+1]);
}
if(!flags.has('--statistics'))throw Error('--statistics is required');
if(flags.has('--out')){
 const input=await fs.realpath(flags.get('--statistics'));
 const output=await fs.realpath(flags.get('--out')).catch(()=>path.resolve(flags.get('--out')));
 if(input===output)throw Error('The review output must not overwrite source statistics.');
}
const statistics=JSON.parse(await fs.readFile(flags.get('--statistics'),'utf8'));
const result=projectSocialIncidents({statistics});
if(result.status!=='REVIEW_AVAILABLE')throw Error(result.reason);
const body=JSON.stringify(result,null,2)+'\n';
if(flags.has('--out'))await fs.writeFile(flags.get('--out'),body);else process.stdout.write(body);
