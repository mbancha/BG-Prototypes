import {H,C,heroes,cards,board,B,distance,equipment,VERSION,tacticCopies,factionElements} from './content';
import {RULES} from './data/config';
export type Action={type:string;[key:string]:any};
export type State={ [key:string]:any; units:any[]; players:any[]; queue:string[]; history:Action[] };
export const clone=<T,>(x:T):T=>structuredClone(x);
export const unit=(s:State,id:string)=>s.units.find((u:any)=>u.id===id);
export const def=(u:any)=>u?.hero?H[u.hero]:{name:'Recruit '+String.fromCharCode(65+(u?.index||0)),hp:2,move:3,defense:2,attack:2,range:1,text:''};
export const label=(s:State,id:string)=>def(unit(s,id)).name;
export const on=(s:State)=>s.units.filter((u:any)=>u.hex);
export const entitlement=(s:State,i:number)=>(s.config.heroCount===4?RULES.queue4:RULES.queue3)[i];
export function rand(s:State){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
function shuffle(s:State,a:any[]){for(let i=a.length-1;i>0;i--){const j=Math.floor(rand(s)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const die=(s:State)=>1+Math.floor(rand(s)*6);
export function newGame(seed=12345,config:any={}):State{
 const cfg={controllers:['human','bot'],heroCount:3,omitted:3,equipment:true,swap:false,target:RULES.target,offers:[],...config};
 const budget=(cfg.heroCount===4?RULES.teamBudget:RULES.budget)*2;
 const s:State={schema:2,version:VERSION,seed,rng:seed||1,botRoll:0,config:cfg,phase:'bid',side:0,first:0,queueFirst:0,round:1,battle:config.campaign?.battle||1,activation:0,active:null,ap:0,rap:0,queue:[],units:[],players:[0,1].map(i=>({name:i?'Wildmoon':'Concord',roster:cfg.teams?.[i]||heroes.filter(h=>h.side===(i^(cfg.swap?1:0))).map(h=>h.id),rp:config.campaign?.players[i].rp||0,wins:config.campaign?.players[i].wins||0,base:budget,pp:budget,bidBonus:0,selected:[],suits:{},items:{},extra:0,draws:0,upgrades:[],tacticUpgrades:config.campaign?.players[i].tacticUpgrades||[],deck:[],hand:[],discard:[],objectives:[],completed:[],physical:0,vp:0,ready:false,printedEffects:0,apDiscards:0,rerolls:0,queueDraws:0,objectiveStones:0})),bids:[null,null],bidTotals:[0,0],zones:['stone','blue'],pending:null,combat:null,response:null,effects:[],lastRoll:null,rollSerial:0,stones:{},traps:[],modifier:null,windDirection:0,windUsed:[],used:{},history:[],log:[],events:[],reveal:0,settled:[],objectiveDeck:[],cleanup:0,terrain:[],progress:{},activationQueue:[]};
 if(config.campaign) s.players.forEach((p:any,i:number)=>{p.roster=[...config.campaign.players[i].roster];});
 s.objectiveDeck=shuffle(s,[0,1,2,3,4,5]);
 const tokens=shuffle(s,[0,0,0,0,1,1,1,1,1]);board.xs.forEach((h,i)=>{if(tokens[i])s.stones[h]=1;else s.traps.push(h);});
 if(s.battle>1){s.modifier=RULES.modifiers[Math.floor(rand(s)*6)];s.windDirection=Math.floor(rand(s)*6);if(s.modifier==='Moonfall')for(const h of s.traps){const spaces=board.hexes.filter(v=>distance(v.id,h)===1);if(spaces.length){const v=spaces[Math.floor(rand(s)*spaces.length)].id;s.stones[v]=(s.stones[v]||0)+1;}}s.log.push('Battlefield: '+s.modifier);}
 s.botRoll=rand(s);return s;
}
export function owner(s:State){const ov=s.players.findIndex((p:any)=>p.hand.length>RULES.handLimit||p.objectives.length>2);return ov>=0&&s.phase==='battle'?ov:s.response?s.response.priority:s.combat?.stage==='response'?s.combat.priority:s.combat?.stage==='reroll'?unit(s,s.combat.attacker).owner:s.combat?.stage==='counter'?unit(s,s.combat.defender).owner:s.side;}
function blocked(s:State,a:string,b:string){return board.walls.includes([a,b].sort().join('|'))||s.terrain.some((t:any)=>t.hex===b&&t.kind==='structure');}
export function reachable(s:State,u:any,n:number){if(!u?.hex||n<=0)return [];if(u.fly)return board.hexes.filter(h=>distance(u.hex,h.id)>0&&distance(u.hex,h.id)<=n&&!blocked(s,u.hex,h.id)&&!on(s).some((v:any)=>v.hex===h.id)).map(h=>h.id);const seen=new Set([u.hex]),front=[{h:u.hex,d:0}],result:string[]=[];const occupied=new Set(on(s).filter((x:any)=>x.id!==u.id).map((x:any)=>x.hex));for(let i=0;i<front.length;i++){const {h,d}=front[i];if(d>=n)continue;for(const v of board.hexes)if(!seen.has(v.id)&&distance(h,v.id)===1&&!blocked(s,h,v.id)&&!occupied.has(v.id)){seen.add(v.id);front.push({h:v.id,d:d+1});result.push(v.id);}}return result;}
export function movementPath(s:State,u:any,to:string){if(!u?.hex||u.hex===to)return [u?.hex];const queue=[[u.hex]],seen=new Set([u.hex]);for(let i=0;i<queue.length;i++){const path=queue[i],h=path[path.length-1];for(const v of board.hexes)if(!seen.has(v.id)&&distance(h,v.id)===1&&!blocked(s,h,v.id)&&!on(s).some((x:any)=>x.id!==u.id&&x.hex===v.id)){const p=[...path,v.id];if(v.id===to)return p;seen.add(v.id);queue.push(p);}}return [];}
function spawn(s:State,p:number){const zone=board.hexes.filter(h=>h.zone===s.zones[p]);const empty=board.hexes.filter(h=>!on(s).some((u:any)=>u.hex===h.id)&&!s.terrain.some((t:any)=>t.kind==='structure'&&t.hex===h.id));const dist=(h:any)=>Math.min(...zone.map(z=>distance(z.id,h.id)));const nearest=Math.min(...empty.map(dist));return empty.filter(h=>dist(h)===nearest).map(h=>h.id);}
export function draw(s:State,p:number){const x=s.players[p];if(!x.deck.length)x.deck=shuffle(s,x.discard.splice(0));if(x.deck.length){x.hand.push(x.deck.pop());s.reveal++;}}
function objectiveDraw(s:State,p:number){if(s.objectiveDeck.length){s.players[p].objectives.push({id:s.objectiveDeck.pop(),awaiting:true,eligible:Number.MAX_SAFE_INTEGER,attacks:[],recruits:[]});s.reveal++;}}
function discard(s:State,p:number,card:string){const x=s.players[p],i=x.hand.indexOf(card);if(i<0)throw Error('Missing card');x.hand.splice(i,1);x.discard.push(card);s.reveal++;}
export function gain(s:State,u:any,status:string,n:number){if(n<=0||!u.hex)return;const bonus=status==='enraged'&&s.modifier==='Heat'&&!u.enraged?1:0;u[status]=(u[status]||0)+n+bonus;}
export function damage(s:State,u:any,n:number,killer?:number){if(!u?.hex||n<=0)return;const hp=def(u).hp-u.wounds;u.wounds+=n;if(u.wounds>=def(u).hp){const hex=u.hex;u.hex=null;u.wounds=def(u).hp;u.tokens={};u.turnBuff=false;for(const k of ['focus','enraged','fortified','daze','poison'])u[k]=0;if(u.hero){s.stones[hex]=(s.stones[hex]||0)+1;draw(s,u.owner);queueShift(s,u.id);}s.log.push(def(u).name+' defeated');if(killer!==undefined&&killer!==u.owner)awardVP(s,killer,1,'enemy defeat');}else if(u.hero&&hp>1&&def(u).hp-u.wounds===1)gain(s,u,'enraged',1);}
export function heal(s:State,u:any,n:number){if(!u?.hex)return;u.wounds=Math.max(0,u.wounds-n);u.poison=0;}
function hazard(s:State,u:any,killer?:number){if(!u.hex)return;if(s.traps.includes(u.hex)){s.traps.splice(s.traps.indexOf(u.hex),1);damage(s,u,1,killer);}if(u.hex&&board.controls.includes(u.hex))damage(s,u,1,killer);}
function moveUnit(s:State,u:any,to:string,voluntary=true){const path=u.fly?[u.hex,to]:movementPath(s,u,to);for(const h of path.slice(1)){u.hex=h;hazard(s,u);if(!u.hex||s.phase==='results')break;}if(voluntary&&u.hex&&!u.hero&&on(s).some((v:any)=>v.owner===u.owner&&v.hero==='h04'&&v.turnBuff)&&on(s).some((e:any)=>e.owner!==u.owner&&distance(e.hex,u.hex)===1))draw(s,u.owner);}
function queueShift(s:State,id:string){const i=s.queue.indexOf(id);if(i>=0){s.queue.splice(i,1);s.queue.unshift(id);}}
export function cost(s:State,u:any,kind:string){return u.hero?(kind==='ability'?def(u).ap+(def(u).ap?(s.used[u.id+':ability']||0):0):1+(s.used[u.id+':'+kind]||0)):1+(s.used[u.id]||0);}
function affordable(s:State,u:any,n:number){return (u.hero?s.ap:s.ap+s.rap)>=n;}
function pay(s:State,u:any,kind:string){const n=cost(s,u,kind);if(u.hero)s.ap-=n;else{const r=Math.min(s.rap,n);s.rap-=r;s.ap-=n-r;}const key=u.hero?u.id+':'+kind:u.id;s.used[key]=(s.used[key]||0)+1;}
function stat(s:State,u:any,k:string){let n=def(u)[k];const p=s.players[u.owner];if(k==='move'&&p.items[u.hero]==='boots'&&n<7)n++;if(!u.hero&&p.upgrades.includes(k))n++;return n;}
const moveRange=(s:State,u:any)=>Math.max(0,stat(s,u,'move')-(s.modifier==='Snow'?1:0));
export function attackTargets(s:State,u:any,override?:any){if(!u?.hex)return [];const d=override||def(u),range=d.range+(!override&&s.players[u.owner].items[u.hero]==='lens'&&d.range>1?1:0);return on(s).filter((t:any)=>t.owner!==u.owner&&(d.exact?distance(u.hex,t.hex)===range:distance(u.hex,t.hex)<=(range>1?range*2:1))&&!(range===1&&blocked(s,u.hex,t.hex)));}
function adjacent(s:State,u:any,friend:boolean){return on(s).filter((t:any)=>t.id!==u.id&&(t.owner===u.owner)===friend&&distance(t.hex,u.hex)===1);}
export function compare(a:number[],d:number[]){const am=Math.max(...a),dm=Math.max(...d),ac=a.filter(n=>n===6).length,dc=d.filter(n=>n===6).length;return {hit:am>dm||(am===dm&&(am!==6||ac>=dc)),attackSixes:ac,defenseSixes:dc,critical:ac>0,criticalDefense:dc>0};}
export function pools(s:State){const c=s.combat,a=unit(s,c.attacker),d=unit(s,c.defender),data=c.override||def(a),ranged=data.range>1;
 let at=(c.override?data.attack:stat(s,a,'attack'))+a.focus+c.bonus,de=stat(s,d,'defense')+d.fortified-d.daze+c.defBonus;
 if(c.basic&&s.players[a.owner].items[a.hero]==='weapon')at++;
 if(on(s).some((u:any)=>u.owner===a.owner&&u.id!==a.id&&u.hero==='h12'&&u.enraged&&distance(u.hex,a.hex)===1))at++;
 if(ranged){const range=data.range+(!c.override&&s.players[a.owner].items[a.hero]==='lens'?1:0);if(adjacent(s,a,false).length)at-=2;if(distance(a.hex,d.hex)>range)at-=2;if(s.modifier==='Storm')at--;if(s.config.elevation&&B[a.hex].level>B[d.hex].level)at++;}
 else {at+=on(s).filter((u:any)=>u.owner===a.owner&&u.id!==a.id&&distance(u.hex,d.hex)===1&&!on(s).some((e:any)=>e.owner!==a.owner&&e.id!==d.id&&distance(u.hex,e.hex)===1)).length;if(s.players[d.owner].items[d.hero]==='shield')de++;}
 return [Math.max(0,at),Math.max(0,de)];
}
function beginCombat(s:State,a:any,d:any,basic=true,override:any=null,isCounter=false){s.combat={attacker:a.id,defender:d.id,basic,override,isCounter,stage:'response',priority:d.owner,passes:0,bonus:0,defBonus:0,extraDamage:0,counter:false,attackDice:[],defenseDice:[]};}
function recordAttack(s:State,a:any,d:any){if(a.owner!==s.side)return;for(const o of s.players[a.owner].objectives){if(o.awaiting||o.eligible>s.activation)continue;if(o.id===0&&on(s).filter((u:any)=>u.owner===a.owner&&distance(u.hex,d.hex)===1).length>=3)o.done=true;if(o.id===1&&!d.hero&&!o.recruits.includes(d.id))o.recruits.push(d.id);if(o.id===2&&a.hero&&adjacent(s,a,false).length>=2)o.done=true;}}
function roll(s:State){const c=s.combat,a=unit(s,c.attacker),d=unit(s,c.defender),[at,de]=pools(s);
 c.old={focus:a.focus,enraged:a.enraged,fortified:d.fortified,daze:d.daze};c.heavy=(c.override?.heavy||0)+(on(s).some((u:any)=>u.owner===a.owner&&u.hero==='h13'&&u.id!==a.id&&u.tokens.ongoing&&distance(u.hex,a.hex)===1)?2:0);
 const pool=(n:number)=>n?Array.from({length:n},()=>die(s)):[Math.min(die(s),die(s))];
 c.zeroAttack=at===0;c.attackDice=pool(at);c.defenseDice=pool(de);c.stage='reroll';recordAttack(s,a,d);s.reveal++;rememberRoll(s);
}
function rememberRoll(s:State){const c=s.combat;s.lastRoll={serial:++s.rollSerial,attacker:label(s,c.attacker),defender:label(s,c.defender),attackDice:[...c.attackDice],defenseDice:[...c.defenseDice],kind:'Attack'};}
function resolveCombat(s:State){const c=s.combat,a=unit(s,c.attacker),d=unit(s,c.defender),r=compare(c.attackDice,c.defenseDice);a.focus=Math.max(0,a.focus-c.old.focus);a.enraged=Math.max(0,a.enraged-c.old.enraged);d.fortified=Math.max(0,d.fortified-c.old.fortified);d.daze=Math.max(0,d.daze-c.old.daze);
 const amount=Math.min(c.override?.light??Infinity,1+r.attackSixes+c.old.enraged+c.heavy+c.extraDamage);
 s.log.push(label(s,a.id)+' '+(r.hit?'hits for '+amount:'blocked')+' · ['+c.attackDice+'] / ['+c.defenseDice+']');
 if(r.hit){damage(s,d,amount,a.owner);if(d.hex&&c.override?.poison){gain(s,d,'poison',c.override.poison);d.poisonSource=a.owner;}if(d.hex&&(c.override?.push||c.override?.pull))s.effects.unshift({kind:'displace',source:a.hex,target:d.id,left:c.override.push||c.override.pull,pull:!!c.override.pull,killer:a.owner});}else gain(s,d,'focus',r.defenseSixes);
 if(s.phase==='results')return;
 s.combat=null;if(!r.hit&&c.counter&&!c.isCounter&&a.hex&&d.hex&&attackTargets(s,d).some((t:any)=>t.id===a.id)){s.combat={...c,stage:'counter'};return;}pump(s);
}
function awardVP(s:State,p:number,n:number,why:string){if(s.phase==='results'||s.settled.includes(s.battle))return;s.players[p].vp+=n;if(n)s.log.push(s.players[p].name+' +'+n+' VP · '+why);checkVictory(s);}
function checkVictory(s:State){if(s.settled.includes(s.battle))return;const winner=s.players.findIndex((p:any)=>p.vp>=s.config.target);if(winner<0)return;s.phase='results';s.side=winner;s.active=null;s.ap=0;s.rap=0;s.pending=null;s.response=null;s.combat=null;s.effects=[];s.players[winner].wins++;for(let i=0;i<2;i++){const p=s.players[i];p.rp+=2*(RULES.baseRP+p.physical*RULES.stoneRP+(i===winner?RULES.victoryRP:0));}s.settled.push(s.battle);}
export function control(s:State,p:number,h:string){const counts=[0,0];on(s).filter((u:any)=>distance(u.hex,h)===1).forEach((u:any)=>counts[u.owner]++);return counts[p]>counts[1-p];}
export function startTurn(s:State){s.phase='battle';s.active=null;s.ap=0;s.rap=0;s.used={};s.windUsed=[];s.effects=[];s.cleanup=0;
 awardVP(s,s.side,s.zones[s.side]==='blue'?1:board.controls.filter(h=>control(s,s.side,h)).length,'scenario');if(s.phase==='results')return;
 for(const u of on(s).filter((u:any)=>u.owner===s.side&&u.poison>0)){u.poison--;damage(s,u,1,u.poisonSource);if(s.phase==='results')return;}
 s.players[s.side].objectives.forEach((o:any)=>{o.recruits=[];});
}
function makeUnit(owner:number,hero:string|null,index=0,suit?:string){return {id:owner+'-'+(hero||'r'+index),hero,index,owner,suit,hex:null,wounds:0,focus:0,enraged:0,fortified:0,daze:0,poison:0,tokens:{},turnBuff:false};}
function buildArmies(s:State){s.units=[];for(let p=0;p<2;p++){const x=s.players[p];s.units.push(...x.selected.map((h:string)=>makeUnit(p,h,0,x.suits[h])));for(let i=0;i<RULES.startingRecruits+x.extra;i++)s.units.push(makeUnit(p,null,i));
 x.deck=shuffle(s,cards.filter(c=>!c.upgraded&&factionElements(p,s.config.omitted,s.config.heroCount).includes(c.suit)).flatMap(c=>Array.from({length:tacticCopies(c.id)},(_,i)=>c.id+(i===0&&x.tacticUpgrades.includes(c.id)?'-up':'')+':'+p+':'+i)));}
 const dealt=s.players.map((p:any,i:number)=>shuffle(s,p.selected.map((h:string)=>i+'-'+h)));s.queue=Array.from({length:s.config.heroCount*2},(_,i)=>dealt[i%2===0?1-s.queueFirst:s.queueFirst][Math.floor(i/2)]);s.phase='deploy';s.side=s.first;
}
function finishSetup(s:State){for(let i=0;i<2;i++){for(let j=0;j<RULES.hand+s.players[i].draws;j++)draw(s,i);objectiveDraw(s,i);}s.side=s.first;startTurn(s);}
export function qualified(s:State,o:any,p=s.side){if(o.awaiting||o.eligible>s.activation)return false;const own=on(s).filter((u:any)=>u.owner===p),enemy=on(s).filter((u:any)=>u.owner!==p);
 switch(o.id){case 0:case 2:return !!o.done;case 1:return new Set(o.recruits).size>=2;case 3:return enemy.some((e:any)=>own.filter((u:any)=>!u.hero&&distance(u.hex,e.hex)===1).length>=3);case 4:{const spawn=board.hexes.filter(h=>h.zone===s.zones[1-p]);return own.filter((u:any)=>B[u.hex].zone!==s.zones[1-p]&&spawn.some(h=>distance(h.id,u.hex)===1)).length>=2;}case 5:return own.filter((u:any)=>u.hero&&board.xs.includes(u.hex)).length===s.config.heroCount;default:return false;}}
function pickup(s:State,u:any){if(!u.hex||!s.stones[u.hex])return;s.stones[u.hex]--;s.players[u.owner].physical++;draw(s,u.owner);}
function endTurn(s:State){if(s.modifier==='Plague'){const infected=on(s).filter((u:any)=>u.poison>0).map((u:any)=>({id:u.id,hex:u.hex,source:u.poisonSource}));const victims=on(s).map((u:any)=>({u,sources:infected.filter((v:any)=>v.id!==u.id&&distance(v.hex,u.hex)===1)}));for(const {u,sources} of victims)if(sources.length){gain(s,u,'poison',1);u.poisonSource=sources[0].source;}}
 on(s).filter((u:any)=>u.owner===s.side).forEach((u:any)=>u.turnBuff=false);s.active=null;s.side=1-s.side;startTurn(s);}
function pump(s:State){if(s.phase!=='battle'||s.pending||s.response||s.combat||s.players.some((p:any)=>p.hand.length>8))return;
 while(s.effects.length&&!s.pending&&!s.combat){const f=s.effects.shift();const u=unit(s,f.unit);
 if(f.kind==='fortify'){if(u?.hex)adjacent(s,u,true).forEach((v:any)=>gain(s,v,'fortified',2));}
 else if(f.kind==='nearest'){if(u?.hex){const a=on(s).filter((v:any)=>v.owner===u.owner&&v.id!==u.id);const n=Math.min(...a.map((v:any)=>distance(v.hex,u.hex)));const ids=a.filter((v:any)=>distance(v.hex,u.hex)===n).map((v:any)=>v.id);if(ids.length===1)gain(s,unit(s,ids[0]),'enraged',1);else if(ids.length)s.pending={kind:'nearest',ids};}}
 else if(f.kind==='dazeAdjacent'){if(u?.hex){const ids=adjacent(s,u,false).map((v:any)=>v.id);if(ids.length)s.pending={kind:'dazeTarget',ids};}}
 else if(f.kind==='assault'){const ids=(f.ids||[]).filter((id:string)=>attackTargets(s,unit(s,id)).length);if(ids.length)s.pending={...f,ids};}
 else if(f.kind==='damage'){if(u?.hex)damage(s,u,f.n);}
 else if(f.kind==='move'){if(u?.hex)s.pending=f;}
 else if(f.kind==='pushStatus'){if(u?.hex)gain(s,u,'daze',1);}
 else s.pending=f;
 }
 if(s.pending||s.combat||s.phase!=='battle')return;
 if(s.cleanup===1){const us=on(s).filter((u:any)=>u.owner===s.side&&s.stones[u.hex]>0);if(us.length){pickup(s,us[0]);pump(s);return;}s.cleanup=2;}
 if(s.cleanup===2){if(s.players[s.side].objectives.some((o:any)=>qualified(s,o))){s.pending={kind:'claim'};return;}s.cleanup=3;}
 if(s.cleanup===3){s.cleanup=4;if(!s.players[s.side].objectives.length)objectiveDraw(s,s.side);for(const u of on(s).filter((u:any)=>u.owner===s.side&&(u.id===s.active||(!u.hero&&s.used[u.id]))&&board.controls.includes(u.hex)))s.effects.push({kind:'damage',unit:u.id,n:1});pump(s);return;}
 if(s.cleanup===4&&!s.effects.length)endTurn(s);
}
function straight(s:State,u:any,n:number){return reachable(s,u,n).filter(h=>{const a=B[u.hex],b=B[h],dq=b.q-a.q,dr=b.r-a.r;return (dq===0||dr===0||dq+dr===0)&&movementPath(s,u,h).length-1===distance(u.hex,h);});}
function abilityLegal(s:State,u:any){switch(u.hero){case 'h01':return attackTargets(s,u,{range:3}).some((t:any)=>!on(s).some((v:any)=>v.owner===u.owner&&distance(v.hex,t.hex)===1));case 'h03':return on(s).some((v:any)=>v.owner!==u.owner&&distance(v.hex,u.hex)<=4);case 'h06':return on(s).some((v:any)=>v.owner===u.owner&&v.id!==u.id&&distance(v.hex,u.hex)<=3);case 'h10':return adjacent(s,u,false).length>0;case 'h14':return adjacent(s,u,true).length>0;case 'h13':return !u.tokens.ongoing;case 'h04':return !u.turnBuff;default:return true;}}
function activateAbility(s:State,id:string){const u=unit(s,id);if(!u?.hex)return;
 switch(u.hero){case 'h01':s.pending={kind:'abilityAttack',unit:id};break;case 'h11':s.effects.push({kind:'move',unit:id,range:3,straight:true},{kind:'fortify',unit:id});break;case 'h03':s.pending={kind:'pullTarget',unit:id};break;case 'h04':u.turnBuff=true;break;case 'h13':u.tokens.ongoing=true;break;case 'h06':s.pending={kind:'allyMoveTarget',unit:id,range:3,move:2,daze:true};break;case 'h12':gain(s,u,'enraged',2);break;case 'h08':gain(s,u,'enraged',2);gain(s,u,'daze',1);break;case 'h14':s.pending={kind:'allyMoveTarget',unit:id,range:1,move:3,selfMove:3};break;case 'h10':s.pending={kind:'pushTarget',unit:id,left:2,chosen:[]};break;}pump(s);
}
function openResponse(s:State,p:number,frame:any){s.response={priority:1-p,passes:0,stack:[{...frame,owner:p,cancelled:false}]};}
function resolveResponse(s:State){const r=s.response;
 while(r.stack.length){const top=r.stack.pop();if(top.cancelled)continue;if(top.kind==='cancel'){if(r.stack.length)r.stack[r.stack.length-1].cancelled=true;continue;}if(top.kind==='ability')activateAbility(s,top.unit);else if(top.kind==='tactic'){const c=C[top.card.split(':')[0]],m=c.upgraded?3:2;if(c.effect==='attack')s.combat.bonus+=m;if(c.effect==='defense')s.combat.defBonus+=m;if(c.effect==='damage')s.combat.extraDamage+=m;if(c.effect==='counter')s.combat.counter=true;if(c.effect==='moveHeal')s.pending={kind:'moveHealTarget',owner:top.owner,range:c.upgraded?5:4,heal:c.upgraded?2:1};if(c.effect==='assault')s.effects.push({kind:'assault',ids:on(s).filter((u:any)=>u.owner===top.owner&&!u.hero).map((u:any)=>u.id)});}}
 s.response=null;if(s.combat?.stage==='response'){s.combat.passes=0;s.combat.priority=1-r.baseOwner;}pump(s);
}
function cancelCards(s:State,p:number):string[]{return s.players[p].hand.filter((card:string)=>C[card.split(':')[0]].effect==='cancel');}
function pendingActions(s:State):Action[]{const f=s.pending,out:Action[]=[],add=(a:Action)=>out.push(a),u=unit(s,f.unit);
 if(f.kind==='claim'){s.players[s.side].objectives.forEach((o:any,i:number)=>{if(qualified(s,o))add({type:'claim',index:i});});add({type:'skip'});}
 if(f.kind==='move'){const spaces=f.straight?straight(s,u,f.range):reachable(s,u,f.range);spaces.forEach(hex=>add({type:'effectMove',hex}));add({type:'skip'});}
 if(['nearest','dazeTarget'].includes(f.kind)){f.ids.filter((id:string)=>unit(s,id).hex).forEach((id:string)=>add({type:'target',unit:id}));}
 if(f.kind==='abilityAttack'){attackTargets(s,u,{range:3}).filter((t:any)=>!on(s).some((v:any)=>v.owner===u.owner&&distance(v.hex,t.hex)===1)).forEach((t:any)=>add({type:'cardTarget',unit:t.id}));add({type:'skip'});}
 if(f.kind==='pullTarget')on(s).filter((v:any)=>v.owner!==u.owner&&distance(v.hex,u.hex)<=4).forEach((v:any)=>add({type:'target',unit:v.id}));
 if(f.kind==='pushTarget'){adjacent(s,u,false).filter((v:any)=>!f.chosen.includes(v.id)).forEach((v:any)=>add({type:'target',unit:v.id}));add({type:'skip'});}
 if(f.kind==='allyMoveTarget'){on(s).filter((v:any)=>v.id!==u.id&&v.owner===u.owner&&distance(v.hex,u.hex)<=f.range).forEach((v:any)=>add({type:'target',unit:v.id}));add({type:'skip'});}
 if(f.kind==='displace'){const t=unit(s,f.target);if(t.hex)board.hexes.filter(h=>distance(t.hex,h.id)===1&&distance(f.source,h.id)===distance(f.source,t.hex)+(f.pull?-1:1)&&!blocked(s,t.hex,h.id)&&!on(s).some((v:any)=>v.hex===h.id)).forEach(h=>add({type:'pushStep',hex:h.id}));add({type:'skip'});}
 if(f.kind==='moveHealTarget'){on(s).filter((v:any)=>v.owner===s.side).forEach((v:any)=>{if(reachable(s,v,f.range).length)add({type:'chooseMove',unit:v.id});if(v.wounds||v.poison)add({type:'chooseHeal',unit:v.id});});add({type:'skip'});}
 if(f.kind==='assault'){for(const id of f.ids)for(const t of attackTargets(s,unit(s,id)))add({type:'assaultAttack',unit:id,target:t.id});add({type:'skip'});}
 return out;
}
export function legalActions(s:State):Action[]{const p=s.players[s.side],out:Action[]=[],add=(a:Action)=>out.push(a),who=owner(s),x=s.players[who];
 if(s.phase==='battle'&&x.hand.length>RULES.handLimit){x.hand.forEach((card:string)=>add({type:'discard',card}));return out;}
 if(s.phase==='battle'&&x.objectives.length>2){x.objectives.forEach((_:any,index:number)=>add({type:'discardObjective',index}));return out;}
 if(s.phase==='bid'){for(const zone of ['blue','stone'])if(s.round===1||zone===s.zones[s.side])for(const amount of s.round===1?[0,2,4,6,8]:[2,4,6])add({type:'bid',zone,amount});return out;}
 if(s.phase==='prepare'){for(const h of p.roster)if(H[h]&&!p.selected.includes(h)&&!s.players[1-s.side].selected.includes(h)&&p.selected.length<s.config.heroCount&&p.pp>=H[h].cost)add({type:'hero',hero:h});p.selected.forEach((hero:string)=>{add({type:'removeHero',hero});for(const suit of factionElements(s.side,s.config.omitted,s.config.heroCount))if(p.suits[hero]!==suit)add({type:'suit',hero,suit});if(p.items[hero])add({type:'unequip',hero});});
 if(p.pp>=6)add({type:'buy',item:'recruit'});if(p.draws<RULES.handLimit-RULES.hand&&p.pp>=2)add({type:'buy',item:'draw'});for(const [stat,price] of [['move',4],['defense',6],['attack',6]] as any)if(!p.upgrades.includes(stat)&&p.pp>=price)add({type:'upgrade',stat});if(s.config.equipment)for(const h of p.selected)for(const e of equipment)if(!p.items[h]&&!Object.values(p.items).includes(e.id)&&p.pp>=e.cost&&(e.id!=='lens'||H[h].range>1)&&(e.id!=='boots'||H[h].move<7))add({type:'equip',hero:h,item:e.id});
 if(p.selected.length===s.config.heroCount)add({type:'ready'});return out;}
 if(s.phase==='deploy'){const u=s.units.find((u:any)=>u.owner===s.side&&!u.hex);if(u)spawn(s,s.side).forEach(hex=>add({type:'deploy',unit:u.id,hex}));return out;}
 if(s.phase==='results'){if(p.rp>=RULES.upgradeRP*2)for(const element of factionElements(s.side,s.config.omitted,s.config.heroCount))for(const effect of ['attack','defense','damage','moveHeal']){const id=element+'-'+effect;if(!p.tacticUpgrades.includes(id))add({type:'tacticUpgrade',card:id});}add({type:'nextResults'});return out;}
 if(s.phase!=='battle')return out;
 if(s.response){add({type:'passCancel'});const top=s.response.stack[s.response.stack.length-1];if(top.owner!==who)cancelCards(s,who).forEach(card=>add({type:'cancel',card}));return out;}
 if(s.combat){const c=s.combat;if(c.stage==='response'){add({type:'pass'});const attacking=unit(s,c.attacker).owner===who;for(const card of x.hand){const e=C[card.split(':')[0]].effect;if(e===(attacking?'attack':'defense')||(attacking&&e==='damage')||(!attacking&&e==='counter'&&!c.isCounter&&!c.counter))add({type:'response',card});}}
 if(c.stage==='reroll'){add({type:'resolve'});if(x.pp>=2)c.attackDice.forEach((_:any,die:number)=>add({type:'reroll',die}));}if(c.stage==='counter'){add({type:'declineCounter'});if(attackTargets(s,unit(s,c.defender)).some((t:any)=>t.id===c.attacker))add({type:'counterAttack'});}return out;}
 if(s.pending)return pendingActions(s);
 if(!s.active){s.queue.filter((id:string)=>unit(s,id).owner===s.side).forEach((id:string)=>add({type:'activate',unit:id}));return out;}
 add({type:'end'});for(const u of s.units.filter((u:any)=>u.owner===s.side&&(u.id===s.active||!u.hero))){if(!u.hex){if(affordable(s,u,cost(s,u,'respawn')))spawn(s,s.side).forEach(hex=>add({type:'respawn',unit:u.id,hex}));continue;}
 if(affordable(s,u,cost(s,u,'move')))reachable(s,u,moveRange(s,u)).forEach(hex=>add({type:'move',unit:u.id,hex}));
 if(affordable(s,u,cost(s,u,'attack')))attackTargets(s,u).forEach((t:any)=>add({type:'attack',unit:u.id,target:t.id}));
 if(s.stones[u.hex]&&affordable(s,u,cost(s,u,'grab')))add({type:'grab',unit:u.id});
 if(s.modifier==='Wind'&&!s.windUsed.includes(u.id)){const dirs=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]],d=dirs[s.windDirection],h=board.hexes.find(h=>h.q===B[u.hex].q+d[0]&&h.r===B[u.hex].r+d[1]);if(h&&!blocked(s,u.hex,h.id)&&!on(s).some((v:any)=>v.hex===h.id))add({type:'wind',unit:u.id,hex:h.id});}}
 if(s.modifier==='Wind')for(const u of on(s).filter((u:any)=>u.owner===s.side&&u.hero&&u.id!==s.active&&!s.windUsed.includes(u.id))){const dirs=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]],d=dirs[s.windDirection],h=board.hexes.find(h=>h.q===B[u.hex].q+d[0]&&h.r===B[u.hex].r+d[1]);if(h&&!blocked(s,u.hex,h.id)&&!on(s).some((v:any)=>v.hex===h.id))add({type:'wind',unit:u.id,hex:h.id});}
 const u=unit(s,s.active);for(const card of p.hand){const c=C[card.split(':')[0]];if(u?.hex&&c.suit.split('/').includes(u.suit)&&affordable(s,u,cost(s,u,'ability'))&&abilityLegal(s,u))add({type:'ability',unit:u.id,card});if(c.effect==='assault'&&on(s).some((v:any)=>v.owner===s.side&&!v.hero&&attackTargets(s,v).length)||c.effect==='moveHeal'&&on(s).some((v:any)=>v.owner===s.side&&(v.wounds||v.poison||reachable(s,v,c.upgraded?5:4).length)))add({type:'card',card});}
 return out;
}
export const actions=legalActions;
function same(a:Action,b:Action){return JSON.stringify(a)===JSON.stringify(b);}
export function applyAction(state:State,a:Action):string|null{const s=clone(state);try{if(a.type==='selection'){if(!['unit','tool','card'].includes(a.kind))return 'Invalid selection';}else if(a.type==='bid'){if(s.phase!=='bid'||!['stone','blue'].includes(a.zone)||!Number.isSafeInteger(a.amount)||a.amount%2||a.amount<(s.round>1?2:0)||(s.round>1&&a.zone!==s.zones[s.side]))return 'Use whole nonnegative PP, and positive increments for a tied bid.';}else if(!legalActions(s).some(b=>same(a,b)))return 'That action is unavailable.';
 execute(s,a);checkVictory(s);pump(s);s.botRoll=rand(s);s.history.push(clone(a));Object.assign(state,s);return null;}catch(e){return 'Action rejected: '+String(e);}}
