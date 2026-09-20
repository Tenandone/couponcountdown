import fs from 'node:fs/promises';
import {assets} from '../src/markets/data.mjs';
import {completedWeek,fetchWeeklyAsset,assembleWeekly} from '../src/markets/weekly.mjs';
import {collectContext} from '../src/markets/weekly-sources.mjs';
const now=new Date(),week=completedWeek(now),file=`data/markets/weeks/${week.id}.json`;
const previous=JSON.parse(await fs.readFile(file,'utf8').catch(()=>'null'));
if(previous?.usable&&!process.argv.includes('--refresh')&&process.env.MARKETS_REFRESH!=='true'){
 console.log(`Weekly edition ${week.id} already exists; zero provider requests. Use --refresh for a correction.`);process.exit(0);
}
const items=[];
for(const asset of assets){
 try{items.push({...await fetchWeeklyAsset(asset,week),slug:asset.slug});}
 catch{console.warn(`::warning::${asset.slug}: weekly data unavailable; no cross-week substitution`);}
}
const context=await collectContext(week,previous);
const report=assembleWeekly(week,items,context,previous,now.toISOString());
if(!report.usable){console.warn('::warning::No usable weekly data; previous published edition retained');process.exit(0);}
await fs.mkdir('data/markets/weeks',{recursive:true});
await fs.writeFile(file+'.tmp',JSON.stringify(report,null,2)+'\n');await fs.rename(file+'.tmp',file);
const indexFile='data/markets/weekly-index.json';
const index=JSON.parse(await fs.readFile(indexFile,'utf8').catch(()=>'{}'));
const weeks=[...new Set([...(index.weeks||[]),week.id])].sort().reverse();
await fs.writeFile(indexFile+'.tmp',JSON.stringify({schemaVersion:2,latest:weeks[0],weeks},null,2)+'\n');await fs.rename(indexFile+'.tmp',indexFile);
console.log(`Weekly edition ${week.id}: ${report.items.filter(x=>x.status!=='pending').length}/7 assets, ${report.issues.length} verified releases, ${report.events.length} next-week events`);
