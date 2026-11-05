import {createSign} from 'node:crypto';

export const PROPERTY='528476729';
export const kstDate=(now=new Date())=>new Date(+now+9*3600000).toISOString().slice(0,10);
export const kstTimestamp=(now=new Date())=>new Date(+now+9*3600000).toISOString().slice(0,19)+'+09:00';
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const STAGES=new Set(['oauth','property','streams','report','daily_report','stats','storage','collection']);
const MESSAGES=Object.freeze({
 CREDENTIAL_MISSING:'GA4_SERVICE_ACCOUNT_JSON missing',
 CREDENTIAL_JSON:'Invalid service account JSON',
 CREDENTIAL_FIELDS:'Invalid service account fields',
 SIGNING_KEY:'Invalid service account signing key',
 ACCESS_TOKEN:'Access token missing',
 HTTP_400:'GA request HTTP 400',
 HTTP_401:'GA request HTTP 401',
 HTTP_403:'GA request HTTP 403',
 HTTP_404:'GA request HTTP 404',
 HTTP_408:'GA request HTTP 408',
 HTTP_429:'GA request HTTP 429',
 HTTP_500:'GA request HTTP 500',
 HTTP_502:'GA request HTTP 502',
 HTTP_503:'GA request HTTP 503',
 HTTP_504:'GA request HTTP 504',
 HTTP_ERROR:'GA request HTTP failure',
 TIMEOUT:'GA request timed out',
 NETWORK:'GA request network failure',
 RESPONSE_JSON:'Invalid GA response JSON',
 REQUEST_FAILED:'GA request failed',
 RETRY_DELAY_LIMIT:'Server retry delay exceeds the bounded wait budget',
 PROPERTY_TIMEZONE:'Property timezone is not Asia/Seoul',
 PROPERTY_CREATED:'Property creation time unavailable',
 STREAM_MISMATCH:'Measurement ID does not match property',
 MISSING_REPORTS:'Missing reports',
 METRIC_SCHEMA:'Unexpected metric',
 REPORT_INCOMPLETE:'Incomplete or sampled report',
 REPORT_TIMEZONE:'Report timezone must be Asia/Seoul',
 REPORT_ROWS:'Unexpected aggregate rows',
 DAILY_DIMENSION:'Unexpected daily report dimensions',
 DAILY_ROWS:'Incomplete or malformed daily report rows',
 DAILY_DATE:'Invalid, duplicate or out-of-range daily report date',
 DAILY_TOTAL:'Daily report total does not match the verified positive lifetime total',
 COUNT_FORMAT:'Non-integer page views',
 COUNT_RANGE:'Unsafe integer',
 STATS_INVALID:'Invalid stats totals',
 GROWTH_RANGE:'Unsafe integer growth count',
 UNEXPECTED_ZERO:'Unexpected empty lifetime report',
 PREVIOUS_STATS:'Invalid previous stats JSON',
 STORAGE_READ:'Previous stats could not be read',
 STORAGE_WRITE:'Stats could not be saved atomically',
 UNKNOWN_FAILURE:'GA4 collection failed',
});
const trustedErrors=new WeakSet();

// Only locally created, allowlisted diagnostics may reach workflow logs.
export function collectionError(stage,code,attempts){
 const error=new Error(MESSAGES[code]||MESSAGES.UNKNOWN_FAILURE);
 error.name='GA4CollectionError';
 error.stage=STAGES.has(stage)?stage:'collection';
 error.code=Object.hasOwn(MESSAGES,code)?code:'UNKNOWN_FAILURE';
 if(Number.isInteger(attempts)&&attempts>=1&&attempts<=3)error.attempts=attempts;
 trustedErrors.add(error);
 return error;
}
export function safeDiagnostic(error){
 if(!trustedErrors.has(error)||!STAGES.has(error.stage)||!Object.hasOwn(MESSAGES,error.code))return '[GA4:collection:UNKNOWN_FAILURE] GA4 collection failed; prior stats retained';
 const attempts=Number.isInteger(error.attempts)&&error.attempts>=1&&error.attempts<=3?`; attempts=${error.attempts}`:'';
 return `[GA4:${error.stage}:${error.code}] ${MESSAGES[error.code]}${attempts}; prior stats retained`;
}

