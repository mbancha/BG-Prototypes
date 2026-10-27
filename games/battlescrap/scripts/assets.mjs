import {existsSync,readdirSync} from 'node:fs';
if(!existsSync('public/scenario-1.png'))throw Error('Supplied map missing');
if(readdirSync('public/heroes-v7').filter(x=>x.endsWith('.png')).length!==10)throw Error('Expected ten v7 heroes');
console.log('Scenario and ten current hero masters present.');
