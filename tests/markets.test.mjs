import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {assets} from '../src/markets/data.mjs';
import {completedWeek,validWeekly,normalizeWeeklyFX,normalizeWeeklyOHLC,preserveWeekly,fetchWeeklyAsset,assembleWeekly} from '../src/markets/weekly.mjs';
import {parseFeed,parseBLSCalendar,parseFedCalendar,feeds} from '../src/markets/weekly-sources.mjs';
import {weeklyCopy as marketCopy} from '../src/markets/weekly-copy.mjs';
import {localeOrder,locales} from '../src/locales.mjs';
const week=completedWeek(new Date('2026-09-20T12:00:00Z'));
test('completed UTC weeks handle Sundays, Monday boundaries and year transitions',()=>{
 assert.equal(week.id,'2026-09-07');assert.equal(week.endExclusive,'2026-09-14T00:00:00.000Z');
 assert.equal(completedWeek(new Date('2026-09-21T00:00:00Z')).id,'2026-09-14');
 assert.equal(completedWeek(new Date('2026-01-05T00:23:00Z')).id,'2025-12-29');
});
test('weekly OHLC validates exact window, computes start-to-end return and preserves only the same week',()=>{
 const raw={open:100,close:110,high:120,low:90,startTimestamp:Date.parse(week.start)/1000,endTimestamp:Date.parse(week.endExclusive)/1000-1};
 const q=normalizeWeeklyOHLC(raw,week);assert.ok(Math.abs(q.changePercent-10)<1e-8);assert.ok(validWeekly(q,week));
 for(const changes of [{open:0},{close:null},{high:105},{low:111},{startTimestamp:raw.startTimestamp+1}])assert.throws(()=>normalizeWeeklyOHLC({...raw,...changes},week));
 assert.equal(preserveWeekly(assets[0],week,null,q).status,'retained');
 assert.equal(preserveWeekly(assets[0],week,null,{...q,weekId:'2026-08-31'}).startPrice,null);
 assert.equal(assembleWeekly(week,[],{issues:[],events:[],sourceStatus:[]},null,new Date().toISOString()).usable,false);
});
test('FX weekly ranges use only the requested reference days and cannot use prior-week padding',()=>{
 const raw=[{date:'2026-09-04',base:'USD',quote:'KRW',rate:9999},{date:'2026-09-07',base:'USD',quote:'KRW',rate:1300},{date:'2026-09-11',base:'USD',quote:'KRW',rate:1320},{date:'2026-09-14',base:'USD',quote:'KRW',rate:9999}];
 const q=normalizeWeeklyFX(raw,week);assert.equal(q.startPrice,1300);assert.equal(q.endPrice,1320);assert.equal(q.high,1320);assert.equal(q.rangeBasis,'daily-reference');
 assert.throws(()=>normalizeWeeklyFX(raw.slice(0,2),week));
});
test('free weekly fetch makes one OHLC request, no current-price calls, and blocks index calls',async()=>{
 const calls=[];const req=async(url,opts)=>{calls.push({url,opts});return{ok:true,json:async()=>({open:100,close:110,high:120,low:90,startTimestamp:Date.parse(week.start)/1000,endTimestamp:Date.parse(week.endExclusive)/1000-1})};};
 await fetchWeeklyAsset(assets[0],week,{GOLD_API_KEY:'fixture'},req);assert.equal(calls.length,1);assert.ok(calls[0].url.includes('/ohlc/BTC'));assert.ok(!calls[0].url.includes('fixture'));assert.equal(calls[0].opts.headers['x-api-key'],'fixture');
 await assert.rejects(fetchWeeklyAsset(assets[2],week,{MARKET_API_KEY:'fixture'},req));assert.equal(calls.length,1);
 await assert.rejects(fetchWeeklyAsset(assets[0],week,{},req));assert.equal(calls.length,1);
});
test('source parsing excludes out-of-week releases, hostile links and unsupported calendar dates',()=>{
 const xml='<rss><channel><item><title>Verified release</title><link>https://www.bls.gov/news.release/test.htm</link><pubDate>Fri, 11 Sep 2026 12:30:00 GMT</pubDate></item><item><title>Outside</title><link>https://www.bls.gov/test.htm</link><pubDate>Mon, 14 Sep 2026 12:30:00 GMT</pubDate></item><item><title>Hostile</title><link>https://example.com</link><pubDate>Fri, 11 Sep 2026 12:30:00 GMT</pubDate></item></channel></rss>';
 assert.equal(parseFeed(xml,feeds[0],week).length,1);
 const ics='BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;TZID=US-Eastern:20260916T083000\nSUMMARY:Consumer Price Index\nEND:VEVENT\nEND:VCALENDAR';
 const e=parseBLSCalendar(ics,week);assert.equal(e.length,1);assert.equal(e[0].timezone,'America/New_York');assert.equal(e[0].localTime,'08:30');
 assert.equal(parseBLSCalendar(ics.replace('20260916','20260921'),week).length,0);
 assert.equal(parseBLSCalendar(ics.replace('SUMMARY:','STATUS:CANCELLED\nSUMMARY:'),week).length,0);
 const html='<div class="panel"><h4>2026 FOMC Meetings</h4><div class="fomc-meeting"><span class="fomc-meeting__month">September</span><span class="fomc-meeting__date">15-16*</span></div></div>';
 assert.equal(parseFedCalendar(html,week)[0].date,'2026-09-16');assert.throws(()=>parseFedCalendar('<h1>Missing</h1>',week));
});
test('all Markets and weekly archive pages have localized metadata, reciprocal routes, attribution and honest unavailable states',async()=>{
 const idx=JSON.parse(await fs.readFile('data/markets/weekly-index.json','utf8'));
 const snapshot=JSON.parse(await fs.readFile('data/markets/weeks/'+idx.latest+'.json','utf8'));
 const sitemap=await fs.readFile('dist/sitemap.xml','utf8');
 for(const l of localeOrder){assert.equal(Object.keys(marketCopy[l]).length,Object.keys(marketCopy.en).length);
  for(const slug of ['',...assets.map(x=>x.slug),...idx.weeks.map(x=>'weeks/'+x)]){
   const suffix=slug?slug+'/':'';const html=await fs.readFile(`dist/${l}/markets/${suffix}index.html`,'utf8');const d=new JSDOM(html).window.document;
   assert.equal(d.querySelectorAll('h1').length,1);assert.equal(d.querySelector('link[rel=canonical]').href,`https://couponcountdown.com/${l}/markets/${suffix}`);
   assert.equal(d.body.dataset.ga,'G-1TS6F1NK5K');
   for(const k of localeOrder){assert.ok(d.querySelector(`link[hreflang="${locales[k].tag}"]`));assert.equal(d.querySelector(`[data-language="${k}"]`).getAttribute('href'),`/${k}/markets/${suffix}`);}
   assert.equal(d.querySelectorAll('[data-market-event="markets_to_games_click"]').length,1);
   assert.equal(d.querySelector('[data-market-event="markets_to_tiktok_click"]').href,'https://www.tiktok.com/coin?rc=MNN8WQ8P');
   if(slug&&!slug.startsWith('weeks/')){const q=snapshot.items.find(x=>x.slug===slug);if(!validWeekly(q,snapshot.week)){assert.equal(d.querySelector('meta[name=robots]').content,'noindex,follow');assert.ok(!sitemap.includes(`<loc>https://couponcountdown.com/${l}/markets/${suffix}</loc>`));}}
   else assert.equal(d.querySelectorAll('.market-row').length,7);
  }
 }
});
test('Markets analytics sends one event per action with consent and preserves canonical outbound conversion',async()=>{
 const html=await fs.readFile('dist/en/markets/index.html','utf8');const js=await fs.readFile('public/site.js','utf8');
 const dom=new JSDOM(html,{url:'https://couponcountdown.com/en/markets/',runScripts:'outside-only'});const w=dom.window;
 try{w.matchMedia=()=>({matches:false});w.localStorage.setItem('cc-consent','"yes"');w.document.addEventListener('click',e=>e.preventDefault());w.eval(js);
  for(const s of ['market_asset_click','markets_to_games_click','markets_to_tiktok_click'])w.document.querySelector(`[data-market-event="${s}"]`).click();
  for(const name of ['market_page_view','market_asset_click','markets_to_games_click','markets_to_tiktok_click','outbound_recharge_click']){
   const ev=w.dataLayer.filter(e=>e[0]==='event'&&e[1]===name);assert.equal(ev.length,1,name);if(name!=='outbound_recharge_click')for(const k of ['asset','locale','page','source_section'])assert.ok(k in ev[0][2]);
  }
  assert.equal(w.dataLayer.filter(e=>e[1]==='hub_view').length,0);
 }finally{w.close();}
});
test('scheduled publishing is opt-in, main-only and preserves Pages settings',async()=>{
 const y=await fs.readFile('.github/workflows/update-markets.yml','utf8');assert.ok(y.includes("github.ref == 'refs/heads/main' && vars.MARKETS_AUTOMATION_ENABLED == 'true'"));assert.ok(y.includes('cron: \'23 0 * * 1\''));assert.ok(!y.includes('--force'));assert.ok(y.indexOf('npm test')<y.indexOf('git push'));
 const s=await fs.readFile('scripts/request-pages-build.mjs','utf8');assert.ok(!s.includes("'PUT'"));assert.ok(s.includes("settings.cname!=='couponcountdown.com'"));
});
