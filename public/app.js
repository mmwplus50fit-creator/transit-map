(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const cfg = window.TRANSIT_CONFIG || {};
  const state = { network: { routes: {}, stops: {} }, data: null, mode: 'all', query: '', savedOnly: false, route: '', selected: '', following: false, busy: false, error: '', location: null };
  let saved = [];
  try { const value = JSON.parse(localStorage.getItem('transit-saved') || '[]'); if (Array.isArray(value)) saved = value.filter(x => typeof x === 'string'); } catch {}
  const map = L.map('map', { zoomControl: false, preferCanvas: true }).setView([43.685, -79.405], 12);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
  const markerLayer = L.layerGroup().addTo(map), lineLayer = L.layerGroup().addTo(map);
  const markers = new Map();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const routeFor = v => state.network.routes[v.route] || { number: v.route || '?', name: 'Route information unavailable', type: 'bus', shapes: [] };
  const now = () => Date.now() / 1000;
  const age = timestamp => timestamp ? Math.max(0, now() - timestamp) : Infinity;
  const ageText = timestamp => !timestamp ? 'Time not supplied' : age(timestamp) < 60 ? `${Math.floor(age(timestamp))} seconds ago` : age(timestamp) < 3600 ? `${Math.floor(age(timestamp)/60)} minutes ago` : new Date(timestamp*1000).toLocaleString('en-CA', { timeZone: 'America/Toronto', month:'short', day:'numeric',hour:'numeric',minute:'2-digit' }) + ' Toronto time';
  const snapshot = () => !!state.data?.snapshot;
  const available = () => (state.data?.vehicles || []).filter(v => snapshot() || (v.timestamp && age(v.timestamp) <= 900));
  function matches(v) {
    const r = routeFor(v);
    return (state.mode === 'all' || r.type === state.mode) && (!state.savedOnly || saved.includes(v.route)) &&
      (!state.query || `${r.number} ${r.name} ${v.id}`.toLowerCase().includes(state.query));
  }
  function shown() { return available().filter(v => matches(v) && (!state.route || v.route === state.route)); }
  function notice(text) { $('notice').textContent = text; $('notice').hidden = !text; }
  function renderStatus() {
    if (!state.data) return;
    const isOld = age(state.data.feedTimestamp) > (cfg.staleAfterSeconds || 180);
    $('status').textContent = snapshot() ? 'Recorded snapshot · not live' : state.error ? 'Connection interrupted' : isOld ? 'Feed is delayed' : 'Latest TTC positions';
    $('statusDot').classList.toggle('live', !snapshot() && !isOld && !state.error);
    $('updated').textContent = `TTC report: ${ageText(state.data.feedTimestamp)}`;
    notice(state.error || (snapshot() ? 'Preview: actual captured positions. These vehicles are not being tracked live.' : isOld ? 'The TTC feed is older than expected. Check official service information before travelling.' : ''));
  }
  function renderRoutes() {
    const counts = new Map();
    available().filter(matches).forEach(v => counts.set(v.route, (counts.get(v.route) || 0) + 1));
    const entries = [...counts].sort(([a],[b]) => (state.network.routes[a]?.number || a).localeCompare(state.network.routes[b]?.number || b, undefined, {numeric:true}));
    $('listTitle').textContent = `${entries.length} routes with ${snapshot() ? 'recorded' : 'recent'} positions`;
    $('routes').innerHTML = entries.length ? entries.map(([id,count]) => {
      const r = state.network.routes[id] || {number:id,name:'Route information unavailable',type:'bus'};
      return `<div class="route-row ${state.route === id ? 'active' : ''}"><button class="route-select" data-route="${esc(id)}" aria-pressed="${state.route === id}"><span class="route-badge ${r.type}">${esc(r.number)}</span><span class="route-copy"><strong>${esc(r.name)}</strong><small>${count} ${count === 1 ? 'vehicle' : 'vehicles'} · ${r.type === 'streetcar' ? 'Streetcar' : 'Bus'}</small></span></button><button class="star" data-star="${esc(id)}" aria-label="${saved.includes(id) ? 'Unsave' : 'Save'} route ${esc(r.number)}" aria-pressed="${saved.includes(id)}">${saved.includes(id) ? '★' : '☆'}</button></div>`;
    }).join('') : `<p class="empty">${state.savedOnly ? 'No saved routes match the available positions. Save a route with its star.' : 'No vehicles match. Try another route, vehicle number or filter.'}</p>`;
  }
  function markerIcon(v) {
    const r = routeFor(v), old = !v.timestamp || (!snapshot() && age(v.timestamp) > (cfg.staleAfterSeconds || 180));
    return L.divIcon({ className:'vehicle-marker', html:`<div class="vehicle-icon ${r.type} ${old ? 'older' : ''} ${state.selected === v.id ? 'selected' : ''}">${esc(r.number)}</div>`, iconSize:[28,28], iconAnchor:[14,14] });
  }
  function renderMarkers() {
    const vehicles = shown(), ids = new Set(vehicles.map(v => v.id));
    for (const [id, marker] of markers) if (!ids.has(id)) { markerLayer.removeLayer(marker); markers.delete(id); }
    for (const v of vehicles) {
      let marker = markers.get(v.id);
      if (!marker) { marker = L.marker([v.lat,v.lon], {icon:markerIcon(v), title:`Route ${routeFor(v).number}, vehicle ${v.id}`, keyboard:true}).addTo(markerLayer); marker.on('click', () => selectVehicle(v.id)); markers.set(v.id,marker); }
      else marker.setLatLng([v.lat,v.lon]).setIcon(markerIcon(v));
    }
    $('vehicleCount').textContent = vehicles.length.toLocaleString();
    $('routeCaption').textContent = state.route ? `${state.network.routes[state.route]?.name || 'Route ' + state.route}` : 'TTC surface network';
    if (state.selected) renderDetail();
  }
  function drawRoute() {
    lineLayer.clearLayers();
    const r = state.network.routes[state.route];
    if (r) r.shapes.forEach(points => L.polyline(points,{ color:r.type==='streetcar'?'#c45b38':'#24594b',weight:3,opacity:.38,interactive:false }).addTo(lineLayer));
  }
  function fitVehicles() { const v = shown(); if(v.length) map.fitBounds(v.map(x=>[x.lat,x.lon]),{padding:[65,80],maxZoom:15}); else map.setView([43.685,-79.405],12); }
  function renderDetail() {
    const v = available().find(v => v.id === state.selected);
    if (!v || !shown().some(x=>x.id===v.id)) { $('detail').hidden=true; state.selected=''; state.following=false; return; }
    const r = routeFor(v), stop = state.network.stops[v.stop];
    $('detail').hidden=false;
    $('detailType').textContent = `${r.type.toUpperCase()} / ROUTE ${r.number}`;
    $('detailTitle').textContent = `Vehicle ${v.id}`;
    $('detailRoute').textContent = r.name;
    $('detailFacts').innerHTML = `<dt>${snapshot() ? 'Recorded at' : 'Last reported'}</dt><dd>${esc(snapshot() && v.timestamp ? new Date(v.timestamp*1000).toLocaleTimeString('en-CA',{timeZone:'America/Toronto',hour:'numeric',minute:'2-digit'}) + ' Toronto time' : ageText(v.timestamp))}</dd><dt>Reported stop</dt><dd>${esc(stop?.name || (v.stop ? 'Stop ' + v.stop : 'Not supplied'))}</dd><dt>Arrival time</dt><dd>Not included in this edition</dd>`;
    $('follow').disabled=snapshot();
    $('follow').textContent=snapshot() ? 'Following available in live mode' : state.following ? 'Stop following' : 'Follow this vehicle';
    if(state.following) map.panTo([v.lat,v.lon],{animate:false});
  }
  function selectVehicle(id) { state.selected=id; state.following=false; renderMarkers(); }
  function render() { renderStatus(); renderRoutes(); renderMarkers(); }
  async function refresh() {
    if(state.busy) return;
    state.busy=true; $('refresh').disabled=true;
    try {
      const response = await fetch(cfg.apiUrl || 'data/snapshot.json', { cache:'no-cache', signal:AbortSignal.timeout(16000) });
      if(!response.ok) throw new Error('Could not retrieve positions');
      const data = await response.json();
      if(!Array.isArray(data.vehicles) || !Number.isFinite(data.feedTimestamp) || data.feedTimestamp<=0) throw new Error('Invalid feed');
      data.vehicles=data.vehicles.filter(v=>Number.isFinite(v.lat)&&Number.isFinite(v.lon)&&v.lat>=43&&v.lat<=45&&v.lon>=-81&&v.lon<=-78&&typeof v.id==='string');
      data.snapshot=!cfg.apiUrl || data.snapshot===true;
      state.data=data; state.error=''; render();
    } catch {
      state.error='Could not refresh TTC positions. Existing reports retain their original timestamps. Try again shortly.';
      if(state.data) render(); else { $('status').textContent='Positions unavailable'; $('updated').textContent='Use refresh to try again'; notice(state.error); $('routes').innerHTML='<p class="empty">Vehicle data could not be loaded.</p>'; }
    } finally { state.busy=false; $('refresh').disabled=false; }
  }
  $('routes').addEventListener('click', e => {
    const star=e.target.closest('[data-star]');
    if(star) { const id=star.dataset.star; saved=saved.includes(id)?saved.filter(x=>x!==id):[...saved,id]; try{localStorage.setItem('transit-saved',JSON.stringify(saved));}catch{notice('Favourites are available for this visit; this browser could not save them.');} renderRoutes(); if(state.savedOnly)renderMarkers(); return; }
    const button=e.target.closest('[data-route]'); if(!button)return;
    state.route=state.route===button.dataset.route?'':button.dataset.route; state.selected=''; state.following=false; $('detail').hidden=true; drawRoute();render();fitVehicles();
  });
  $('search').addEventListener('input',e=>{state.query=e.target.value.trim().toLowerCase();state.route='';drawRoute();render();});
  document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{state.mode=button.dataset.mode;state.route='';document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b===button));drawRoute();render();}));
  $('saved').addEventListener('click',()=>{state.savedOnly=!state.savedOnly;state.route='';$('saved').setAttribute('aria-pressed',state.savedOnly);drawRoute();render();});
  $('clear').addEventListener('click',()=>{state.mode='all';state.query='';state.route='';state.savedOnly=false;state.selected='';state.following=false;$('detail').hidden=true;$('search').value='';$('saved').setAttribute('aria-pressed',false);document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode==='all'));drawRoute();render();fitVehicles();});
  $('refresh').addEventListener('click',refresh);$('fit').addEventListener('click',fitVehicles);
  $('closeDetail').addEventListener('click',()=>{state.selected='';state.following=false;$('detail').hidden=true;renderMarkers();});
  $('follow').addEventListener('click',()=>{state.following=!state.following;renderDetail();});
  map.on('dragstart',()=>{state.following=false;if(state.selected)renderDetail();});
  $('locate').addEventListener('click',()=>{
    if(!navigator.geolocation){notice('Location is not available in this browser. You can still search by route.');return;}
    navigator.geolocation.getCurrentPosition(p=>{if(state.location)map.removeLayer(state.location);state.location=L.circleMarker([p.coords.latitude,p.coords.longitude],{radius:7,color:'#fff',weight:3,fillColor:'#316bac',fillOpacity:1}).addTo(map);map.setView([p.coords.latitude,p.coords.longitude],15);},()=>notice('Location permission was declined or unavailable. You can still search by route.'),{timeout:10000,maximumAge:60000});
  });
  $('aboutButton').addEventListener('click',()=>$('about').showModal());$('closeAbout').addEventListener('click',()=>$('about').close());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && cfg.apiUrl)refresh();});
  setInterval(()=>{if(!document.hidden&&cfg.apiUrl)refresh();}, Math.max(30000,cfg.refreshMs||30000));
  setInterval(()=>{if(state.data&&!document.hidden){renderStatus();if(!snapshot())renderMarkers();}},15000);
  async function start(){
    try{const r=await fetch('data/network.json');if(!r.ok)throw new Error();state.network=await r.json();}
    catch{notice('Route names are unavailable. Vehicle positions can still be viewed.');}
    await refresh();
  }
  start();
})();
