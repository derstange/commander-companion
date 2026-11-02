/* Commander Companion VIII.2 — life counter: setup, players, starter spin, dice, game menu, wake lock, holds and modals. */
'use strict';

var STORAGE='commander-companion-v2';
var PALETTE=['#33547a','#744678','#35715e','#8a583c','#7b3a5c','#3e6875','#7f6b34','#5a5183'];
var state=null,undoStack=[],selectedCount=4,activeModal=null,activeTab='life';
function store(){try{window.localStorage.setItem(STORAGE,JSON.stringify(state))}catch(e){}}
function discard(){try{window.localStorage.removeItem(STORAGE)}catch(e){}}
function remember(){if(!state)return;undoStack.push(JSON.stringify(state));if(undoStack.length>120)undoStack.shift()}
function setChoice(n){selectedCount=n;var buttons=el('playerChoices').querySelectorAll('button');for(var i=0;i<buttons.length;i++){var chosen=Number(buttons[i].getAttribute('data-n'))===n;buttons[i].classList.toggle('selected',chosen);buttons[i].setAttribute('aria-pressed',chosen?'true':'false')}}
function buildChoices(){var html='';for(var i=2;i<=8;i++)html+='<button type="button" class="choice" data-n="'+i+'" aria-label="'+i+' Spieler">'+i+'</button>';html+='<button type="button" class="choice tour-choice" id="choiceTour" hidden aria-label="Partie aus dem Turnier wählen">🏆<small>Turnier</small></button>';el('playerChoices').innerHTML=html;setChoice(selectedCount);syncTourChoice()}
// "Turnier" in the player count grid: only offered while a tournament exists; opens the match picker.
function syncTourChoice(){var b=el('choiceTour');if(b)b.hidden=!tournament}
var pickRound=null;
function openMatchPicker(r){
 if(!tournament)return;var total=visibleRounds();
 if(!Number.isInteger(r)||r<0||r>=total){r=nextOpenRound();if(r===null)r=total-1}
 pickRound=r;var round=tournament.schedule[r],life=limit(parseInt(el('startingLife').value,10)||40,1,999);
 var rounds='<div class="pick-rounds" role="tablist" aria-label="Runde">'+tournament.schedule.slice(0,total).map(function(rd,i){var all=rd.tables.every(function(t){return t.winner!==null});return '<button type="button" role="tab" class="pick-round'+(i===r?' selected':'')+(all?' done':'')+'" data-pick-round="'+i+'" aria-selected="'+(i===r)+'">'+(rd.final?'🏆 ':'')+shortRoundLabel(i)+(all?' ✓':'')+'</button>'}).join('')+'</div>';
 var body;
 if(isVeiled(r))body='<p class="muted">Die Tische von '+roundLabel(r)+' sind noch verdeckt. Enthülle sie zuerst im Turnier-Tab.</p>';
 else body=round.tables.map(function(m,t){var won=m.winner!==null;return '<button type="button" class="pick-match'+(won?' done':'')+'" data-pick-table="'+t+'"><span class="pick-match-head"><strong>⚔ Tisch '+(t+1)+(round.final&&m.place?' · um Platz '+m.place:'')+'</strong><span>'+(won?'✓ '+esc(tournament.players[m.winner]):'offen')+'</span></span><span class="pick-match-players">'+m.players.map(function(idx){return '<span class="pick-player">'+artBox(idx)+'<span>'+esc(tournament.players[idx])+'</span></span>'}).join('')+'</span></button>'}).join('')+(round.bye!==null?'<p class="muted tiny">⏳ Pause: '+esc(tournament.players[round.bye])+'</p>':'');
 el('modalTitle').textContent='Partie aus dem Turnier';
 el('modalContent').innerHTML='<p class="muted tiny">Wähle deinen Tisch. '+roundLabel(r)+' · '+life+' Startlebenspunkte · Commander-Bilder werden übernommen.</p>'+rounds+'<div class="pick-matches">'+body+'</div><div class="modal-actions"><button class="btn" type="button" id="keepGame">Abbrechen</button></div>';
 activeModal=null;el('modalBackdrop').classList.remove('hidden');el('modalBackdrop').firstChild.classList.remove('wide');
}
function revealSetup(){closeModal();closeGameMenu();document.body.classList.remove('table-mode');document.body.classList.remove('match-focus');el('setup').classList.remove('hidden');el('game').classList.add('hidden');el('announcement').classList.add('hidden');syncTourChoice()}
function freshState(names){var life=limit(parseInt(el('startingLife').value,10)||40,1,999),n=names.length,players=[];for(var i=0;i<n;i++){var damages=[];for(var j=0;j<n;j++)damages.push(0);players.push({name:names[i],life:life,poison:0,experience:0,commander:damages})}return {version:2,mode:'table',starter:pickRandom(n),players:players}}
function beginGame(event){if(event)event.preventDefault();var names=[];for(var i=0;i<selectedCount;i++)names.push('Spieler '+(i+1));state=freshState(names);undoStack=[];store();render();el('announcement').classList.add('hidden');runStarterSpin();window.scrollTo(0,0)}
// Starting player draw: the players' cards cycle one after another, slow down and stop at the drawn starter.
// Uses the commander art of a player if one is attached (p.art from Scryfall), otherwise the player's colour.
var spin=null,SPIN_MS=3500;
function spinShow(i,landed){
 var p=state.players[i],card=el('spinCard'),art=typeof p.art==='string'&&/^https:\/\/cards\.scryfall\.io\//.test(p.art)?p.art:'';
 card.style.setProperty('--spin-bg',art?'url("'+art.replace(/["\\]/g,'')+'")':'radial-gradient(circle at 50% 35%,'+PALETTE[i%PALETTE.length]+' 0,#141c1b 75%)');
 card.classList.toggle('no-art',!art);el('spinName').textContent=p.name;el('spinArtist').textContent=art&&p.artist?'🎨 '+p.artist:'';
 card.classList.remove('tick','landed');void card.offsetWidth;card.classList.add(landed?'landed':'tick');
 var seats=el('spinSeats').children;for(var k=0;k<seats.length;k++)seats[k].classList.toggle('on',k===i);
}
function spinFinish(){
 if(!spin)return;clearTimeout(spin.timer);
 if(!spin.landed){spin.landed=true;spinShow(state.starter,true);el('spinResult').textContent='★ '+state.players[state.starter].name+' beginnt!';el('spinHint').textContent='Tippen zum Weiterspielen';spin.timer=setTimeout(spinClose,2600);return}
}
function matchRoundLabel(){var m=state&&state.tournamentMatch;return !m?'':typeof m.label==='string'?m.label:'Runde '+(m.round+1)}
function spinClose(){if(!spin)return;clearTimeout(spin.timer);spin=null;el('spinOverlay').classList.add('hidden');if(state)announce((state.tournamentMatch?'🏆 '+matchRoundLabel()+' · Tisch '+(state.tournamentMatch.table+1)+' — ':'')+'🎲 '+state.players[state.starter].name+' beginnt!')}
function runStarterSpin(){
 if(!state)return;closeGameMenu();if(spin){clearTimeout(spin.timer);spin=null}
 var n=state.players.length,quick=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 el('spinSeats').innerHTML=state.players.map(function(p){return '<span class="spin-seat">'+esc(p.name)+'</span>'}).join('');
 el('spinResult').textContent='';el('spinHint').textContent='Tippen zum Überspringen';el('spinOverlay').classList.remove('hidden');
 // At least three laps and about 24 cards; the last step lands exactly on the drawn starter.
 // The steps slow down (cubic) and are scaled so the draw takes SPIN_MS regardless of the player count;
 // each change is scheduled against the start time so timer delays do not add up.
 var laps=Math.max(3,Math.ceil(24/n)),from=pickRandom(n),steps=laps*n+((state.starter-from-laps*n)%n+n)%n,raw=[],sum=0,delays=[];
 for(var k=0;k<steps;k++){var t=k/Math.max(1,steps-1);raw.push(1+9*t*t*t);sum+=raw[k]}
 for(k=0;k<steps;k++)delays.push(Math.round(raw[k]*SPIN_MS/sum));
 spin={timer:null,landed:false};
 if(quick||n<2){spinFinish();return}
 var at=from,k2=0,t0=Date.now(),due=0;spinShow(at,false);
 (function step(){if(!spin)return;if(k2>=steps){spinFinish();return}due+=delays[k2];spin.timer=setTimeout(function(){at=(at+1)%n;k2++;if(k2>=steps){spinFinish();return}spinShow(at,false);step()},Math.max(0,t0+due-Date.now()))})();
}
// Coin flip and dice with any number of sides (W2–W1000), with a short roll animation and a small history for this session.
var diceHistory=[],diceSides=100,diceTimer=null;
function openDice(){
 closeGameMenu();el('modalTitle').textContent='🪙 Münze & Würfel';
 el('modalContent').innerHTML='<div class="dice-result"><span id="diceFace" class="dice-face">?</span><span id="diceLabel" class="dice-label" aria-live="polite">Wirf eine Münze oder einen Würfel.</span></div>'+
 '<h3 class="section-label">Münze</h3><button type="button" class="btn primary dice-coin" data-roll="coin">🪙 Münze werfen</button>'+
 '<h3 class="section-label">Würfel</h3><div class="dice-grid">'+[4,6,8,10,12,20].map(function(n){return '<button type="button" class="btn" data-roll="die" data-sides="'+n+'">W'+n+'</button>'}).join('')+'</div>'+
 '<div class="dice-custom"><label for="diceSides">Eigener W</label><input id="diceSides" type="number" min="2" max="1000" step="1" inputmode="numeric" value="'+diceSides+'" aria-label="Anzahl der Seiten (2 bis 1000)"><button type="button" class="btn" data-roll="custom">Würfeln</button></div>'+
 '<div id="diceHistory" class="dice-history" aria-label="Letzte Würfe"></div><div class="modal-actions"><button class="btn primary" type="button" id="modalDone">Fertig</button></div>';
 activeModal=null;el('modalBackdrop').classList.remove('hidden');renderDiceHistory();
}
function renderDiceHistory(){var box=el('diceHistory');if(box)box.innerHTML=diceHistory.map(function(h){return '<span>'+esc(h)+'</span>'}).join('')}
function rollDice(kind,sides){
 var face=el('diceFace'),label=el('diceLabel');if(!face)return;clearInterval(diceTimer);
 var coin=kind==='coin',result=coin?pickRandom(2):pickRandom(sides)+1,name=coin?'Münze':'W'+sides;
 var text=coin?(result===0?'Kopf':'Zahl'):String(result),quick=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 function done(){
  clearInterval(diceTimer);diceTimer=null;face.textContent=text;face.className='dice-face';void face.offsetWidth;
  var crit=!coin&&sides>=6&&result===sides,fumble=!coin&&sides>=6&&result===1;
  face.classList.add('settle');if(crit)face.classList.add('crit');if(fumble)face.classList.add('fumble');
  label.textContent=name+(coin?'':' · 1–'+sides)+(crit?' · Höchstwurf!':fumble?' · Eins!':'');
  diceHistory.unshift(name+': '+text);diceHistory=diceHistory.slice(0,10);renderDiceHistory();
 }
 face.className='dice-face';void face.offsetWidth;label.textContent=coin?'Die Münze fliegt …':name+' rollt …';
 if(quick){done();return}
 if(coin){face.textContent='🪙';face.classList.add('flipping');diceTimer=setTimeout(done,900);return}
 face.classList.add('rolling');var ticks=0;
 diceTimer=setInterval(function(){face.textContent=String(pickRandom(sides)+1);if(++ticks>=12)done()},60);
}
function onDiceClick(e){
 var b=e.target.closest('button[data-roll]');if(!b)return;var kind=b.getAttribute('data-roll');
 if(kind==='coin'){rollDice('coin');return}
 if(kind==='die'){rollDice('die',Number(b.getAttribute('data-sides')));return}
 var input=el('diceSides'),n=parseInt(input.value,10);
 if(!Number.isInteger(n)||n<2||n>1000){input.reportValidity();return}
 diceSides=n;rollDice('die',n);
}
function announce(message){el('announcement').textContent=message;el('announcement').classList.remove('hidden')}
function gameSummaryHTML(){
 if(!state)return '';
 var starter=state.players[state.starter]?state.players[state.starter].name:'—';
 return '<div class="menu-stat"><span>Spieler</span><strong>'+state.players.length+'</strong></div>'+
 '<div class="menu-stat"><span>Startspieler</span><strong>'+esc(starter)+'</strong></div>'+
 '<div class="menu-stat"><span>Ansicht</span><strong>'+(state.mode==='table'?'Tabletop':'Standard')+'</strong></div>'+
 (state.tournamentMatch?'<div class="menu-stat"><span>Turnier</span><strong>'+esc(matchRoundLabel())+' · Tisch '+(state.tournamentMatch.table+1)+'</strong></div>':'')+
 '<div class="menu-stat"><span>Rückgängig</span><strong>'+(undoStack.length?undoStack.length+' Schritte':'leer')+'</strong></div>'+
 (el('announcement').textContent?'<p class="menu-note">'+esc(el('announcement').textContent)+'</p>':'');
}
function closeGameMenu(){
 var menu=el('gameMenu'),fab=el('menuFab');
 if(!menu||!fab)return;
 menu.classList.add('hidden');
 fab.setAttribute('aria-expanded','false');
 document.body.classList.remove('menu-open');
}
function openGameMenu(){
 if(!state||activeTab!=='life')return;
 renderGameMenu();
 el('gameMenu').classList.remove('hidden');
 el('menuFab').setAttribute('aria-expanded','true');
 document.body.classList.add('menu-open');
}
function toggleGameMenu(){if(el('gameMenu').classList.contains('hidden'))openGameMenu();else closeGameMenu()}
var KEEP_AWAKE_KEY='commander-companion-keep-awake';
var keepAwake=true,wakeSentinel=null,wakePending=false,wakeFailure='';
try{keepAwake=localStorage.getItem(KEEP_AWAKE_KEY)!=='false'}catch(e){}
function describeWake(){
 if(!keepAwake)return 'Bildschirm wachhalten ist ausgeschaltet.';
 if(!('wakeLock' in navigator))return 'Dieses Gerät unterstützt das automatische Wachhalten nicht. Prüfe unter iOS Einstellungen → Anzeige & Helligkeit → Automatische Sperre.';
 if(wakeSentinel&&!wakeSentinel.released)return 'Aktiv: Der Bildschirm soll während der Nutzung eingeschaltet bleiben.';
 if(document.visibilityState!=='visible')return 'Wird beim erneuten Öffnen der App angefordert.';
 return wakePending?'Bildschirm-Wachhalten wird aktiviert …':(wakeFailure||'Nicht aktiv. Tippe auf „Bildschirm wachhalten“, um es erneut zu versuchen.');
}
function updateWakeUI(){
 var b=el('menuWake'),status=el('wakeStatus');
 if(b)b.textContent=keepAwake?'☀ Wachhalten: AN':'☾ Wachhalten: AUS';
 if(status){status.textContent=describeWake();status.classList.toggle('warning',keepAwake&&(!wakeSentinel||wakeSentinel.released));}
}
async function requestWakeLock(){
 if(!keepAwake||wakePending||document.visibilityState!=='visible')return;
 if(wakeSentinel&&!wakeSentinel.released)return;
 if(!('wakeLock' in navigator)){wakeFailure='Nicht unterstützt: Bitte die automatische Sperre in den iPhone-Einstellungen anpassen.';updateWakeUI();return;}
 wakePending=true;wakeFailure='';updateWakeUI();
 try{
  var lock=await navigator.wakeLock.request('screen');
  if(!keepAwake){await lock.release();return}
  wakeSentinel=lock;
  lock.addEventListener('release',function(){if(wakeSentinel===lock)wakeSentinel=null;updateWakeUI()});
 }catch(e){wakeFailure='Der Browser oder iOS hat die Anfrage abgelehnt. Prüfe Energiesparmodus, Geräteeinstellungen und iOS-Version.';}
 finally{wakePending=false;updateWakeUI()}
}
async function toggleWakeLock(){
 keepAwake=!keepAwake;
 try{localStorage.setItem(KEEP_AWAKE_KEY,String(keepAwake))}catch(e){}
 if(!keepAwake){var old=wakeSentinel;wakeSentinel=null;if(old&&!old.released){try{await old.release()}catch(e){}}}
 else await requestWakeLock();
 updateWakeUI();
}
function initializeWakeLock(){
 updateWakeUI();requestWakeLock();
 document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')requestWakeLock();else updateWakeUI()});
 window.addEventListener('pageshow',function(){requestWakeLock()});
 document.addEventListener('pointerdown',function(){if(keepAwake&&!wakePending&&(!wakeSentinel||wakeSentinel.released))requestWakeLock()},{passive:true});
}
function renderGameMenu(){
 var inMatch=activeTab==='life'&&!!state;
 if(el('menuFab'))el('menuFab').classList.toggle('hidden',!inMatch);
 if(!inMatch){closeGameMenu();return}
 if(el('menuSummary'))el('menuSummary').innerHTML=gameSummaryHTML();
 if(el('menuUndo'))el('menuUndo').disabled=undoStack.length===0;
 if(el('menuMode'))el('menuMode').textContent=state.mode==='table'?'▦ Standardansicht':'↕ Tabletop-Modus';
 updateWakeUI();
}
function lostReasons(p){var r=[];if(p.life<=0)r.push('0 Leben');if(p.poison>=10)r.push('10 Gift');for(var j=0;j<p.commander.length;j++)if(p.commander[j]>=21){r.push('21 Commander-Schaden');break}return r}
function commanderDamageHTML(p,i){
 var items=[];
 for(var j=0;j<state.players.length;j++){
  if(j===i)continue;
  var source=state.players[j], damage=p.commander[j]||0;
  var klass=damage>=21?' critical':damage>=15?' danger':damage>0?' marked':'';
  var sourceName=esc(source.name);
  items.push('<button type="button" class="commander-chip'+klass+'" data-act="modal" data-i="'+i+'" title="'+sourceName+': '+damage+' von 21 Commander-Schaden erhalten · antippen zum Bearbeiten" aria-label="'+esc(p.name)+': '+damage+' Commander-Schaden von '+sourceName+'. Antippen zum Bearbeiten">'+
   '<span class="cmd-who"><span class="cmd-number">'+(j+1)+'</span><span class="cmd-name">'+sourceName+'</span></span><span class="cmd-amount">'+damage+'<small>/21</small></span></button>');
 }
 return '<section class="commander-direct" aria-label="Erhaltener Commander-Schaden"><div class="commander-direct-title">⚔ Commander-DMG <span>Antippen zum Ändern</span></div><div class="commander-chips">'+items.join('')+'</div></section>';
}
function tableSeatClass(i){
 if(!state||state.mode!=='table')return '';
 var n=state.players.length;
 if(n%2===1 && i===n-1)return ' center-seat';
 return i%2===0?' left-edge':' right-edge';
}
function boardRows(){
 if(!state)return 1;
 if(state.mode==='table'&&state.players.length===2)return 1;
 return Math.ceil(state.players.length/2);
}
function edgeScale(){return 1}
function sizeRotatedCards(){
 if(!state||activeTab!=='life'||state.mode!=='table')return;
 var board=el('board');if(!board)return;
 var cards=board.querySelectorAll('.player.left-edge, .player.right-edge');
 for(var i=0;i<cards.length;i++){
  var bounds=cards[i].getBoundingClientRect();
  if(bounds.width<=5||bounds.height<=5)continue;
  var content=cards[i].querySelector('.player-inner');
  if(!content)continue;
  content.style.setProperty('--rotated-width',Math.max(30,Math.floor(bounds.height-5))+'px');
  content.style.setProperty('--rotated-height',Math.max(30,Math.floor(bounds.width-5))+'px');
  content.style.setProperty('--cmd-columns',state.players.length>6?'4':'3');
 }
}
var boardMeasureRequested=false;
function scheduleCardSizing(){
 if(boardMeasureRequested)return;
 boardMeasureRequested=true;
 requestAnimationFrame(function(){boardMeasureRequested=false;sizeRotatedCards()});
}
function playerHTML(p,i){var reasons=lostReasons(p),seatClass=tableSeatClass(i);return '<article class="player '+(state.starter===i?'starter ':'')+(reasons.length?'eliminated ':'')+seatClass+'" style="--player:'+PALETTE[i%PALETTE.length]+'">'+
'<div class="player-inner"><div class="player-top"><span class="player-name">'+esc(p.name)+'</span>'+(i===state.starter?'<span class="star" aria-label="Startspieler">★ Start</span>':'')+'</div>'+
'<div class="life-controls"><button type="button" class="step" data-act="life" data-i="'+i+'" data-d="-1" aria-label="'+esc(p.name)+': ein Leben abziehen">−</button><div class="life-display"><span class="life-value">'+p.life+'</span></div><button type="button" class="step" data-act="life" data-i="'+i+'" data-d="1" aria-label="'+esc(p.name)+': ein Leben hinzufügen">+</button></div>'+
commanderDamageHTML(p,i)+
'<div class="quick"><button type="button" class="btn" data-act="modal" data-i="'+i+'" aria-label="Giftmarken von '+esc(p.name)+' verwalten">☠ Gift <strong>'+p.poison+'</strong></button><button type="button" class="btn" data-act="modal" data-i="'+i+'" aria-label="Alle Spezialzähler von '+esc(p.name)+' verwalten">⚙ Zähler</button></div>'+
(reasons.length?'<div class="bottom-status">⚠ Ausgeschieden · '+esc(reasons.join(', '))+'</div>':'')+'</div></article>'}
function render(){
 if(!state){revealSetup();return}
 document.body.classList.toggle('table-mode',activeTab==='life'&&state.mode==='table');
 document.body.classList.toggle('match-focus',activeTab==='life');
 el('setup').classList.add('hidden');
 el('game').classList.remove('hidden');
 
 el('mode').textContent=state.mode==='table'?'▦ Standardansicht':'↕ Tabletop-Modus';
 el('mode').classList.toggle('active',state.mode==='table');
 el('undo').disabled=undoStack.length===0;
 var board=el('board');
 board.style.setProperty('--rows',String(boardRows()));
 board.style.setProperty('--edge-scale',String(edgeScale()));
 board.classList.toggle('two-players',state.players.length===2);
 board.classList.toggle('odd-count',state.players.length%2===1);
 board.classList.toggle('table-layout',state.mode==='table');
 board.innerHTML=state.players.map(playerHTML).join('');
 scheduleCardSizing();
 renderGameMenu();
 if(activeModal!==null)renderModal()
}
function adjust(i,key,d,source){if(!state||!state.players[i]||!Number.isFinite(d))return;var p=state.players[i];remember();if(key==='life')p.life=limit(p.life+d,-999,999);else if(key==='commander'){if(!Number.isInteger(source)||source<0||source>=state.players.length||source===i){undoStack.pop();return}p.commander[source]=limit(p.commander[source]+d,0,999)}else if(key==='poison'||key==='experience')p[key]=limit(p[key]+d,0,999);else{undoStack.pop();return}store();render()}
function openModal(i){if(!state||!state.players[i])return;closeGameMenu();activeModal=i;el('modalBackdrop').classList.remove('hidden');renderModal()}
function closeModal(){el('modalBackdrop').firstChild.classList.remove('wide');clearInterval(diceTimer);clearTimeout(diceTimer);diceTimer=null;activeModal=null;el('modalBackdrop').classList.add('hidden')}
function counterHTML(title,i,key,value,source){var extra=typeof source==='number'?' data-source="'+source+'"':'';return '<div class="counter-row"><span class="who">'+esc(title)+'</span><button type="button" class="mini" data-act="adjust" data-i="'+i+'" data-key="'+key+'" data-d="-1"'+extra+' aria-label="'+esc(title)+' reduzieren">−</button><output>'+value+'</output><button type="button" class="mini" data-act="adjust" data-i="'+i+'" data-key="'+key+'" data-d="1"'+extra+' aria-label="'+esc(title)+' erhöhen">+</button></div>'}
function renderModal(){if(activeModal===null||!state||!state.players[activeModal])return;var i=activeModal,p=state.players[i];el('modalTitle').textContent=p.name+' · Zähler';var html='<div class="field"><label for="editName">Spielername</label><input id="editName" type="text" maxlength="35" autocomplete="off" value="'+esc(p.name)+'"></div>';
html+='<h3 class="section-label">Status & Marken</h3>'+counterHTML('☠ Giftmarken',i,'poison',p.poison)+counterHTML('✦ Erfahrungsmarken',i,'experience',p.experience);
html+='<h3 class="section-label">Commander-Schaden erhalten</h3>';for(var j=0;j<state.players.length;j++)if(j!==i)html+=counterHTML('Von '+state.players[j].name,i,'commander',p.commander[j],j);
html+='<p class="notice-inline">21 Schaden durch <strong>denselben</strong> Commander oder 10 Giftmarken bedeuten eine Niederlage. Commander-Schaden ändert hier nicht automatisch die Lebenspunkte, um Doppelzählungen zu vermeiden.</p><div class="modal-actions"><button type="button" class="btn primary" id="modalDone">Fertig</button></div>';el('modalContent').innerHTML=html}
function newGamePrompt(){closeGameMenu();el('modalTitle').textContent='Neue Partie starten?';el('modalContent').innerHTML='<p class="muted">Alle aktuellen Lebenspunkte und Spezialzähler werden gelöscht.</p><div class="modal-actions"><button class="btn" type="button" id="keepGame">Abbrechen</button><button class="btn warning" type="button" id="reallyReset">Neue Partie</button></div>';activeModal=null;el('modalBackdrop').classList.remove('hidden')}
function validate(s){if(!s||!Array.isArray(s.players)||s.players.length<2||s.players.length>8)return false;var n=s.players.length;if(!Number.isInteger(s.starter)||s.starter<0||s.starter>=n)return false;for(var i=0;i<n;i++){var p=s.players[i];if(!p||typeof p.name!=='string'||!Number.isFinite(p.life)||!Number.isFinite(p.poison)||!Number.isFinite(p.experience)||!Array.isArray(p.commander)||p.commander.length!==n)return false;for(var j=0;j<n;j++)if(!Number.isFinite(p.commander[j]))return false}return true}
function restore(){try{var raw=window.localStorage.getItem(STORAGE);if(raw){var candidate=JSON.parse(raw);if(validate(candidate)){state=candidate;state.mode=(state.mode==='table'?'table':'standard');return true}}}catch(e){}return false}
function migrate(){try{var raw=window.localStorage.getItem('commander-life-tracker-v1');if(!raw)return false;var s=JSON.parse(raw);if(!validate(s))return false;state={version:2,mode:'standard',starter:s.starter,players:s.players};store();return true}catch(e){return false}}
// Press and hold on any − / + (life on the board, poison, experience and commander damage in the counter dialog):
// the value keeps changing until release and speeds up the longer the button is held.
// Only the number is updated while holding; everything is redrawn on release, and a whole hold is one undo step.
var holds={},lastHoldEnd=0,HOLD_BUTTONS='.step[data-act="life"],.mini[data-act="adjust"]';
function holdButton(h){
 if(h.key==='life')return el('board').querySelector('.step[data-act="life"][data-i="'+h.i+'"][data-d="'+h.d+'"]');
 if(activeModal!==h.i)return null;
 return el('modalContent').querySelector('.mini[data-key="'+h.key+'"][data-d="'+h.d+'"]'+(h.key==='commander'?'[data-source="'+h.source+'"]':''));
}
function holdStep(h){
 var p=state.players[h.i];
 if(h.key==='life'){var before=p.life;p.life=limit(p.life+h.d,-999,999);return {value:p.life,change:p.life-before}}
 if(h.key==='commander'){var c=p.commander[h.source];p.commander[h.source]=limit(c+h.d,0,999);return {value:p.commander[h.source],change:p.commander[h.source]-c}}
 var old=p[h.key];p[h.key]=limit(old+h.d,0,999);return {value:p[h.key],change:p[h.key]-old};
}
function holdTick(id){
 var h=holds[id];if(!h||!state||!state.players[h.i])return;
 var step=holdStep(h);h.total+=step.change;
 var btn=holdButton(h);
 if(btn){
  btn.classList.add('holding');
  if(h.key==='life'){
   var box=btn.closest('.life-controls');box.querySelector('.life-value').textContent=step.value;
   var badge=box.querySelector('.life-delta');if(!badge){badge=document.createElement('span');badge.className='life-delta';badge.setAttribute('aria-hidden','true');box.querySelector('.life-display').appendChild(badge)}
   badge.textContent=(h.total>0?'+':h.total<0?'−':'±')+Math.abs(h.total);
  }else btn.closest('.counter-row').querySelector('output').textContent=step.value;
 }
 h.count++;
 h.timer=setTimeout(function(){holdTick(id)},h.count===1?450:Math.max(35,Math.round(170*Math.pow(.86,h.count-2))));
}
function startHold(e){
 var btn=e.target.closest(HOLD_BUTTONS);if(!btn||!state||(e.pointerType==='mouse'&&e.button!==0))return;
 var h={i:parseInt(btn.getAttribute('data-i'),10),key:btn.getAttribute('data-act')==='life'?'life':btn.getAttribute('data-key'),d:Number(btn.getAttribute('data-d')),source:btn.hasAttribute('data-source')?Number(btn.getAttribute('data-source')):null,count:0,total:0};
 var p=state.players[h.i];if(!p||!Number.isFinite(h.d)||['life','poison','experience','commander'].indexOf(h.key)<0)return;
 if(h.key==='commander'&&(!Number.isInteger(h.source)||h.source<0||h.source>=state.players.length||h.source===h.i))return;
 endHold(e.pointerId);remember();holds[e.pointerId]=h;holdTick(e.pointerId);
}
function endHold(id,cancelled){
 var h=holds[id];if(!h)return;clearTimeout(h.timer);delete holds[id];lastHoldEnd=Date.now();
 var others=Object.keys(holds).length>0;
 // A cancelled short touch (e.g. the page or dialog started scrolling) should not change anything.
 if((cancelled&&h.count<=1)||h.total===0){if(state&&state.players[h.i]){h.d=-h.total;if(h.d)holdStep(h)}if(!others)undoStack.pop()}
 store();if(!others)render();
}
function endAllHolds(){Object.keys(holds).forEach(function(id){endHold(id)})}
function onBoardClick(e){var node=e.target.closest('button[data-act]');if(!node)return;var i=parseInt(node.getAttribute('data-i'),10);var action=node.getAttribute('data-act');if(action==='life'&&window.PointerEvent&&Date.now()-lastHoldEnd<700)return;if(action==='life')adjust(i,'life',Number(node.getAttribute('data-d')));else if(action==='modal')openModal(i)}
function onModalClick(e){var btn=e.target.closest('button');if(!btn)return;if(btn.id==='modalDone'||btn.id==='keepGame'){closeModal();return}if(btn.id==='reallyResetTour'){closeModal();tournament=null;editingRound=null;try{window.localStorage.removeItem(TOUR_STORAGE)}catch(e){}if(typeof syncPushTournament==='function')syncPushTournament();renderTournament();return}if(btn.hasAttribute('data-pick-round')){openMatchPicker(Number(btn.getAttribute('data-pick-round')));return}if(btn.hasAttribute('data-pick-table')){var pr=pickRound;closeModal();launchTournamentMatch(pr,Number(btn.getAttribute('data-pick-table')));window.scrollTo(0,0);return}if(btn.id==='reallyPlayMatch'){closeModal();launchTournamentMatch(Number(btn.getAttribute('data-round')),Number(btn.getAttribute('data-table')));return}if(btn.id==='reallyReset'){closeModal();state=null;undoStack=[];discard();revealSetup();window.scrollTo(0,0);return}if(btn.getAttribute('data-act')==='adjust'){if(window.PointerEvent&&Date.now()-lastHoldEnd<700)return;var i=Number(btn.getAttribute('data-i')),key=btn.getAttribute('data-key'),d=Number(btn.getAttribute('data-d')),source=btn.hasAttribute('data-source')?Number(btn.getAttribute('data-source')):undefined;adjust(i,key,d,source)}}
function onNameChange(e){if(e.target.id!=='editName'||activeModal===null||!state)return;var name=e.target.value.trim().slice(0,35)||'Spieler '+(activeModal+1);if(state.players[activeModal].name===name)return;remember();state.players[activeModal].name=name;store();render();el('modalTitle').textContent=name+' · Zähler'}


// Multi-table tournament planner: balanced byes, equal table size and diversified opponents.
