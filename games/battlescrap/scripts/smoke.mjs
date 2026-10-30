import {chromium} from 'playwright';
import {preview} from 'vite';
import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('artifacts',{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:4185,strictPort:true}});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={version:'holder-elements-v13',errors:[],journeys:[],screenshots:[]};
async function handoff(page){const b=page.getByRole('button',{name:'I’m ready',exact:true});if(await b.count())await b.click();}
async function importScene(page,path){const scene=JSON.parse(readFileSync(path,'utf8'));await page.locator('input[type=file]').setInputFiles(path);await page.waitForFunction(n=>JSON.parse(localStorage.getItem('battlescrap-save-v13')).history.length===n,scene.history.length);}
try{
for(const [name,viewport] of Object.entries({desktop:{width:1440,height:1000},tablet:{width:820,height:1180}})){
 const page=await browser.newPage({viewport});page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
 await page.goto('http://127.0.0.1:4185');await page.getByRole('heading',{name:'Three Fires',exact:true}).waitFor();
 await page.screenshot({path:'artifacts/'+name+'-setup-current.png',fullPage:true});
 await page.getByLabel('Players',{exact:true}).selectOption('hotseat');await page.getByRole('button',{name:'Begin scenario',exact:true}).click();await handoff(page);
 await page.getByRole('button',{name:'Commit secret bid',exact:true}).click();assert.equal(await page.locator('.privacy').count(),1);assert.equal(await page.locator('.battle-card').count(),0);await handoff(page);await page.getByLabel('Starting zone',{exact:true}).selectOption('blue');await page.getByRole('button',{name:'Commit secret bid',exact:true}).click();await handoff(page);
 for(const roster of [['Bisti Grasshade','Hester Wellward','Voru Cinderveil'],['Niala Grassveil','Perrin Lastdrop','Ilex Marchstep']]){for(const hero of roster)await page.locator('.hero-grid button').filter({hasText:hero}).click();await page.getByRole('button',{name:'Lock army & purchases',exact:true}).click();await handoff(page);}
 for(let i=0;i<12;i++){await handoff(page);await page.locator('g[aria-label$="legal target"]').first().click();}
 await handoff(page);assert.equal(await page.locator('.queue-card').count(),6);assert.equal(await page.locator('.tableau').count(),6);
 await page.locator('.queue-card:not(:disabled)').last().click();
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('battlescrap-save-v13')));
 let moved=false;for(const u of before.units.filter(u=>u.owner===before.side&&u.hex&&(u.id===before.active||!u.hero))){await page.locator('g[aria-label^="'+u.hex+' "]').click();const targets=await page.locator('g[aria-label$="legal target"]').all();for(const target of targets){const hex=(await target.getAttribute('aria-label')).split(' ')[0];const delta=(a,b)=>{const [q1,y1]=a.split(',').map(Number),[q2,y2]=b.split(',').map(Number),r1=y1-(q1-(q1&1))/2,r2=y2-(q2-(q2&1))/2;return (Math.abs(q1-q2)+Math.abs(r1-r2)+Math.abs(q1+r1-q2-r2))/2;};if(delta(u.hex,hex)===1&&!before.traps.includes(hex)&&!['3,3','10,3','7,5'].includes(hex)){await target.click();moved=true;break;}}if(moved)break;}assert.ok(moved,'At least one friendly unit can move');

 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('battlescrap-save-v13')));assert.equal(after.ap+after.rap,before.ap+before.rap-1);await page.getByRole('button',{name:'Undo',exact:true}).click();await handoff(page);const undone=await page.evaluate(()=>JSON.parse(localStorage.getItem('battlescrap-save-v13')));assert.equal(undone.ap+undone.rap,before.ap+before.rap);
 await page.locator('.battle-card').first().click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Close card',exact:true}).click();
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'artifacts/'+name+'-battle-current.png',fullPage:true});report.screenshots.push(name+'-battle-current.png');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
 const red=await page.locator('.icon-bow').first().evaluate(e=>getComputedStyle(e).color);assert.equal(red,'rgb(200, 49, 53)');
 await page.getByRole('button',{name:'End activation',exact:true}).click();assert.equal(await page.locator('.privacy').count(),1);assert.equal(await page.locator('.battle-card').count(),0);
 report.journeys.push({name,status:'passed',steps:['bidding','privacy','muster','deployment','six-slot queue','tableaus','activation','movement','undo','card view','red ranged icon','end turn','no overflow']});
 await importScene(page,'artifacts/current-combat-save.json');await handoff(page);await page.getByRole('button',{name:'Pass combat response',exact:true}).click();await handoff(page);await page.getByRole('button',{name:'Pass combat response',exact:true}).click();await handoff(page);await page.getByRole('button',{name:'Finish rerolls & resolve',exact:true}).waitFor();await page.screenshot({path:'artifacts/'+name+'-combat-current.png',fullPage:true});await page.getByRole('button',{name:'Finish rerolls & resolve',exact:true}).click();assert.equal(await page.locator('[role=alert]').count(),0);
 await importScene(page,'artifacts/current-ability-response-save.json');await handoff(page);await page.getByRole('button',{name:'Pass Cancel response',exact:true}).click();await handoff(page);await page.getByRole('button',{name:'Pass Cancel response',exact:true}).click();assert.equal(await page.locator('[role=alert]').count(),0);
 await importScene(page,'artifacts/current-objective-save.json');await handoff(page);await page.getByRole('button',{name:/^Claim .*1 VP/}).first().click();assert.equal(await page.locator('[role=alert]').count(),0);
 await importScene(page,'artifacts/current-results-save.json');await handoff(page);await page.getByRole('button',{name:/^Upgrade .*2 RP/}).first().click();await page.getByRole('button',{name:'Continue',exact:true}).click();await handoff(page);await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Begin next scenario',exact:true}).click();await handoff(page);assert.equal(await page.locator('[role=alert]').count(),0);
 report.journeys.push({name:name+' saved decisions',status:'passed',steps:['combat import/resume','ability Cancel window','objective claim','RP tactic upgrade','settlement','next scenario modifier']});await page.close();
}
const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(String(e)));await page.goto('http://127.0.0.1:4185');await page.getByLabel('Players',{exact:true}).selectOption('bots');await page.getByLabel('Battle size',{exact:true}).selectOption('4');await page.getByLabel('Victory target',{exact:true}).fill('1');await page.getByRole('button',{name:'Begin scenario',exact:true}).click();await page.getByLabel('Bot speed',{exact:true}).selectOption('20');await page.waitForFunction(()=>['results','complete'].includes(JSON.parse(localStorage.getItem('battlescrap-save-v13')).phase),{},{timeout:60000});assert.equal(await page.locator('.queue-card').count(),8);report.journeys.push({name:'automatic 4v4 bots',status:'passed'});await page.close();assert.deepEqual(report.errors,[]);
}finally{await writeFile('artifacts/browser-report-current.json',JSON.stringify(report,null,2));await browser.close();await server.httpServer.close();}
console.log(JSON.stringify(report,null,2));
