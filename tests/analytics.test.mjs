import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const source=await fs.readFile('public/site.js','utf8');
const html=await fs.readFile('dist/en/index.html','utf8');
function fixture(consent='yes',recent=[]){
  // No resource loader: tests cannot send events to the production GA property.
  const dom=new JSDOM(html,{url:'https://couponcountdown.com/en/',runScripts:'outside-only'});
  const w=dom.window,d=w.document;
  w.matchMedia=()=>({matches:true});
  w.localStorage.setItem('cc-consent',JSON.stringify(consent));w.localStorage.setItem('cc-recent',JSON.stringify(recent));
  const events=[];d.addEventListener('cc:analytics',e=>events.push(e.detail));
  d.addEventListener('click',e=>e.preventDefault());
  w.eval(source);
  return{dom,w,d,events,forwarded:()=>w.dataLayer.filter(x=>x[0]==='event'),click:selector=>d.querySelector(selector).click()};
}
test('restores the original Measurement ID, loads GA only after consent and initializes once',()=>{
  const f=fixture('no');try{
    assert.equal(f.d.body.dataset.ga,'G-1TS6F1NK5K');
    assert.equal(f.w.dataLayer.length,0);
    f.click('.hero-actions [data-outbound]');assert.equal(f.w.dataLayer.length,0);
    f.click('[data-consent="yes"]');f.click('[data-consent="yes"]');
    const config=f.w.dataLayer.filter(x=>x[0]==='config');
    assert.equal(config.length,1);assert.equal(config[0][1],'G-1TS6F1NK5K');
    assert.equal(f.d.querySelectorAll('script[src*="googletagmanager.com/gtag/js?id=G-1TS6F1NK5K"]').length,1);
    f.click('[data-consent="no"]');const count=f.w.dataLayer.length;
    f.click('.hero-actions [data-outbound]');assert.equal(f.w.dataLayer.length,count);
    f.click('[data-consent="yes"]');f.click('.hero-actions [data-outbound]');
    assert.ok(f.forwarded().some(x=>x[1]==='tiktok_cta_click'));
    assert.equal(f.w.dataLayer.filter(x=>x[0]==='config').length,1);
  }finally{f.dom.window.close();}
});
test('outbound, card, sticky and language events preserve destination and dimensions',()=>{
  const f=fixture();try{
    f.click('.hero-actions [data-outbound]');
    f.click('#all-grid [data-slug="tiles-survive"] [data-outbound]');
    f.click('[data-position="sticky"]');
    f.click('[data-language="ja"]');
    for(const name of ['tiktok_cta_click','lootbar_click','game_card_click','sticky_cta_click','language_change']){
      const event=f.forwarded().find(x=>x[1]===name);assert.ok(event,name);
      const p=event[2];for(const k of ['game','locale','page','cta_position','destination'])assert.ok(k in p,name+':'+k);
      assert.equal(p.locale,'en');assert.equal(p.page,'/en/');assert.equal(p.transport_type,'beacon');
      assert.ok(p.destination.startsWith('https://'));
    }
    const tiktok=f.events.find(x=>x.event==='tiktok_cta_click');
    assert.equal(tiktok.destination,'https://www.tiktok.com/coin?rc=MNN8WQ8P');
    const lootbar=f.events.find(x=>x.event==='lootbar_click');
    assert.equal(lootbar.game,'tiles-survive');assert.ok(lootbar.destination.includes('/shop/ten/'));
    assert.equal(f.events.filter(x=>x.event==='outbound_recharge_click').length,3);
    assert.equal(f.events.find(x=>x.event==='language_change').target_locale,'ja');
  }finally{f.dom.window.close();}
});
test('middle-click counts once; right-click does not count; internal cards do not count as outbound',()=>{
  const f=fixture();try{
    const a=f.d.querySelector('#all-grid [data-slug="tiles-survive"] [data-outbound]');
    a.dispatchEvent(new f.w.MouseEvent('auxclick',{button:1,bubbles:true}));
    a.dispatchEvent(new f.w.MouseEvent('auxclick',{button:2,bubbles:true}));
    f.click('#all-grid [data-slug="tiles-survive"] h3 a');
    assert.equal(f.events.filter(x=>x.event==='outbound_recharge_click').length,1);
    assert.equal(f.events.filter(x=>x.event==='game_card_click').length,2);
    assert.equal(f.events.filter(x=>x.event==='game_card_click').at(-1).interaction,'details');
  }finally{f.dom.window.close();}
});
test('game search debounces, deduplicates, attributes the game and never sends raw input',async()=>{
  const f=fixture();try{
    const input=f.d.querySelector('#game-search');
    const set=value=>{input.value=value;input.dispatchEvent(new f.w.Event('input',{bubbles:true}));};
    set('t');set('tile');set('tiles');
    await new Promise(r=>setTimeout(r,400));
    let events=f.forwarded().filter(x=>x[1]==='game_search');assert.equal(events.length,1);
    assert.equal(events[0][2].game,'tiles-survive');assert.equal(events[0][2].result_count,1);
    assert.equal(events[0][2].query_length,5);assert.ok(!('search_term' in events[0][2]));
    set('tiles');await new Promise(r=>setTimeout(r,400));
    assert.equal(f.forwarded().filter(x=>x[1]==='game_search').length,1);
    set('clear pending');f.click('[data-reset]');await new Promise(r=>setTimeout(r,400));
    assert.equal(f.forwarded().filter(x=>x[1]==='game_search').length,1);
    f.click('[data-query]');assert.equal(f.forwarded().filter(x=>x[1]==='game_search').at(-1)[2].cta_position,'quick_pick');
  }finally{f.dom.window.close();}
});
test('catalog progressively reveals all 238 products and searches beyond the initial twelve',()=>{
  const f=fixture('no');try{
    const visible=()=>f.d.querySelectorAll('#all-grid .game-card:not([hidden])');
    assert.equal(visible().length,12);
    for(let i=0;i<10;i++)f.click('[data-show-more]');
    assert.equal(visible().length,238);assert.ok(f.d.querySelector('[data-show-more]').hidden);
    f.click('[data-reset]');assert.equal(visible().length,12);
    const last=f.d.querySelector('#all-grid .game-card:last-child').dataset.slug;
    const input=f.d.querySelector('#game-search');input.value=last;
    input.dispatchEvent(new f.w.Event('input',{bubbles:true}));
    assert.ok([...visible()].some(x=>x.dataset.slug===last));
    assert.ok(f.d.querySelector('.catalog .link-reason').hidden);
  }finally{f.dom.window.close();}
});

test('maintenance games stay searchable but never appear in recent recommendations or emit recharge events',()=>{
 const f=fixture('yes',['kingshot','whiteout-survival','genshin-impact']);try{
  assert.equal(f.d.querySelectorAll('.recent-list a').length,1);
  assert.equal(f.d.querySelector('.recent-list a').dataset.game,'genshin-impact');
  for(const query of ['KingShot','WOS']){const input=f.d.querySelector('#game-search');input.value=query;input.dispatchEvent(new f.w.Event('input',{bubbles:true}));assert.ok(f.d.querySelector('#all-grid .game-card:not([hidden]) [data-maintenance]'));}
  const count=f.events.filter(x=>x.event==='outbound_recharge_click').length;
  f.click('#all-grid [data-slug="kingshot"] [data-maintenance]');
  assert.equal(f.events.filter(x=>x.event==='outbound_recharge_click').length,count);
 }finally{f.dom.window.close();}
});
