import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authorize,collectStats,validStats,withGrowthCount,collectionError,safeDiagnostic} from './ga4-stats.mjs';

export async function collectAndSave({output='data/stats.json',credential=process.env.GA4_SERVICE_ACCOUNT_JSON,request=fetch,now=new Date(),sleep,clock,timeoutMs,onDiagnostic,fileSystem=fs}={}){
 const options={request,now,sleep,clock,timeoutMs,onDiagnostic};
 const token=await authorize(credential,request,now,options);
 const stats=withGrowthCount(await collectStats(token,options));
 let raw;
 try{raw=await fileSystem.readFile(output,'utf8');}catch(error){
  if(error?.code!=='ENOENT')throw collectionError('storage','STORAGE_READ');
  raw='null';
 }
 let previous;try{previous=JSON.parse(raw);}catch{throw collectionError('stats','PREVIOUS_STATS');}
 if(validStats(previous)&&previous.totalPageViews>0&&stats.totalPageViews===0)throw collectionError('stats','UNEXPECTED_ZERO');
 const temporary=output+'.tmp';
 try{
  await fileSystem.mkdir(path.dirname(output),{recursive:true});
  await fileSystem.writeFile(temporary,JSON.stringify(stats,null,2)+'\n');
  await fileSystem.rename(temporary,output);
 }catch{
  try{await fileSystem.unlink(temporary);}catch{ /* Prior JSON remains the published fallback. */ }
  throw collectionError('storage','STORAGE_WRITE');
 }
 return stats;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  await collectAndSave({onDiagnostic:({stage,code,type,summary})=>{
   if(stage==='report'&&code==='REPORT_SCHEMA')console.log(`[GA4:report:REPORT_SCHEMA] ${summary}`);
   if(stage==='report'&&code==='METRIC_TYPE'&&['TYPE_INTEGER','TYPE_FLOAT'].includes(type))console.log(`[GA4:report:METRIC_TYPE] ${type}`);
  }});
  console.log('Verified GA4 page_view aggregates saved; no credentials written.');
 }catch(error){
  // No API bodies, credentials, exception stacks or arbitrary messages in logs.
  console.error('::error::'+safeDiagnostic(error));
  process.exitCode=1;
 }
}
