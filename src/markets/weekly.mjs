import {assets,numeric,percent} from './data.mjs';
const day=86400000;
export function completedWeek(now=new Date()){
 const monday=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
 monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
 const start=new Date(+monday-7*day);
 return {id:start.toISOString().slice(0,10),start:start.toISOString(),endExclusive:monday.toISOString(),endDate:new Date(+monday-day).toISOString().slice(0,10),nextEndExclusive:new Date(+monday+7*day).toISOString(),timezone:'UTC'};
}
export function validWeekly(q,week){
 return !!q && q.weekId===week.id && ['startPrice','endPrice','high','low'].every(k=>Number.isFinite(q[k])&&q[k]>0)&&
  q.low<=Math.min(q.startPrice,q.endPrice)&&q.high>=Math.max(q.startPrice,q.endPrice)&&
  Number.isFinite(q.changePercent)&&Math.abs(q.changePercent-percent(q.endPrice,q.startPrice))<0.000001&&
  !!q.source?.name&&/^https:\/\//.test(q.source?.url||'');
}
export function emptyWeekly(asset,week,reason='unavailable'){
 const {slug,symbol,assetType,currency,unit}=asset;
 return {slug,symbol,assetType,currency,unit,weekId:week.id,startPrice:null,endPrice:null,changePercent:null,high:null,low:null,source:null,status:'pending',reason};
}
export function preserveWeekly(asset,week,candidate,previous){
 if(validWeekly(candidate,week))return {...emptyWeekly(asset,week),...candidate,status:'ready'};
 // Never relabel a prior week's observations as this week's numbers.
 if(validWeekly(previous,week))return {...previous,status:'retained'};
 return emptyWeekly(asset,week,asset.assetType==='index'?'rights-pending':asset.provider==='gold-api'?'free-key-required':'fetch-failed');
}
export function normalizeWeeklyFX(data,week){
 if(!Array.isArray(data))throw new Error('Invalid reference series');
 const rows=data.filter(x=>x.base==='USD'&&x.quote==='KRW'&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&x.date>=week.id&&x.date<=week.endDate&&numeric(x.rate)>0).sort((a,b)=>a.date.localeCompare(b.date));
 if(rows.length<2||new Set(rows.map(x=>x.date)).size!==rows.length)throw new Error('Incomplete reference week');
 const startPrice=numeric(rows[0].rate),endPrice=numeric(rows.at(-1).rate);
 return {weekId:week.id,startPrice,endPrice,changePercent:percent(endPrice,startPrice),high:Math.max(...rows.map(x=>numeric(x.rate))),low:Math.min(...rows.map(x=>numeric(x.rate))),observedStart:rows[0].date,observedEnd:rows.at(-1).date,observations:rows.length,rangeBasis:'daily-reference',source:{name:'ECB via Frankfurter',url:'https://www.ecb.europa.eu/stats/exchange_rates/html/index.en.html'}};
}
export function normalizeWeeklyOHLC(data,week){
 const start=Math.floor(Date.parse(week.start)/1000),end=Math.floor(Date.parse(week.endExclusive)/1000)-1;
 if(Number(data.startTimestamp)!==start||Number(data.endTimestamp)!==end)throw new Error('Wrong weekly window');
 const q={weekId:week.id,startPrice:numeric(data.open),endPrice:numeric(data.close),high:numeric(data.high),low:numeric(data.low),changePercent:percent(numeric(data.close),numeric(data.open)),rangeBasis:'ohlc',source:{name:'Gold API',url:'https://gold-api.com/'}};
 if(!validWeekly(q,week))throw new Error('Invalid weekly OHLC');
 return q;
}
export async function json(url,options={},request=fetch){
 const r=await request(url,{...options,signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error('Provider unavailable');return r.json();
}
export async function fetchWeeklyAsset(asset,week,env=process.env,request=fetch){
 if(asset.assetType==='index')throw new Error('Free redistribution rights not verified');
 if(asset.provider==='ecb-frankfurter')return normalizeWeeklyFX(await json(`https://api.frankfurter.dev/v2/providers/ecb/rates?from=${week.id}&to=${week.endDate}&base=USD&quotes=KRW`,{},request),week);
 if(!env.GOLD_API_KEY)throw new Error('Free history key required');
 const start=Math.floor(Date.parse(week.start)/1000),end=Math.floor(Date.parse(week.endExclusive)/1000)-1;
 // One completed-week OHLC call per asset; no current-price or intraday requests.
 return normalizeWeeklyOHLC(await json(`https://api.gold-api.com/ohlc/${asset.symbol}?startTimestamp=${start}&endTimestamp=${end}`,{headers:{'x-api-key':env.GOLD_API_KEY}},request),week);
}
export function assembleWeekly(week,items,context,previous,now){
 const normalized=assets.map(a=>preserveWeekly(a,week,items.find(x=>x.slug===a.slug),previous?.items?.find(x=>x.slug===a.slug)));
 return {schemaVersion:2,week,publishedAt:previous?.publishedAt||previous?.collectedAt||now,collectedAt:now,items:normalized,issues:context.issues.slice(0,5),events:context.events,sourceStatus:context.sourceStatus,usable:normalized.some(q=>validWeekly(q,week))||context.issues.length>0};
}
