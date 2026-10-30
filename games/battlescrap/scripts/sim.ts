import {writeFileSync,mkdirSync} from 'node:fs';
import {newGame,actions,dispatch,playerView,owner,bot,replay} from '../src/engine';
import {heroes,VERSION} from '../src/content';
const results=[];
for(let game=0;game<50;game++){
 const pair=Math.floor(game/2),seed=pair+1,swap=game%2===1;
 const campaign=pair%2===0?undefined:{battle:2,players:[0,1].map(i=>({rp:0,wins:0,roster:heroes.filter(h=>h.side===(i^(swap?1:0))).map(h=>h.id)}))};
 const config={controllers:['bot','bot'],swap,simulationZoneSwap:swap,equipment:pair%5!==0,heroCount:pair%5===0?4:3,omitted:pair%4,...(campaign?{campaign}:{})};
 const s=newGame(seed,config);let commands=0,maxBurst=0,cardUse=0;
 while(s.phase!=='results'&&commands<2500){const legal=actions(s);if(!legal.length)throw Error('No legal actions seed '+seed+' '+s.phase+' '+JSON.stringify(s.pending));const e=dispatch(s,bot({...playerView(s,owner(s)),decisionOwner:owner(s)},legal));if(e)throw Error(e);commands++;
 const occupied=s.units.filter(u=>u.hex).map(u=>u.hex);if(new Set(occupied).size!==occupied.length||s.players.some(p=>p.pp<0)||s.ap<0||s.rap<0)throw Error('Invariant failure seed '+seed);
 if(s.queue.length)for(const p of s.players){const all=[...p.deck,...p.hand,...p.discard];if(new Set(all).size!==all.length||all.length!==s.config.heroCount*9)throw Error('Card conservation');}}
 if(s.phase!=='results')throw Error('Seed '+seed+' stalled');
 if(seed<=5&&JSON.stringify(replay(seed,s.config,s.history))!==JSON.stringify(s))throw Error('Replay mismatch');
 for(const line of s.log){const m=line.match(/hits for (\d+)/);if(m)maxBurst=Math.max(maxBurst,+m[1]);}
 results.push({pair,swapped:swap,seed,heroCount:s.config.heroCount,battle:s.battle,modifier:s.modifier,commands,activations:s.activation,winner:s.side,vp:s.players.map(p=>p.vp),rp:s.players.map(p=>p.rp/2),secured:s.players.map(p=>p.physical),cards:s.players.map(p=>p.printedEffects),abilities:s.players.map(p=>p.apDiscards),maxBurst});
}
mkdirSync('artifacts',{recursive:true});const report={version:VERSION,policy:'Projected-view heuristic; TEST values. Completion and invariants do not prove balance.',games:results.length,unfinished:results.filter(r=>!r.winner&&r.winner!==0).length,meanActivations:results.reduce((n,r)=>n+r.activations,0)/results.length,modifiers:[...new Set(results.map(r=>r.modifier).filter(Boolean))],results};writeFileSync('artifacts/simulation.json',JSON.stringify(report,null,2));console.log(JSON.stringify({games:report.games,unfinished:report.unfinished,meanActivations:report.meanActivations,modifiers:report.modifiers,teamGames:results.filter(r=>r.heroCount===4).length,maxBurst:Math.max(...results.map(r=>r.maxBurst))}));
