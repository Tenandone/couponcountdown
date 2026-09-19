import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {locales,localeOrder} from '../src/locales.mjs';
import {escape,TIKTOK,detail} from '../src/render.mjs';
const catalog=JSON.parse(await fs.readFile('data/catalog.json','utf8'));
const raw=JSON.parse(await fs.readFile('data/lootbar-catalog.raw.json','utf8'));
const content=JSON.parse(await fs.readFile('data/game-content.json','utf8'));
test('All source products are present with real images and browser-verified Ten attribution',async()=>{
 assert.equal(catalog.items.length,238);assert.equal(new Set(catalog.items.map(x=>x.slug)).size,238);
 assert.equal(catalog.items.filter(x=>x.category==='top-up').length,192);
 const urls=new Set(raw.items.map(x=>x.url));
 for(const g of catalog.items){assert.ok(urls.has(g.url),g.slug);assert.equal(g.httpStatus,200);assert.ok(g.renderedVerification.heading,g.slug);assert.ok(g.renderedVerification.referralRetained,g.slug);assert.ok(g.imageVerified);assert.ok((await fs.stat('public'+g.localImage)).size>100);assert.ok(content[g.slug].names.en);}
});
test('Every locale is complete and regional Spanish is independently configurable',()=>{
 assert.deepEqual([...Object.keys(locales)].sort(),[...localeOrder].sort());
 for(const l of localeOrder)for(const k of Object.keys(locales.en))assert.equal(typeof locales[l][k],typeof locales.en[k],`${l}.${k}`);
 assert.notEqual(locales['es-419'].gameDescription,locales['es-es'].gameDescription);
});
test('All generated pages have correct canonical, 8 reciprocal alternates, one H1 and parseable schema',async()=>{
 for(const l of localeOrder){for(const suffix of ['', 'privacy/',...catalog.items.map(g=>`games/${g.slug}/`)]){
  const html=await fs.readFile(`dist/${l}/${suffix}index.html`,'utf8');
  assert.ok(html.includes(`<html lang="${locales[l].tag}">`));
  assert.ok(html.includes('data-ga="G-1TS6F1NK5K"'),`Missing legacy GA ID: ${l}/${suffix}`);
  assert.equal((html.match(/<h1[ >]/g)||[]).length,1,`${l}/${suffix}`);
  assert.ok(html.includes(`rel="canonical" href="https://couponcountdown.com/${l}/${suffix}"`));
  for(const alt of localeOrder)assert.ok(html.includes(`hreflang="${locales[alt].tag}" href="https://couponcountdown.com/${alt}/${suffix}"`));
  assert.ok(!/undefined|null<|src=""|src="undefined"/.test(html));
  for(const block of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)){const data=JSON.parse(block[1]);assert.ok(data['@context']);}
 }}
});
test('All static internal page and asset targets resolve; no guessed outbound destinations',async()=>{
 for(const l of localeOrder){const html=await fs.readFile(`dist/${l}/index.html`,'utf8');
  for(const [,url] of html.matchAll(/(?:href|src)="(\/[^"#]*)"/g)){await fs.access(path.join('dist',url.endsWith('/')?url+'index.html':url));}
  const links=[...html.matchAll(/href="(https:\/\/(?:www\.)?(?:lootbar|tiktok)\.com[^\"]+)"/g)].map(x=>x[1]);
  const expected=new Set([TIKTOK,...catalog.items.map(x=>x.url)]);links.forEach(x=>assert.ok(expected.has(x),x));
 }});
test('Sitemap covers every locale product and redirects preserve existing game intent',async()=>{
 const sitemap=await fs.readFile('dist/sitemap.xml','utf8');assert.equal((sitemap.match(/<loc>/g)||[]).length,1921);
 const redirects=JSON.parse(await fs.readFile('data/redirects.json','utf8'));
 for(const key of ['/wos/','/kingshot/','/lastwar/','/tilessurvive/'])await fs.access('dist'+redirects[key]+'index.html');
 assert.ok((await fs.readFile('dist/robots.txt','utf8')).includes('https://couponcountdown.com/sitemap.xml'));
});
test('Editorial overrides and escaping work without changing the direct URL',()=>{
 const g={...catalog.items[0],names:{en:'A <Test>'},content:{en:{title:'Custom title',description:'Custom description',h1:'Custom H1',cta:'Custom CTA',faq:[['Question?','Answer.']]}}};
 const html=detail('en',g,catalog.items,'https://couponcountdown.com',{css:'/a.css',js:'/a.js'},'');
 for(const value of ['Custom title','Custom description','Custom H1','Custom CTA','Question?'])assert.ok(html.includes(value));
 assert.ok(html.includes(g.url));assert.equal(escape('<script>"&'), '&lt;script&gt;&quot;&amp;');
});
