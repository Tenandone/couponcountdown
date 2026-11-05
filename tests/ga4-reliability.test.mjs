import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {generateKeyPairSync} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {authorize,collectStats,count,dailyQuery,query,requestJSON,safeDiagnostic,verifyDailyReport,withGrowthCount} from '../scripts/ga4-stats.mjs';
import {collectAndSave} from '../scripts/fetch-stats.mjs';

// Synthetic credentials only. Every request and retry delay is replaced by a fixture.
const NOW=new Date('2026-11-05T15:00:00.000Z');
const CANARY='DO_NOT_LOG_RAW_GA_RESPONSE_4a3c78';
const TOKEN='fixture-bearer-secret-83f6ea';
const EMAIL='fixture-private-account@example.invalid';
const PRIVATE_KEY=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'});
const CREDENTIAL=JSON.stringify({type:'service_account',client_email:EMAIL,private_key:PRIVATE_KEY});
const MALFORMED_EMPTY_ROWS=[['object',{}],['boolean',false],['empty-string',''],['array-like',{length:0}]];
const OVERSIZED_RETRY=[['seconds','120'],['http-date',new Date(+NOW+11000).toUTCString()],['huge-seconds','9'.repeat(400)]];
const PRIOR={source:'GA4',metric:'page_view',propertyTimeZone:'Asia/Seoul',totalPageViews:125,todayPageViews:4,actualPageViews:125,displayGrowthCount:125000,updatedAt:'2026-11-05T23:00:00+09:00',reportingDate:'2026-11-05'};
const PRIOR_BYTES=JSON.stringify(PRIOR,null,3)+'\n\n';
const noSleep=async()=>{};
const metric=(value,type='TYPE_INTEGER')=>({metricHeaders:[{name:'eventCount',type}],metadata:{timeZone:'Asia/Seoul'},rowCount:1,rows:[{metricValues:[{value:String(value)}]}]});
const ok=value=>({ok:true,status:200,headers:new Headers(),json:async()=>value});
const failed=(status,retryAfter)=>({ok:false,status,headers:new Headers(retryAfter===undefined?{}:{'Retry-After':retryAfter}),json:async()=>{throw new Error(CANARY);},text:async()=>CANARY});
const responses=(total=126,today=0)=>({oauth:{access_token:TOKEN},property:{timeZone:'Asia/Seoul',createTime:'2025-01-01T16:00:00Z'},streams:{dataStreams:[{webStreamData:{measurementId:'G-1TS6F1NK5K'}}]},report:{reports:[metric(total,'TYPE_FLOAT'),metric(today,'TYPE_FLOAT')]}});
const stageOf=url=>url.includes('oauth2.googleapis.com')?'oauth':url.includes('dataStreams')?'streams':url.includes(':batchRunReports')?'report':url.includes(':runReport')?'daily':'property';
const dailyReport=rows=>({dimensionHeaders:[{name:'date'}],metricHeaders:[{name:'eventCount',type:'TYPE_FLOAT'}],metadata:{timeZone:'Asia/Seoul'},rowCount:rows.length,rows:rows.map(([date,value])=>({dimensionValues:[{value:date}],metricValues:[{value:String(value)}]}))});
function fixtureRequest({stage,reply,values=responses(),calls=[]}={}){
 return async(url,options)=>{const current=stageOf(url);calls.push({stage:current,url,options});return current===stage?reply(url,options):ok(values[current]);};
}
function noLeaks(value,extra=[]){
 const text=String(value);
 for(const forbidden of [CANARY,TOKEN,'Bearer '+TOKEN,EMAIL,PRIVATE_KEY,PRIVATE_KEY.split('\n')[1],...extra])assert.ok(!text.includes(forbidden),'Diagnostic exposed a synthetic secret or response body');
}
async function rejection(action){let error;try{await action();}catch(e){error=e;}assert.ok(error instanceof Error,'Expected collection failure');return error;}
async function temporary(action){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cc-ga4-reliability-'));try{return await action(dir);}finally{await fs.rm(dir,{recursive:true,force:true});}}

test('eventCount accepts exactly integral TYPE_FLOAT and TYPE_INTEGER values without rounding',()=>{
 for(const type of ['TYPE_INTEGER','TYPE_FLOAT']){
  for(const [raw,expected] of [['0',0],['0.0',0],['12',12],['12.0',12],['12.0000',12],['9007199254740991',Number.MAX_SAFE_INTEGER],['9007199254740991.0',Number.MAX_SAFE_INTEGER]])assert.equal(count(metric(raw,type)),expected,type+' '+raw);
  for(const raw of ['12.5','12.0000000000000001','9007199254740991.1','9007199254740990.9','9007199254740992','9007199254740993.0','-1','-0','1e3','NaN','Infinity',' 12','12 ','12.','','.0'])assert.throws(()=>count(metric(raw,type)),undefined,type+' '+raw);
 }
});

test('float metric support retains schema, metadata and empty-report safeguards',()=>{
 for(const type of ['TYPE_FLOAT','TYPE_INTEGER'])assert.equal(count({...metric(0,type),rows:[],rowCount:0}),0);
 for(const type of ['TYPE_CURRENCY','TYPE_SECONDS',undefined])assert.throws(()=>count({...metric(12),metricHeaders:[{name:'eventCount',type}]}));
 for(const patch of [{metricHeaders:[{name:'sessions',type:'TYPE_FLOAT'}]},{metadata:{timeZone:'UTC'}},{metadata:{timeZone:'Asia/Seoul',subjectToThresholding:true}},{metadata:{timeZone:'Asia/Seoul',dataLossFromOtherRow:true}},{metadata:{timeZone:'Asia/Seoul',samplingMetadatas:[{}]}},{rowCount:2},{rows:[]}])assert.throws(()=>count({...metric('12.0','TYPE_FLOAT'),...patch}));
});

test('only omitted, null or array rows can represent a genuine zero aggregate',()=>{
 for(const type of ['TYPE_INTEGER','TYPE_FLOAT'])for(const rowCount of [0,undefined]){
  for(const rows of [undefined,null,[]]){
   const report={...metric(0,type),rowCount,rows};if(rows===undefined)delete report.rows;if(rowCount===undefined)delete report.rowCount;
   assert.equal(count(report),0);
  }
  for(const [label,rows]of MALFORMED_EMPTY_ROWS){
   const report={...metric(0,type),rowCount,rows};if(rowCount===undefined)delete report.rowCount;
   assert.throws(()=>count(report),error=>error.code==='REPORT_ROWS',type+' '+label);
  }
 }
});

test('transient HTTP errors use at most three total attempts and successful retry stops immediately',async t=>{
 for(const status of [429,500,502,503,504])await t.test(String(status),async()=>{
  let attempts=0;const delays=[];
  const result=await requestJSON('https://fixture.invalid/report',{}, {stage:'report',request:async()=>++attempts<3?failed(status):ok({value:12}),sleep:async ms=>delays.push(ms)});
  assert.deepEqual(result,{value:12});assert.equal(attempts,3);assert.deepEqual(delays,[1000,2000]);
 });
 let attempts=0;const delays=[];
 assert.deepEqual(await requestJSON('https://fixture.invalid/report',{}, {stage:'report',request:async()=>++attempts===1?failed(503):ok({value:1}),sleep:async ms=>delays.push(ms)}),{value:1});
 assert.equal(attempts,2);assert.deepEqual(delays,[1000]);
});

test('persistent transient failure is bounded and never reads or leaks the HTTP body',async()=>{
 let attempts=0,bodyReads=0;const delays=[];
 const error=await rejection(()=>requestJSON('https://fixture.invalid/report',{}, {stage:'report',request:async()=>{attempts++;return {...failed(503),json:async()=>{bodyReads++;throw new Error(CANARY);},text:async()=>{bodyReads++;return CANARY;}};},sleep:async ms=>delays.push(ms)}));
 assert.equal(attempts,3);assert.deepEqual(delays,[1000,2000]);assert.equal(bodyReads,0);assert.match(safeDiagnostic(error),/report/i);noLeaks(safeDiagnostic(error));
});

test('permanent HTTP failures are not retried, including authentication and permission failures',async t=>{
 for(const status of [400,401,403,404,501])await t.test(String(status),async()=>{
  let attempts=0;const delays=[];
  const error=await rejection(()=>requestJSON('https://fixture.invalid/property',{}, {stage:'property',request:async()=>{attempts++;return failed(status,'10');},sleep:async ms=>delays.push(ms)}));
  assert.equal(attempts,1);assert.deepEqual(delays,[]);assert.match(safeDiagnostic(error),/property/i);noLeaks(safeDiagnostic(error));
 });
});

test('Retry-After seconds and HTTP dates are respected within the bounded retry policy',async t=>{
 for(const [header,expected] of [['1',1000],['5',5000],['10',10000],[new Date(+NOW+6000).toUTCString(),6000],['invalid',1000]])await t.test(header,async()=>{
  let attempts=0;const delays=[];
  await requestJSON('https://fixture.invalid/report',{}, {stage:'report',clock:()=>+NOW,request:async()=>++attempts===1?failed(429,header):ok({}),sleep:async ms=>delays.push(ms)});
  assert.equal(attempts,2);assert.deepEqual(delays,[expected]);
 });
});

test('Retry-After beyond ten seconds fails closed instead of retrying before the server permits it',async t=>{
 for(const [label,header]of OVERSIZED_RETRY)await t.test(label,async()=>{
  for(const status of [429,503]){
   let attempts=0;const delays=[];
   const error=await rejection(()=>requestJSON('https://fixture.invalid/report',{}, {stage:'report',clock:()=>+NOW,request:async()=>{attempts++;return failed(status,header);},sleep:async ms=>delays.push(ms)}));
   assert.equal(attempts,1);assert.deepEqual(delays,[]);assert.equal(error.code,'RETRY_DELAY_LIMIT');assert.match(safeDiagnostic(error),/GA4:report:RETRY_DELAY_LIMIT/);noLeaks(safeDiagnostic(error));
  }
 });
});

test('fetch network errors recover once and do not echo cause messages or request credentials',async()=>{
 let attempts=0;const delays=[];const headers={Authorization:'Bearer '+TOKEN};
 const result=await requestJSON('https://fixture.invalid/report',{headers}, {stage:'report',request:async(_url,options)=>{assert.equal(options.headers.Authorization,'Bearer '+TOKEN);if(++attempts===1)throw new TypeError('fetch failed',{cause:new Error(CANARY+' '+PRIVATE_KEY)});return ok({done:true});},sleep:async ms=>delays.push(ms)});
 assert.deepEqual(result,{done:true});assert.equal(attempts,2);assert.deepEqual(delays,[1000]);
});

test('network and abort failures exhaust exactly three attempts with sanitized stage diagnostics',async t=>{
 for(const kind of ['TypeError','ECONNRESET','AbortError','TimeoutError'])await t.test(kind,async()=>{
  let attempts=0;const delays=[];
  const error=await rejection(()=>requestJSON('https://fixture.invalid/streams',{}, {stage:'streams',request:async()=>{attempts++;const error=kind==='TypeError'?new TypeError('fetch failed',{cause:new Error(CANARY+' '+PRIVATE_KEY)}):new Error(CANARY+' '+PRIVATE_KEY);if(kind==='ECONNRESET')error.code=kind;else if(kind!=='TypeError')error.name=kind;throw error;},sleep:async ms=>delays.push(ms)}));
  assert.equal(attempts,3);assert.deepEqual(delays,[1000,2000]);assert.match(safeDiagnostic(error),/streams/i);noLeaks(safeDiagnostic(error));
 });
});

test('TLS and certificate causes are permanent even when fetch wraps them in TypeError',async t=>{
 for(const code of ['CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE'])await t.test(code,async()=>{
  let attempts=0;const delays=[];
  const error=await rejection(()=>requestJSON('https://fixture.invalid/property',{}, {stage:'property',request:async()=>{attempts++;throw new TypeError('fetch failed',{cause:Object.assign(new Error(CANARY+' '+PRIVATE_KEY),{code})});},sleep:async ms=>delays.push(ms)}));
  assert.equal(attempts,1);assert.deepEqual(delays,[]);assert.match(safeDiagnostic(error),/property/i);noLeaks(safeDiagnostic(error));
 });
});

test('unrecognized exceptions and malformed JSON fail once without prefix-based message trust',async t=>{
 for(const mode of ['request','json'])await t.test(mode,async()=>{
  let attempts=0;const delays=[];
  const error=await rejection(()=>requestJSON('https://fixture.invalid/report',{}, {stage:'report',request:async()=>{attempts++;if(mode==='request')throw new Error('GA request HTTP 400 '+CANARY+' '+TOKEN);return {...ok({}),json:async()=>{throw new SyntaxError(CANARY+' '+TOKEN);}};},sleep:async ms=>delays.push(ms)}));
  assert.equal(attempts,1);assert.deepEqual(delays,[]);noLeaks(safeDiagnostic(error));
 });
 for(const prefix of ['GA request HTTP','Invalid service account','Property timezone','Unexpected','Access token'])noLeaks(safeDiagnostic(new Error(prefix+' '+CANARY+' '+TOKEN+' '+PRIVATE_KEY)));
 noLeaks(safeDiagnostic(Object.assign(new Error(CANARY),{stage:'oauth',code:'HTTP_401',message:CANARY})));
});

test('request timeout covers a hung fetch and a hung JSON body with bounded attempts',async t=>{
 for(const phase of ['fetch','json'])await t.test(phase,async()=>{
  let attempts=0;const delays=[];const signals=[];
  // Keep one inert handle alive because AbortSignal.timeout may use an unref timer.
  const keeper=setInterval(()=>{},1000);
  try{
   const error=await rejection(()=>requestJSON('https://fixture.invalid/report',{}, {stage:'report',timeoutMs:5,request:async(_url,options)=>{attempts++;signals.push(options.signal);return phase==='fetch'?new Promise(()=>{}):{...ok({}),json:()=>new Promise(()=>{})};},sleep:async ms=>delays.push(ms)}));
   assert.equal(attempts,3);assert.deepEqual(delays,[1000,2000]);assert.ok(signals.every(s=>s.aborted));assert.equal(new Set(signals).size,3);assert.match(safeDiagnostic(error),/report/i);noLeaks(safeDiagnostic(error));
  }finally{clearInterval(keeper);}
 });
});

test('OAuth stage supports retries while the JWT, account email and key remain private',async()=>{
 let attempts=0;const delays=[];let assertion;
 const token=await authorize(CREDENTIAL,async(url,options)=>{assert.equal(url,'https://oauth2.googleapis.com/token');assert.equal(options.method,'POST');assertion=options.body.get('assertion');assert.equal(assertion.split('.').length,3);return ++attempts===1?failed(503):ok({access_token:TOKEN});},NOW,{sleep:async ms=>delays.push(ms)});
 assert.equal(token,TOKEN);assert.equal(attempts,2);assert.deepEqual(delays,[1000]);
 const error=await rejection(()=>authorize(CREDENTIAL,async()=>failed(401),NOW,{sleep:noSleep}));assert.match(safeDiagnostic(error),/oauth/i);noLeaks(safeDiagnostic(error),[assertion]);
 for(const credential of ['',CANARY,JSON.stringify({type:'service_account',client_email:EMAIL,private_key:CANARY})]){
  let calls=0;const failure=await rejection(()=>authorize(credential,async()=>{calls++;throw new Error('Unexpected network');},NOW,{sleep:noSleep}));assert.equal(calls,0);noLeaks(safeDiagnostic(failure));
 }
 const missing=await rejection(()=>authorize(CREDENTIAL,async()=>ok({error_description:CANARY}),NOW,{sleep:noSleep}));noLeaks(safeDiagnostic(missing));assert.match(safeDiagnostic(missing),/oauth/i);
});

test('property, streams and report failure stages remain distinguishable and sanitized',async t=>{
 for(const stage of ['property','streams','report'])await t.test(stage,async()=>{
  const calls=[];const error=await rejection(()=>collectStats(TOKEN,{now:NOW,request:fixtureRequest({stage,reply:async()=>failed(403),calls}),sleep:noSleep}));
  assert.equal(calls.filter(c=>c.stage===stage).length,1);assert.equal(calls.at(-1).stage,stage);assert.match(safeDiagnostic(error),new RegExp(stage,'i'));noLeaks(safeDiagnostic(error));
 });
});

test('successful collection after retry preserves KST, production filters and growth multiplier',async()=>{
 const calls=[],delays=[];let reportAttempts=0;
 const raw=await collectStats(TOKEN,{now:NOW,clock:()=>+NOW,sleep:async ms=>delays.push(ms),request:fixtureRequest({stage:'report',reply:async()=>++reportAttempts===1?failed(503):ok(responses('126.0','0.0').report),calls})});
 assert.equal(calls.length,4);assert.equal(reportAttempts,2);assert.deepEqual(delays,[1000]);assert.equal(raw.totalPageViews,126);assert.equal(raw.todayPageViews,0);assert.equal(raw.reportingDate,'2026-11-06');assert.equal(raw.updatedAt,'2026-11-06T00:00:00+09:00');assert.equal(raw.totalStartDate,'2025-01-02');
 const expected={dateRanges:[{startDate:'2025-01-02',endDate:'2026-11-06'}],metrics:[{name:'eventCount'}],dimensionFilter:{andGroup:{expressions:[{filter:{fieldName:'eventName',stringFilter:{matchType:'EXACT',value:'page_view',caseSensitive:true}}},{filter:{fieldName:'hostName',inListFilter:{values:['couponcountdown.com','www.couponcountdown.com'],caseSensitive:false}}}]}},keepEmptyRows:false,returnPropertyQuota:true};
 assert.deepEqual(query('2025-01-02','2026-11-06'),expected);assert.deepEqual(JSON.parse(calls.at(-1).options.body).requests,[expected,{...expected,dateRanges:[{startDate:'2026-11-06',endDate:'2026-11-06'}]}]);
 const grown=withGrowthCount(raw);assert.equal(grown.actualPageViews,126);assert.equal(grown.displayGrowthCount,126000);assert.equal(grown.todayPageViews,0);noLeaks(JSON.stringify(grown));
});

test('all failed collection stages preserve existing output bytes and create no initial placeholder',async t=>{
 const cases=[{name:'credentials',credential:CANARY},{name:'oauth',stage:'oauth'},{name:'property',stage:'property'},{name:'streams',stage:'streams'},{name:'report',stage:'report'},{name:'fractional-report',values:responses('12.5',0)},{name:'rounded-unsafe-report',values:responses('9007199254740991.1',0)},{name:'growth-overflow',values:responses('9007199254740991',0)},{name:'today-exceeds-total',values:responses(1,2)},{name:'non-KST-property',values:{...responses(),property:{timeZone:'UTC',createTime:'2025-01-01T00:00:00Z'}}},{name:'wrong-stream',values:{...responses(),streams:{dataStreams:[{webStreamData:{measurementId:CANARY}}]}}}];
 for(const entry of cases)await t.test(entry.name,()=>temporary(async dir=>{
  const output=path.join(dir,'data','stats.json');const calls=[];const request=fixtureRequest({stage:entry.stage,reply:async()=>failed(403),values:entry.values,calls});
  const invoke=()=>collectAndSave({output,credential:entry.credential??CREDENTIAL,request,now:NOW,sleep:noSleep,clock:()=>+NOW});
  let error=await rejection(invoke);noLeaks(safeDiagnostic(error));await assert.rejects(fs.access(output));await assert.rejects(fs.access(output+'.tmp'));
  await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,PRIOR_BYTES);
  error=await rejection(invoke);noLeaks(safeDiagnostic(error));assert.equal(await fs.readFile(output,'utf8'),PRIOR_BYTES);await assert.rejects(fs.access(output+'.tmp'));
 }));
});

