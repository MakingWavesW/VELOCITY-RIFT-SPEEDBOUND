import express from 'express';
import { createServer } from 'node:http';
import { Server, Room, Client } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { DT, move, orbs, reward, validInput, type Player, type Input } from '../shared/game.js';
export class Plaza extends Room {
 maxClients = 20;
 players: Record<string, Player> = {};
 inputs = new Map<string, Input>();
 lastInput = new Map<string, number>();
 cooldowns: Record<number, number> = {};
 emotes = new Map<string, number>();
 onCreate() {
  this.onMessage('input', (client, v) => {
   const p = this.players[client.sessionId];
   if (!p || !validInput(v) || v.seq <= (this.inputs.get(p.id)?.seq ?? p.seq) || v.seq > p.seq + 200) return;
   this.inputs.set(p.id, v); this.lastInput.set(p.id, Date.now());
  });
  this.onMessage('hello', client => { if (Date.now() - (this.emotes.get(client.sessionId) || 0) < 2000) return; this.emotes.set(client.sessionId, Date.now()); this.broadcast('emote', { id: client.sessionId, text: 'Hello!' }); });
  this.setSimulationInterval(() => this.tick(), DT * 1000);
 }
 onJoin(client: Client, options: { name?: string }) {
  const name = String(options.name || 'Runner').replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 18) || 'Runner';
  this.players[client.sessionId] = { id: client.sessionId, name, x: 0, y: 0, z: 0, vy: 0, angle: 0, seq: -1, steps: 0, xp: 0, gems: 0, level: 1, moving: false };
 }
 onLeave(client: Client) { this.emotes.delete(client.sessionId); delete this.players[client.sessionId]; this.inputs.delete(client.sessionId); this.lastInput.delete(client.sessionId); }
 tick() {
  const now = Date.now();
  for (const p of Object.values(this.players)) {
   const i = this.inputs.get(p.id);
   const active = i && now - (this.lastInput.get(p.id) || 0) < 250;
   const old = Math.floor(p.steps / 10);
   p.steps += move(p, active ? { ...i, jump: i.seq > p.seq && i.jump } : { seq: p.seq, x: 0, z: 0, jump: false });
   if (Math.floor(p.steps / 10) > old) reward(p, 2);
   for (const orb of orbs) if ((this.cooldowns[orb.id] || 0) <= now && Math.hypot(p.x - orb.x, p.z - orb.z, p.y) < 2.2) {
    this.cooldowns[orb.id] = now + 10000; reward(p, orb.gold ? 15 : 10); p.steps += 10; if (orb.gold) p.gems += 3;
    this.broadcast('pickup', { id: orb.id, player: p.id, gold: orb.gold });
   }
  }
  this.broadcast('snapshot', { players: this.players, hidden: Object.keys(this.cooldowns).filter(id => this.cooldowns[+id] > now).map(Number), time: now });
 }
}
const app = express();
app.get('/health', (_req, res) => res.json({ ok: true, version: '0.1.0' }));
const http = createServer(app);
const server = new Server({ transport: new WebSocketTransport({ server: http }) });
server.define('plaza', Plaza);
server.listen(Number(process.env.PORT || 2567), '0.0.0.0');
console.log('Velocity Rift multiplayer server starting on port', process.env.PORT || 2567);
