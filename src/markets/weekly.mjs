import {assets,numeric,percent} from './data.mjs';
const day=86400000;
export function completedWeek(now=new Date()){
 const monday=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
 const start=new Date(+monday-7*day);
 return {id:start.toISOString().slice(0,10),start:start.toISOString(),endExclusive:monday.toISOString(),endDate:new Date(+monday-day).toISOString().slice(0,10),nextEndExclusive:new Date(+monday+7*day).toISOString(),timezone:'UTC'};
}
export const snapshotWeek=(now=new Date())=>completedWeek(new Date(+now+7*day));
export function validWeekly(q,week){
 return !!q&&q.weekId===week.id&&Number.isFinite(q.price)&&q.price>0&&Number.isFinite(Date.parse(q.collectedAt))&&Number.isFinite(Date.parse(q.observedAt))&&q.source?.name&&/^https:\/\//.test(q.source?.url||'')&&
 (q.previousPrice===null?q.changePercent===null:Number.isFinite(q.previousPrice)&&q.previousPrice>0&&Number.isFinite(q.changePercent)&&Math.abs(q.changePercent-percent(q.price,q.previousPrice))<1e-6);
}
export function emptyWeekly(a,week){const {slug,symbol,assetType,currency,unit}=a;return {asset:slug,slug,symbol,assetType,currency,unit,weekId:week.id,status:'pending'};}
export function preserveWeekly(a,week,candidate,previous){
 if(validWeekly(candidate,week))return {...emptyWeekly(a,week),...candidate,status:'ready'};
 if(previous&&validWeekly(previous,{id:previous.weekId}))return {...previous,status:'stale'};
 return emptyWeekly(a,week);
}
export function makeSnapshot(a,week,raw,previous,now){
 const price=numeric(raw.price),observed=Date.parse(raw.observedAt),time=Date.parse(now);
 const maxAge=a.assetType==='crypto'?day:7*day;
 if(!(price>0)||!Number.isFinite(observed)||observed>time+300000||time-observed>maxAge)throw new Error('Invalid or outdated provider observation');
 // Same-edition corrections must never compare against themselves.
 const old=previous&&validWeekly(previous,{id:previous.weekId})?previous:null;
 const same=old?.weekId===week.id;
 const previousPrice=same?old.previousPrice:old?.price??null;
 return {...emptyWeekly(a,week),price,previousPrice,changePercent:previousPrice===null?null:percent(price,previousPrice),previousCollectedAt:same?old.previousCollectedAt:old?.collectedAt??null,collectedAt:now,observedAt:raw.observedAt,source:raw.source,status:'ready'};
}
export async function fetchWeeklyAsset(a,week,_env={},request=fetch,now=new Date()){
 if(a.assetType==='index')throw new Error('Rights unverified');
 const url=a.provider==='ecb-frankfurter'?'https://api.frankfurter.dev/v2/providers/ecb/rates?base=USD&quotes=KRW':`https://api.gold-api.com/price/${a.symbol}`;
 const r=await request(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('Provider request failed');const d=await r.json();
 if(a.provider==='ecb-frankfurter'){
  const rows=Array.isArray(d)?d.filter(x=>x.base==='USD'&&x.quote==='KRW'&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&x.date<=now.toISOString().slice(0,10)).sort((x,y)=>x.date.localeCompare(y.date)):[];
  if(!rows.length)throw new Error('Missing ECB observation');const x=rows.at(-1);return {price:x.rate,observedAt:x.date+'T00:00:00Z',source:{name:'ECB via Frankfurter',url:'https://www.ecb.europa.eu/stats/exchange_rates/html/index.en.html'}};
 }
 if(d.symbol!==a.symbol||d.currency!=='USD')throw new Error('Wrong symbol/currency');
 return {price:d.price,observedAt:d.updatedAt,source:{name:'Gold API',url:'https://gold-api.com/'}};
}
export function assembleWeekly(week,items,context,previous,now){
 const normalized=assets.map(a=>{const raw=items.find(x=>x.slug===a.slug),old=previous?.items?.find(x=>x.slug===a.slug);let candidate=null;try{if(raw)candidate=makeSnapshot(a,week,raw,old,now);}catch{console.warn(`::warning::${a.slug}: invalid snapshot; last good value retained`);}return preserveWeekly(a,week,candidate,old);});
 const count=normalized.filter(q=>q.status==='ready').length;
 return {schemaVersion:3,week,contextWeek:context.week||completedWeek(new Date(now)),publishedAt:previous?.week?.id===week.id?previous.publishedAt||previous.collectedAt:now,collectedAt:now,items:normalized,issues:context.issues.slice(0,5),events:context.events,sourceStatus:context.sourceStatus,publishable:count>=2||(count>=1&&context.issues.length>=2),usable:count>0};
}