const RETRY_STATUS=new Set([429,500,502,503,504]);
const NETWORK_CODES=new Set(['ECONNRESET','ECONNREFUSED','ECONNABORTED','EPIPE','ETIMEDOUT','EAI_AGAIN','ENETDOWN','ENETUNREACH','EHOSTUNREACH','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_SOCKET']);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function transportCode(error){
 if(error?.name==='TimeoutError'||error?.name==='AbortError')return 'TIMEOUT';
 if(NETWORK_CODES.has(error?.code)||NETWORK_CODES.has(error?.cause?.code))return 'NETWORK';
 if(!error?.code&&!error?.cause?.code&&error instanceof TypeError&&['fetch failed','Failed to fetch','NetworkError when attempting to fetch resource.'].includes(error.message))return 'NETWORK';
 return null;
}
function retryDelay(response,attempt,clock,stage){
 const backoff=1000*2**(attempt-1),header=response?.headers?.get?.('retry-after');
 if(typeof header!=='string')return backoff;
 const value=header.trim();
 const duration=/^\d+$/.test(value)?Number(value)*1000:Date.parse(value)-clock();
 if(duration>10000)throw collectionError(stage,'RETRY_DELAY_LIMIT',attempt);
 return Number.isFinite(duration)?Math.max(backoff,Math.max(0,duration)):backoff;
}
async function requestAttempt(url,options,{request,stage,timeout},attempt){
 const controller=new AbortController();
 let timer;
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{
  const error=new DOMException('Request deadline exceeded','TimeoutError');
  controller.abort(error);reject(error);
 },timeout);});
 try{
  return await Promise.race([deadline,(async()=>{
   const response=await request(url,{...options,signal:controller.signal});
   if(!response.ok){controller.abort();return {response};}
   try{return {response,data:await response.json()};}catch(error){
    if(transportCode(error))throw error;
    throw collectionError(stage,'RESPONSE_JSON',attempt);
   }
  })()]);
 }finally{clearTimeout(timer);}
}
export async function requestJSON(url,options={}, {request=fetch,stage='report',sleep=wait,clock=Date.now,timeoutMs=30000}={}){
 const timeout=Number.isFinite(timeoutMs)?Math.max(1,Math.min(30000,Math.floor(timeoutMs))):30000;
 for(let attempt=1;attempt<=3;attempt++){
  let response;
  try{
   const result=await requestAttempt(url,options,{request,stage,timeout},attempt);
   response=result.response;
   if(!response.ok){
    // Never read an error body: it may contain credentials or request details.
    const code=Object.hasOwn(MESSAGES,`HTTP_${response.status}`)?`HTTP_${response.status}`:'HTTP_ERROR';
    if(RETRY_STATUS.has(response.status)&&attempt<3){await sleep(retryDelay(response,attempt,clock,stage));continue;}
    throw collectionError(stage,code,attempt);
   }
   return result.data;
  }catch(error){
   if(trustedErrors.has(error))throw error;
   const code=transportCode(error);
   if(code&&attempt<3){await sleep(retryDelay(response,attempt,clock,stage));continue;}
   throw collectionError(stage,code||'REQUEST_FAILED',attempt);
  }
 }
}