test('a positive all-time count cannot be replaced with zero, while genuine zero today saves',()=>temporary(async dir=>{
 const output=path.join(dir,'stats.json');await fs.writeFile(output,PRIOR_BYTES);
 const error=await rejection(()=>collectAndSave({output,credential:CREDENTIAL,request:fixtureRequest({values:responses(0,0)}),now:NOW,sleep:noSleep}));noLeaks(safeDiagnostic(error));assert.equal(await fs.readFile(output,'utf8'),PRIOR_BYTES);await assert.rejects(fs.access(output+'.tmp'));
 await collectAndSave({output,credential:CREDENTIAL,request:fixtureRequest({values:responses('126.0','0.0')}),now:NOW,sleep:noSleep});
 const saved=JSON.parse(await fs.readFile(output,'utf8'));assert.equal(saved.totalPageViews,126);assert.equal(saved.actualPageViews,126);assert.equal(saved.displayGrowthCount,126000);assert.equal(saved.todayPageViews,0);assert.equal(saved.updatedAt,'2026-11-06T00:00:00+09:00');noLeaks(JSON.stringify(saved));await assert.rejects(fs.access(output+'.tmp'));
}));

test('malformed empty today rows cannot overwrite valid prior stats with an invented zero',async t=>{
 for(const [label,rows]of MALFORMED_EMPTY_ROWS)await t.test(label,()=>temporary(async dir=>{
  const output=path.join(dir,'stats.json');await fs.writeFile(output,PRIOR_BYTES);
  const values=responses(126,0);values.report.reports[1]={...metric(0,'TYPE_FLOAT'),rowCount:0,rows};
  const error=await rejection(()=>collectAndSave({output,credential:CREDENTIAL,request:fixtureRequest({values}),now:NOW,sleep:noSleep}));
  assert.equal(error.code,'REPORT_ROWS');noLeaks(safeDiagnostic(error));assert.equal(await fs.readFile(output,'utf8'),PRIOR_BYTES);await assert.rejects(fs.access(output+'.tmp'));
 }));
});

