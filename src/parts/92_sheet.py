# v1.0.89 — a cleaner item sheet and a tower menu that says SELL.
# The item sheet: the item large, its name and +level, rarity and tier stars, a level bar, the stats as chips, the set in one line;
# one gold UPGRADE button (the chance and the price small under it), Equip and Sell side by side, ✕ to close. "Strike" is gone
# everywhere (upgrade). The battle's tower ring: the sell button shows SELL under the bag, not just a bag.
i = s.find('function gearSheet(id,cid,filter){'); j = s.find('/* which item to burn for the tier'); assert 0 < i < j, 'gearSheet'
s = s[:i] + r'''function gearSheet(id,cid,filter){const it=gearItems().find(x=>x.id===id);if(!it)return;const R=GEAR_RAR[it.r],S=GEAR_SET[it.set],C=gearCfg(),sb=(C&&C.sets[it.set])||{};
  const worn=it.champ===cid,cost=gearCost(it),ch=gearChance(it),cap=gearCap(it),atCap=it.lvl>=cap,t=gearTier(it),tcost=gearTierCost(it),k=gearKind(it);
  const steps=Object.keys(sb).filter(x=>/^\d+$/.test(x)).sort().map(x=>`<span><i>${x}</i>${gearBonusText(sb[x])}</span>`).join('')+(sb.stack?'<span><i>↻</i>repeats</span>':'');
  const html=`<div class="gsheet gs2" style="--gc:${R[1]}">${gearBig(it)}
    <div class="gsn"><b>${S[1]} ${k[0]}</b>${it.lvl?`<em>+${it.lvl}</em>`:''}</div>
    <div class="gsr"><span class="gsrar">${R[0]}</span><span class="gtr">${'★'.repeat(t)}<s>${'★'.repeat(5-t)}</s></span></div>
    <div class="gsbar"><i style="width:${Math.round(100*Math.min(it.lvl,cap)/Math.max(1,cap))}%"></i><small>Level ${it.lvl} / ${cap}</small></div>
    <div class="gst"><em>${gearLine(it.main.k,it.main.v)}</em>${(it.subs||[]).map(x=>`<span>${gearLine(x.k,x.v).replace(/\s*\(.*?\)\s*$/,'')}</span>`).join('')}</div>
    ${(it.perks&&it.perks.length)?`<div class="gperk">${it.perks.map(p=>`<span>${gearPerkText(p,gearPerkRank(it))}</span>`).join('')}</div>`:''}
    <div class="gsset"><b>${S[0]} ${S[1]} set</b>${steps}</div>
    ${atCap?`<small class="gsnote">${t<5?'At its cap: raise the tier to go on':'Fully forged: tier 5, +20'}</small>`:''}</div>`;
  ecoModal('',html,[
    !atCap?{t:`<span class="bt">⚒️ Upgrade to +${it.lvl+1}</span><small>${ch}% chance · 🪙${cost}</small>`,dis:goldOf()<cost,f:()=>gearUpgrade(it.id,cid,filter)}:null,
    atCap&&t<5?{t:`<span class="bt">⬆ Tier ${t+1}</span><small>🪙${tcost} + one ${R[0]} item</small>`,dis:goldOf()<tcost,f:()=>gearTierPick(it.id,cid,filter)}:null,
    {t:worn?'Take off':`Equip · ${esc(shortName(CBY[cid]))}`,f:()=>gearEquip(it.id,worn?null:cid,cid,filter)},
    {t:`Sell · 🪙${gearSellPrice(it)}`,f:()=>ecoModal('Sell it?',`${gearName(it)} for 🪙${gearSellPrice(it)}. This cannot be undone.`,[{t:'Sell',f:()=>gearSell(it.id,cid,filter)},{t:'Keep',f:()=>gearSheet(id,cid,filter)}])},
    {t:'✕'}].filter(Boolean));
  const em=document.querySelector('#ecoModal .em');if(em)em.classList.add('gsm');}
''' + s[j:]
rep('Gear drops from battles, the Hold, chests and daily gifts. Strike at the anvil — a failed strike costs the gold, never the item. A tier ★ opens four more levels.', 'Upgrade at the anvil: a failed try costs gold, never the item.', 1, 'forge-intro')
rep('ecoToast(`The strike failed — ', 'ecoToast(`Upgrade failed — ', 1, 'fail-toast')
rep("if(it.act==='sell')return `<span class=\"em\">💰</span><span class=\"rp\">+${sellValue(t)}</span>`;",
    "if(it.act==='sell')return `<span class=\"em sm\">💰</span><b class=\"rw\">SELL</b><span class=\"rp\">+${sellValue(t)}</span>`;", 1, 'ring-sell')