export const dispatch=applyAction;
function execute(s:State,a:Action){const p=s.players[s.side],who=owner(s);switch(a.type){
 case 'selection':break;
 case 'bid':s.bids[s.side]={zone:a.zone,amount:a.amount};if(s.bids.every(Boolean)){s.reveal++;s.bidTotals=s.bidTotals.map((n:number,i:number)=>n+s.bids[i].amount);if(s.bids[0].zone===s.bids[1].zone&&s.bidTotals[0]===s.bidTotals[1]){s.zones=s.bids.map((b:any)=>b.zone);s.bids=[null,null];s.round++;s.side=0;break;}if(s.bids[0].zone!==s.bids[1].zone){s.zones=s.bids.map((b:any)=>b.zone);s.first=Math.floor(rand(s)*2);}else{s.first=s.bidTotals[0]>s.bidTotals[1]?0:1;s.zones[s.first]=a.zone;s.zones[1-s.first]=a.zone==='stone'?'blue':'stone';s.players[1-s.first].pp+=s.bidTotals[s.first];s.players[1-s.first].bidBonus=s.bidTotals[s.first];}s.queueFirst=s.bidTotals[0]===s.bidTotals[1]?1:s.bidTotals[0]<s.bidTotals[1]?0:1;s.phase='prepare';s.side=0;}else s.side=1-s.side;break;
 case 'hero':p.selected.push(a.hero);p.pp-=H[a.hero].cost;p.suits[a.hero]=factionElements(s.side,s.config.omitted,s.config.heroCount).find(e=>!Object.values(p.suits).includes(e));break;
 case 'removeHero':p.selected.splice(p.selected.indexOf(a.hero),1);p.pp+=H[a.hero].cost;delete p.suits[a.hero];if(p.items[a.hero]){p.pp+=equipment.find(e=>e.id===p.items[a.hero])!.cost;delete p.items[a.hero];}break;
 case 'suit':{const h=p.selected.find((h:string)=>p.suits[h]===a.suit),old=p.suits[a.hero];p.suits[a.hero]=a.suit;if(h)p.suits[h]=old;break;}
 case 'buy':p.pp-=a.item==='draw'?2:6;if(a.item==='draw')p.draws++;else p.extra++;break;
 case 'upgrade':p.pp-=a.stat==='move'?4:6;p.upgrades.push(a.stat);break;
 case 'equip':p.pp-=equipment.find(e=>e.id===a.item)!.cost;p.items[a.hero]=a.item;break;
 case 'unequip':p.pp+=equipment.find(e=>e.id===p.items[a.hero])!.cost;delete p.items[a.hero];break;
 case 'ready':p.pp=Math.min(p.pp,p.bidBonus);p.ready=true;if(s.players.every((x:any)=>x.ready))buildArmies(s);else s.side=1-s.side;break;
 case 'deploy':unit(s,a.unit).hex=a.hex;if(!s.units.some((u:any)=>u.owner===s.side&&!u.hex)){s.side=1-s.side;if(s.units.every((u:any)=>u.hex))finishSetup(s);}break;
 case 'activate':{const [ap,rap]=entitlement(s,s.queue.indexOf(a.unit));s.ap=ap;s.rap=rap;s.activationQueue=[...s.queue];queueShift(s,a.unit);s.active=a.unit;s.activation++;unit(s,a.unit).tokens={};p.objectives.forEach((o:any)=>{if(o.awaiting){o.awaiting=false;o.eligible=s.activation;}});break;}
 case 'move':pay(s,unit(s,a.unit),'move');moveUnit(s,unit(s,a.unit),a.hex);break;
 case 'wind':s.windUsed.push(a.unit);moveUnit(s,unit(s,a.unit),a.hex);break;
 case 'attack':pay(s,unit(s,a.unit),'attack');beginCombat(s,unit(s,a.unit),unit(s,a.target));break;
 case 'grab':pay(s,unit(s,a.unit),'grab');pickup(s,unit(s,a.unit));break;
 case 'respawn':{const u=unit(s,a.unit);pay(s,u,'respawn');Object.assign(u,{hex:a.hex,wounds:0,focus:0,enraged:0,fortified:0,daze:0,poison:0,tokens:{},turnBuff:false});break;}
 case 'ability':pay(s,unit(s,a.unit),'ability');discard(s,s.side,a.card);p.apDiscards++;openResponse(s,s.side,{kind:'ability',unit:a.unit});break;
 case 'card':case 'response':discard(s,who,a.card);s.players[who].printedEffects++;openResponse(s,who,{kind:'tactic',card:a.card});s.response.baseOwner=who;break;
 case 'cancel':discard(s,who,a.card);s.response.stack.push({kind:'cancel',owner:who,cancelled:false});s.response.priority=1-who;s.response.passes=0;break;
 case 'passCancel':s.response.passes++;s.response.priority=1-who;if(s.response.passes===2)resolveResponse(s);break;
 case 'pass':s.combat.passes++;s.combat.priority=1-who;if(s.combat.passes===2)roll(s);break;
 case 'resolve':resolveCombat(s);break;
 case 'reroll':s.players[who].pp-=2;s.players[who].rerolls++;s.combat.attackDice[a.die]=s.combat.zeroAttack?Math.min(die(s),die(s)):die(s);s.reveal++;rememberRoll(s);break;
 case 'counterAttack':{const c=s.combat;beginCombat(s,unit(s,c.defender),unit(s,c.attacker),true,null,true);break;}
 case 'declineCounter':s.combat=null;break;
 case 'target':{const f=s.pending,t=unit(s,a.unit),u=unit(s,f.unit);s.pending=null;
 if(f.kind==='nearest')gain(s,t,'enraged',1);
 if(f.kind==='dazeTarget')gain(s,t,'daze',1);
 if(f.kind==='pullTarget')s.pending={kind:'displace',source:u.hex,target:t.id,left:3,pull:true,grant:u.id,killer:u.owner};
 if(f.kind==='pushTarget'){const after={...f,left:f.left-1,chosen:[...f.chosen,t.id]};s.effects.unshift({kind:'pushStatus',unit:t.id},...(after.left?[after]:[]));s.pending={kind:'displace',source:u.hex,target:t.id,left:2,pull:false,killer:u.owner};}
 if(f.kind==='allyMoveTarget'){s.effects.unshift({kind:'move',unit:t.id,range:f.move},...(f.daze?[{kind:'dazeAdjacent',unit:t.id}]:[]),...(f.selfMove?[{kind:'move',unit:u.id,range:f.selfMove}]:[]));}break;}
 case 'effectMove':{const f=s.pending;s.pending=null;moveUnit(s,unit(s,f.unit),a.hex);break;}
 case 'pushStep':{const f=s.pending,t=unit(s,f.target);t.hex=a.hex;hazard(s,t,f.killer);if(s.phase==='results')break;f.left--;s.pending=null;if(t.hex&&f.left)s.effects.unshift(f);if(f.grant)s.effects.unshift({kind:'nearest',unit:f.grant});break;}
 case 'cardTarget':{const f=s.pending;s.pending=null;beginCombat(s,unit(s,f.unit),unit(s,a.unit),false,{attack:3,range:3,heavy:2});break;}
 case 'chooseMove':{const f=s.pending;s.pending={kind:'move',unit:a.unit,range:f.range};break;}
 case 'chooseHeal':heal(s,unit(s,a.unit),s.pending.heal);s.pending=null;break;
 case 'assaultAttack':{const f=s.pending;s.pending=null;const ids=f.ids.filter((id:string)=>id!==a.unit);if(ids.length)s.effects.unshift({...f,ids});beginCombat(s,unit(s,a.unit),unit(s,a.target),false);break;}
 case 'skip':{const f=s.pending;s.pending=null;if(f.kind==='claim')s.cleanup=3;break;}
 case 'end':s.cleanup=1;break;
 case 'claim':{const o=p.objectives.splice(a.index,1)[0];p.completed.push(o.id);s.pending=null;s.cleanup=3;awardVP(s,s.side,1,'objective');if(s.phase!=='results')draw(s,s.side);break;}
 case 'discard':discard(s,who,a.card);break;
 case 'discardObjective':s.players[who].objectives.splice(a.index,1);break;
 case 'tacticUpgrade':p.rp-=RULES.upgradeRP*2;p.tacticUpgrades.push(a.card);break;
 case 'nextResults':p.ready=false;if(!s.players.some((x:any)=>x.ready))s.phase='complete';else s.side=1-s.side;break;
 }}
