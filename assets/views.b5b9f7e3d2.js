export function formatViews(n,locale){const scale=n>=1e6?1e6:n>=1e3?1e3:1;const rounded=scale===1?n:Math.floor(n/scale*10)/10;return new Intl.NumberFormat(locale,{maximumFractionDigits:scale===1?0:1,useGrouping:false}).format(rounded)+(scale===1e6?'M':scale===1e3?'K':'');}
export function usableStats(s,now=Date.now()){
 const age=now-Date.parse(s?.updatedAt);const today=new Date(now+9*3600000).toISOString().slice(0,10);
 return s?.source==='GA4'&&s.metric==='page_view'&&s.propertyTimeZone==='Asia/Seoul'&&Number.isSafeInteger(s.totalPageViews)&&s.totalPageViews>=0&&Number.isSafeInteger(s.todayPageViews)&&s.todayPageViews>=0&&s.todayPageViews<=s.totalPageViews&&s.reportingDate===today&&age>=-300000&&age<=3*3600000;
}
export async function loadViews(element,{request=fetch,now=Date.now(),locale='en'}={}){
 try{const r=await request('/data/stats.json?h='+Math.floor(now/3600000),{cache:'no-cache',credentials:'omit',signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error('unavailable');const s=await r.json();if(!usableStats(s,now))throw new Error('stale');
 element.querySelector('[data-total-views]').textContent=element.dataset.totalLabel.replace('{n}',formatViews(s.totalPageViews,locale));
 element.querySelector('[data-today-views]').textContent=element.dataset.todayLabel.replace('{n}',formatViews(s.todayPageViews,locale));
 const time=new Intl.DateTimeFormat(locale,{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(s.updatedAt));
 element.querySelector('[data-stats-time]').textContent=element.dataset.updatedLabel+' '+time+' KST';element.dataset.state='ready';element.removeAttribute('aria-hidden');
 }catch{element.dataset.state='unavailable';element.setAttribute('aria-hidden','true');}
}
if(typeof document!=='undefined'){
 const el=document.querySelector('[data-page-views]');if(el&&typeof fetch==='function'){
 const run=()=>loadViews(el,{locale:document.documentElement.lang||'en'});
 if('requestIdleCallback' in window)window.requestIdleCallback(run,{timeout:2000});else setTimeout(run,0);
 }
}
