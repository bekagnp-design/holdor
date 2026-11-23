/* Heavy Gold — profile (20_profile.js): the player's name and country (src/gold/GOLD.md).
   - G.beforePlay: PLAY opens the profile screen until a valid name and country exist (a gate set earlier is chained after it,
     a module loading later must chain this one: `const prev = G.beforePlay; G.beforePlay = () => mine() && (!prev || prev() !== false)`).
     After SAVE the screen closes and taps #play again, so every gate runs once more.
   - Name: 3–16 characters, letters (any script), digits, space, _ or -; prefilled from Telegram's first_name when there is one.
   - Country: every ISO 3166-1 alpha-2 code, its flag emoji (regional indicator letters) and English name, with a search field;
     Georgia is suggested at the top only when Telegram's language_code is 'ka'.
   - Saved to localStorage 'hg_profile' {name, country} and, online, to hg_profile_set. When the game comes online
     (G.on('net')), hg_profile_get first: a server profile wins; with none on the server, the local one is sent.
   - Fills G.profile (the same object) and emits G.emit('profile', G.profile). An icon button in #titleLinks edits it:
     .ib #hgMe = <i>flag</i><span>name</span> (👤 "You" with no profile; a red "!" badge when the server refused the name).
   - The screen (UI rules: no explanations): YOU, the name field, the chosen country as a chip, the search + grid, SAVE, Back.
     The name rule ("3–16 letters, digits, _ -") shows only as an error after a bad try.
   - Also public: G.COUNTRIES ([code, name] sorted by name), G.flag(code), G.countryName(code), G.profileUI {open, close, valid, sync}. */