rep("\n</style>\n</head>", """
/* v1.0.89: the item sheet */
#ecoModal .em.gsm{position:relative;background:linear-gradient(180deg,#2a2219,#17120d);border-color:#0a0806;padding-top:12px}
#ecoModal .em.gsm h3:empty{display:none}
.gs2{gap:4px}
.gs2 .gbig{margin:2px auto 6px}
.gs2 .gsn{display:flex;align-items:baseline;gap:6px;justify-content:center}
.gs2 .gsn b{font-size:20px;color:var(--gc);text-shadow:0 2px 0 rgba(0,0,0,.6)}
.gs2 .gsn em{font-style:normal;font:900 15px var(--f-display);color:#ffe08a}
.gs2 .gsr{display:flex;gap:8px;align-items:center;justify-content:center}
.gs2 .gsrar{font:900 10px var(--f-display);letter-spacing:1.2px;text-transform:uppercase;color:#1a120a;background:var(--gc);border-radius:6px;padding:2px 7px}
.gs2 .gtr{font-size:14px;letter-spacing:1px;color:#ffd54a}.gs2 .gtr s{text-decoration:none;color:rgba(255,255,255,.18)}
.gs2 .gsbar{position:relative;width:78%;height:14px;border-radius:8px;background:#0e0a07;box-shadow:inset 0 1px 3px rgba(0,0,0,.8);overflow:hidden;margin:4px 0}
.gs2 .gsbar i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(180deg,#ffe08a,#c98a22)}
.gs2 .gsbar small{position:relative;display:block;font:900 9.5px/14px var(--f-display);color:#fff;text-shadow:0 1px 1px #000}
.gs2 .gst{display:flex;flex-wrap:wrap;gap:5px;justify-content:center}
.gs2 .gst em,.gs2 .gst span{font-style:normal;border-radius:8px;padding:3px 8px;background:rgba(255,255,255,.07);font-size:12px;color:#e9dcc4}
.gs2 .gst em{font:900 14px var(--f-display);background:rgba(255,213,74,.14);color:#fff}
.gs2 .gsset{display:flex;flex-wrap:wrap;gap:4px 8px;justify-content:center;font-size:11px;color:#b8a888;margin-top:2px}
.gs2 .gsset b{color:#d8c8a8;font-family:inherit;font-weight:700}
.gs2 .gsset span i{font-style:normal;color:#ffd54a;margin-right:3px}
.gs2 .gsnote{font-size:11px;color:#ffd54a}
#ecoModal .em.gsm .eb{display:grid;grid-template-columns:1fr 1fr;gap:7px}
#ecoModal .em.gsm .eb button{min-height:40px;font-size:13px}
#ecoModal .em.gsm .eb button:first-child:not(.sec){grid-column:1/3;min-height:54px;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1}
#ecoModal .em.gsm .eb button .bt{font-size:17px}
#ecoModal .em.gsm .eb button small{font-size:11px;font-weight:700;opacity:.75;margin-top:2px}
#ecoModal .em.gsm .eb button.sec{background:#3a2e22;color:#efe2c8;border-color:#0a0806}
#ecoModal .em.gsm .eb button:last-child{position:absolute;top:8px;right:8px;width:34px;height:34px;min-height:34px;padding:0;border-radius:50%;font-size:16px;line-height:1}
/* v1.0.89: SELL on the tower ring */
#ring .rb .em.sm{font-size:20px;margin-top:-8px}
#ring .rb .rw{position:absolute;left:0;right:0;top:33px;text-align:center;font:900 10.5px/1 var(--f-display);letter-spacing:.8px;color:#ffe9b0;text-shadow:0 1px 0 #0b1a2e,0 0 3px #000;pointer-events:none}
</style>
</head>""", 1, 'sheet-css')
