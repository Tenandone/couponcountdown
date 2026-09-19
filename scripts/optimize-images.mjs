import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const catalog=JSON.parse(await fs.readFile('data/catalog.json','utf8'));
const root=path.resolve('public/games');let before=0,after=0;
for(const g of catalog.items){
 const inputPath=path.resolve('public'+g.localImage);
 if(!inputPath.startsWith(root+path.sep))throw new Error('Image outside catalog directory');
 const input=await fs.readFile(inputPath);before+=input.length;
 const large=await sharp(input).rotate().resize(320,320,{fit:'cover',withoutEnlargement:true}).webp({quality:78,effort:5}).toBuffer();
 const small=await sharp(input).rotate().resize(160,160,{fit:'cover',withoutEnlargement:true}).webp({quality:76,effort:5}).toBuffer();
 g.localImage='/games/'+g.slug+'.webp';g.smallImage='/games/'+g.slug+'-160.webp';
 await fs.writeFile('public'+g.localImage,large);await fs.writeFile('public'+g.smallImage,small);
 if(inputPath!==path.resolve('public'+g.localImage))await fs.unlink(inputPath);
 after+=large.length;
}
await fs.writeFile('data/catalog.json',JSON.stringify(catalog,null,2));
console.log(JSON.stringify({products:catalog.items.length,inputBytes:before,webp320Bytes:after,reduction:Math.round((1-after/before)*100)+'%'}));
