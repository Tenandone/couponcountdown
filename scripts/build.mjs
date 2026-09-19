import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {locales,localeOrder} from '../src/locales.mjs';
import {home,detail,privacy,escape} from '../src/render.mjs';
const catalog=JSON.parse(await fs.readFile('data/catalog.json','utf8'));
const overrides=JSON.parse(await fs.readFile('data/game-content.json','utf8').catch(()=>'{}'));
const games=catalog.items.map(g=>({...g,...overrides[g.slug]}));
const origin=(process.env.SITE_ORIGIN||'https://couponcountdown.com').replace(/\/$/,'');
const siteConfig=JSON.parse(await fs.readFile('data/site-config.json','utf8'));
const ga=process.env.GA4_MEASUREMENT_ID||siteConfig.ga4MeasurementId;
if(ga&&!/^G-[A-Z0-9]+$/.test(ga))throw new Error('Invalid GA4_MEASUREMENT_ID');
const outputRoot=path.resolve('dist');
if(outputRoot!==path.join(process.cwd(),'dist')||path.dirname(outputRoot)!==process.cwd())throw new Error('Unsafe output path');
await fs.rm(outputRoot,{recursive:true,force:true});
await fs.mkdir('dist/assets',{recursive:true});
async function write(file,value){await fs.mkdir(path.dirname('dist/'+file),{recursive:true});await fs.writeFile('dist/'+file,value);}
const assets={};
for(const [key,file] of [['css','site.css'],['js','site.js']]){const content=await fs.readFile('public/'+file);const hash=createHash('sha256').update(content).digest('hex').slice(0,10);assets[key]=`/assets/site.${hash}.${key}`;await write(assets[key].slice(1),content);}
await fs.cp('public/games','dist/games',{recursive:true});await fs.copyFile('public/favicon.svg','dist/favicon.svg');
for(const file of ['CNAME','naver7a9341e4440758476c83a2a85ef02628.html'])await fs.copyFile(file,'dist/'+file);
const urls=[];
for(const l of localeOrder.filter(x=>locales[x])){
 await write(l+'/index.html',home(l,games,origin,assets,ga));urls.push({l,path:''});
 await write(l+'/privacy/index.html',privacy(l,origin,assets,ga));urls.push({l,path:'privacy/'});
 for(const g of games){await write(`${l}/games/${g.slug}/index.html`,detail(l,g,games,origin,assets,ga));urls.push({l,path:`games/${g.slug}/`});}
}
await write('index.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TikTok & Game Recharge | Coupon Countdown</title><meta name="description" content="Choose your language to find TikTok Coins and game recharge offers."><link rel="canonical" href="${origin}/"><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="${assets.css}"><script type="module" src="${assets.js}"></script>${localeOrder.filter(x=>locales[x]).map(l=>`<link rel="alternate" hreflang="${locales[l].tag}" href="${origin}/${l}/">`).join('')}<link rel="alternate" hreflang="x-default" href="${origin}/en/"></head><body data-root="true"><main class="language-landing"><p class="eyebrow">COUPON COUNTDOWN · RECHARGE HUB</p><h1>TikTok Coins.<br>Your favorite games.</h1><p>Choose your language</p><nav class="language-options">${localeOrder.filter(x=>locales[x]).map(l=>`<a href="/${l}/" lang="${locales[l].tag}" data-language="${l}">${locales[l].label}</a>`).join('')}</nav></main></body></html>`);
await write('404.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not found | Coupon Countdown</title><link rel="stylesheet" href="${assets.css}"></head><body><main class="language-landing"><p>404</p><h1>Let's find your game.</h1><p>This page is no longer available.</p><a class="button" href="/">Find your game →</a></main></body></html>`);
await write('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"><url><loc>${origin}/</loc></url>${urls.map(({l,path})=>`<url><loc>${origin}/${l}/${path}</loc>${localeOrder.filter(x=>locales[x]).map(k=>`<xhtml:link rel="alternate" hreflang="${locales[k].tag}" href="${origin}/${k}/${path}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${origin}/en/${path}"/></url>`).join('')}</urlset>`);
await write('robots.txt',`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
const redirects=JSON.parse(await fs.readFile('data/redirects.json','utf8'));
await write('_redirects',Object.entries(redirects).map(([from,to])=>`${from} ${to} 301`).join('\n')+'\n');
await write('_headers','/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/games/*\n  Cache-Control: public, max-age=86400, stale-while-revalidate=604800\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n');
console.log(`Built ${urls.length+1} pages, ${games.length} products, ${Object.keys(locales).length} locales. JS ${((await fs.stat('dist'+assets.js)).size/1024).toFixed(1)} KiB.`);
