/** Repair numeric-only E.G.O stages using the latest earlier localized snapshot.
 * Does not overwrite existing rows, numbers, or explicit empty coin snapshots.
 * Run with --apply to repair; otherwise audits only. */
import {PrismaClient} from '../../src/v2/generated/client.js';
import {writeFile,mkdir} from 'node:fs/promises';
const db=new PrismaClient();
try {
 const report=await db.$transaction(async tx=>{
  const [egos,identities]=await Promise.all([
   tx.egoSkill.findMany({include:{ego:{include:{texts:true}},stages:{orderBy:{uptie:'asc'},include:{texts:true,coins:true}}}}),
   tx.skill.findMany({include:{stages:{include:{texts:true}}}}),
  ]);
  const texts:Parameters<typeof tx.egoSkillStageText.createMany>[0]['data']=[];
  const coins:Parameters<typeof tx.egoSkillCoin.createMany>[0]['data']=[];
  const affected:unknown[]=[];
  for(const skill of egos)for(const stage of skill.stages)for(const locale of ['ko','en','ja'] as const){
   if(stage.texts.some(t=>t.locale===locale))continue;
   const previous=skill.stages.filter(s=>s.uptie<stage.uptie&&s.texts.some(t=>t.locale===locale)).at(-1);
   if(!previous)continue;
   const source=previous.texts.find(t=>t.locale===locale)!;
   texts.push({...source,uptie:stage.uptie});
   if(stage.coins.some(c=>c.locale===locale))throw Error(`Refuse mixed snapshot ${skill.id}/${stage.uptie}/${locale}`);
   coins.push(...previous.coins.filter(c=>c.locale===locale).map(c=>({...c,uptie:stage.uptie})));
   affected.push({ego:skill.egoId,name:skill.ego.texts.find(t=>t.locale==='ko')?.name,skill:skill.id,role:skill.role,from:previous.uptie,to:stage.uptie,locale});
  }
  const identityMissing=identities.flatMap(s=>s.stages.filter(st=>!st.texts.some(t=>(t.locale==='ko'||t.locale==='en')&&t.name.trim())).map(st=>({skill:s.id,uptie:st.uptie})));
  if(process.argv.includes('--apply')){
   await tx.egoSkillStageText.createMany({data:texts});await tx.egoSkillCoin.createMany({data:coins});
  }
  return {applied:process.argv.includes('--apply'),identitySkills:identities.length,identityStages:identities.reduce((n,s)=>n+s.stages.length,0),identityMissing,egoSkills:egos.length,egoStages:egos.reduce((n,s)=>n+s.stages.length,0),textRows:texts.length,coinRows:coins.length,affected};
 },{timeout:60000});
 await mkdir('var/audits',{recursive:true});
 const path=`var/audits/ego-stage-localization-${Date.now()}.json`;
 await writeFile(path,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,affected:undefined,path},null,2));
}finally{await db.$disconnect()}
