import {writeFileSync} from 'node:fs';
import {heroes,cards,regions,objectives,tacticCopies,VERSION} from '../src/content';
const coreValues=[2.5,2,3,2.5,1.5,1.5,1.5,2,2.5,1.5];
const costs=heroes.map((h,i)=>{const mods=[8,({3:-1,4:0,5:1,6:2.5} as any)[h.move],({2:0,3:1.5,4:3.5,5:6,6:9} as any)[h.attack],({1:-1.5,2:0,3:1.5,4:3.5,5:6} as any)[h.defense],h.range===2?1:h.range===3?1.5:0,coreValues[i]];const estimate=mods.reduce((a,b)=>a+b,0);if(Math.ceil(estimate)*2!==h.cost)throw Error('Cost mismatch '+h.id);return {id:h.id,mods,estimate,price:h.cost/2};});
const fixtures=[heroes.slice(0,5),heroes.slice(5)].map(group=>{const triples=[];for(let a=0;a<3;a++)for(let b=a+1;b<4;b++)for(let c=b+1;c<5;c++){const team=[group[a],group[b],group[c]];triples.push({heroes:team.map(h=>h.id),price:team.reduce((n,h)=>n+h.cost/2,0)});}return {affordable:triples.filter(t=>t.price<=40).length,min:Math.min(...triples.map(t=>t.price)),max:Math.max(...triples.map(t=>t.price)),triples};});
writeFileSync('artifacts/redesign-content.json',JSON.stringify({version:VERSION,heroes,cards,regions,objectives,costs,fixtures},null,2));
console.log(JSON.stringify({fixtures:fixtures.map(({triples,...f})=>f),costs}));
