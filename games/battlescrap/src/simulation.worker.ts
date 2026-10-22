import {simulateGame,summarize,SimOptions} from './simulation';
self.onmessage=(e:MessageEvent<SimOptions>)=>{const results=[];try{for(let i=0;i<e.data.games;i++){results.push(simulateGame(e.data,i));if(i%5===0)self.postMessage({progress:i+1});}self.postMessage({done:true,results,summary:summarize(results)});}catch(error){self.postMessage({error:String(error)});}};
