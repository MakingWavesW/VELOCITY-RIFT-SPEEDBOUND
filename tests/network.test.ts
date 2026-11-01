import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'colyseus.js';
import { move, validInput, type Player } from '../shared/game.js';
const wait = (ms:number) => new Promise(r=>setTimeout(r,ms));
test('reject malformed movement',()=>{assert.equal(validInput({seq:0,x:Infinity,z:0,jump:false}),false);assert.equal(validInput({seq:0,x:2,z:0,jump:false}),false);});
test('two real connections: movement, jump, shared pickup, spoof rejection, leave',async()=>{
 const a=await new Client('ws://localhost:2567').joinOrCreate('plaza',{name:'Test A'});
 const b=await new Client('ws://localhost:2567').joinOrCreate('plaza',{name:'Test B'});
 let state:any; a.onMessage('snapshot',()=>{});b.onMessage('snapshot',s=>state=s);a.onMessage('pickup',()=>{});b.onMessage('pickup',()=>{});
 try{assert.equal(a.roomId,b.roomId);await wait(120);assert.equal(Object.keys(state.players).length,2);
 let seq=0;for(let n=0;n<32;n++){a.send('input',{seq:seq++,x:0,z:1,jump:false});await wait(40);}await wait(80);
 const p=state.players[a.sessionId];assert.ok(p.z>10&&p.z<15);assert.ok(p.gems>=3);assert.ok(state.hidden.includes(0));assert.equal(state.players[b.sessionId].gems,0);
 a.send('input',{seq:seq++,x:0,z:0,jump:true});await wait(100);assert.ok(state.players[a.sessionId].y>0);
 const gems=state.players[a.sessionId].gems;a.send('input',{seq:seq++,x:999,z:0,jump:false,gems:999999});await wait(400);assert.equal(state.players[a.sessionId].gems,gems);assert.ok(Math.abs(state.players[a.sessionId].x)<1);
 await a.leave();await wait(120);assert.equal(Object.keys(state.players).length,1);
 }finally{if(a.connection.isOpen)await a.leave();await b.leave();}
});
