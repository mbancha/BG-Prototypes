import {chromium} from 'playwright';
import {preview} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=await preview({preview:{host:'127.0.0.1',port:4185,strictPort:true}});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
await mkdir('artifacts',{recursive:true});
try{for(const [w,h] of [[1366,768],[1920,1080],[1024,768]]){
 const page=await browser.newPage({viewport:{width:w,height:h}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:4185');await page.getByRole('button',{name:'Begin scenario',exact:true}).click();await page.getByRole('button',{name:'Commit secret bid',exact:true}).click();
 for(const name of ['Bisti Grasshade','Hester Wellward','Voru Cinderveil'])await page.locator('.hero-grid button').filter({hasText:name}).click();
 await page.getByRole('button',{name:'Lock army & purchases',exact:true}).click();
 await page.getByLabel('Bot speed',{exact:true}).selectOption('20');
 await page.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem('battlescrap-save-v15'));return s?.phase==='deploy'&&s.side===0;});
 for(let i=0;i<6;i++)await page.locator('g[aria-label$="legal target"]').first().click();
 await page.screenshot({path:`artifacts/v15-${w}-precheck.png`,fullPage:true});console.log(await page.locator('.prompt').innerText());console.log(await page.evaluate(()=>JSON.parse(localStorage.getItem('battlescrap-save-v15'))?.phase));
 await page.getByLabel('Bot speed',{exact:true}).selectOption('20');
 try{await page.locator('.hand .battle-card').first().waitFor();}catch(e){console.log(errors);console.log(await page.evaluate(()=>JSON.parse(localStorage.getItem('battlescrap-save-v15'))));throw e;}
 await page.screenshot({path:`artifacts/v15-${w}-battle.png`,fullPage:true});
 await page.locator('.hand .battle-card').first().hover();await page.keyboard.down('Alt');await page.locator('.alt-card').waitFor();await page.screenshot({path:`artifacts/v15-${w}-alt.png`});await page.keyboard.up('Alt');assert.equal(await page.locator('.alt-card').count(),0);
 assert.equal(await page.locator('.tableaus').count(),0);assert.equal(await page.locator('.hand .battle-card').count(),4);assert.deepEqual(errors,[]);
 const scene=await page.evaluate(()=>JSON.parse(localStorage.getItem('battlescrap-save-v15')));scene.config.controllers=['human','bot'];scene.side=0;while(scene.players[0].hand.length<8)scene.players[0].hand.push(scene.deck.pop());const hero=scene.units.find(u=>u.owner===0&&u.hero);hero.wounds=1;hero.focus=2;hero.poison=1;hero.tokens.ongoing=true;
 await page.locator('input[type=file]').setInputFiles({name:'full-hand.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scene))});await page.locator('.hand .battle-card').nth(7).waitFor();
 await page.screenshot({path:`artifacts/v15-${w}-full-hand.png`,fullPage:true});await page.locator(`g[aria-label^="${hero.hex} "]`).hover();await page.keyboard.down('Alt');await page.locator('.alt-card').waitFor();assert.match(await page.locator('.alt-card').innerText(),/Damage: 1/);await page.screenshot({path:`artifacts/v15-${w}-hero.png`});await page.keyboard.up('Alt');
 const geometry=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));assert.ok(geometry.scrollWidth<=w&&geometry.scrollHeight<=h,'Battle fits viewport');console.log(JSON.stringify({width:w,errors,geometry}));await page.close();
}}finally{await browser.close();await server.httpServer.close();}
