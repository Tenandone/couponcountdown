import {execFileSync} from 'node:child_process';
import {setTimeout as wait} from 'node:timers/promises';
// Uses the documented Pages build endpoint, not a Pages configuration change.
// GITHUB_TOKEN commits do not trigger another workflow/Pages build automatically.
if(process.env.GITHUB_REF!=='refs/heads/main'||!process.env.GH_TOKEN)throw new Error('Pages refresh only runs in the opted-in main workflow');
const repo=process.env.GITHUB_REPOSITORY;
if(repo!=='Tenandone/couponcountdown')throw new Error('Unexpected repository');
const api=async(suffix,method='GET',section='/pages')=>{
  const r=await fetch(`https://api.github.com/repos/${repo}${section}${suffix}`,{method,headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
  if(!r.ok)throw new Error(`Pages API HTTP ${r.status}`);
  return r.json();
};
const settings=await api('');
if(settings.source?.branch!=='main'||settings.source?.path!=='/'||settings.cname!=='couponcountdown.com'||settings.build_type!=='legacy')throw new Error('Pages configuration changed; refusing to modify it');
const expected=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
await api('/builds','POST');
for(let attempt=0;attempt<24;attempt++){
  await wait(15000);
  const build=await api('/builds/latest');
  // Legacy build status can remain 'building' after the real deployment succeeds.
  const deployments=await api('/deployments?environment=github-pages&sha='+expected,'GET','');
  for(const deployment of deployments.filter(d=>d.sha===expected)){
    const statuses=await api('/deployments/'+deployment.id+'/statuses','GET','');
    if(statuses[0]?.state==='success'){console.log('Pages deployment succeeded '+expected);process.exit(0);}
  }
  if(build.commit!==expected)continue;
  if(build.status==='errored')throw new Error('Pages build failed');
  if(build.status==='built'){console.log(`Pages built ${expected}`);process.exit(0);}
}
throw new Error('Pages did not confirm the expected snapshot within 6 minutes');
