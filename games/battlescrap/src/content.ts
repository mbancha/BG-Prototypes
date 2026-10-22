export const VERSION='turn-rules-v8';
export const suits=['Fire','Lightning','Water'];
export const regions=[
 {name:'Windlands',text:'Tall-grass plains, proud clan leaders and prized lion-shifters. Brown, green and red grass-woven dress; Bantu-inspired fictional cultures. Ambush, speed and misdirection.'},
 {name:'Highholm',text:'Frozen peaks, frost giants, heavy furs and leather. Longhouses ring with feasts of mead and meat. Norse-inspired warriors turn stone-hard to endure.'},
 {name:"Cinder’s Rim",text:'A mysterious volcanic settlement of masked fire-priests and many fire gods. Carved tiki-inspired forms, ember rituals, magma and dangerous bursts of power.'},
 {name:'Timberwood',text:'Powerfully built, beardless woodland elves: axe-workers, growers and master joiners. Living public avenues meet towering timber halls. Hardwood arms and armor draw on medieval Japanese forms; every harvest is replanted.'},
 {name:'Port Windlass',text:'Starfall whipped the island seas into a frenzy. A few sailors travel behind tamed whales or sharks; many now raid the rivers. Age-of-sail and Polynesian maritime influences meet wind-calling warriors.'},
];
export const heroes=[
 ["h01", "Kalawi Bloodmane", "Striker", "Scout", "Windlands", 5, 1, 3, 1, 10, "Ambush", "Start my activation with no adjacent enemy: +3 Attack this activation."],
 ["h02", "Brynja Stonehide", "Guard", "Support", "Highholm", 3, 5, 3, 1, 14, "Living Rampart", "Other allies within 2 gain +1 Defense."],
 ["h03", "Voru Cinderveil", "Controller", "Striker", "Cinder’s Rim", 4, 1, 3, 2, 10, "Magma Surge", "1 AP, once: Push an enemy within 4 up to 3; give it 1 Dazed."],
 ["h04", "Tavi Sailwhistle", "Scout", "Support", "Port Windlass", 6, 1, 2, 1, 8, "Follow the Wind", "Recruits starting a Move within 3 gain +1 Move."],
 ["h05", "Marda Oakweaver", "Support", "Guard", "Timberwood", 4, 3, 2, 1, 8, "Living Graft", "1 AP, once: heal another adjacent ally 1 wound."],
 ["h06", "Niala Grassveil", "Controller", "Support", "Windlands", 5, 1, 2, 1, 6, "False Trail", "1 AP, once: give an enemy within 3 one Dazed."],
 ["h07", "Eirik Hearthkeeper", "Support", "Guard", "Highholm", 3, 4, 2, 1, 10, "Hearth Oath", "1 AP, once: give another ally within 2 one Boosted."],
 ["h08", "Ketu Ashheart", "Striker", "Controller", "Cinder’s Rim", 4, 1, 5, 2, 16, "Feed the Fire", "My Dazed adds Attack dice instead of subtracting them."],
 ["h09", "Ren Timberwright", "Scout", "Guard", "Timberwood", 4, 3, 3, 2, 12, "Felling Line", "Friendly recruits gain +2 Attack against enemies adjacent to me."],
 ["h10", "Orro Stormanchor", "Guard", "Controller", "Port Windlass", 3, 5, 2, 1, 12, "Anchor Stance", "I cannot be Pushed. +1 Defense against melee attacks."],
].map(([id,name,job,secondary,region,move,defense,attack,range,cost,ability,text])=>({id,name,job,secondary,region,move,defense,attack,range,cost:Number(cost),ability,text} as any));
export const H=Object.fromEntries(heroes.map(h=>[h.id,h]));
export const cards=[
 ['t01','Press the Attack',0,'attackFavored','Fire','Combat: +1 die; +2 if attacking.'],
 ['t02','Stand Firm',0,'defenseFavored','Fire','Combat: +1 die; +2 if defending.'],
 ['t03','Press the Attack',0,'attackFavored','Lightning','Combat: +1 die; +2 if attacking.'],
 ['t04','Stand Firm',0,'defenseFavored','Lightning','Combat: +1 die; +2 if defending.'],
 ['t05','Press the Attack',0,'attackFavored','Water','Combat: +1 die; +2 if attacking.'],
 ['t06','Stand Firm',0,'defenseFavored','Water','Combat: +1 die; +2 if defending.'],
 ['t07','Twist the Blade',0,'extraWound','Fire','Before attacking: a hit deals +1 wound.'],
 ['t08','Riposte',0,'counter','Water','Before defending: if you block, counterattack.'],
 ['t09','Shake It Off',0,'cleanseAlly','Lightning','Remove all negative statuses from an ally.'],
 ['t10','Wrong Foot',0,'queueDaze','Lightning','Give an enemy lower in the queue 2 Dazed.'],
 ["h01a", "Surprise Strike", 1, "surprise", "", "Attack at +1, then you may move 3."],
 ["h01b", "Pride’s Feint", 0, "swapRecruit", "", "Swap places with a friendly recruit, then you may move 1."],
 ["h02a", "Stone-Skin", 1, "fortify", "", "Gain +3 Defense until my next activation."],
 ["h02b", "Shield the Hearth", 0, "move2", "", "Move up to 2."],
 ["h03a", "Wall of Flame", 1, "fireWall", "", "Place a flame edge within 4 until my next activation. Crossing: 1 wound."],
 ["h03b", "Magma Eruption", 2, "tideattack", "", "Attack at +2. Then gain 1 Dazed."],
 ["h04a", "Boarding Party", 1, "moveRecruits2", "", "Move up to two friendly recruits within 3 up to 2 each."],
 ["h04b", "Fair Wind", 0, "haste", "", "Haste another friendly hero within 3."],
 ["h05a", "Graftwood Brace", 1, "healBoost", "", "Heal another ally within 3 by 1; give it 1 Boosted."],
 ["h05b", "Rootwalk", 0, "move2", "", "Move up to 3."],
 ["h06a", "Lion’s False Roar", 1, "daze2", "", "Give up to two enemies within 2 one Dazed each."],
 ["h06b", "Vanish in the Grass", 1, "scatter", "", "Move up to 3, then you may Push an adjacent enemy 2 and give it 1 Dazed."],
 ["h07a", "Winter Feast", 1, "healBoost", "", "Heal another ally within 2 by 1; give it 2 Boosted."],
 ["h07b", "Hearthward", 1, "drawAlly", "", "Move another ally within 3 up to 3."],
 ["h08a", "Stoke the Furnace", 0, "selfDaze", "", "Gain 2 Dazed."],
 ["h08b", "Ashen Lance", 2, "tideattack", "", "Attack at +2. Then gain 1 Dazed."],
 ["h09a", "Raise the Timber", 0, "timberWall", "", "Build an adjacent timber wall until my next activation."],
 ["h09b", "Work Crew", 1, "moveRecruits3", "", "Move up to two friendly recruits within 3 up to 2 each."],
 ["h10a", "Anchor Exchange", 1, "swapAlly", "", "Swap places with another ally within 3."],
 ["h10b", "Breakwater", 1, "push", "", "Push an adjacent enemy 3; give it 1 Dazed."],
].map(([id,name,cost,effect,suit,text])=>({id,name,cost,effect,suit,text,hero:String(id).startsWith('h')?String(id).slice(0,3):null} as any));
export const C=Object.fromEntries(cards.map(c=>[c.id,c]));
export const combatEffects=['attackFavored','defenseFavored','extraWound','counter'];
export const tacticCopies=(id:string,preset:string)=>Number(id.slice(1))<=6?(preset==='exposure'?1:2):['t07','t08'].includes(id)?2:1;
export const objectives=[
 ['Draw Blood','Hit an enemy with an attack.'],
 ['Stand Fast','Block an enemy attack.'],
 ['Hero Hunter','Defeat an enemy hero with an attack.'],
 ['Break the Rank','Defeat two different enemy recruits with attacks.'],
 ['Cut Down','Defeat an enemy recruit with an attack.'],
 ['Press the Advantage','Hit twice with the same hero in one activation.'],
 ['Against the Odds','Block an attack whose final pool exceeds your Defense pool.'],
 ['Crushing Blow','Deal at least 2 wounds with one attack.'],
 ['Hold Together','Block attacks with two different friendly units.'],
 ['Trade Blows','The same surviving hero both hits and blocks an attack.'],
];
export const equipment=[{id:'boots',name:'Trail Boots',cost:2,text:'+1 Move (item maximum 7)'},{id:'shield',name:'Bellmetal Shield',cost:4,text:'+1 Defense against melee'},{id:'weapon',name:'Balanced Weapon',cost:4,text:'+1 basic Attack'},{id:'lens',name:'Sighting Lens',cost:4,text:'+1 ranged basic range'}];
export const profile=[0,1,2,2,3,3,4,4];
export const money=(n:number)=>String(n/2);
export const hexes:any[]=[];
// Flat-top odd-column layout calibrated against the unmodified supplied raster.
for(let col=0;col<=14;col++)for(let row=0;row<=9;row++){
 const x=-3+128.7*col,y=148.5*row+(col%2?74.25:0);
 if(x<0||x>1824||y<0||y>1368)continue;
 const blue=(col>=3&&col<=12&&row===0)||([4,6,7,8,10].includes(col)&&row===1);
 const stone=(col===1&&row>=6)||(col===2&&row>=7)||(col===3&&y>=1180)||(col===4&&y>=1300)||(col===5&&y>=1180)||(col===6&&y>=1300);
 hexes.push({id:`${col},${row}`,q:col,r:row-(col-(col&1))/2,x,y,zone:blue?'blue':stone?'stone':null,level:0});
}
export const board={hexes,controls:['2,4','10,3','7,5'],stones:['3,1','6,3','12,5','10,7','5,7'],walls:[] as string[]};
export const B=Object.fromEntries(hexes.map(h=>[h.id,h]));
export function distance(a:string,b:string){if(!B[a]||!B[b])return Infinity;let q=B[a].q-B[b].q,r=B[a].r-B[b].r;return (Math.abs(q)+Math.abs(r)+Math.abs(q+r))/2;}

export const portraitPaths:Record<string,string>={"h01": "./heroes-v7/h01-kalawi-bloodmane.png", "h02": "./heroes-v7/h02-brynja-stonehide.png", "h03": "./heroes-v7/h03-voru-cinderveil.png", "h04": "./heroes-v7/h04-tavi-sailwhistle.png", "h05": "./heroes-v7/h05-marda-oakweaver.png", "h06": "./heroes-v7/h06-niala-grassveil.png", "h07": "./heroes-v7/h07-eirik-hearthkeeper.png", "h08": "./heroes-v7/h08-ketu-ashheart.png", "h09": "./heroes-v7/h09-ren-timberwright.png", "h10": "./heroes-v7/h10-orro-stormanchor.png"};