export async function authorize(raw,request=fetch,now=new Date(),options={}){
 if(!raw)throw collectionError('oauth','CREDENTIAL_MISSING');
 let c;try{c=JSON.parse(raw);}catch{throw collectionError('oauth','CREDENTIAL_JSON');}
 if(c?.type!=='service_account'||typeof c.client_email!=='string'||!c.client_email||typeof c.private_key!=='string'||!c.private_key)throw collectionError('oauth','CREDENTIAL_FIELDS');
 const iat=Math.floor(+now/1000),payload=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:c.client_email,scope:'https://www.googleapis.com/auth/analytics.readonly',aud:'https://oauth2.googleapis.com/token',iat,exp:iat+3600});
 let signature;try{signature=createSign('RSA-SHA256').update(payload).sign(c.private_key,'base64url');}catch{throw collectionError('oauth','SIGNING_KEY');}
 const token=await requestJSON('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:payload+'.'+signature})},{...options,request,stage:'oauth'});
 if(typeof token?.access_token!=='string'||!token.access_token)throw collectionError('oauth','ACCESS_TOKEN');return token.access_token;
}
export function query(startDate,endDate){return {dateRanges:[{startDate,endDate}],metrics:[{name:'eventCount'}],dimensionFilter:{andGroup:{expressions:[{filter:{fieldName:'eventName',stringFilter:{matchType:'EXACT',value:'page_view',caseSensitive:true}}},{filter:{fieldName:'hostName',inListFilter:{values:['couponcountdown.com','www.couponcountdown.com'],caseSensitive:false}}}]}},keepEmptyRows:false,returnPropertyQuota:true};}
export function dailyQuery(startDate,endDate){return {...query(startDate,endDate),dimensions:[{name:'date'}],limit:250000};}
function reportSchema(report,label){
 const size=value=>value==null?'MISSING':!Array.isArray(value)?'MALFORMED':value.length===0?'ZERO':value.length===1?'ONE':'MULTIPLE';
 const header=Array.isArray(report?.metricHeaders)?report.metricHeaders[0]:undefined;
 const name=header?.name==null?'MISSING':header.name==='eventCount'?'EVENT_COUNT':'OTHER';
 const type=header?.type==null?'MISSING':['TYPE_INTEGER','TYPE_FLOAT','METRIC_TYPE_UNSPECIFIED'].includes(header.type)?header.type:'OTHER';
 const rows=report?.rowCount==null?'MISSING':report.rowCount===0?'ZERO':report.rowCount===1?'ONE':'OTHER';
 const zone=report?.metadata?.timeZone==null?'MISSING':report.metadata.timeZone==='Asia/Seoul'?'KST':'OTHER';
 return `${label}; headers=${size(report?.metricHeaders)}; name=${name}; type=${type}; rows=${size(report?.rows)}; rowCount=${rows}; timezone=${zone}`;
}
function validateReportMetadata(report,stage='report'){
 if(!report||typeof report!=='object'||Array.isArray(report))throw collectionError(stage,'METRIC_SCHEMA');
 if(report.metadata?.subjectToThresholding||report.metadata?.dataLossFromOtherRow||report.metadata?.samplingMetadatas?.length)throw collectionError(stage,'REPORT_INCOMPLETE');
 if(report.metadata?.timeZone!=='Asia/Seoul')throw collectionError(stage,'REPORT_TIMEZONE');
}
function validateMetricHeader(report,stage='report'){
 if(!Array.isArray(report.metricHeaders)||report.metricHeaders.length!==1||report.metricHeaders[0]?.name!=='eventCount'||!['TYPE_INTEGER','TYPE_FLOAT'].includes(report.metricHeaders[0]?.type))throw collectionError(stage,'METRIC_SCHEMA');
}
function exactCount(raw,stage='report'){
 if(typeof raw!=='string'||!/^\d+(?:\.0+)?$/.test(raw))throw collectionError(stage,'COUNT_FORMAT');
 // Validate the original decimal before converting: Number() can round an
 // unsafe integer or a tiny fractional suffix into an apparently valid count.
 const integer=raw.split('.')[0].replace(/^0+(?=\d)/,'');
 if(integer.length>16||BigInt(integer)>BigInt(Number.MAX_SAFE_INTEGER))throw collectionError(stage,'COUNT_RANGE');
 return Number(integer);
}
export function count(report){
 validateReportMetadata(report);
 validateMetricHeader(report);
 if(report.rows!=null&&!Array.isArray(report.rows))throw collectionError('report','REPORT_ROWS');
 if((report.rowCount??0)===0&&!report.rows?.length)return 0;
 if(!Array.isArray(report.rows)||report.rows.length!==1||report.rowCount!==1||!Array.isArray(report.rows[0]?.metricValues)||report.rows[0].metricValues.length!==1)throw collectionError('report','REPORT_ROWS');
 return exactCount(report.rows[0].metricValues[0]?.value);
}
function validCalendarDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00Z');
 return Number.isFinite(+date)&&date.toISOString().slice(0,10)===value;
}
export function verifyDailyReport(report,{startDate,endDate,lifetime}={}){
 const stage='daily_report';
 validateReportMetadata(report,stage);
 validateMetricHeader(report,stage);
 if(!Number.isSafeInteger(lifetime)||lifetime<=0)throw collectionError(stage,'DAILY_TOTAL');
 if(!validCalendarDate(startDate)||!validCalendarDate(endDate)||startDate>endDate)throw collectionError(stage,'DAILY_DATE');
 if(!Array.isArray(report.dimensionHeaders)||report.dimensionHeaders.length!==1||report.dimensionHeaders[0]?.name!=='date')throw collectionError(stage,'DAILY_DIMENSION');
 if(!Array.isArray(report.rows)||report.rows.length===0||report.rows.length>250000||report.rowCount!==report.rows.length)throw collectionError(stage,'DAILY_ROWS');
 const dates=new Set(),first=startDate.replaceAll('-',''),last=endDate.replaceAll('-','');
 let total=0,today=0;
 for(const row of report.rows){
  if(!Array.isArray(row?.dimensionValues)||row.dimensionValues.length!==1||!Array.isArray(row.metricValues)||row.metricValues.length!==1)throw collectionError(stage,'DAILY_ROWS');
  const date=row.dimensionValues[0]?.value;
  if(typeof date!=='string'||!/^\d{8}$/.test(date)||!validCalendarDate(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8))||date<first||date>last||dates.has(date))throw collectionError(stage,'DAILY_DATE');
  dates.add(date);
  const value=exactCount(row.metricValues[0]?.value,stage);
  total+=value;
  if(!Number.isSafeInteger(total))throw collectionError(stage,'COUNT_RANGE');
  if(date===last)today=value;
 }
 if(total!==lifetime)throw collectionError(stage,'DAILY_TOTAL');
 return today;
}
export function validStats(s){return s?.source==='GA4'&&s.metric==='page_view'&&s.propertyTimeZone==='Asia/Seoul'&&Number.isSafeInteger(s.totalPageViews)&&s.totalPageViews>=0&&Number.isSafeInteger(s.todayPageViews)&&s.todayPageViews>=0&&s.todayPageViews<=s.totalPageViews&&Number.isFinite(Date.parse(s.updatedAt))&&/^\d{4}-\d{2}-\d{2}$/.test(s.reportingDate||'');}
export function withGrowthCount(stats){
 if(!validStats(stats))throw collectionError('stats','STATS_INVALID');
 const actualPageViews=stats.totalPageViews,displayGrowthCount=actualPageViews*1000;
 if(!Number.isSafeInteger(displayGrowthCount))throw collectionError('stats','GROWTH_RANGE');
 return {...stats,actualPageViews,displayGrowthCount};
}
export async function collectStats(token,{request=fetch,now=new Date(),sleep=wait,clock=Date.now,timeoutMs=30000,onDiagnostic}={}){
 const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'},options={request,sleep,clock,timeoutMs};
 const property=await requestJSON(`https://analyticsadmin.googleapis.com/v1beta/properties/${PROPERTY}`,{headers},{...options,stage:'property'});
 if(property?.timeZone!=='Asia/Seoul')throw collectionError('property','PROPERTY_TIMEZONE');
 if(!Number.isFinite(Date.parse(property.createTime)))throw collectionError('property','PROPERTY_CREATED');
 const streams=await requestJSON(`https://analyticsadmin.googleapis.com/v1beta/properties/${PROPERTY}/dataStreams?pageSize=200`,{headers},{...options,stage:'streams'});
 if(!Array.isArray(streams?.dataStreams)||!streams.dataStreams.some(s=>s?.webStreamData?.measurementId==='G-1TS6F1NK5K'))throw collectionError('streams','STREAM_MISMATCH');
 const today=kstDate(now),start=kstDate(new Date(property.createTime));
 const response=await requestJSON(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY}:batchRunReports`,{method:'POST',headers,body:JSON.stringify({requests:[query(start,today),query(today,today)]})},{...options,stage:'report'});
 if(!Array.isArray(response?.reports)||response.reports.length!==2)throw collectionError('report','MISSING_REPORTS');
 for(const [index,report] of response.reports.entries())onDiagnostic?.({stage:'report',code:'REPORT_SCHEMA',summary:reportSchema(report,index===0?'LIFETIME':'TODAY')});
 const totalPageViews=count(response.reports[0]),todayReport=response.reports[1];
 let todayPageViews;
 // A metadata-only response is ambiguous. Re-query the identical lifetime
 // filters by date and require a complete, matching total before deriving today.
 if(todayReport&&typeof todayReport==='object'&&!Array.isArray(todayReport)&&todayReport.metricHeaders===undefined&&todayReport.rows===undefined&&todayReport.rowCount===undefined){
  validateReportMetadata(todayReport);
  if(totalPageViews<=0)throw collectionError('daily_report','DAILY_TOTAL');
  const daily=await requestJSON(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY}:runReport`,{method:'POST',headers,body:JSON.stringify(dailyQuery(start,today))},{...options,stage:'daily_report'});
  todayPageViews=verifyDailyReport(daily,{startDate:start,endDate:today,lifetime:totalPageViews});
  const todayPresent=daily.rows.some(row=>row.dimensionValues[0].value===today.replaceAll('-',''));
  onDiagnostic?.({stage:'daily_report',code:'DAILY_RECHECK',result:todayPresent?'TODAY_PRESENT':'TODAY_ABSENT'});
 }else todayPageViews=count(todayReport);
 const stats={totalPageViews,todayPageViews,updatedAt:kstTimestamp(now),reportingDate:today,source:'GA4',metric:'page_view',propertyTimeZone:'Asia/Seoul',totalStartDate:start,staleAfterHours:3};
 if(!validStats(stats))throw collectionError('stats','STATS_INVALID');
 for(const type of new Set(response.reports.map(report=>report.metricHeaders?.[0]?.type).filter(type=>['TYPE_INTEGER','TYPE_FLOAT'].includes(type))))onDiagnostic?.({stage:'report',code:'METRIC_TYPE',type});
 return stats;
}
