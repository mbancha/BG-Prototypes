import {CONFIG} from "../data/config";import {score,type Action,type GameState} from "../game/engine";
export const buildDump=(s:GameState,actions:Action[])=>({game:"Galax",config:CONFIG,seed:s.seed,turn:s.turn,winner:s.winner,players:s.players.map((p,i)=>({...p,score:score(s,i)})),telemetry:s.telem,log:s.log,actions});
export function downloadJson(data:unknown,name:string){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
