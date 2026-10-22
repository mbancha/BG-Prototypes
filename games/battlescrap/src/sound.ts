let context:AudioContext|undefined;
export function sound(kind='select'){
 try{context??=new AudioContext();void context.resume();const osc=context.createOscillator(),gain=context.createGain(),now=context.currentTime;
 osc.type='sine';osc.frequency.setValueAtTime(kind==='roll'?180:kind==='action'?430:650,now);osc.frequency.exponentialRampToValueAtTime(kind==='roll'?90:500,now+.065);gain.gain.setValueAtTime(.025,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.09);osc.connect(gain);gain.connect(context.destination);osc.start(now);osc.stop(now+.1);
 }catch{/* Audio is optional in browsers without an available output. */}
}