(function () {
  const LS = 'hg_profile';
  const RAW = 'AD:Andorra|AE:United Arab Emirates|AF:Afghanistan|AG:Antigua and Barbuda|AI:Anguilla|AL:Albania|AM:Armenia|AO:Angola|AQ:Antarctica|' +
    'AR:Argentina|AS:American Samoa|AT:Austria|AU:Australia|AW:Aruba|AX:Åland Islands|AZ:Azerbaijan|BA:Bosnia and Herzegovina|BB:Barbados|' +
    'BD:Bangladesh|BE:Belgium|BF:Burkina Faso|BG:Bulgaria|BH:Bahrain|BI:Burundi|BJ:Benin|BL:Saint Barthélemy|BM:Bermuda|BN:Brunei|BO:Bolivia|' +
    'BQ:Caribbean Netherlands|BR:Brazil|BS:Bahamas|BT:Bhutan|BV:Bouvet Island|BW:Botswana|BY:Belarus|BZ:Belize|CA:Canada|CC:Cocos (Keeling) Islands|' +
    'CD:Congo (DRC)|CF:Central African Republic|CG:Congo (Republic)|CH:Switzerland|CI:Côte d’Ivoire|CK:Cook Islands|CL:Chile|CM:Cameroon|CN:China|' +
    'CO:Colombia|CR:Costa Rica|CU:Cuba|CV:Cape Verde|CW:Curaçao|CX:Christmas Island|CY:Cyprus|CZ:Czechia|DE:Germany|DJ:Djibouti|DK:Denmark|' +
    'DM:Dominica|DO:Dominican Republic|DZ:Algeria|EC:Ecuador|EE:Estonia|EG:Egypt|EH:Western Sahara|ER:Eritrea|ES:Spain|ET:Ethiopia|FI:Finland|' +
    'FJ:Fiji|FK:Falkland Islands|FM:Micronesia|FO:Faroe Islands|FR:France|GA:Gabon|GB:United Kingdom|GD:Grenada|GE:Georgia|GF:French Guiana|' +
    'GG:Guernsey|GH:Ghana|GI:Gibraltar|GL:Greenland|GM:Gambia|GN:Guinea|GP:Guadeloupe|GQ:Equatorial Guinea|GR:Greece|' +
    'GS:South Georgia and the South Sandwich Islands|GT:Guatemala|GU:Guam|GW:Guinea-Bissau|GY:Guyana|HK:Hong Kong|HM:Heard and McDonald Islands|' +
    'HN:Honduras|HR:Croatia|HT:Haiti|HU:Hungary|ID:Indonesia|IE:Ireland|IL:Israel|IM:Isle of Man|IN:India|IO:British Indian Ocean Territory|IQ:Iraq|' +
    'IR:Iran|IS:Iceland|IT:Italy|JE:Jersey|JM:Jamaica|JO:Jordan|JP:Japan|KE:Kenya|KG:Kyrgyzstan|KH:Cambodia|KI:Kiribati|KM:Comoros|' +
    'KN:Saint Kitts and Nevis|KP:North Korea|KR:South Korea|KW:Kuwait|KY:Cayman Islands|KZ:Kazakhstan|LA:Laos|LB:Lebanon|LC:Saint Lucia|' +
    'LI:Liechtenstein|LK:Sri Lanka|LR:Liberia|LS:Lesotho|LT:Lithuania|LU:Luxembourg|LV:Latvia|LY:Libya|MA:Morocco|MC:Monaco|MD:Moldova|' +
    'ME:Montenegro|MF:Saint Martin|MG:Madagascar|MH:Marshall Islands|MK:North Macedonia|ML:Mali|MM:Myanmar|MN:Mongolia|MO:Macao|' +
    'MP:Northern Mariana Islands|MQ:Martinique|MR:Mauritania|MS:Montserrat|MT:Malta|MU:Mauritius|MV:Maldives|MW:Malawi|MX:Mexico|MY:Malaysia|' +
    'MZ:Mozambique|NA:Namibia|NC:New Caledonia|NE:Niger|NF:Norfolk Island|NG:Nigeria|NI:Nicaragua|NL:Netherlands|NO:Norway|NP:Nepal|NR:Nauru|' +
    'NU:Niue|NZ:New Zealand|OM:Oman|PA:Panama|PE:Peru|PF:French Polynesia|PG:Papua New Guinea|PH:Philippines|PK:Pakistan|PL:Poland|' +
    'PM:Saint Pierre and Miquelon|PN:Pitcairn Islands|PR:Puerto Rico|PS:Palestine|PT:Portugal|PW:Palau|PY:Paraguay|QA:Qatar|RE:Réunion|' +
    'RO:Romania|RS:Serbia|RU:Russia|RW:Rwanda|SA:Saudi Arabia|SB:Solomon Islands|SC:Seychelles|SD:Sudan|SE:Sweden|SG:Singapore|SH:Saint Helena|' +
    'SI:Slovenia|SJ:Svalbard and Jan Mayen|SK:Slovakia|SL:Sierra Leone|SM:San Marino|SN:Senegal|SO:Somalia|SR:Suriname|SS:South Sudan|' +
    'ST:São Tomé and Príncipe|SV:El Salvador|SX:Sint Maarten|SY:Syria|SZ:Eswatini|TC:Turks and Caicos Islands|TD:Chad|' +
    'TF:French Southern Territories|TG:Togo|TH:Thailand|TJ:Tajikistan|TK:Tokelau|TL:Timor-Leste|TM:Turkmenistan|TN:Tunisia|TO:Tonga|' +
    'TR:Türkiye|TT:Trinidad and Tobago|TV:Tuvalu|TW:Taiwan|TZ:Tanzania|UA:Ukraine|UG:Uganda|UM:U.S. Outlying Islands|US:United States|' +
    'UY:Uruguay|UZ:Uzbekistan|VA:Vatican City|VC:Saint Vincent and the Grenadines|VE:Venezuela|VG:British Virgin Islands|' +
    'VI:U.S. Virgin Islands|VN:Vietnam|VU:Vanuatu|WF:Wallis and Futuna|WS:Samoa|YE:Yemen|YT:Mayotte|ZA:South Africa|ZM:Zambia|ZW:Zimbabwe';
  /* other names people search for */
  const ALIAS = { TR: 'turkey', CZ: 'czech republic', CI: 'ivory coast', SZ: 'swaziland', MM: 'burma', NL: 'holland', GB: 'uk great britain britain england scotland wales northern ireland',
    US: 'usa america united states of america', MK: 'macedonia', CV: 'cabo verde', TL: 'east timor', VA: 'holy see', CD: 'democratic republic kinshasa drc', CG: 'brazzaville',
    AE: 'uae emirates', RU: 'russian federation', KR: 'korea', KP: 'korea dprk', BQ: 'bonaire saba sint eustatius', FK: 'malvinas', PS: 'gaza west bank', BN: 'brunei darussalam' };
  const COUNTRIES = RAW.split('|').map(s => [s.slice(0, 2), s.slice(3)]).sort((a, b) => a[1].localeCompare(b[1], 'en'));
  const CC = {}; for (const [c, n] of COUNTRIES) CC[c] = n;
  const flag = c => /^[A-Z]{2}$/.test(String(c || '')) ? String.fromCodePoint(...[...c].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65)) : '';
  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').toLowerCase();
  G.COUNTRIES = COUNTRIES; G.flag = flag; G.countryName = c => CC[c] || '';

  /* ---- the name rules ---- */
  const OK_CH = /^[\p{L}\p{M}\p{Nd} _-]+$/u, BAD_CH = /[^\p{L}\p{M}\p{Nd} _-]/gu;
  const tidy = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const nlen = s => [...s].length;
  const valid = s => { const n = tidy(s); return nlen(n) >= 3 && nlen(n) <= 16 && OK_CH.test(n); };
  const cleanName = s => tidy([...tidy(String(s || '').replace(BAD_CH, ''))].slice(0, 16).join(''));
  const MSG = { name_taken: 'Name taken', bad_name: '3–16 letters, digits, _ -', bad_country: 'Pick a country' };

  const tgUser = () => { try { const u = G.TG && G.TG.initDataUnsafe && G.TG.initDataUnsafe.user; return u || null; } catch (e) { return null; } };
  const read = () => { try { const o = JSON.parse(localStorage.getItem(LS) || 'null'); if (o && valid(o.name) && CC[o.country]) return { name: tidy(o.name), country: o.country }; } catch (e) {} return null; };
  const write = p => { try { localStorage.setItem(LS, JSON.stringify({ name: p.name, country: p.country })); } catch (e) {} };
  let needFix = '';    // the server refused the local profile when it synced ('name_taken' …): PLAY asks again
  const has = () => !!(G.profile && valid(G.profile.name) && CC[G.profile.country]);
  const apply = (name, country) => {
    G.profile = G.profile || {}; G.profile.name = tidy(name); G.profile.country = country; write(G.profile);
    paintBtn(); try { G.emit('profile', G.profile); } catch (e) {}
  };

  /* ---- styles ---- */
  const css = document.createElement('style');
  css.textContent = [
    '.hgScr{background:var(--bg,#070c16);z-index:20}',
    '.hgP{flex:1 1 auto;min-height:0;width:min(100%,640px);display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto;grid-template-areas:"head" "list" "foot";gap:10px}',
    '.hgPhead{grid-area:head;display:flex;flex-direction:column;gap:6px}',
    '.hgPlist{grid-area:list;display:flex;flex-direction:column;gap:6px;min-height:0}',
    '.hgPfoot{grid-area:foot;display:flex;flex-direction:column;align-items:center;gap:8px}',
    '.hgH{margin:0;font:900 20px/1.2 Georgia,serif;letter-spacing:.08em;color:var(--gold,#e8b84a);text-align:center}',
    '.hgIn{width:100%;min-height:48px;border-radius:12px;border:2px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);color:var(--ink,#f3e7c4);font:700 18px Georgia,serif;padding:0 14px;outline:none;user-select:text;-webkit-user-select:text;touch-action:manipulation}',
    '.hgIn:focus{border-color:var(--gold,#e8b84a)}.hgIn::placeholder{color:#6f7d92;font-weight:400}',
    '.hgMsg{font:700 13px/1.3 Georgia,serif;color:#ff8a7a;text-align:center}.hgMsg:empty{display:none}',
    '.hgSel{align-self:center;display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:4px 12px;border-radius:999px;border:2px solid var(--gold,#e8b84a);background:rgba(232,184,74,.12);font:700 15px/1.3 Georgia,serif;color:var(--ink,#f3e7c4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hgSel:empty{display:none}',
    '.hgList{flex:1 1 auto;min-height:92px;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;align-content:start;padding:2px;border-radius:12px}',
    '.hgC{min-height:44px;display:flex;align-items:center;gap:8px;text-align:left;border-radius:10px;border:2px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:var(--ink,#f3e7c4);font:14px/1.2 Georgia,serif;padding:4px 8px;cursor:pointer;touch-action:pan-y}',
    '.hgC .f{font-size:22px;line-height:1;flex:none}.hgC.sel{border-color:var(--gold,#e8b84a);background:rgba(232,184,74,.16)}.hgC[hidden],.hgLbl[hidden]{display:none}',
    '.hgLbl{grid-column:1/-1;font:12px Georgia,serif;color:var(--muted,#8d9bb0);letter-spacing:.08em;text-transform:uppercase;padding:4px 2px 0}',
    '.hgNone{grid-column:1/-1;font:14px Georgia,serif;color:var(--muted,#8d9bb0);text-align:center;padding:12px}',
    '#hgMe.bad::after{content:"!";position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#e0483a;color:#fff;font:900 12px/18px Georgia,serif;text-align:center}',
    '@media (orientation:landscape) and (max-height:540px){.hgP{grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);grid-template-rows:auto minmax(0,1fr);grid-template-areas:"head list" "foot list";gap:8px 16px}.hgH{font-size:18px}.hgPfoot{justify-content:flex-start}}'
  ].join('\n');
  document.head.appendChild(css);

  /* ---- the screen ---- */
  const scr = document.createElement('div'); scr.className = 'scr hgScr'; scr.id = 'hgProf';
  scr.innerHTML = '<div class="hgP"><div class="hgPhead"><h2 class="hgH">YOU</h2>' +
    '<input id="hgName" class="hgIn" type="text" maxlength="16" autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" enterkeyhint="done" placeholder="Name" aria-label="Name">' +
    '<div class="hgMsg" id="hgPErr" role="alert"></div><div class="hgSel" id="hgSel"></div></div>' +
    '<div class="hgPlist"><input id="hgSearch" class="hgIn" type="search" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search" placeholder="🔍 Country" aria-label="Search a country">' +
    '<div class="hgList" id="hgList"></div></div>' +
    '<div class="hgPfoot"><button class="pri" id="hgSave">SAVE</button><button class="sec" id="hgBack">Back</button></div></div>';
  document.body.appendChild(scr);
  const $q = id => scr.querySelector('#' + id);
  const nameIn = $q('hgName'), searchIn = $q('hgSearch'), list = $q('hgList'), errEl = $q('hgPErr'), selEl = $q('hgSel'), saveB = $q('hgSave'), backB = $q('hgBack');
  /* the core's keydown (space / J = skill, WASD) must not eat the letters typed here */
  for (const el of [nameIn, searchIn]) for (const t of ['keydown', 'keyup', 'keypress']) el.addEventListener(t, e => e.stopPropagation());

  let sel = '', pendingPlay = false, busy = false, touched = false, built = false;
  const suggestGE = () => { const u = tgUser(); return !!(u && String(u.language_code || '').toLowerCase().split(/[-_]/)[0] === 'ka'); };
  const mkBtn = (c, n, extra) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'hgC' + (extra ? ' ' + extra : ''); b.dataset.cc = c;
    const f = document.createElement('span'); f.className = 'f'; f.textContent = flag(c); const t = document.createElement('span'); t.textContent = n; b.append(f, t);
    b._k = fold(n + ' ' + c + ' ' + (ALIAS[c] || '')); return b; };
  function build() {
    if (built) return; built = true; list.textContent = '';
    if (suggestGE()) {
      const l1 = document.createElement('div'); l1.className = 'hgLbl hgSugL'; l1.textContent = 'Suggested'; list.appendChild(l1);
      list.appendChild(mkBtn('GE', CC.GE, 'hgSug'));
      const l2 = document.createElement('div'); l2.className = 'hgLbl hgSugL'; l2.textContent = 'All'; list.appendChild(l2);
    }
    for (const [c, n] of COUNTRIES) list.appendChild(mkBtn(c, n));
    const none = document.createElement('div'); none.className = 'hgNone'; none.id = 'hgNone'; none.hidden = true; none.textContent = 'No match'; list.appendChild(none);
  }
  list.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.hgC'); if (!b) return; pick(b.dataset.cc); });
  function pick(c) {
    if (!CC[c]) return; sel = c; touched = true;
    for (const b of list.querySelectorAll('.hgC')) b.classList.toggle('sel', b.dataset.cc === c);
    paintSel(); if (errEl.dataset.code === 'bad_country') msg('');
  }
  /* the chosen country as a chip; nothing before one is picked */
  function paintSel() { selEl.textContent = sel ? flag(sel) + ' ' + CC[sel] : ''; }
  function filter() {
    const q = fold(tidy(searchIn.value)); let n = 0;
    for (const b of list.querySelectorAll('.hgC')) { const show = !q ? true : (b.classList.contains('hgSug') ? false : (b._k.indexOf(q) >= 0)); b.hidden = !show; if (show && !b.classList.contains('hgSug')) n++; }
    for (const l of list.querySelectorAll('.hgSugL')) l.hidden = !!q;
    const none = list.querySelector('#hgNone'); if (none) none.hidden = n > 0;
    return n;
  }
  searchIn.addEventListener('input', () => { filter(); list.scrollTop = 0; });
  searchIn.addEventListener('keydown', e => { if (e.key === 'Enter') { const vis = [...list.querySelectorAll('.hgC:not(.hgSug)')].filter(b => !b.hidden); if (vis.length === 1) pick(vis[0].dataset.cc); searchIn.blur(); } });
  nameIn.addEventListener('input', () => { touched = true; if (errEl.classList.contains('bad') && errEl.dataset.code !== 'bad_country') msg(''); });
  nameIn.addEventListener('keydown', e => { if (e.key === 'Enter') nameIn.blur(); });
  function msg(code, text) {
    errEl.dataset.code = code || '';
    if (!code) { errEl.classList.remove('bad'); errEl.textContent = ''; return; }
    errEl.classList.add('bad'); errEl.textContent = text || MSG[code] || 'Not saved · try again';
  }

  function open(forPlay) {
    build(); pendingPlay = !!forPlay; busy = false; touched = false; saveB.disabled = false; saveB.textContent = 'SAVE';
    const p = has() ? G.profile : read();
    const u = tgUser();
    nameIn.value = p ? p.name : (u && u.first_name ? cleanName(u.first_name) : '');
    sel = p && CC[p.country] ? p.country : '';
    for (const b of list.querySelectorAll('.hgC')) b.classList.toggle('sel', b.dataset.cc === sel);
    searchIn.value = ''; filter(); paintSel(); msg(needFix ? needFix : '');
    scr.classList.add('on');
    list.scrollTop = 0;
    if (sel) { const b = list.querySelector('.hgC:not(.hgSug)[data-cc="' + sel + '"]'); if (b) { try { list.scrollTop = Math.max(0, b.offsetTop - list.offsetTop - list.clientHeight / 2 + b.offsetHeight / 2); } catch (e) {} } }
  }
  function close() { scr.classList.remove('on'); try { nameIn.blur(); searchIn.blur(); } catch (e) {} pendingPlay = false; }

  async function save() {
    if (busy) return;
    const name = tidy(nameIn.value);
    if (!valid(name)) { msg('bad_name'); return; }
    if (!CC[sel]) { msg('bad_country'); return; }
    const country = sel, go = pendingPlay;
    busy = true; saveB.disabled = true; saveB.textContent = 'SAVING…';
    let res = null, online = false;
    try { if (G.net && G.TG) online = await G.net.login(); } catch (e) { online = false; }
    if (online) res = await G.net.rpc('hg_profile_set', { token: null, name, country });
    busy = false; saveB.disabled = false; saveB.textContent = 'SAVE';
    if (res && res.error) { msg(res.error); return; }
    if (res && res.ok) { needFix = ''; apply(res.name || name, CC[res.country] ? res.country : country); }
    else { needFix = ''; apply(name, country); if (online) G.toast('Offline · saved on this phone', 2400); }
    close();
    if (go) { const b = G.$('play'); if (b) b.click(); }
  }
  saveB.addEventListener('click', save);
  backB.addEventListener('click', close);

  /* ---- the title button ---- */
  const btn = document.createElement('button'); btn.className = 'ib'; btn.id = 'hgMe'; btn.type = 'button';
  const btnI = document.createElement('i'), btnS = document.createElement('span'); btn.append(btnI, btnS);
  function paintBtn() {
    const ok = has();
    btnI.textContent = ok ? (flag(G.profile.country) || '👤') : '👤'; btnS.textContent = ok ? G.profile.name : 'You';
    btn.classList.toggle('bad', !!(ok && needFix));
    btn.setAttribute('aria-label', ok ? (needFix ? (MSG[needFix] || 'Name refused') + ': ' : '') + G.profile.name + ' · ' + G.countryName(G.profile.country) : 'Name & country');
  }
  btn.addEventListener('click', () => open(false));
  const links = G.$('titleLinks'); if (links) links.appendChild(btn);

  /* ---- the gate ---- */
  const prevGate = G.beforePlay;
  G.beforePlay = () => {
    if (!has() || needFix) { open(true); return false; }
    return typeof prevGate === 'function' ? prevGate() : true;
  };

  /* ---- sync when the game is online: the server's profile wins; with none there, the local one goes up ---- */
  let syncing = null;
  function sync() {
    if (syncing) return syncing;
    syncing = (async () => {
      if (!G.net || !G.net.on) return false;
      const r = await G.net.rpc('hg_profile_get', { token: null });
      if (!r || typeof r !== 'object' || r.error) return false;
      if (r.name && CC[r.country]) {
        needFix = ''; apply(r.name, r.country);
        if (scr.classList.contains('on') && !touched && !busy) { nameIn.value = G.profile.name; pick(G.profile.country); touched = false; }
        return true;
      }
      const loc = has() ? { name: G.profile.name, country: G.profile.country } : read();
      if (!loc) return false;
      const s = await G.net.rpc('hg_profile_set', { token: null, name: loc.name, country: loc.country });
      if (s && s.ok) { needFix = ''; apply(s.name || loc.name, CC[s.country] ? s.country : loc.country); return true; }
      if (s && s.error) { needFix = s.error; paintBtn(); if (!(G.S && !G.S.over)) G.toast('⚠️ ' + (MSG[s.error] || 'Name refused') + ' · tap your name', 3000); }
      return false;
    })().catch(() => false).then(v => { syncing = null; return v; });
    return syncing;
  }
  G.on('net', on => { if (on) sync(); });
  G.on('title', paintBtn);

  /* ---- start ---- */
  const p0 = read(); if (p0) { G.profile = G.profile || {}; G.profile.name = p0.name; G.profile.country = p0.country; }
  paintBtn();
  if (G.net && G.net.on) sync();
  G.profileUI = { open, close, valid, sync, get needFix() { return needFix; } };
})();
