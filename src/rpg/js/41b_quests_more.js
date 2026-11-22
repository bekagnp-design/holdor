/* HOLDOR RPG — more quests (Q1). Data only, appended at load to R.data.quests / R.data.npcs (41_story owns the shapes, 40_quests resolves lazily):
   1. a three-step side chain per region (kill → collect → reach/talk), given by a named person at the region's seat or main town, the last
      step pays an item of the region's level and the chain's one gem purse;   ids qc_<region>_1..3, givers qn_<poi>_<role>
   2. one or two local quests at every town / castle / village / farm / inn / tower with people in it: bounties on the region's spawn-table
      mobs, lost goods taken back from a mob type, a delivery or an escort to the nearest place on the road;   ids ql_<poi>_1..2
   3. a Notice board (role 'board') in every town / served castle: three kill bounties on the region's mobs, repeat:true, rolled again each
      day by the date; a bounty taken keeps its mob until it is handed in;   ids qb_<poi>_1..3, boards qn_<poi>_board
   Never an existing id twice. Every kill / collect mob is in the region's spawn table, every giver / target / poi exists, every line <= 110.
   Daily reset (until 40_quests does it itself: R.quests.repeat): a turned board bounty from an earlier day is forgotten, the slot is rolled. */
(function () {
  const D = R.data = R.data || {}, WD = D.world; if (!WD || !Array.isArray(WD.pois)) return;
  if (!D.quests || typeof D.quests !== 'object') D.quests = [];
  if (!D.npcs || typeof D.npcs !== 'object') D.npcs = [];
  const QL = D.quests, NL = D.npcs, ARR_Q = Array.isArray(QL), ARR_N = Array.isArray(NL);
  const qHas = id => ARR_Q ? QL.some(q => q && q.id === id) : !!QL[id];
  const nHas = id => ARR_N ? NL.some(n => n && n.id === id) : !!NL[id];
  const story = D.story = D.story || {}; story.dialogs = story.dialogs || {};
  const pois = WD.pois, poiById = WD.poiById || {}; if (!WD.poiById) for (const p of pois) poiById[p.id] = p;
  const regions = WD.regions || [], regionById = WD.regionById || {}; if (!WD.regionById) for (const r of regions) regionById[r.id] = r;
  const spawnOf = rid => { const s = WD.spawnsByRegion ? WD.spawnsByRegion[rid] : (WD.spawns || []).find(x => x.region === rid); return s && Array.isArray(s.mobs) ? s.mobs : []; };
  const spawns = rid => spawnOf(rid).map(m => m.type);
  const wnpcs = () => { const N = WD.npcs || {}; return Array.isArray(N) ? N : Object.values(N); };
  const MOBS = D.mobs || {};
  const hash = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const pick = (arr, key) => arr[hash(key) % arr.length];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const xpL = L => { const B = D.balance; if (B && typeof B.xp === 'function') return B.xp(L); return Math.round(80 + 45 * L + 6 * L * L + 0.15 * Math.pow(L - 1, 3)); };
  const mobName = k => (MOBS[k] && MOBS[k].name) || String(k).replace(/_/g, ' ');
  const plural = s => /child$/i.test(s) ? s + 'ren' : /man$/i.test(s) ? s.replace(/man$/i, 'men') : /wolf$/i.test(s) ? s.replace(/f$/, 'ves') : /(ch|sh|x|s)$/i.test(s) ? s + 'es' : s + 's';
  const mobs = (k, n) => n === 1 ? mobName(k).toLowerCase() : plural(mobName(k)).toLowerCase();
  const Cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const tierOf = k => { const t = MOBS[k] && MOBS[k].tier; return typeof t === 'number' ? t : 2; };
  const countFor = (k, base) => clamp(Math.round(base - 1.2 * (tierOf(k) - 1) - (MOBS[k] && /elite|brute/.test(MOBS[k].role) ? 1 : 0)), 3, 10);
  const pname = id => (poiById[id] && poiById[id].name) || id;
  const shortName = id => pname(id).replace(/^The /, 'the ');

  /* ---- writers ---- */
  const added = { quests: [], npcs: [], boards: [] };
  const addNpc = n => { if (nHas(n.id)) return false; n.quests = n.quests || []; n.lines = n.lines || { greet: [], idle: [] }; n.services = n.services || [];
    if (ARR_N) NL.push(n); else NL[n.id] = n; if (D.npcById) D.npcById[n.id] = n; added.npcs.push(n.id);
    const g = n.lines.greet, i = n.lines.idle; const nodes = [{ text: g[0] || '...', choices: [] }];
    if (i.length) { nodes[0].choices.push({ t: 'Tell me something.', next: 1 }); nodes.push({ text: i[0], choices: i[1] ? [{ t: 'And?', next: 2 }, { t: 'Back', next: 0 }] : [{ t: 'Back', next: 0 }] }); if (i[1]) nodes.push({ text: i[1], choices: [{ t: 'Back', next: 0 }] }); }
    nodes[0].choices.push({ t: 'Leave', close: true }); if (!story.dialogs[n.id]) story.dialogs[n.id] = nodes; return true; };
  const byNpc = id => (ARR_N ? NL.find(n => n && n.id === id) : NL[id]) || null;
  const addQuest = q => { if (!q || qHas(q.id)) return false; if (ARR_Q) QL.push(q); else QL[q.id] = q; if (D.questById) D.questById[q.id] = q; added.quests.push(q.id);
    const g = byNpc(q.giver); if (g && g.quests && g.quests.indexOf(q.id) < 0) g.quests.push(q.id); return true; };
  const reward = (L, mul, n, k, x) => Object.assign({ xp: Math.round(xpL(L) * mul), gold: Math.round(k * L * Math.max(1, n)) }, x || {});
  const quest = (o) => { const q = { id: o.id, title: o.title, main: false, prev: o.prev || null, lvl: o.lvl, type: o.type, poi: o.poi, giver: o.giver, target: o.target, n: o.n || 1,
      region: o.region, text: { offer: o.offer, progress: o.progress, done: o.done }, reward: o.reward, q1: o.kind || 'local' };
    if (o.from) q.from = o.from; if (o.to) q.to = o.to; if (o.repeat) { q.repeat = true; q.reset = 'daily'; } if (o.pool) q.pool = o.pool; if (o.board) q.board = o.board; return q; };

  /* ---- who stands where: the visible roster per POI (42_dialog drops a world NPC whose role a story NPC at the same place covers) ---- */
  const COVER = { lord: ['lord', 'steward'], steward: ['lord', 'steward'], maester: ['maester'], innkeeper: ['innkeeper', 'inn'], smith: ['smith'], merchant: ['shop'],
    septon: ['septon'], elder: ['elder'], ranger: ['ranger'], guard: ['guard'] };
  const storyAt = pid => (ARR_N ? NL : Object.values(NL)).filter(n => n && n.poi === pid);
  const coverAt = pid => { const h = new Set(); for (const n of storyAt(pid)) { h.add(n.kind || String(n.role || '').toLowerCase()); h.add(String(n.role || '').toLowerCase()); for (const s of (n.services || [])) h.add(s); if (n.lines && n.lines.inn) h.add('inn'); } return h; };
  const visibleAt = pid => { const h = coverAt(pid); const w = wnpcs().filter(n => n && n.poi === pid && !(COVER[String(n.role || n.kind || '').toLowerCase()] || [String(n.role || n.kind || '').toLowerCase()]).some(x => h.has(x)));
    return storyAt(pid).filter(n => !n.champ).concat(w); };
  const rolesAt = pid => { const s = new Set(); for (const n of storyAt(pid).concat(wnpcs().filter(n => n && n.poi === pid))) { s.add(String(n.role || '').toLowerCase()); if (n.kind) s.add(String(n.kind).toLowerCase()); } return s; };
  const freeRole = (pid, pref) => { const r = rolesAt(pid); return pref.find(x => !r.has(x)) || null; };

  /* ---- names (original, by land) ---- */
  const FIRST = { north: ['Brannet', 'Hild', 'Osric', 'Wenna', 'Torvin', 'Maera', 'Gerold', 'Ysolde', 'Harl', 'Sigrun'], farnorth: ['Ulfric', 'Brena', 'Hrothi', 'Kell', 'Morna', 'Skaldor', 'Edda', 'Borr'],
    wall: ['Brother Aldous', 'Brother Fenn', 'Brother Cole', 'Brother Jory', 'Brother Ham'], beyond: ['Ygra', 'Tormun', 'Halla', 'Rask', 'Vel', 'Orrin'], winter: ['Halder', 'Sevrin'],
    westcoast: ['Corwen', 'Ailsa', 'Jarred', 'Mab', 'Tobin', 'Nessa'], ironislands: ['Gorm', 'Asha Saltbone', 'Dagon', 'Rolla', 'Ulric', 'Thora'],
    riverlands: ['Willem', 'Bessa', 'Merrit', 'Jonah', 'Lisbet', 'Hob', 'Perrin', 'Dena', 'Alton', 'Marsa'], vale: ['Corbin', 'Elinor', 'Hugor', 'Mya', 'Lothar', 'Rhea', 'Shadd'],
    crownlands: ['Tomas', 'Elyse', 'Garret', 'Bryony', 'Rafe', 'Clarice', 'Owen', 'Jenna'], westerlands: ['Lyman', 'Cerise', 'Damon', 'Joanna', 'Addam', 'Maris', 'Tybolt'],
    reach: ['Mathis', 'Rosamund', 'Edwyn', 'Leyla', 'Alester', 'Merry', 'Talbert', 'Bethany', 'Garth', 'Alys'], stormlands: ['Rolland', 'Cassana', 'Edric', 'Bryce', 'Wylla', 'Herbert'],
    dorne: ['Qoren', 'Arianne', 'Manfrey', 'Elia', 'Deziel', 'Larra', 'Anders', 'Mellei'], dragonstone: ['Alyn', 'Rhaella', 'Monford', 'Laena', 'Ardrian'] };
  const ROLE_WORD = { hunter: 'the hunter', farmer: 'the farmer', guard: 'of the watch', elder: 'the elder', merchant: 'the trader', innkeeper: 'the alewife', smith: 'the smith' };
  const KIND = { hunter: 'hunter', farmer: 'farmer', guard: 'guard', elder: 'elder', merchant: 'villager', innkeeper: 'villager', smith: 'villager', board: 'board' };
  let nameN = 0; const personName = (rid, role, key) => { const L = FIRST[rid] || FIRST.north; return L[(hash(key) + nameN++) % L.length] + ' ' + (ROLE_WORD[role] || 'the ' + role); };

  /* ---------------- 1. the region chains (hand-written) ----------------
     each: giver {poi, role, name, greet[], idle[]}, steps [kill, collect, reach|talk] with mob keys from the region's table */
  const CH = {
    dorne: { poi: 'sunspear', role: 'guard', name: 'Daemara of the Spear Gate', greet: ['The gate is mine from dusk to dawn. Speak quickly.', 'Sand in your boots. You came the long road.'],
      idle: ['Bandits follow the dead like gulls follow boats. They pick what the dead leave.', 'The Boneway was a road once. Now it is a promise.'],
      s: [{ t: 'Gate duty', type: 'kill', mob: 'bandit', n: 8, off: ['Bandits wait in the dunes for the dead to thin a caravan. Then they take the rest.', 'Eight of them. Make the dunes a bad place to wait.'], pr: 'Bandits put down in the dunes', dn: 'Eight. The caravans will notice before the bandits do.' },
        { t: 'Water for the gate', type: 'collect', item: 'stolen_waterskin', from: 'bandit_archer', n: 6, off: ['The bandit archers took our gate waterskins. In Dorne that is a killing matter.', 'Six skins. The guards drink at noon or they fall at dusk.'], pr: 'Waterskins taken back', dn: 'Six. The gate drinks. I will remember which of you walks it.' },
        { t: 'The Salt Shore watch', type: 'reach', poi: 'saltshore', off: ['The watch at Salt Shore lit no fire last night. Walk there and look.', 'If there is no one, come back and tell me. Do not stay.'], pr: 'Reach Salt Shore', dn: 'They lit it late; the oil had gone sour. Take this. You earned the walk.' }] },
    reach: { poi: 'highgarden', role: 'hunter', name: 'Maelys of the Rose Hedge', greet: ['Mind the hedge. It has thorns and so do I.', 'The gardens grow spears now. I hunt what comes for them.'],
      idle: ['Boars root under the dead. The dead root under the boars. Nobody eats well.', 'The Mander floods in spring. This spring it carried more than water.'],
      s: [{ t: 'Hedge hogs', type: 'kill', mob: 'boar', n: 6, off: ['Dead boars break the hedges at night and the dead follow through the gaps.', 'Six of them. The gardeners cannot plant behind a broken hedge.'], pr: 'Dead boars put down', dn: 'Six. The hedge holds. I will call that a harvest.' },
        { t: 'Seed for the spring', type: 'collect', item: 'seed_sack', from: 'bandit', n: 6, off: ['Bandits stole the seed sacks from the river barns. Seed, not gold. They are hungry too.', 'Six sacks back, or there is no next year.'], pr: 'Seed sacks taken back', dn: 'Six. The barns are full of next year again.' },
        { t: 'Word to the Cider Hall', type: 'reach', poi: 'ciderhall', off: ['Cider Hall needs to know the seed is safe. Ravens are scarce. You are not.', 'Walk the road east and show yourself at the gate.'], pr: 'Reach Cider Hall', dn: 'They will plant. And they sent a cask, which I will guard with my life.' }] },
    stormlands: { poi: 'stormsend', role: 'hunter', name: 'Tarwin Rainwood', greet: ['Rain again. It hides the tracks and the trackers.', 'The rainwood is wet and full. Speak.'],
      idle: ['Elk do not run from the dead. Dead elk run at you.', 'Every storm brings something up the stair. Every storm.'],
      s: [{ t: 'Rainwood elk', type: 'kill', mob: 'elk', n: 4, off: ['Dead elk crash through the rainwood and trample whatever runs from them.', 'Four. Big as carts. Mind the antlers.'], pr: 'Undead elk put down', dn: 'Four. The woodcutters can go back in. Some of them will.' },
        { t: 'Broken bowstrings', type: 'collect', item: 'stolen_bowstring', from: 'bandit_archer', n: 6, off: ['Bandit archers robbed my fletcher. Every string he waxed this winter.', 'Six bundles. I cannot hunt with sticks.'], pr: 'Bowstrings taken back', dn: 'Six. The fletcher wept. Rain on his face, he said.' },
        { t: 'Bronzegate road', type: 'reach', poi: 'bronzegate', off: ['Bronzegate has not sent a rider in a week. The road runs west through the wood.', 'Walk it. Mark what still stands.'], pr: 'Reach Bronzegate', dn: 'Standing, wet and stubborn. Like everything here. Here is your due.' }] },
    westerlands: { poi: 'casterly', role: 'guard', name: 'Ser Arlan of the Lion Gate', greet: ['The Lion Gate opens for coin, for swords and for news.', 'Gold on the walls and rot in the shafts. Speak.'],
      idle: ['The hill outlaws pay in stolen gold. Everyone knows whose gold.', 'Bats from the mines come out at dusk. The miners do not.'],
      s: [{ t: 'Shaft bats', type: 'kill', mob: 'bat', n: 8, off: ['Bats from the deep shafts fly out at dusk and bite the night watch grey.', 'Eight. Shoot them, swat them, I do not care.'], pr: 'Cave bats put down', dn: 'Eight. The watch slept in turns last night instead of not at all.' },
        { t: 'Tithe of the Rock', type: 'collect', item: 'gold_tithe', from: 'bandit', n: 6, off: ['Bandits robbed the tithe wagon on the Golden Tooth road. Lion gold.', 'Six purses. The Rock does not forget a debt, and neither do I.'], pr: 'Tithe purses taken back', dn: 'Six. The steward counted twice and smiled once. Rare.' },
        { t: 'The Golden Tooth', type: 'reach', poi: 'goldentooth', off: ['The Golden Tooth guards the pass east. Ride up and tell them the road is clear.', 'They will not believe it. Tell them anyway.'], pr: 'Reach the Golden Tooth', dn: 'They believed you. Mostly. Take this, from the gate.' }] },
    ironislands: { poi: 'pyke', role: 'hunter', name: 'Saltmother Ygrid', greet: ['The tide brought you. The tide brings everything now.', 'Wet rock, cold wind. Speak while the gulls are quiet.'],
      idle: ['Wildling raiders took longships south. Somebody has to sink them.', 'The drowned shore keeps what it takes. Not lately.'],
      s: [{ t: 'Raiders on the rocks', type: 'kill', mob: 'raider', n: 6, off: ['Raiders from the cold coasts beach their boats in our coves and take our salt.', 'Six of them. Show them we do not trade.'], pr: 'Raiders put down on the rocks', dn: 'Six. Their boats burn well. The coves are ours again.' },
        { t: 'Nets of the drowned', type: 'collect', item: 'fishing_net', from: 'axe', n: 6, off: ['The drowned walk up the shingle still tangled in our nets. Good nets.', 'Cut six free and bring them. I will mend what I can.'], pr: 'Nets cut from the drowned', dn: 'Six nets. The boats go out at dawn. Half of them.' },
        { t: 'Old Wyk', type: 'reach', poi: 'old_wyk', off: ['Old Wyk has the oldest stones on the islands. Sail across and see if the hall stands.', 'Take an oar. The ferryman lost his.'], pr: 'Reach Old Wyk', dn: 'Still standing. The old stones never move. Take this for the crossing.' }] },
    dragonstone: { poi: 'dragonstone', role: 'guard', name: 'Velaryn of the Sea Gate', greet: ['Black rock, black sand, black news. Speak.', 'The sea gate is shut. You came by the stair. Brave or lost.'],
      idle: ['Ravens on the island are dead and still flying. They watch the harbour.', 'Wraiths came in with the fog. Twice now.'],
      s: [{ t: 'Dead ravens', type: 'kill', mob: 'raven', n: 6, off: ['Dead ravens sit on the towers and watch the harbour for something.', 'Six. Knock them off the towers before they report.'], pr: 'Dead ravens brought down', dn: 'Six. Whatever they watched for, it is blind now.' },
        { t: 'Glass from the crawlers', type: 'collect', item: 'obsidian_shard', from: 'crawler', n: 6, off: ['Crawlers drag themselves out of the glass caves with shards stuck in them.', 'Six shards. The smith will turn them into edges.'], pr: 'Obsidian shards taken', dn: 'Six. Ugly work, good glass. The smith will want more.' },
        { t: 'The Stone Drum', type: 'reach', poi: 'sh_dragonstone', off: ['The septon at the Stone Drum rings for the watch each night. He did not ring last night.', 'Climb to the sept and see.'], pr: 'Reach the Stone Drum Sept', dn: 'The rope froze. Frozen, here, on a fire island. Take this. Tell no one.' }] },
    north: { poi: 'winterfell', role: 'guard', name: 'Harwin Greyfield', greet: ['Eyes on the wolfswood. Words to me.', 'Snow on the battlements. Snow in summer. Speak.'],
      idle: ['Ice spiders came south of the Barrowlands. Nobody has seen that.', 'The barrows hold old kings. The old kings do not hold still.'],
      s: [{ t: 'Spiders in the snow', type: 'kill', mob: 'spider', n: 5, off: ['Ice spiders web the road to the Barrowlands. They should not live this far south.', 'Five of them. Burn the webs if you can.'], pr: 'Ice spiders put down', dn: 'Five. The road is clear, and the webs burned blue. That is not right either.' },
        { t: 'Barrow tokens', type: 'collect', item: 'barrow_token', from: 'sword', n: 6, off: ['The dead swordsmen carry bronze tokens from the barrows. The maester wants to read them.', 'Six. Do not keep any. They are cold for a reason.'], pr: 'Barrow tokens taken', dn: 'Six. Cold as a well in winter. The maester will be up all night.' },
        { t: 'Barrowton', type: 'reach', poi: 'barrowton', off: ['Barrowton sits on the first king. If anyone knows what the tokens mean, they do.', 'Ride south and west. Ask, and look.'], pr: 'Reach Barrowton', dn: 'They knew. They will not say. Here; Winterfell pays for the ride.' }] },
    crownlands: { poi: 'kingslanding', role: 'guard', name: 'Captain Hollard of the Mud Gate', greet: ['Mud Gate. Mud, gate, me. Speak.', 'The city eats news. Feed me some.'],
      idle: ['Riders on the kingsroad charge the carts at dusk. Dead riders.', 'A necromancer walks the Kingswood. A living one, which is worse.'],
      s: [{ t: 'The kingsroad riders', type: 'kill', mob: 'rider', n: 6, off: ['Dead riders charge the carts on the kingsroad. The city eats what the carts carry.', 'Six riders. The horses too, if you can.'], pr: 'Wight riders put down', dn: 'Six. The carts came in this morning. The city ate.' },
        { t: 'The necromancer\'s bones', type: 'collect', item: 'carved_bone', from: 'necro', n: 4, off: ['Cold necromancers carry carved bones. The Great Sept wants them burned in the open.', 'Four of the bones. Do not read the carvings.'], pr: 'Carved bones taken', dn: 'Four. The septons burned them at noon. The smoke was the wrong colour.' },
        { t: 'Duskendale gate', type: 'talk', npc: 'dk_reeve', poi: 'duskendale', off: ['The reeve of Duskendale owes the city grain and an answer.', 'Ride up the coast and ask him for both. He will give one.'], pr: 'Speak with the reeve of Duskendale', dn: 'An answer and no grain. Typical. Still, you rode. Take this.' }] },
    westcoast: { poi: 'flintsfinger', role: 'hunter', name: 'Brynn Saltcliffe', greet: ['Stony shore, stony people. Speak.', 'Ironborn landings to the south, skinchangers to the north. Pick one.'],
      idle: ['Shadowcats came down from the hills. They hunt the dead now. And us.', 'A skinchanger rides a cat and a wolf at once. I saw it.'],
      s: [{ t: 'Cats on the cliffs', type: 'kill', mob: 'cat', n: 5, off: ['Shadowcats came down from the hills and took the goats off the cliffs.', 'Five of them. The pelts are yours. The goats are mine.'], pr: 'Shadowcats put down', dn: 'Five. The goats came back on their own. Goats.' },
        { t: 'Raider plunder', type: 'collect', item: 'stolen_salt', from: 'raider', n: 6, off: ['Raiders took our salt barrels off the shore. Salt is how the fish keep.', 'Six barrels back. They are heavy. Roll them.'], pr: 'Salt barrels taken back', dn: 'Six. The smokehouse fires again. The coast eats this winter.' },
        { t: 'The Weirwood of the Shore', type: 'reach', poi: 'sh_coast', off: ['The old tree on the shore weeps red at night. The fishers will not pass it.', 'Walk out and look. Then tell them it is only a tree.'], pr: 'Reach the Weirwood of the Shore', dn: 'Only a tree, you say. I will tell them. Take this for lying well.' }] },
    riverlands: { poi: 'riverrun', role: 'hunter', name: 'Ferris Blackreed', greet: ['Three rivers and I fish all of them. Speak.', 'Wet boots, sharp hook. What do you want?'],
      idle: ['Spiders web the reeds at the Trident. Frost spiders, in the riverlands.', 'The crypt wights came out of the flooded septs.'],
      s: [{ t: 'Webs in the reeds', type: 'kill', mob: 'spider', n: 6, off: ['Ice spiders web the reeds by the fords. The fishers walk into them at dawn.', 'Six. Burn the webs or cut them; just make the fords safe.'], pr: 'Ice spiders put down at the fords', dn: 'Six. The fishers waded in this morning. Nobody got stuck.' },
        { t: 'Sept silver', type: 'collect', item: 'sept_silver', from: 'crypt', n: 6, off: ['Crypt wights walked out of the flooded septs carrying the sept silver.', 'Six pieces. The septons will bless whoever brings it home.'], pr: 'Sept silver taken back', dn: 'Six. Blessed, polished and locked away. Here is the blessing, in coin.' },
        { t: 'The Stoney Sept bells', type: 'reach', poi: 'stoneysept', off: ['Stoney Sept rings the bells when the dead are near. They have rung all week.', 'Go and see if anyone is still pulling the ropes.'], pr: 'Reach Stoney Sept', dn: 'Still ringing. Still alive. Take this; it is from all three rivers.' }] },
    vale: { poi: 'eyrie', role: 'hunter', name: 'Corra of the High Road', greet: ['Mind the edge. The wind pushes.', 'The high road is a ledge with ambitions. Speak.'],
      idle: ['Mountain chieftains raid the road again, dead men or no.', 'Brown bears woke early. They are hungry and they are not dead.'],
      s: [{ t: 'Clan raiders', type: 'kill', mob: 'raider', n: 7, off: ['Mountain raiders hit the mule trains on the high road while the dead keep the knights busy.', 'Seven of them. The mules have suffered enough.'], pr: 'Raiders put down on the high road', dn: 'Seven. The mules passed this morning. They looked grateful. Mules.' },
        { t: 'Bear grease', type: 'collect', item: 'bear_fat', from: 'brownbear', n: 4, off: ['The castle needs grease for the winch. Brown bears have plenty and give none.', 'Four rendered pots. Hunt carefully; they are alive and angry.'], pr: 'Bear fat taken', dn: 'Four. The winch sings again. The cells will have bread.' },
        { t: 'The Bloody Gate', type: 'reach', poi: 'bloody_gate', off: ['The Bloody Gate holds the road into the Vale. Walk down and report the road.', 'If it is closed, knock. Politely.'], pr: 'Reach the Bloody Gate', dn: 'Open, and suspicious of you. Good. Here is your due.' }] },
    farnorth: { poi: 'dreadfort', role: 'hunter', name: 'Skagga Bone-Ear', greet: ['Far north. Far from help. Speak.', 'The keep went dark first. I did not.'],
      idle: ['Direwolves run in packs out of the wolfswood. Living ones.', 'Necromancers came over the ice with the walkers. They keep to the dark.'],
      s: [{ t: 'Living wolves', type: 'kill', mob: 'direwolf', n: 4, off: ['Direwolves, living, hungry and pushed south by the cold. They take the dogs first.', 'Four. Big ones. They lead the packs.'], pr: 'Direwolves put down', dn: 'Four. The packs scattered. The dogs barked all night, happy.' },
        { t: 'Black candles', type: 'collect', item: 'black_candle', from: 'necro', n: 4, off: ['The necromancers burn black candles to wake the dead. Take the candles. Then the hands.', 'Four. Do not light them.'], pr: 'Black candles taken', dn: 'Four. Burned in the yard, in daylight. The smoke went north.' },
        { t: 'Karhold riders', type: 'reach', poi: 'karhold', off: ['Karhold faces the frozen sea. The lord there wants to know the road west is open.', 'Ride to Karhold. Tell him what you have killed.'], pr: 'Reach Karhold', dn: 'He laughed. Karstarks laugh at good news. Take this.' }] },
    wall: { poi: 'castleblack', role: 'guard', name: 'Brother Odo of the Stair', greet: ['Seven hundred feet of ice. I count the steps. Speak.', 'The stair is mine. The wind is the Wall\'s.'],
      idle: ['Giants climb. Dead giants climb slower but they do not stop.', 'Broodmothers lay in the old tunnels. We burn what we find.'],
      s: [{ t: 'Climbers', type: 'kill', mob: 'giant', n: 3, off: ['Dead giants try the Wall at night. They climb slowly, but they never stop climbing.', 'Three. Meet them at the foot of the ice.'], pr: 'Wight giants put down at the Wall', dn: 'Three. The ice held. So did you. Rare pairing.' },
        { t: 'Shards of the Gift', type: 'collect', item: 'frozen_heart', from: 'wraith', n: 5, off: ['Ice wraiths leave frozen hearts where they die. The maester wants them for his glass.', 'Five. Wrap them; they burn the hand.'], pr: 'Frozen hearts taken', dn: 'Five, still cold. The maester is happy. That frightens me more than wraiths.' },
        { t: 'Eastwatch road', type: 'reach', poi: 'eastwatch', off: ['Eastwatch-by-the-Sea needs word from the Lord Commander. Ravens freeze.', 'Walk the road east along the Wall.'], pr: 'Reach Eastwatch-by-the-Sea', dn: 'They have boats and no men. We have men and no boats. Take this.' }] },
    beyond: { poi: 'fist_of_first_men', role: 'hunter', name: 'Thorra the free woman', greet: ['Kneeler with a blade. Fine. Speak.', 'Beyond the Wall you talk fast or you talk to the dead.'],
      idle: ['Mammoths walk dead in herds. The ground shakes.', 'Spearwives who fell came back with their spears. They remember how.'],
      s: [{ t: 'Dead spearwives', type: 'kill', mob: 'spearwife', n: 6, off: ['My sisters who fell came back with their spears. Put them down. They would want it.', 'Six. Quickly, if you can.'], pr: 'Spearwives laid to rest', dn: 'Six. I will name them at the fire tonight.' },
        { t: 'Mammoth ivory', type: 'collect', item: 'mammoth_ivory', from: 'mammoth', n: 3, off: ['Dead mammoths carry tusks we can carve into spears that do not break in the cold.', 'Three tusks. They are heavy. You are strong.'], pr: 'Mammoth tusks taken', dn: 'Three. Spears for a whole camp. The free folk thank you, which they never do.' },
        { t: 'Hardhome', type: 'reach', poi: 'hardhome', off: ['Hardhome is far east by the sea. My people wait there for boats.', 'Walk there. Tell them the Fist still holds.'], pr: 'Reach Hardhome', dn: 'They heard you. They will wait one more week. Take this.' }] },
    winter: { poi: 'sh_winter', role: 'hunter', name: 'Halder, who walked too far', greet: ['You came this far too. Then we are both fools. Speak.', 'The Ice Ring is the last warm place. It is not warm.'],
      idle: ['Shades move without sound. Count your breaths, not your steps.', 'Walkers keep their own hours. All of them are night.'],
      s: [{ t: 'Silent shades', type: 'kill', mob: 'shade', n: 4, off: ['Cold shades drift round the Ice Ring at night and take whoever sleeps.', 'Four. Keep your torch high.'], pr: 'Cold shades put down', dn: 'Four. I slept an hour. The first in a month.' },
        { t: 'Walker steel', type: 'collect', item: 'pale_shard', from: 'walker', n: 3, off: ['White Walkers carry blades of pale ice. Broken, they keep an edge forever.', 'Three shards. The Wall will want them.'], pr: 'Pale shards taken', dn: 'Three. Wrapped in fur and still biting. Take this; I have no use for gold.' },
        { t: 'The caves', type: 'reach', poi: 'dg_caves', off: ['The caves under the Frostfangs breathe out the cold. Find the mouth and mark it.', 'Do not go in. Not yet.'], pr: 'Reach the caves under the Frostfangs', dn: 'Marked. The cold comes from there. Now we both know. Take this.' }] } };

  const chainLvls = r => { const a = r.lvl[0], b = r.lvl[1], w = b - a; return [a + Math.round(w * 0.2), a + Math.round(w * 0.4), a + Math.round(w * 0.65)].map(v => clamp(v, a, b)); };
  for (const r of regions) { const c = CH[r.id]; if (!c || !poiById[c.poi]) continue; const tbl = spawns(r.id); if (!tbl.length) continue;
    const gid = 'qn_' + c.poi + '_' + c.role; const fit = m => tbl.indexOf(m) >= 0 ? m : spawnOf(r.id).slice().sort((x, y) => y.w - x.w)[0].type;
    addNpc({ id: gid, name: c.name, role: c.role, kind: KIND[c.role] || 'villager', label: c.role === 'guard' ? 'Gate warden' : 'Hunter', poi: c.poi, house: null, sprite: 'npc:' + (KIND[c.role] || 'villager'),
      lines: { greet: c.greet, idle: c.idle }, services: [], q1: 'chain' });
    const L = chainLvls(r); let prev = null;
    c.s.forEach((s, i) => { const id = 'qc_' + r.id + '_' + (i + 1), last = i === c.s.length - 1, lv = L[i];
      const o = { id, title: s.t, lvl: lv, type: s.type, poi: c.poi, giver: gid, region: r.id, prev, offer: s.off, progress: s.pr, done: s.dn, kind: 'chain', n: s.n || 1 };
      if (s.type === 'kill') o.target = fit(s.mob); else if (s.type === 'collect') { o.target = s.item; o.from = fit(s.from); } else if (s.type === 'reach') o.target = s.poi; else if (s.type === 'talk') o.target = s.npc;
      if (s.type === 'talk' && !byNpc(s.npc)) { o.type = 'reach'; o.target = s.poi; }
      const k = o.type === 'kill' || o.type === 'collect' ? 4 : 10;
      o.reward = reward(lv, last ? 0.6 : 0.45, o.n, k, last ? { item: { rar: 2, name: 'Rare item' }, gems: 3 } : null);
      if (addQuest(quest(o))) prev = id; else prev = qHas(id) ? id : prev; }); }

  /* ---------------- 2. local quests at every place with people ---------------- */
  const SETTLED = /^(town|castle|village|farm|inn|tower|fishing)$/;
  const regionPois = rid => pois.filter(p => p.region === rid);
  const nearestTo = (p, list) => { let b = null, bd = Infinity; for (const q of list) { if (q.id === p.id) continue; const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < bd) { bd = d; b = q; } } return b; };
  const GOODS = { village: ['grain_sack', 'wool_bale', 'copper_pot', 'salt_box', 'well_bucket'], farm: ['seed_bag', 'plough_iron', 'milk_pail', 'harness_strap'], inn: ['ale_cask', 'silver_spoon', 'ledger_page'],
    tower: ['signal_horn', 'arrow_bundle', 'beacon_oil'], town: ['grain_sack', 'cloth_bolt', 'spice_pouch', 'salt_box', 'copper_pot'], castle: ['arrow_bundle', 'horseshoe', 'mail_shirt', 'grain_sack'],
    fishing: ['fishing_net', 'smoked_herring', 'tar_pot'] };
  const PARCEL = ['sealed letter', 'jar of honey', 'bundle of arrows', 'sack of salt', 'roll of linen', 'box of candles', 'pouch of herbs', 'wheel of cheese'];
  const T_KILL = [
    [p => ['{Mobs} on the road past ' + p + '. They took a cart and the man driving it.', 'Put down {n} of them and the village pays what it can.'], '{Mobs} put down near ' , '{n}. The road is quieter. Here, as promised.'],
    [p => ['Every night {mobs} come to the fence at ' + p + '. We count them. We cannot fight them.', 'Kill {n}. Then we sleep.'], '{Mobs} put down at the fence of ', '{n}. We slept last night, all of us. Take this.'],
    [p => ['{Mobs} took the field by ' + p + '. Nobody has harvested it in a week.', '{n} of them, and the scythes go back out.'], '{Mobs} cleared from the fields of ', '{n}. The scythes are out. So is the coin.']];
  const T_COLL = [
    [(p, it) => ['{Mobs} broke into the store at ' + p + ' and carried off our ' + it + '.', 'Bring back {n}. They have no use for them. We do.'], ' taken back for ', '{n}. Every one counted. You have our thanks and a little more.'],
    [(p, it) => ['The dead walked off with all our ' + it + ' at ' + p + '. Do not ask me how.', '{n} back would see us through the month.'], ' taken back for ', '{n}. That will see us through. Here.']];
  const T_DELIV = [(p, to, w, pc) => ['This ' + pc + ' must reach the ' + w + ' at ' + to + '. The road is bad.', 'Take it, keep it dry, and come back to tell me it arrived.'],
    (p, to, w, pc) => ['The ' + w + ' at ' + to + ' is owed a ' + pc + '. Nobody will walk it now.', 'You have a blade. Walk it for us.']];
  const T_ESC = [(p, to) => ['My niece goes to work at ' + to + '. She will not walk the road alone, and I cannot leave.', 'Walk with her to the door there. She is quick; keep up.'],
    (p, to) => ['A peddler waits to walk to ' + to + '. He has paid for a sword and you are one.', 'Get him there with all his fingers.']];
  const wordOf = n => { const r = String(n.role || n.kind || '').toLowerCase(); return { lord: 'lord', steward: 'steward', elder: 'elder', innkeeper: 'innkeeper', innkeep: 'innkeeper', merchant: 'trader', smith: 'smith', septon: 'septon',
    maester: 'maester', guard: 'warden', ranger: 'ranger', hunter: 'hunter', farmer: 'farmer', arms: 'master-at-arms', board: 'clerk' }[r] || 'keeper'; };
  const placeType = p => p.fishing ? 'fishing' : p.type;
  const localLvl = (p, r) => { const hub = poiById[r.hub] || poiById[r.home] || p; const L = regionPois(r.id); let dmax = 1; for (const q of L) dmax = Math.max(dmax, Math.hypot(q.x - hub.x, q.y - hub.y));
    const f = Math.hypot(p.x - hub.x, p.y - hub.y) / dmax; return clamp(Math.round(r.lvl[0] + (r.lvl[1] - r.lvl[0]) * (0.15 + 0.75 * f)), r.lvl[0], r.lvl[1]); };
  const fill = (s, mob, n) => s.replace(/\{Mobs\}/g, Cap(mobs(mob, n))).replace(/\{mobs\}/g, mobs(mob, n)).replace(/\{n\}/g, String(n));
  const LOCAL_ROLES = ['hunter', 'farmer', 'guard', 'elder'];
  // pass 1: a named local in R.data.npcs for the old places (a role nobody holds there); the new villages keep their own people
  const givers = {};
  for (const r of regions) { if (!spawnOf(r.id).length) continue;
    for (const p of regionPois(r.id).filter(p => (SETTLED.test(placeType(p)) || p.village) && !p.village)) { let giver = null;
      { const role = freeRole(p.id, p.type === 'town' ? ['elder', 'hunter', 'farmer', 'guard'] : p.type === 'castle' ? ['guard', 'hunter', 'farmer'] : LOCAL_ROLES);
        if (role) { const id = 'qn_' + p.id + '_' + role; const nm = personName(r.id, role, p.id);
          const greet = [Cap(shortName(p.id)) + ' has not seen many swords this year. Yours is welcome.', 'You walk like someone who has been on the road. Sit a moment.'];
          const idle = [role === 'farmer' ? 'The fields need hands. The hands need sleep. Nobody sleeps.' : role === 'hunter' ? 'Tracks by the stream this morning. Not deer. Not anything alive.' : role === 'guard' ? 'I watch the road. The road watches back these days.' : 'I am old enough to remember quiet years. This is not one.',
            'If you are going on, stay off the road at dusk.'];
          if (addNpc({ id, name: nm, role, kind: KIND[role], label: Cap(role === 'guard' ? 'warden' : role), poi: p.id, house: null, sprite: 'npc:' + KIND[role], lines: { greet, idle }, services: [], q1: 'local' }) || byNpc(id)) giver = id; } }
      if (giver) givers[p.id] = giver; } }
  // pass 2: the quests (the roster is fixed now: one visible list per place)
  const VIS = {}; const vis = pid => VIS[pid] || (VIS[pid] = visibleAt(pid).filter(n => !n.board && n.role !== 'board'));
  for (const r of regions) { const tbl = spawnOf(r.id); if (!tbl.length) continue; const keys = tbl.map(m => m.type);
    const settled = regionPois(r.id).filter(p => SETTLED.test(placeType(p)) || p.village), others = regionPois(r.id).filter(q => vis(q.id).length);
    for (const p of settled) {
      let giver = givers[p.id] || null;
      if (!giver) { const V = vis(p.id), cand = V.find(n => /elder|farmer|hunter|guard|innkeeper|steward/.test(String(n.role))) || V[0]; giver = cand ? cand.id : null; }
      if (!giver) continue;
      const lv = localLvl(p, r), key = p.id, out = [];
      // (a) a bounty on a mob of the region (b) lost goods from a mob (c) a delivery / escort to the nearest place with people
      const mob = pick(keys, key + ':k'), n = countFor(mob, 8);
      const tk = pick(T_KILL, key + ':tk');
      out.push({ id: 'ql_' + p.id + '_1', title: 'Bounty at ' + pname(p.id), type: 'kill', target: mob, n, offer: tk[0](shortName(p.id)).map(s => fill(s, mob, n)), progress: fill(tk[1], mob, n) + shortName(p.id), done: fill(tk[2], mob, n), lvl: lv });
      const v = hash(key + ':2') % 3;
      if (v === 0) { const from = pick(keys.filter(k => k !== mob).length ? keys.filter(k => k !== mob) : keys, key + ':c'), it = pick(GOODS[placeType(p)] || GOODS.village, key + ':g'), m2 = countFor(from, 7);
        const tc = pick(T_COLL, key + ':tc'), iw = it.replace(/_/g, ' ');
        out.push({ id: 'ql_' + p.id + '_2', title: 'Lost ' + plural(iw), type: 'collect', target: it, from, n: m2, offer: tc[0](shortName(p.id), plural(iw)).map(s => fill(s, from, m2)), progress: Cap(plural(iw)) + tc[1] + shortName(p.id), done: fill(tc[2], from, m2), lvl: clamp(lv + 1, r.lvl[0], r.lvl[1]) }); }
      else { const to = nearestTo(p, others);
        if (to) { const tn = vis(to.id)[0] || null;
          if (v === 1 && tn) { const pc = pick(PARCEL, key + ':p'), w = wordOf(tn), td = pick(T_DELIV, key + ':td');
            out.push({ id: 'ql_' + p.id + '_2', title: Cap(pc) + ' for ' + shortName(to.id), type: 'talk', target: tn.id, n: 1, offer: td(shortName(p.id), shortName(to.id), w, pc), progress: 'Bring the ' + pc + ' to the ' + w + ' at ' + shortName(to.id), done: 'It arrived? Good. They will remember the road was walked.', lvl: clamp(lv + 1, r.lvl[0], r.lvl[1]) }); }
          else { const te = pick(T_ESC, key + ':te');
            out.push({ id: 'ql_' + p.id + '_2', title: 'The road to ' + shortName(to.id), type: 'escort', target: tn ? tn.id : to.id, to: to.id, n: 1, offer: te(shortName(p.id), shortName(to.id)), progress: 'Walk with them to ' + shortName(to.id), done: 'They sent word: arrived, whole, and complaining about the pace. Here.', lvl: clamp(lv + 1, r.lvl[0], r.lvl[1]) }); } } }
      for (const o of out) { if (o.type === 'escort' && !byNpc(o.target) && !wnpcs().some(n => n.id === o.target)) { o.type = 'reach'; o.target = o.to; delete o.to; }
        const k = o.type === 'kill' || o.type === 'collect' ? 3 : 8, mul = o.type === 'kill' || o.type === 'collect' ? 0.3 : 0.25;
        addQuest(quest(Object.assign(o, { poi: p.id, giver, region: r.id, kind: 'local', reward: reward(o.lvl, mul, o.n, k) }))); } } }

  /* ---------------- 3. notice boards: three daily bounties per town ---------------- */
  const dayKey = d => { d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const BOARD_LINES = { greet: ['Notices nailed over notices. Some ink is fresh.', 'A board of bounties, paid at the post by the clerk.'], idle: ['WANTED, says the top notice. Under it, in a child\'s hand: please.', 'The clerk comes at dawn to pay and at dusk to nail up more.'] };
  const boardTown = p => !p.village && (p.type === 'town' || (p.type === 'castle' && (p.inn || p.shop || p.smith || p.seat)));
  const roll = (q, day) => { const pool = q.pool || []; if (!pool.length) return; const start = hash(q.board + '|' + day) % pool.length, mob = pool[(start + q.slot) % pool.length], n = countFor(mob, 9 - q.slot);
    q.target = mob; q.n = n; q.title = 'Bounty: ' + Cap(mobs(mob, 2)); q.day = day;
    q.text = { offer: ['A fresh notice: ' + n + ' ' + mobs(mob, n) + ' seen near ' + shortName(q.poi) + '.', 'Put them down and the clerk at this board pays in coin.'],
      progress: Cap(mobs(mob, n)) + ' put down for the bounty', done: 'The clerk checks your tally against the notice and counts out the coin.' };
    q.reward = reward(q.lvl, 0.15, n, 2); };
  const today = dayKey(); const BOARDS = [];
  for (const r of regions) { const keys = spawns(r.id); if (keys.length < 3) continue;
    for (const p of regionPois(r.id).filter(boardTown)) { const bid = 'qn_' + p.id + '_board';
      addNpc({ id: bid, name: 'Notice board', role: 'board', kind: 'board', board: true, label: 'Bounties', poi: p.id, house: null, sprite: 'npc:board', lines: { greet: BOARD_LINES.greet.slice(), idle: BOARD_LINES.idle.slice() }, services: [], q1: 'board' });
      if (!byNpc(bid)) continue; added.boards.push(bid);
      const a = r.lvl[0], b = r.lvl[1];
      [0.2, 0.5, 0.8].forEach((f, slot) => { const id = 'qb_' + p.id + '_' + (slot + 1); if (qHas(id)) return;
        const q = quest({ id, title: 'Bounty', lvl: clamp(Math.round(a + (b - a) * f), a, b), type: 'kill', poi: p.id, giver: bid, region: r.id, target: keys[0], n: 1, offer: ['...'], progress: '', done: '', kind: 'board', repeat: true, pool: keys.slice(), board: bid, reward: {} });
        q.slot = slot; roll(q, today); if (addQuest(q)) BOARDS.push(q); }); } }

  /* ---- the daily reset (40_quests keeps a turned quest forever; a board bounty comes back the next day) ---- */
  const ACC = () => { try { if (R.acc) { const a = R.acc(); if (a) return a; } } catch (e) {} return R.state && R.state.acc; };
  const QS = () => { const a = ACC(); if (a) { const w = a.world || (a.world = {}); return w.quests || (w.quests = {}); } const p = R.state && R.state.p; return p ? (p.quests || (p.quests = {})) : null; };
  const dayOfT = t => t ? dayKey(new Date(t)) : null;
  let lastKey = null;
  const reset = force => { if (R.quests && R.quests.repeat) return;   // the engine does it itself
    const S = QS(); if (!S) return; const day = dayKey(), key = day + '|' + (ACC() ? 'a' : 'p'); if (!force && key === lastKey) return; lastKey = key; let changed = false;
    for (const q of BOARDS) { const s = S[q.id];
      if (s && s.st === 'turned' && (s.tday || dayOfT(s.t)) !== day) { delete S[q.id]; changed = true; }
      const s2 = S[q.id];
      if (s2 && (s2.st === 'open' || s2.st === 'done') && s2.pick) { if (q.target !== s2.pick.mob || q.n !== s2.pick.n || q.day !== s2.pick.day) { roll(q, s2.pick.day); changed = true; } }
      else if (!s2 && q.day !== day) { roll(q, day); changed = true; } }
    if (changed) { try { R.quests && R.quests.reset && R.quests.reset(); R.quests && R.quests.refresh && R.quests.refresh(); } catch (e) {} } };
  const isBoard = id => BOARDS.some(q => q.id === id);
  if (R.bus && R.bus.on) {
    R.bus.on('quest', (id, st) => { if (!isBoard(id)) return; const S = QS(), s = S && S[id]; if (!s) return; const q = BOARDS.find(x => x.id === id);
      if (st === 'open') s.pick = { mob: q.target, n: q.n, day: q.day || dayKey() }; if (st === 'turned') s.tday = dayKey(); });
    R.bus.on('tick1s', () => reset(false));
    R.bus.on('boot', () => reset(true)); R.bus.on('newhero', () => reset(true)); }
  // the xp curve of 80_balance (loaded later): rewards recomputed once every module ran
  const rescale = () => { const B = D.balance; if (!B || typeof B.xp !== 'function') return;
    for (const id of added.quests) { const q = ARR_Q ? QL.find(x => x && x.id === id) : QL[id]; if (!q || !q.reward || !q._xm) continue; q.reward.xp = Math.round(B.xp(q.lvl) * q._xm); }
    try { R.quests && R.quests.reset && R.quests.reset(); } catch (e) {} };
  for (const id of added.quests) { const q = ARR_Q ? QL.find(x => x && x.id === id) : QL[id]; if (q && q.reward && q.reward.xp) Object.defineProperty(q, '_xm', { value: q.reward.xp / xpL(q.lvl), enumerable: false, writable: true }); }
  if (typeof setTimeout === 'function') setTimeout(rescale, 0);
  R.questsMore = { added, boards: BOARDS, dayKey, roll, reset: () => reset(true), chains: Object.keys(CH) };
})();
