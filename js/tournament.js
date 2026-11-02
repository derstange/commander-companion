/* Commander Companion VIII.2 — tournament: storage, commanders (Scryfall), round reveal, rounds/finals, CSV and JSON backups. */
'use strict';

var TOUR_STORAGE='commander-companion-tournament-v2',LEGACY_TOUR_STORAGE='commander-companion-tournament-v1';
var tournament=null,editingRound=null,planningTournament=false,PLAN_BUDGET_MS=1500;
function saveTournament(){try{localStorage.setItem(TOUR_STORAGE,JSON.stringify(tournament))}catch(e){}if(typeof syncPushTournament==='function')syncPushTournament()}
function validTournament(t){
 if(!t||t.version!==2||!Array.isArray(t.players)||t.players.length<2||t.players.length>32||!Number.isInteger(t.rounds)||t.rounds<1||t.rounds>50||!Array.isArray(t.schedule)||t.schedule.length<t.rounds||t.schedule.length>t.rounds+MAX_FINALS)return false;
 var n=t.players.length;
 for(var i=0;i<n;i++)if(typeof t.players[i]!=='string')return false;
 for(var r=0;r<t.schedule.length;r++){
  var round=t.schedule[r],fin=r>=t.rounds,seen=new Set();if(!round||!Array.isArray(round.tables)||round.tables.length<1||!(round.bye===null||(Number.isInteger(round.bye)&&round.bye>=0&&round.bye<n)))return false;
  if(fin&&(round.final!==true||round.bye!==null))return false;
  if(round.bye!==null)seen.add(round.bye);
  var size=round.tables[0].players.length;
  for(var j=0;j<round.tables.length;j++){
   var m=round.tables[j];if(!m||!Array.isArray(m.players)||(!fin&&m.players.length!==size)||m.players.length<2||m.players.length>n)return false;
   for(var k=0;k<m.players.length;k++){var idx=m.players[k];if(!Number.isInteger(idx)||idx<0||idx>=n||seen.has(idx))return false;seen.add(idx)}
   if(m.winner!==null&&!m.players.includes(m.winner))return false;
  }
  if(!fin&&seen.size!==n)return false;
 }
 return true;
}
function loadTournament(){
 try{var raw=localStorage.getItem(TOUR_STORAGE);if(raw){var t=JSON.parse(raw);if(validTournament(t)){tournament=normalizeCommanders(t);return}}}catch(e){}
 // Older, single-winner tournaments with at most four players can be migrated faithfully.
 try{var old=JSON.parse(localStorage.getItem(LEGACY_TOUR_STORAGE)||'null');if(!old||!Array.isArray(old.players)||old.players.length<2||old.players.length>4||!Number.isInteger(old.rounds)||old.rounds<1||old.rounds>50||!Array.isArray(old.results)||old.results.length!==old.rounds)return;
 var schedule=planTournament(old.players.length,old.rounds);
 for(var i=0;i<old.rounds;i++){var w=old.results[i];if(Number.isInteger(w)&&w>=0&&w<old.players.length)schedule[i].tables[0].winner=w}
 var converted={version:2,players:old.players,rounds:old.rounds,schedule:schedule};if(validTournament(converted)){tournament=converted;saveTournament()}
 }catch(e){}
}
var setupCommanders=[],cmdResults={},cmdTimers={},cmdAbort={};
var SCRYFALL_IMG=/^https:\/\/cards\.scryfall\.io\//;
function cmdFromCard(c){var img=c.image_uris||(c.card_faces&&c.card_faces[0]&&c.card_faces[0].image_uris)||{};return {name:String(c.name||'').slice(0,150),image:img.normal||img.large||'',art:img.art_crop||img.normal||'',artist:String(c.artist||'').slice(0,100),uri:String(c.scryfall_uri||'')}}
function validCommander(c){return !!c&&typeof c.name==='string'&&c.name.length>0&&typeof c.image==='string'&&typeof c.art==='string'&&(!c.image||SCRYFALL_IMG.test(c.image))&&(!c.art||SCRYFALL_IMG.test(c.art))}
// A commander may carry a second commander in c.partner (Partner, Friends forever, Background, Doctor's companion). Invalid or nested partners are dropped.
function cleanCommander(c){if(!validCommander(c))return null;var out={name:c.name,image:c.image,art:c.art,artist:typeof c.artist==='string'?c.artist:'',uri:typeof c.uri==='string'?c.uri:''};if(c.partner&&validCommander(c.partner))out.partner={name:c.partner.name,image:c.partner.image,art:c.partner.art,artist:typeof c.partner.artist==='string'?c.partner.artist:'',uri:typeof c.partner.uri==='string'?c.partner.uri:''};return out}
function normalizeCommanders(t){var list=Array.isArray(t.commanders)&&t.commanders.length===t.players.length?t.commanders:[];t.commanders=t.players.map(function(_,i){return cleanCommander(list[i])});return t}
function cmdCards(c){return c?(c.partner?[c,c.partner]:[c]):[]}
function cmdName(c){return cmdCards(c).map(function(x){return x.name}).join(' + ')}
function cmdArtImgs(c,cls){return cmdCards(c).filter(function(x){return x.art}).map(function(x){return '<img'+(cls?' class="'+cls+'"':'')+' src="'+esc(x.art)+'" alt="" loading="lazy">'}).join('')}
function commanderOf(idx){return tournament&&tournament.commanders&&tournament.commanders[idx]||null}
function cmdThumb(idx){var c=commanderOf(idx);return c?cmdArtImgs(c,'wc-art'):''}
function cmdTag(idx){var c=commanderOf(idx);return c?'<span class="cmd-tag">'+cmdArtImgs(c)+esc(cmdName(c))+'</span>':''}
// Slot keys: "setup:3" / "tour:3" is the commander of player 3, a trailing ":p" addresses the partner.
function mainSlot(key){var k=key.split(':');return k[0]+':'+k[1]}
function isPartnerSlot(key){return key.split(':')[2]==='p'}
function getSlot(key){var k=key.split(':'),i=Number(k[1]),c=k[0]==='setup'?setupCommanders[i]||null:commanderOf(i);return isPartnerSlot(key)?(c&&c.partner)||null:c}
function setSlot(key,value){
 var k=key.split(':'),i=Number(k[1]),old=getSlot(mainSlot(key)),next;
 if(isPartnerSlot(key)){if(!old)return;next=cleanCommander(old);if(value)next.partner=cleanCommander(value);else delete next.partner}
 else{next=value?cleanCommander(value):null;if(next&&old&&old.partner)next.partner=old.partner}
 if(k[0]==='setup'){setupCommanders[i]=next;return}if(!tournament)return;tournament.commanders[i]=next;saveTournament();renderTournament();
}
var partnerOpen={};
function slotHTML(key,label){
 var c=getSlot(key),partner=isPartnerSlot(key),open='<div class="cmd-picker'+(partner?' partner':'')+'" data-slot="'+key+'" data-label="'+esc(label)+'">';
 if(c)return open+'<div class="cmd-picked">'+(c.art?'<img src="'+esc(c.art)+'" alt="">':'')+'<span>'+esc(c.name)+(c.artist?'<small>🎨 '+esc(c.artist)+'</small>':'')+'</span><button type="button" class="cmd-clear" aria-label="'+(partner?'Partner':'Commander')+' von '+esc(label)+' entfernen">×</button></div></div>';
 return open+'<input type="search" class="cmd-input" maxlength="60" autocomplete="off" enterkeyhint="search" placeholder="'+(partner?'🔍 Partner / Background suchen …':'🔍 Commander suchen …')+'" aria-label="'+(partner?'Partner':'Commander')+' für '+esc(label)+'"><div class="cmd-results" role="listbox"></div></div>';
}
function cmdPickerHTML(key,label){
 var c=getSlot(key),html='<div class="cmd-pair" data-pair="'+key+'" data-label="'+esc(label)+'">'+slotHTML(key,label);
 if(c&&(c.partner||partnerOpen[key]))html+=slotHTML(key+':p',label);
 else if(c)html+='<button type="button" class="cmd-add-partner" data-add-partner="'+key+'">+ Partner-Commander</button>';
 return html+'</div>';
}
function refreshPicker(picker,focus){
 var pair=picker.closest('.cmd-pair'),key=pair.getAttribute('data-pair'),focusSlot=picker.getAttribute&&picker.getAttribute('data-slot'),tmp=document.createElement('div');
 tmp.innerHTML=cmdPickerHTML(key,pair.getAttribute('data-label'));var fresh=tmp.firstChild;pair.replaceWith(fresh);
 if(focus){var target=fresh.querySelector('.cmd-picker[data-slot="'+(focusSlot||key)+'"] .cmd-input')||fresh.querySelector('.cmd-input');if(target)target.focus()}
}
function searchCommanders(input){
 var picker=input.closest('.cmd-picker'),key=picker.getAttribute('data-slot'),box=picker.querySelector('.cmd-results'),term=input.value.trim();
 clearTimeout(cmdTimers[key]);if(cmdAbort[key])cmdAbort[key].abort();cmdResults[key]=[];
 if(term.length<2){box.innerHTML='';return}
 box.innerHTML='<p class="cmd-msg">Suche …</p>';
 cmdTimers[key]=setTimeout(function(){
  var ctrl=window.AbortController?new AbortController():null;cmdAbort[key]=ctrl;
  fetch('https://api.scryfall.com/cards/search?order=edhrec&unique=cards&q='+encodeURIComponent(term+' is:commander'+(isPartnerSlot(key)?' (o:partner or o:"friends forever" or o:"doctor\'s companion" or o:"choose a background" or t:background or t:"time lord")':'')),{headers:{Accept:'application/json'},signal:ctrl?ctrl.signal:undefined})
  .then(function(r){if(r.status===404)return {data:[]};if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
  .then(function(d){
   var list=(d.data||[]).map(cmdFromCard).filter(validCommander).slice(0,8);cmdResults[key]=list;
   box.innerHTML=list.length?list.map(function(c,i){return '<button type="button" class="cmd-option" role="option" data-pick="'+i+'">'+(c.art?'<img src="'+esc(c.art)+'" alt="" loading="lazy">':'')+'<span>'+esc(c.name)+'</span></button>'}).join(''):'<p class="cmd-msg">Kein Commander gefunden.</p>';
  })
  .catch(function(e){if(e&&e.name==='AbortError')return;box.innerHTML='<p class="cmd-msg">Suche nicht möglich. Bist du offline?</p>'});
 },300);
}
function pickCommander(picker,i){var key=picker.getAttribute('data-slot'),c=(cmdResults[key]||[])[i];if(!c)return;setSlot(key,c);refreshPicker(picker)}
function onCommanderClick(e){
 var add=e.target.closest('.cmd-add-partner');if(add){var key=add.getAttribute('data-add-partner');partnerOpen[key]=true;var pair=add.closest('.cmd-pair'),tmp=document.createElement('div');tmp.innerHTML=cmdPickerHTML(key,pair.getAttribute('data-label'));var fresh=tmp.firstChild;pair.replaceWith(fresh);var input=fresh.querySelector('.cmd-picker.partner .cmd-input');if(input)input.focus();return}
 var option=e.target.closest('.cmd-option');if(option){pickCommander(option.closest('.cmd-picker'),Number(option.getAttribute('data-pick')));return}
 var clear=e.target.closest('.cmd-clear');if(clear){var picker=clear.closest('.cmd-picker'),slot=picker.getAttribute('data-slot');if(isPartnerSlot(slot))partnerOpen[mainSlot(slot)]=false;else partnerOpen[slot]=false;setSlot(slot,null);refreshPicker(picker,true)}
}
function openCommanderEditor(){
 if(!tournament)return;el('modalTitle').textContent='🃏 Commander der Teilnehmer';
 el('modalContent').innerHTML='<p class="muted tiny">Suche über Scryfall. Änderungen werden sofort gespeichert.</p>'+tournament.players.map(function(name,i){return '<div class="cmd-edit-row"><strong>'+esc(name)+'</strong>'+cmdPickerHTML('tour:'+i,name)+'</div>'}).join('')+'<p class="notice-inline">Kartendaten und Bilder: Scryfall. Bilder brauchen eine Internetverbindung.</p><div class="modal-actions"><button class="btn primary" type="button" id="modalDone">Fertig</button></div>';
 activeModal=null;el('modalBackdrop').classList.remove('hidden');
}
// Round reveal: tables of a new round stay covered until someone presses the button; then the players appear one by one with their commander art.
var REVEAL_KEY='commander-companion-reveal',revealEnabled=true,revealTimer=null;
try{revealEnabled=localStorage.getItem(REVEAL_KEY)!=='false'}catch(e){}
function isVeiled(r){var round=tournament&&tournament.schedule[r];return revealEnabled&&!!round&&!round.revealed&&!round.tables.some(function(t){return t.winner!==null})}
function stopReveal(){clearTimeout(revealTimer);revealTimer=null}
function toggleReveal(){revealEnabled=!revealEnabled;try{localStorage.setItem(REVEAL_KEY,String(revealEnabled))}catch(e){}renderTournament()}
function stageHTML(idx,label,sub){var c=commanderOf(idx),arts=cmdCards(c).filter(function(x){return x.art}),bg=arts.length===2?' style="background-image:url(\''+esc(arts[0].art)+'\'),url(\''+esc(arts[1].art)+'\');background-size:50% 100%,50% 100%;background-position:left center,right center"':arts.length?' style="background-image:url(\''+esc(arts[0].art)+'\')"':'';return '<div class="stage-card'+(arts.length?'':' no-art')+'"'+bg+'><div class="stage-text"><div class="stage-label">'+esc(label)+'</div><div class="stage-name">'+esc(tournament.players[idx])+'</div>'+(c||sub?'<div class="stage-cmd">'+esc(c?cmdName(c):sub)+'</div>':'')+'</div><div class="stage-shine"></div></div>'}
function revealRound(){
 var r=editingRound,round=tournament&&tournament.schedule[r];if(!round||!isVeiled(r))return;
 var grid=el('winnerChoices'),stage=el('revealStage'),quick=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches,steps=[];
 var buttons=grid.querySelectorAll('.winner-choice'),n=0;
 round.tables.forEach(function(m,t){m.players.forEach(function(idx,k){steps.push({idx:idx,node:buttons[n++],label:'Tisch '+(t+1)+(k===0?'':' · Spieler '+(k+1))})})});
 if(round.bye!==null)steps.push({idx:round.bye,node:grid.querySelector('.bye-card'),label:'Pause',sub:'setzt diese Runde aus'});
 round.revealed=true;saveTournament();el('roundHint').textContent='Wähle an jedem Tisch den Sieger. Tippe nochmals auf den Sieger, um die Markierung zu entfernen.';
 var i=0;
 function next(){
  if(i>=steps.length){revealTimer=setTimeout(function(){stage.classList.add('hidden');stage.innerHTML='';grid.classList.remove('veiled');renderTournament()},quick?0:1400);return}
  var step=steps[i++];
  stage.innerHTML=stageHTML(step.idx,step.label,step.sub)+'<button type="button" class="btn reveal-skip" id="revealSkip">Alles zeigen ⏭</button>';
  if(step.node)step.node.classList.add('shown');
  revealTimer=setTimeout(next,quick?250:1500);
 }
 next();
}
function setTab(which){activeTab=which==='tournament'?'tournament':'life';closeModal();closeGameMenu();el('lifePanel').classList.toggle('hidden',activeTab!=='life');el('tournamentPanel').classList.toggle('hidden',activeTab!=='tournament');el('tabLife').setAttribute('aria-selected',String(activeTab==='life'));el('tabTournament').setAttribute('aria-selected',String(activeTab==='tournament'));document.body.classList.toggle('table-mode',activeTab==='life'&&!!state&&state.mode==='table');document.body.classList.toggle('match-focus',activeTab==='life'&&!!state);if(activeTab==='tournament'){renderTournament()}else if(state)render();else revealSetup();window.scrollTo(0,0)}
function syncPairingPreview(){
 var n=Number(el('tournamentCount').value),r=Number(el('tournamentRounds').value),box=el('pairingPreview');if(!Number.isInteger(n)||n<2||n>32){box.textContent='Gib eine Spieleranzahl zwischen 2 und 32 ein.';return}
 var l=getLayout(n);
 box.innerHTML='<strong>⚔ Tischaufteilung:</strong> '+l.tables+' '+(l.tables===1?'Partie':'Partien')+' mit je '+l.size+' '+(l.size===1?'Person':'Personen')+' pro Runde'+(l.bye?' · 1 Person pausiert in jeder Runde':' · keine Pausen')+'.'+(l.bye&&Number.isInteger(r)&&r>0?' Die Pausen werden über '+r+' Runden so gleichmäßig wie möglich verteilt.':'')+(l.size===2||l.size===5?' <span class="muted">Hinweis: Gleich große 3er-/4er-Tische sind bei dieser Spielerzahl rechnerisch nicht möglich.</span>':'');
}
function syncNameFields(){var n=Number(el('tournamentCount').value);syncPairingPreview();if(!Number.isInteger(n)||n<2||n>32)return;var container=el('tournamentNames');var old=container.querySelectorAll('input[id^="tourPlayer"]'),previous=[];for(var i=0;i<old.length;i++)previous.push(old[i].value);var html='';for(var j=0;j<n;j++)html+='<div><label for="tourPlayer'+j+'">Spieler '+(j+1)+'</label><input type="text" id="tourPlayer'+j+'" maxlength="35" autocomplete="off" placeholder="Spieler '+(j+1)+'" value="'+esc(previous[j]||'')+'">'+cmdPickerHTML('setup:'+j,'Spieler '+(j+1))+'</div>';container.innerHTML=html}
function createTournament(e){
 if(e)e.preventDefault();if(planningTournament)return;var n=Number(el('tournamentCount').value),r=Number(el('tournamentRounds').value);
 if(!Number.isInteger(n)||n<2||n>32||!Number.isInteger(r)||r<1||r>50){el('tournamentForm').reportValidity();return}
 var inputs=el('tournamentNames').querySelectorAll('input[id^="tourPlayer"]');if(inputs.length!==n){syncNameFields();inputs=el('tournamentNames').querySelectorAll('input[id^="tourPlayer"]')}
 var names=[];for(var i=0;i<n;i++)names.push((inputs[i].value.trim().slice(0,35)||('Spieler '+(i+1))));
 planningTournament=true;el('tournamentSubmit').disabled=true;el('planningNote').classList.remove('hidden');
 var commanders=names.map(function(_,i){return setupCommanders[i]||null});
 // Short delay so the note is painted before the first plan blocks the main thread.
 setTimeout(function(){planBestTournament(n,r,function(schedule){
  planningTournament=false;el('tournamentSubmit').disabled=false;el('planningNote').classList.add('hidden');
  tournament={version:2,players:names,rounds:r,schedule:schedule,commanders:commanders};editingRound=0;saveTournament();renderTournament();window.scrollTo(0,0);
 })},50);
}
function counts(){
 var rows=tournament.players.map(function(_,i){return {idx:i,wins:0,played:0,byes:0,rounds:[]}});
 tournament.schedule.forEach(function(round,ri){if(round.bye!==null)rows[round.bye].byes++;
  round.tables.forEach(function(match){if(match.winner!==null){match.players.forEach(function(i){rows[i].played++});if(!round.final)rows[match.winner].wins++;rows[match.winner].rounds.push(shortRoundLabel(ri))}});
 });return rows;
}
// Tie-break finals: once every regular round is recorded, players who share a place within the top three play
// an extra final round (appended to the schedule with final:true, one or more tables per tied group, at most 4 per table).
// A final win only breaks the tie inside that group; further finals follow until places 1–3 are unique.
var MAX_FINALS=20;
function regularRoundsDone(){for(var r=0;r<tournament.rounds;r++)if(tournament.schedule[r].tables.some(function(t){return t.winner===null}))return false;return true}
function visibleRounds(){return regularRoundsDone()?tournament.schedule.length:tournament.rounds}
function roundLabel(i){return i<tournament.rounds?'Runde '+(i+1):'Finale '+(i-tournament.rounds+1)}
function shortRoundLabel(i){return i<tournament.rounds?'R'+(i+1):'F'+(i-tournament.rounds+1)}
function sameRank(a,b){return a.wins===b.wins&&a.key.join()===b.key.join()}
// Ranking by regular wins, then by the final rounds before index upto (2 = won, 1 = lost, 0 = not involved).
function rankRows(upto){
 var rows=counts();
 rows.forEach(function(row){row.key=[];for(var r=tournament.rounds;r<upto;r++){var v=0;tournament.schedule[r].tables.forEach(function(m){if(m.winner!==null&&m.players.indexOf(row.idx)>=0)v=m.winner===row.idx?2:1});row.key.push(v)}});
 rows.sort(function(a,b){if(b.wins!==a.wins)return b.wins-a.wins;for(var k=0;k<a.key.length;k++)if(a.key[k]!==b.key[k])return b.key[k]-a.key[k];return a.idx-b.idx});
 rows.forEach(function(row,i){row.place=i>0&&sameRank(rows[i-1],row)?rows[i-1].place:i+1});
 return rows;
}
function podiumTies(rows){
 var groups=[];
 for(var i=0;i<rows.length;){var j=i;while(j+1<rows.length&&sameRank(rows[i],rows[j+1]))j++;if(j>i&&rows[i].place<=3)groups.push({place:rows[i].place,players:rows.slice(i,j+1).map(function(r){return r.idx})});i=j+1}
 return groups;
}
function makeFinal(groups){
 var tables=[];
 groups.forEach(function(g){var members=shuffleCopy(g.players),count=Math.ceil(members.length/4),split=[];for(var t=0;t<count;t++)split.push([]);members.forEach(function(idx,k){split[k%count].push(idx)});split.forEach(function(m){tables.push({players:m,winner:null,place:g.place})})});
 return {final:true,bye:null,tables:tables};
}
function finalMatches(round,groups){
 var key=function(list){return list.slice().sort(function(a,b){return a-b}).join()};
 var want=groups.map(function(g){return key(g.players)}).sort().join('|'),have={};
 round.tables.forEach(function(t){var g=groups.filter(function(g){return t.players.every(function(i){return g.players.indexOf(i)>=0})})[0];if(g){have[g.place]=(have[g.place]||[]).concat(t.players)}});
 return Object.keys(have).map(function(k){return key(have[k])}).sort().join('|')===want&&round.tables.every(function(t){return groups.some(function(g){return t.players.every(function(i){return g.players.indexOf(i)>=0})})});
}
// Brings the final rounds in line with the current results; returns true if the schedule changed.
function syncFinals(){
 if(!tournament||!regularRoundsDone())return false;
 var changed=false;
 for(var k=tournament.rounds;k<tournament.rounds+MAX_FINALS;k++){
  var groups=podiumTies(rankRows(k)),existing=tournament.schedule[k];
  if(!groups.length){if(tournament.schedule.length>k){tournament.schedule.length=k;changed=true}break}
  if(existing&&finalMatches(existing,groups)){if(existing.tables.some(function(t){return t.winner===null})){if(tournament.schedule.length>k+1){tournament.schedule.length=k+1;changed=true}break}continue}
  tournament.schedule.length=k;tournament.schedule.push(makeFinal(groups));changed=true;break;
 }
 if(changed)saveTournament();
 return changed;
}
function nextOpenRound(){if(!tournament)return null;for(var i=0;i<visibleRounds();i++)if(tournament.schedule[i].tables.some(function(t){return t.winner===null}))return i;return null}
function showRound(i){if(!tournament||!Number.isInteger(i)||i<0||i>=visibleRounds())return;editingRound=i;renderRoundEditor();el('roundEditorCard').scrollIntoView({block:'start',behavior:'smooth'})}
function renderRoundEditor(){
 if(!tournament)return;var total=visibleRounds(),r=editingRound;if(!Number.isInteger(r)||r<0||r>=total)r=nextOpenRound();if(r===null)r=total-1;editingRound=r;
 el('roundEditorCard').classList.remove('hidden');var round=tournament.schedule[r],done=round.tables.filter(function(t){return t.winner!==null}).length;
 el('roundEyebrow').textContent=done===round.tables.length?'✧ Runde abgeschlossen':'✧ Die Begegnungen';
 el('roundHeading').textContent=round.final?'🏆 '+roundLabel(r):'Runde '+(r+1)+' von '+tournament.rounds;
 el('roundHint').textContent=round.final?'Gleichstand in der Tabelle: Wer hier gewinnt, steht vor den anderen Spielern am Tisch. Die Siege aus den regulären Runden bleiben erhalten.':'Wähle an jedem Tisch den Sieger. Tippe nochmals auf den Sieger, um die Markierung zu entfernen.';
 el('roundPageStatus').textContent=round.final?roundLabel(r):(r+1)+' / '+tournament.rounds;el('roundPrev').disabled=r===0;el('roundNext').disabled=r===total-1;
 el('roundBack').classList.toggle('hidden',nextOpenRound()===null||r===nextOpenRound());
 var html=round.tables.map(function(match,i){var won=match.winner!==null;
  return '<section class="match-card '+(won?'done':'')+'"><div class="match-head"><span class="match-title">⚔ Tisch '+(i+1)+(round.final&&match.place?' · um Platz '+match.place:'')+'</span><span class="match-status">'+(won?'✓ Ergebnis erfasst':'Noch offen')+'</span></div><div class="match-contenders">'+match.players.map(function(idx){var picked=match.winner===idx;return '<button type="button" class="winner-choice '+(picked?'selected':'')+'" data-table="'+i+'" data-winner="'+idx+'" aria-pressed="'+picked+'"><span>'+cmdThumb(idx)+esc(tournament.players[idx])+'</span><span class="marker">'+(picked?'✓':'')+'</span></button>'}).join('')+'</div><button type="button" class="btn match-play" data-play-table="'+i+'">❤ Im Lebenszähler spielen</button><div class="match-foot">'+(won?'🏆 Sieger: '+esc(tournament.players[match.winner]):'Berühre den Gewinner dieser Partie.')+'</div></section>';
 }).join('');
 if(round.bye!==null)html+='<div class="bye-card">⏳ <span><strong>Pause:</strong> '+esc(tournament.players[round.bye])+' — in dieser Runde keine Partie.</span></div>';
 el('winnerChoices').innerHTML=html;
 stopReveal();var veiled=isVeiled(r);el('winnerChoices').classList.toggle('veiled',veiled);el('revealStage').classList.toggle('hidden',!veiled);
 if(veiled){el('revealStage').innerHTML='<button type="button" class="btn primary reveal-go" id="revealGo">✨ Tische enthüllen</button>';el('roundHint').textContent='Die Tische dieser Runde sind noch verdeckt.'}
 el('roundStatus').textContent=done+' von '+round.tables.length+' '+(round.tables.length===1?'Partie':'Partien')+' abgeschlossen. Änderungen werden sofort gespeichert.';
}
function renderTournament(){
 syncTourChoice();var started=!!tournament;el('tournamentSetup').classList.toggle('hidden',started);el('tournamentActive').classList.toggle('hidden',!started);if(!started){syncPairingPreview();return}
 syncFinals();var total=visibleRounds(),finals=total-tournament.rounds;
 var matches=0,done=0,rDone=0;for(var r=0;r<total;r++){var completed=true;for(var j=0;j<tournament.schedule[r].tables.length;j++){matches++;if(tournament.schedule[r].tables[j].winner!==null)done++;else completed=false}if(completed&&r<tournament.rounds)rDone++}
 var l=getLayout(tournament.players.length),finished=done===matches;
 el('tourSubtitle').textContent=tournament.players.length+' Teilnehmer · '+tournament.rounds+' Runden · '+l.tables+' '+(l.tables===1?'Tisch':'Tische')+' pro Runde';
 el('tourMetrics').innerHTML='<span class="tour-metric"><strong>'+rDone+' / '+tournament.rounds+'</strong> Runden</span><span class="tour-metric"><strong>'+done+' / '+matches+'</strong> Partien erfasst</span>'+(l.bye?'<span class="tour-metric"><strong>1</strong> Pause / Runde</span>':'')+(finals?'<span class="tour-metric"><strong>🏆 '+finals+'</strong> '+(finals===1?'Finalrunde':'Finalrunden')+'</span>':'')+(finished?'<span class="tour-metric"><strong>✓</strong> Turnier abgeschlossen</span>':'');
 el('tourReveal').textContent='✨ Enthüllung: '+(revealEnabled?'AN':'AUS');el('tourReveal').setAttribute('aria-pressed',String(revealEnabled));
 el('tourProgress').style.width=(done/matches*100)+'%';renderRoundEditor();
 var ranking=rankRows(total);
 el('rankingBody').innerHTML=ranking.map(function(row){var place=row.place;return '<tr class="'+(place===1&&row.wins>0?'leader':'')+'"><td>'+place+'.</td><td><button type="button" class="rank-player" data-player="'+row.idx+'"><span>'+esc(tournament.players[row.idx])+'</span>'+cmdTag(row.idx)+'</button></td><td>'+row.wins+'</td><td>'+row.played+'</td><td>'+row.byes+'</td><td>'+(row.rounds.length?row.rounds.join(' · '):'—')+'</td></tr>'}).join('');
 el('roundsList').innerHTML=tournament.schedule.slice(0,total).map(function(round,i){var wins=round.tables.filter(function(t){return t.winner!==null}).length;
  var all=wins===round.tables.length,state=all?'done':wins===0?'pending':'partial',veiled=isVeiled(i);
  var tables=round.tables.map(function(t,j){var open=t.winner===null;
   var people=t.players.map(function(idx){var cls=open?'':idx===t.winner?'winner':'beaten';return '<span class="mini-player '+cls+'">'+(idx===t.winner?'🏆 ':'')+esc(tournament.players[idx])+'</span>'}).join('');
   return '<div class="mini-table '+(open?'open':'done')+'"><div class="mini-head"><span>⚔ Tisch '+(j+1)+(round.final&&t.place?' · um Platz '+t.place:'')+'</span><span class="mini-status">'+(open?'○ offen':'✓ entschieden')+'</span></div><div class="mini-players">'+people+'</div></div>'}).join('');
  return '<div class="round-item '+state+'"><div class="round-row"><span class="round-label">'+(round.final?'🏆 ':'')+roundLabel(i)+'</span><span class="round-state">'+(all?'✓ abgeschlossen':wins+'/'+round.tables.length+' entschieden')+'</span><button type="button" class="btn" data-edit-round="'+i+'">'+(all?'Ansehen':'Erfassen')+'</button></div><div class="round-tables">'+tables+'</div>'+(round.bye!==null?'<div class="round-bye">⏳ Pause: '+(veiled?'?':esc(tournament.players[round.bye]))+'</div>':'')+'</div>'
 }).join('');
 if(fsOpen)renderBoard();
}
// Opens a tournament table in the life counter with the participants' names already filled in.
function launchTournamentMatch(round,table){
 var match=tournament&&tournament.schedule[round]&&tournament.schedule[round].tables[table];if(!match)return;
 state=freshState(match.players.map(function(idx){return tournament.players[idx]}));state.tournamentMatch={round:round,table:table,label:roundLabel(round)};
 match.players.forEach(function(idx,k){var c=commanderOf(idx);if(c&&c.art)state.players[k].art=c.art});undoStack=[];store();
 setTab('life');el('announcement').classList.add('hidden');runStarterSpin();
}
function playTournamentMatch(table){
 if(!tournament||editingRound===null)return;
 if(!state){launchTournamentMatch(editingRound,table);return}
 el('modalTitle').textContent='Laufende Partie ersetzen?';el('modalContent').innerHTML='<p class="muted">Im Lebenszähler läuft bereits eine Partie. Ihre Lebenspunkte und Spezialzähler werden gelöscht, wenn du Tisch '+(table+1)+' startest.</p><div class="modal-actions"><button class="btn" type="button" id="keepGame">Abbrechen</button><button class="btn warning" type="button" id="reallyPlayMatch" data-round="'+editingRound+'" data-table="'+table+'">Tisch starten</button></div>';activeModal=null;el('modalBackdrop').classList.remove('hidden');
}
function selectMatchWinner(table,index){
 if(!tournament||editingRound===null)return;var match=tournament.schedule[editingRound].tables[table];if(!match||!match.players.includes(index))return;
 match.winner=match.winner===index?null:index;saveTournament();
 var before=tournament.schedule.length;syncFinals();if(tournament.schedule.length>before)editingRound=tournament.schedule.length-1;
 renderTournament();
}
function promptTournamentReset(){closeGameMenu();if(!tournament)return;el('modalTitle').textContent='Ein neues Turnier beginnen?';el('modalContent').innerHTML='<p class="muted">Die aktuelle Tabelle, die Tischzuordnung und alle Sieger werden aus der App entfernt. Exportiere vorher bei Bedarf die CSV-Datei.</p><div class="modal-actions"><button class="btn" type="button" id="keepGame">Abbrechen</button><button class="btn warning" type="button" id="reallyResetTour">Turnier löschen</button></div>';activeModal=null;el('modalBackdrop').classList.remove('hidden')}
function exportTournamentCsv(){
 if(!tournament)return;syncFinals();var total=visibleRounds(),rows=[['Platz','Spieler','Commander','Siege','Gespielte Partien','Geplante Pausen','Gewonnene Runden']];
 rankRows(total).forEach(function(p){rows.push([p.place,tournament.players[p.idx],cmdName(commanderOf(p.idx)),p.wins,p.played,p.byes,p.rounds.join(', ')])});
 rows.push([]);rows.push(['Runde','Tisch','Mitspieler','Sieger','Pausiert']);
 tournament.schedule.slice(0,total).forEach(function(round,i){round.tables.forEach(function(m,j){rows.push([roundLabel(i),j+1,m.players.map(function(p){return tournament.players[p]}).join(' / '),m.winner===null?'':tournament.players[m.winner],round.bye===null?'':tournament.players[round.bye]])})});
 var content='\uFEFF'+rows.map(function(row){return row.map(function(v){return '"'+String(v).replace(/"/g,'""')+'"'}).join(';')}).join('\r\n');
 var blob=new Blob([content],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='Commander_Turnier_8_Ergebnisse.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url)},10000);
}

// Two separate save files: the running life-counter game and the tournament.
// Older combined backups (format commander-companion-backup) still load: each side takes only its own part.
function downloadJSON(data,name){var file=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},15000)}
function fileDate(){return new Date().toISOString().slice(0,10)}
function say(ids,msg){ids.forEach(function(id){var n=el(id);if(n)n.textContent=msg})}
var GAME_FEEDBACK=['gameBackupFeedback','setupGameFeedback'],TOUR_FEEDBACK=['tourBackupFeedback','setupTourFeedback'];
function saveGameFile(){
 if(!state){say(GAME_FEEDBACK,'Es läuft keine Partie, die gesichert werden kann.');return}
 downloadJSON({format:'commander-companion-game',version:1,created:new Date().toISOString(),life:state},'Commander_Companion_Spiel_'+fileDate()+'.json');
 say(GAME_FEEDBACK,'Spiel gesichert.');
}
function saveTournamentFile(){
 if(!tournament)return;
 downloadJSON({format:'commander-companion-tournament',version:1,created:new Date().toISOString(),tournament:tournament},'Commander_Companion_Turnier_'+fileDate()+'.json');
 say(TOUR_FEEDBACK,'Turnier gesichert. Bitte die Datei gut aufbewahren.');
}
function readJSONFile(e,feedback,apply){
 var f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;
 if(f.size>1024*1024){say(feedback,'Datei zu groß (maximal 1 MB).');return}
 var reader=new FileReader();reader.onerror=function(){say(feedback,'Datei konnte nicht gelesen werden.')};
 reader.onload=function(){var data;try{data=JSON.parse(String(reader.result))}catch(err){say(feedback,'Ungültige Datei. Keine Daten geändert.');return}apply(data)};
 reader.readAsText(f,'UTF-8');
}
function partOf(data,kind,key){return data&&data.version===1&&(data.format==='commander-companion-'+kind||data.format==='commander-companion-backup')?data[key]:undefined}
function loadGameFile(e){readJSONFile(e,GAME_FEEDBACK,function(data){
 var life=partOf(data,'game','life');
 if(life===null){say(GAME_FEEDBACK,'Diese Sicherung enthält kein laufendes Spiel. Keine Daten geändert.');return}
 if(!life||!validate(life)){say(GAME_FEEDBACK,'Keine gültige Spieldatei. Keine Daten geändert.');return}
 if(state&&!window.confirm('Die laufende Partie durch das gespeicherte Spiel ersetzen?'))return;
 state=life;state.mode=state.mode==='table'?'table':'standard';store();undoStack=[];closeGameMenu();setTab('life');
 say(GAME_FEEDBACK,'Spiel geladen.');
})}
function loadTournamentFile(e){readJSONFile(e,TOUR_FEEDBACK,function(data){
 var t=partOf(data,'tournament','tournament');
 if(t===null){say(TOUR_FEEDBACK,'Diese Sicherung enthält kein Turnier. Keine Daten geändert.');return}
 if(!t||!validTournament(t)){say(TOUR_FEEDBACK,'Keine gültige Turnierdatei. Keine Daten geändert.');return}
 if(tournament&&!window.confirm('Das aktuelle Turnier durch das gespeicherte Turnier ersetzen?'))return;
 tournament=normalizeCommanders(t);saveTournament();editingRound=null;setTab('tournament');
 say(TOUR_FEEDBACK,'Turnier geladen.');
})}
