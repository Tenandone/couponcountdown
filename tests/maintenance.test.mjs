import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {maintenanceLabels,underMaintenance} from '../src/availability.mjs';
const items=JSON.parse(await fs.readFile('data/catalog.json','utf8')).items;
test('only the two maintenance games move to the end; all locales retain URLs and detail SEO',async()=>{
 for(const [l,label]of Object.entries(maintenanceLabels)){
  const dom=new JSDOM(await fs.readFile('dist/'+l+'/index.html','utf8')),d=dom.window.document;
  const slugs=[...d.querySelectorAll('#all-grid .game-card')].map(x=>x.dataset.slug);
  assert.deepEqual(slugs.slice(-2),['kingshot','whiteout-survival']);
  assert.deepEqual(slugs.slice(0,-2),items.filter(x=>!underMaintenance(x)).map(x=>x.slug));
  for(const slug of ['kingshot','whiteout-survival']){
   assert.equal(d.querySelector('#popular [data-slug="'+slug+'"]'),null);
   const card=d.querySelector('#all-grid [data-slug="'+slug+'"]');
   assert.equal(card.querySelector('[data-maintenance]').textContent,label);
   assert.equal(card.querySelector('[data-outbound]'),null);
   assert.equal(card.querySelector('[data-maintenance]').dataset.destination,items.find(x=>x.slug===slug).url);
   const detail=new JSDOM(await fs.readFile('dist/'+l+'/games/'+slug+'/index.html','utf8')),p=detail.window.document;
   assert.ok(p.querySelector('link[rel="canonical"]'));
   for(const selector of ['.product','.mobile-sticky'])assert.ok(p.querySelector(selector+' [data-maintenance]').disabled);
   assert.equal(p.querySelector('.related [data-slug="kingshot"],.related [data-slug="whiteout-survival"]'),null);
   detail.window.close();
  }dom.window.close();
 }
});