test('genuine empty today rows still save zero for a valid positive lifetime count',async t=>{
 for(const [label,rows]of [['omitted',undefined],['null',null],['array',[]]])await t.test(label,()=>temporary(async dir=>{
  const output=path.join(dir,'stats.json');await fs.writeFile(output,PRIOR_BYTES);
  const values=responses(126,0);values.report.reports[1]={...metric(0,'TYPE_FLOAT'),rowCount:0,rows};if(rows===undefined)delete values.report.reports[1].rows;
  await collectAndSave({output,credential:CREDENTIAL,request:fixtureRequest({values}),now:NOW,sleep:noSleep});
  const saved=JSON.parse(await fs.readFile(output,'utf8'));assert.equal(saved.totalPageViews,126);assert.equal(saved.todayPageViews,0);assert.equal(saved.displayGrowthCount,126000);noLeaks(JSON.stringify(saved));
 }));
});

test('oversized Retry-After preserves the last good file without waiting or issuing a second report',async t=>{
 for(const [label,header]of OVERSIZED_RETRY)await t.test(label,()=>temporary(async dir=>{
  const output=path.join(dir,'stats.json');await fs.writeFile(output,PRIOR_BYTES);const calls=[],delays=[];
  const request=fixtureRequest({stage:'report',reply:async()=>failed(429,header),calls});
  const error=await rejection(()=>collectAndSave({output,credential:CREDENTIAL,request,now:NOW,clock:()=>+NOW,sleep:async ms=>delays.push(ms)}));
  assert.equal(error.code,'RETRY_DELAY_LIMIT');assert.equal(calls.filter(c=>c.stage==='report').length,1);assert.deepEqual(delays,[]);noLeaks(safeDiagnostic(error));assert.equal(await fs.readFile(output,'utf8'),PRIOR_BYTES);await assert.rejects(fs.access(output+'.tmp'));
 }));
});

