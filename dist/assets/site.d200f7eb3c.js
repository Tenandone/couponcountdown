const body=document.body;
const locale=body.dataset.locale||'en';
const safeStore={get(key,fallback=null){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}};
const recentSlugs=()=>{const value=safeStore.get('cc-recent',[]);return Array.isArray(value)?value.filter(x=>typeof x==='string'):[];};
const normalize=s=>s.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const search=document.querySelector('#game-search');
const cards=[...document.querySelectorAll('#all-grid .game-card')];
const indexed=cards.map(el=>({el,text:normalize(el.dataset.search),category:el.dataset.category}));
let category='all';
let visibleLimit=12;
function filter(){
  const query=normalize(search.value),parts=query.split(/\s+/).filter(Boolean);let count=0;
  for(const item of indexed){const match=(category==='all'||item.category===category)&&parts.every(p=>item.text.includes(p));if(match)count++;item.el.hidden=!match||(!query&&count>visibleLimit);}
  const more=document.querySelector('[data-show-more]');if(more)more.hidden=!!query||count<=visibleLimit;
  document.querySelector('#result-count').textContent=body.dataset.results.replace('{count}',count);
  document.querySelector('#all-heading').textContent=query?body.dataset.filteredTitle:body.dataset.allTitle;
  document.querySelector('#popular').hidden=!!query||category!=='all';
  document.querySelector('.catalog .link-reason').hidden=!!query;
  const recent=document.querySelector('.recent-section');if(recent)recent.hidden=!!query||!recent.querySelector('.recent-list').children.length;
  document.querySelector('.empty').hidden=count!==0;
  document.querySelector('.clear-search').hidden=!search.value;
  document.querySelector('.search-key').hidden=!!search.value;
  for(const b of document.querySelectorAll('[data-filter]'))b.setAttribute('aria-pressed',String(b.dataset.filter===category));
  for(const a of document.querySelectorAll('#all-grid [data-outbound]'))a.dataset.position=query?'search':'catalog';
}
let searchTimer,lastSearch='';
function recordSearch(position='search'){
  clearTimeout(searchTimer);
  const query=normalize(search.value);
  if(!query){lastSearch='';return;}
  const key=category+':'+query;
  if(key===lastSearch)return;
  lastSearch=key;
  const matches=cards.filter(x=>!x.hidden);
  // Do not send arbitrary typed text to Analytics.
  track('game_search',{...dimensions(),game:matches.length===1?matches[0].dataset.slug:'',cta_position:position,destination:location.origin+location.pathname+'#all-games',result_count:matches.length,query_length:query.length,category});
}
search?.addEventListener('input',()=>{filter();clearTimeout(searchTimer);searchTimer=setTimeout(()=>recordSearch(),350);});
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{category=b.dataset.filter;visibleLimit=12;filter();}));
document.querySelector('[data-show-more]')?.addEventListener('click',()=>{visibleLimit+=24;filter();});
if(search)filter();
document.querySelectorAll('[data-query]').forEach(b=>b.addEventListener('click',()=>{search.value=b.dataset.query;category='all';filter();recordSearch('quick_pick');search.focus();}));
function clear(){if(!search)return;clearTimeout(searchTimer);lastSearch='';visibleLimit=12;search.value='';category='all';filter();search.focus();}
document.querySelector('.clear-search')?.addEventListener('click',clear);document.querySelector('[data-reset]')?.addEventListener('click',clear);
document.addEventListener('keydown',e=>{if(e.key==='/'&&search&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&!document.activeElement.isContentEditable){e.preventDefault();search.focus();}if(e.key==='Escape'){document.querySelectorAll('.language[open]').forEach(x=>x.open=false);}});
document.querySelectorAll('[data-language]').forEach(a=>a.addEventListener('click',()=>{safeStore.set('cc-locale',a.dataset.language);track('language_change',{...dimensions(),game:location.pathname.match(/\/games\/([^/]+)/)?.[1]||'',target_locale:a.dataset.language,cta_position:'language_menu',destination:a.href});}));
if(body.dataset.root==='true'){
  const supported=['ko','en','ja','zh-tw','es-419','es-es','pt-br','ru'];
  const saved=safeStore.get('cc-locale');
  function match(lang){lang=lang.toLowerCase();if(supported.includes(lang))return lang;if(lang.startsWith('zh'))return'zh-tw';if(lang.startsWith('es'))return lang==='es-es'?'es-es':'es-419';if(lang.startsWith('pt'))return'pt-br';return supported.find(x=>x===lang.split('-')[0]);}
  const target=supported.includes(saved)?saved:(navigator.languages||[navigator.language]).map(match).find(Boolean)||'en';
  location.replace('/'+target+'/');
}
function showRecent(){const section=document.querySelector('.recent-section'),list=document.querySelector('.recent-list');if(!section)return;list.replaceChildren();for(const slug of recentSlugs().slice(0,5)){const card=cards.find(x=>x.dataset.slug===slug);if(!card||card.dataset.availability==='maintenance')continue;const original=card.querySelector('[data-outbound]'),a=original.cloneNode(false),image=card.querySelector('img').cloneNode();a.className='';a.dataset.position='recent';image.width=40;image.height=40;a.append(image,document.createTextNode(original.dataset.name+' ↗'));list.append(a);}section.hidden=!list.children.length;}
showRecent();
const primaryCTA=document.querySelector('.hero-actions [data-outbound], .product [data-outbound]');
const stickyCTA=document.querySelector('.mobile-sticky');
if(primaryCTA&&stickyCTA&&'IntersectionObserver' in window){
  const visibility=new IntersectionObserver(([entry])=>{stickyCTA.hidden=entry.isIntersecting;},{threshold:0});
  visibility.observe(primaryCTA);
}
// The adapter works without a GA account: all events are observable through
// `cc:analytics`. GA4 forwarding is enabled only with a real ID and consent.
window.dataLayer=window.dataLayer||[];
function gtag(){window.dataLayer.push(arguments);}
let analyticsReady=false,marketViewParams=null,marketViewForwarded=false;
function enableAnalytics(){if(analyticsReady||safeStore.get('cc-consent')!=='yes'||!/^G-[A-Z0-9]+$/.test(body.dataset.ga||''))return;analyticsReady=true;gtag('js',new Date());gtag('config',body.dataset.ga,{send_page_view:true,allow_google_signals:false,allow_ad_personalization_signals:false});const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(body.dataset.ga);document.head.append(script);if(marketViewParams&&!marketViewForwarded){gtag('event','market_page_view',{...marketViewParams,transport_type:'beacon'});marketViewForwarded=true;}}
function track(name,params){if(name==='market_page_view')marketViewParams=params;const detail={event:name,...params};document.dispatchEvent(new CustomEvent('cc:analytics',{detail}));if(safeStore.get('cc-consent')==='yes'){if(analyticsReady){gtag('event',name,{...params,transport_type:'beacon'});if(name==='market_page_view')marketViewForwarded=true;}else window.dataLayer.push(detail);}}
enableAnalytics();
const consent=document.querySelector('.consent');
if(consent&&body.dataset.ga&&!safeStore.get('cc-consent'))consent.hidden=false;
document.querySelectorAll('[data-analytics-settings]').forEach(b=>b.addEventListener('click',()=>{if(consent)consent.hidden=false;}));
document.querySelectorAll('[data-consent]').forEach(b=>b.addEventListener('click',()=>{safeStore.set('cc-consent',b.dataset.consent);if(consent)consent.hidden=true;if(b.dataset.consent==='yes'){if(analyticsReady)gtag('consent','update',{analytics_storage:'granted'});enableAnalytics();}else if(analyticsReady){gtag('consent','update',{analytics_storage:'denied'});}}));
function dimensions(){return{locale,device:matchMedia('(max-width: 650px)').matches?'mobile':matchMedia('(max-width: 1100px)').matches?'tablet':'desktop',page:location.pathname};}
function click(event){
  if(event.type==='auxclick'&&event.button!==1)return;
  const a=event.target.closest('a');if(!a)return;
  const marketEvent=a.dataset.marketEvent;
  if(['market_asset_click','markets_to_games_click','markets_to_tiktok_click'].includes(marketEvent)){
    track(marketEvent,{...dimensions(),asset:a.dataset.asset||body.dataset.marketPage||'overview',source_section:a.dataset.sourceSection||'market_list'});
  }
  const card=a.closest('.game-card'),game=a.dataset.game||card?.dataset.slug||'';
  const params={...dimensions(),game:game||'tiktok-coins',cta_position:a.dataset.position||card?.querySelector('[data-outbound]')?.dataset.position||'card',destination:a.href};
  if(card)track('game_card_click',{...params,interaction:a.dataset.outbound?'recharge':'details'});
  if(!a.dataset.outbound)return;
  if(game){safeStore.set('cc-recent',[game,...recentSlugs().filter(x=>x!==game)].slice(0,5));showRecent();}
  const outbound={...params,provider:a.dataset.outbound,game_name:a.dataset.name||'TikTok Coins',game_slug:game||'tiktok-coins',link_url:a.href};
  track(a.dataset.outbound==='tiktok'?'tiktok_cta_click':'lootbar_click',outbound);
  if(a.dataset.position?.includes('sticky'))track('sticky_cta_click',outbound);
  // One canonical conversion per outbound activation. Other events are diagnostics.
  track('outbound_recharge_click',outbound);
}
document.addEventListener('click',click);document.addEventListener('auxclick',click);
if(body.dataset.marketPage)track('market_page_view',{...dimensions(),asset:body.dataset.marketPage,source_section:'markets'});
else track('hub_view',{locale,page:location.pathname});
if(search&&document.modelContext?.registerTool){
  const lifecycle=new AbortController();
  try{Promise.resolve(document.modelContext.registerTool({
    name:'search_recharge_catalog',title:'Find a recharge product',
    description:'Filter the visible catalog by name or alias and return up to 20 direct product links. Does not navigate or purchase.',
    inputSchema:{type:'object',properties:{query:{type:'string',maxLength:256}},required:['query'],additionalProperties:false},
    annotations:{readOnlyHint:false,untrustedContentHint:false},
    execute(input){if(!input||typeof input.query!=='string'||input.query.length>256||Object.keys(input).some(k=>k!=='query'))throw new Error('Expected query string, at most 256 characters.');search.value=input.query;category='all';filter();recordSearch('assistant_search');const matches=cards.filter(x=>!x.hidden);return{count:matches.length,locale,results:matches.slice(0,20).map(x=>{const a=x.querySelector('[data-outbound], [data-maintenance]');return{slug:x.dataset.slug,name:a.dataset.name,status:x.dataset.availability,rechargeUrl:a.dataset.maintenance?null:a.href};})};}
  },{signal:lifecycle.signal})).catch(()=>{});}catch{}
  addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
