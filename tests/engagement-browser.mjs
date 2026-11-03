import {chromium} from '@playwright/test';
import {enterMenu} from './menu-helper.mjs';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const phase=process.argv[2]||'after';
await fs.mkdir('artifacts/engagement',{recursive:true});
try {
 const context=await browser.newContext({viewport:{width:960,height:640}});
 await context.addInitScript(()=>localStorage.setItem('rift-visual-settings',JSON.stringify({quality:'low'})));
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://localhost:5173');await enterMenu(p);
 await p.locator('#name').fill('First minute');await p.locator('#join').click();await p.waitForFunction(()=>window.riftDiagnostics?.predicted);
 const samples=[];
 for(const key of ['w','d','s','a']) {await p.keyboard.down(key);await p.waitForTimeout(15000);await p.keyboard.up(key);samples.push(await p.evaluate(()=>({player:window.riftDiagnostics.players[window.riftDiagnostics.localId],frameMs:window.riftDiagnostics.frameMs,drawCalls:window.riftDiagnostics.drawCalls,orbCount:window.riftDiagnostics.orbs.length})));}
 await p.screenshot({path:`artifacts/engagement/${phase}.png`});
 await fs.writeFile(`artifacts/engagement/${phase}.json`,JSON.stringify({samples,errors,automation:'60-second keyboard circuit, software rendering; not human enjoyment or real-device FPS evidence'},null,2));
 console.log(JSON.stringify({phase,errors,first:samples[0],last:samples.at(-1)}));
} finally {await browser.close();}
