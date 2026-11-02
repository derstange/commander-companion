/* Commander Companion VIII.2 — optional link to the local tournament server (server/serve.py). */
'use strict';
// Without that server (GitHub Pages, offline, opened as a file) ./api/status does not answer and nothing here runs:
// the app keeps the tournament in this browser exactly as before. With the server, the tournament is shared by all
// devices on the network (phones start tables and pick winners, the laptop shows the fullscreen board). The life
// counter always stays on the device.
// rev: last server revision this device knows; seen: newest revision the server announced; base: that revision's tournament as JSON (for merging conflicts).
var sync={on:false,rev:0,seen:0,base:'null',dirty:false,busy:false,hold:false,joined:false,connected:false,url:'',qr:false,source:null};
function syncJSON(t){return JSON.stringify(t===undefined?null:t)}
function syncApi(path,opts){
 return fetch('./api/'+path,Object.assign({cache:'no-store'},opts||{})).then(function(r){
  if(r.status!==200&&r.status!==409)throw new Error('HTTP '+r.status);
  return r.json().then(function(body){body.status=r.status;return body});
 });
}
// Three-way merge: keeps the changes of both devices when they touched different parts (e.g. winners at two tables).
// If both changed the same value, the server copy wins.
function syncMerge(b,l,r){
 var sl=syncJSON(l),sb=syncJSON(b),sr=syncJSON(r);if(sl===sb)return r;if(sr===sb||sr===sl)return l;
 var obj=function(x){return x!==null&&typeof x==='object'};
 if(!obj(b)||!obj(l)||!obj(r)||Array.isArray(b)!==Array.isArray(l)||Array.isArray(l)!==Array.isArray(r))return r;
 if(Array.isArray(b)){if(b.length!==l.length||l.length!==r.length)return r;return r.map(function(_,i){return syncMerge(b[i],l[i],r[i])})}
 var out={},keys={};Object.keys(l).concat(Object.keys(r)).forEach(function(k){keys[k]=true});
 Object.keys(keys).forEach(function(k){
  var inL=k in l,inR=k in r,inB=k in b;
  if(inL&&inR){out[k]=syncMerge(inB?b[k]:undefined,l[k],r[k]);return}
  if(inL){if(!inB||syncJSON(l[k])!==syncJSON(b[k]))out[k]=l[k];return} // removed on the server unless changed here
  if(!inB||syncJSON(r[k])!==syncJSON(b[k]))out[k]=r[k];
 });
 return out;
}
// Puts a tournament from the server (or a merge) into this device: storage, then the views.
function syncShow(t){
 if(syncJSON(t)===syncJSON(tournament))return;
 if(t!==null&&!validTournament(t))return;
 var keep=editingRound;
 tournament=t===null?null:normalizeCommanders(t);
 try{if(tournament)localStorage.setItem(TOUR_STORAGE,JSON.stringify(tournament));else localStorage.removeItem(TOUR_STORAGE)}catch(e){}
 editingRound=tournament&&keep!==null&&keep<tournament.schedule.length?keep:null;
 renderTournament();
}
// Called by saveTournament() and the tournament reset.
function syncPushTournament(){if(!sync.on||sync.hold)return;sync.dirty=true;if(!sync.busy)syncFlush()}
function syncFlush(){
 sync.busy=true;sync.dirty=false;var sent=syncJSON(tournament);
 syncApi('tournament',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{"baseRev":'+sync.rev+',"tournament":'+sent+'}'}).then(function(res){
  if(res.status===200){sync.rev=res.rev;sync.base=sent;return}
  // Another device saved first: merge both changes and try again with the newer revision.
  var merged=syncMerge(JSON.parse(sync.base),JSON.parse(syncJSON(tournament)),res.tournament);
  if(merged!==null&&!validTournament(merged))merged=res.tournament;
  sync.rev=res.rev;sync.base=syncJSON(res.tournament);syncShow(merged);
  if(syncJSON(tournament)!==sync.base)sync.dirty=true;
 }).catch(function(){sync.dirty=true;syncStatus(false)}).then(function(){
  // Changes announced while this save was on its way are fetched now; otherwise they would be missed.
  sync.busy=false;if(sync.dirty&&sync.connected)syncFlush();else if(sync.seen>sync.rev)syncPull();
 });
}
function syncPull(){
 if(sync.busy)return;
 if(sync.dirty){syncFlush();return}
 syncApi('tournament').then(function(res){
  if(sync.busy)return; // a save started meanwhile; it pulls again when done
  if(sync.dirty){syncFlush();return}
  var first=!sync.joined;sync.joined=true;sync.rev=res.rev;sync.base=syncJSON(res.tournament);syncStatus(true);
  if(first&&res.tournament===null&&tournament){syncOfferUpload();return}
  if(sync.hold){sync.hold=res.tournament===null;if(!sync.hold&&el('syncUpload'))closeModal();if(sync.hold)return}
  syncShow(res.tournament);
 }).catch(function(){syncStatus(false)});
}
// The server has no tournament yet, but this device has one: ask before sharing it with everyone.
function syncOfferUpload(){
 sync.hold=true;
 el('modalTitle').textContent='Turnier mit allen teilen?';
 el('modalContent').innerHTML='<p class="muted">Auf dem Turnier-Server läuft noch kein Turnier. Dieses Gerät hat eines gespeichert (<strong>'+esc(tournament.players.length)+' Spieler</strong>).</p><p class="muted tiny">„Leer starten“ entfernt es von diesem Gerät. Sichere es vorher über „Turnier sichern“, falls du es noch brauchst.</p><div class="modal-actions"><button class="btn" type="button" id="syncUseServer">Leer starten</button><button class="btn primary" type="button" id="syncUpload">Turnier teilen</button></div>';
 activeModal=null;el('modalBackdrop').classList.remove('hidden');
}
function syncStatus(connected){
 sync.connected=connected;var badge=el('syncBadge');if(!badge)return;
 badge.hidden=!sync.on;badge.classList.toggle('off',!connected);
 badge.textContent=connected?'● Live über '+sync.url.replace(/^https?:\/\//,'').replace(/\/$/,''):'○ Turnier-Server nicht erreichbar';
}
function syncJoinBox(){
 var box=el('fsJoin');if(!box)return;box.hidden=false;
 el('fsJoinUrl').textContent=sync.url.replace(/^https?:\/\//,'').replace(/\/$/,'');
 var img=el('fsJoinQr');if(sync.qr){img.src='./api/qr.svg';img.hidden=false}else img.hidden=true;
}
function syncConnect(){
 if(sync.source)sync.source.close();
 if(!('EventSource' in window)){setInterval(syncPull,3000);syncPull();return}
 sync.source=new EventSource('./api/events');
 sync.source.onmessage=function(e){var rev=Number(e.data);sync.seen=Math.max(sync.seen,rev);if(!sync.connected||rev!==sync.rev||sync.dirty)syncPull()};
 sync.source.onerror=function(){syncStatus(false)};
}
function syncStart(){
 // GitHub Pages never runs the server: do not even ask (avoids a 404 in the console).
 if(location.protocol!=='http:'&&location.protocol!=='https:'||/\.github\.io$/.test(location.hostname))return;
 var ctrl=window.AbortController?new AbortController():null,timer=setTimeout(function(){if(ctrl)ctrl.abort()},2500);
 fetch('./api/status',{cache:'no-store',signal:ctrl?ctrl.signal:undefined}).then(function(r){return r.ok?r.json():null}).then(function(s){
  clearTimeout(timer);if(!s||s.server!==true)return;
  sync.on=true;sync.url=String(s.url||location.origin+'/');sync.qr=!!s.qr;
  syncStatus(false);syncJoinBox();syncConnect();
  document.addEventListener('visibilitychange',function(){if(!document.hidden)syncPull()});
 }).catch(function(){clearTimeout(timer)});
}
el('modalContent').addEventListener('click',function(e){
 var b=e.target.closest('button');if(!b)return;
 if(b.id==='syncUpload'){closeModal();sync.hold=false;syncPushTournament()}
 else if(b.id==='syncUseServer'){closeModal();sync.hold=false;syncShow(null)}
});
syncStart();
