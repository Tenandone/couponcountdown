import fs from 'node:fs/promises';
import path from 'node:path';
const raw = JSON.parse(await fs.readFile('data/lootbar-catalog.raw.json','utf8'));
const items = [...new Map(raw.items.map(g=>[g.url,g])).values()];
await fs.mkdir('public/games',{recursive:true});
const results=[];
let cursor=0;
async function worker(){
  while(cursor<items.length){
    const g=items[cursor++];
    const record={...g, checkedAt:new Date().toISOString()};
    try {
      const r=await fetch(g.url,{signal:AbortSignal.timeout(25000)});
      record.httpStatus=r.status;record.finalUrl=r.url;record.referralRetained=new URL(r.url).pathname.includes('/shop/ten/');
      record.httpAccessible=r.ok && record.referralRetained;
      await r.arrayBuffer();
      const ir=await fetch(g.image+'?fop=imageView/2/w/320/h/320/q/80/format/webp',{signal:AbortSignal.timeout(25000)});
      if(!ir.ok || !ir.headers.get('content-type')?.startsWith('image/'))throw new Error('Image response '+ir.status);
      const type=ir.headers.get('content-type'); const ext=type.includes('webp')?'webp':type.includes('png')?'png':'jpg';
      record.localImage='/games/'+g.slug+'.'+ext;
      await fs.writeFile(path.join('public',record.localImage),Buffer.from(await ir.arrayBuffer()));
      record.imageVerified=true;
    } catch(e){record.error=e.message;}
    results.push(record);
    if(results.length%30===0)console.log('Checked',results.length,'/',items.length);
  }
}
await Promise.all(Array.from({length:5},worker));
results.sort((a,b)=>items.findIndex(x=>x.url===a.url)-items.findIndex(x=>x.url===b.url));
await fs.writeFile('data/catalog.json',JSON.stringify({source:raw.source,observedAt:raw.observedAt,verification:'Every URL was observed in the fully expanded Ten storefront and requested with HTTP GET; HTTP success alone does not prove checkout availability. Rendered-page checks are recorded separately.',items:results},null,2));
console.log(JSON.stringify({total:results.length,topups:results.filter(x=>x.category==='top-up').length,httpAccessible:results.filter(x=>x.httpAccessible).length,images:results.filter(x=>x.imageVerified).length,errors:results.filter(x=>x.error)}));
