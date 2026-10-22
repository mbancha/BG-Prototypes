import {writeFileSync,mkdirSync} from 'node:fs';
import {newGame,actions,dispatch,playerView,owner,bot,replay} from '../src/engine';
const results=[];
for(let seed=1;seed<=50;seed++){
 const config={controllers:['bot','bot'],swap:seed%2===0,preset:seed%3===0?'exposure':'baseline',equipment:seed%5!==0};
 const s=newGame(seed,config);let commands=0;
 while(!['results','complete'].includes(s.phase)&&commands<2500){const legal=actions(s);if(!legal.length)throw Error(`No legal actions seed ${seed}: ${s.phase}`);const error=dispatch(s,bot(playerView(s,owner(s)),legal));if(error)throw Error(error);commands++;const occupied=s.units.filter(u=>u.hex).map(u=>u.hex);if(new Set(occupied).size!==occupied.length)throw Error('Occupancy invariant');if(s.players.some(p=>p.pp<0))throw Error('Negative PP');}
 if(s.phase!=='results')throw Error(`Seed ${seed} stalled at ${commands} commands`);
 if(seed<=3&&JSON.stringify(replay(seed,s.config,s.history))!==JSON.stringify(s))throw Error('Replay mismatch');
 results.push({seed,config,commands,activations:s.activation,winner:s.side,vp:s.players.map(p=>p.vp),secured:s.players.map(p=>p.physical+p.objectiveStones),ppRemaining:s.players.map(p=>p.pp/2),rp:s.players.map(p=>p.rp/2)});
}
mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/simulation.json',JSON.stringify({policy:'projected-view basic heuristic; maximum/six-count hit probabilities; no hidden-card knowledge',results},null,2));console.log(`${results.length} seeded games finished; average ${(results.reduce((a,r)=>a+r.activations,0)/results.length).toFixed(1)} activations. This is not a balance claim.`);
