/* HOLDOR RPG — R.data.world (A07): the open map of Westeros on src/assets/westeros_1200.webp (1200×2048 px).
   World units = map px × 6 → 7200 × 12288. North is up. Every coordinate below is in WORLD UNITS.
   (The old game's stage pins MAPPOS were in a 720-px-wide copy of the same art: world = MAPPOS × 10.)

   Shape (read by 10_world.js and the UI modules):
     size [W,H] · regions [{id,name,lvl:[a,b],biome,col,poly,home,hub,boss,gate?:{after,boss,via,name},blurb}]
     pois [{id,name,type,x,y,region,house?,seat?,npcs:[ids],shop?,inn?,smith?,blurb}]  (type: castle | town | camp | dungeon | shrine | lair)
     roads [ [[x,y],…] with .id .name .kind ]  (+ roadsInfo [{id,name,kind,pts}])
     spawns [{region, mobs:[{type,w}], density, lvl:[a,b], pack:[min,max]}]  (+ spawnsByRegion)
     mask {w:60, h:102, cell:120, rows:[102 strings]}  '#' = sea / lake / ridge, '.' = walkable
     gates [{region, after, boss, via, name, homeOf}] · start {house: poiId} · wall {pts} · npcs {id:{id,name,role,poi,services}}
     helpers: inPoly, polyArea, regionAt, blocked, startPos, gateFor */