test('storage write and rename failures retain the old JSON and sanitize the I/O error',async t=>{
 for(const operation of ['writeFile','rename'])await t.test(operation,()=>temporary(async dir=>{
  const output=path.join(dir,'stats.json');await fs.writeFile(output,PRIOR_BYTES);
  const fileSystem={...fs,[operation]:async()=>{throw new Error('Invalid service account '+CANARY+' '+PRIVATE_KEY);}};
  const error=await rejection(()=>collectAndSave({output,credential:CREDENTIAL,request:fixtureRequest(),now:NOW,sleep:noSleep,fileSystem}));
  assert.match(safeDiagnostic(error),/storage/i);noLeaks(safeDiagnostic(error));assert.equal(await fs.readFile(output,'utf8'),PRIOR_BYTES);await assert.rejects(fs.access(output+'.tmp'));
 }));
});

test('report diagnostics expose only the fixed metric-type enum, never response fields',async()=>{
 const diagnostics=[];const values=responses();values.report.reports[0].privateDetails=CANARY;values.report.reports[0].metadata.privateKey=PRIVATE_KEY;
 await collectStats(TOKEN,{now:NOW,request:fixtureRequest({values}),sleep:noSleep,onDiagnostic:value=>diagnostics.push(value)});
 assert.deepEqual(diagnostics,[
  {stage:'report',code:'REPORT_SCHEMA',summary:'LIFETIME; headers=ONE; name=EVENT_COUNT; type=TYPE_FLOAT; rows=ONE; rowCount=ONE; timezone=KST'},
  {stage:'report',code:'REPORT_SCHEMA',summary:'TODAY; headers=ONE; name=EVENT_COUNT; type=TYPE_FLOAT; rows=ONE; rowCount=ONE; timezone=KST'},
  {stage:'report',code:'METRIC_TYPE',type:'TYPE_FLOAT'}
 ]);noLeaks(JSON.stringify(diagnostics));
 const invalid=[];values.report.reports[0].metricHeaders[0].type=CANARY;
 const error=await rejection(()=>collectStats(TOKEN,{now:NOW,request:fixtureRequest({values}),sleep:noSleep,onDiagnostic:value=>invalid.push(value)}));
 assert.equal(invalid.length,2);assert.match(invalid[0].summary,/type=OTHER/);noLeaks(JSON.stringify(invalid));noLeaks(safeDiagnostic(error));
});

