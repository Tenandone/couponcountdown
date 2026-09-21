export const viewCopy={
ko:['누적 {n} 조회','오늘 {n} 조회','조회수 · GA4','갱신'],en:['{n} Total Views','{n} Today','Page views · GA4','Updated'],ja:['累計 {n} 回','今日 {n} 回','ページビュー · GA4','更新'],
'zh-tw':['累計 {n} 次瀏覽','今日 {n} 次','瀏覽次數 · GA4','更新'],
'es-419':['{n} vistas totales','{n} hoy','Vistas de página · GA4','Actualizado'],
'es-es':['{n} visitas a páginas','{n} hoy','Páginas vistas · GA4','Actualizado'],
'pt-br':['{n} visualizações no total','{n} hoje','Visualizações de página · GA4','Atualizado'],
ru:['Всего просмотров: {n}','Сегодня: {n}','Просмотры страниц · GA4','Обновлено']};
export function viewCounter(l){const c=viewCopy[l];return `<section class="page-views" data-page-views data-total-label="${c[0]}" data-today-label="${c[1]}" data-updated-label="${c[3]}" aria-label="${c[2]}" aria-hidden="true"><div><span data-total-views></span><span data-today-views></span></div><small>${c[2]} · <span data-stats-time></span></small></section>`;}
