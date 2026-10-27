import React from 'react';
export const symbols:Record<string,string>={
 Fire:'M12 2C15 8 7 8 10 13C5 12 6 8 6 8C-1 19 10 25 16 21C23 17 18 10 16 8C17 15 11 17 12 2Z',
 Lightning:'M14 1L3 14H10L8 23L21 9H13Z',
 Water:'M12 1C9 7 3 12 3 16A9 9 0 0 0 21 16C21 12 15 7 12 1Z',
 move:'M3 12H21M15 6L21 12L15 18M8 5L3 12L8 19',
 attack:'M5 21L20 3L17 3L3 17M3 14L10 21M3 21L6 18',
 bow:'M5 3Q26 12 5 21L13 12ZM2 12H23M19 8L23 12L19 16',
 defense:'M12 2L21 6L19 16L12 22L5 16L3 6Z',
 heart:'M12 22L3 13C-4 4 7 -2 12 6C17 -2 28 4 21 13Z',
 boost:'M12 1L15 7L22 8L17 13L18 21L12 17L5 21L6 13L1 8L9 7Z',
 daze:'M8 2H16L23 9V16L16 23H8L1 16V9Z',
 stunned:'M8 1H16L22 7V17L16 23H8L2 17V7ZM4 4L20 20',
 haste:'M2 4L10 12L2 20M12 4L20 12L12 20',
 slow:'M2 2H22M2 22H22M5 2Q5 10 12 12Q19 14 19 22M19 2Q19 10 12 12Q5 14 5 22',
 soldier:'M8 2H16L18 7L16 11L20 13L23 21H16L14 16H10L8 21H1L4 13L8 11L6 7Z',
};
export function Glyph({name,...props}:{name:string;[k:string]:any}){return <svg viewBox="0 0 24 24" {...props}><path d={symbols[name]||symbols.attack} fill={['move','attack','bow','haste','slow','heart'].includes(name)?'none':'currentColor'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;}
export function Icon({name}:{name:string}){return <span className={`icon icon-${name}`} role="img" aria-label={name} title={name}><Glyph name={name}/></span>;}
export const statusDetails:Record<string,string>={boost:'Boosted: add this many Attack and Defense dice; consume one existing token after combat.',daze:'Dazed: subtract this many Attack and Defense dice (minimum 1); consume one existing token after combat.',stunned:'Stunned: movement only during your activation; clears at activation end.',haste:'Haste: shift an activation card up the action track; current AP stays unchanged.',slow:'Slow: shift an activation card down the action track; current AP stays unchanged.'};
export function Status({name,n}:{name:string;n:number}){return n>0?<span className={`status status-${name}`} role="img" aria-label={`${name} ${n}`} title={statusDetails[name]}><Glyph name={name}/><b>{n}</b></span>:null;}
export function Stats({h}:{h:any}){return <span className="stats"><Icon name="move"/>{h.move} <Icon name={h.range>1?'bow':'attack'}/>{h.attack}{h.range>1?` (${h.range})`:''} <Icon name="defense"/>{h.defense}</span>;}
export function Heart({n}:{n:number}){return <span className="health" aria-label={`${n} health`}><Glyph name="heart"/><b>{n}</b></span>;}
