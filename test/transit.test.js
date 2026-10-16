import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { normalizeFeed } from '../lib/normalize.js';
import { GET } from '../api/vehicles.js';
import bindings from 'gtfs-realtime-bindings';
const read = p => readFile(new URL('../'+p,import.meta.url),'utf8');
test('normalizer rejects bad coordinates and does not invent missing vehicle timestamps',()=>{
  const result=normalizeFeed({header:{timestamp:100},entity:[{id:'a',vehicle:{position:{latitude:43.7,longitude:-79.4},trip:{routeId:'504'}}},{id:'bad',vehicle:{position:{latitude:0,longitude:0}}}]},100000);
  assert.equal(result.vehicles.length,1);assert.equal(result.vehicles[0].timestamp,null);assert.equal(result.vehicles[0].route,'504');
  assert.throws(()=>normalizeFeed({header:{}}));
});
test('relay decodes protobuf and returns an explicit failure instead of sample data',async()=>{
  const saved=global.fetch;
  try{
    const message=bindings.transit_realtime.FeedMessage.create({header:{gtfsRealtimeVersion:'2.0',timestamp:1000},entity:[{id:'a',vehicle:{position:{latitude:43.7,longitude:-79.4},timestamp:999,vehicle:{id:'123'}}}]});
    const bytes=bindings.transit_realtime.FeedMessage.encode(message).finish();
    global.fetch=async()=>new Response(bytes);let response=await GET();let result=await response.json();
    assert.equal(result.vehicles[0].id,'123');assert.equal(response.headers.get('Access-Control-Allow-Origin'),'*');
    global.fetch=async()=>new Response('down',{status:503});response=await GET();assert.equal(response.status,502);assert.equal((await response.json()).vehicles,undefined);
  }finally{global.fetch=saved;}
});
async function browser(apiUrl='', fail=false, liveAge=0){
  const html=await read('public/index.html'),network=JSON.parse(await read('public/data/network.json')),data=JSON.parse(await read('public/data/snapshot.json'));
  if(apiUrl){data.snapshot=false;data.feedTimestamp=Date.now()/1000-liveAge;data.vehicles=data.vehicles.slice(0,12).map(v=>({...v,timestamp:Date.now()/1000-liveAge}));}
  const dom=new JSDOM(html,{url:'https://example.org/transit-map/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;w.SVGSVGElement.prototype.createSVGRect=()=>({});w.TRANSIT_CONFIG={apiUrl,staleAfterSeconds:180};
  w.fetch=async url=>{if(String(url).includes('network'))return{ok:true,json:async()=>network};if(fail)throw new Error('offline');return{ok:true,json:async()=>data};};
  w.eval(await read('public/vendor/leaflet.js'));w.eval(await read('public/app.js'));
  await new Promise(r=>setTimeout(r,60));
  return {w,dom,data,network};
}
test('snapshot UI: route selection, streetcar filter, saved routes, search, empty state and reset',async()=>{
  const {w,dom,data}=await browser();const $=id=>w.document.getElementById(id);
  try{
    assert.match($('status').textContent,/snapshot/);assert.equal(Number($('vehicleCount').textContent.replaceAll(',','')),data.vehicles.length);
    w.document.querySelector('[data-route]').click();assert.equal(w.document.querySelector('[data-route][aria-pressed=true]')!==null,true);
    w.document.querySelector('[data-star]').click();assert.ok(JSON.parse(w.localStorage.getItem('transit-saved')).length);
    $('saved').click();assert.equal(w.document.querySelectorAll('[data-route]').length,1);
    $('clear').click();w.document.querySelector('[data-mode=streetcar]').click();assert.ok(w.document.querySelectorAll('[data-route]').length>0);
    for(const badge of w.document.querySelectorAll('.route-badge'))assert.ok(badge.classList.contains('streetcar'));
    $('search').value='this route cannot exist';$('search').dispatchEvent(new w.Event('input'));assert.equal($('vehicleCount').textContent,'0');assert.match($('routes').textContent,/No vehicles/);
    $('clear').click();assert.equal(Number($('vehicleCount').textContent.replaceAll(',','')),data.vehicles.length);
    w.document.querySelector('.leaflet-marker-icon').click();assert.equal($('detail').hidden,false);assert.equal($('follow').disabled,true);
  }finally{dom.window.close();}
});
test('live mode hides expired positions and reports stale feed; failures show no fake vehicles',async()=>{
  let b=await browser('https://relay.example/api/vehicles',false,1000);
  assert.equal(b.w.document.getElementById('vehicleCount').textContent,'0');assert.match(b.w.document.getElementById('status').textContent,/delayed/);b.dom.window.close();
  b=await browser('https://relay.example/api/vehicles',true);assert.match(b.w.document.getElementById('status').textContent,/unavailable/);assert.equal(b.w.document.querySelectorAll('.leaflet-marker-icon').length,0);b.dom.window.close();
});
