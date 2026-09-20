import fs from 'node:fs/promises';
import {assets,mergeQuote,validQuote} from '../src/markets/data.mjs';
import {collect} from '../src/markets/providers.mjs';

const file='data/markets/latest.json';
const previous=JSON.parse(await fs.readFile(file,'utf8').catch(()=>'{}'));
const config=JSON.parse(await fs.readFile('data/markets/providers.json','utf8'));
const now=new Date();
const items=[];
// Serial calls keep the prototype comfortably below public API fair-use limits.
for (const asset of assets) {
  let candidate;
  try {
    candidate=await collect(asset,process.env,config,fetch,now);
    if (!validQuote(candidate,now.getTime())) throw new Error('Invalid normalized quote');
  } catch (error) {
    // Only our known error classifications enter logs, never provider payloads.
    const reason=/^(Provider HTTP \d+|Index display license, credentials or verified instrument mapping not configured|Invalid normalized quote)$/.test(error.message) ? error.message : 'Provider fetch or validation failed';
    console.warn(`::warning::${asset.slug}: ${reason}; retaining last good quote`);
  }
  const result=mergeQuote(asset,previous.items?.find(x=>x.slug===asset.slug),candidate,now.toISOString());
  items.push(result);
  console.log(`${asset.slug}: ${result.status}, observation ${result.updatedAt || 'none'}`);
}
await fs.mkdir('data/markets',{recursive:true});
await fs.writeFile(file+'.tmp',JSON.stringify({schemaVersion:1,generatedAt:now.toISOString(),items},null,2)+'\n');
await fs.rename(file+'.tmp',file);
