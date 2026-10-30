import {writeFileSync,mkdirSync} from 'node:fs';
import {newGame,actions,dispatch,bot,playerView,owner,clone} from '../src/engine';
mkdirSync('artifacts',{recursive:true});
const found=new Set<string>();
for(let seed=1;seed<=20&&found.size<4;seed++){
 const s=newGame(seed,{controllers:['bot','bot'],equipment:false});
 for(let n=0;n<1800&&s.phase!=='complete';n++){
  const kind=s.response?'ability-response':s.combat?.stage==='response'?'combat':s.pending?.kind==='claim'?'objective':s.phase==='results'?'results':null;
  if(kind&&!found.has(kind)){const copy=clone(s);copy.config.controllers=['human','human'];writeFileSync('artifacts/current-'+kind+'-save.json',JSON.stringify(copy));found.add(kind);}
  if(s.phase==='results')break;const legal=actions(s);if(!legal.length)throw Error('No legal action');const e=dispatch(s,bot({...playerView(s,owner(s)),decisionOwner:owner(s)},legal));if(e)throw Error(e);
 }
}
console.log('Current UI fixtures:',[...found].join(', '));
