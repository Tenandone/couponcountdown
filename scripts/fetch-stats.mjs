import fs from 'node:fs/promises';
import {authorize,collectStats,validStats} from './ga4-stats.mjs';
const output='data/stats.json';
try{
 const token=await authorize(process.env.GA4_SERVICE_ACCOUNT_JSON);
 const stats=await collectStats(token);
 const previous=JSON.parse(await fs.readFile(output,'utf8').catch(()=>'null'));
 if(validStats(previous)&&previous.totalPageViews>0&&stats.totalPageViews===0)throw new Error('Unexpected empty lifetime report');
 await fs.mkdir('data',{recursive:true});await fs.writeFile(output+'.tmp',JSON.stringify(stats,null,2)+'\n');await fs.rename(output+'.tmp',output);
 console.log('Verified GA4 page_view aggregates saved; no credentials written.');
}catch(error){
 // Deliberately do not print API bodies, credential values or exception stacks.
 const allowed=/^(GA4_SERVICE_ACCOUNT_JSON missing|Invalid service account|GA request HTTP|Property timezone|Report timezone|Measurement ID|Property creation|Missing reports|Unexpected|Incomplete|Non-integer|Unsafe integer|Invalid stats|Access token)/;
 console.error('::error::'+(allowed.test(error.message)?error.message:'GA4 collection failed; prior stats retained'));
 process.exitCode=1;
}
