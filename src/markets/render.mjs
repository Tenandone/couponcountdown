import {head,header,footer,escape,TIKTOK} from '../render.mjs';
import {locales} from '../locales.mjs';
import {assets} from './data.mjs';
import {validWeekly} from './weekly.mjs';
import {marketCopy,names} from './locales.mjs';
import {weeklyCopy,finishCopy} from './weekly-copy.mjs';
const nameFor=(slug,l)=>names[l][assets.findIndex(a=>a.slug===slug)];
const value=(n,l)=>Number.isFinite(n)?new Intl.NumberFormat(locales[l].tag,{maximumFractionDigits:2,minimumFractionDigits:2}).format(n):'—';
const delta=(n,l)=>Number.isFinite(n)?`${n>0?'↑ +':n<0?'↓ ':''}${value(n,l)}%`:'—';
const date=(s,l)=>new Intl.DateTimeFormat(locales[l].tag,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(s));
const jsonLD=x=>`<script type="application/ld+json">${JSON.stringify(x).replaceAll('<','\\u003c')}</script>`;
function unit(q,t){return q.unit==='points'?t.points:q.unit==='troy-oz'?t.ounce:q.unit==='per-usd'?t.perUsd:q.currency;}
function status(q,t){return q.status==='pending'?t.pending:q.status==='retained'?t.retained:'';}
function metrics(q,l){const t=weeklyCopy[l];return `<dl class="weekly-metrics">${[['startPrice',t.start],['endPrice',t.end],['high',t.high],['low',t.low]].map(([key,label])=>`<div><dt>${label}</dt><dd>${value(q[key],l)}</dd></div>`).join('')}</dl>`;}
function issues(report,l){const t=weeklyCopy[l];return `<section class="weekly-context" id="weekly-context"><h2>${t.issues}</h2><p class="market-note">${t.contextNote}</p>${report.issues.length?`<ul>${report.issues.map(i=>`<li><a href="${escape(i.sourceUrl)}" rel="noopener" target="_blank"><strong>${escape(t[i.kind]||t.checked)}</strong> ↗</a><span class="market-note">${date(i.publishedAt,l)} · ${escape(i.sourceName)}</span><details><summary>${t.original}</summary><p lang="en">${escape(i.title)}</p></details></li>`).join('')}</ul>`:''}${report.issues.length<2?`<p class="market-note">${t.noIssues}</p>`:''}</section>`;}
function calendar(report,l){if(!report.events.length)return '';const t=weeklyCopy[l];return `<section class="weekly-calendar"><h2>${t.next}</h2><p class="market-note">${date(report.week.endExclusive,l)} – ${date(new Date(Date.parse(report.week.nextEndExclusive)-86400000).toISOString(),l)}</p>${report.events.length?`<ul>${report.events.map(e=>`<li><time datetime="${e.date}">${date(e.date,l)}</time><div><a href="${escape(e.sourceUrl)}" target="_blank" rel="noopener">${escape(t[e.kind]||e.title)} ↗</a><small>${e.localTime?escape(e.localTime)+' · ':''}${escape(e.timezone)} · ${escape(e.sourceName)}</small></div></li>`).join('')}</ul>`:`<p>${t.noEvents}</p>`}<p class="market-note">${t.calendarNote}</p></section>`;}
function cross(l,asset){const t={...marketCopy[l],...finishCopy[l]};return `<aside class="market-cross"><div><h2>${t.crossTitle}</h2><p>${t.crossText}</p></div><div><a href="/${l}/#games" data-market-event="markets_to_games_click" data-asset="${asset||''}" data-source-section="markets_footer">${t.games} →</a><a href="${TIKTOK}" target="_blank" rel="sponsored noopener" data-outbound="tiktok" data-position="markets_footer" data-market-event="markets_to_tiktok_click" data-asset="${asset||''}" data-source-section="markets_footer">${t.tiktok} ↗</a></div></aside>`;}
export function marketPage(l,report,origin,resources,ga,{slug='',archive=false,archiveIds=[]}={}){
 const t=weeklyCopy[l],f=finishCopy[l],base=marketCopy[l],q=report.items.find(x=>x.slug===slug),week=report.week;
 const path=archive?`markets/weeks/${week.id}/`:`markets/${slug?slug+'/':''}`;
 const title=(q?t.detailTitle.replace('{asset}',nameFor(slug,l)):t.title)+(archive?' · '+week.id:'');
 const description=(q?nameFor(slug,l)+' · ':'')+t.description+' '+week.id+' – '+week.endDate;
 const opening=head(l,title,description,path,origin,resources,{ga}).replace('</head>',`<link rel="stylesheet" href="${resources.marketsCss}">${q&&!validWeekly(q,week)?'<meta name="robots" content="noindex,follow">':''}</head>`).replace('<body ',`<body data-market-page="${slug||'overview'}" data-market-week="${week.id}" `);
 const period=`<p class="weekly-period">${t.period}<br><strong>${date(week.start,l)} – ${date(week.endDate,l)}</strong></p>`;
 let content=`<div class="market-intro">${archive||q?`<a class="breadcrumb" href="/${l}/markets/">← ${t.latest}</a>`:''}<h1>${q?nameFor(slug,l):t.title}</h1><p>${q?t.detailTitle.replace('{asset}',nameFor(slug,l)):t.intro}</p>${period}<p class="market-note">${t.updated}: <time datetime="${report.collectedAt}">${date(report.collectedAt,l)} · ${new Date(report.collectedAt).toISOString().slice(11,16)} UTC</time></p></div>`;
 if(q){content+=`<section class="market-quote"><p class="weekly-change ${q.changePercent<0?'down':'up'}">${delta(q.changePercent,l)} <small>${t.change}</small></p><p class="market-status">${q.status==='stale'?f.stale+' '+q.weekId:status(q,t)}</p>${metrics(q,l)}<p class="market-note">${unit(q,base)}</p></section><section class="market-method"><h2>${base.method}</h2><p>${q.rangeBasis==='daily-reference'?t.fxMethod:t.ohlcMethod}</p>${q.observedStart?`<p>${date(q.observedStart,l)} → ${date(q.observedEnd,l)}</p>`:''}${q.source?`<p>${base.source}: <a href="${escape(q.source.url)}">${escape(q.source.name)}</a></p>`:''}</section>`;}
 else{
 const order=['bitcoin','ethereum','usd-krw','gold'];
 const primary=order.map(slug=>report.items.find(a=>a.slug===slug)).filter(Boolean);
 const ready=primary.filter(a=>validWeekly(a,{id:a.weekId}));
 content+=`<div class="market-list">${ready.map(a=>`<article class="weekly-asset"><a class="market-row" href="/${l}/markets/${a.slug}/" data-market-event="market_asset_click" data-asset="${a.slug}" data-source-section="weekly_asset_list"><span><strong>${escape(nameFor(a.slug,l))}</strong><small>${escape(a.symbol)}</small></span><span class="weekly-change ${a.changePercent<0?'down':'up'}">${delta(a.changePercent,l)} <span aria-hidden="true">→</span></span></a>${a.status==='stale'?`<p class="market-status">${f.stale} ${a.weekId}</p>`:''}${metrics(a,l)}<small class="market-note">${unit(a,base)} · <a href="${escape(a.source.url)}">${escape(a.source.name)}</a>${a.rangeBasis==='daily-reference'?' · '+t.fxMethod:''}</small><p class="market-note">${f.updated}: ${date(a.verifiedAt||report.collectedAt,l)} · ${new Date(a.verifiedAt||report.collectedAt).toISOString().slice(11,16)} UTC</p></article>`).join('')}</div>`;
 const waiting=primary.filter(a=>!validWeekly(a,{id:a.weekId}));
 if(waiting.length)content+=`<p class="market-pending">${f.pending}: ${waiting.map(a=>`<a class="market-row" href="/${l}/markets/${a.slug}/" data-market-event="market_asset_click" data-asset="${a.slug}" data-source-section="pending_assets">${escape(nameFor(a.slug,l))}</a>`).join(' · ')}</p>`;
 }
 content+=issues(report,l)+calendar(report,l);
 if(!q)content+=`<section class="market-coming"><h2>${f.more}</h2>${report.items.filter(a=>a.assetType==='index').map(a=>`<a class="market-row" href="/${l}/markets/${a.slug}/" data-market-event="market_asset_click" data-asset="${a.slug}" data-source-section="pending_indices">${escape(nameFor(a.slug,l))}</a>`).join(' · ')}</section>`;
 if(archiveIds.length)content+=`<nav class="weekly-archives" aria-label="${t.edition}"><h2>${t.history}</h2>${archiveIds.map(id=>`<a href="/${l}/markets/weeks/${id}/" ${archive&&id===week.id?'aria-current="page"':''}>${id}</a>`).join('')}</nav>`;
 const schema={'@context':'https://schema.org','@type':'Article',headline:title,description,inLanguage:locales[l].tag,url:`${origin}/${l}/${path}`,datePublished:report.publishedAt||report.collectedAt,dateModified:report.collectedAt,author:{'@type':'Organization',name:'Coupon Countdown'},temporalCoverage:`${week.id}/${week.endDate}`,mainEntityOfPage:`${origin}/${l}/${path}`};
 return opening+header(l,{marketPath:path})+`<main class="shell market-main" id="main">${content}<p class="market-disclaimer">${base.disclaimer}</p>${cross(l,slug)}</main>`+footer(l)+jsonLD(schema)+'</body></html>';
}