test('metadata-only today requires a separate daily report reconciled to the positive lifetime total',()=>temporary(async dir=>{
 const empty={metadata:{timeZone:'Asia/Seoul'}};
 assert.throws(()=>count(empty),error=>error.code==='METRIC_SCHEMA');assert.throws(()=>count(empty,{allowEmptyReport:true}),error=>error.code==='METRIC_SCHEMA');
 const output=path.join(dir,'stats.json');await fs.writeFile(output,PRIOR_BYTES);const values={...responses(126,0),daily:dailyReport([['20261105','126.0']])},diagnostics=[],calls=[];values.report.reports[1]=empty;
 await collectAndSave({output,credential:CREDENTIAL,request:fixtureRequest({values,calls}),now:NOW,sleep:noSleep,onDiagnostic:value=>diagnostics.push(value)});
 const saved=JSON.parse(await fs.readFile(output,'utf8'));assert.equal(saved.totalPageViews,126);assert.equal(saved.actualPageViews,126);assert.equal(saved.displayGrowthCount,126000);assert.equal(saved.todayPageViews,0);
 assert.equal(calls.length,5);assert.equal(calls.filter(c=>c.stage==='daily').length,1);assert.match(calls.at(-1).url,/properties\/528476729:runReport$/);assert.equal(calls.at(-1).options.method,'POST');assert.deepEqual(JSON.parse(calls.at(-1).options.body),{...query('2025-01-02','2026-11-06'),dimensions:[{name:'date'}],limit:250000});
 assert.deepEqual(diagnostics[1],{stage:'report',code:'REPORT_SCHEMA',summary:'TODAY; headers=MISSING; name=MISSING; type=MISSING; rows=MISSING; rowCount=MISSING; timezone=KST'});
 assert.deepEqual(diagnostics.filter(d=>d.code==='DAILY_RECHECK'),[{stage:'daily_report',code:'DAILY_RECHECK',result:'TODAY_ABSENT'}]);noLeaks(JSON.stringify(diagnostics));noLeaks(JSON.stringify(saved));
}));

test('metadata-only lifetime report never inherits the empty-today exception',()=>temporary(async dir=>{
 const output=path.join(dir,'stats.json');await fs.writeFile(output,PRIOR_BYTES);const values=responses(126,1);values.report.reports[0]={metadata:{timeZone:'Asia/Seoul'}};
 const error=await rejection(()=>collectAndSave({output,credential:CREDENTIAL,request:fixtureRequest({values}),now:NOW,sleep:noSleep}));
 assert.equal(error.code,'METRIC_SCHEMA');noLeaks(safeDiagnostic(error));assert.equal(await fs.readFile(output,'utf8'),PRIOR_BYTES);
}));

test('ambiguous today recheck excludes null fields, partial schemas and incomplete or non-KST metadata',async t=>{
 const cases=[
  ['headers null',r=>{r.metricHeaders=null;},'METRIC_SCHEMA'],
  ['headers empty',r=>{r.metricHeaders=[];},'METRIC_SCHEMA'],
  ['headers secret',r=>{r.metricHeaders=CANARY;},'METRIC_SCHEMA'],
  ['rows null',r=>{r.rows=null;},'METRIC_SCHEMA'],
  ['rows empty',r=>{r.rows=[];},'METRIC_SCHEMA'],
  ['rows malformed',r=>{r.rows={length:0,secret:PRIVATE_KEY};},'METRIC_SCHEMA'],
  ['rowCount null',r=>{r.rowCount=null;},'METRIC_SCHEMA'],
  ['rowCount zero',r=>{r.rowCount=0;},'METRIC_SCHEMA'],
  ['rowCount secret',r=>{r.rowCount=TOKEN;},'METRIC_SCHEMA'],
  ['metadata omitted',r=>{delete r.metadata;},'REPORT_TIMEZONE'],
  ['metadata null',r=>{r.metadata=null;},'REPORT_TIMEZONE'],
  ['timezone UTC',r=>{r.metadata.timeZone='UTC';},'REPORT_TIMEZONE'],
  ['timezone secret',r=>{r.metadata.timeZone=CANARY;},'REPORT_TIMEZONE'],
  ['thresholded',r=>{r.metadata.subjectToThresholding=true;},'REPORT_INCOMPLETE'],
  ['sampled',r=>{r.metadata.samplingMetadatas=[{secret:PRIVATE_KEY}];},'REPORT_INCOMPLETE'],
  ['data loss',r=>{r.metadata.dataLossFromOtherRow=true;},'REPORT_INCOMPLETE'],
 ];
 for(const [label,change,code]of cases)await t.test(label,()=>temporary(async dir=>{
  const output=path.join(dir,'stats.json');await fs.writeFile(output,PRIOR_BYTES);const empty={metadata:{timeZone:'Asia/Seoul'}};change(empty);
  assert.throws(()=>count(empty),error=>error.code===code);
  const values=responses(126,1),diagnostics=[],calls=[];values.report.reports[1]=empty;
  const error=await rejection(()=>collectAndSave({output,credential:CREDENTIAL,request:fixtureRequest({values,calls}),now:NOW,sleep:noSleep,onDiagnostic:value=>diagnostics.push(value)}));
  assert.equal(error.code,code);assert.equal(calls.filter(c=>c.stage==='daily').length,0);noLeaks(safeDiagnostic(error));noLeaks(JSON.stringify(diagnostics));assert.ok(diagnostics.every(d=>d.code==='REPORT_SCHEMA'));assert.equal(await fs.readFile(output,'utf8'),PRIOR_BYTES);await assert.rejects(fs.access(output+'.tmp'));
 }));
});

