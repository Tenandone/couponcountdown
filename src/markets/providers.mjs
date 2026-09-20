import {numeric,percent,validQuote} from './data.mjs';

export async function requestJSON(url, options = {}, request = fetch) {
  // Never log URLs, headers, or provider error bodies: they can echo credentials.
  const response = await request(url, {...options,signal:AbortSignal.timeout(20000)});
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
  return response.json();
}
export function normalizeGold(data, asset) {
  if (data.symbol !== asset.symbol || data.currency !== 'USD') throw new Error('Provider identity mismatch');
  return {price:numeric(data.price),changePercent:null,change7dPercent:null,high:null,low:null,volume:null,
    updatedAt:data.updatedAt,changeBasis:'24h',source:{name:'Gold API',url:'https://gold-api.com/',method:'provider-quote'}};
}
export function normalizeFX(data) {
  if (!Array.isArray(data)) throw new Error('Invalid FX response');
  const rows = data.filter(x => x.base === 'USD' && x.quote === 'KRW' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && numeric(x.rate) > 0).sort((a,b)=>a.date.localeCompare(b.date));
  const last = rows.at(-1), prev = rows.at(-2);
  if (!last || !prev) throw new Error('Incomplete FX response');
  const cutoff = Date.parse(last.date) - 7 * 86400000;
  const week = rows.filter(x => Date.parse(x.date) <= cutoff).at(-1);
  return {price:numeric(last.rate),changePercent:percent(last.rate,prev.rate),change7dPercent:week ? percent(last.rate,week.rate) : null,
    high:null,low:null,volume:null,updatedAt:last.date+'T00:00:00Z',dateOnly:true,changeBasis:'reference',
    comparisonAt:prev.date,weekComparisonAt:week?.date || null,source:{name:'ECB via Frankfurter',url:'https://www.ecb.europa.eu/stats/exchange_rates/html/index.en.html',method:'daily-reference-cross-rate'}};
}
export function normalizeIndex(data, mapping) {
  // Mapping must be copied from the licensed provider's instrument directory.
  if (!mapping?.symbol || !mapping?.name || !mapping?.exchange || data.symbol !== mapping.symbol || data.name !== mapping.name || data.exchange !== mapping.exchange || data.instrument_type !== 'Index') throw new Error('Index identity mismatch');
  if (!numeric(data.timestamp)) throw new Error('Missing quote timestamp');
  return {price:numeric(data.close),changePercent:numeric(data.percent_change),change7dPercent:null,high:numeric(data.high),low:numeric(data.low),volume:null,
    updatedAt:new Date(Number(data.timestamp)*1000).toISOString(),changeBasis:'session',marketOpen:data.is_market_open === true,
    source:{name:'Twelve Data',url:'https://twelvedata.com/',method:'licensed-index-quote'}};
}
export function indexWeekChange(history, quote, mapping) {
  if(history.meta?.symbol!==mapping.symbol || history.meta?.exchange!==mapping.exchange || !Array.isArray(history.values))throw new Error('History identity mismatch');
  // Daily candles are exchange-local even if the API timezone argument is UTC.
  if(!mapping.timezone)throw new Error('Missing verified exchange timezone');
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:mapping.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(quote.updatedAt));
  const target=Date.parse(date)-7*86400000;
  const rows=history.values.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.datetime)&&numeric(x.close)>0&&Date.parse(x.datetime)<=target&&Date.parse(x.datetime)>=target-4*86400000).sort((a,b)=>a.datetime.localeCompare(b.datetime));
  const prior=rows.at(-1);
  return prior?{change7dPercent:percent(quote.price,numeric(prior.close)),weekComparisonAt:prior.datetime}:{change7dPercent:null};
}
export async function fetchGold(asset, env = process.env, request = fetch, now = new Date()) {
  const quote = normalizeGold(await requestJSON(`https://api.gold-api.com/price/${asset.symbol}`,{},request),asset);
  if (!validQuote(quote,now.getTime())) throw new Error('Invalid quote');
  // Optional free authenticated OHLC: 2 windows x 3 assets = 6 of 10 requests/hour.
  // Free current quotes alone do not contain changes, ranges or volume.
  if (env.GOLD_API_KEY) {
    const end = Math.floor(Date.parse(quote.updatedAt)/1000);
    for (const days of [1,7]) {
      try {
        const start = end-days*86400;
        const d = await requestJSON(`https://api.gold-api.com/ohlc/${asset.symbol}?startTimestamp=${start}&endTimestamp=${end}`,{headers:{'x-api-key':env.GOLD_API_KEY}},request);
        if (!(numeric(d.open)>0) || !(numeric(d.close)>0) || Math.abs(Number(d.startTimestamp)-start)>60 || Math.abs(Number(d.endTimestamp)-end)>60) throw new Error('Invalid OHLC window');
        if (days === 1) {
          const high=numeric(d.high),low=numeric(d.low);
          if (!(high>0 && low>0 && high>=low && d.open>=low && d.open<=high && d.close>=low && d.close<=high)) throw new Error('Invalid OHLC range');
          quote.changePercent=percent(d.close,d.open);quote.high=high;quote.low=low;quote.metricsAt=new Date(end*1000).toISOString();
        } else quote.change7dPercent=percent(d.close,d.open);
      } catch {console.warn(`::warning::${asset.slug}: historical metrics unavailable; current quote retained`);}
    }
  }
  return quote;
}
export async function collect(asset, env, config, request = fetch, now = new Date()) {
  if (asset.provider === 'gold-api') return fetchGold(asset,env,request,now);
  if (asset.provider === 'ecb-frankfurter') {
    const from = new Date(now.getTime()-18*86400000).toISOString().slice(0,10);
    return normalizeFX(await requestJSON(`https://api.frankfurter.dev/v2/providers/ecb/rates?from=${from}&to=${now.toISOString().slice(0,10)}&base=USD&quotes=KRW`,{},request));
  }
  const mapping=config.indices?.[asset.slug];
  if (env.MARKET_INDEX_DISPLAY_APPROVED !== 'true' || !env.MARKET_API_KEY || !mapping) throw new Error('Index display license, credentials or verified instrument mapping not configured');
  const url=new URL('https://api.twelvedata.com/quote');
  url.searchParams.set('symbol',mapping.symbol);url.searchParams.set('exchange',mapping.exchange);
  url.searchParams.set('apikey',env.MARKET_API_KEY);
  const quote=normalizeIndex(await requestJSON(url,{},request),mapping);
  try {
    url.pathname='/time_series';url.searchParams.set('interval','1day');url.searchParams.set('outputsize','16');
    Object.assign(quote,indexWeekChange(await requestJSON(url,{},request),quote,mapping));
  } catch {console.warn(`::warning::${asset.slug}: seven-day history unavailable`);}
  return quote;
}
