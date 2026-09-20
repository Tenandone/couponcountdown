import {head,header,footer,escape,TIKTOK} from '../render.mjs';
import {locales} from '../locales.mjs';
import {assets,stateOf,currentFacts} from './data.mjs';
import {marketCopy,names} from './locales.mjs';

const pathFor=slug=>'markets/'+(slug?slug+'/':'');
const nameFor=(slug,l)=>names[l][assets.findIndex(a=>a.slug===slug)];
const jsonLD=x=>`<script type="application/ld+json">${JSON.stringify(x).replaceAll('<','\\u003c')}</script>`;
function value(n,l){return Number.isFinite(n)?new Intl.NumberFormat(locales[l].tag,{maximumFractionDigits:2,minimumFractionDigits:2}).format(n):'—';}
function price(q,l){return value(q.price,l);}
function unit(q,t){return q.unit==='points'?t.points:q.unit==='troy-oz'?t.ounce:q.unit==='per-usd'?t.perUsd:q.currency;}
function delta(n,l){return Number.isFinite(n)?`${n>0?'↑ +':n<0?'↓ ':''}${value(n,l)}%`:'—';}
function time(raw,l,dateOnly=false){return raw?`<time datetime="${escape(raw)}">${new Intl.DateTimeFormat(locales[l].tag,{dateStyle:'medium',...(dateOnly?{}:{timeStyle:'short'}),timeZone:'UTC'}).format(new Date(raw))}${dateOnly?'':' UTC'}</time>`:'—';}
function status(q,l){const t=marketCopy[l],state=stateOf(q);return `<span class="market-status ${state}" data-quote-state="${state}" data-updated="${escape(q.updatedAt||'')}" data-last-success="${escape(q.lastSuccessAt||'')}" data-max-age="${q.maxAgeHours}" data-stale-label="${escape(t.stale)}">${t[state]}</span>`;}
function changeLabel(q,t){return t[q.changeBasis==='reference'||q.assetType==='fx'?'reference':q.changeBasis==='session'||q.assetType==='index'?'session':'rolling'];}
function row(q,l){const t=marketCopy[l];return `<a class="market-row" href="/${l}/${pathFor(q.slug)}" data-market-event="market_asset_click" data-asset="${q.slug}" data-source-section="market_list"><span class="market-name"><strong>${escape(nameFor(q.slug,l))}</strong><small>${escape(q.symbol)}</small></span><span class="market-number"><strong>${price(q,l)}</strong><small>${unit(q,t)}</small></span><span class="market-change ${q.changePercent>0?'up':q.changePercent<0?'down':''}"><strong>${delta(q.changePercent,l)}</strong><small>${changeLabel(q,t)}</small></span><span class="market-time">${status(q,l)}<small>${time(q.updatedAt,l,q.dateOnly)}</small></span><span class="market-arrow" aria-hidden="true">→</span></a>`;}
function cross(l,asset){const t=marketCopy[l];return `<aside class="market-cross"><div><h2>${t.crossTitle}</h2><p>${t.crossText}</p></div><div><a href="/${l}/#games" data-market-event="markets_to_games_click" data-asset="${asset||''}" data-source-section="markets_footer">${t.games} →</a><a href="${TIKTOK}" target="_blank" rel="sponsored noopener" data-outbound="tiktok" data-position="markets_footer" data-market-event="markets_to_tiktok_click" data-asset="${asset||''}" data-source-section="markets_footer">${t.tiktok} ↗</a></div></aside>`;}
export function marketPage(l,dataset,context,origin,resources,ga,slug='') {
  const t=marketCopy[l],q=dataset.items.find(x=>x.slug===slug),path=pathFor(slug),name=q?nameFor(slug,l):t.title;
  const title=q?t.priceTitle.replace('{asset}',name):t.title;
  const description=q?t.detailDescription.replace('{asset}',name):t.description;
  let opening=head(l,title,description,path,origin,resources,{ga})
    .replace('</head>',`<link rel="stylesheet" href="${resources.marketsCss}">${q&&stateOf(q)==='unavailable'?'<meta name="robots" content="noindex,follow">':''}</head>`)
    .replace('<body ',`<body data-market-page="${slug||'overview'}" `);
  const schema={'@context':'https://schema.org','@type':'WebPage',name:title,description,url:`${origin}/${l}/${path}`,inLanguage:locales[l].tag,
    ...(q?.updatedAt?{dateModified:q.updatedAt}:{}),breadcrumb:{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:t.title,item:`${origin}/${l}/markets/`},...(q?[{'@type':'ListItem',position:2,name,item:`${origin}/${l}/${path}`}]:[])]}};
  let content;
  if(!q){const sources=[...new Map(dataset.items.filter(x=>x.source).map(x=>[x.source.url,x.source])).values()];content=`<div class="market-intro"><h1>${t.title}</h1><p>${t.intro}</p></div><div class="market-list">${dataset.items.map(x=>row(x,l)).join('')}</div><p class="market-note market-sources">${t.source}: ${sources.map(s=>`<a href="${escape(s.url)}" target="_blank" rel="noopener">${escape(s.name)}</a>`).join(' · ')}</p>`;}
  else {
    const facts=currentFacts(context.facts,slug,l),note=q.assetType==='crypto'?t.cryptoNote:q.assetType==='index'?t.indexNote:q.assetType==='fx'?t.fxNote:t.goldNote;
    content=`<a class="breadcrumb" href="/${l}/markets/">← ${t.back}</a><section class="market-quote"><span class="section-kicker">${escape(q.symbol)}</span><h1>${name}</h1>${status(q,l)}<div class="market-price">${price(q,l)} <span>${unit(q,t)}</span></div><p class="market-change ${q.changePercent>0?'up':q.changePercent<0?'down':''}"><strong>${delta(q.changePercent,l)}</strong> <span>${changeLabel(q,t)}</span></p><p class="market-asof">${t.updated}: ${time(q.updatedAt,l,q.dateOnly)}<br>${t.collected}: ${time(q.lastSuccessAt,l)}</p></section><dl class="market-metrics"><div><dt>${t.high}${q.assetType==='crypto'||q.assetType==='commodity'?' · '+t.rolling:''}</dt><dd>${value(q.high,l)}</dd></div><div><dt>${t.low}${q.assetType==='crypto'||q.assetType==='commodity'?' · '+t.rolling:''}</dt><dd>${value(q.low,l)}</dd></div><div><dt>${t.week}</dt><dd>${delta(q.change7dPercent,l)}</dd></div>${q.volume!=null?`<div><dt>${t.volume}</dt><dd>${value(q.volume,l)}</dd></div>`:''}</dl>${q.high==null&&q.change7dPercent==null?`<p class="market-note">${t.metricsMissing}</p>`:''}<section class="market-context"><h2>${t.why}</h2>${facts.length?`<ul>${facts.map(f=>`<li>${escape(f.text[l])} <a href="${escape(f.sourceUrl)}" rel="noopener" target="_blank">${escape(f.sourceName||t.source)} ↗</a></li>`).join('')}</ul>`:`<p>${t.pending}</p>`}</section><section class="market-method"><h2>${t.method}</h2><p>${note}</p>${q.source?`<p>${t.source}: <a href="${escape(q.source.url)}" target="_blank" rel="noopener">${escape(q.source.name)} ↗</a></p>`:''}</section>`;
  }
  return opening+header(l,{marketPath:path})+`<main class="shell market-main" id="main">${content}<p class="market-disclaimer">${t.disclaimer}</p>${cross(l,slug)}</main>`+footer(l)+jsonLD(schema)+'</body></html>';
}
