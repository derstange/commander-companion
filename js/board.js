/* Commander Companion VIII.2 — fullscreen tournament board for laptop/projector and the commander info dialog. */
'use strict';

// Fullscreen board for a laptop or projector. fsRound===null follows the next open round automatically.
// fsTab: 'round' (tables of one round) or 'pairs' (who the selected player fsPlayer meets, how often and when).
var fsOpen=false,fsRound=null,fsTab='round',fsPlayer=null;
var DESKTOP_QUERY=window.matchMedia?window.matchMedia('(min-width:901px) and (hover:hover) and (pointer:fine)'):null;
function isDesktop(){return !DESKTOP_QUERY||DESKTOP_QUERY.matches}
function openBoard(){if(!tournament||!isDesktop())return;closeGameMenu();fsOpen=true;fsRound=null;fsTab='round';fsPlayer=null;document.body.classList.add('fs-open');el('fsView').classList.remove('hidden');renderBoard();var d=document.documentElement;if(d.requestFullscreen&&!document.fullscreenElement){var p=d.requestFullscreen();if(p&&p.catch)p.catch(function(){})}el('fsClose').focus()}
function closeBoard(){if(!fsOpen)return;fsOpen=false;document.body.classList.remove('fs-open');el('fsView').classList.add('hidden');if(document.fullscreenElement&&document.exitFullscreen){var p=document.exitFullscreen();if(p&&p.catch)p.catch(function(){})}el('tourBoard').focus()}
function boardRound(){var total=visibleRounds();if(fsRound!==null&&fsRound<total)return fsRound;fsRound=null;var r=nextOpenRound();return r===null?total-1:r}
function artBox(idx){var c=commanderOf(idx),imgs=cmdArtImgs(c);return imgs?'<span class="fs-art'+(c.partner&&c.partner.art&&c.art?' duo':'')+'">'+imgs+'</span>':'<span class="fs-art none">🃏</span>'}
function renderBoard(){
 if(!tournament){closeBoard();return}
 var total=visibleRounds(),r=boardRound(),open=nextOpenRound(),round=tournament.schedule[r];
 el('fsTitle').textContent=el('tourTitle').textContent;el('fsMetrics').innerHTML=el('tourMetrics').innerHTML;el('fsProgressFill').style.width=el('tourProgress').style.width;
 if(fsPlayer!==null&&!tournament.players[fsPlayer])fsPlayer=null;
 Array.prototype.forEach.call(el('fsView').querySelectorAll('[data-fs-tab]'),function(b){var on=b.getAttribute('data-fs-tab')===fsTab;b.classList.toggle('active',on);b.setAttribute('aria-selected',on)});
 el('fsRound').hidden=fsTab!=='round';el('fsPairs').hidden=fsTab!=='pairs';
 if(fsTab==='pairs')el('fsPairs').innerHTML=renderPairs();
 el('fsRanking').innerHTML=rankRows(total).map(function(row){var c=commanderOf(row.idx);return '<button type="button" class="fs-rank-row'+(row.place===1&&row.wins>0?' leader':'')+(fsTab==='pairs'&&row.idx===fsPlayer?' picked':'')+'" data-player="'+row.idx+'" title="Paarungen von '+esc(tournament.players[row.idx])+' anzeigen"><span class="fs-place">'+row.place+'.</span>'+artBox(row.idx)+'<span class="fs-who"><strong>'+esc(tournament.players[row.idx])+'</strong><small>'+(c?esc(cmdName(c)):'kein Commander')+'</small></span><span class="fs-wins">'+row.wins+'<small>'+(row.wins===1?'Sieg':'Siege')+'</small></span></button>'}).join('');
 var head='<div class="fs-round-head"><button type="button" class="btn" data-fs-step="-1" aria-label="Vorherige Runde"'+(r===0?' disabled':'')+'>‹</button><h3>'+(round.final?'🏆 '+roundLabel(r):'Runde '+(r+1)+' von '+tournament.rounds)+'</h3>'+(open!==null&&r!==open?'<button type="button" class="btn" data-fs-round="'+open+'">Aktuelle Runde ↗</button>':'')+'<button type="button" class="btn" data-fs-step="1" aria-label="Nächste Runde"'+(r===total-1?' disabled':'')+'>›</button></div>';
 var body;
 if(isVeiled(r))body='<div class="fs-veil"><p>Die Tische dieser Runde sind noch verdeckt.</p><button type="button" class="btn primary" data-fs-reveal="'+r+'">✨ Tische enthüllen</button></div>';
 else{
  body='<div class="fs-tables">'+round.tables.map(function(m,t){var won=m.winner!==null;return '<div class="fs-table'+(won?' done':'')+'"><div class="fs-table-head"><span>⚔ Tisch '+(t+1)+(round.final&&m.place?' · um Platz '+m.place:'')+'</span><span>'+(won?'✓ entschieden':'offen')+'</span></div>'+m.players.map(function(idx){var c=commanderOf(idx),picked=m.winner===idx;return '<button type="button" class="fs-player'+(picked?' selected':won?' beaten':'')+'" data-fs-table="'+t+'" data-fs-winner="'+idx+'" aria-pressed="'+picked+'">'+artBox(idx)+'<span class="fs-who"><strong>'+esc(tournament.players[idx])+'</strong><small>'+(c?esc(cmdName(c)):'')+'</small></span><span class="marker">'+(picked?'✓':'')+'</span></button>'}).join('')+'</div>'}).join('')+'</div>';
  if(round.bye!==null)body+='<div class="fs-bye">⏳ <strong>Pause:</strong> '+esc(tournament.players[round.bye])+'</div>';
 }
 el('fsRound').innerHTML=head+body;
 el('fsRounds').innerHTML=tournament.schedule.slice(0,total).map(function(rd,i){var wins=rd.tables.filter(function(t){return t.winner!==null}).length,all=wins===rd.tables.length,veiled=isVeiled(i);
  var lines=veiled?'<span>verdeckt</span>':rd.tables.map(function(t,j){return '<span>T'+(j+1)+': '+t.players.map(function(idx){var n=esc(tournament.players[idx]);return idx===t.winner?'<b>🏆 '+n+'</b>':n}).join(' · ')+'</span>'}).join('')+(rd.bye!==null?'<span>⏳ '+esc(tournament.players[rd.bye])+'</span>':'');
  return '<button type="button" class="fs-round '+(all?'done':wins?'partial':'pending')+(i===open?' current':'')+(i===r?' viewing':'')+'" data-fs-round="'+i+'"><div class="fs-round-top"><span>'+(rd.final?'🏆 ':'')+roundLabel(i)+'</span><span>'+(all?'✓ abgeschlossen':wins+'/'+rd.tables.length+' entschieden')+'</span></div><div class="fs-round-tables">'+lines+'</div></button>'}).join('');
}
// Every visible, unveiled meeting of player idx: opponent -> [{label,res}] with res win/loss/other/plan from idx's point of view.
function pairingStats(idx){
 var total=visibleRounds(),opp={},byes=[],veiled=0;
 for(var i=0;i<total;i++){
  if(isVeiled(i)){veiled++;continue}
  var rd=tournament.schedule[i];if(rd.bye===idx)byes.push(shortRoundLabel(i));
  rd.tables.forEach(function(m){if(m.players.indexOf(idx)<0)return;m.players.forEach(function(o){if(o===idx)return;(opp[o]=opp[o]||[]).push({label:shortRoundLabel(i),final:!!rd.final,res:m.winner===null?'plan':m.winner===idx?'win':m.winner===o?'loss':'other'})})});
 }
 return {opp:opp,byes:byes,veiled:veiled};
}
function countRes(list,res){return list.filter(function(m){return m.res===res}).length}
function pairChip(m,o){var t={win:'gewonnen',loss:tournament.players[o]+' gewann',other:'jemand anderes gewann',plan:'noch offen'}[m.res];return '<span class="fs-chip '+m.res+'" title="'+esc(t)+'">'+(m.final?'🏆':'')+m.label+' '+{win:'✓',loss:'✗',other:'·',plan:'○'}[m.res]+'</span>'}
function renderPairs(){
 var ranking=rankRows(visibleRounds());
 if(fsPlayer===null)fsPlayer=ranking[0].idx;
 var idx=fsPlayer,me=ranking.filter(function(x){return x.idx===idx})[0],c=commanderOf(idx),st=pairingStats(idx);
 var others=ranking.map(function(r){return r.idx}).filter(function(o){return o!==idx});
 var met=others.filter(function(o){return st.opp[o]}),never=others.filter(function(o){return !st.opp[o]});
 var html='<div class="fs-pairs-head">'+artBox(idx)+'<span class="fs-who"><strong>'+esc(tournament.players[idx])+'</strong><small>'+(c?esc(cmdName(c)):'kein Commander')+'</small></span><span class="fs-pairs-stat">'+me.place+'. Platz · '+me.wins+' '+(me.wins===1?'Sieg':'Siege')+' · '+me.played+' gespielt</span>'+(c?'<button type="button" class="btn" data-fs-cmd="'+idx+'">🃏 Commander</button>':'')+'</div>';
 if(!met.length)return html+'<p class="fs-pairs-note">Noch keine sichtbaren Begegnungen.</p>';
 // Radial map: selected player in the centre, opponents on an ellipse in ranking order, line width = number of meetings.
 var n=met.length,compact=n>10,lines='',badges='',nodes='';
 met.forEach(function(o,k){
  var a=-Math.PI/2+2*Math.PI*k/n,x=50+40*Math.cos(a),y=50+40*Math.sin(a),list=st.opp[o],w=countRes(list,'win'),l=countRes(list,'loss'),played=list.some(function(m){return m.res!=='plan'});
  var tone=!played?'plan':w>l?'up':l>w?'down':'even';
  lines+='<line x1="50" y1="50" x2="'+x.toFixed(2)+'" y2="'+y.toFixed(2)+'" class="fs-edge '+tone+'" stroke-width="'+(1+list.length*2)+'" vector-effect="non-scaling-stroke"/>';
  badges+='<span class="fs-edge-badge '+tone+'" style="left:'+(50+(x-50)*.6).toFixed(2)+'%;top:'+(50+(y-50)*.6).toFixed(2)+'%">'+list.length+'×</span>';
  nodes+='<button type="button" class="fs-node'+(compact?' compact':'')+'" data-fs-pick="'+o+'" style="left:'+x.toFixed(2)+'%;top:'+y.toFixed(2)+'%" title="'+esc(tournament.players[o])+': '+list.map(function(m){return m.label}).join(', ')+'">'+(compact?'':artBox(o))+'<strong>'+esc(tournament.players[o])+'</strong><small>'+(played?w+' : '+l:'geplant')+'</small></button>';
 });
 html+='<div class="fs-graph"><svg class="fs-graph-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'+lines+'</svg>'+badges+'<button type="button" class="fs-node center" data-fs-cmd="'+idx+'" style="left:50%;top:50%" title="Commander von '+esc(tournament.players[idx])+' anzeigen">'+artBox(idx)+'<strong>'+esc(tournament.players[idx])+'</strong></button>'+nodes+'</div>';
 html+='<p class="fs-legend"><span class="fs-chip win">✓ gewonnen</span><span class="fs-chip loss">✗ Gegner gewann</span><span class="fs-chip other">· anderer Sieger</span><span class="fs-chip plan">○ offen</span><span>Bilanz = eigene Siege : Siege des Gegners</span></p>';
 html+='<div class="fs-pair-list">'+met.slice().sort(function(a,b){return st.opp[b].length-st.opp[a].length}).map(function(o){var list=st.opp[o];return '<button type="button" class="fs-pair-row" data-fs-pick="'+o+'">'+artBox(o)+'<span class="fs-who"><strong>'+esc(tournament.players[o])+'</strong><small>'+(list.some(function(m){return m.res!=='plan'})?countRes(list,'win')+' : '+countRes(list,'loss'):'geplant')+'</small></span><span class="fs-pair-count">'+list.length+'×</span><span class="fs-chips">'+list.map(function(m){return pairChip(m,o)}).join('')+'</span></button>'}).join('')+'</div>';
 if(never.length)html+='<p class="fs-pairs-note">🚫 <strong>Noch nie am Tisch:</strong> '+never.map(function(o){return esc(tournament.players[o])}).join(' · ')+'</p>';
 if(st.byes.length)html+='<p class="fs-pairs-note">⏳ <strong>Pausen:</strong> '+st.byes.join(' · ')+'</p>';
 if(st.veiled)html+='<p class="fs-pairs-note">✨ '+st.veiled+' verdeckte '+(st.veiled===1?'Runde ist':'Runden sind')+' nicht mitgezählt.</p>';
 return html;
}
function pickPlayer(i){if(!tournament||!tournament.players[i])return;fsPlayer=i;fsTab='pairs';renderBoard()}
function boardGo(i){if(!tournament)return;if(i<0||i>=visibleRounds())return;fsRound=i===nextOpenRound()?null:i;fsTab='round';renderBoard()}
function onFsClick(e){
 var b=e.target.closest('button');if(!b||!tournament)return;
 if(b.id==='fsClose'){closeBoard();return}
 if(b.hasAttribute('data-fs-tab')){fsTab=b.getAttribute('data-fs-tab')==='pairs'?'pairs':'round';renderBoard();return}
 if(b.hasAttribute('data-player')){pickPlayer(Number(b.getAttribute('data-player')));return}
 if(b.hasAttribute('data-fs-pick')){pickPlayer(Number(b.getAttribute('data-fs-pick')));return}
 if(b.hasAttribute('data-fs-cmd')){openCommanderInfo(Number(b.getAttribute('data-fs-cmd')));return}
 if(b.hasAttribute('data-fs-step')){boardGo(boardRound()+Number(b.getAttribute('data-fs-step')));return}
 if(b.hasAttribute('data-fs-round')){boardGo(Number(b.getAttribute('data-fs-round')));return}
 if(b.hasAttribute('data-fs-reveal')){var rd=tournament.schedule[Number(b.getAttribute('data-fs-reveal'))];if(rd){rd.revealed=true;saveTournament();renderTournament()}return}
 if(b.hasAttribute('data-fs-winner')){var r=boardRound();fsRound=r===nextOpenRound()?null:r;editingRound=r;selectMatchWinner(Number(b.getAttribute('data-fs-table')),Number(b.getAttribute('data-fs-winner')))}
}
// Commander dialog: card image plus Oracle text loaded from Scryfall (cached per card name).
var oracleCache={};
function oracleHTML(card){var faces=card.card_faces&&!card.oracle_text?card.card_faces:[card];return faces.map(function(f){return '<div class="oracle-face">'+(faces.length>1?'<strong>'+esc(f.name||'')+'</strong>':'')+'<p class="oracle-type">'+esc(f.type_line||'')+(f.mana_cost?' · '+esc(f.mana_cost):'')+'</p>'+String(f.oracle_text||'').split('\n').filter(Boolean).map(function(l){return '<p>'+esc(l)+'</p>'}).join('')+(f.power!=null?'<p class="oracle-pt">'+esc(f.power)+' / '+esc(f.toughness)+'</p>':f.loyalty!=null?'<p class="oracle-pt">Loyalität '+esc(f.loyalty)+'</p>':'')+'</div>'}).join('')}
function loadOracle(name){
 var show=function(html){Array.prototype.forEach.call(el('modalContent').querySelectorAll('.cmd-oracle'),function(box){if(box.getAttribute('data-name')===name)box.innerHTML=html})};
 if(oracleCache[name]){show(oracleCache[name]);return}
 fetch('https://api.scryfall.com/cards/named?exact='+encodeURIComponent(name),{headers:{Accept:'application/json'}})
 .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
 .then(function(card){oracleCache[name]=oracleHTML(card);show(oracleCache[name])})
 .catch(function(){show('<p class="muted tiny">Regeltext konnte nicht geladen werden. Bist du offline?</p>')});
}
function openCommanderInfo(idx){
 if(!tournament||!tournament.players[idx])return;
 var c=commanderOf(idx),row=rankRows(visibleRounds()).filter(function(x){return x.idx===idx})[0];
 var html='<p class="cmd-info-stats">'+row.place+'. Platz · '+row.wins+' '+(row.wins===1?'Sieg':'Siege')+' · '+row.played+' gespielt'+(row.byes?' · '+row.byes+' '+(row.byes===1?'Pause':'Pausen'):'')+'</p>';
 if(!c)html+='<p class="muted">Für diese Person ist kein Commander hinterlegt. Über „🃏 Commander“ in der Turnierübersicht kannst du einen auswählen.</p>';
 else{var cards=cmdCards(c);html+='<div class="cmd-info-grid'+(cards.length>1?' duo':'')+'">'+cards.map(function(x){return '<div class="cmd-info">'+(x.image?'<img class="cmd-info-card" src="'+esc(x.image)+'" alt="Karte '+esc(x.name)+'">':'')+'<h3>'+esc(x.name)+'</h3><div class="cmd-oracle" data-name="'+esc(x.name)+'"><p class="muted tiny">Regeltext wird geladen …</p></div>'+(x.artist?'<p class="muted tiny">🎨 '+esc(x.artist)+'</p>':'')+(/^https:\/\/scryfall\.com\//.test(x.uri||'')?'<p class="tiny"><a href="'+esc(x.uri)+'" target="_blank" rel="noopener">Auf Scryfall ansehen ↗</a></p>':'')+'</div>'}).join('')+'</div>'}
 html+='<div class="modal-actions"><button class="btn primary" type="button" id="modalDone">Schließen</button></div>';
 el('modalTitle').textContent=tournament.players[idx];el('modalContent').innerHTML=html;activeModal=null;el('modalBackdrop').classList.remove('hidden');el('modalBackdrop').firstChild.classList.toggle('wide',!!(c&&c.partner));
 cmdCards(c).forEach(function(x){loadOracle(x.name)});
}
el('tourBoard').addEventListener('click',openBoard);
if(DESKTOP_QUERY){var onDesktopChange=function(){if(!isDesktop())closeBoard()};if(DESKTOP_QUERY.addEventListener)DESKTOP_QUERY.addEventListener('change',onDesktopChange);else if(DESKTOP_QUERY.addListener)DESKTOP_QUERY.addListener(onDesktopChange)}
el('fsView').addEventListener('click',onFsClick);
el('rankingBody').addEventListener('click',function(e){var b=e.target.closest('button[data-player]');if(b)openCommanderInfo(Number(b.getAttribute('data-player')))});
document.addEventListener('fullscreenchange',function(){if(!document.fullscreenElement&&fsOpen&&el('modalBackdrop').classList.contains('hidden'))closeBoard()});
// Capture phase: runs before the global Escape handler closes a dialog, so Escape closes the dialog first and the board second.
window.addEventListener('keydown',function(e){if(!fsOpen||!el('modalBackdrop').classList.contains('hidden')||!el('spinOverlay').classList.contains('hidden'))return;if(e.key==='Escape')closeBoard();else if(fsTab==='pairs'&&(e.key==='ArrowUp'||e.key==='ArrowDown')){e.preventDefault();var order=rankRows(visibleRounds()).map(function(x){return x.idx}),k=order.indexOf(fsPlayer);pickPlayer(order[(k+(e.key==='ArrowDown'?1:order.length-1))%order.length])}else if(e.key==='ArrowLeft')boardGo(boardRound()-1);else if(e.key==='ArrowRight')boardGo(boardRound()+1)},true);
