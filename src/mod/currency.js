/* =========================== THE CURRENCIES, REDRAWN (v1.0.83) ===========================
   Gold is a "gold dragon" coin: a thick rim, a dragon's head struck in relief, a shine. Dragonglass is what the name says — a black
   obsidian shard with a cold violet-teal glint — instead of a blue diamond that belonged to no world. The emoji 💎 and 🪙 in the
   game's texts become the same two drawings as they appear on screen (a MutationObserver; text inputs and the battle canvas are left alone). */
const CUR_GOLD='<svg viewBox="0 0 24 24"><defs><radialGradient id="hgC" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#fff2a8"/><stop offset=".45" stop-color="#f4c242"/><stop offset="1" stop-color="#b8741a"/></radialGradient><linearGradient id="hgR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#8a4f0e"/></linearGradient></defs>'+
 '<circle cx="12" cy="12" r="10.6" fill="url(#hgR)" stroke="#5a3006" stroke-width="1"/><circle cx="12" cy="12" r="8.3" fill="url(#hgC)" stroke="#9a5e14" stroke-width=".8"/>'+
 '<path d="M7.4 17.4 7.9 10.6 6.5 6.6l3 2.2 2.5-.9 1-2.9.9 3.1 1.9 1 2.9 1.4 .4 1.3-2.8.6 2.3 1.9-.5.4-3.3-.9-1.6 1.6-.4 2.3z" fill="#9a5a0c" stroke="#5a3006" stroke-width=".55" stroke-linejoin="round"/>'+
 '<path d="M9.4 12.4c1-.5 2-.5 2.9.2M9.2 14.6c1-.4 1.9-.3 2.6.3" fill="none" stroke="#6a3a06" stroke-width=".5" stroke-linecap="round"/>'+
 '<circle cx="14.5" cy="10.3" r=".6" fill="#fff2a8"/><path d="M6.2 9.2a6.6 6.6 0 0 1 3.4-3.1" fill="none" stroke="#fffbe0" stroke-width="1.3" stroke-linecap="round" opacity=".9"/></svg>';
const CUR_GEM='<svg viewBox="0 0 24 24"><defs><linearGradient id="hdA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a2f5a"/><stop offset=".55" stop-color="#14101f"/><stop offset="1" stop-color="#05040a"/></linearGradient><linearGradient id="hdB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7ff0ff"/><stop offset="1" stop-color="#b47cff"/></linearGradient></defs>'+
 '<path d="M12.6 1.6 18.4 8l-1.9 12.2-5.2 2.4-4.7-4.6L5.2 7.8z" fill="url(#hdA)" stroke="#0b0812" stroke-width="1.1" stroke-linejoin="round"/>'+
 '<path d="M12.6 1.6 11.3 9.4l5.2 10.8M11.3 9.4 5.2 7.8M11.3 9.4 6.6 18" fill="none" stroke="#5a4a8a" stroke-width=".7"/>'+
 '<path d="M12.6 1.6 18.4 8M18.4 8l-1.9 12.2" fill="none" stroke="url(#hdB)" stroke-width="1.2" stroke-linecap="round"/>'+
 '<path d="M8.3 6.4 11.3 9.4" stroke="#c9b8ff" stroke-width=".9" stroke-linecap="round" opacity=".85"/><circle cx="13.2" cy="4.4" r=".9" fill="#e6fbff"/></svg>';
/* the two emoji in text become the drawings */
const CUR_RE=/(💎|🪙)/u;
function curSwap(root){if(!root)return;const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>{const p=n.parentNode;if(!p||p.closest&&p.closest('textarea,input,script,style,.cic,svg'))return NodeFilter.FILTER_REJECT;return CUR_RE.test(n.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP;}});
  const list=[];while(walk.nextNode())list.push(walk.currentNode);
  for(const n of list){const parts=n.nodeValue.split(/(💎|🪙)/u);if(parts.length<2)continue;const f=document.createDocumentFragment();
    for(const p of parts){if(p==='💎'||p==='🪙'){const s=document.createElement('span');s.className='cic';s.innerHTML=p==='💎'?CUR_GEM:CUR_GOLD;f.appendChild(s);}else if(p)f.appendChild(document.createTextNode(p));}
    n.parentNode.replaceChild(f,n);}}
function curWatch(){if(curWatch.on||typeof MutationObserver==='undefined')return;curWatch.on=true;curSwap(document.body);
  new MutationObserver(ms=>{for(const m of ms){if(m.type==='characterData'){if(CUR_RE.test(m.target.nodeValue||''))curSwap(m.target.parentNode);continue;}
    for(const a of m.addedNodes){if(a.nodeType===1)curSwap(a);else if(a.nodeType===3&&CUR_RE.test(a.nodeValue)&&a.parentNode)curSwap(a.parentNode);}}}).observe(document.body,{childList:true,subtree:true,characterData:true});}
setTimeout(curWatch,0);   /* after the whole script has run */
