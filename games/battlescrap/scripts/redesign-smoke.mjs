import {chromium} from 'playwright';
import {preview} from 'vite';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=await preview({preview:{host:'127.0.0.1',port:4186,strictPort:true}});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report={errors:[],journeys:[],screenshots:[]};
try{const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});await page.goto('http://127.0.0.1:4186');await page.getByRole('button',{name:'Begin scenario'}).click();
const ready=async()=>{await page.getByRole('button',{name:'I’m ready'}).click();};
for(const [name,title,hexes,color] of [['timber','Raise the Timber',['7,5'],'#b8dd87'],['flame','Wall of Flame',['7,5','7,6'],'#ff8b3d']]){await page.locator('input[type=file]').setInputFiles('artifacts/'+name+'-save.json');await ready();await page.locator('.battle-card').filter({hasText:title}).click();await page.getByRole('button',{name:'Play printed effect',exact:true}).click();for(const hex of hexes)await page.getByRole('button',{name:'Choose edge hex '+hex,exact:true}).click();assert.equal(await page.locator(`svg line[stroke="${color}"]`).count(),1);await page.screenshot({path:'artifacts/desktop-'+name+'.png',fullPage:true});report.screenshots.push('desktop-'+name+'.png');report.journeys.push(name+' placement through visible controls');}
await page.locator('input[type=file]').setInputFiles('artifacts/counter-save.json');await ready();await page.getByRole('button',{name:'Finish rerolls & resolve',exact:true}).click();await ready();await page.getByRole('button',{name:'Counterattack · free',exact:true}).waitFor();await page.screenshot({path:'artifacts/desktop-counter.png',fullPage:true});report.screenshots.push('desktop-counter.png');await page.getByRole('button',{name:'Counterattack · free',exact:true}).click();await ready();assert.match(await page.locator('.combat h3').innerText(),/Niala Grassveil → Kalawi Bloodmane/);report.journeys.push('counterattack ownership handoff and return combat');assert.deepEqual(report.errors,[]);await page.close();}finally{await writeFile('artifacts/redesign-browser-report.json',JSON.stringify(report,null,2));await browser.close();await server.httpServer.close();}
console.log(JSON.stringify(report,null,2));

