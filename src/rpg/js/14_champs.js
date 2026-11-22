/* =========================== HOLDOR RPG — the 49 champions = the heroes (A10) ===========================
   Addendum 2: the player IS one of his unlocked champions (one hero, permadeath); a new account starts with R.champs.first(house).
   R.data.champs      the 49 champions of the seven houses: house, names, type → cls, rarity, role, base stats, one signature skill, how to unlock
   R.data.champKits   the old three-skill kits by champion id (sk1, sk2, ultimate) — the signature is the old ultimate
   R.data.champSkills the old game's 100 skills (n, e, v by rank, cd, ult) — data only, no battle code
   R.data.sigMap      every one of the 100 skill ids → an RPG effect kind + scale numbers (A13 may add the signature as a 4th hero skill)
   R.champs           cls, heroBase, first, unlock/unlockText, statsAt, byHouse, unlockCost, import/toAcc, sigEffect/sigAt, rankAt, get, list, refAtk/refHp/refDef, kinds, types
   Nothing here runs at load beyond building tables; nothing depends on another module. */
window.R = window.R || {};
(function () {
  R.data = R.data || {};
  /* ---------- houses (seat, colour) — registered only when no other module did ---------- */
  const HOUSES = {
    stark: { n: 'Stark', e: '🐺', words: 'Winter is coming', col: '#a9bdd0', col2: '#3b4a5a', seat: 'Winterfell' },
    lannister: { n: 'Lannister', e: '🦁', words: 'Hear me roar', col: '#e3b661', col2: '#7a1d1d', seat: 'Casterly Rock' },
    baratheon: { n: 'Baratheon', e: '🦌', words: 'Ours is the fury', col: '#e0c14a', col2: '#23231f', seat: "Storm's End" },
    targaryen: { n: 'Targaryen', e: '🐉', words: 'Fire and blood', col: '#e14b4b', col2: '#1c1c1c', seat: 'Dragonstone' },
    greyjoy: { n: 'Greyjoy', e: '🦑', words: 'We do not sow', col: '#d8b74a', col2: '#1f2a30', seat: 'Pyke' },
    tyrell: { n: 'Tyrell', e: '🌹', words: 'Growing strong', col: '#7fd06a', col2: '#2f5a2a', seat: 'Highgarden' },
    martell: { n: 'Martell', e: '☀️', words: 'Unbowed, unbent, unbroken', col: '#f08a3c', col2: '#7a2a1a', seat: 'Sunspear' },
  };
  const HOUSE_ORDER = ['stark', 'lannister', 'baratheon', 'targaryen', 'greyjoy', 'tyrell', 'martell'];
  if (!R.data.houses) R.data.houses = HOUSES;

  /* ---------- the old game's 100 skills: n, e, v (3 or 5 ranks), cd, ult ---------- */
  const SK = {
    /* base (v1.0.44) */
    cleave: { n: 'Cleave', e: '⚔️', v: [40, 70, 110], cd: 3 },
    crit: { n: 'Precision', e: '🎯', v: [15, 25, 35] },
    execute: { n: 'Execute', e: '💀', v: [15, 25, 35] },
    shield: { n: 'Bulwark', e: '🛡️', v: [80, 140, 220], cd: 12 },
    taunt: { n: 'Challenge', e: '📣', v: [3, 4, 5] },
    rally: { n: 'Rally', e: '🚩', v: [12, 22, 32] },
    goldtouch: { n: 'Iron Price', e: '💰', v: [35, 65, 100] },
    heal: { n: 'Mend', e: '💚', v: [15, 30, 50], cd: 10 },
    poison: { n: 'Venom', e: '🧪', v: [6, 12, 20] },
    burn: { n: 'Kindle', e: '🔥', v: [8, 14, 22] },
    slowaura: { n: 'Dread', e: '❄️', v: [20, 30, 40] },
    stun: { n: 'Stagger', e: '💫', v: [15, 25, 35] },
    multishot: { n: 'Volley', e: '🏹', v: [2, 3, 4] },
    pierce: { n: 'Pierce', e: '➶', v: [2, 3, 4] },
    summon: { n: 'Bannermen', e: '👥', v: [1, 2, 3], cd: 20 },
    firestorm: { n: 'Firestorm', e: '☄️', v: [300, 450, 650], cd: 45, ult: true },
    blizzard: { n: 'Blizzard', e: '🌨️', v: [5, 7, 9], cd: 40, ult: true },
    assassinate: { n: 'Valar Morghulis', e: '🗡️', v: [1, 2, 3], cd: 35, ult: true },
    warcry: { n: 'War Cry', e: '📯', v: [40, 60, 80], cd: 40, ult: true },
    fortify: { n: 'Fortify', e: '🧱', v: [250, 400, 600], cd: 60, ult: true },
    reinforce: { n: 'Host', e: '👥', v: [4, 6, 8], cd: 45, ult: true },
    wildfire: { n: 'Wildfire', e: '💚', v: [350, 500, 700], cd: 50, ult: true },
    kraken: { n: 'Kraken', e: '🐙', v: [2, 3, 4], cd: 45, ult: true },
    linestrike: { n: 'Charge', e: '🐎', v: [180, 280, 400], cd: 40, ult: true },
    dragonstrike: { n: 'Dracarys', e: '🐉', v: [150, 250, 380], cd: 60, ult: true },
    goldrain: { n: 'Debts Paid', e: '🪙', v: [120, 200, 320], cd: 60, ult: true },
    cloud: { n: 'Poison Cloud', e: '☁️', v: [40, 60, 90], cd: 45, ult: true },
    smash: { n: 'Smash', e: '🔨', v: [250, 400, 600], cd: 40, ult: true },
    oath: { n: 'Oath', e: '✨', v: [5, 7, 9], cd: 50, ult: true },
    /* Champions I (v1.0.52): Stark + Targaryen */
    frostbite: { n: 'Frostbite', e: '🥶', v: [25, 30, 35, 40, 45] },
    lifesteal: { n: 'Bloodletting', e: '🩸', v: [15, 20, 25, 30, 35] },
    sunder: { n: 'Sunder', e: '💢', v: [12, 16, 20, 24, 30] },
    blood: { n: 'Second Wind', e: '💪', v: [25, 32, 40, 48, 60] },
    knock: { n: 'Shove', e: '👊', v: [15, 20, 25, 30, 35] },
    chain: { n: 'Chain', e: '⛓️', v: [35, 42, 50, 58, 65] },
    volley: { n: 'Volley', e: '🎯', v: [40, 60, 85, 115, 150], cd: 8 },
    trap: { n: 'Caltrops', e: '🪤', v: [60, 90, 125, 165, 210], cd: 12 },
    howl: { n: 'Howl', e: '🐺', v: [40, 45, 50, 55, 60], cd: 12 },
    wolfpack: { n: 'Young Wolf', e: '🐺', v: [2, 3, 3, 4, 4], cd: 45, ult: true },
    remember: { n: 'The North Remembers', e: '📜', v: [8, 9, 10, 11, 12], cd: 50, ult: true },
    justice: { n: "Winter's Justice", e: '⚖️', v: [25, 30, 35, 40, 45], cd: 45, ult: true },
    wallholds: { n: 'The Wall Holds', e: '🧊', v: [4, 5, 6, 7, 8], cd: 50, ult: true },
    crown: { n: 'Golden Crown', e: '👑', v: [220, 320, 440, 580, 750], cd: 45, ult: true },
    dohaeris: { n: 'Valar Dohaeris', e: '🕊️', v: [120, 160, 200, 250, 300], cd: 50, ult: true },
    stormcrows: { n: 'Stormcrows', e: '🗡️', v: [90, 130, 180, 240, 320], cd: 40, ult: true },
    phalanx: { n: 'Shield Wall', e: '🛡️', v: [3, 4, 4, 5, 6], cd: 45, ult: true },
    forqueen: { n: 'For the Queen', e: '🐻', v: [6, 7, 8, 9, 10], cd: 45, ult: true },
    khalasar: { n: 'Khalasar', e: '🐎', v: [150, 220, 300, 400, 520], cd: 45, ult: true },
    /* Champions II (v1.0.53): Lannister + Baratheon */
    discipline: { n: 'Discipline', e: '🛡️', v: [15, 20, 25, 30, 35] },
    ironskin: { n: 'Iron Skin', e: '🪨', v: [15, 20, 25, 30, 35] },
    tribute: { n: 'Tribute', e: '🪙', v: [8, 12, 16, 20, 25], cd: 10 },
    parry: { n: 'Parry', e: '🤺', v: [15, 20, 25, 30, 35] },
    contempt: { n: 'Contempt', e: '🍷', v: [20, 25, 30, 35, 40] },
    hand: { n: 'Hand of the King', e: '📜', v: [6, 8, 10, 12, 15] },
    forge: { n: 'Forged Steel', e: '⚒️', v: [10, 14, 18, 22, 26] },
    duelist: { n: 'Duelist', e: '⚔️', v: [30, 45, 60, 80, 100] },
    rations: { n: 'Rations', e: '🧅', v: [40, 60, 80, 100, 130], cd: 12 },
    charm: { n: 'Charm', e: '🌈', v: [8, 12, 16, 20, 25] },
    bloodmagic: { n: 'Blood Magic', e: '🩸', v: [4, 6, 8, 10, 13] },
    warhammer: { n: 'Warhammer', e: '🔨', v: [35, 45, 55, 65, 80] },
    siegecraft: { n: 'Siegecraft', e: '🏹', v: [8, 10, 12, 14, 16] },
    twoforone: { n: 'Two for One', e: '💰', v: [6, 7, 8, 9, 10], cd: 40, ult: true },
    kingslayer: { n: 'Kingslayer', e: '👑', v: [500, 800, 1150, 1550, 2000], cd: 40, ult: true },
    dgblades: { n: 'Dragonglass Blades', e: '🔷', v: [6, 8, 10, 12, 14], cd: 45, ult: true },
    thebold: { n: 'The Bold', e: '🗡️', v: [200, 300, 420, 560, 720], cd: 40, ult: true },
    lordoflight: { n: 'Lord of Light', e: '🔥', v: [15, 20, 25, 30, 35], cd: 50, ult: true },
    fury: { n: 'Ours Is the Fury', e: '🦌', v: [5, 6, 7, 8, 10], cd: 45, ult: true },
    dawncharge: { n: 'Horns at Dawn', e: '🐎', v: [150, 220, 300, 390, 500], cd: 50, ult: true },
    /* Champions III (v1.0.54): Greyjoy + Tyrell */
    quickstudy: { n: 'Quick Study', e: '📖', v: [30, 45, 60, 80, 100] },
    drownaura: { n: 'Drowning Tide', e: '💧', v: [8, 12, 16, 20, 26] },
    bleed: { n: 'Bleed', e: '🪓', v: [6, 8, 10, 12, 15] },
    reave: { n: 'Reave', e: '⚓', v: [4, 6, 8, 10, 12] },
    storm: { n: 'Stormcaller', e: '⚡', v: [40, 60, 85, 115, 150], cd: 6 },
    whatisdead: { n: 'What Is Dead', e: '🦑', v: [2, 2.5, 3, 3.5, 4] },
    thorns: { n: 'Thorns', e: '🥀', v: [8, 12, 16, 20, 25] },
    drill: { n: 'Drill', e: '🥁', v: [12, 16, 20, 25, 30] },
    momentum: { n: 'Tourney Lance', e: '🏇', v: [60, 80, 100, 125, 150] },
    keepback: { n: 'Fall Back', e: '🏃', v: [6, 5.5, 5, 4.5, 4] },
    favour: { n: "Highgarden's Favour", e: '🌷', v: [15, 22, 30, 38, 48] },
    oldtales: { n: 'Old Tales', e: '📚', v: [10, 15, 20, 25, 30], cd: 45, ult: true },
    drowned: { n: 'Drowned and Risen', e: '🌊', v: [6, 8, 10, 12, 14], cd: 50, ult: true },
    ironprice: { n: 'The Iron Price', e: '🪙', v: [120, 170, 230, 300, 380], cd: 40, ult: true },
    axestorm: { n: 'Axe Storm', e: '🌪️', v: [4, 5, 6, 7, 8], cd: 40, ult: true },
    ironfleet: { n: 'The Iron Fleet', e: '⛵', v: [80, 120, 160, 210, 270], cd: 45, ult: true },
    ironarrow: { n: 'Iron Arrow', e: '🏹', v: [200, 300, 420, 560, 720], cd: 40, ult: true },
    growing: { n: 'Growing Strong', e: '🌱', v: [6, 7, 8, 9, 10], cd: 45, ult: true },
    muster: { n: 'Horn Hill Muster', e: '🎺', v: [6, 7, 8, 9, 10], cd: 45, ult: true },
    harvest: { n: 'Harvest Feast', e: '🍇', v: [6, 8, 10, 12, 14], cd: 50, ult: true },
    queenthorns: { n: 'Queen of Thorns', e: '🍷', v: [15, 22, 30, 38, 48], cd: 45, ult: true },
    slayer: { n: 'Dragonglass Dagger', e: '🗡️', v: [300, 450, 600, 800, 1000], cd: 50, ult: true },
    queenroses: { n: 'Queen of Roses', e: '🌹', v: [3, 3.5, 4, 4.5, 5], cd: 45, ult: true },
    /* Champions IV (v1.0.59): Martell */
    sunaura: { n: 'Sun of Dorne', e: '☀️', v: [6, 9, 12, 16, 20] },
    viper: { n: "Viper's Kiss", e: '🐍', v: [40, 60, 85, 115, 150] },
    waitstrike: { n: 'Patience', e: '⏳', v: [4, 5, 6, 8, 10] },
    iserve: { n: 'I Serve', e: '🪓', v: [5, 6, 7, 8, 10], cd: 45, ult: true },
    whiplash: { n: 'The Whip', e: '🪢', v: [2, 2.5, 3, 3.5, 4], cd: 40, ult: true },
    spearrain: { n: 'Spears of Dorne', e: '🔱', v: [180, 250, 330, 420, 540], cd: 40, ult: true },
    serpentkiss: { n: "Serpent's Kiss", e: '💋', v: [20, 28, 36, 45, 55], cd: 45, ult: true },
    vengeance: { n: 'Vengeance and Justice', e: '☀️', v: [6, 7, 8, 9, 10], cd: 55, ult: true },
    redviper: { n: 'The Red Viper', e: '🐍', v: [4, 5, 6, 7, 8], cd: 40, ult: true },
  };
  /* three-rank values become five ranks the way the old prog module did it (same rounding) */
  (function () {
    const CNT = ['taunt', 'multishot', 'pierce', 'summon', 'assassinate'];
    for (const k in SK) {
      const S = SK[k], v = S.v; if (!v || v.length !== 3) continue;
      const a = v[0], c = v[2], cnt = CNT.indexOf(k) >= 0;
      const r = x => cnt || Math.abs(c - a) < 12 ? Math.round(x * 2) / 2 : Math.abs(c - a) >= 150 ? Math.round(x / 5) * 5 : Math.round(x);
      S.v = [a, r(a + (c - a) / 4), r(a + (c - a) / 2), r(a + 3 * (c - a) / 4), c];
    }
    for (const k in SK) SK[k].id = k;
  })();

  /* ---------- the mapping: every skill id → an RPG effect kind + scale numbers ----------
     kind: aoe | rain | heal | shield | strike | summon | buff | debuff | dash
     dmg   × a same-level player's basic hit (R.champs.refAtk);  dot × that hit per second
     heal / shield  fraction of the target's full health (companions and the player)
     radius in world units; dur s; count n (0 = every enemy in the radius); v → the old rank value where a number says 'v'
     buff / debuff: fractions (atk 0.3 = +30 %), stun / slow / knock / exec / pct as named.  d: one line for the UI, {v} = rank value. */
  const V = 'v';
  const SIG = {
    /* -- base -- */
    cleave: { kind: 'aoe', dmg: 1.3, radius: 70, d: 'A sweep that hits everything around the champion' },
    crit: { kind: 'buff', buff: { crit: V, critMul: 3 }, dur: 6, pct: true, d: 'For 6 s {v}% of blows land triple' },
    execute: { kind: 'strike', dmg: 2.0, exec: V, count: 1, d: 'A finishing blow: kills a foe below {v}% health (not bosses)' },
    shield: { kind: 'shield', shield: 0.3, dur: 4, d: 'A shield worth 30% health for 4 s' },
    taunt: { kind: 'debuff', debuff: { taunt: true }, count: V, radius: 120, dur: 4, d: 'Challenges {v} enemies: they fight the champion for 4 s' },
    rally: { kind: 'buff', buff: { rate: V }, pct: true, radius: 150, dur: 8, d: 'The party strikes {v}% faster for 8 s' },
    goldtouch: { kind: 'buff', buff: { gold: V }, pct: true, dur: 10, d: 'Kills pay {v}% more gold for 10 s' },
    heal: { kind: 'heal', heal: 0.25, radius: 150, d: 'Mends the party by a quarter of their health' },
    poison: { kind: 'debuff', debuff: { poison: true }, dot: 0.35, dur: 4, radius: 60, d: 'Venom: poison for 4 s' },
    burn: { kind: 'debuff', debuff: { burn: true }, dot: 0.45, dur: 3, radius: 60, d: 'Kindle: burning for 3 s' },
    slowaura: { kind: 'debuff', debuff: { slow: V }, pct: true, radius: 90, dur: 4, d: 'Dread: enemies around move {v}% slower for 4 s' },
    stun: { kind: 'debuff', debuff: { stun: 1 }, radius: 70, dur: 1, d: 'Staggers everything close for 1 s' },
    multishot: { kind: 'strike', dmg: 1.0, count: V, radius: 180, d: 'A volley at {v} targets' },
    pierce: { kind: 'strike', dmg: 1.2, count: V, line: true, radius: 220, d: 'A shot through {v} enemies in a line' },
    summon: { kind: 'summon', count: V, dur: 12, unit: 'soldier', d: 'Calls {v} bannermen for 12 s' },
    firestorm: { kind: 'rain', dmg: 2.5, radius: 140, dot: 0.3, dur: 3, d: 'Fire falls around the champion and burns' },
    blizzard: { kind: 'debuff', debuff: { slow: 0.6 }, radius: 240, dur: V, d: 'Every enemy near moves at 40% speed for {v} s' },
    assassinate: { kind: 'strike', dmg: 4.0, count: V, strongest: true, noBoss: true, radius: 220, d: 'Kills the {v} strongest non-boss enemies' },
    warcry: { kind: 'buff', buff: { atk: V }, pct: true, radius: 200, dur: 8, d: 'The party deals +{v}% damage for 8 s' },
    fortify: { kind: 'heal', heal: 0.3, radius: 200, shield: 0.15, dur: 4, d: 'Mends the party by 30% and shields them' },
    reinforce: { kind: 'summon', count: V, dur: 15, unit: 'soldier', d: '{v} soldiers hold the line for 15 s' },
    wildfire: { kind: 'aoe', dmg: 3.0, radius: 90, delay: 0.6, dot: 0.3, dur: 3, d: 'Green fire bursts where the champion stands' },
    kraken: { kind: 'debuff', debuff: { stun: V }, radius: 130, dur: V, d: 'Everything within reach is stunned for {v} s' },
    linestrike: { kind: 'dash', dmg: 2.0, radius: 160, knock: 30, d: 'A charge through everything within 160 units' },
    dragonstrike: { kind: 'rain', dmg: 2.5, radius: 260, dot: 0.3, dur: 3, d: 'A dragon burns every enemy near' },
    goldrain: { kind: 'buff', buff: { goldFlat: V }, dur: 0, d: '+{v} gold at once' },
    cloud: { kind: 'aoe', dmg: 0, dot: 0.8, radius: 110, dur: 6, d: 'A poison cloud around the champion for 6 s' },
    smash: { kind: 'aoe', dmg: 2.5, radius: 100, stun: 2, d: 'A hammer blow around the champion, stuns 2 s' },
    oath: { kind: 'shield', shield: 1.0, invuln: true, taunt: true, radius: 200, dur: V, d: 'Untouchable and drawing every enemy for {v} s' },
    /* -- Champions I -- */
    frostbite: { kind: 'debuff', debuff: { slow: V }, pct: true, radius: 90, dur: 2, dmg: 0.8, d: 'A chilling blow: {v}% slower for 2 s' },
    lifesteal: { kind: 'buff', buff: { lifesteal: V }, pct: true, dur: 8, d: 'Heals {v}% of damage dealt for 8 s' },
    sunder: { kind: 'debuff', debuff: { def: V }, pct: true, radius: 80, dur: 3, dmg: 0.8, d: 'Cracks armour: foes take {v}% more for 3 s' },
    blood: { kind: 'buff', buff: { atk: V }, pct: true, dur: 6, d: 'Second wind: +{v}% damage for 6 s' },
    knock: { kind: 'strike', dmg: 1.5, knock: 60, count: 1, d: 'A shove that throws the target back' },
    chain: { kind: 'strike', dmg: 1.0, count: 2, chain: V, pct: true, radius: 160, d: 'A shot that arcs to one more enemy for {v}%' },
    volley: { kind: 'rain', dmg: 1.0, count: 3, radius: 180, d: 'A burst at the 3 nearest enemies' },
    trap: { kind: 'aoe', dmg: 1.5, radius: 50, stun: 1, delay: 0.4, d: 'Caltrops at the champion\'s feet: damage and a 1 s stun' },
    howl: { kind: 'debuff', debuff: { slow: V }, pct: true, radius: 110, dur: 3, d: 'A howl: everything near is {v}% slower for 3 s' },
    wolfpack: { kind: 'summon', count: V, dur: 12, unit: 'direwolf', d: '{v} direwolves run beside the champion for 12 s' },
    remember: { kind: 'buff', buff: { gold: 1.0 }, dur: V, d: 'For {v} s every kill pays double gold' },
    justice: { kind: 'strike', dmg: 1.0, exec: V, count: 0, radius: 220, stun: 2, noBoss: true, d: 'Beheads every foe near below {v}% health; the rest stagger 2 s' },
    wallholds: { kind: 'shield', shield: 0.3, radius: 150, dur: V, wall: true, d: 'An ice wall: the party is shielded for {v} s' },
    crown: { kind: 'rain', dmg: 2.0, count: 3, radius: 180, buff: { gold: 1.0 }, d: 'Molten gold on the 3 nearest: they drop double gold' },
    dohaeris: { kind: 'heal', heal: 0.35, radius: 220, revive: false, d: 'Every ally near is mended by 35%' },
    stormcrows: { kind: 'strike', dmg: 1.2, count: 6, radius: 200, d: 'Six thrown knives at the 6 nearest enemies' },
    phalanx: { kind: 'summon', count: V, dur: 15, unit: 'unsullied', hpMul: 2, d: '{v} Unsullied plant their spears for 15 s' },
    forqueen: { kind: 'buff', buff: { atk: 0.6, lifesteal: 0.5 }, dur: V, d: 'For {v} s +60% damage, half of it healed back' },
    khalasar: { kind: 'dash', dmg: 2.5, radius: 160, knock: 40, d: 'The horde tramples everything within 160 units' },
    /* -- Champions II -- */
    discipline: { kind: 'buff', buff: { def: V }, pct: true, radius: 120, dur: 8, d: 'The party takes {v}% less damage for 8 s' },
    ironskin: { kind: 'buff', buff: { def: V }, pct: true, dur: 8, self: true, d: 'Iron skin: {v}% less damage taken for 8 s' },
    tribute: { kind: 'buff', buff: { goldFlat: V }, dur: 0, d: 'Collects {v} gold' },
    parry: { kind: 'buff', buff: { parry: V }, pct: true, dur: 6, self: true, d: '{v}% of blows are turned aside for 6 s' },
    contempt: { kind: 'debuff', debuff: { atk: V }, pct: true, radius: 100, dur: 5, d: 'Enemies near deal {v}% less for 5 s' },
    hand: { kind: 'buff', buff: { cdr: V }, pct: true, radius: 200, dur: 8, d: 'The party\'s skills recharge {v}% faster for 8 s' },
    forge: { kind: 'buff', buff: { atk: V }, pct: true, radius: 120, dur: 8, d: 'Forged steel: the party deals +{v}% for 8 s' },
    duelist: { kind: 'buff', buff: { bossDmg: V }, pct: true, dur: 8, self: true, d: '+{v}% against giants and bosses for 8 s' },
    rations: { kind: 'heal', heal: 0.2, radius: 120, d: 'Rations: the party near is mended by 20%' },
    charm: { kind: 'debuff', debuff: { flee: true }, radius: 90, dur: 2, noBoss: true, d: 'Charmed: enemies near walk away for 2 s' },
    bloodmagic: { kind: 'heal', heal: 0.15, radius: 120, onKill: true, d: 'Blood magic: deaths near mend the party by 15%' },
    warhammer: { kind: 'aoe', dmg: 1.2, radius: 60, d: 'A hammer blow that strikes everything around the target' },
    siegecraft: { kind: 'buff', buff: { range: V }, pct: true, radius: 150, dur: 8, d: 'The party reaches {v}% further for 8 s' },
    twoforone: { kind: 'buff', buff: { rate: 1.0, multishot: 1 }, dur: V, self: true, d: 'For {v} s shoots twice as fast at one more target' },
    kingslayer: { kind: 'strike', dmg: 5.0, count: 1, strongest: true, radius: 260, d: 'One blow at the strongest enemy near, bosses too' },
    dgblades: { kind: 'buff', buff: { armorPierce: 1, immune: 'ice' }, radius: 200, dur: V, d: 'Dragonglass edges: armour ignored, no freezing for {v} s' },
    thebold: { kind: 'dash', dmg: 2.5, radius: 70, d: 'Leaps to the nearest foe and strikes everything within 70 units' },
    lordoflight: { kind: 'aoe', dmg: 1.5, pct: V, radius: 280, bossHalf: true, d: 'Every enemy near burns away {v}% of its health' },
    fury: { kind: 'buff', buff: { rate: 0.5, splash: 55 }, dur: V, self: true, d: 'For {v} s every blow lands on all foes close, 50% faster' },
    dawncharge: { kind: 'dash', dmg: 2.5, radius: 200, knock: 30, d: 'Riders sweep the field: thrown back 30 units' },
    /* -- Champions III -- */
    quickstudy: { kind: 'buff', buff: { xp: V }, pct: true, dur: 20, d: 'Quick study: +{v}% XP for 20 s' },
    drownaura: { kind: 'aoe', dmg: 0, dot: 0.5, radius: 80, dur: 6, d: 'A drowning tide around the champion for 6 s' },
    bleed: { kind: 'debuff', debuff: { bleed: true }, pct: V, dur: 4, radius: 60, bossHalf: true, d: 'Bleed: {v}% of the target\'s health over 4 s' },
    reave: { kind: 'heal', heal: 0.15, self: true, onKill: true, d: 'Reave: kills heal the champion by 15%' },
    storm: { kind: 'rain', dmg: 1.5, count: 1, radius: 150, kindDmg: 'holy', d: 'Lightning strikes an enemy within 150 units' },
    whatisdead: { kind: 'shield', shield: 1.0, invuln: true, dur: V, self: true, d: 'Untouchable for {v} s' },
    thorns: { kind: 'buff', buff: { thorns: V }, dur: 8, self: true, d: 'Thorns: every blow taken deals {v} back for 8 s' },
    drill: { kind: 'buff', buff: { atk: V }, pct: true, radius: 120, dur: 8, d: 'Drill: the party deals +{v}% for 8 s' },
    momentum: { kind: 'dash', dmg: 1.0, dmgPct: V, stun: 1, radius: 60, d: 'A lance charge: +{v}% damage and a 1 s stun' },
    keepback: { kind: 'dash', dmg: 0, back: true, radius: 0, d: 'Steps back from the enemy that closes in' },
    favour: { kind: 'buff', buff: { rate: V }, pct: true, radius: 120, dur: 8, d: 'The party strikes {v}% faster for 8 s' },
    oldtales: { kind: 'buff', buff: { cdFlat: V }, radius: 220, dur: 0, d: 'Every ally\'s skills recharge {v} s at once' },
    drowned: { kind: 'heal', heal: 1.0, revive: true, radius: 220, dur: V, d: 'For {v} s a fallen ally rises again at full health' },
    ironprice: { kind: 'rain', dmg: 2.0, count: 0, radius: 300, gold: 60, d: 'Pays 60 gold: every enemy near is struck' },
    axestorm: { kind: 'aoe', dmg: 1.2, radius: 60, dur: V, tick: 0.5, d: 'Spins for {v} s: every half second a blow to everything close' },
    ironfleet: { kind: 'rain', dmg: 1.0, count: 10, radius: 220, dur: 4, d: 'Ten volleys from the longships over 4 s' },
    ironarrow: { kind: 'strike', dmg: 3.0, count: 0, line: true, radius: 400, d: 'One arrow along the line with the most enemies' },
    growing: { kind: 'buff', buff: { atkRamp: 0.05, atkMax: 0.5 }, radius: 200, dur: V, d: 'The party grows 5% stronger each second for {v} s' },
    muster: { kind: 'heal', heal: 0.5, buff: { atk: 0.5 }, radius: 220, dur: V, d: 'Allies mend half their health and fight 50% harder for {v} s' },
    harvest: { kind: 'heal', heal: 0.3, hot: true, radius: 200, dur: V, d: 'A feast: the party mends over {v} s' },
    queenthorns: { kind: 'debuff', debuff: { poison: true }, dot: 0.6, radius: 300, dur: 6, count: 0, d: 'Every enemy near is poisoned for 6 s' },
    slayer: { kind: 'strike', dmg: 5.0, count: 1, strongest: true, radius: 260, kindDmg: 'holy', d: 'A dragonglass dagger in the strongest enemy near' },
    queenroses: { kind: 'debuff', debuff: { flee: true }, radius: 150, dur: V, noBoss: true, d: 'Every enemy near turns and walks away for {v} s' },
    /* -- Champions IV -- */
    sunaura: { kind: 'heal', heal: 0.2, hot: true, radius: 110, dur: 5, d: 'The sun of Dorne mends the party over 5 s' },
    viper: { kind: 'strike', dmg: 2.0, count: 1, dot: 0.35, dur: 4, d: 'A viper\'s bite: a heavy blow and 4 s of poison' },
    waitstrike: { kind: 'buff', buff: { atk: V }, pct: true, mul: 5, dur: 5, self: true, d: 'Patience: +{v}% damage per second stood still, for 5 s' },
    iserve: { kind: 'shield', shield: 0.4, taunt: true, radius: 130, dur: V, d: 'For {v} s stops everyone who reaches him and takes 40% less' },
    whiplash: { kind: 'debuff', debuff: { bind: true }, count: V, radius: 200, dur: 3, pull: 60, noBoss: true, d: 'The whip binds the {v} strongest enemies near for 3 s' },
    spearrain: { kind: 'rain', dmg: 2.0, count: 5, radius: 220, stun: 1, d: 'A spear for each of the 5 nearest enemies, pinned 1 s' },
    serpentkiss: { kind: 'aoe', dmg: 0, dot: 0.6, radius: 120, dur: 5, disarm: 4, d: 'Everything within 120 units is poisoned 5 s and cannot strike for 4 s' },
    vengeance: { kind: 'shield', shield: 1.0, invuln: true, radius: 200, dur: V, retaliate: 1.5, d: 'For {v} s the party takes nothing; then it is paid back 1.5×' },
    redviper: { kind: 'dash', dmg: 1.5, count: V, strongest: true, radius: 200, dot: 0.35, dur: 4, d: 'Leaps to the strongest foe near and strikes it {v} times' },
  };

  /* ---------- the 49 champions: rows [id, house, name, emoji, type]; kits = the final ones (v1.0.52–59) ---------- */
  const CH = [
    ['jon', 'stark', 'Jon Snow', '🗡️', 'melee'], ['arya', 'stark', 'Arya Stark', '🎭', 'melee'], ['sansa', 'stark', 'Sansa Stark', '👑', 'caster'],
    ['bran', 'stark', 'Bran Stark', '👁️', 'caster'], ['robb', 'stark', 'Robb Stark', '🐺', 'melee'], ['ned', 'stark', 'Eddard Stark', '⚖️', 'melee'],
    ['brienne', 'stark', 'Brienne of Tarth', '🛡️', 'melee'],
    ['jaime', 'lannister', 'Jaime Lannister', '⚔️', 'melee'], ['tyrion', 'lannister', 'Tyrion Lannister', '🍷', 'caster'], ['cersei', 'lannister', 'Cersei Lannister', '👑', 'caster'],
    ['tywin', 'lannister', 'Tywin Lannister', '🦁', 'caster'], ['bronn', 'lannister', 'Bronn', '🏹', 'ranged'], ['gregor', 'lannister', 'The Mountain', '🔨', 'melee'],
    ['kevan', 'lannister', 'Kevan Lannister', '🚩', 'melee'],
    ['stannis', 'baratheon', 'Stannis Baratheon', '🔥', 'melee'], ['robert', 'baratheon', 'Robert Baratheon', '🔨', 'melee'], ['renly', 'baratheon', 'Renly Baratheon', '🌈', 'caster'],
    ['davos', 'baratheon', 'Davos Seaworth', '🧅', 'ranged'], ['melisandre', 'baratheon', 'Melisandre', '🕯️', 'caster'], ['gendry', 'baratheon', 'Gendry', '⚒️', 'melee'],
    ['barristan', 'baratheon', 'Barristan Selmy', '🛡️', 'melee'],
    ['dany', 'targaryen', 'Daenerys', '🐉', 'caster'], ['jorah', 'targaryen', 'Jorah Mormont', '🐻', 'melee'], ['greyworm', 'targaryen', 'Grey Worm', '🔱', 'melee'],
    ['missandei', 'targaryen', 'Missandei', '📜', 'caster'], ['daario', 'targaryen', 'Daario Naharis', '🗡️', 'melee'], ['drogo', 'targaryen', 'Khal Drogo', '🐎', 'melee'],
    ['viserys', 'targaryen', 'Viserys', '🪙', 'caster'],
    ['theon', 'greyjoy', 'Theon Greyjoy', '🏹', 'ranged'], ['yara', 'greyjoy', 'Yara Greyjoy', '⚓', 'melee'], ['euron', 'greyjoy', 'Euron Greyjoy', '🌊', 'caster'],
    ['balon', 'greyjoy', 'Balon Greyjoy', '🪙', 'caster'], ['victarion', 'greyjoy', 'Victarion Greyjoy', '🪓', 'melee'], ['aeron', 'greyjoy', 'Aeron Damphair', '🌊', 'caster'],
    ['rodrik', 'greyjoy', 'Rodrik the Reader', '📖', 'caster'],
    ['margaery', 'tyrell', 'Margaery Tyrell', '🌹', 'caster'], ['olenna', 'tyrell', 'Olenna Tyrell', '🌿', 'caster'], ['loras', 'tyrell', 'Loras Tyrell', '🐎', 'melee'],
    ['randyll', 'tyrell', 'Randyll Tarly', '🚩', 'melee'], ['sam', 'tyrell', 'Samwell Tarly', '📚', 'ranged'], ['garlan', 'tyrell', 'Garlan Tyrell', '⚔️', 'melee'],
    ['mace', 'tyrell', 'Mace Tyrell', '🍇', 'caster'],
    ['oberyn', 'martell', 'Oberyn Martell', '🐍', 'melee'], ['ellaria', 'martell', 'Ellaria Sand', '🧪', 'caster'], ['doran', 'martell', 'Doran Martell', '☀️', 'caster'],
    ['areo', 'martell', 'Areo Hotah', '🪓', 'melee'], ['obara', 'martell', 'Obara Sand', '🔱', 'ranged'], ['nymeria', 'martell', 'Nymeria Sand', '🪢', 'ranged'],
    ['tyene', 'martell', 'Tyene Sand', '🧪', 'ranged'],
  ];
  const KITS = {
    brienne: ['taunt', 'lifesteal', 'oath'], robb: ['cleave', 'howl', 'wolfpack'], bran: ['slowaura', 'frostbite', 'blizzard'], sansa: ['goldtouch', 'sunder', 'remember'],
    ned: ['shield', 'execute', 'justice'], arya: ['crit', 'execute', 'assassinate'], jon: ['cleave', 'frostbite', 'wallholds'],
    viserys: ['goldtouch', 'chain', 'crown'], missandei: ['heal', 'shield', 'dohaeris'], daario: ['crit', 'blood', 'stormcrows'], greyworm: ['taunt', 'trap', 'phalanx'],
    jorah: ['cleave', 'lifesteal', 'forqueen'], drogo: ['crit', 'knock', 'khalasar'], dany: ['burn', 'volley', 'dragonstrike'],
    kevan: ['rally', 'discipline', 'reinforce'], bronn: ['multishot', 'pierce', 'twoforone'], gregor: ['cleave', 'ironskin', 'smash'], tywin: ['goldtouch', 'tribute', 'goldrain'],
    jaime: ['crit', 'parry', 'kingslayer'], cersei: ['slowaura', 'contempt', 'firestorm'], tyrion: ['burn', 'hand', 'wildfire'],
    gendry: ['stun', 'forge', 'dgblades'], barristan: ['shield', 'duelist', 'thebold'], davos: ['heal', 'rations', 'fortify'], renly: ['summon', 'charm', 'warcry'],
    melisandre: ['burn', 'bloodmagic', 'lordoflight'], robert: ['blood', 'warhammer', 'fury'], stannis: ['shield', 'siegecraft', 'dawncharge'],
    rodrik: ['rally', 'quickstudy', 'oldtales'], aeron: ['heal', 'drownaura', 'drowned'], balon: ['goldtouch', 'shield', 'ironprice'], victarion: ['taunt', 'bleed', 'axestorm'],
    yara: ['cleave', 'reave', 'ironfleet'], euron: ['stun', 'storm', 'kraken'], theon: ['crit', 'whatisdead', 'ironarrow'],
    garlan: ['rally', 'thorns', 'growing'], randyll: ['sunder', 'drill', 'muster'], mace: ['summon', 'tribute', 'harvest'], loras: ['stun', 'momentum', 'linestrike'],
    olenna: ['poison', 'execute', 'queenthorns'], sam: ['pierce', 'keepback', 'slayer'], margaery: ['charm', 'favour', 'queenroses'],
    areo: ['taunt', 'ironskin', 'iserve'], nymeria: ['multishot', 'knock', 'whiplash'], obara: ['pierce', 'sunder', 'spearrain'],
    tyene: ['poison', 'viper', 'serpentkiss'], doran: ['sunaura', 'waitstrike', 'vengeance'], ellaria: ['poison', 'slowaura', 'cloud'], oberyn: ['viper', 'crit', 'redviper'],
  };
  /* opening order inside each house (least known → most known) = tier 0…6; rarity by tier as in the old tavern */
  const CH_ORDER = {
    stark: ['brienne', 'robb', 'bran', 'sansa', 'ned', 'arya', 'jon'],
    lannister: ['kevan', 'bronn', 'gregor', 'tywin', 'jaime', 'cersei', 'tyrion'],
    baratheon: ['gendry', 'barristan', 'davos', 'renly', 'melisandre', 'robert', 'stannis'],
    targaryen: ['viserys', 'missandei', 'daario', 'greyworm', 'jorah', 'drogo', 'dany'],
    greyjoy: ['rodrik', 'aeron', 'balon', 'victarion', 'yara', 'euron', 'theon'],
    tyrell: ['garlan', 'randyll', 'mace', 'loras', 'olenna', 'sam', 'margaery'],
    martell: ['areo', 'nymeria', 'obara', 'tyene', 'doran', 'ellaria', 'oberyn'],
  };
  const CH_RAR = [0, 0, 1, 2, 2, 3, 4];
  const RAR_N = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
  const RAR_C = ['#8a97a8', '#7fd06a', '#4fb0ff', '#b47cff', '#e3b661'];
  const RAR_STAT = [1, 1.04, 1.08, 1.13, 1.2];
  const UNLOCK_STAGE = [0, 5, 10, 18, 27, 36, 45];          /* the old campaign gates by tier (since v1.0.52) */
  const COST = [{ gold: 500 }, { gold: 1500 }, { gold: 4000 }, { gems: 120 }, { gems: 400 }];
  /* role: what the kit says the champion does.  tank: melee who holds; dps: melee who kills; ranged: shooters and battle casters; support: menders */
  const TANKY = ['taunt', 'shield', 'ironskin', 'discipline', 'parry', 'thorns'];
  const MENDY = ['heal', 'sunaura', 'rations', 'bloodmagic', 'goldtouch', 'rally', 'charm', 'favour', 'tribute', 'hand', 'quickstudy', 'summon', 'drill', 'forge', 'siegecraft'];
  const roleOf = (type, sk) => {
    const two = sk.slice(0, 2);
    if (type === 'melee') return two.some(k => TANKY.indexOf(k) >= 0) ? 'tank' : 'dps';
    if (type === 'ranged') return 'ranged';
    return two.some(k => MENDY.indexOf(k) >= 0) ? 'support' : 'ranged';
  };
  const ROLE = { tank: { hp: 1.15, atk: 0.7, def: 1.3 }, dps: { hp: 0.85, atk: 1.0, def: 0.9 }, ranged: { hp: 0.7, atk: 0.9, def: 0.7 }, support: { hp: 0.75, atk: 0.6, def: 0.8 } };
  const SPD = { melee: 165, ranged: 155, caster: 150 };
  const shortName = n => { const w = n.split(' '); return w[0] === 'The' ? w[1] : w[0]; };

  /* ---------- the ARCH player formulas, with the stat points spent the automatic way (half into the main stat, a quarter into vit) ---------- */
  const mainStat = L => 5 + 1.5 * (L - 1), vit = L => 5 + 0.75 * (L - 1);
  const refAtk = L => 10 + 2 * L + 1.5 * mainStat(L);            /* a same-level player's basic hit */
  const refHp = L => 120 + 18 * L + 6 * vit(L);
  const refDef = L => 4 + 1.2 * L + 0.6 * vit(L);
  const rankAt = L => Math.max(1, Math.min(5, 1 + Math.floor((Math.max(1, L | 0)) / 15)));   /* 1–14 → 1, 15 → 2, 30 → 3, 45 → 4, 60 → 5 */
  const RANK_LVL = [1, 15, 30, 45, 60];

  const list = [], by = {};
  for (const h of HOUSE_ORDER) {
    CH_ORDER[h].forEach((id, tier) => {
      const row = CH.find(r => r[0] === id); if (!row) return;
      const sk = (KITS[id] || []).slice(), sigId = sk[2], S = SK[sigId], M = SIG[sigId];
      const rar = CH_RAR[tier], role = roleOf(row[4], sk);
      const c = { id, house: h, name: row[2], short: shortName(row[2]), emoji: row[3], type: row[4], tier, rar, rarName: RAR_N[rar], rarCol: RAR_C[rar], role, kit: sk,
        sig: { skill: sigId, name: S.n, e: S.e, cd: S.cd || 40, kind: M.kind, v: S.v.slice(), d: M.d },
        portrait: id + '_portrait', art: id, attackArt: id + '_attack', col: HOUSES[h].col, unlockStage: UNLOCK_STAGE[tier], base: null };
      list.push(c); by[id] = c;
    });
  }
  const statsAt = (id, lvl) => {
    const c = by[id]; if (!c) return null;
    const L = Math.max(1, Math.min(60, lvl | 0 || 1)), m = ROLE[c.role], r = RAR_STAT[c.rar];
    return { hp: Math.round(refHp(L) * m.hp * r), atk: Math.round(refAtk(L) * m.atk * r), def: Math.round(refDef(L) * m.def * r), spd: SPD[c.type], lvl: L, rank: rankAt(L) };
  };
  for (const c of list) c.base = statsAt(c.id, 1);

  /* the signature's numbers at a rank and a level.  sigEffect(sig | skillId, rank 1..5, lvl?) — lvl defaults to the level that rank is reached at */
  const sigEffect = (sig, rank, lvl) => {
    const id = typeof sig === 'string' ? sig : sig && (sig.skill || sig.id); const S = SK[id], M = SIG[id]; if (!S || !M) return null;
    const rk = Math.max(1, Math.min(5, rank | 0 || 1)), L = Math.max(1, Math.min(60, lvl | 0 || RANK_LVL[rk - 1]));
    const v = S.v[rk - 1], rm = 1 + 0.08 * (rk - 1), hit = refAtk(L), hp = refHp(L);
    const num = x => x === V ? v : x;
    const out = { kind: M.kind, skill: id, name: S.n, rank: rk, lvl: L, v, cd: S.cd || 40 };
    if (M.dmg) out.dmg = Math.round(M.dmg * hit * rm * (M.dmgPct ? 1 + num(M.dmgPct) / 100 : 1));
    if (M.dot) out.dot = Math.round(M.dot * hit * rm);
    if (M.heal) { out.healPct = Math.min(1, M.heal * (1 + 0.1 * (rk - 1))); out.heal = Math.round(out.healPct * hp); }
    if (M.shield) { out.shieldPct = M.invuln ? 1 : Math.min(1, M.shield * (1 + 0.1 * (rk - 1))); out.shield = Math.round(out.shieldPct * hp); }
    if (M.radius != null) out.radius = M.radius;
    if (M.dur != null) out.dur = num(M.dur);
    if (M.count != null) out.count = Math.round(num(M.count));
    if (M.stun != null) out.stun = num(M.stun);
    if (M.knock != null) out.knock = M.knock;
    if (M.exec != null) out.exec = num(M.exec) / 100;
    if (M.pct != null && M.pct !== true) out.pct = num(M.pct) / 100;
    for (const k of ['invuln', 'taunt', 'line', 'strongest', 'noBoss', 'bossHalf', 'revive', 'hot', 'onKill', 'self', 'back', 'wall', 'unit', 'hpMul', 'tick', 'delay', 'disarm', 'pull', 'retaliate', 'gold', 'kindDmg', 'chain']) if (M[k] != null) out[k] = num(M[k]);
    if (M.chain != null) out.chain = num(M.chain) / 100;
    if (M.buff) { out.buff = {}; for (const k in M.buff) { let x = num(M.buff[k]); if (M.pct === true && typeof x === 'number' && M.buff[k] === V) x = x * (M.mul || 1) / 100; out.buff[k] = x; } }
    if (M.debuff) { out.debuff = {}; for (const k in M.debuff) { let x = num(M.debuff[k]); if (M.pct === true && typeof x === 'number' && M.debuff[k] === V) x = x / 100; out.debuff[k] = x; } if (out.debuff.stun != null) out.stun = out.debuff.stun; if (out.debuff.slow != null) out.slow = out.debuff.slow; }
    return out;
  };
  const sigAt = (id, lvl) => { const c = by[id]; return c ? sigEffect(c.sig.skill, rankAt(lvl || 1), lvl || 1) : null; };

  /* import an old save: the v4 container {slots,cur}, one account {house,champs,copen,campaign}, a server levels map {'c:<id>':lvl} or {levels}.
     → {ids, champs:{id:{lvl}}, house, gold, gems}; old level 1–60 → RPG level 1–60 */
  const importOld = old => {
    const out = { ids: [], champs: {}, house: null, gold: 0, gems: 0 };
    if (!old || typeof old !== 'object') return out;
    let acc = old;
    if (Array.isArray(old.slots)) acc = (old.cur >= 0 && old.slots[old.cur]) || old.slots.find(s => s && s.champs) || null;
    const levels = (acc && acc.levels) || (old.levels) || null;
    const flat = {};
    const src = levels || (acc && !acc.champs && !acc.copen ? acc : null);
    if (src) for (const k in src) { const m = /^c:([a-z]+)$/.exec(k); if (m && by[m[1]]) flat[m[1]] = Math.max(flat[m[1]] || 0, +src[k] || 1); }
    if (acc && acc.champs) {
      out.house = by[acc.sel] && acc.house ? acc.house : (acc.house || null);
      const cleared = acc.campaign ? Object.keys(acc.campaign).length : 0;
      for (const id in acc.champs) { const p = acc.champs[id]; if (by[id] && p && (p.lvl > 1 || (acc.copen && acc.copen[id]))) flat[id] = Math.max(flat[id] || 0, +p.lvl || 1); }
      if (acc.copen) for (const id in acc.copen) if (acc.copen[id] && by[id]) flat[id] = Math.max(flat[id] || 0, 1);
      if (acc.house && HOUSES[acc.house]) for (const c of list) if (c.house === acc.house && cleared >= c.unlockStage) flat[c.id] = Math.max(flat[c.id] || 0, 1);
      out.gold = Math.max(0, Math.round(+acc.gold || 0)); out.gems = Math.max(0, Math.round(+acc.gems || 0));
    } else if (acc) { out.house = acc.house || null; out.gold = Math.max(0, Math.round(+acc.gold || 0)); out.gems = Math.max(0, Math.round(+acc.gems || 0)); }
    for (const c of list) if (flat[c.id]) { out.ids.push(c.id); out.champs[c.id] = { lvl: Math.max(1, Math.min(60, Math.round(flat[c.id]))) }; }
    return out;
  };

  /* ---------- Addendum 2: champions are the HEROES the player controls (one hero, permadeath) ----------
     class by the old type: melee → knight, ranged → ranger, caster (the old game's third type; there is no 'mage' row) → maester */
  const CLS = { melee: 'knight', ranged: 'ranger', caster: 'maester', mage: 'maester' };
  const cls = id => { const c = by[id]; return c ? CLS[c.type] || 'knight' : null; };
  const types = () => { const n = {}; for (const c of list) n[c.type] = (n[c.type] || 0) + 1; return n; };
  /* bonuses layered on the ARCH player formulas: Common +0 … Legendary +12 % (small — the player's skill matters more);
     the role bends them: a tank's bonus leans to hp/def, a killer's to atk/crit, a shooter's to spd/crit, a mender's to hp.
     → {hp, atk, def, spd, crit} as FLAT additions at that level (hp/atk/def points, spd u/s, crit a fraction) + mul (the fractions) */
  const RAR_BONUS = [0, 0.03, 0.06, 0.09, 0.12];
  const ROLE_BEND = { tank: { hp: 1.3, atk: 0.6, def: 1.4, spd: 0, crit: 0 }, dps: { hp: 0.8, atk: 1.3, def: 0.8, spd: 4, crit: 0.5 },
    ranged: { hp: 0.7, atk: 1.1, def: 0.6, spd: 10, crit: 0.8 }, support: { hp: 1.2, atk: 0.8, def: 1.0, spd: 5, crit: 0.2 } };
  const heroBase = (id, lvl) => {
    const c = by[id]; if (!c) return null;
    const L = Math.max(1, Math.min(60, lvl | 0 || 1)), b = RAR_BONUS[c.rar], k = ROLE_BEND[c.role];
    const mul = { hp: +(b * k.hp).toFixed(4), atk: +(b * k.atk).toFixed(4), def: +(b * k.def).toFixed(4) };
    return { hp: Math.round(refHp(L) * mul.hp), atk: Math.round(refAtk(L) * mul.atk * 10) / 10, def: Math.round(refDef(L) * mul.def * 10) / 10,
      spd: k.spd, crit: +(b * k.crit).toFixed(4), mul, rar: c.rar, role: c.role, cls: cls(id), lvl: L };
  };
  /* the house's starting hero: the first champion the old game opened for the house (tier 0, Common) */
  const first = h => (CH_ORDER[h] || CH_ORDER.stark)[0];
  /* how a champion is unlocked: by rarity — Commons near home, Rare in the middle of the realm, Epic at the Wall, Legendary beyond it.
     {kind:'start'|'quest'|'boss', region, text}; A19 places the rescue quests / A09 the boss drops from this table */
  const HOME = { stark: 'the North', lannister: 'the Westerlands', baratheon: 'the Stormlands', targaryen: 'the Crownlands', greyjoy: 'the Iron Islands', tyrell: 'the Reach', martell: 'Dorne' };
  const unlock = id => {
    const c = by[id]; if (!c) return null; const seat = HOUSES[c.house].seat, home = HOME[c.house];
    switch (c.tier) {
      case 0: return { kind: 'start', region: home, text: `Your house's first hero — yours from the start at ${seat}.` };
      case 1: return { kind: 'quest', region: home, text: `Common · a rescue quest near ${seat}, in ${home}.` };
      case 2: return { kind: 'quest', region: home, text: `Uncommon · a rescue quest on the far side of ${home}.` };
      case 3: return { kind: 'quest', region: 'the Riverlands', text: 'Rare · a rescue quest in the Riverlands.' };
      case 4: return { kind: 'quest', region: 'the Vale', text: 'Rare · a rescue quest in the Vale of Arryn.' };
      case 5: return { kind: 'boss', region: 'the Wall', text: 'Epic · held by the boss at the Wall — kill it to free the champion.' };
      default: return { kind: 'boss', region: 'the Lands of Always Winter', text: 'Legendary · held beyond the Wall, in the Lands of Always Winter — a boss drop.' };
    }
  };
  const unlockText = id => { const u = unlock(id); return u ? u.text : ''; };
  /* an import → the v2 save's acc.champs shape */
  const toAcc = imp => { const o = {}; for (const id of (imp && imp.ids) || []) o[id] = { unlocked: 1, runs: 0, lvl: imp.champs[id].lvl }; return o; };
  for (const c of list) { c.cls = cls(c.id); c.unlock = unlock(c.id); }

  const kinds = () => { const n = {}; for (const k in SIG) n[SIG[k].kind] = (n[SIG[k].kind] || 0) + 1; return n; };
  const hasArt = id => !!(window.A_CHAMP && A_CHAMP.art && A_CHAMP.art[id + '_portrait']) || !!(window.CHAMP_ART && CHAMP_ART[id + '_portrait']);

  R.data.champs = list; R.data.champsBy = by; R.data.champKits = KITS; R.data.champSkills = SK; R.data.sigMap = SIG;
  R.champs = { list: () => list, get: id => by[id] || null, byHouse: h => list.filter(c => c.house === h), statsAt, rankAt, refAtk, refHp, refDef,
    unlockCost: id => { const c = by[id]; return c ? Object.assign({ rar: c.rar }, COST[c.rar]) : null; },
    import: importOld, toAcc, sigEffect, sigAt, kinds, hasArt, cls, types, heroBase, first, unlock, unlockText, CLS, RAR_BONUS,
    RAR_N, RAR_C, RAR_STAT, HOUSE_ORDER, UNLOCK_STAGE, SIG_KINDS: ['aoe', 'rain', 'heal', 'shield', 'strike', 'summon', 'buff', 'debuff', 'dash'],
    describe: (id, lvl) => { const c = by[id]; if (!c) return ''; const e = sigAt(id, lvl || 1); return c.sig.d.replace(/\{v\}/g, e ? String(e.v) : ''); } };
})();
