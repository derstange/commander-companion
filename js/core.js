/* Commander Companion VIII.2 — shared helpers used by every module. Plain scripts share one global scope (loaded in order by index.html). */
'use strict';

function el(id){return document.getElementById(id)}
function limit(number,min,max){return Math.min(max,Math.max(min,number))}
function esc(value){return String(value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function pickRandom(max){if(max<1)return 0;try{if(window.crypto && window.crypto.getRandomValues){var a=new Uint32Array(1);var ceiling=Math.floor(4294967296/max)*max;do{window.crypto.getRandomValues(a)}while(a[0]>=ceiling);return a[0]%max}}catch(e){}return Math.floor(Math.random()*max)}
