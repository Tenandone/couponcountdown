import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.xml':'application/xml','.txt':'text/plain'};
http.createServer(async(req,res)=>{try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/__qa/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(await fs.readFile('tests/browser.html'));return;}
  const aliases=JSON.parse(await fs.readFile('data/redirects.json','utf8').catch(()=>'{}'));
  if(aliases[pathname]){res.writeHead(301,{Location:aliases[pathname]});res.end();return;}
  let file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)&&file!==root)throw new Error('Forbidden');
  let stat=await fs.stat(file);
  if(stat.isDirectory()){
    if(!pathname.endsWith('/')){res.writeHead(308,{Location:pathname+'/'});res.end();return;}
    file=path.join(file,'index.html');
  }
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(await fs.readFile(file));
}catch{res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end(await fs.readFile(path.join(root,'404.html')).catch(()=>'Not found'));}
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173/en/'));
