import fs from 'node:fs/promises';
import {assets} from '../src/markets/data.mjs';
import {snapshotWeek,completedWeek,fetchWeeklyAsset,assembleWeekly} from '../src/markets/weekly.mjs';
import {collectContext} from '../src/markets/weekly-sources.mjs';
const read=async p=>{try{return JSON.parse(await fs.readFile(p,'utf8'));}catch{return null;}};
const now=new Date(),week=snapshotWeek(now),file=`data/markets/weeks/${week.id}.json`,indexFile='data/markets/weekly-index.json';
const index=await read(indexFile)||{},previous=await read(file);
const editions=await Promise.all((index.weeks||[]).map(id=>read(`data/markets/weeks/${id}.json`)));
const compatible=editions.filter(r=>r?.schemaVersion===3).sort((a,b)=>b.week.id.localeCompare(a.week.id));
const lastGood=previous?.schemaVersion===3?previous:compatible[0]||null;
if(previous?.schemaVersion===3&&previous.usable&&!process.argv.includes('--refresh')&&process.env.MARKETS_REFRESH!=='true'){console.log(`Snapshot ${week.id} cached; zero provider requests`);process.exit(0);}
const items=[];
for(const a of assets.filter(a=>a.assetType!=='index')){try{items.push({...await fetchWeeklyAsset(a,week,{},fetch,now),slug:a.slug});}catch{console.warn(`::warning::${a.slug}: collection failed; preserving last normal snapshot`);}await new Promise(r=>setTimeout(r,1100));}
const contextWeek=completedWeek(now),context=await collectContext(contextWeek,null);context.week=contextWeek;context.events=context.events.filter(e=>e.date>=now.toISOString().slice(0,10));
const report=assembleWeekly(week,items,context,lastGood,now.toISOString());
if(!report.publishable){console.warn('::warning::Insufficient fresh data: last edition retained and marked stale');if(lastGood){const oldFile=`data/markets/weeks/${lastGood.week.id}.json`;const retained={...lastGood,lastAttemptAt:now.toISOString(),items:lastGood.items.map(q=>q.price?{...q,status:'stale'}:q)};await fs.writeFile(oldFile+'.tmp',JSON.stringify(retained,null,2)+'\n');await fs.rename(oldFile+'.tmp',oldFile);}process.exit(0);}
await fs.mkdir('data/markets/weeks',{recursive:true});await fs.writeFile(file+'.tmp',JSON.stringify(report,null,2)+'\n');await fs.rename(file+'.tmp',file);
const weeks=[...new Set([...compatible.map(r=>r.week.id),week.id])].sort().reverse();
await fs.writeFile(indexFile+'.tmp',JSON.stringify({schemaVersion:3,latest:weeks[0],weeks},null,2)+'\n');await fs.rename(indexFile+'.tmp',indexFile);
console.log(JSON.stringify(report.items.filter(q=>q.price).map(({asset,price,previousPrice,changePercent,collectedAt,observedAt,status})=>({asset,price,previousPrice,changePercent,collectedAt,observedAt,status})),null,2));
