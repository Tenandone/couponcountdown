import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const cname=(await fs.readFile('CNAME','utf8')).trim();if(cname!=='couponcountdown.com')throw new Error('Unexpected domain');
for(const entry of await fs.readdir('dist')){
 if(entry==='CNAME')continue;
 const target=path.resolve(root,entry);if(path.dirname(target)!==root)throw new Error('Unsafe output target');
 // Only copy generated output; no recursive deletion or source-tree rewriting.
 await fs.cp(path.join(root,'dist',entry),target,{recursive:true});
}
console.log('Prepared existing main-root GitHub Pages output; CNAME unchanged.');
