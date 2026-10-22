import {chromium} from 'playwright';
import {preview} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('artifacts',{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:4185,strictPort:true}});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report={errors:[],journeys:[],screenshots:[]};
try{for(const [name,viewport] of Object.entries({desktop:{width:1440,height:1000},tablet:{width:820,height:1180}})){
 const page=await browser.newPage({viewport});page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
 await page.goto('http://127.0.0.1:4185');await page.getByRole('heading',{name:'Three Fires'}).waitFor();
 await page.screenshot({path:`artifacts/${name}-setup.png`,fullPage:true});report.screenshots.push(`${name}-setup.png`);
 await page.getByLabel('Players',{exact:true}).selectOption('hotseat');await page.getByRole('button',{name:'Begin scenario'}).click();await page.getByRole('button',{name:'I’m ready'}).click();
 await page.getByRole('button',{name:'Commit secret bid'}).click();assert.equal(await page.locator('.privacy').count(),1);assert.equal(await page.locator('.battle-card').count(),0);await page.getByRole('button',{name:'I’m ready'}).click();await page.getByLabel('Starting zone',{exact:true}).selectOption('blue');await page.getByRole('button',{name:'Commit secret bid'}).click();
 for(let p=0;p<2;p++){if(await page.locator('.privacy').count())await page.getByRole('button',{name:'I’m ready'}).click();for(const hero of (p===0?['Marda Oakweaver','Tavi Sailwhistle','Voru Cinderveil']:['Niala Grassveil','Eirik Hearthkeeper','Ketu Ashheart']))await page.locator('.hero-grid button').filter({hasText:hero}).click();await page.getByRole('button',{name:'Lock army & purchases'}).click();}

 for(let p=0;p<2;p++){if(await page.locator('.privacy').count())await page.getByRole('button',{name:'I’m ready'}).click();for(let i=0;i<6;i++)await page.locator('g[aria-label$="legal target"]').first().click();}
 if(await page.locator('.privacy').count())await page.getByRole('button',{name:'I’m ready'}).click();
 await page.locator('.queue-card:not(:disabled)').filter({has:page.locator('.portrait')}).last().click();
 const activeHex=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('battlescrap-save-v1'));return s.units.find(u=>u.id===s.active).hex;});
 await page.locator('.inspector button').filter({hasText:'1 AP'}).first().click();
 const targets=page.locator('g[aria-label$="legal target"]');assert.ok(await targets.count()>0,'Move targets highlighted');await targets.first().click();
 await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('button',{name:'End activation',exact:true}).waitFor();
 await page.locator('.battle-card').first().click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.screenshot({path:`artifacts/${name}-battle.png`,fullPage:true});report.screenshots.push(`${name}-battle.png`);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal page overflow');
 await page.getByRole('button',{name:'End activation',exact:true}).click();assert.equal(await page.locator('.privacy').count(),1);assert.equal(await page.locator('.battle-card').count(),0);
 report.journeys.push({name,status:'passed',steps:['setup','secret bids','army purchases','random queue deal','deployment','activation','piece selection','movement','undo','card dialog/cancel','end activation','privacy handoff']});await page.close();
 }
 const resume=await browser.newPage({viewport:{width:1440,height:1000}});resume.on('pageerror',e=>report.errors.push(String(e)));await resume.goto('http://127.0.0.1:4185');await resume.getByRole('button',{name:'Begin scenario'}).click();await resume.locator('input[type=file]').setInputFiles('artifacts/combat-save.json');await resume.getByRole('button',{name:'I’m ready'}).click();await resume.getByRole('button',{name:'Pass response',exact:true}).click();if(await resume.locator('.privacy').count())await resume.getByRole('button',{name:'I’m ready'}).click();await resume.getByRole('button',{name:'Pass response',exact:true}).click();await resume.getByRole('button',{name:'Standard attack · roll full pool',exact:true}).click();await resume.getByRole('button',{name:'Finish rerolls & resolve',exact:true}).waitFor();await resume.screenshot({path:'artifacts/desktop-combat.png',fullPage:true});report.screenshots.push('desktop-combat.png');await resume.getByRole('button',{name:'Finish rerolls & resolve',exact:true}).click();await resume.locator('input[type=file]').setInputFiles('artifacts/pickup-save.json');await resume.getByRole('button',{name:'I’m ready'}).click();await resume.getByRole('button',{name:'Draw objective + Battle card',exact:true}).click();assert.equal(await resume.locator('[role=alert]').count(),0);report.journeys.push({name:'saved pending combat and Brightstone reward',status:'passed'});await resume.close();
 const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(String(e)));await page.goto('http://127.0.0.1:4185');await page.getByLabel('Players',{exact:true}).selectOption('bots');await page.getByLabel('Victory target',{exact:true}).fill('1');await page.getByRole('button',{name:'Begin scenario'}).click();await page.getByLabel('Bot speed',{exact:true}).selectOption('50');await page.waitForFunction(()=>['results','complete'].includes(JSON.parse(localStorage.getItem('battlescrap-save-v1')).phase),{},{timeout:90000});report.journeys.push({name:'automatic bots',status:'passed'});await page.close();assert.deepEqual(report.errors,[]);
}finally{await writeFile('artifacts/browser-report.json',JSON.stringify(report,null,2));await browser.close();await server.httpServer.close();}
console.log(JSON.stringify(report,null,2));