window.R = window.R || {}; R.data = R.data || {};
(function () {
  'use strict';
  const W = 7200, H = 12288, CELL = 120, MW = 60, MH = 102;

  /* ---------- houses (the seven; `seat` is the POI id). Another module may already own this: keep theirs. ---------- */
  const HOUSES = {
    stark: { id: 'stark', n: 'Stark', e: '🐺', words: 'Winter is coming', col: '#a9bdd0', col2: '#3b4a5a', seat: 'winterfell', region: 'north' },
    lannister: { id: 'lannister', n: 'Lannister', e: '🦁', words: 'Hear me roar', col: '#e3b661', col2: '#7a1d1d', seat: 'casterly', region: 'westerlands' },
    baratheon: { id: 'baratheon', n: 'Baratheon', e: '🦌', words: 'Ours is the fury', col: '#e0c14a', col2: '#23231f', seat: 'stormsend', region: 'stormlands' },
    targaryen: { id: 'targaryen', n: 'Targaryen', e: '🐉', words: 'Fire and blood', col: '#e14b4b', col2: '#1c1c1c', seat: 'dragonstone', region: 'dragonstone' },
    greyjoy: { id: 'greyjoy', n: 'Greyjoy', e: '🦑', words: 'We do not sow', col: '#d8b74a', col2: '#1f2a30', seat: 'pyke', region: 'ironislands' },
    tyrell: { id: 'tyrell', n: 'Tyrell', e: '🌹', words: 'Growing strong', col: '#7fd06a', col2: '#2f5a2a', seat: 'highgarden', region: 'reach' },
    martell: { id: 'martell', n: 'Martell', e: '☀️', words: 'Unbowed, unbent, unbroken', col: '#f08a3c', col2: '#7a2a1a', seat: 'sunspear', region: 'dorne' },
  };

  /* ---------- the sea mask, read from the art (src/rpg/tools/world_preview.js mask). Row r = y ∈ [r·120, r·120+120). ---------- */
  const SEA_ROWS = [
    '####..............................................#########.',
    '####........................................##....#########.',
    '####.......................................###...##########.',
    '####...........#######..................#######..##########.',
    '#####.........########..................###################.',
    '#######################.................###################.',
    '##############..######..................###################.',
    '###############.######......................###..##########.',
    '######################............................#########.',
    '#####################.............................##########',
    '########.####.#####................................########.',
    '#######....##.##..................................#########.',
    '#######.....####..................................#########.',
    '#########....##...................................#####.###.',
    '#########......................................##.########..',
    '#########......................................##.#####.###.',
    '########......................................############..',
    '#######.....................................###########.###.',
    '######....................................################..',
    '#######...................................#################.',
    '#######....................................################.',
    '#######....................................################.',
    '####.......................................################.',
    '###.........................................###############.',
    '###..........................................##############.',
    '##............................................#############.',
    '##............................................#############.',
    '##.............................................############.',
    '##................................................##########',
    '##..........................................###############.',
    '#####.......................................###############.',
    '######......................................###############.',
    '######......................................################',
    '#######.....................................###############.',
    '#########..................................################.',
    '##########................................#################.',
    '######.###.......................#.......##################.',
    '#####...#.......................###########################.',
    '####...........................############################.',
    '####..........................#######....###################',
    '###...........................#############################.',
    '####..........................#############################.',
    '#####.........................#############....############.',
    '###############..............#######.##..........##########.',
    '################..............###.##.............##########.',
    '#################................................##.#######.',
    '##################.................................########.',
    '#.###########.#####................................########.',
    '.##################..................................######.',
    '..###############...................................#..####.',
    '..##.#.##.######..................................#########.',
    '.####........#####................................##.######.',
    '.####......##.#####...................................#####.',
    '#..####....#######.................................########.',
    '###..##...###.###.................................#########.',
    '######.####.......................................#########.',
    '############......................................###.#####.',
    '############..........................................#####.',
    '#.#########..........................................######.',
    '###########.........................................#######.',
    '.#######.#..........................................#..####.',
    '.#######..........................................##...##...',
    '######...........................##.............###.........',
    '#####............................##...........###########...',
    '#####.........................................#######.#####.',
    '####.........................................##############.',
    '######.......................................####.#########.',
    '######.......................................##.#.########.#',
    '#####.........................................##############',
    '#####............................................#########..',
    '#####...........................................###########.',
    '####............................................##########..',
    '##.##............................................#########..',
    '#####.............................................#########.',
    '#####.............................................#########.',
    '#####............................................##########.',
    '#####...........................................##.########.',
    '#####..........................................###.########.',
    '######.........................................##...#######.',
    '######.............................................#.######.',
    '######.............................................########.',
    '#######.............................................#######.',
    '######..##.........................................#######..',
    '##########........................................#########.',
    '#########.........................................#######.#.',
    '########................................##........#######.#.',
    '#######.............................#########.....#########.',
    '#####.............................#############.############',
    '####.............................##########################.',
    '####.............................##########################.',
    '####.............................##########################.',
    '###....................................###################..',
    '###.........................................######...######.',
    '####..................................................#####.',
    '########..............................................##..#.',
    '########..............................................#####.',
    '#########...............................................###.',
    '###########..............................................##.',
    '####..#####...##.........................................##.',
    '##.....#########.......#........................##...##.###.',
    '#####..###.#######..#######.###..########.########...######.',
    '#####..############################################.#######.',
  ];

  /* ---------- spawn tables: the old enemy keys (ED) with weights ---------- */
  const SP = (region, density, pack, mobs) => ({ region, density, pack, mobs: mobs.map(m => ({ type: m[0], w: m[1] })) });
  const SPAWNS = [
    SP('dorne', 1.0, [2, 4], [['axe', 22], ['sword', 15], ['bandit', 15], ['child', 12], ['hound', 12], ['bandit_archer', 8], ['archer', 6], ['crawler', 6], ['spear', 4]]),
    SP('reach', 1.0, [2, 4], [['axe', 20], ['sword', 15], ['bandit', 15], ['boar', 15], ['child', 10], ['hound', 8], ['bandit_archer', 7], ['spear', 5], ['rider', 5]]),
    SP('stormlands', 1.0, [2, 4], [['axe', 20], ['sword', 15], ['bandit', 15], ['bandit_archer', 10], ['hound', 10], ['child', 10], ['boar', 10], ['berserk', 5], ['elk', 5]]),
    SP('westerlands', 1.0, [2, 4], [['axe', 20], ['sword', 15], ['bandit', 15], ['bandit_archer', 10], ['child', 10], ['hound', 10], ['crawler', 10], ['shield', 5], ['bat', 5]]),
    SP('dragonstone', 1.0, [2, 4], [['axe', 25], ['sword', 15], ['child', 15], ['crawler', 15], ['bat', 10], ['hound', 10], ['raven', 5], ['wraith', 5]]),
    SP('ironislands', 0.9, [2, 4], [['axe', 25], ['sword', 15], ['raider', 15], ['archer', 10], ['child', 10], ['hound', 10], ['crawler', 10], ['spear', 5]]),
    SP('north', 1.0, [2, 4], [['axe', 25], ['sword', 20], ['child', 15], ['hound', 15], ['archer', 10], ['wolf', 5], ['crawler', 5], ['spider', 5]]),
    SP('crownlands', 1.1, [2, 5], [['sword', 20], ['spear', 15], ['shield', 15], ['archer', 15], ['rider', 10], ['crypt', 10], ['hound', 5], ['boar', 5], ['necro', 5]]),
    SP('westcoast', 1.1, [2, 5], [['raider', 20], ['axe', 10], ['sword', 10], ['spear', 15], ['archer', 10], ['rider', 10], ['wolf', 10], ['berserk', 5], ['cat', 5], ['skin', 5]]),
    SP('riverlands', 1.2, [3, 5], [['sword', 15], ['spear', 15], ['shield', 10], ['archer', 10], ['crypt', 10], ['rider', 10], ['wolf', 10], ['berserk', 5], ['necro', 5], ['boar', 5], ['spider', 5]]),
    SP('vale', 1.2, [3, 5], [['raider', 15], ['spearwife', 10], ['thenn', 10], ['spear', 10], ['archer', 10], ['eagle', 10], ['cat', 10], ['wolf', 5], ['skin', 5], ['chief', 5], ['brownbear', 5], ['outrider', 5]]),
    SP('farnorth', 1.3, [3, 6], [['direwolf', 15], ['bear', 10], ['elk', 10], ['crypt', 10], ['berserk', 10], ['thenn', 10], ['spider', 10], ['walker', 5], ['necro', 5], ['skin', 5], ['cat', 5], ['raven', 5]]),
    SP('wall', 1.3, [3, 6], [['walker', 15], ['thenn', 15], ['giant', 10], ['spider', 10], ['necro', 10], ['outrider', 10], ['wraith', 10], ['bear', 7], ['eagle', 5], ['crypt', 5], ['brood', 3]]),
    SP('beyond', 1.4, [3, 6], [['walker', 15], ['thenn', 12], ['spearwife', 10], ['giant', 12], ['wraith', 12], ['outrider', 10], ['spider', 10], ['necro', 7], ['mammoth', 7], ['brood', 5]]),
    SP('winter', 1.5, [3, 6], [['walker', 22], ['wraith', 15], ['shade', 15], ['giant', 10], ['outrider', 10], ['spider', 10], ['mammoth', 8], ['necro', 5], ['brood', 5]]),
  ];

  /* ---------- regions: polygons (world units), level band, biome, home house, boss (A09's ids), gate ----------
     A gate: {after: the region whose boss must fall, boss: that boss's id (its kill sets flags['gate:<region>']), via: the POI at the door}. */
  const REGIONS = [
    { id: 'dorne', name: 'Dorne', lvl: [1, 8], biome: 'desert', weather: 'sand', col: '#f08a3c', home: 'martell', hub: 'sunspear', boss: 'boss_dorne',
      blurb: 'Red sand, dry riverbeds and the long coast road east to Sunspear.',
      poly: [[1800, 12288], [1500, 11400], [1900, 10800], [2400, 10400], [2800, 10150], [3400, 10100], [4300, 10100], [4700, 10300], [5100, 10600], [5500, 10700], [6000, 10600], [6500, 10400], [7200, 10400], [7200, 12288]] },
    { id: 'reach', name: 'The Reach', lvl: [1, 10], biome: 'reach', weather: 'clear', col: '#7fd06a', home: 'tyrell', hub: 'highgarden', boss: 'boss_reach',
      blurb: 'Orchards and wheat all the way from the Mander to the old towers of Oldtown.',
      poly: [[0, 9100], [1000, 9100], [1600, 9000], [2100, 8900], [2400, 8600], [2800, 8200], [3300, 7950], [3700, 8300], [3850, 8650], [4150, 8800], [4500, 8900], [4650, 9200], [4600, 9500], [4450, 9800], [4300, 10100], [3400, 10100], [2800, 10150], [2400, 10400], [1900, 10800], [1500, 11400], [1200, 12200], [0, 12200]] },
    { id: 'stormlands', name: 'The Stormlands', lvl: [1, 8], biome: 'storm', weather: 'rain', col: '#e0c14a', home: 'baratheon', hub: 'stormsend', boss: 'boss_stormlands',
      blurb: 'Wet forests, cliffs and a wind that never rests above Shipbreaker Bay.',
      poly: [[4650, 9200], [5100, 9200], [5300, 8950], [5700, 8850], [6200, 9000], [6500, 9300], [6700, 9700], [6500, 10400], [6000, 10600], [5500, 10700], [5100, 10600], [4700, 10300], [4300, 10100], [4450, 9800], [4600, 9500]] },
    { id: 'westerlands', name: 'The Westerlands', lvl: [1, 8], biome: 'mountain', weather: 'clear', col: '#e3b661', home: 'lannister', hub: 'casterly', boss: 'boss_westerlands',
      blurb: 'Gold under the hills, a harbour city below the Rock and outlaws in the passes.',
      poly: [[1900, 6500], [2100, 6500], [2300, 6900], [2200, 7500], [2500, 7700], [2900, 7850], [2800, 8200], [2400, 8600], [2100, 8900], [1600, 9000], [1000, 9100], [500, 9050], [300, 8600], [300, 8000], [600, 7400], [1000, 6900], [1400, 6600]] },
    { id: 'ironislands', name: 'The Iron Islands', lvl: [1, 8], biome: 'sea', weather: 'rain', col: '#d8b74a', home: 'greyjoy', hub: 'pyke', boss: 'boss_iron',
      blurb: 'Bare rock, salt wind and longships; the ferry lane runs east to Seagard.',
      poly: [[100, 5500], [1700, 5500], [1700, 6000], [2500, 6000], [2500, 6250], [1700, 6250], [1700, 6750], [100, 6750]] },
    { id: 'dragonstone', name: 'Dragonstone', lvl: [1, 8], biome: 'ash', weather: 'rain', col: '#e14b4b', home: 'targaryen', hub: 'dragonstone', boss: 'boss_dragonstone',
      blurb: 'A black volcanic isle and the lonely woods of Crackclaw Point across the strait.',
      poly: [[5200, 7450], [5500, 7150], [5450, 6900], [5700, 6800], [6000, 6950], [6100, 7200], [6800, 7200], [6900, 7800], [6500, 8000], [5900, 8100], [5600, 8350], [5400, 8200], [5400, 7600]] },
    { id: 'north', name: 'The North', lvl: [1, 8], biome: 'snow', weather: 'snow', col: '#a9bdd0', home: 'stark', hub: 'winterfell', boss: 'boss_north',
      gate: { after: 'riverlands', boss: 'boss_neck', via: 'moat_cailin', name: 'the Neck', blurb: 'The causeway north of Moat Cailin is held by the wight of the Neck.' },
      blurb: 'Grey hills, barrow fields and the long road from the Neck up to Winterfell.',
      poly: [[0, 2300], [900, 2400], [1500, 2600], [2200, 2500], [2700, 2100], [3300, 2050], [3900, 2250], [4700, 2550], [5200, 2800], [5300, 3300], [5100, 3900], [4600, 4150], [2030, 4150], [2000, 3950], [300, 3950], [0, 3600]] },
    { id: 'crownlands', name: 'The Crownlands', lvl: [6, 16], biome: 'city', weather: 'clear', col: '#c9a86a', home: null, hub: 'kingslanding', boss: 'boss_kingswood',
      blurb: 'The capital, its roads and the Kingswood: every path in the realm meets here.',
      poly: [[3300, 7950], [3800, 7950], [4300, 7900], [4800, 7700], [5200, 7450], [5400, 7600], [5400, 8200], [5650, 8450], [5700, 8850], [5300, 8950], [5100, 9200], [4650, 9200], [4500, 8900], [4150, 8800], [3850, 8650], [3700, 8300]] },
    { id: 'westcoast', name: 'The Stony Shore', lvl: [10, 18], biome: 'coast', weather: 'rain', col: '#8fa3a8', home: null, hub: 'flintsfinger', boss: 'boss_westcoast',
      blurb: 'Cape Kraken and the raided shore west of the Neck, where longships land at night.',
      poly: [[300, 3950], [2000, 3950], [2030, 4150], [2050, 4700], [2100, 5000], [2100, 5450], [1500, 5550], [400, 5200], [300, 4700]] },
    { id: 'riverlands', name: 'The Riverlands', lvl: [10, 20], biome: 'river', weather: 'rain', col: '#5aa0d8', home: null, hub: 'riverrun', boss: 'boss_neck',
      blurb: 'Fords, mills and burnt holdfasts between the Trident and the Twins, and the bog of the Neck.',
      poly: [[2030, 4150], [4600, 4150], [4400, 4300], [3900, 4500], [3600, 5200], [3900, 5500], [4100, 5900], [4100, 6200], [4300, 6500], [4800, 6700], [5200, 6900], [5500, 7150], [5200, 7450], [4800, 7700], [4300, 7900], [3800, 7950], [3300, 7950], [2900, 7850], [2500, 7700], [2200, 7500], [2300, 6900], [2100, 6500], [1900, 6500], [1850, 6300], [2500, 6250], [2500, 6000], [1900, 5950], [2100, 5450], [2100, 5000], [2050, 4700]] },
    { id: 'vale', name: 'The Vale', lvl: [16, 26], biome: 'vale', weather: 'clear', col: '#c6dbe9', home: null, hub: 'eyrie', boss: 'boss_vale',
      blurb: 'Two ridges of grey mountains with one green valley and one road between them.',
      poly: [[3600, 5200], [3900, 5500], [4100, 5900], [4100, 6200], [4300, 6500], [4800, 6700], [5200, 6900], [5450, 6900], [5700, 6800], [6000, 6950], [6100, 7200], [6500, 7000], [6700, 6500], [6600, 5800], [6300, 5300], [5800, 4900], [5000, 4800], [4300, 4800], [3800, 4800]] },
    { id: 'farnorth', name: 'The Far North', lvl: [22, 34], biome: 'snow', weather: 'snow', col: '#7f9cb0', home: null, hub: 'dreadfort', boss: 'boss_north',
      blurb: 'The Wolfswood, the Dreadfort and the frozen shore where the dead walk in daylight.',
      poly: [[0, 1700], [900, 1700], [900, 1150], [1450, 1150], [1900, 1000], [2300, 1000], [2500, 1300], [3000, 1400], [3800, 1450], [4400, 1350], [4900, 1250], [5500, 1150], [6000, 1060], [6000, 1500], [5600, 1900], [5000, 2300], [4700, 2550], [3900, 2250], [3300, 2050], [2700, 2100], [2200, 2500], [1500, 2600], [900, 2400], [0, 2300]] },
    { id: 'wall', name: 'The Wall', lvl: [34, 44], biome: 'wall', weather: 'snow', col: '#bfe3f5', home: null, hub: 'castleblack', boss: 'boss_wall',
      gate: { after: 'farnorth', boss: 'boss_north', via: 'castleblack', name: 'the Gift', blurb: 'The Gift opens when the giant of the Far North has fallen.' },
      blurb: 'The Gift: empty villages under seven hundred feet of ice.',
      poly: [[2760, 580], [4800, 580], [5300, 820], [6000, 940], [6000, 1060], [5500, 1150], [4900, 1250], [4400, 1350], [3800, 1450], [3000, 1400], [2500, 1300], [2300, 1000], [2500, 850]] },
    { id: 'beyond', name: 'Beyond the Wall', lvl: [44, 54], biome: 'wall', weather: 'snow', col: '#e8f4ff', home: null, hub: 'fist_of_first_men', boss: 'boss_beyond',
      gate: { after: 'wall', boss: 'boss_wall', via: 'castleblack', name: 'the tunnel', blurb: 'The gate in the Wall opens when its White Walker lieutenant has fallen.' },
      paint: { col: '#dfe9f2', alpha: 0.82 },
      blurb: 'The haunted forest and the frozen Shivering Sea; the free folk and the dead share it.',
      poly: [[2350, 0], [7200, 0], [7200, 2000], [6000, 2000], [6000, 940], [5300, 820], [4800, 580], [2760, 580], [2500, 850], [2350, 600]] },
    { id: 'winter', name: 'The Lands of Always Winter', lvl: [52, 60], biome: 'wall', weather: 'snow', col: '#f4f9ff', home: null, hub: 'heart_of_winter', boss: 'boss_winter',
      gate: { after: 'beyond', boss: 'boss_beyond', via: 'fist_of_first_men', name: 'the Frostfangs', blurb: 'The way west past the Frostfangs opens when the reaver at the Fist has fallen.' },
      paint: { col: '#eef5fb', alpha: 0.88 },
      blurb: 'The frozen Bay of Ice and the mountains beyond it; nothing living has mapped what lies past them.',
      poly: [[0, 0], [2350, 0], [2350, 600], [2500, 850], [2300, 1000], [1900, 1000], [1450, 1150], [900, 1150], [900, 1700], [0, 1700]] },
  ];

  /* ---------- ridges that block (rasterised into the mask by cell centre) ---------- */
  const BLOCKED = [
    { id: 'mts_vale_n1', name: 'Mountains of the Moon (west)', poly: [[3500, 5300], [4200, 5200], [4650, 5350], [4650, 5500], [4300, 5550], [3700, 5550], [3450, 5450]] },
    { id: 'mts_vale_n2', name: 'Mountains of the Moon (east)', poly: [[4850, 5350], [5600, 5550], [6300, 5750], [6400, 5950], [5700, 5900], [5000, 5700], [4850, 5550]] },
    { id: 'mts_vale_s', name: 'the southern ridge of the Vale', poly: [[4350, 6250], [4800, 6150], [5300, 6300], [5800, 6500], [5700, 6700], [5200, 6620], [4700, 6560], [4350, 6500]] },
    { id: 'mts_red_w', name: 'Red Mountains (west)', poly: [[2300, 10800], [2750, 10550], [2850, 10900], [2700, 11250], [2400, 11150]] },
    { id: 'mts_red_e', name: 'Red Mountains (east)', poly: [[3150, 10250], [3550, 10300], [3650, 10600], [3400, 10700], [3150, 10550]] },
    { id: 'hills_west', name: 'the hills of the Westerlands', poly: [[1300, 6800], [1800, 6700], [2000, 7100], [1700, 7350], [1300, 7200]] },
    { id: 'mts_frostfangs', name: 'the Frostfangs', poly: [[1450, 60], [2250, 120], [2300, 420], [1600, 480], [1400, 300]] },
  ];
  /* areas forced walkable: the frozen seas beyond the Wall and the island groups drawn as hexes on the art */
  const WALKABLE = [
    { id: 'frozen', name: 'the frozen Shivering Sea', poly: REGIONS.find(r => r.id === 'beyond').poly },
    { id: 'frozen_w', name: 'the frozen Bay of Ice', poly: REGIONS.find(r => r.id === 'winter').poly },
    { id: 'ironisles', name: 'the Iron Islands', poly: [[150, 5520], [1650, 5520], [1650, 6720], [150, 6720]] },
    { id: 'dragonisle', name: 'the isle of Dragonstone', poly: [[6060, 7230], [6780, 7230], [6780, 7900], [6060, 7900]] },
  ];
  /* ferries: thin walkable lanes over water (cells along the line become '.') */
  const FERRIES = [
    { id: 'ferry_pyke', name: 'the longship lane', pts: [[1500, 6060], [2000, 6060]], from: 'pyke', to: 'seagard' },
    { id: 'ferry_dragonstone', name: 'the Dragonstone ferry', pts: [[6180, 7260], [6180, 7380], [6300, 7380], [6420, 7500]], from: 'kingslanding', to: 'dragonstone' },
    { id: 'ferry_arbor', name: 'the Arbor ferry', pts: [[1100, 11100], [900, 11350], [700, 11600], [620, 11760]], from: 'oldtown', to: 'thearbor' },
  ];
  const WALL = { pts: [[2760, 590], [4800, 590], [5300, 830], [6000, 950]], gateAt: 'castleblack' };

  /* ---------- POIs. {id,name,type,x,y,region,house?,seat?,npcs,shop?,inn?,smith?,blurb} ---------- */
  const POIS = [
    /* seats */
    { id: 'winterfell', name: 'Winterfell', type: 'castle', x: 2950, y: 2450, region: 'north', house: 'stark', seat: true, r: 160, shop: true, inn: true, smith: true, blurb: 'Hot springs run under the walls, so the snow never settles in the yard.' },
    { id: 'casterly', name: 'Casterly Rock', type: 'castle', x: 1070, y: 7600, region: 'westerlands', house: 'lannister', seat: true, r: 160, shop: true, inn: true, smith: true, blurb: 'A fortress cut into a cliff of gold-veined stone above the Sunset Sea.' },
    { id: 'stormsend', name: "Storm's End", type: 'castle', x: 5480, y: 9380, region: 'stormlands', house: 'baratheon', seat: true, r: 160, shop: true, inn: true, smith: true, blurb: 'One round tower with walls thick enough to laugh at any gale.' },
    { id: 'dragonstone', name: 'Dragonstone', type: 'castle', x: 6480, y: 7500, region: 'dragonstone', house: 'targaryen', seat: true, r: 160, shop: true, inn: true, smith: true, blurb: 'Black stone carved into dragon shapes on a smoking island.' },
    { id: 'pyke', name: 'Pyke', type: 'castle', x: 1020, y: 6180, region: 'ironislands', house: 'greyjoy', seat: true, r: 160, shop: true, inn: true, smith: true, blurb: 'Towers on sea stacks, joined by rope bridges that sway over the surf.' },
    { id: 'highgarden', name: 'Highgarden', type: 'castle', x: 1920, y: 10020, region: 'reach', house: 'tyrell', seat: true, r: 160, shop: true, inn: true, smith: true, blurb: 'Three rings of white walls and a hedge maze above the Mander.' },
    { id: 'sunspear', name: 'Sunspear', type: 'castle', x: 6060, y: 11500, region: 'dorne', house: 'martell', seat: true, r: 160, shop: true, inn: true, smith: true, blurb: 'A sand-coloured castle and a shadow city of winding lanes by the sea.' },
    /* the North */
    { id: 'whiteharbor', name: 'White Harbor', type: 'town', x: 3960, y: 3680, region: 'north', shop: true, inn: true, blurb: 'The only true city of the North, white walls and a busy fish market.' },
    { id: 'barrowton', name: 'Barrowton', type: 'town', x: 2040, y: 3260, region: 'north', inn: true, blurb: 'A wooden town built around a grave mound older than any castle.' },
    { id: 'therills', name: 'The Rills', type: 'castle', x: 1060, y: 3000, region: 'north', blurb: 'Horse country of low hills and cold streams west of the barrows.' },
    { id: 'torrhens', name: "Torrhen's Square", type: 'castle', x: 2460, y: 3600, region: 'north', smith: true, blurb: 'A square keep beside a square lake, quiet except for the smithy.' },
    { id: 'dg_crypts', name: 'The Crypts of Winterfell', type: 'dungeon', x: 2850, y: 2560, region: 'north', dungeon: 'dg_crypts', blurb: 'Stone kings sit with iron swords across their knees, and something below them stirs.' },
    { id: 'sh_north', name: 'The Winterfell Heart Tree', type: 'shrine', x: 3080, y: 2360, region: 'north', blurb: 'A white weirwood over a black pool; the carved face has watched for a thousand years.' },
    { id: 'camp_barrows', name: 'Barrowlands Wight Camp', type: 'camp', x: 1900, y: 2900, region: 'north', camp: 'wight', mobs: ['axe', 'child', 'hound'], blurb: 'The dead have dug themselves out of a barrow and gathered around it.' },
    { id: 'camp_whiteknife', name: 'White Knife Bandits', type: 'camp', x: 3500, y: 3300, region: 'north', camp: 'bandit', mobs: ['sword', 'archer', 'hound'], blurb: 'River thieves who rob the barges between Winterfell and the sea.' },
    /* the Far North */
    { id: 'dreadfort', name: 'The Dreadfort', type: 'castle', x: 4320, y: 2000, region: 'farnorth', shop: true, inn: true, blurb: 'Thick triangular towers over the Weeping Water, with a reputation to match.' },
    { id: 'karhold', name: 'Karhold', type: 'castle', x: 5220, y: 1300, region: 'farnorth', smith: true, blurb: 'A hard castle on the Shivering Sea, snowed in eight months a year.' },
    { id: 'lasthearth', name: 'Last Hearth', type: 'castle', x: 4500, y: 1800, region: 'farnorth', inn: true, blurb: 'The last great hall before the Gift, where the fire never goes out.' },
    { id: 'deepwood', name: 'Deepwood Motte', type: 'castle', x: 1860, y: 1810, region: 'farnorth', inn: true, blurb: 'A log palisade on a hill inside the Wolfswood, more wood than stone.' },
    { id: 'queenscrown', name: 'Queenscrown', type: 'castle', x: 3900, y: 1520, region: 'farnorth', blurb: 'A round tower on a lake island, reached by a hidden causeway; a giant has made it his.' },
    { id: 'sh_farnorth', name: 'Wolfswood Weirwood', type: 'shrine', x: 2600, y: 1700, region: 'farnorth', blurb: 'A grove so old the trees have grown together into one roof.' },
    { id: 'camp_wolfswood', name: 'Wolfswood Raiders', type: 'camp', x: 2400, y: 2220, region: 'farnorth', camp: 'wildling', mobs: ['thenn', 'berserk', 'wolf'], blurb: 'Raiders who slipped over the Wall and live off the villages below the trees.' },
    /* the Wall */
    { id: 'castleblack', name: 'Castle Black', type: 'castle', x: 3200, y: 640, region: 'wall', shop: true, inn: true, smith: true, blurb: 'No walls of its own: it only ever had to face north.' },
    { id: 'nightfort', name: 'The Nightfort', type: 'castle', x: 3000, y: 760, region: 'wall', blurb: 'The oldest and largest castle on the Wall, abandoned, with a well that goes under the ice.' },
    { id: 'shadowtower', name: 'The Shadow Tower', type: 'castle', x: 2880, y: 700, region: 'wall', blurb: 'The western end of the Wall, where the mountains start.' },
    { id: 'eastwatch', name: 'Eastwatch-by-the-Sea', type: 'town', x: 5820, y: 1030, region: 'wall', shop: true, inn: true, blurb: 'Fishing boats and black galleys under the eastern end of the ice.' },
    { id: 'molestown', name: "Mole's Town", type: 'town', x: 3200, y: 900, region: 'wall', inn: true, blurb: 'A village that is mostly cellars, dug deep against the cold.' },
    { id: 'sh_wall', name: 'The Grove of the Gift', type: 'shrine', x: 3500, y: 1000, region: 'wall', blurb: 'Nine weirwoods in a ring where the rangers say their vows.' },
    { id: 'camp_gift', name: 'Wight Host of the Gift', type: 'camp', x: 4400, y: 1100, region: 'wall', camp: 'wight', mobs: ['walker', 'thenn', 'crypt', 'necro'], blurb: 'A whole village risen at once, still standing in its own street.' },
    /* beyond the Wall */
    { id: 'crasters', name: "Craster's Keep", type: 'camp', x: 2900, y: 350, region: 'beyond', camp: 'wildling', mobs: ['thenn', 'skin', 'chief'], blurb: 'A mud hall with a midden the wolves avoid.' },
    { id: 'fist_of_first_men', name: 'The Fist of the First Men', type: 'castle', x: 2500, y: 300, region: 'beyond', inn: true, blurb: 'A ringfort on a bare hill, the only high ground for days.' },
    { id: 'hardhome', name: 'Hardhome', type: 'town', x: 6540, y: 720, region: 'beyond', shop: true, inn: true, blurb: 'A burnt town on a frozen bay, where the free folk made their last market.' },
    { id: 'dg_caves', name: 'The Caves under the Frostfangs', type: 'dungeon', x: 1300, y: 450, region: 'winter', dungeon: 'dg_caves', blurb: 'Tunnels of blue ice that go down further than torches last.' },
    { id: 'heart_of_winter', name: 'The Heart of Winter', type: 'lair', x: 600, y: 800, region: 'winter', blurb: 'The Lands of Always Winter: white on white, and a cold with a will of its own.' },
    { id: 'sh_beyond', name: 'The Frozen Weirwood', type: 'shrine', x: 3600, y: 300, region: 'beyond', blurb: 'A weirwood sheathed in ice, its face still red underneath.' },
    { id: 'camp_wildling', name: 'Free Folk War Camp', type: 'camp', x: 4300, y: 300, region: 'beyond', camp: 'wildling', mobs: ['thenn', 'giant', 'mammoth', 'chief'], blurb: 'Tents, giants and mammoths, all walking south together.' },
    { id: 'camp_wights', name: 'Host of the Dead', type: 'camp', x: 1500, y: 900, region: 'winter', camp: 'wight', mobs: ['walker', 'wraith', 'outrider', 'lord'], blurb: 'Thousands stand in silence on the ice and do not breathe.' },
    { id: 'sh_winter', name: 'The Ice Ring', type: 'shrine', x: 1000, y: 600, region: 'winter', blurb: 'Nine weirwood stumps in a circle on the ice, still warm to the hand.' },
    /* the Stony Shore */
    { id: 'flintsfinger', name: "Flint's Finger", type: 'castle', x: 1030, y: 4030, region: 'westcoast', inn: true, smith: true, blurb: 'A keep on a thin spit of rock, watching for sails from the west.' },
    { id: 'sh_coast', name: 'Weirwood of the Shore', type: 'shrine', x: 1100, y: 4500, region: 'westcoast', blurb: 'A lone weirwood on the cliff, bent inland by the sea wind.' },
    { id: 'camp_kraken', name: 'Ironborn Landing', type: 'camp', x: 1500, y: 4900, region: 'westcoast', camp: 'ironborn', mobs: ['axe', 'spear', 'archer', 'chief'], blurb: 'Longships dragged up the shingle and a camp of reavers around them.' },
    /* the Iron Islands */
    { id: 'old_wyk', name: 'Old Wyk', type: 'town', x: 600, y: 5800, region: 'ironislands', inn: true, blurb: 'The holy island, where the drowned captains are crowned under a hill of bones.' },
    { id: 'sh_iron', name: 'The Drowned Shore', type: 'shrine', x: 700, y: 6300, region: 'ironislands', blurb: 'A grey beach where the priests bless men with salt water.' },
    { id: 'camp_iron', name: 'Salt Wife Cove', type: 'camp', x: 1300, y: 6000, region: 'ironislands', camp: 'bandit', mobs: ['axe', 'sword', 'crawler'], blurb: 'A smugglers\' cove the lords of Pyke pretend not to see.' },
    /* the Riverlands (with the Neck) */
    { id: 'moat_cailin', name: 'Moat Cailin', type: 'castle', x: 3200, y: 4280, region: 'riverlands', blurb: 'Three leaning towers that still command the only causeway through the bog.' },
    { id: 'camp_neck', name: 'Bog Raiders', type: 'camp', x: 3050, y: 4700, region: 'riverlands', camp: 'bandit', mobs: ['sword', 'archer', 'crawler'], blurb: 'Outlaws on stilts, hiding in the reeds beside the causeway.' },
    { id: 'riverrun', name: 'Riverrun', type: 'castle', x: 2540, y: 7250, region: 'riverlands', shop: true, inn: true, smith: true, blurb: 'A triangle of walls where two rivers meet; the moat can be opened at will.' },
    { id: 'twins', name: 'The Twins', type: 'castle', x: 3000, y: 5880, region: 'riverlands', inn: true, blurb: 'Two matching castles and the bridge between them, with a toll for everyone.' },
    { id: 'harrenhal', name: 'Harrenhal', type: 'castle', x: 4150, y: 7120, region: 'riverlands', shop: true, blurb: 'Five melted towers; too big to garrison and too cursed to hold.' },
    { id: 'seagard', name: 'Seagard', type: 'town', x: 2630, y: 6100, region: 'riverlands', shop: true, inn: true, blurb: 'A harbour town with a bell that rings when longships are sighted.' },
    { id: 'stoneysept', name: 'Stoney Sept', type: 'town', x: 3270, y: 7750, region: 'riverlands', inn: true, blurb: 'A market town around a seven-sided sept and a famous inn.' },
    { id: 'saltpans', name: 'Saltpans', type: 'town', x: 4320, y: 6700, region: 'riverlands', shop: true, blurb: 'Salt flats, drying sheds and a small port on the Bay of Crabs.' },
    { id: 'maidenpool', name: 'Maidenpool', type: 'town', x: 5060, y: 7280, region: 'riverlands', inn: true, blurb: 'A walled port with a bathing pool that gives the town its name.' },
    { id: 'dg_harrenhal', name: 'The Dungeons of Harrenhal', type: 'dungeon', x: 4250, y: 7250, region: 'riverlands', dungeon: 'dg_harrenhal', blurb: 'Bear pits, oubliettes and scorched vaults below the melted towers.' },
    { id: 'sh_rivers', name: 'The Riverrun Godswood', type: 'shrine', x: 2700, y: 7150, region: 'riverlands', blurb: 'A slender weirwood among redwoods, lit by the river at dusk.' },
    { id: 'camp_rivers', name: 'Trident Outlaws', type: 'camp', x: 3500, y: 6500, region: 'riverlands', camp: 'bandit', mobs: ['sword', 'archer', 'rider', 'chief'], blurb: 'Deserters from three armies living off the ford traffic.' },
    /* the Vale */
    { id: 'eyrie', name: 'The Eyrie', type: 'castle', x: 4740, y: 6070, region: 'vale', shop: true, inn: true, smith: true, blurb: 'Seven white towers on a mountain shoulder, reached by a goat path and a basket.' },
    { id: 'gulltown', name: 'Gulltown', type: 'town', x: 5790, y: 6180, region: 'vale', shop: true, inn: true, blurb: 'The Vale\'s one port, loud with gulls and merchants from across the sea.' },
    { id: 'heartshome', name: "Heart's Home", type: 'castle', x: 5300, y: 5250, region: 'vale', inn: true, blurb: 'A high hall above the Fingers with a view over the Bite.' },
    { id: 'greyglen', name: 'The Grey Glen', type: 'castle', x: 4750, y: 5450, region: 'vale', blurb: 'A narrow valley of mist and scree between the northern peaks.' },
    { id: 'bloody_gate', name: 'The Bloody Gate', type: 'castle', x: 4300, y: 6400, region: 'vale', blurb: 'Twin watchtowers on the High Road; no army has ever passed them uninvited.' },
    { id: 'sh_vale', name: 'Sept of the Mountain', type: 'shrine', x: 4900, y: 6000, region: 'vale', blurb: 'A small sept carved into the rock beside the Eyrie\'s path.' },
    { id: 'camp_vale', name: 'Mountain Clans', type: 'camp', x: 4300, y: 5800, region: 'vale', camp: 'wildling', mobs: ['thenn', 'berserk', 'archer', 'chief'], blurb: 'Clansmen in stolen mail who take their toll from any traveller.' },
    /* the Crownlands */
    { id: 'kingslanding', name: "King's Landing", type: 'town', x: 5000, y: 8120, region: 'crownlands', shop: true, inn: true, smith: true, hub: true, blurb: 'Half a million people on three hills, and every road in the realm ends at its gates.' },
    { id: 'duskendale', name: 'Duskendale', type: 'town', x: 5280, y: 7680, region: 'crownlands', shop: true, inn: true, blurb: 'An old port with a sleepy harbour and a long memory.' },
    { id: 'sh_crown', name: 'The Great Sept', type: 'shrine', x: 4880, y: 8000, region: 'crownlands', blurb: 'Seven crystal towers on the highest hill of the city.' },
    { id: 'kingswood', name: 'Kingswood Brotherhood', type: 'camp', x: 4940, y: 8620, region: 'crownlands', camp: 'bandit', mobs: ['sword', 'archer', 'rider', 'chief'], blurb: 'Outlaws who know every deer trail of the royal forest.' },
    /* Dragonstone */
    { id: 'sh_dragonstone', name: 'The Stone Drum Sept', type: 'shrine', x: 6300, y: 7400, region: 'dragonstone', blurb: 'A sept inside the drum tower, where the sea booms through the floor.' },
    { id: 'camp_ash', name: 'Ash Beach Wights', type: 'camp', x: 6700, y: 7750, region: 'dragonstone', camp: 'wight', mobs: ['axe', 'child', 'crawler'], blurb: 'Drowned sailors walking out of the surf onto the black sand.' },
    { id: 'camp_crackclaw', name: 'Crackclaw Poachers', type: 'camp', x: 5800, y: 7350, region: 'dragonstone', camp: 'bandit', mobs: ['axe', 'archer', 'hound'], blurb: 'Pine-wood hunters who answer to no lord and sell to every one.' },
    /* the Westerlands */
    { id: 'lannisport', name: 'Lannisport', type: 'town', x: 1100, y: 8120, region: 'westerlands', shop: true, inn: true, blurb: 'A rich port under the Rock, famous for goldsmiths and tourneys.' },
    { id: 'goldentooth', name: 'The Golden Tooth', type: 'castle', x: 2150, y: 7650, region: 'westerlands', smith: true, blurb: 'A small castle that holds the only good pass into the hills.' },
    { id: 'ashemark', name: 'Ashemark', type: 'castle', x: 1640, y: 6680, region: 'westerlands', blurb: 'A grey keep on the northern hills, looking out over Ironman\'s Bay.' },
    { id: 'cleganes', name: "Clegane's Keep", type: 'castle', x: 1620, y: 8720, region: 'westerlands', blurb: 'A modest towerhouse with a kennel bigger than its hall.' },
    { id: 'sh_west', name: 'Sept of Lannisport', type: 'shrine', x: 1300, y: 7900, region: 'westerlands', blurb: 'A gilded sept whose bells carry out to the fishing fleet.' },
    { id: 'camp_west', name: 'Hill Outlaws', type: 'camp', x: 1350, y: 7420, region: 'westerlands', camp: 'bandit', mobs: ['axe', 'archer', 'hound'], blurb: 'Miners turned robbers, camped at an old gold working.' },
    /* the Reach */
    { id: 'oldtown', name: 'Oldtown', type: 'town', x: 1140, y: 10930, region: 'reach', shop: true, inn: true, smith: true, blurb: 'The oldest city in the realm, with a lighthouse tower and a library of maesters.' },
    { id: 'hornhill', name: 'Horn Hill', type: 'castle', x: 2100, y: 10440, region: 'reach', smith: true, blurb: 'A hunting castle in the foothills of the Red Mountains.' },
    { id: 'ciderhall', name: 'Cider Hall', type: 'castle', x: 2780, y: 9680, region: 'reach', inn: true, blurb: 'Apple orchards to the horizon and presses that run all autumn.' },
    { id: 'tumbleton', name: 'Tumbleton', type: 'town', x: 4060, y: 9130, region: 'reach', inn: true, blurb: 'A market town on the Mander with a bridge the Roseroad crosses.' },
    { id: 'oldoak', name: 'Old Oak', type: 'castle', x: 1050, y: 9150, region: 'reach', blurb: 'A castle grown around a single oak said to be older than the Andals.' },
    { id: 'uplands', name: 'Uplands', type: 'castle', x: 1750, y: 10710, region: 'reach', blurb: 'Vineyards on terraced slopes above the road to Oldtown.' },
    { id: 'thearbor', name: 'The Arbor', type: 'town', x: 620, y: 11760, region: 'reach', shop: true, blurb: 'An island of vines whose wine pays for its fleet.' },
    { id: 'sh_reach', name: 'The Starry Sept', type: 'shrine', x: 1300, y: 10800, region: 'reach', blurb: 'Black marble and a ceiling painted with the night sky.' },
    { id: 'camp_reach', name: 'Roseroad Bandits', type: 'camp', x: 3000, y: 8900, region: 'reach', camp: 'bandit', mobs: ['axe', 'sword', 'archer'], blurb: 'Highwaymen who wait for the grain wagons at the river bend.' },
    { id: 'camp_marches', name: 'Marcher Wights', type: 'camp', x: 3400, y: 9900, region: 'reach', camp: 'wight', mobs: ['axe', 'child', 'hound', 'boar'], blurb: 'The dead of an old border war walking the Dornish Marches again.' },
    /* the Stormlands */
    { id: 'stonehelm', name: 'Stonehelm', type: 'castle', x: 4720, y: 9850, region: 'stormlands', smith: true, blurb: 'A squat castle guarding the Boneway from the Dornish side.' },
    { id: 'bronzegate', name: 'Bronzegate', type: 'castle', x: 5000, y: 9350, region: 'stormlands', inn: true, blurb: 'A castle with bronze-bound gates on the road north to the capital.' },
    { id: 'sh_storm', name: 'Sept of the Storm', type: 'shrine', x: 5300, y: 9300, region: 'stormlands', blurb: 'A sept on the cliff where sailors pray before Shipbreaker Bay.' },
    { id: 'camp_storm', name: 'Rainwood Outlaws', type: 'camp', x: 5000, y: 9700, region: 'stormlands', camp: 'bandit', mobs: ['axe', 'archer', 'boar'], blurb: 'Poachers and worse, living under the dripping canopy.' },
    /* Dorne */
    { id: 'yronwood', name: 'Yronwood', type: 'castle', x: 3970, y: 11000, region: 'dorne', shop: true, inn: true, smith: true, blurb: 'The Bloodroyal\'s castle, second in Dorne only to Sunspear.' },
    { id: 'starfall', name: 'Starfall', type: 'castle', x: 2060, y: 11280, region: 'dorne', inn: true, blurb: 'A pale castle on an island where the Torrentine meets the sea.' },
    { id: 'sandstone', name: 'Sandstone', type: 'castle', x: 2750, y: 11540, region: 'dorne', blurb: 'A keep in the deep sand, three days from the nearest well.' },
    { id: 'saltshore', name: 'Salt Shore', type: 'town', x: 4400, y: 11660, region: 'dorne', shop: true, blurb: 'A fishing town on the Summer Sea, roofs white with salt.' },
    { id: 'princes_pass', name: "Prince's Pass", type: 'town', x: 2960, y: 10580, region: 'dorne', inn: true, blurb: 'The western gap through the Red Mountains, watched by a tower on each side.' },
    { id: 'boneway', name: 'The Boneway', type: 'town', x: 3710, y: 10400, region: 'dorne', blurb: 'A waystation on the high stony road named for the armies that died on it.' },
    { id: 'sh_dorne', name: 'Sept of Sunspear', type: 'shrine', x: 5900, y: 11400, region: 'dorne', blurb: 'A cool, dim sept with a fountain in the middle of the floor.' },
    { id: 'camp_redmts', name: 'Mountain Bandits', type: 'camp', x: 3800, y: 10900, region: 'dorne', camp: 'bandit', mobs: ['sword', 'archer', 'hound'], blurb: 'Goat-herders turned robbers, holding the dry valleys below the Boneway.' },
    { id: 'camp_dorne', name: 'Brimstone Wights', type: 'camp', x: 5200, y: 11800, region: 'dorne', camp: 'wight', mobs: ['axe', 'child', 'crawler', 'hound'], blurb: 'The dead walk out of the Brimstone, dripping yellow water.' },
  ];

  /* ---------- roads (polylines). kind: road | track | ferry ---------- */
  const ROADS_INFO = [
    { id: 'kingsroad', name: 'The Kingsroad', kind: 'road', pts: [[3200, 640], [3400, 1500], [3300, 2100], [2950, 2450], [3000, 3200], [3200, 4280], [3050, 5000], [3000, 5880], [3300, 6400], [3800, 6900], [4400, 7100], [4500, 7700], [5000, 8120], [4940, 8620], [5200, 9000], [5480, 9380]] },
    { id: 'roseroad', name: 'The Roseroad', kind: 'road', pts: [[5000, 8120], [4500, 8600], [4060, 9130], [3300, 9500], [2780, 9680], [1920, 10020], [1500, 10500], [1140, 10930]] },
    { id: 'goldroad', name: 'The Goldroad', kind: 'road', pts: [[5000, 8120], [4200, 8050], [3300, 7800], [2600, 7800], [2150, 7650], [1500, 7900], [1100, 8120]] },
    { id: 'riverroad', name: 'The River Road', kind: 'road', pts: [[2150, 7650], [2540, 7250], [3200, 7000], [3800, 6900], [4320, 6700], [5060, 7280]] },
    { id: 'westroad', name: 'The Rock Road', kind: 'road', pts: [[1070, 7600], [1600, 7700], [2150, 7650]] },
    { id: 'highroad', name: 'The High Road', kind: 'road', pts: [[3800, 6900], [4000, 6600], [4300, 6400], [4250, 6150], [4500, 6000], [4740, 6070], [5200, 6050], [5600, 6150], [5790, 6180]] },
    { id: 'princespass', name: "The Prince's Pass", kind: 'road', pts: [[1920, 10020], [2100, 10440], [2960, 10580], [3970, 11000], [5000, 11300], [6060, 11500]] },
    { id: 'boneway', name: 'The Boneway', kind: 'road', pts: [[5480, 9380], [4720, 9850], [3710, 10400], [3970, 11000]] },
    { id: 'seagardroad', name: 'The Seagard Road', kind: 'road', pts: [[2630, 6100], [3000, 5880]] },
    { id: 'twinsroad', name: 'The Twins to Riverrun', kind: 'road', pts: [[3000, 5880], [2700, 6600], [2540, 7250]] },
    { id: 'whiteharborroad', name: 'The White Knife Road', kind: 'road', pts: [[2950, 2450], [3400, 3000], [3960, 3680]] },
    { id: 'wolfswoodtrack', name: 'The Wolfswood Track', kind: 'track', pts: [[2950, 2450], [2400, 2100], [1860, 1810]] },
    { id: 'dreadfortroad', name: 'The Dreadfort Road', kind: 'road', pts: [[2950, 2450], [3600, 2200], [4320, 2000], [4500, 1800], [4800, 1600], [5220, 1300]] },
    { id: 'barrowroad', name: 'The Barrow Road', kind: 'track', pts: [[2950, 2450], [2500, 2900], [2040, 3260], [1500, 3100], [1060, 3000]] },
    { id: 'shoretrack', name: 'The Stony Shore Track', kind: 'track', pts: [[2040, 3260], [1600, 3700], [1300, 4000], [1030, 4030], [1400, 4300], [1300, 4600], [1500, 4900]] },
    { id: 'frosttrail', name: 'The Frost Trail', kind: 'track', pts: [[3200, 640], [3200, 350], [2900, 350], [2500, 300], [2400, 650], [1900, 850], [1300, 850], [1300, 450], [900, 600], [600, 800]] },
    { id: 'easttrail', name: 'The Eastwatch Trail', kind: 'track', pts: [[3200, 640], [4200, 700], [5000, 980], [5820, 1030], [6100, 800], [6540, 720]] },
    { id: 'crackclaw', name: 'The Crackclaw Track', kind: 'track', pts: [[5000, 8120], [5280, 7680], [5700, 7400], [6060, 7260], [6180, 7260]] },
    { id: 'ferry_pyke', name: 'The longship lane', kind: 'ferry', pts: [[1020, 6180], [1500, 6060], [2000, 6060], [2630, 6100]] },
    { id: 'ferry_dragonstone', name: 'The Dragonstone ferry', kind: 'ferry', pts: [[6180, 7260], [6180, 7380], [6300, 7380], [6480, 7500]] },
    { id: 'ferry_arbor', name: 'The Arbor ferry', kind: 'ferry', pts: [[1140, 10930], [1100, 11100], [900, 11350], [700, 11600], [620, 11760]] },
  ];
  // R.world.roadNear walks each road as a plain list of points: the arrays carry id / name / kind as properties
  const ROADS = ROADS_INFO.map(r => { const a = r.pts.map(p => p.slice()); a.id = r.id; a.name = r.name; a.kind = r.kind; return a; });

  /* ---------- geometry helpers (pure; the runtime world module R.world builds on them) ---------- */
  const inPoly = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; } return c; };
  const polyArea = poly => { let a = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1]; return a / 2; };

  /* ---------- the final mask: sea rows + frozen / island overrides + ferries, then the ridges ---------- */
  const buildMask = () => {
    const M = SEA_ROWS.map(r => r.split(''));
    const cx = c => c * CELL + CELL / 2, cy = r => r * CELL + CELL / 2;
    for (let r = 0; r < MH; r++) for (let c = 0; c < MW; c++) for (const a of WALKABLE) if (inPoly(cx(c), cy(r), a.poly)) M[r][c] = '.';
    for (const f of FERRIES) for (let i = 1; i < f.pts.length; i++) { const a = f.pts[i - 1], b = f.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; for (let t = 0; t <= L; t += CELL / 3) { const x = a[0] + (b[0] - a[0]) * t / L, y = a[1] + (b[1] - a[1]) * t / L; const c = Math.floor(x / CELL), r = Math.floor(y / CELL); if (r >= 0 && r < MH && c >= 0 && c < MW) M[r][c] = '.'; } }
    for (let r = 0; r < MH; r++) for (let c = 0; c < MW; c++) for (const b of BLOCKED) if (inPoly(cx(c), cy(r), b.poly)) M[r][c] = '#';
    return M.map(r => r.join(''));
  };
  let rows; try { rows = buildMask(); } catch (e) { console.error('world mask', e); rows = SEA_ROWS.slice(); }
  const MASK = { w: MW, h: MH, cell: CELL, rows };
  const blocked = (x, y) => { if (!(x >= 0 && y >= 0 && x < W && y < H)) return true; return rows[Math.floor(y / CELL)].charCodeAt(Math.floor(x / CELL)) === 35; };

  /* ---------- NPC roster per POI (A20's role names; A19 writes their lines; ids are stable: <poi>_<role>) ---------- */
  const NPCS = {};
  const ROLE_LABEL = { lord: 'Lord', steward: 'Steward', smith: 'Smith', innkeeper: 'Innkeeper', merchant: 'Merchant', maester: 'Maester', septon: 'Septon', elder: 'Elder', guard: 'Warden', ranger: 'Ranger' };
  const ROLE_SVC = { merchant: ['shop'], innkeeper: ['inn'], smith: ['smith'] };
  for (const p of POIS) {
    const roles = [];
    if (p.seat) roles.push('lord', 'maester'); else if (p.type === 'castle') roles.push('steward'); else if (p.type === 'town') roles.push('elder');
    if (p.shop) roles.push('merchant'); if (p.inn) roles.push('innkeeper'); if (p.smith) roles.push('smith');
    if (p.type === 'shrine') roles.push(/weirwood|heart tree|grove|drowned/i.test(p.name) ? 'elder' : 'septon');
    if (p.type === 'dungeon') roles.push('guard'); if (p.type === 'lair') roles.push('elder');
    if (p.region === 'wall' && p.type === 'castle') roles.push('ranger');
    if (p.type === 'town' && /pass|boneway/i.test(p.id)) roles.push('ranger');
    p.npcs = roles.map(r => { const id = p.id + '_' + r; NPCS[id] = { id, role: r, kind: r, name: ROLE_LABEL[r] + ' of ' + p.name.replace(/^The /, ''), poi: p.id, region: p.region, services: ROLE_SVC[r] || [] }; return id; });
  }

  const regionById = {}; for (const r of REGIONS) regionById[r.id] = r;
  const spawnsByRegion = {}; for (const s of SPAWNS) { const r = regionById[s.region]; if (r) { s.lvl = r.lvl.slice(); r.spawn = s; } spawnsByRegion[s.region] = s; }
  const poiById = {}; for (const p of POIS) poiById[p.id] = p;
  const START = { stark: 'winterfell', lannister: 'casterly', baratheon: 'stormsend', targaryen: 'dragonstone', greyjoy: 'pyke', tyrell: 'highgarden', martell: 'sunspear' };
  const GATES = REGIONS.filter(r => r.gate).map(r => ({ region: r.id, after: r.gate.after, boss: r.gate.boss, via: r.gate.via, name: r.gate.name, blurb: r.gate.blurb, homeOf: Object.keys(HOUSES).filter(h => HOUSES[h].region === r.id) }));

  const world = {
    size: [W, H], W, H, SCALE: 6, CELL, MW, MH,
    regions: REGIONS, regionById, pois: POIS, poiById, roads: ROADS, roadsInfo: ROADS_INFO, spawns: SPAWNS, spawnsByRegion, npcs: NPCS,
    mask: MASK, maskRows: rows, seaRows: SEA_ROWS, blockedPolys: BLOCKED, walkablePolys: WALKABLE, ferries: FERRIES, wall: WALL,
    gates: GATES, start: START, houses: HOUSES,
    order: ['dorne', 'reach', 'stormlands', 'westerlands', 'ironislands', 'dragonstone', 'north', 'crownlands', 'westcoast', 'riverlands', 'vale', 'farnorth', 'wall', 'beyond', 'winter'],
    inPoly, polyArea, blocked,
    regionAt: (x, y) => { for (const r of REGIONS) if (inPoly(x, y, r.poly)) return r; return null; },
    cellAt: (x, y) => ({ c: Math.floor(x / CELL), r: Math.floor(y / CELL) }),
    // the house seat, 40 units south of its marker; the nearest walkable spot if that cell is water
    startPos: house => { const p = poiById[START[house] || 'winterfell']; let x = p.x, y = p.y + 40; if (blocked(x, y)) { let best = null, bd = 1e9; for (let r = 0; r < MH; r++) for (let c = 0; c < MW; c++) if (rows[r][c] === '.') { const cx = c * CELL + CELL / 2, cy = r * CELL + CELL / 2, d = (cx - p.x) ** 2 + (cy - p.y) ** 2; if (d < bd) { bd = d; best = [cx, cy]; } } if (best) { x = best[0]; y = best[1]; } } return { x, y }; },
    gateFor: (regionId, house) => { const g = GATES.find(g => g.region === regionId); return g && g.homeOf.indexOf(house) < 0 ? g : null; },
  };
  R.data.world = world;
  R.data.houses = R.data.houses || HOUSES;
})();
