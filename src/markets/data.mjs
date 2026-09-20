export const assets = [
  {slug:'bitcoin',symbol:'BTC',assetType:'crypto',currency:'USD',unit:'coin',provider:'gold-api',maxAgeHours:3},
  {slug:'ethereum',symbol:'ETH',assetType:'crypto',currency:'USD',unit:'coin',provider:'gold-api',maxAgeHours:3},
  {slug:'sp500',symbol:'S&P 500',assetType:'index',currency:null,unit:'points',provider:'twelve-data',maxAgeHours:96},
  {slug:'nasdaq',symbol:'Nasdaq Composite',assetType:'index',currency:null,unit:'points',provider:'twelve-data',maxAgeHours:96},
  {slug:'kospi',symbol:'KOSPI',assetType:'index',currency:null,unit:'points',provider:'twelve-data',maxAgeHours:96},
  {slug:'usd-krw',symbol:'USD/KRW',assetType:'fx',currency:'KRW',unit:'per-usd',provider:'ecb-frankfurter',maxAgeHours:120},
  {slug:'gold',symbol:'XAU',assetType:'commodity',currency:'USD',unit:'troy-oz',provider:'gold-api',maxAgeHours:96},
];
export const numeric = value => value === null || value === undefined || value === '' || typeof value === 'boolean' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
export const percent = (now, before) => before > 0 ? (now / before - 1) * 100 : null;
export function validQuote(q, now = Date.now()) {
  return !!q && Number.isFinite(q.price) && q.price > 0 && Number.isFinite(Date.parse(q.updatedAt)) &&
    Date.parse(q.updatedAt) <= now + 300000 &&
    ['changePercent','change7dPercent','high','low','volume'].every(k => q[k] == null || Number.isFinite(q[k])) &&
    (q.high == null || q.high > 0) && (q.low == null || q.low > 0) &&
    (q.volume == null || q.volume >= 0) && (q.high == null || q.low == null || q.high >= q.low) &&
    !!q.source?.name && /^https:\/\//.test(q.source?.url || '');
}
export function mergeQuote(asset, previous, candidate, now = new Date().toISOString()) {
  // Treat partial metric loss as a failed snapshot rather than mix new prices with old changes.
  const losesMetrics = validQuote(previous,Date.parse(now)) && ['changePercent','change7dPercent','high','low','volume'].some(k=>previous[k]!=null && candidate?.[k]==null);
  const accepted = !losesMetrics && validQuote(candidate, Date.parse(now)) && (!validQuote(previous, Date.parse(now)) || Date.parse(candidate.updatedAt) >= Date.parse(previous.updatedAt));
  const quote = accepted ? candidate : validQuote(previous, Date.parse(now)) ? previous : null;
  return {...asset, price:null,changePercent:null,change7dPercent:null,high:null,low:null,volume:null,updatedAt:null,source:null,
    ...quote, ...asset, status:quote ? (accepted ? 'available' : 'stale') : 'unavailable',
    lastAttemptAt:now, lastSuccessAt:accepted ? now : previous?.lastSuccessAt || null};
}
export function stateOf(q, now = Date.now()) {
  if (!validQuote(q, now)) return 'unavailable';
  return q.status === 'stale' || now - Date.parse(q.updatedAt) > q.maxAgeHours * 3600000 ||
    now - Date.parse(q.lastSuccessAt || q.updatedAt) > 3 * 3600000 ? 'stale' : 'available';
}
// Editorial facts are never generated from price direction or untrusted news text.
// A reviewed fact requires a citation, locale text, exact assets, and a short expiry.
export function currentFacts(facts, slug, locale, now = Date.now()) {
  const allowed = new Set(['www.federalreserve.gov','www.bls.gov','www.bea.gov','www.ecb.europa.eu','www.bok.or.kr','www.krx.co.kr']);
  return (facts || []).filter(f => {
    try {return f.reviewed === true && f.assets?.includes(slug) && typeof f.text?.[locale] === 'string' &&
      f.text[locale].length <= 280 && new URL(f.sourceUrl).protocol === 'https:' && allowed.has(new URL(f.sourceUrl).hostname) &&
      Date.parse(f.publishedAt) <= now && Date.parse(f.expiresAt) > now &&
      Date.parse(f.expiresAt) - Date.parse(f.publishedAt) <= 48 * 3600000;
    } catch {return false;}
  }).slice(0,4);
}
