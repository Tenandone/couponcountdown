import {createSign} from 'node:crypto';
export const PROPERTY='528476729';
export const kstDate=(now=new Date())=>new Date(+now+9*3600000).toISOString().slice(0,10);
export const kstTimestamp=(now=new Date())=>new Date(+now+9*3600000).toISOString().slice(0,19)+'+09:00';
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
async function call(url,options,request){const r=await request(url,{...options,signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`GA request HTTP ${r.status}`);return r.json();}
export async function authorize(raw,request=fetch,now=new Date()){
 if(!raw)throw new Error('GA4_SERVICE_ACCOUNT_JSON missing');
 let c;try{c=JSON.parse(raw);}catch{throw new Error('Invalid service account JSON');}
 if(c.type!=='service_account'||!c.client_email||!c.private_key)throw new Error('Invalid service account fields');
 const iat=Math.floor(+now/1000),payload=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:c.client_email,scope:'https://www.googleapis.com/auth/analytics.readonly',aud:'https://oauth2.googleapis.com/token',iat,exp:iat+3600});
 let signature;try{signature=createSign('RSA-SHA256').update(payload).sign(c.private_key,'base64url');}catch{throw new Error('Invalid service account signing key');}
 const token=await call('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:payload+'.'+signature})},request);
 if(typeof token.access_token!=='string')throw new Error('Access token missing');return token.access_token;
}
export function query(startDate,endDate){return {dateRanges:[{startDate,endDate}],metrics:[{name:'eventCount'}],dimensionFilter:{andGroup:{expressions:[{filter:{fieldName:'eventName',stringFilter:{matchType:'EXACT',value:'page_view',caseSensitive:true}}},{filter:{fieldName:'hostName',inListFilter:{values:['couponcountdown.com','www.couponcountdown.com'],caseSensitive:false}}}]}},keepEmptyRows:false,returnPropertyQuota:true};}
export function count(report){
 if(report?.metricHeaders?.length!==1||report.metricHeaders[0].name!=='eventCount'||report.metricHeaders[0].type!=='TYPE_INTEGER')throw new Error('Unexpected metric');
 if(report.metadata?.subjectToThresholding||report.metadata?.dataLossFromOtherRow||report.metadata?.samplingMetadatas?.length)throw new Error('Incomplete or sampled report');
 if(report.metadata?.timeZone!=='Asia/Seoul')throw new Error('Report timezone must be Asia/Seoul');
 if((report.rowCount??0)===0&&!report.rows?.length)return 0;
 if(report.rows?.length!==1||report.rowCount!==1)throw new Error('Unexpected aggregate rows');
 const raw=report.rows[0].metricValues?.[0]?.value;if(!/^\d+$/.test(raw||''))throw new Error('Non-integer page views');const n=Number(raw);if(!Number.isSafeInteger(n))throw new Error('Unsafe integer');return n;
}
export function validStats(s){return s?.source==='GA4'&&s.metric==='page_view'&&s.propertyTimeZone==='Asia/Seoul'&&Number.isSafeInteger(s.totalPageViews)&&s.totalPageViews>=0&&Number.isSafeInteger(s.todayPageViews)&&s.todayPageViews>=0&&s.todayPageViews<=s.totalPageViews&&Number.isFinite(Date.parse(s.updatedAt))&&/^\d{4}-\d{2}-\d{2}$/.test(s.reportingDate||'');}
export function withGrowthCount(stats){
 if(!validStats(stats))throw new Error('Invalid stats totals');
 const actualPageViews=stats.totalPageViews,displayGrowthCount=actualPageViews*1000;
 if(!Number.isSafeInteger(displayGrowthCount))throw new Error('Unsafe integer growth count');
 return {...stats,actualPageViews,displayGrowthCount};
}
export async function collectStats(token,{request=fetch,now=new Date()}={}){
 const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const property=await call(`https://analyticsadmin.googleapis.com/v1beta/properties/${PROPERTY}`,{headers},request);
 if(property.timeZone!=='Asia/Seoul')throw new Error('Property timezone is not Asia/Seoul; retaining prior stats to avoid incorrect today totals');
 if(!Number.isFinite(Date.parse(property.createTime)))throw new Error('Property creation time unavailable');
 const streams=await call(`https://analyticsadmin.googleapis.com/v1beta/properties/${PROPERTY}/dataStreams?pageSize=200`,{headers},request);
 if(!streams.dataStreams?.some(s=>s.webStreamData?.measurementId==='G-1TS6F1NK5K'))throw new Error('Measurement ID does not match property');
 const today=kstDate(now),start=kstDate(new Date(property.createTime));
 const response=await call(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY}:batchRunReports`,{method:'POST',headers,body:JSON.stringify({requests:[query(start,today),query(today,today)]})},request);
 if(response.reports?.length!==2)throw new Error('Missing reports');
 const stats={totalPageViews:count(response.reports[0]),todayPageViews:count(response.reports[1]),updatedAt:kstTimestamp(now),reportingDate:today,source:'GA4',metric:'page_view',propertyTimeZone:'Asia/Seoul',totalStartDate:start,staleAfterHours:3};
 if(!validStats(stats))throw new Error('Invalid stats totals');return stats;
}
