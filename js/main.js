/* Commander Companion VIII.2 — start-up: PWA registration and all event wiring. */
'use strict';

function initPWA(){
 if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
  window.addEventListener('load',function(){navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(function(){})});
 }
}
function initialize(){buildChoices();syncNameFields();loadTournament();syncTourChoice();
el('gameFile').addEventListener('change',loadGameFile);
el('tourFile').addEventListener('change',loadTournamentFile);
el('setupGameImport').addEventListener('click',function(){el('gameFile').click()});
el('setupTourImport').addEventListener('click',openTourLoad);
el('tourExport').addEventListener('click',openTourSave);
el('tourImport').addEventListener('click',openTourLoad);
el('menuFab').addEventListener('click',toggleGameMenu);
el('menuClose').addEventListener('click',closeGameMenu);
el('menuClosePrimary').addEventListener('click',closeGameMenu);
el('gameMenuBackdrop').addEventListener('click',closeGameMenu);
el('menuMode').addEventListener('click',function(){el('mode').click();renderGameMenu()});
el('menuPick').addEventListener('click',function(){el('pick').click();renderGameMenu()});
el('menuDice').addEventListener('click',openDice);
el('modalContent').addEventListener('click',onDiceClick);
el('modalContent').addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target.id==='diceSides'){e.preventDefault();var b=el('modalContent').querySelector('button[data-roll="custom"]');if(b)b.click()}});
el('menuUndo').addEventListener('click',function(){el('undo').click();renderGameMenu()});
el('menuReset').addEventListener('click',function(){closeGameMenu();el('reset').click()});
el('menuTournament').addEventListener('click',function(){closeGameMenu();setTab('tournament')});
el('menuBackupExport').addEventListener('click',saveGameFile);
el('menuBackupImport').addEventListener('click',function(){el('gameFile').click()});
el('menuWake').addEventListener('click',toggleWakeLock);
initPWA();
initializeWakeLock();
if('ResizeObserver' in window){new ResizeObserver(scheduleCardSizing).observe(el('board'))}else window.addEventListener('resize',scheduleCardSizing);
window.addEventListener('orientationchange',scheduleCardSizing);
el('tabLife').addEventListener('click',function(){setTab('life')});el('tabTournament').addEventListener('click',function(){setTab('tournament')});
el('tournamentCount').addEventListener('input',syncNameFields);el('tournamentCount').addEventListener('change',syncNameFields);el('tournamentRounds').addEventListener('input',syncPairingPreview);el('tournamentForm').addEventListener('submit',createTournament);
el('winnerChoices').addEventListener('click',function(e){var play=e.target.closest('button[data-play-table]');if(play){playTournamentMatch(Number(play.getAttribute('data-play-table')));return}var b=e.target.closest('button[data-winner]');if(!b)return;selectMatchWinner(Number(b.getAttribute('data-table')),Number(b.getAttribute('data-winner')))});
el('roundPrev').addEventListener('click',function(){showRound(editingRound-1)});el('roundNext').addEventListener('click',function(){showRound(editingRound+1)});el('roundsList').addEventListener('click',function(e){var btn=e.target.closest('button[data-edit-round]');if(btn)showRound(Number(btn.getAttribute('data-edit-round')))});
el('roundBack').addEventListener('click',function(){var next=nextOpenRound();if(next!==null)showRound(next)});el('tourReset').addEventListener('click',promptTournamentReset);el('tourCsv').addEventListener('click',exportTournamentCsv);el('tourCommanders').addEventListener('click',openCommanderEditor);el('tourReveal').addEventListener('click',toggleReveal);
el('revealStage').addEventListener('click',function(e){if(e.target.closest('#revealGo'))revealRound();else if(e.target.closest('#revealSkip')){stopReveal();renderTournament()}});
document.addEventListener('input',function(e){if(e.target.classList&&e.target.classList.contains('cmd-input'))searchCommanders(e.target)});
document.addEventListener('click',onCommanderClick);
document.addEventListener('keydown',function(e){if(e.key!=='Enter'||!e.target.classList||!e.target.classList.contains('cmd-input'))return;e.preventDefault();var picker=e.target.closest('.cmd-picker');if((cmdResults[picker.getAttribute('data-slot')]||[]).length)pickCommander(picker,0)});el('playerChoices').addEventListener('click',function(e){if(e.target.closest('#choiceTour')){openMatchPicker();return}var b=e.target.closest('button[data-n]');if(b)setChoice(Number(b.getAttribute('data-n')))});
// A real form submit works with both touch and keyboard and does not rely on click handlers.
el('setupForm').addEventListener('submit',beginGame);
el('board').addEventListener('click',onBoardClick);
if(window.PointerEvent){
 el('board').addEventListener('pointerdown',startHold);el('modalContent').addEventListener('pointerdown',startHold);
 document.addEventListener('pointerup',function(e){endHold(e.pointerId)});
 document.addEventListener('pointercancel',function(e){endHold(e.pointerId,true)});
 document.addEventListener('contextmenu',function(e){if(e.target.closest&&e.target.closest(HOLD_BUTTONS))e.preventDefault()});
 window.addEventListener('blur',endAllHolds);document.addEventListener('visibilitychange',function(){if(document.hidden)endAllHolds()});
}
el('mode').addEventListener('click',function(){if(!state)return;state.mode=state.mode==='table'?'standard':'table';store();render();window.scrollTo(0,0)});
el('pick').addEventListener('click',function(){if(!state)return;remember();state.starter=pickRandom(state.players.length);store();render();runStarterSpin()});
el('spinOverlay').addEventListener('click',function(){if(spin&&!spin.landed)spinFinish();else spinClose()});
el('undo').addEventListener('click',function(){if(!undoStack.length)return;state=JSON.parse(undoStack.pop());store();render()});
el('reset').addEventListener('click',newGamePrompt);
el('modalClose').addEventListener('click',closeModal);
el('modalBackdrop').addEventListener('click',function(e){if(e.target===el('modalBackdrop'))closeModal()});
el('modalContent').addEventListener('click',onModalClick);
el('modalContent').addEventListener('change',onNameChange);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&spin){if(!spin.landed)spinFinish();else spinClose();return}if(e.key==='Escape'){if(!el('gameMenu').classList.contains('hidden'))closeGameMenu();else closeModal()}});
if(restore()||migrate())render();else revealSetup()}
initialize();
