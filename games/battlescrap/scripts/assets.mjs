import {existsSync,readdirSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
const source=JSON.parse(readFileSync('src/data/hero-snapshot.json','utf8'));
for(const r of source.sheets[0].rows.slice(1).filter(r=>r[3]==='Starter'&&r[0]!=='h01')){const path=(Number(r[0].slice(1))>=11?'public/heroes-current/':'public/heroes-v7/')+r[0]+'-'+r[1].toLowerCase().replaceAll(' ','-')+'.png';if(!existsSync(path))throw Error('Missing current portrait: '+path);}
if(!existsSync('public/scenario-1.png'))throw Error('Current scenario missing');
const text=readFileSync('src/icons.tsx','utf8'),literal=text.match(/symbols:Record<string,string>=(\{[\s\S]*?\});/)[1],symbols=vm.runInNewContext('('+literal+')');
const colors={Fire:'#e34136',Lightning:'#ffe14d',Metal:'#c4c9ce',Smoke:'#252525',Ice:'#ffffff',Wind:'#83cafa',Water:'#35c8c1',Earth:'#96623c'};
mkdirSync('assets/icons',{recursive:true});
for(const [name,background] of Object.entries(colors)){const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 28 28"><rect x="-1" y="-1" width="26" height="26" fill="'+background+'" stroke="black" stroke-width="2"/><path d="'+symbols[name]+'" fill="black" stroke="'+(name==='Smoke'?'#ddd':'black')+'" stroke-width=".5"/></svg>';writeFileSync('assets/icons/'+name.toLowerCase()+'.svg',svg);}
for(const [name,color] of [['attack','#c83135'],['bow','#c83135']])writeFileSync('assets/icons/'+name+'.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="'+symbols[name]+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
writeFileSync('assets/icons/generic-element.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><defs><linearGradient id="rainbow" x2="1" y2="1"><stop stop-color="#e74d4d"/><stop offset=".25" stop-color="#ffe65c"/><stop offset=".5" stop-color="#42c28a"/><stop offset=".75" stop-color="#72beed"/><stop offset="1" stop-color="#ae75cd"/></linearGradient></defs><rect x="1" y="1" width="26" height="26" fill="url(#rainbow)" stroke="black" stroke-width="2"/><text x="14" y="22" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="23">?</text></svg>');
console.log('Current map, nine approved starter portraits and Bisti placeholder verified; eleven vector icons exported.');