test('daily verification retains production filters, exact totals and actual today values',async()=>{
 const range={startDate:'2025-01-02',endDate:'2026-11-06',lifetime:126};
 assert.deepEqual(dailyQuery(range.startDate,range.endDate),{...query(range.startDate,range.endDate),dimensions:[{name:'date'}],limit:250000});
 assert.equal(verifyDailyReport(dailyReport([['20261105','122.0'],['20261106','4.0']]),range),4);
 assert.equal(verifyDailyReport(dailyReport([['20261105','126.0']]),range),0);
 const values={...responses(126,1),daily:dailyReport([['20261105',122],['20261106',4]])};values.report.reports[1]={metadata:{timeZone:'Asia/Seoul'}};const diagnostics=[];
 const stats=await collectStats(TOKEN,{request:fixtureRequest({values}),now:NOW,sleep:noSleep,onDiagnostic:d=>diagnostics.push(d)});
 assert.equal(stats.totalPageViews,126);assert.equal(stats.todayPageViews,4);assert.deepEqual(diagnostics.filter(d=>d.code==='DAILY_RECHECK'),[{stage:'daily_report',code:'DAILY_RECHECK',result:'TODAY_PRESENT'}]);noLeaks(JSON.stringify(diagnostics));
 const calls=[];await collectStats(TOKEN,{request:fixtureRequest({calls}),now:NOW,sleep:noSleep});assert.equal(calls.length,3);assert.equal(calls.filter(c=>c.stage==='daily').length,0);
});

test('invalid or unreconciled daily verification cannot overwrite the last good stats',async t=>{
 const cases=[
  ['sum mismatch',()=>dailyReport([['20261105',125]])],
  ['empty daily report',()=>dailyReport([])],
  ['rows omitted',r=>{delete r.rows;return r;}],
  ['rows null',r=>({...r,rows:null})],
  ['row count mismatch',r=>({...r,rowCount:2})],
  ['duplicate dates with matching sum',()=>dailyReport([['20261105',63],['20261105',63]])],
  ['invalid calendar date',()=>dailyReport([['20260230',126]])],
  ['date wrong format',()=>dailyReport([['2026-11-05',126]])],
  ['date before range',()=>dailyReport([['20250101',126]])],
  ['date after range',()=>dailyReport([['20261107',126]])],
  ['timezone wrong',r=>({...r,metadata:{timeZone:'UTC'}})],
  ['thresholded',r=>({...r,metadata:{timeZone:'Asia/Seoul',subjectToThresholding:true}})],
  ['sampled',r=>({...r,metadata:{timeZone:'Asia/Seoul',samplingMetadatas:[{secret:CANARY}]}})],
  ['data loss',r=>({...r,metadata:{timeZone:'Asia/Seoul',dataLossFromOtherRow:true}})],
  ['dimension name secret',r=>({...r,dimensionHeaders:[{name:CANARY}]})],
  ['dimension headers omitted',r=>{delete r.dimensionHeaders;return r;}],
  ['dimension headers null',r=>({...r,dimensionHeaders:null})],
  ['metric name secret',r=>({...r,metricHeaders:[{name:CANARY,type:'TYPE_FLOAT'}]})],
  ['metric type secret',r=>({...r,metricHeaders:[{name:'eventCount',type:PRIVATE_KEY}]})],
  ['fractional count',()=>dailyReport([['20261105','126.0000000000000001']])],
  ['unsafe rounded count',()=>dailyReport([['20261105','9007199254740991.1']])],
  ['negative count',()=>dailyReport([['20261105','-126']])],
  ['secret metric value',()=>dailyReport([['20261105',TOKEN]])],
  ['missing row dimensions',r=>{delete r.rows[0].dimensionValues;return r;}],
  ['multiple row dimensions',r=>{r.rows[0].dimensionValues.push({value:CANARY});return r;}],
  ['multiple row metrics',r=>{r.rows[0].metricValues.push({value:CANARY});return r;}],
  ['sum overflows safe integer',()=>dailyReport([['20261104','9007199254740991'],['20261105',1]])],
 ];
 for(const [label,change]of cases)await t.test(label,()=>temporary(async dir=>{
  const output=path.join(dir,'stats.json');await fs.writeFile(output,PRIOR_BYTES);const values={...responses(126,1),daily:change(dailyReport([['20261105',126]]))};values.report.reports[1]={metadata:{timeZone:'Asia/Seoul'}};const diagnostics=[],calls=[];
  const error=await rejection(()=>collectAndSave({output,credential:CREDENTIAL,request:fixtureRequest({values,calls}),now:NOW,sleep:noSleep,onDiagnostic:d=>diagnostics.push(d)}));
  assert.equal(calls.filter(c=>c.stage==='daily').length,1);assert.deepEqual(diagnostics.filter(d=>d.code==='DAILY_RECHECK'),[]);noLeaks(JSON.stringify(diagnostics));noLeaks(safeDiagnostic(error));assert.equal(await fs.readFile(output,'utf8'),PRIOR_BYTES);await assert.rejects(fs.access(output+'.tmp'));
 }));
});

test('daily verification HTTP failure is sanitized and retains prior JSON',()=>temporary(async dir=>{
 const output=path.join(dir,'stats.json');await fs.writeFile(output,PRIOR_BYTES);const values=responses(126,1);values.report.reports[1]={metadata:{timeZone:'Asia/Seoul'}};const calls=[];
 const error=await rejection(()=>collectAndSave({output,credential:CREDENTIAL,request:fixtureRequest({values,calls,stage:'daily',reply:async()=>failed(403)}),now:NOW,sleep:noSleep}));
 assert.equal(calls.filter(c=>c.stage==='daily').length,1);assert.match(safeDiagnostic(error),/GA4:daily_report:HTTP_403/);noLeaks(safeDiagnostic(error));assert.equal(await fs.readFile(output,'utf8'),PRIOR_BYTES);
}));

