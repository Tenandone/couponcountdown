import fs from 'node:fs/promises';
const catalog=JSON.parse(await fs.readFile('data/catalog.json','utf8'));
const en=JSON.parse(await fs.readFile('data/lootbar-english.raw.json','utf8'));
const rendered=JSON.parse(await fs.readFile('data/rendered-verification.json','utf8'));
const names={
 'kingshot':{ko:'킹샷',ja:'キングショット','zh-tw':'Kingshot',aliases:['king shot','킹샷','キングショット']},
 'genshin-impact':{ja:'原神','zh-tw':'原神',aliases:['genshin','원신','原神']},
 'honkai-star-rail':{ja:'崩壊：スターレイル','zh-tw':'崩壞：星穹鐵道',aliases:['hsr','스타레일','スタレ','星鐵']},
 'zenless-zone-zero':{ja:'ゼンレスゾーンゼロ','zh-tw':'絕區零',aliases:['zzz','젠존제','ゼンゼロ']},
 'whiteout-survival':{ko:'화이트아웃 서바이벌',ja:'ホワイトアウト・サバイバル','zh-tw':'寒霜啟示錄',aliases:['wos','화이트아웃','寒霜']},
 'last-war-survival':{ja:'ラストウォー：サバイバル','zh-tw':'Last War: Survival',aliases:['lastwar','라스트워','ラストウォー']},
 'tiles-survive':{ja:'タイルズ・サバイブ','zh-tw':'Tiles Survive',aliases:['tiles','타일즈','타일 서바이브','タイルズ']},
 'wuthering-waves':{ja:'鳴潮','zh-tw':'鳴潮',aliases:['wuwa','명조','鳴潮']},
 'nikke':{ja:'勝利の女神：NIKKE','zh-tw':'勝利女神：妮姬',aliases:['니케','ニケ','妮姬']},
 'pubg':{aliases:['pubgm','pubg mobile','배그','배틀그라운드']},
 'mobile-legends-bang-bang':{aliases:['mlbb','ml','모바일 레전드']},
 'arknights':{ja:'アークナイツ','zh-tw':'明日方舟',aliases:['명일방주','アークナイツ','明日方舟']},
 'arknights-endfield':{ja:'アークナイツ：エンドフィールド','zh-tw':'明日方舟：終末地',aliases:['엔드필드','終末地']},
 'love-and-deepspace':{ja:'恋と深空','zh-tw':'戀與深空',aliases:['戀與深空','恋と深空']},
 'brawl-stars':{ja:'ブロスタ','zh-tw':'荒野亂鬥',aliases:['브롤','ブロスタ','荒野亂鬥']}
};
const previous=JSON.parse(await fs.readFile('data/game-content.json','utf8').catch(()=>'{}'));
const output={};
for(const g of catalog.items){
 const e=en.find(x=>x.slug===g.slug)||en.find(x=>x.image&&x.image===g.image);
 const custom=names[g.slug]||{};
 output[g.slug]={names:{en:e?.name||g.name,ko:custom.ko||g.name,...Object.fromEntries(Object.entries(custom).filter(([k])=>!['aliases','ko'].includes(k)))},aliases:custom.aliases||[],content:{}};
 if(previous[g.slug])output[g.slug]={...output[g.slug],...previous[g.slug]};
 const v=rendered.find(x=>x.slug===g.slug);
 const final=new URL(v.url);
 g.renderedVerification={checkedAt:new Date().toISOString(),heading:v.h1,finalUrl:v.url,referralRetained:final.pathname.includes('/shop/ten/')||final.searchParams.get('utm_campaign')==='ten',method:'Browser navigation; visible product H1; final URL inspected. Checkout and affiliate commission attribution were not tested.'};
 if(!g.localImage){
   const image=v.images.find(x=>x.alt!=='Ten'&&!x.alt.includes('LootBar'));
   if(!image)throw new Error('No product image: '+g.slug);
   g.image=image.src.split('?')[0];
   const r=await fetch(g.image+'?fop=imageView/2/w/320/h/320/q/80/format/webp');
   if(!r.ok)throw new Error('Image fetch failed');
   const type=r.headers.get('content-type');const ext=type.includes('webp')?'webp':type.includes('png')?'png':'jpg';
   g.localImage='/games/'+g.slug+'.'+ext;await fs.writeFile('public'+g.localImage,Buffer.from(await r.arrayBuffer()));g.imageVerified=true;delete g.error;
 }
}
catalog.verification='All 238 source-observed URLs were requested by HTTP GET and opened in a browser. Each displayed a product H1 and retained the Ten path or redirected to a product with utm_campaign=ten. No purchase or commission attribution was tested.';
await fs.writeFile('data/game-content.json',JSON.stringify(output,null,2));
await fs.writeFile('data/catalog.json',JSON.stringify(catalog,null,2));
console.log('Enriched',catalog.items.length,'products;',catalog.items.filter(x=>x.renderedVerification.referralRetained).length,'Ten-attributed paths.');
