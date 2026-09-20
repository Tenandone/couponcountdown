import {JSDOM} from 'jsdom';
export const feeds=[
 {id:'cpi',url:'https://www.bls.gov/feed/cpi.rss',name:'U.S. Bureau of Labor Statistics'},
 {id:'ppi',url:'https://www.bls.gov/feed/ppi.rss',name:'U.S. Bureau of Labor Statistics'},
 {id:'employment',url:'https://www.bls.gov/feed/empsit.rss',name:'U.S. Bureau of Labor Statistics'},
 {id:'fed',url:'https://www.federalreserve.gov/feeds/press_monetary.xml',name:'Federal Reserve Board'},
];
export const calendars={bls:'https://www.bls.gov/schedule/news_release/bls.ics',fed:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'};
const within=(date,start,end)=>Date.parse(date)>=Date.parse(start)&&Date.parse(date)<Date.parse(end);
const safeURL=(s,host)=>{try{const u=new URL(s);return u.protocol==='https:'&&u.hostname===host?u.href:null;}catch{return null;}};
export function parseFeed(xml,feed,week){
 const dom=new JSDOM(xml,{contentType:'text/xml'}),d=dom.window.document,host=new URL(feed.url).hostname,result=[];
 for(const e of d.querySelectorAll('item,entry')){
  const publishedAt=e.querySelector('pubDate,published')?.textContent?.trim(),title=e.querySelector('title')?.textContent?.trim();
  const link=e.querySelector('link'),url=safeURL(link?.getAttribute('href')||link?.textContent?.trim(),host);
  if(title&&title.length<=350&&url&&within(publishedAt,week.start,week.endExclusive))result.push({kind:feed.id,title,sourceUrl:url,sourceName:feed.name,publishedAt:new Date(publishedAt).toISOString(),scope:'shared-macro'});
 }
 dom.window.close();return result;
}
const calendarKinds=[[/^Consumer Price Index$/i,'cpi'],[/^Producer Price Index$/i,'ppi'],[/^Employment Situation$/i,'employment'],[/^Job Openings and Labor Turnover Survey$/i,'jolts'],[/^U.S. Import and Export Price Indexes$/i,'trade-prices'],[/^Employment Cost Index$/i,'employment-cost']];
export function parseBLSCalendar(text,week){
 if(!text.includes('BEGIN:VCALENDAR'))throw new Error('Invalid BLS calendar');
 const events=[];
 for(const block of text.replace(/\r?\n[ \t]/g,'').split('BEGIN:VEVENT').slice(1)){
  if(/^STATUS:CANCELLED\s*$/m.test(block))continue;
  const title=block.match(/^SUMMARY:(.+)$/m)?.[1].trim(),kind=calendarKinds.find(([rx])=>rx.test(title||''))?.[1];
  const raw=block.match(/^DTSTART(?:;TZID=([^:\r\n]+))?:(\d{8})T(\d{6})(Z?)\s*$/m);
  if(!kind||!raw)continue;
  const date=`${raw[2].slice(0,4)}-${raw[2].slice(4,6)}-${raw[2].slice(6,8)}`;
  if(!within(date,week.endExclusive,week.nextEndExclusive))continue;
  // Preserve Eastern local time; do not assume a fixed UTC offset through DST.
  if(!raw[4]&&!['US-Eastern','America/New_York'].includes(raw[1]))continue;
  events.push({kind,title,date,localTime:`${raw[3].slice(0,2)}:${raw[3].slice(2,4)}`,timezone:raw[4]?'UTC':'America/New_York',sourceUrl:calendars.bls,sourceName:'U.S. Bureau of Labor Statistics'});
 }
 return events;
}
export function parseFedCalendar(html,week){
 const dom=new JSDOM(html),d=dom.window.document,events=[];
 const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const panels=[...d.querySelectorAll('.panel')].filter(x=>/^\d{4} FOMC Meetings/.test(x.querySelector('h4')?.textContent.trim()||''));
 if(!panels.length)throw new Error('FOMC calendar layout changed');
 for(const panel of panels){const year=panel.querySelector('h4').textContent.trim().slice(0,4);
  for(const row of panel.querySelectorAll('.fomc-meeting')){
   const month=months.indexOf(row.querySelector('.fomc-meeting__month')?.textContent.trim());
   const days=row.querySelector('.fomc-meeting__date')?.textContent.trim().match(/^(\d{1,2})(?:[-–](\d{1,2}))?\*?$/);
   if(month<0||!days)continue;
   const date=`${year}-${String(month+1).padStart(2,'0')}-${String(days[2]||days[1]).padStart(2,'0')}`;
   if(within(date,week.endExclusive,week.nextEndExclusive))events.push({kind:'fomc',title:'FOMC meeting — final day',date,localTime:null,timezone:'America/New_York',sourceUrl:calendars.fed,sourceName:'Federal Reserve Board'});
  }
 }
 dom.window.close();return events;
}
export async function collectContext(week,previous,request=fetch){
 const sourceStatus=[],issues=[],events=[];
 const run=async(id,url,parser,kind)=>{
  try{const r=await request(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('Source unavailable');const items=parser(await r.text());
   for(const item of items)(kind==='issues'?issues:events).push({...item,feedId:id});sourceStatus.push({id,status:'ok'});
  }catch{console.warn(`::warning::Weekly context ${id}: source unavailable`);sourceStatus.push({id,status:'failed'});
   if(previous?.week.id===week.id)for(const item of previous[kind]||[])if(item.feedId===id)(kind==='issues'?issues:events).push(item);
  }
 };
 for(const f of feeds)await run(f.id,f.url,xml=>parseFeed(xml,f,week),'issues');
 await run('bls-calendar',calendars.bls,text=>parseBLSCalendar(text,week),'events');
 await run('fed-calendar',calendars.fed,html=>parseFedCalendar(html,week),'events');
 const unique=(items,key)=>[...new Map(items.map(x=>[key(x),x])).values()];
 return {issues:unique(issues,x=>x.sourceUrl).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,5),events:unique(events,x=>x.kind+x.date).sort((a,b)=>a.date.localeCompare(b.date)),sourceStatus};
}
