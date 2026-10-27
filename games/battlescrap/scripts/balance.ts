import {writeFileSync} from 'node:fs';
import {defaultSim,simulateGame,summarize} from '../src/simulation';
const results=[];for(let i=0;i<108;i++)results.push(simulateGame(defaultSim,i));writeFileSync('artifacts/balance-report.json',JSON.stringify({options:defaultSim,results,summary:summarize(results)},null,2));console.log(results.filter(r=>r.complete).length+' / '+results.length+' completed');
