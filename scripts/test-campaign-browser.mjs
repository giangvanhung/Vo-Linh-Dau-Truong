// Requires a local Chromium DevTools listener on 9224. Uses a disposable browser context.
import assert from 'node:assert/strict';
const app='http://localhost:5173', debug='http://127.0.0.1:9224';
function connect(url) {
 return new Promise((resolve,reject)=>{
  const ws=new WebSocket(url);let counter=0;
  const calls=new Map(), events=new Map();
  ws.onerror=reject;
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const [r,j]=calls.get(m.id);calls.delete(m.id);m.error?j(m.error):r(m.result);}else events.get(m.method)?.(m.params);};
  ws.onopen=()=>resolve({ events, close:()=>ws.close(), send:(method,params={})=>new Promise((r,j)=>{calls.set(++counter,[r,j]);ws.send(JSON.stringify({id:counter, method,params}));})});
 });
}
const browser=await connect((await (await fetch(debug+'/json/version')).json()).webSocketDebuggerUrl);
const {browserContextId}=await browser.send('Target.createBrowserContext');
try {
 const {targetId}=await browser.send('Target.createTarget',{url:'about:blank',browserContextId});
 const target=(await (await fetch(debug+'/json/list')).json()).find(p=>p.id===targetId);
 const {send,events,close}=await connect(target.webSocketDebuggerUrl);
 let code=await(await fetch(app+'/src/game.bundle.js')).text();
 assert(code.includes('function startCampaign('));
 code=code.replace('setStage("rooftop", true);','window.qa={get f(){return hung},get d(){return mai},get phase(){return phase},get world(){return world},get equipment(){return equipment},get run(){return campaignRun},get train(){return training},get round(){return round},get score(){return [winsHung,winsMai]},get seconds(){return seconds},set seconds(s){seconds=s},config,selectMatch,openSetup,useAttack,resetFighters};setStage("rooftop", true);');
 code=code.replace('if (!["menu", "setup", "lan", "campaign"].includes(phase)) render','if (!window.fast && !["menu", "setup", "lan", "campaign"].includes(phase)) render');
 code=code.replace('const walkingSteps = [hung.x - movementStart[0], mai.x - movementStart[1]];','const walkingSteps = [hung.x - movementStart[0], mai.x - movementStart[1]];window.walkCheck=walkingSteps[0];');
 const exceptions=[];
 events.set('Runtime.exceptionThrown',p=>exceptions.push(p.exceptionDetails.text));
 events.set('Fetch.requestPaused',async p=>send('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'}],body:Buffer.from(code).toString('base64')}));
 await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`const queue=[];let t=performance.now();window.requestAnimationFrame=fn=>queue.push(fn);window.step=n=>{for(let i=0;i<n;i++){t+=1000/60+.001;for(const cb of queue.splice(0))cb(t);}};
 window.click=id=>document.getElementById(id).click();window.fire=(code,type='keydown')=>window.dispatchEvent(new KeyboardEvent(type,{code,key:code==='Escape'?'Escape':code.replace('Key','').toLowerCase(),bubbles:true,cancelable:true}));window.tap=code=>{fire(code);fire(code,'keyup')};window.change=(id,value)=>{const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('change'));};
 Math.random=(()=>{let seed=4625;return ()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);})();
 `});
 await send('Fetch.enable',{patterns:[{urlPattern:'*/src/game.bundle.js'}]});
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
 async function load(){
  await send('Page.navigate',{url:app});
  for(let i=0;i<80&&!await ev('!!window.qa');i++)await new Promise(r=>setTimeout(r,125));
  assert(await ev('!!window.qa'));
 }
 await load();
 assert.deepEqual(await ev("click('campaign-button');[qa.phase,document.querySelectorAll('.campaign-stage').length,document.querySelectorAll('.campaign-stage:disabled').length,qa.equipment.gold]"),['campaign',6,5,100]);
 const result=await ev(`(()=>{
  window.fast=true;
  const ready=()=>{step(182);if(qa.phase!=='fight')throw Error(qa.phase);};
  const settle=win=>{(win?qa.d:qa.f).hp=0;step(93);};
  click('campaign-start');ready();settle(false);
  if(qa.phase!=='over'||qa.equipment.gold!==100||qa.equipment.campaign.results.roof.losses!==1)throw Error('loss');
  click('campaign-replay');ready();
  const f=qa.f,d=qa.d;
  let held='';
  let seenDamage=false;
  for(let i=0;i<2900&&qa.phase==='fight';i++){
   const gap=d.x-f.x;
   const dir=gap>0?'KeyD':'KeyA';
   const move=Math.abs(gap)>55&&!f.disabled?dir:'';
   if(held!==move){if(held)fire(held,'keyup');if(move)fire(move);held=move;}
   if(!f.attack&&!f.disabled&&Math.abs(gap)<85)tap(i%3?'KeyK':'KeyJ');
   step(1);seenDamage ||= d.hp<d.maxHp;
  }
  if(held)fire(held,'keyup');
  step(94);
  const naturalWin=qa.equipment.campaign.results.roof.wins===1;
  if(!naturalWin){
   click('campaign-replay');ready();settle(true);
  }
  if(qa.equipment.gold!==165||!qa.equipment.inventory['dawn-armor-0'])throw Error('reward');
  const firstHp=f.maxHp;
  click('campaign-result-equipment');
  if(document.getElementById('equipment-panel').hidden)throw Error('equipment route');
  document.querySelector('[data-gear-focus="slot-armor"]').click();
  document.querySelector('[data-gear-focus="item-dawn-armor-0"]').click();
  click('equipment-equip');click('equipment-upgrade');
  if(qa.equipment.inventory['dawn-armor-0']!==2||qa.equipment.loadouts.hung.armor!=='dawn-armor-0')throw Error('upgrade + equip');
  click('equipment-back');
  const summary=document.querySelector('#campaign-stats').textContent;
  document.querySelector('[data-stage="market"]').click();click('campaign-start');ready();
  if(!(qa.f.maxHp>firstHp)||qa.run.index!==1)throw Error('effective gear');
  const wornHp=qa.f.maxHp;
  settle(true);
  for(let index=2;index<6;index++){
   click('campaign-next');click('campaign-start');ready();
   if(qa.run.index!==index)throw Error('next '+index);
   settle(true);
   if(qa.phase==='countdown'){ready();settle(true);}
   if(qa.phase!=='over')throw Error('result '+index+' '+qa.phase);
  }
  const title=document.getElementById('result-title').textContent;
  click('campaign-list');document.querySelector('[data-stage="roof"]').click();click('campaign-start');ready();
  const wallet=qa.equipment.gold;settle(true);
  if(qa.equipment.gold-wallet!==15||qa.equipment.campaign.results.roof.wins!==2)throw Error('replay rewards');
  return {naturalWin,seenDamage,firstHp,wornHp,summary,title,progress:qa.equipment.campaign};
 })()`);
 console.log(JSON.stringify(result));
 await load();
 assert.deepEqual(await ev("click('campaign-button');[document.querySelectorAll('.campaign-stage:disabled').length,qa.equipment.campaign.serial,qa.equipment.inventory['dawn-armor-0']]"),[0,8,2]);
 console.log('Reload preserved all six cleared stages and upgraded gear');
 // P2 default keyboard, same-fighter labels, KO, timeout, tie and match transitions.
 const direct=await ev(`(()=>{
  window.fast=true;document.querySelector('#campaign-panel [data-menu]').click();
  click('local-button');click('start-button');step(183);
  qa.f.x=420;qa.d.x=485;qa.f.facing=1;qa.d.facing=-1;
  tap('Numpad2');step(15);
  if(qa.f.hp===qa.f.maxHp)throw Error('Numpad2 did not land');
  qa.f.hp=0;step(1);
  const p2=document.getElementById('status-text').textContent;
  step(265);
  if(qa.phase!=='fight')throw Error(qa.phase);
  qa.f.hp=qa.f.maxHp;qa.d.hp=qa.d.maxHp;qa.seconds=.001;step(1);
  const tie=document.getElementById('status-text').textContent;
  step(265);qa.f.hp=3;qa.d.hp=qa.d.maxHp;qa.seconds=.001;step(94);
  const end=document.getElementById('result-title').textContent;
  return {p2,tie,end,score:qa.score};
 })()`);
 console.log(JSON.stringify(direct));
 assert.match(direct.p2,/^P2/);assert.deepEqual(direct.score,[0,2]);
 assert.equal(exceptions.length,0,exceptions.join(','));
 await send('Fetch.disable');close();
} finally {
 await browser.send('Target.disposeBrowserContext',{browserContextId});
 browser.close();
}
