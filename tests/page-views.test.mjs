import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {JSDOM} from 'jsdom';
import {collectStats,count,kstDate,query} from '../scripts/ga4-stats.mjs';
import {formatViews,usableStats,loadViews} from '../public/page-views.mjs';
import {viewCounter} from '../src/page-views.mjs';
const now=new Date('2026-09-21T05:00:00Z');
const report=n=>({metricHeaders:[{name:'eventCount',type:'TYPE_INTEGER'}],metadata:{timeZone:'Asia/Seoul'},rowCount:1,rows:[{metricValues:[{value:String(n)}]}]});
const fixture={totalPageViews:12841,todayPageViews:438,updatedAt:'2026-09-21T14:00:00+09:00',reportingDate:'2026-09-21',source:'GA4',metric:'page_view',propertyTimeZone:'Asia/Seoul'};
test('GA report counts only production page_view events and uses KST date boundaries',async()=>{
 const calls=[];const responses=[{timeZone:'Asia/Seoul',createTime:'2025-01-01T16:00:00Z'},{dataStreams:[{webStreamData:{measurementId:'G-1TS6F1NK5K'}}]},{reports:[report(12841),report(438)]}];
 const actual=await collectStats('test-token',{now,request:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>responses.shift()};}});
 assert.equal(actual.totalPageViews,12841);assert.equal(actual.todayPageViews,438);assert.equal(actual.totalStartDate,'2025-01-02');assert.equal(actual.updatedAt,fixture.updatedAt);
 const body=JSON.parse(calls[2].options.body);assert.deepEqual(body.requests,[query('2025-01-02','2026-09-21'),query('2026-09-21','2026-09-21')]);
 assert.equal(body.requests[0].dimensionFilter.andGroup.expressions[0].filter.stringFilter.value,'page_view');assert.deepEqual(body.requests[0].dimensionFilter.andGroup.expressions[1].filter.inListFilter.values,['couponcountdown.com','www.couponcountdown.com']);
 assert.equal(kstDate(new Date('2026-09-20T15:00:00Z')),'2026-09-21');assert.ok(!JSON.stringify(actual).includes('test-token'));
});
test('incomplete reports and non-KST properties fail closed',async()=>{
 await assert.rejects(collectStats('test',{request:async()=>({ok:true,json:async()=>({timeZone:'America/New_York'})})}),/timezone/);
 for(const metadata of [{timeZone:'UTC'},{timeZone:'Asia/Seoul',subjectToThresholding:true},{timeZone:'Asia/Seoul',samplingMetadatas:[{}]}])assert.throws(()=>count({...report(2),metadata}));
 assert.throws(()=>count(report(-1)));assert.throws(()=>count(report(1.5)));assert.equal(count({...report(0),rows:[],rowCount:0}),0);
});
test('failed credential lookup preserves last good JSON byte for byte and creates no initial placeholder',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cc-stats-'));try{
  const script=path.resolve('scripts/fetch-stats.mjs');const run=()=>spawnSync(process.execPath,[script],{cwd:dir,env:{...process.env,GA4_SERVICE_ACCOUNT_JSON:''},encoding:'utf8'});
  assert.equal(run().status,1);await assert.rejects(fs.access(path.join(dir,'data/stats.json')));
  await fs.mkdir(path.join(dir,'data'));const original=JSON.stringify(fixture);await fs.writeFile(path.join(dir,'data/stats.json'),original);
  assert.equal(run().status,1);assert.equal(await fs.readFile(path.join(dir,'data/stats.json'),'utf8'),original);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('formatting boundaries, stale cutoff and KST midnight prevent incorrect today display',()=>{
 for(const [n,expected] of [[0,'0'],[999,'999'],[1000,'1K'],[12841,'12.8K'],[999999,'999.9K'],[1000000,'1M']])assert.equal(formatViews(n,'en'),expected);
 assert.equal(formatViews(12841,'es-ES'),'12,8K');assert.ok(usableStats(fixture,+now));assert.ok(!usableStats(fixture,+now+4*3600000));assert.ok(!usableStats({...fixture,reportingDate:'2026-09-20'},+now));assert.ok(!usableStats({...fixture,todayPageViews:null},+now));
});
test('all eight locales render real-response values, KST timestamp, and hide on failed fetch',async()=>{
 for(const locale of ['ko','en','ja','zh-tw','es-419','es-es','pt-br','ru']){
  const dom=new JSDOM(viewCounter(locale));try{const el=dom.window.document.querySelector('[data-page-views]');assert.ok(!el.textContent.includes('12841'));
   await loadViews(el,{now:+now,locale,request:async()=>({ok:true,json:async()=>fixture})});assert.equal(el.dataset.state,'ready');assert.ok(el.textContent.includes('438'));assert.ok(el.textContent.includes('KST'));
   await loadViews(el,{now:+now,locale,request:async()=>{throw new Error('offline');}});assert.equal(el.dataset.state,'unavailable');assert.equal(el.getAttribute('aria-hidden'),'true');
  }finally{dom.window.close();}
 }
});
test('each full-page navigation initializes page_view once; redirect stubs never initialize GA',async()=>{
 const source=await fs.readFile('public/site.js','utf8');
 for(const route of ['ko/','en/','en/games/tiles-survive/','en/markets/','en/markets/bitcoin/','en/markets/weeks/2026-09-21/']){
  const dom=new JSDOM(await fs.readFile('dist/'+route+'index.html','utf8'),{url:'https://couponcountdown.com/'+route,runScripts:'outside-only'});try{
   const w=dom.window;w.matchMedia=()=>({matches:true});w.localStorage.setItem('cc-consent',JSON.stringify('yes'));w.eval(source);
   w.document.querySelector('[data-consent="yes"]')?.click();
   assert.equal(w.dataLayer.filter(x=>x[0]==='config'&&x[2].send_page_view===true).length,1,route);assert.equal(w.dataLayer.filter(x=>x[0]==='event'&&x[1]==='page_view').length,0,route);
  }finally{dom.window.close();}
 }
 for(const route of ['','wos/','kingshot/'])assert.ok(!(await fs.readFile('dist/'+route+'index.html','utf8')).includes('data-ga='));
});