test('an ambiguous today report with zero lifetime cannot trigger daily zero inference',()=>temporary(async dir=>{
 const output=path.join(dir,'stats.json');await fs.writeFile(output,PRIOR_BYTES);const values={...responses(0,0),daily:dailyReport([])};values.report.reports[1]={metadata:{timeZone:'Asia/Seoul'}};const calls=[];
 const error=await rejection(()=>collectAndSave({output,credential:CREDENTIAL,request:fixtureRequest({values,calls}),now:NOW,sleep:noSleep}));
 assert.equal(calls.filter(c=>c.stage==='daily').length,0);noLeaks(safeDiagnostic(error));assert.equal(await fs.readFile(output,'utf8'),PRIOR_BYTES);
}));

test('REPORT_SCHEMA classifies malformed fields with fixed categories and preserves prior stats',async t=>{
 const baseline={headers:'ONE',name:'EVENT_COUNT',type:'TYPE_FLOAT',rows:'ONE',rowCount:'ONE',timezone:'KST'};
 const expected=(label,patch={})=>{const fields={...baseline,...patch};return label+'; '+Object.entries(fields).map(([key,value])=>key+'='+value).join('; ');};
 const summaryPattern=/^(LIFETIME|TODAY); headers=(MISSING|MALFORMED|ZERO|ONE|MULTIPLE); name=(MISSING|EVENT_COUNT|OTHER); type=(MISSING|TYPE_INTEGER|TYPE_FLOAT|METRIC_TYPE_UNSPECIFIED|OTHER); rows=(MISSING|MALFORMED|ZERO|ONE|MULTIPLE); rowCount=(MISSING|ZERO|ONE|OTHER); timezone=(MISSING|KST|OTHER)$/;
 const cases=[
  ['headers omitted',r=>{delete r.metricHeaders;},{headers:'MISSING',name:'MISSING',type:'MISSING'},'METRIC_SCHEMA'],
  ['headers null',r=>{r.metricHeaders=null;},{headers:'MISSING',name:'MISSING',type:'MISSING'},'METRIC_SCHEMA'],
  ['headers object',r=>{r.metricHeaders={secret:CANARY};},{headers:'MALFORMED',name:'MISSING',type:'MISSING'},'METRIC_SCHEMA'],
  ['headers string',r=>{r.metricHeaders=TOKEN;},{headers:'MALFORMED',name:'MISSING',type:'MISSING'},'METRIC_SCHEMA'],
  ['headers empty',r=>{r.metricHeaders=[];},{headers:'ZERO',name:'MISSING',type:'MISSING'},'METRIC_SCHEMA'],
  ['headers multiple',r=>{r.metricHeaders.push({name:CANARY,type:PRIVATE_KEY});},{headers:'MULTIPLE'},'METRIC_SCHEMA'],
  ['header null',r=>{r.metricHeaders=[null];},{name:'MISSING',type:'MISSING'},'METRIC_SCHEMA'],
  ['header secret string',r=>{r.metricHeaders=[CANARY];},{name:'MISSING',type:'MISSING'},'METRIC_SCHEMA'],
  ['name omitted',r=>{delete r.metricHeaders[0].name;},{name:'MISSING'},'METRIC_SCHEMA'],
  ['name null',r=>{r.metricHeaders[0].name=null;},{name:'MISSING'},'METRIC_SCHEMA'],
  ['name secret',r=>{r.metricHeaders[0].name=TOKEN;},{name:'OTHER'},'METRIC_SCHEMA'],
  ['name object',r=>{r.metricHeaders[0].name={secret:CANARY};},{name:'OTHER'},'METRIC_SCHEMA'],
  ['type omitted',r=>{delete r.metricHeaders[0].type;},{type:'MISSING'},'METRIC_SCHEMA'],
  ['type null',r=>{r.metricHeaders[0].type=null;},{type:'MISSING'},'METRIC_SCHEMA'],
  ['type secret',r=>{r.metricHeaders[0].type=PRIVATE_KEY;},{type:'OTHER'},'METRIC_SCHEMA'],
  ['type object',r=>{r.metricHeaders[0].type={secret:CANARY};},{type:'OTHER'},'METRIC_SCHEMA'],
  ['type unspecified',r=>{r.metricHeaders[0].type='METRIC_TYPE_UNSPECIFIED';},{type:'METRIC_TYPE_UNSPECIFIED'},'METRIC_SCHEMA'],
  ['rows omitted',r=>{delete r.rows;},{rows:'MISSING'},'REPORT_ROWS'],
  ['rows null',r=>{r.rows=null;},{rows:'MISSING'},'REPORT_ROWS'],
  ['rows object',r=>{r.rows={secret:CANARY};},{rows:'MALFORMED'},'REPORT_ROWS'],
  ['rows false',r=>{r.rows=false;},{rows:'MALFORMED'},'REPORT_ROWS'],
  ['rows secret string',r=>{r.rows='Bearer '+TOKEN;},{rows:'MALFORMED'},'REPORT_ROWS'],
  ['rows array-like',r=>{r.rows={length:0,secret:PRIVATE_KEY};},{rows:'MALFORMED'},'REPORT_ROWS'],
  ['rows empty but rowCount one',r=>{r.rows=[];},{rows:'ZERO'},'REPORT_ROWS'],
  ['rows multiple',r=>{r.rows.push({metricValues:[{value:CANARY}]});},{rows:'MULTIPLE'},'REPORT_ROWS'],
  ['rowCount omitted',r=>{delete r.rowCount;},{rowCount:'MISSING'},'REPORT_ROWS'],
  ['rowCount null',r=>{r.rowCount=null;},{rowCount:'MISSING'},'REPORT_ROWS'],
  ['rowCount secret',r=>{r.rowCount=CANARY;},{rowCount:'OTHER'},'REPORT_ROWS'],
  ['timezone omitted',r=>{delete r.metadata.timeZone;},{timezone:'MISSING'},'REPORT_TIMEZONE'],
  ['timezone null',r=>{r.metadata.timeZone=null;},{timezone:'MISSING'},'REPORT_TIMEZONE'],
  ['timezone secret',r=>{r.metadata.timeZone=TOKEN;},{timezone:'OTHER'},'REPORT_TIMEZONE'],
  ['timezone object',r=>{r.metadata.timeZone={secret:PRIVATE_KEY};},{timezone:'OTHER'},'REPORT_TIMEZONE'],
  ['metadata null',r=>{r.metadata=null;},{timezone:'MISSING'},'REPORT_TIMEZONE'],
  ['metric value secret',r=>{r.rows[0].metricValues[0].value=CANARY;},{},'COUNT_FORMAT'],
 ];
 for(const [label,change,shape,code]of cases)await t.test(label,()=>temporary(async dir=>{
  const output=path.join(dir,'stats.json');await fs.writeFile(output,PRIOR_BYTES);
  const values=responses(126,1);change(values.report.reports[1]);const diagnostics=[];
  const error=await rejection(()=>collectAndSave({output,credential:CREDENTIAL,request:fixtureRequest({values}),now:NOW,sleep:noSleep,onDiagnostic:value=>diagnostics.push(value)}));
  assert.equal(error.code,code);assert.deepEqual(diagnostics,[{stage:'report',code:'REPORT_SCHEMA',summary:expected('LIFETIME')},{stage:'report',code:'REPORT_SCHEMA',summary:expected('TODAY',shape)}]);
  for(const diagnostic of diagnostics){assert.match(diagnostic.summary,summaryPattern);noLeaks(JSON.stringify(diagnostic));}
  noLeaks(safeDiagnostic(error));assert.equal(await fs.readFile(output,'utf8'),PRIOR_BYTES);await assert.rejects(fs.access(output+'.tmp'));
 }));
});

