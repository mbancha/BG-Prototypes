import {botDecide} from "../game/bot";import {applyAction,newGame,score} from "../game/engine";
export function simulate(games=100){const wins=[0,0,0,0],science:number[]=[];for(let seed=1;seed<=games;seed++){const s=newGame([{name:"A",color:"#f66",isBot:true},{name:"B",color:"#6af",isBot:true}],{seed});let guard=0;while(!s.over&&guard++<500){const e=applyAction(s,botDecide(s));if(e)throw Error(e)}if(s.winner!==undefined)wins[s.winner]++;science.push(...s.players.map(p=>p.scienceLevel))}return {games,wins,averageScience:science.reduce((a,b)=>a+b,0)/science.length}}
export {score};