export function playerView(s:State,p:number|null){const v:any=clone(s);delete v.rng;delete v.seed;delete v.botRoll;delete v.history;delete v.objectiveDeck;delete v.bids;delete v.effects;delete v.bidTotals;delete v.config.campaign;v.objectiveCount=s.objectiveDeck.length;v.players.forEach((x:any,i:number)=>{x.handCount=x.hand.length;x.deckCount=x.deck.length;x.discardCount=x.discard.length;delete x.deck;delete x.discard;if(i!==p){x.hand=[];x.objectives=[];}});return v;}
export function replay(seed:number,config:any,history:Action[]){const s=newGame(seed,config);for(const a of history){const e=dispatch(s,a);if(e)throw Error(e);}return s;}
export function nextBattle(s:State){if(s.phase!=='complete')throw Error('Finish settlement first');if(s.players.some((p:any)=>p.wins>=10)||Math.abs(s.players[0].wins-s.players[1].wins)>=4)throw Error('Campaign complete');return newGame(s.rng,{...s.config,campaign:{battle:s.battle+1,players:s.players.map((p:any)=>({roster:p.roster,rp:p.rp,wins:p.wins,tacticUpgrades:p.tacticUpgrades}))}});}
const cache=new Map<number,any[]>();
export function poolDistribution(n:number):any[]{if(cache.has(n))return cache.get(n)!;if(n===0){const rows=Array.from({length:6},(_,i)=>({max:i+1,sixes:i===5?1:0,p:((6-i)**2-(5-i)**2)/36}));cache.set(n,rows);return rows;}let dp=[{max:0,sixes:0,p:1}];for(let i=0;i<n;i++){const next=new Map<string,any>();for(const x of dp)for(let d=1;d<=6;d++){const max=Math.max(x.max,d),sixes=x.sixes+(d===6?1:0),key=max+':'+sixes,v=next.get(key)||{max,sixes,p:0};v.p+=x.p/6;next.set(key,v);}dp=[...next.values()];}cache.set(n,dp);return dp;}
export function hitProbability(a:number,d:number){let p=0;for(const x of poolDistribution(a))for(const y of poolDistribution(d))if(x.max>y.max||(x.max===y.max&&(x.max!==6||x.sixes>=y.sixes)))p+=x.p*y.p;return p;}
export function bot(view:any,legal:Action[]):Action{if(!legal.length)throw Error('No legal actions');const me=view.decisionOwner??owner(view),p=view.players[me];let best=legal[0],score=-Infinity;
 for(const a of legal){let n=0;switch(a.type){case 'bid':n=(a.zone===((me^(view.config.simulationZoneSwap?1:0))?'blue':'stone')?30:0)-a.amount;break;case 'hero':n=30-H[a.hero].cost;break;case 'removeHero':case 'unequip':case 'suit':n=-100;break;case 'ready':n=10;break;case 'deploy':case 'respawn':n=30-Math.min(...board.controls.map(h=>distance(h,a.hex)));break;case 'activate':n=entitlement(view,view.queue.indexOf(a.unit))[0]*4;break;case 'move':case 'effectMove':case 'wind':{const u=unit(view,a.unit||view.pending.unit);const goals=[...board.controls,...Object.keys(view.stones).filter(h=>view.stones[h])].filter(h=>!on(view).some((v:any)=>v.id!==u.id&&v.owner===me&&v.hex===h));const dist=(h:string)=>Math.min(...goals.map(g=>distance(g,h)));n=5+(dist(u.hex)-dist(a.hex))*4-dist(a.hex);if(view.stones[a.hex])n+=10;if(board.controls.includes(a.hex))n+=5;break;}case 'attack':n=20+unit(view,a.target).wounds*3;break;case 'ability':n=6;break;case 'card':n=3;break;case 'response':n=15;break;case 'cancel':n=4;break;case 'target':case 'cardTarget':case 'assaultAttack':n=12;break;case 'pushStep':n=5;break;case 'chooseHeal':n=10;break;case 'chooseMove':n=4;break;case 'grab':n=25;break;case 'claim':n=50;break;case 'pass':case 'passCancel':case 'resolve':n=10;break;case 'counterAttack':n=20;break;case 'skip':n=-5;break;case 'buy':case 'upgrade':case 'equip':n=-10;break;case 'tacticUpgrade':n=p.rp>8?1:-2;break;case 'nextResults':n=5;break;case 'end':n=0;break;case 'reroll':n=-5;break;default:n=1;}if(n>score){score=n;best=a;}}return best;}
