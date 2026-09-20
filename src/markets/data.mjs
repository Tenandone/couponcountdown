export const assets = [
  {slug:'bitcoin',symbol:'BTC',assetType:'crypto',currency:'USD',unit:'coin',provider:'gold-api'},
  {slug:'ethereum',symbol:'ETH',assetType:'crypto',currency:'USD',unit:'coin',provider:'gold-api'},
  {slug:'sp500',symbol:'S&P 500',assetType:'index',currency:null,unit:'points',provider:'rights-pending'},
  {slug:'nasdaq',symbol:'Nasdaq Composite',assetType:'index',currency:null,unit:'points',provider:'rights-pending'},
  {slug:'kospi',symbol:'KOSPI',assetType:'index',currency:null,unit:'points',provider:'rights-pending'},
  {slug:'usd-krw',symbol:'USD/KRW',assetType:'fx',currency:'KRW',unit:'per-usd',provider:'ecb-frankfurter'},
  {slug:'gold',symbol:'XAU',assetType:'commodity',currency:'USD',unit:'troy-oz',provider:'gold-api'},
];
export const numeric = value => value === null || value === undefined || value === '' || typeof value === 'boolean' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
export const percent = (now, before) => before > 0 ? (now / before - 1) * 100 : null;
