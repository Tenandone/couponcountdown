import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {TIKTOK} from '../src/render.mjs';
async function htmlFiles(dir){const out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())out.push(...await htmlFiles(p));else if(e.name.endsWith('.html'))out.push(p);}return out;}
test('all generated local links and icon assets resolve; TikTok and LootBar destinations remain exact',async()=>{
 const catalog=JSON.parse(await fs.readFile('data/catalog.json','utf8')).items;const allowed=new Set(catalog.map(g=>g.url));const targets=new Set();let tiktokCount=0,lootbarCount=0;
 for(const file of await htmlFiles('dist')){const h=await fs.readFile(file,'utf8');
  for(const [,v]of h.matchAll(/(?:href|src)="([^"#]+)"/g)){const u=new URL(v,'https://couponcountdown.com');if(u.hostname==='couponcountdown.com'){targets.add('dist'+u.pathname+(u.pathname.endsWith('/')?'index.html':''));}else if(u.hostname.includes('tiktok.com')){assert.equal(v,TIKTOK,file);tiktokCount++;}else if(u.hostname.includes('lootbar.com')){assert.ok(allowed.has(v),file+':'+v);lootbarCount++;}}
  if(/data-locale=/.test(h)){assert.ok(h.includes('data-ga="G-1TS6F1NK5K"'));assert.ok(h.includes('https://couponcountdown.com/icons/recharge-og-v3.png'));assert.ok(!h.includes('chatgpt.site'));}
 }
 for(const p of targets)await fs.access(p);assert.ok(tiktokCount>=16);assert.ok(lootbarCount>238);
 console.log(JSON.stringify({localTargets:targets.size,tiktokCTAInstances:tiktokCount,lootbarCTAInstances:lootbarCount}));
});
test('favicon, touch icons, manifest and legacy URL stubs are ready for Pages root deployment',async()=>{
 for(const [name,size]of [['favicon-16x16.png',16],['favicon-32x32.png',32],['apple-touch-icon.png',180],['icon-192.png',192],['icon-512.png',512]]){const m=await sharp('dist/icons/'+name).metadata();assert.equal(m.width,size);assert.equal(m.height,size);}
 const ico=await fs.readFile('dist/favicon.ico');assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3);
 const manifest=JSON.parse(await fs.readFile('dist/site.webmanifest','utf8'));for(const i of manifest.icons)await fs.access('dist'+i.src.split('?')[0]);
 assert.equal((await fs.readFile('dist/CNAME','utf8')).trim(),'couponcountdown.com');await fs.access('dist/.nojekyll');
 const redirects=JSON.parse(await fs.readFile('data/redirects.json','utf8'));for(const [from,to]of Object.entries(redirects)){if(!from.endsWith('/')&&!from.endsWith('.html'))continue;const h=await fs.readFile('dist'+from+(from.endsWith('/')?'index.html':''),'utf8');assert.ok(h.includes('location.replace'));assert.ok(h.includes('href="https://couponcountdown.com'+to+'"'));}
});