test('missing, malformed or null report containers cannot leak payloads through diagnostics',async t=>{
 const cases=[['reports omitted',{}],['reports null',{reports:null}],['reports secret',{reports:CANARY}],['reports object',{reports:{length:2,secret:PRIVATE_KEY}}],['null report',{reports:[metric(126,'TYPE_FLOAT'),null]}]];
 for(const [label,report]of cases)await t.test(label,()=>temporary(async dir=>{
  const output=path.join(dir,'stats.json');await fs.writeFile(output,PRIOR_BYTES);const values={...responses(),report},diagnostics=[];
  const error=await rejection(()=>collectAndSave({output,credential:CREDENTIAL,request:fixtureRequest({values}),now:NOW,sleep:noSleep,onDiagnostic:value=>diagnostics.push(value)}));
  assert.equal(error.code,label==='null report'?'METRIC_SCHEMA':'MISSING_REPORTS');
  if(label==='null report')assert.deepEqual(diagnostics[1],{stage:'report',code:'REPORT_SCHEMA',summary:'TODAY; headers=MISSING; name=MISSING; type=MISSING; rows=MISSING; rowCount=MISSING; timezone=MISSING'});
  else assert.deepEqual(diagnostics,[]);
  noLeaks(JSON.stringify(diagnostics));noLeaks(safeDiagnostic(error));assert.equal(await fs.readFile(output,'utf8'),PRIOR_BYTES);
 }));
});

test('CLI REPORT_SCHEMA logs classify secret-bearing fields without printing the response',()=>temporary(async dir=>{
 const output=path.join(dir,'data','stats.json');await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,PRIOR_BYTES);
 const values=responses();values.report.reports[1]={metricHeaders:[{name:CANARY,type:PRIVATE_KEY}],rows:{secret:'Bearer '+TOKEN},rowCount:EMAIL,metadata:{timeZone:CANARY},rawResponse:CANARY};
 const loader=path.join(dir,'mock-schema-fetch.mjs');await fs.writeFile(loader,`const values=${JSON.stringify(values)};globalThis.fetch=async(url)=>{const stage=url.includes('oauth2.googleapis.com')?'oauth':url.includes('dataStreams')?'streams':url.includes(':batchRunReports')?'report':'property';return {ok:true,status:200,headers:new Headers(),json:async()=>values[stage]};};\n`);
 const result=spawnSync(process.execPath,['--import',pathToFileURL(loader).href,path.resolve('scripts/fetch-stats.mjs')],{cwd:dir,env:{...process.env,GA4_SERVICE_ACCOUNT_JSON:CREDENTIAL},encoding:'utf8',timeout:5000});
 assert.equal(result.error,undefined);assert.equal(result.status,1);noLeaks(result.stdout+result.stderr);
 assert.match(result.stdout,/\[GA4:report:REPORT_SCHEMA\] TODAY; headers=ONE; name=OTHER; type=OTHER; rows=MALFORMED; rowCount=OTHER; timezone=OTHER/);
 assert.match(result.stderr,/\[GA4:report:REPORT_TIMEZONE\]/);assert.ok(!result.stdout.includes('[GA4:report:METRIC_TYPE]'));assert.equal(await fs.readFile(output,'utf8'),PRIOR_BYTES);
}));

test('CLI failure logs never expose forged trusted-prefix errors, API bodies or signing material',async t=>{
 const script=path.resolve('scripts/fetch-stats.mjs');
 for(const stage of ['oauth','property','streams','report'])await t.test(stage,()=>temporary(async dir=>{
  const output=path.join(dir,'data','stats.json');await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,PRIOR_BYTES);
  const loader=path.join(dir,'mock-fetch.mjs');
  // A separate process exercises the actual CLI catch path, with all network disabled.
  await fs.writeFile(loader,`const values=${JSON.stringify(responses())};globalThis.fetch=async(url)=>{const stage=url.includes('oauth2.googleapis.com')?'oauth':url.includes('dataStreams')?'streams':url.includes(':batchRunReports')?'report':'property';if(stage===${JSON.stringify(stage)})throw new Error(${JSON.stringify('GA request HTTP 403 '+CANARY+' Bearer '+TOKEN+' '+PRIVATE_KEY)});return {ok:true,status:200,headers:new Headers(),json:async()=>values[stage]};};\n`);
  const result=spawnSync(process.execPath,['--import',pathToFileURL(loader).href,script],{cwd:dir,env:{...process.env,GA4_SERVICE_ACCOUNT_JSON:CREDENTIAL},encoding:'utf8',timeout:5000});
  assert.equal(result.error,undefined);assert.equal(result.status,1);noLeaks(result.stdout+result.stderr);assert.ok((result.stdout+result.stderr).trim().length>0,'CLI must report a safe failure');assert.equal(await fs.readFile(output,'utf8'),PRIOR_BYTES);
 }));
});
