import {mkdirSync,writeFileSync} from 'node:fs';
import {newGame,actions,dispatch,owner,playerView,bot,clone} from '../src/engine';
mkdirSync('artifacts',{recursive:true});
let combat=false,pickup=false;
for(let seed=1;seed<10&&(!combat||!pickup);seed++){
 const s=newGame(seed,{controllers:['human','human']});
 for(let step=0;step<1500&&s.phase!=='results';step++){
  if(!combat&&s.combat?.stage==='response'){writeFileSync('artifacts/combat-save.json',JSON.stringify(s));combat=true;}
  if(!pickup&&s.pending?.kind==='pickup'){writeFileSync('artifacts/pickup-save.json',JSON.stringify(s));pickup=true;}
  const legal=actions(s);if(!legal.length)throw Error('Fixture deadlock');const error=dispatch(s,bot(playerView(s,owner(s)),legal));if(error)throw Error(error);
 }
}
if(!combat||!pickup)throw Error('Could not capture natural combat and pickup checkpoints');
