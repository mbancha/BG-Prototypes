import snapshot from './data/hero-snapshot.json';
import tactics from './data/tactics.json';
import {RULES} from './data/config';
export const VERSION=RULES.version;
export const suits=RULES.elements;
export const factionElements=(_side:number,omitted=3,count=3)=>RULES.elements.filter((_,i)=>count===4||i!==omitted);
const number=(v:any)=>Number(String(v).replace(/\{hex:(\d+)\}/,'$1'));
const sourceRows=(name:string)=>{const rows=snapshot.sheets.find(s=>s.name===name)!.rows;return rows.slice(1).map(row=>Object.fromEntries(rows[0].map((header,i)=>[header,row[i]])));};
export const heroes:any[]=sourceRows('Heroes').filter(r=>r.Availability==='Starter').map(r=>({id:r.ID,name:r.Name,region:r.Region,side:r['Starter side']==='Concord'?0:1,job:r['Primary class'],secondary:r['Secondary class'],cost:number(r['PP cost'])*2,hp:number(r.HP),move:number(r.Move),attack:number(r['Attack dice']),range:number(r['Attack range']),rangeRule:r['Range rule'],defense:number(r['Defense dice']),ability:r['Unique ability'],ap:number(r['Base AP cost']),text:r['Ability effect'],notes:r.Notes}));
export const H:Record<string,any>=Object.fromEntries(heroes.map(h=>[h.id,h]));
export const regions=sourceRows('Regions').map(r=>({name:r.Region,ability:r['Region Ability Name'],text:r['Regional ability']}));
export const cards:any[]=tactics.rows.slice(1).map(r=>({id:r[0],name:r[1]+' · '+r[3],suit:r[1],effect:r[0].split('-')[1],text:r[3],copies:Number(r[2]),cost:0,hero:null}));
export const C:Record<string,any>=Object.fromEntries(cards.map(c=>[c.id,c]));
export const combatEffects=['attack','defense','damage','counter'];
export const tacticCopies=(id:string,_preset='baseline')=>C[id]?.copies||0;
export const objectives=[['Close the Net','Attack an enemy adjacent to at least three of my allies.'],['Break the Levy','Attack two distinct enemy Recruits in one turn.'],['Into the Teeth','Attack with a hero adjacent to at least two enemies.'],['Pin Them Down','End my turn with three friendly Recruits adjacent to the same enemy.'],['At Their Gates','End my turn with at least two friendly units outside and adjacent to the enemy spawn area.'],['Claim the Starfall','End my turn with every one of my heroes on a printed X.']];
export const equipment=[{id:'boots',name:'Trail Boots',cost:2,text:'+{hex:1} Move (maximum 7)'},{id:'shield',name:'Bellmetal Shield',cost:4,text:'+1 Defense versus melee'},{id:'weapon',name:'Balanced Weapon',cost:4,text:'+1 basic Attack die'},{id:'lens',name:'Sighting Lens',cost:4,text:'+{hex:1} ordinary ranged range'}];
export const profile=RULES.queue3.map(p=>p[0]);
export const money=(n:number)=>String(n/2);
export const hexes:any[]=[];
// Calibrated to the supplied 21 October map, normalized to the UI viewBox.
for(let col=0;col<=14;col++)for(let row=0;row<=10;row++){
 const x=(-54+169*col)*1824/2262,y=(195*row+(col%2?97.5:0))*1368/1763;
 if(x<91||x>1824-91||y<75||y>1368-75)continue;
 const blue=(row===0&&[3,5,7,9,11].includes(col))||(row===1&&[2,3,4,6,7,8,10].includes(col));
 const stone=['1,6','1,7','1,8','2,7','2,8','3,8','5,8','13,8'].includes(col+','+row);
 hexes.push({id:col+','+row,q:col,r:row-(col-(col&1))/2,x,y,zone:blue?'blue':stone?'stone':null,level:0});
}
export const board={hexes,controls:['3,3','10,3','7,5'],xs:['1,2','5,3','8,4','4,5','10,5','12,4','13,2','12,6','9,6'],stones:[] as string[],walls:[] as string[]};
export const B:Record<string,any>=Object.fromEntries(hexes.map(h=>[h.id,h]));
export function distance(a:string,b:string){if(!B[a]||!B[b])return Infinity;const q=B[a].q-B[b].q,r=B[a].r-B[b].r;return (Math.abs(q)+Math.abs(r)+Math.abs(q+r))/2;}
export const portraitPaths:Record<string,string>=Object.fromEntries(heroes.map(h=>[h.id,h.id==='h01'||Number(h.id.slice(1))>=11?'./heroes-current/'+h.id+'-'+h.name.toLowerCase().replaceAll(' ','-')+'.png':'./heroes-v7/'+h.id+'-'+h.name.toLowerCase().replaceAll(' ','-')+'.png']));
