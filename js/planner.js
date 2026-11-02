/* Commander Companion VIII.2 — tournament planner (pure functions, no DOM). Loaded directly by tests/load-planner.js. */
'use strict';

function getLayout(n){
 if(n<=4)return {active:n,bye:false,size:n,tables:1};
 if(n===5)return {active:4,bye:true,size:4,tables:1};
 var active=n-(n%2),best=null;
 // Prefer the usual Commander table sizes 4 and 3. If impossible: 5, then 2.
 [4,3,5,2].forEach(function(size){if(active%size!==0||active/size<2)return;if(!best)best={active:active,bye:n%2===1,size:size,tables:active/size}});
 return best;
}
function shuffleCopy(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=pickRandom(i+1),v=a[i];a[i]=a[j];a[j]=v}return a}
function pairId(a,b,n){return Math.min(a,b)*n+Math.max(a,b)}
function groupingScore(groups,hist,previous,n){
 var score=0;
 for(var g=0;g<groups.length;g++){
  var people=groups[g];for(var a=0;a<people.length;a++)for(var b=a+1;b<people.length;b++){
   var id=pairId(people[a],people[b],n),times=hist[id];
   score+=2*times*times+4*times+((previous&&previous.has(id))?6:0);
  }
 }
 return score;
}
function optimizeGroups(active,size,hist,previous,n){
 var best=null,bestScore=Infinity,tries=active.length<=4?1:4;
 for(var attempt=0;attempt<tries;attempt++){
  var members=shuffleCopy(active),groups=[];
  for(var i=0;i<members.length;i+=size)groups.push(members.slice(i,i+size));
  var score=groupingScore(groups,hist,previous,n);
  var loops=active.length<10?180:active.length<20?350:490;
  for(var loop=0;loop<loops;loop++){
   var a=pickRandom(groups.length),b=pickRandom(groups.length-1);if(b>=a)b++;
   var x=pickRandom(size),y=pickRandom(size),v=groups[a][x];groups[a][x]=groups[b][y];groups[b][y]=v;
   var trial=groupingScore(groups,hist,previous,n);
   if(trial<=score||(loop<loops*.65&&Math.random()<Math.exp((score-trial)/(7*(1-loop/loops)+.9))))score=trial;
   else{v=groups[a][x];groups[a][x]=groups[b][y];groups[b][y]=v}
  }
  if(score<bestScore){bestScore=score;best=groups.map(function(g){return g.slice()})}
 }
 return best;
}
// 7 players (2 tables of 3, 1 bye): cyclic design over Z7 with base tables {1,2,4} and {3,5,6}.
// Every block of 7 rounds: each player sits out exactly once and meets every other player exactly twice.
function planSeven(rounds){
 var schedule=[],perm,order;
 for(var r=0;r<rounds;r++){
  if(r%7===0){perm=shuffleCopy([0,1,2,3,4,5,6]);order=shuffleCopy([0,1,2,3,4,5,6]);
   // New block: never let the first bye repeat the last bye of the previous block.
   if(r>0&&perm[order[0]]===schedule[r-1].bye){var tmp=order[0];order[0]=order[1];order[1]=tmp}}
  var k=order[r%7],at=function(d){return perm[(k+d)%7]};
  var tables=shuffleCopy([[at(1),at(2),at(4)],[at(3),at(5),at(6)]]).map(function(m){return {players:shuffleCopy(m),winner:null}});
  schedule.push({bye:at(0),tables:tables});
 }
 return schedule;
}
// general=true skips the fixed 7-player design so the optimizer can compare it with the general planner.
function planTournament(n,rounds,general){
 if(n===7&&!general)return planSeven(rounds);
 var layout=getLayout(n),hist=new Uint16Array(n*n),schedule=[],previous=null;
 var byeOrder=shuffleCopy(Array.from({length:n},function(_,i){return i}));
 for(var r=0;r<rounds;r++){
  if(layout.bye&&r%n===0&&r>0){ // full cycles: exactly even bye counts
   var last=byeOrder[n-1];byeOrder=shuffleCopy(byeOrder);
   // Never let the same person sit out twice in a row across a cycle boundary.
   if(byeOrder[0]===last){var k=1+pickRandom(n-1),t=byeOrder[0];byeOrder[0]=byeOrder[k];byeOrder[k]=t}
  }
  var bye=layout.bye?byeOrder[r%n]:null;
  var active=[];for(var i=0;i<n;i++)if(i!==bye)active.push(i);
  var groups=layout.tables===1?[shuffleCopy(active)]:optimizeGroups(active,layout.size,hist,previous,n);
  var cur=new Set();for(var g=0;g<groups.length;g++)for(var a=0;a<groups[g].length;a++)for(var b=a+1;b<groups[g].length;b++){
   var p=pairId(groups[g][a],groups[g][b],n);hist[p]++;cur.add(p)
  }
  previous=cur;
  schedule.push({bye:bye,tables:groups.map(function(m){return {players:m,winner:null}})});
 }
 return schedule;
}
// Whole-schedule quality, compared lexicographically: most repeated pair, spread of all pairs, back-to-back repeats.
function scheduleCost(schedule,n){
 var hist=new Uint16Array(n*n),previous=null,again=0;
 schedule.forEach(function(round){
  var cur=new Set();round.tables.forEach(function(t){var p=t.players;for(var a=0;a<p.length;a++)for(var b=a+1;b<p.length;b++){var id=pairId(p[a],p[b],n);hist[id]++;cur.add(id);if(previous&&previous.has(id))again++}});
  previous=cur;
 });
 var max=0,min=Infinity,squares=0,total=0;
 for(var a=0;a<n;a++)for(var b=a+1;b<n;b++){var t=hist[a*n+b];if(t>max)max=t;if(t<min)min=t;squares+=t*t;total+=t}
 var avg=total/(n*(n-1)/2);
 return {key:[max,squares,again],ideal:max<=Math.ceil(avg)&&min>=Math.floor(avg)};
}
function betterCost(a,b){for(var i=0;i<a.key.length;i++)if(a.key[i]!==b.key[i])return a.key[i]<b.key[i];return false}
// Plans repeatedly within a time budget and keeps the best schedule; yields between attempts so the page stays responsive.
function planBestTournament(n,rounds,done){
 var deadline=Date.now()+PLAN_BUDGET_MS,best=planTournament(n,rounds),attempt=0;
 if(getLayout(n).tables===1){done(best);return}
 var bestCost=scheduleCost(best,n);
 (function step(){
  if(bestCost.ideal||Date.now()>=deadline){done(best);return}
  // For 7 players, alternate between Sven's fixed design and the general planner; the better schedule wins.
  attempt++;var trial=planTournament(n,rounds,n===7&&attempt%2===1),cost=scheduleCost(trial,n);
  if(betterCost(cost,bestCost)){best=trial;bestCost=cost}
  setTimeout(step,0);
 })();
}
// Commander search via the public Scryfall API. Only card name, artist and image URLs are stored; images load from Scryfall.
