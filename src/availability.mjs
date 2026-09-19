// Temporary recharge maintenance reported by the site owner.
export const maintenanceSlugs=new Set(['kingshot','whiteout-survival']);
export const underMaintenance=g=>maintenanceSlugs.has(typeof g==='string'?g:g.slug);
export const maintenanceLabels={ko:'충전 점검 중',en:'Top-up under maintenance',ja:'チャージメンテナンス中','zh-tw':'儲值維護中','es-419':'Recargas en mantenimiento','es-es':'Recargas en mantenimiento','pt-br':'Recarga em manutenção',ru:'Пополнение на техобслуживании'};
export const catalogOrder=games=>[...games.filter(g=>!underMaintenance(g)),...games.filter(underMaintenance)];
