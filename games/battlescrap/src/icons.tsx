import React from 'react';
import {RULES} from './data/config';
export const symbols:Record<string,string>={
 Fire:'M12 2C15 8 7 8 10 13C5 12 6 8 6 8C-1 19 10 25 16 21C23 17 18 10 16 8C17 15 11 17 12 2Z',
 Lightning:'M14 1L3 14H10L8 23L21 9H13Z',Water:'M12 1C9 7 3 12 3 16A9 9 0 0 0 21 16C21 12 15 7 12 1Z',
 Ice:'M11 1H13V7L18 4L19 6L14 9H22V11H15L20 16L18 18L13 13V22H11V14L6 19L4 17L9 12H1V10H9L4 5L6 3L11 8Z',
 Wind:'M2 6H15Q22 0 22 7Q22 11 16 11H1V9H16Q20 9 20 6Q20 4 17 8H2ZM3 14H18Q24 14 22 20Q19 25 15 20L17 18Q20 22 20 17H3Z',
 Earth:'M1 21L8 4L12 11L16 6L23 21ZM8 8L5 15H11Z',Metal:'M3 6L12 1L21 6V18L12 23L3 18ZM6 8V16L12 20V5Z',
 Smoke:'M2 19Q-1 12 6 11Q1 5 9 5Q10-1 15 3Q23 1 21 10Q28 16 22 20Z',
 attack:'M5 21L20 3L17 3L3 17M3 14L10 21M3 21L6 18',bow:'M5 3Q26 12 5 21L13 12ZM2 12H23M19 8L23 12L19 16',
 move:'M3 12H21M15 6L21 12L15 18M8 5L3 12L8 19',defense:'M12 2L21 6L19 16L12 22L5 16L3 6Z',
 heart:'M12 22L3 13C-4 4 7 -2 12 6C17 -2 28 4 21 13Z',focus:'M12 1L15 7L22 8L17 13L18 21L12 17L5 21L6 13L1 8L9 7Z',
 enraged:'M2 4L10 8L12 1L15 8L22 4L18 14L22 21L12 18L3 22L6 13Z',fortified:'M12 2L21 6L19 16L12 22L5 16L3 6Z',
 daze:'M8 2H16L23 9V16L16 23H8L1 16V9Z',poison:'M8 2H16V5H14V10L21 20H3L10 10V5H8Z',
 soldier:'M8 2H16L18 7L16 11L20 13L23 21H16L14 16H10L8 21H1L4 13L8 11L6 7Z'};
export function Glyph({name,...props}:{name:string;[k:string]:any}){return <svg viewBox="0 0 24 24" {...props}><path d={symbols[name]||symbols.attack} fill={['move','attack','bow','heart'].includes(name)?'none':'currentColor'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;}
export function Element({name='?'}:{name?:string}){return <span className="element" role="img" title={name==='?'?'My assigned element':name} aria-label={name==='?'?'My assigned element':name} style={{background:RULES.colors[name]||'linear-gradient(135deg,#e74d4d,#ffe65c,#42c28a,#72beed,#ae75cd)'}}>{name==='?'?<b>?</b>:<Glyph name={name} style={{color:'black',filter:name==='Smoke'?'drop-shadow(0 0 1px white)':'none'}}/>}</span>;}
export function Icon({name}:{name:string}){return RULES.colors[name]||name==='?'?<Element name={name}/>:<span className={'icon icon-'+name} role="img" title={name} aria-label={name}><Glyph name={name}/></span>;}
export const statusDetails:Record<string,string>={focus:'Focus: +1 Attack die per token; spend the participating stack after attacking, hit or miss.',enraged:'Enraged: +1 hit damage per token; spend after attacking, even on a miss.',fortified:'Fortified: +1 Defense die per token; spend the participating stack after defending.',daze:'Dazed: −1 Defense die per token; spend the participating stack after defending.',poison:'Poison: at the start of my side’s turn take 1 damage and remove 1 token. Healing restores HP and clears all Poison.'};
export function Status({name,n}:{name:string;n:number}){return n>0?<span className={'status status-'+name} title={statusDetails[name]} aria-label={name+' '+n}><Glyph name={name}/><b>{n}</b></span>:null;}
export function Hex({n}:{n:number}){return <span className="hex-number" aria-label={n+' spaces'}><svg viewBox="0 0 28 26" aria-hidden="true"><polygon points="7,1 21,1 27,13 21,25 7,25 1,13" fill="#fff0d3" stroke="#000" strokeWidth="1.7"/><text x="14" y="18" textAnchor="middle" fill="#000" fontFamily="Arial" fontWeight="bold" fontSize="15">{n}</text></svg></span>;}
export function RuleText({text}:{text:string}){return <>{String(text).split(/(\{hex:\d+\}|\[Ranged Attack\]|\[attack\]|\[ranged attack\]|\[defense\])/g).map((t,i)=>t.startsWith('{hex:')?<Hex key={i} n={Number(t.slice(5,-1))}/>:t.startsWith('[')?<Icon key={i} name={/ranged/i.test(t)?'bow':t==='[defense]'?'defense':'attack'}/>:<React.Fragment key={i}>{t}</React.Fragment>)}</>;}
export function Stats({h}:{h:any}){return <span className="stats"><Icon name="move"/><Hex n={h.move}/> <Icon name={h.range>1?'bow':'attack'}/>{h.attack} {h.range>1&&<Hex n={h.range}/>} <Icon name="defense"/>{h.defense}</span>;}
export function Heart({n,hero=false}:{n:number;hero?:boolean}){return <><span className="health" aria-label={n+' health'}><Glyph name="heart"/><b>{n}</b></span>{hero&&n===1&&<span title="Damage from above 1 HP to exactly 1 HP gives me 1 Enraged"><Icon name="enraged"/></span>}</>;}
