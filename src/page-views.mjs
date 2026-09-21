export const viewCopy={
ko:['성장 카운트 {n}','오늘 {n} 조회','GA4 기반 지표','갱신'],
en:['Growth Count: {n}','Today: {n} page views','GA4-based metrics','Updated'],
ja:['成長カウント：{n}','今日の閲覧数：{n}','GA4に基づく指標','更新'],
'zh-tw':['成長計數：{n}','今日瀏覽次數：{n}','以 GA4 為基礎的指標','更新'],
'es-419':['Contador de crecimiento: {n}','Vistas de hoy: {n}','Indicadores basados en GA4','Actualizado'],
'es-es':['Contador de crecimiento: {n}','Páginas vistas hoy: {n}','Indicadores basados en GA4','Actualizado'],
'pt-br':['Contador de crescimento: {n}','Visualizações hoje: {n}','Indicadores baseados no GA4','Atualizado'],
ru:['Счётчик роста: {n}','Просмотры сегодня: {n}','Показатели на основе GA4','Обновлено']};
export function viewCounter(l){const c=viewCopy[l];return `<section class="page-views" data-page-views data-total-label="${c[0]}" data-today-label="${c[1]}" data-updated-label="${c[3]}" aria-label="${c[2]}" aria-hidden="true"><div><span data-total-views></span><span data-today-views></span></div><small>${c[2]} · <span data-stats-time></span></small></section>`;}
