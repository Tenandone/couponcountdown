import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {assets,mergeQuote,validQuote,stateOf,currentFacts} from '../src/markets/data.mjs';
import {normalizeGold,normalizeFX,normalizeIndex,indexWeekChange,fetchGold,collect} from '../src/markets/providers.mjs';
import {marketCopy} from '../src/markets/locales.mjs';
import {localeOrder,locales} from '../src/locales.mjs';
const now='2026-09-20T10:00:00Z';
const quote={price:100,changePercent:1,change7dPercent:2,high:105,low:98,volume:null,updatedAt:now,source:{name:'Test',url:'https://example.com/'}};
test('invalid prices, missing values, old timestamps and failed requests preserve the last good quote',()=>{
 const old=mergeQuote(assets[0],null,quote,now);
 for(const next of [null,{...quote,price:0},{...quote,price:null},{...quote,price:NaN},{...quote,high:null},{...quote,changePercent:null},{...quote,high:10,low:20},{...quote,updatedAt:'2099-01-01T00:00:00Z'},{...quote,updatedAt:'2026-09-19T00:00:00Z'}]){
  const result=mergeQuote(assets[0],old,next,now);assert.equal(result.price,100);assert.equal(result.updatedAt,now);assert.equal(result.status,'stale');
 }
 assert.equal(mergeQuote(assets[0],null,null,now).price,null);
 assert.equal(stateOf(old,Date.parse(now)+4*3600000),'stale');
});
test('providers reject wrong instruments and normalize daily FX without inventing intraday ranges',async()=>{
 assert.throws(()=>normalizeGold({symbol:'ETH',currency:'USD'},assets[0]));
 assert.throws(()=>normalizeIndex({symbol:'ETF'},{}));
 const fx=normalizeFX([{date:'2026-09-11',base:'USD',quote:'KRW',rate:1300},{date:'2026-09-17',base:'USD',quote:'KRW',rate:1350},{date:'2026-09-18',base:'USD',quote:'KRW',rate:1380}]);
 assert.equal(fx.price,1380);assert.ok(Math.abs(fx.changePercent-2.222222222)<0.00001);assert.equal(fx.high,null);assert.equal(fx.changeBasis,'reference');assert.equal(fx.updatedAt,'2026-09-18T00:00:00Z');assert.equal(fx.weekComparisonAt,'2026-09-11');
 let calls=0;await assert.rejects(collect(assets[2],{}, {indices:{}},()=>{calls++;}));assert.equal(calls,0);
 await assert.rejects(collect(assets[2],{MARKET_API_KEY:'test',MARKET_INDEX_DISPLAY_APPROVED:'true'}, {policy:'free-only',indices:{sp500:{symbol:'TEST'}}},()=>{calls++;}),/free-only/);assert.equal(calls,0);
});
test('optional history uses six authenticated windows, distinguishes changes from high/low range, and safely degrades',async()=>{
 let calls=0;
 const request=async url=>{calls++;const u=new URL(url);return{ok:true,json:async()=>u.pathname.startsWith('/price/')?{symbol:'BTC',currency:'USD',price:110,updatedAt:now}:{open:100,close:110,high:115,low:95,startTimestamp:Number(u.searchParams.get('startTimestamp')),endTimestamp:Number(u.searchParams.get('endTimestamp')),highLowChangePercent:999}};};
 const q=await fetchGold(assets[0],{GOLD_API_KEY:'test-only'},request,new Date(now));assert.equal(calls,3);assert.ok(Math.abs(q.changePercent-10)<1e-8);assert.equal(q.high,115);assert.ok(validQuote(q,Date.parse(now)));
 const noHistory=await fetchGold(assets[0],{},request,new Date(now));assert.equal(noHistory.changePercent,null);assert.equal(noHistory.high,null);
});
test('index weekly comparison respects the exchange-local date and rejects the wrong instrument',()=>{
 const mapping={symbol:'TEST',exchange:'TEST-EXCHANGE',timezone:'Asia/Seoul'};
 const history={meta:{symbol:'TEST',exchange:'TEST-EXCHANGE'},values:[{datetime:'2026-09-14',close:'200'},{datetime:'2026-09-11',close:'100'}]};
 const result=indexWeekChange(history,{price:110,updatedAt:'2026-09-20T23:00:00Z'},mapping);
 assert.equal(result.weekComparisonAt,'2026-09-14');assert.equal(result.change7dPercent,-44.99999999999999);
 assert.throws(()=>indexWeekChange({...history,meta:{symbol:'WRONG'}},quote,mapping));
});
test('context requires a reviewed, unexpired first-party citation and matching locale',()=>{
 const fact={reviewed:true,assets:['bitcoin'],text:{ko:'확인된 사실'},sourceUrl:'https://www.federalreserve.gov/newsevents.htm',publishedAt:'2026-09-20T09:00:00Z',expiresAt:'2026-09-21T09:00:00Z'};
 assert.equal(currentFacts([fact],'bitcoin','ko',Date.parse(now)).length,1);
 for(const changed of [{reviewed:false},{sourceUrl:'javascript:alert(1)'},{sourceUrl:'https://fake.example/'},{expiresAt:'2026-09-19'},{expiresAt:'2027-01-01'}])assert.equal(currentFacts([{...fact,...changed}],'bitcoin','ko',Date.parse(now)).length,0);
 assert.equal(currentFacts([fact],'bitcoin','ja',Date.parse(now)).length,0);
});
test('all 64 Markets pages have localized metadata, reciprocal routes, attribution and honest unavailable states',async()=>{
 const snapshot=JSON.parse(await fs.readFile('data/markets/latest.json','utf8'));
 const sitemap=await fs.readFile('dist/sitemap.xml','utf8');
 for(const l of localeOrder){assert.equal(Object.keys(marketCopy[l]).length,Object.keys(marketCopy.en).length);
  for(const slug of ['',...assets.map(x=>x.slug)]){
   const suffix=slug?slug+'/':'';const html=await fs.readFile(`dist/${l}/markets/${suffix}index.html`,'utf8');const d=new JSDOM(html).window.document;
   assert.equal(d.querySelectorAll('h1').length,1);assert.equal(d.querySelector('link[rel=canonical]').href,`https://couponcountdown.com/${l}/markets/${suffix}`);
   assert.equal(d.body.dataset.ga,'G-1TS6F1NK5K');
   for(const k of localeOrder){assert.ok(d.querySelector(`link[hreflang="${locales[k].tag}"]`));assert.equal(d.querySelector(`[data-language="${k}"]`).getAttribute('href'),`/${k}/markets/${suffix}`);}
   assert.equal(d.querySelectorAll('[data-market-event="markets_to_games_click"]').length,1);
   assert.equal(d.querySelector('[data-market-event="markets_to_tiktok_click"]').href,'https://www.tiktok.com/coin?rc=MNN8WQ8P');
   if(slug){const q=snapshot.items.find(x=>x.slug===slug);if(!q.price){assert.equal(d.querySelector('meta[name=robots]').content,'noindex,follow');assert.ok(!sitemap.includes(`<loc>https://couponcountdown.com/${l}/markets/${suffix}</loc>`));}}
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
 const y=await fs.readFile('.github/workflows/update-markets.yml','utf8');assert.ok(y.includes("github.ref == 'refs/heads/main' && vars.MARKETS_AUTOMATION_ENABLED == 'true'"));assert.ok(y.includes('cron: \'23 * * * *\''));assert.ok(!y.includes('--force'));assert.ok(y.indexOf('npm test')<y.indexOf('git push'));
 const s=await fs.readFile('scripts/request-pages-build.mjs','utf8');assert.ok(!s.includes("'PUT'"));assert.ok(s.includes("settings.cname!=='couponcountdown.com'"));
});
