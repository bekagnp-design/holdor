/* HOLDOR RPG — story, quests, NPCs (A19). Data only: R.data.npcs, R.data.quests, R.data.story + the small R.story resolver.
   Placeholders the quest / dialog modules resolve per account: poi 'seat' = the house seat; giver / target 'seat:<role>' = the NPC
   with that role at the seat; reward hero 'house:N' = the N-th champion of the house (a rescue unlocks that champion as a hero);
   in text: {hero} = the rescued champion's name, {seat} = the seat's name, {house} = the house name, {name} / {lvl} / {killer} in epitaphs.
   One hero at a time, permadeath (ARCH Addendum 2): quests belong to the account, so no line assumes the same person came back.
   Every line is original and <= 110 characters (typed on a phone). */
(function () {
  const D = R.data = R.data || {};
  const SEATS = { stark: 'winterfell', lannister: 'casterly', baratheon: 'stormsend', targaryen: 'dragonstone', greyjoy: 'pyke', tyrell: 'highgarden', martell: 'sunspear' };
  const SEAT_NAMES = { winterfell: 'Winterfell', casterly: 'Casterly Rock', stormsend: "Storm's End", dragonstone: 'Dragonstone', pyke: 'Pyke', highgarden: 'Highgarden', sunspear: 'Sunspear' };
  const HUBS = ['kingslanding', 'winterfell', 'castleblack', 'riverrun', 'eyrie', 'oldtown', 'pyke', 'sunspear', 'highgarden', 'casterly', 'stormsend', 'dragonstone'];
  /* the old CH order per house: 'house:N' resolves to HOUSE_CHAMPS[house][N] unless R.data.champs says otherwise */
  const HOUSE_CHAMPS = { stark: ['jon', 'arya', 'sansa', 'bran', 'robb', 'ned', 'brienne'], lannister: ['jaime', 'tyrion', 'cersei', 'tywin', 'bronn', 'gregor', 'kevan'],
    baratheon: ['stannis', 'robert', 'renly', 'davos', 'melisandre', 'gendry', 'barristan'], targaryen: ['dany', 'jorah', 'greyworm', 'missandei', 'daario', 'drogo', 'viserys'],
    greyjoy: ['theon', 'yara', 'euron', 'balon', 'victarion', 'aeron', 'rodrik'], tyrell: ['margaery', 'olenna', 'loras', 'randyll', 'sam', 'garlan', 'mace'],
    martell: ['oberyn', 'ellaria', 'doran', 'areo', 'obara', 'nymeria', 'tyene'] };
  const CHAMP_NAMES = { jon: 'Jon Snow', arya: 'Arya Stark', sansa: 'Sansa Stark', bran: 'Bran Stark', robb: 'Robb Stark', ned: 'Eddard Stark', brienne: 'Brienne of Tarth',
    jaime: 'Jaime Lannister', tyrion: 'Tyrion Lannister', cersei: 'Cersei Lannister', tywin: 'Tywin Lannister', bronn: 'Bronn', gregor: 'The Mountain', kevan: 'Kevan Lannister',
    stannis: 'Stannis Baratheon', robert: 'Robert Baratheon', renly: 'Renly Baratheon', davos: 'Davos Seaworth', melisandre: 'Melisandre', gendry: 'Gendry', barristan: 'Barristan Selmy',
    dany: 'Daenerys', jorah: 'Jorah Mormont', greyworm: 'Grey Worm', missandei: 'Missandei', daario: 'Daario Naharis', drogo: 'Khal Drogo', viserys: 'Viserys',
    theon: 'Theon Greyjoy', yara: 'Yara Greyjoy', euron: 'Euron Greyjoy', balon: 'Balon Greyjoy', victarion: 'Victarion Greyjoy', aeron: 'Aeron Damphair', rodrik: 'Rodrik the Reader',
    margaery: 'Margaery Tyrell', olenna: 'Olenna Tyrell', loras: 'Loras Tyrell', randyll: 'Randyll Tarly', sam: 'Samwell Tarly', garlan: 'Garlan Tyrell', mace: 'Mace Tyrell',
    oberyn: 'Oberyn Martell', ellaria: 'Ellaria Sand', doran: 'Doran Martell', areo: 'Areo Hotah', obara: 'Obara Sand', nymeria: 'Nymeria Sand', tyene: 'Tyene Sand' };

  /* ---------------- NPCs ---------------- */
  const NPCS = [];
  const N = (id, name, role, poi, house, sprite, greet, idle, x) => { const n = { id, name, role, poi, house: house || null, sprite, lines: { greet, idle }, quests: [] };
    if (x && x.shop) n.lines.shop = x.shop; if (x && x.inn) n.lines.inn = x.inn; NPCS.push(n); return n; };

  /* Winterfell (Stark) */
  N('wf_lord', 'Lord Eddard Stark', 'steward', 'winterfell', 'stark', 'champ:ned',
    ['A sword sworn to Winterfell. Good. I have more work than swords.', 'The gate holds. The fields do not. Speak.', 'Short words. The dead do not wait for long ones.'],
    ['Eight thousand years these walls have stood. One more winter, then.', 'Every banner I have is on the wall. It is not enough banners.']);
  N('wf_maester', 'Maester Tollard', 'maester', 'winterfell', 'stark', 'npc:maester',
    ['Mind the glass on the table. It is sharper than it looks.', 'Three nights without sleep and I am closer to an answer. Sit.', 'Come in. Shut the door; the candles hate the draught.'],
    ['The Citadel calls it obsidian. The old songs call it frozen fire.', 'I have written to Oldtown twice. Ravens do not come back from the south now either.']);
  N('wf_arms', 'Ser Bennard Cerwyn', 'arms', 'winterfell', 'stark', 'npc:arms',
    ['Shoulders back. Weight forward. Now you can be useful.', 'The dead do not tire. You do. Fight accordingly.', 'Back from the field? Show me the blade. Good. You used it.'],
    ['I trained forty in this yard. I have buried thirty. Some twice.', 'Hit the first one hard. The rest come in low behind it.']);
  N('wf_inn', 'Alys of the Winter Town', 'innkeep', 'winterfell', 'stark', 'npc:innkeep',
    ['Fire is lit, stew is hot, door is barred at dusk. Sit.', 'You look frozen. Everyone does. Sit by the fire anyway.', 'Sworn to the castle? You drink what the guards drink, then.'],
    ['The Winter Town is half empty. The other half sleeps here.', 'I keep the lamps burning all night. The dead do not like light. Neither does my purse.'],
    { inn: 'A bed by the fire and a bowl. Your coin, my roof.', shop: 'Bread, hard cheese, a skin of something strong. Northern fare.' });
  N('wf_smith', 'Torrhen the smith', 'smith', 'winterfell', 'stark', 'npc:smith',
    ['Iron, steel, and dragonglass if you bring it. Which?', 'Hands off the anvil. It is hot and it is mine.', "Your edge is dull. Everyone's is. Give it here."],
    ['Northern iron is honest iron. It bends before it breaks.', 'I forged my first sword at twelve. I have forged nothing but swords this year.'],
    { shop: 'Blades and mail. Nothing pretty. Everything sharp.' });
  N('wf_hunter', 'Myra Flint', 'hunter', 'winterfell', 'stark', 'npc:ranger',
    ['The wolfswood is full. Not of game.', 'I know every track in that wood. These tracks drag.', 'You walk loud. The dead do not care. The living should.'],
    ['Direwolves hunt in threes. Dead ones too. Habit, I suppose.', 'My trapline runs to the stream. It used to.']);
  N('wf_crypt', 'Old Walder, keeper of the crypts', 'keeper', 'winterfell', 'stark', 'npc:steward',
    ['Down there is quiet. Was quiet. Keep your voice low anyway.', 'I keep the crypts. I do not keep the kings in them any more.', 'Every Stark has a sword across his knees down there. Some have picked them up.'],
    ['Stones over the doors. Stones do not work. I put them anyway.', 'The iron swords are to keep the dead in their tombs. The old men were not joking.']);

  /* Casterly Rock (Lannister) */
  N('cr_lord', 'Ser Kevan Lannister', 'steward', 'casterly', 'lannister', 'champ:kevan',
    ['The Rock stands. Say what you came to say.', 'A sword that reports promptly. Rare. Speak.', 'Gold pays for walls. It does not pay for men who stay dead. Go on.'],
    ['I have paid for every sword that still answers. I will pay for yours.', 'The mines were our wealth. Now they are our wound.']);
  N('cr_maester', 'Maester Orwell', 'maester', 'casterly', 'lannister', 'npc:maester',
    ['Quietly. The ravens are nervous enough.', 'Ser Kevan sends everyone to me eventually. Sit.', 'You have a question or a wound. Which first?'],
    ['The Rock is honeycombed with old shafts. The dead know them better than the maps do.', 'Dragonglass. I never thought I would write that word in earnest.']);
  N('cr_arms', 'Ser Lyle Lefford', 'arms', 'casterly', 'lannister', 'npc:arms',
    ['In the west we fight with the sun behind us. Learn where it is.', 'The yard is yours. Do not bleed on the lion.', 'Back. Alive. The two things I ask.'],
    ['A dead miner swings a pick the same as a live one. Harder, if anything.', 'Keep the Rock between you and the sea wind. It saps the arm.']);
  N('cr_inn', 'Hollis the innkeep', 'innkeep', 'casterly', 'lannister', 'npc:innkeep',
    ['Gold or silver. Copper if you must. Sit.', 'The Lannisport road brings fewer guests. The ones it brings pay well.', 'Stew, bread, a bed. In that order, if you are wise.'],
    ['Sellswords died on that road owing me. I keep the ledger.', 'A lion on the sign keeps the drunks polite. The dead do not read.'],
    { inn: 'A room over the stable. Clean enough. Pay first.', shop: 'Wine from the Arbor, before the roads closed. Bread from today.' });
  N('cr_smith', 'Gavin the smith', 'smith', 'casterly', 'lannister', 'npc:smith',
    ['Westerland steel. Best in the realm, whatever the Reach says.', 'Grave-iron, mine-iron, I will work any of it.', 'Set it on the bench. I can see the nicks from here.'],
    ['The lord pays in gold. I pay in blisters.', 'I have made more axes this year than horseshoes. Says something.'],
    { shop: 'Blades, mail, a good helm. The gold leaf costs extra and does nothing.' });
  N('cr_miner', 'Foreman Dunstan', 'miner', 'casterly', 'lannister', 'npc:steward',
    ['The lower shafts are shut. They do not stay shut.', 'I lost nine men in the third gallery. I have seen six of them since.', 'You are going down? Take a lamp. They come at the dark.'],
    ['Gold is still down there. So are they.', 'A shaft is a corridor with no way out. Remember that.']);
  N('cr_septon', 'Septon Wyl', 'septon', 'casterly', 'lannister', 'npc:septon',
    ['Seven blessings. Six, if you are in a hurry.', 'The sept is open. It is the one door that is.', 'Pray or do not. The dead do neither.'],
    ['Lannisport has not sent word. A city that size does not go quiet by choice.', 'The Stranger is one of the Seven. I did not expect to meet him on the road.']);

  /* Storm's End (Baratheon) */
  N('se_lord', 'Ser Barristan Selmy', 'steward', 'stormsend', 'baratheon', 'champ:barristan',
    ['Report. Briefly.', "Storm's End has never fallen. I will not be the castellan who lets it start.", 'You stand well. Now speak well.'],
    ['Fury is the house word. Patience is what I need from you.', 'The lower gate is sealed. Everything comes up the cliff stair now, dead or alive.']);
  N('se_maester', 'Maester Ormund', 'maester', 'stormsend', 'baratheon', 'npc:maester',
    ['The wind takes my candles. Say it fast.', "Castellan's orders, I assume. Come in.", 'You smell of salt and rot. The stair, then. Sit.'],
    ['Drowned men should not walk. The sea here disagrees.', "Dragonstone is a day's sail. They have glass. We have need."]);
  N('se_arms', 'Ser Durran Fell', 'arms', 'stormsend', 'baratheon', 'npc:arms',
    ['Stormlanders fight in rain. You will learn to.', 'Arrows bounce off drowned mail. Get in close.', 'Back from the stair. Good. Wipe the blade; salt eats steel.'],
    ['The stair is three men wide. Hold it with two and a spear.', 'I have never seen the castle breached. I have never seen the sea walk, either.']);
  N('se_inn', 'Mother Sella', 'innkeep', 'stormsend', 'baratheon', 'npc:innkeep',
    ['Sit. Eat. Complain after.', 'The fish stew is fish. Do not ask which fish.', "Castle swords eat for half. The castellan's rule, not mine."],
    ['The fishermen will not go out. I understand them. I still need fish.', 'Storm coming. Storm always coming. That is why they named the place.'],
    { inn: 'A dry bed in a wet castle. Rare. Pay.', shop: 'Salt fish, hard bread, cider. Stormland fare.' });
  N('se_smith', 'Hake the smith', 'smith', 'stormsend', 'baratheon', 'npc:smith',
    ['Salt eats everything. I grind faster than it eats.', 'Set it down. I will have it sharp before the tide turns.', 'You want a shield. Everyone on the stair wants a shield.'],
    ['Drowned men wear good mail. The sea does not finish it.', "I was a ship's smith. The ship is on the rocks. I am not."],
    { shop: 'Blades, shields, mail oiled against the salt.' });
  N('se_fisher', 'Old Benjicot', 'fisher', 'stormsend', 'baratheon', 'npc:smuggler',
    ['Sea gives back what it takes now. Never used to.', 'My brother went under in the spring. He walked up the path in autumn.', 'Boats stay in. I am not a coward. I am a fisherman.'],
    ['The septon has not come down in days. Old men forget to.', 'Shipbreaker Bay. The name was a warning. Nobody listened.']);
  N('se_septon', 'Septon Maslyn', 'septon', 'stormsend', 'baratheon', 'npc:septon',
    ['Still here. Still praying. Still arguing.', 'The Seven listen. They do not answer quickly.', 'Come to pray or come to check I am alive? Both are welcome.'],
    ['I bless the men on the stair each dusk. Some come back. I bless them again.', 'The Stranger walks the cliff path now. I never liked him.']);

  /* Dragonstone (Targaryen) */
  N('ds_lord', 'Prince Viserys', 'steward', 'dragonstone', 'targaryen', 'champ:viserys',
    ["The dragon's sword. Report.", 'Black glass, black smoke, grey dead. That is my island now. Speak.', 'You have my attention. Do not waste it.'],
    ['The garrison grows thinner. The beach grows fuller.', 'The ships will come. Until then, the gate road is yours.']);
  N('ds_maester', 'Maester Ardrian', 'maester', 'dragonstone', 'targaryen', 'npc:maester',
    ['Dragonglass under every stone here. I never thought we would need it.', 'The prince sent you. Good. Sit; mind the shards.', 'Fast. The ravens are restless and I am old.'],
    ['The dead on the shingle were our fishermen. I knew their names.', 'Frozen fire, the songs say. On this island, the fire part is literal.']);
  N('ds_arms', 'Ser Gyles Sunglass', 'arms', 'dragonstone', 'targaryen', 'npc:arms',
    ['The beach is the yard now. Train there.', 'Drowned axemen come up at dusk with the tide. Be on the shingle before them.', 'Back from the shore? Count the dead. Then count your fingers.'],
    ['Thin garrison. Long wall. Do the arithmetic.', 'Glass edge, steel spine. That is a Dragonstone blade now.']);
  N('ds_inn', 'Marya of the harbour', 'innkeep', 'dragonstone', 'targaryen', 'npc:innkeep',
    ['Harbour is empty. Inn is full. Sit where you can.', 'Fish, bread, and the view of nothing coming. Eat.', 'Castle swords pay like sailors. Half up front.'],
    ['The ships will come, the prince says. I have stopped setting places for them.', 'I bar the door at dusk and open it at dawn. The dead keep to the beach so far.'],
    { inn: 'A bed above the taproom. Warm from the chimney.', shop: 'Smoked fish, black bread, and a wine that tastes of smoke.' });
  N('ds_smith', 'Ulf the smith', 'smith', 'dragonstone', 'targaryen', 'npc:smith',
    ['Only man on the island grinding glass. Bring me shards.', 'Set it down. Glass edge or steel? Glass, if you want to live.', 'Hands. Show me your hands. Good; you can hold a hilt.'],
    ['Dragonglass chips if you look at it wrong. It also kills the dead. Trade-offs.', 'Six shards make an edge. Sixty make a watch.'],
    { shop: 'Glass-edged knives, steel swords, mail. Glass costs; glass works.' });
  N('ds_smuggler', 'Corlys the smuggler', 'smuggler', 'dragonstone', 'targaryen', 'npc:smuggler',
    ['You did not see a boat in this cove. Good.', 'The sea roads are empty of ships and full of walkers. Ask me anything else.', 'Smuggler is an ugly word. I prefer sailor with discretion.'],
    ['I ran onions once, in a worse war. This is a worse war than that.', 'The harbour master thinks I lie. I do. In useful directions.']);
  N('ds_harbour', 'Harbour master Denys', 'harbour', 'dragonstone', 'targaryen', 'npc:ranger',
    ['Nothing in, nothing out. That is my report every day.', 'The chain is up. I am not sure what it keeps out any more.', 'A castle sword on my quay. Mind the nets.'],
    ['There is a smuggler in the cove. Everyone knows. Nobody says.', 'Pilots will not sail. I cannot blame them. I can still curse them.']);

  /* Pyke (Greyjoy) */
  N('pk_lord', 'Rodrik the Reader', 'steward', 'pyke', 'greyjoy', 'champ:rodrik',
    ['I keep the hall and the accounts. The accounts are mostly of the dead. Speak.', 'A sword who can read a map. Rare on these islands. Report.', 'Short. The tide does not wait, and neither do they.'],
    ['Books say the dead walked once before. Books also say it ended. I hold to that.', 'Pyke stands on these rocks because nothing else will.']);
  N('pk_maester', 'Maester Oswyn', 'maester', 'pyke', 'greyjoy', 'npc:maester',
    ['Salt in the ink again. Say it quickly.', 'The Reader sent you. Of course he did. Sit on the dry chair.', 'Wet, cold and bleeding. That is everyone here. What else?'],
    ['Drowned priests say the sea is angry. The sea is a sea. Something else is angry.', 'Dragonglass. On an island of wet rock. I will have to send for it.']);
  N('pk_arms', 'Harrag of Stonetree', 'arms', 'pyke', 'greyjoy', 'npc:arms',
    ['Chains are slick. Do not fall. That is the whole lesson.', 'Reavers climb the bridge chains at night. You meet them at the top.', 'Back. Not drowned. Good start.'],
    ['Iron in your hand, iron in your blood, iron in the sea. Pick one to trust.', 'The second bridge is the weak one. It always was.']);
  N('pk_inn', 'Gwyn the alewife', 'innkeep', 'pyke', 'greyjoy', 'npc:innkeep',
    ['Ale, fish, floor. Pick two.', 'Sit down before the wind sits you down.', 'From the castle? You will want the strong ale, then.'],
    ['The drowned priest is on the rocks again. Folk are listening. I do not like it.', 'Iron price, gold price. My price is coin, and I take it before the ale.'],
    { inn: 'A pallet by the hearth. The wind cannot reach it. Mostly.', shop: 'Dried fish, black ale, a bitter bread that keeps.' });
  N('pk_smith', 'Rolfe the smith', 'smith', 'pyke', 'greyjoy', 'npc:smith',
    ['Sea-iron. Bring it. I beat the salt out.', 'Set it down. You have been hitting rock, not bone.', 'Axes, mostly. Islanders want axes.'],
    ['Iron from the sea pays for itself twice.', 'I shod horses once. Horses do not swim. Nobody rides here now.'],
    { shop: 'Axes, hooks, mail scoured of rust. Island steel.' });
  N('pk_priest', 'Erik Saltbeard, a drowned priest', 'priest', 'pyke', 'greyjoy', 'npc:septon',
    ['The sea gives and the sea takes. Lately it only gives back.', 'You come to hear me. Few do until they have seen a drowned man walk.', 'Salt water in your lungs is a blessing. Ask the ones who came back if they agree.'],
    ['What the sea returns is not the man it took.', 'I have drowned a hundred men and brought them up. None walked away. These do.']);
  N('pk_captain', 'Captain Ulla Volmark', 'captain', 'pyke', 'greyjoy', 'npc:ranger',
    ['My ship is in. My crew is not. Half of them walked back without her.', 'You want to hear about the sea. Nobody wants to hear about the sea.', 'Keep off the quay at night. That is the one piece of advice I have.'],
    ['Longships row through anything. They do not row through this.', 'The Reader reads. I sail. Neither of us knows what this is.']);

  /* Highgarden (Tyrell) */
  N('hg_lord', 'Ser Garlan Tyrell', 'steward', 'highgarden', 'tyrell', 'champ:garlan',
    ['The gardens are a yard of spears. I keep them tidy. Speak.', 'The river gate is where it is worst. What do you bring?', "My father's castle, my watch. Report."],
    ['Roses have thorns, they say. We are the thorns now.', 'Highgarden was never built for war. Everything is a fortress today.']);
  N('hg_maester', 'Maester Hobert', 'maester', 'highgarden', 'tyrell', 'npc:maester',
    ['Mind the herbs drying. They are worth more than the glass.', 'Ser Garlan sends me everyone. Sit. Bleed on the stone, not the books.', 'Quick. The wounded are many and I am one.'],
    ['The Mander brings them up from the sea, bloated. I have stopped counting.', 'Oldtown is two days downriver and has not answered in ten.']);
  N('hg_arms', 'Ser Edwyd Fossoway', 'arms', 'highgarden', 'tyrell', 'npc:arms',
    ['Reach knights ride. The dead do not care. Learn to stand.', 'The river stair is slick with what they leave. Mind your feet.', 'Back from the stair. Show me. Good.'],
    ['A tourney taught me nothing about this. Nothing taught anyone about this.', 'Slow and heavy. Two hits where a farmer takes one.']);
  N('hg_inn', 'Delia at the river stair', 'innkeep', 'highgarden', 'tyrell', 'npc:innkeep',
    ['Sit. The stew has meat today. Do not ask tomorrow.', 'From the castle? The septa will want to bless you. Eat first.', 'Door barred at dusk. Bell rings, you come in. Simple.'],
    ['The septa rings the bell so the field hands come in. She missed it last night.', 'Roses used to be the smell here. Now it is the river.'],
    { inn: 'A clean bed in the old garden house. Pay.', shop: 'Bread, cheese, apples from the last picking, a sweet wine.' });
  N('hg_smith', 'Willum the smith', 'smith', 'highgarden', 'tyrell', 'npc:smith',
    ['I made garden rakes. Now I make spears. Same steel.', 'Set it on the bench. River water rusts an edge in a night.', 'Mail for a castle sword. Let me measure.'],
    ['The Reach had the best steel and no use for it. Now it has a use.', 'I keep the forge lit all night. The light keeps them off the stair. Somewhat.'],
    { shop: 'Spears, swords, mail. Reach steel, plain finish.' });
  N('hg_gardener', 'Old Merry, head gardener', 'gardener', 'highgarden', 'tyrell', 'npc:septon',
    ['Forty years I grew roses. Now I grow spears. They grow faster.', 'Herbs still come up by the river. The dead walk over them. Herbs do not mind.', 'Mind the beds. Habit.'],
    ['The maester wants herbs. The dead want the river. I want my gardens back.', 'Soil remembers. These paths were roses. They will be again.']);
  N('hg_septon', 'Septa Rhea', 'septon', 'highgarden', 'tyrell', 'npc:septon',
    ['The bell rings at dusk. If it does not, come looking.', 'Seven blessings. Mind the window; a dead hand took the rope through it.', 'You fight for the living. The Seven keep count.'],
    ['I pray for the field hands by name. The list changes.', 'The Mother is merciful. The Mander is not.']);

  /* Sunspear (Martell) */
  N('ss_lord', 'Nymeria Sand', 'steward', 'sunspear', 'martell', 'champ:nymeria',
    ['The prince keeps his seat. I keep his gate. Speak.', 'Sworn to the sun and spear. Unbowed is the word. Unburied is the problem.', 'Dead bones break like any others. Tell me how many you broke.'],
    ['Sunspear has outlasted dragons. It will outlast a few walking bones.', 'The riders say the dead face north. They are not coming for us. They are going.']);
  N('ss_maester', 'Maester Myles', 'maester', 'sunspear', 'martell', 'npc:maester',
    ['Shade and water. Then talk.', 'Lady Nym sends you. Sit; the stone is cool.', 'Bones older than the gate are walking. I have questions. You have answers?'],
    ['In Dorne the dead were always dry. Dry things keep.', 'Glass. The Red Mountains have some. Nobody has mined it in a thousand years.']);
  N('ss_arms', 'Ser Arron Qorgyle', 'arms', 'sunspear', 'martell', 'npc:arms',
    ['Dornish fight in the heat. The dead do not sweat. Nor should you waste it.', 'Break the bones. Then break the pieces.', 'Back from the road. Sand on the blade; good, you were low.'],
    ['Spear over sword in the sand. Reach matters when they do not feel pain.', 'Old armour, old bones. Hit the joints.']);
  N('ss_inn', 'Lia of the Shadow City', 'innkeep', 'sunspear', 'martell', 'npc:innkeep',
    ['Water first. Then wine. Then talk.', 'From the castle? Sit in the shade; the sun is free.', 'The Shadow City is thirsty. I pour what I have.'],
    ['The dead carry waterskins they will never drink. In Dorne that is a crime.', 'Spiced lamb, when there is lamb. Spiced bread when there is not.'],
    { inn: 'A cool room off the courtyard. Pay in coin, not promises.', shop: 'Flatbread, dates, blood oranges, a wine that fights back.' });
  N('ss_smith', 'Yorick the smith', 'smith', 'sunspear', 'martell', 'npc:smith',
    ['Spears. You want a spear. Everyone in Dorne wants a spear.', 'Set it down. Sand is kinder to steel than salt.', 'Hands. Good. Dornish grip, low and loose.'],
    ['Old bronze on the dead. Good bronze. I melt it down.', 'The forge is the coolest place at noon. Nobody believes me.'],
    { shop: 'Spears, short swords, light mail for the heat.' });
  N('ss_rider', 'Ryon, a sand rider', 'rider', 'sunspear', 'martell', 'npc:ranger',
    ['I rode in from the Broken Arm. The dunes are walking.', 'Riders see what walls do not. Walls do not listen.', 'My horse would not go near them. Horses are wiser than lords.'],
    ['Out of the dunes in a line, all facing north. Like pilgrims.', 'Dorne has sand enough to bury the dead twice. They keep coming up.']);
  N('ss_septon', 'Septon Haldon', 'septon', 'sunspear', 'martell', 'npc:septon',
    ['Seven blessings, and shade for an eighth.', 'The sept is cool. That is why they come. I take what piety I can get.', 'Pray for the living. The dead have their own business.'],
    ['Dorne kept its own gods once. They did not stop this either.', 'The bones that walk were men who fought dragons. They deserve a second rest.']);

  /* King's Landing */
  N('kl_hand', 'Lord Orys Buckwell, the Hand', 'steward', 'kingslanding', null, 'npc:steward',
    ['You came from a seat. Which, and what walks there? Briefly.', 'The Hand hears everyone eventually. You are early. Speak.', 'Wipe your boots. Then report.'],
    ['Every road leads to the capital. So do the dead.', 'The king hunts. The Hand governs. The dead do not care who does which.']);
  N('kl_maester', 'Grand Maester Rodwell', 'maester', 'kingslanding', null, 'npc:maester',
    ["The Red Keep's ravens fly. Nothing flies back. Sit.", 'News from the provinces. I collect those.', 'Yes, yes, the dead. Everyone says the dead. Give me details.'],
    ['The Citadel wants proof. I have sent them a hand. A walking one.', 'Dragonglass. The Targaryens sat on a mountain of it and used it for ornaments.']);
  N('kl_captain', 'Ser Bronn, commander of the gold cloaks', 'arms', 'kingslanding', 'lannister', 'champ:bronn',
    ['You want the Hand. Half the city wants the Hand. The other half wants him gone.', 'Gold cloaks hold the gates. Some of them are dead and still holding. Mind that.', 'I am paid to keep the peace. The dead do not pay. Neither do you. Talk fast.'],
    ['I have held the River Gate twice. Once against the living. Once was easier.', 'Half my men ran. The other half died. Some of those came back.']);
  N('kl_inn', 'Besha of Flea Bottom', 'innkeep', 'kingslanding', null, 'npc:innkeep',
    ['Bowl of brown. Do not ask. Sit.', 'Steel in Flea Bottom. Lost or brave?', 'Door is barred at dark. Things crawl out of the gutters after.'],
    ['Flea Bottom never asked the crown for anything. The crown never gave.', 'Eight of them from my doorstep last night. Crawling. I counted.'],
    { inn: 'A pallet upstairs. The roof leaks. The door holds.', shop: 'Bowl of brown, bread, a wine that was once something else.' });
  N('kl_smith', 'Hal of the Street of Steel', 'smith', 'kingslanding', null, 'npc:smith',
    ['Street of Steel. Half the shops are shut. Mine is not.', 'Set it down. City steel is good steel, whatever the Westerlands say.', 'Mail for the gates sells. Mail for the living sells better.'],
    ["Gold cloaks bring me their dead men's swords to reforge. Grim trade.", "The king's armourer makes pretty things. I make things that come back."],
    { shop: 'Swords, mail, a helm with a nasal. City work, honest price.' });
  N('kl_septon', 'Septon Mallor', 'septon', 'kingslanding', null, 'npc:septon',
    ['The Great Sept is full of the praying. The streets are full of the other kind.', 'Seven blessings. You carry steel into a sept; today I allow it.', 'The star should be on the living. It is on the dead.'],
    ['Gold cloaks wore the seven-pointed star. They wear it still. That cannot stand.', 'I bless the gates each dawn. The dead come back each dusk. We are at an impasse.']);
  N('kl_smuggler', 'Cotter the smuggler', 'smuggler', 'kingslanding', null, 'npc:smuggler',
    ['I do not know you. That is how I like it.', 'Crates on the Duskendale road. Mine. Do not open them.', 'The dead do not pay customs either. We have that in common.'],
    ['The river is quiet. Too quiet for a river with a city on it.', 'I hear things. Lately I hear dragging feet.']);

  /* Castle Black */
  N('cb_lc', 'Lord Commander Hoster Royce', 'steward', 'castleblack', null, 'npc:steward',
    ['A sword from the south. Good. We are short. Report.', 'Seven hundred feet of ice and a handful of men. You are one more hand. Speak.', 'The Watch sends for every sword. You came. That is more than most.'],
    ['Whatever is behind the dead is behind the Wall. I have known that a year.', 'My rangers go north. Fewer come back each time. I keep sending them.']);
  N('cb_maester', 'Maester Edric', 'maester', 'castleblack', null, 'npc:maester',
    ['Nearly blind, not nearly deaf. Speak up.', 'Sam reads to me. You can speak to me. Sit.', 'Cold hands. You have been outside. Everyone has been outside.'],
    ['I have read every account of the Long Night. None says how it ended. Only that it did.', 'Dragonglass in the cache at the Fist. Ten blades. I counted them out myself.']);
  N('cb_sam', 'Samwell Tarly', 'scribe', 'castleblack', 'tyrell', 'champ:sam',
    ['I keep the books. And the maester. And out of the way, mostly.', 'From the south? I have read about your house. Sorry; I read about everything.', 'There is a passage about dragonglass in a book nobody opened for two hundred years. I opened it.'],
    ['The maester says I would make a good maester. I say the Wall needs me more. We argue.', "I counted the dead at the Fist from the rangers' lists. I stopped at forty."]);
  N('cb_arms', 'Ser Cuger Locke', 'arms', 'castleblack', null, 'npc:arms',
    ['Southern stance. Fix it. The ice does not forgive a wide step.', 'The tunnel under the Wall. Dead Thenns in it. Bronze. Ten. That is your lesson today.', 'Back. Fingers? All ten. Good.'],
    ['I train recruits in a week. I used to have a year.', 'Bronze does not rust. Thenn bronze does not break, either.']);
  N('cb_cook', 'Dunsen the cook', 'innkeep', 'castleblack', null, 'npc:innkeep',
    ['Bowl. Spoon. Sit. That is the whole kitchen.', 'A southern sword at my table. You eat what brothers eat.', 'Boar tonight, if someone brings boar. Nobody brings boar.'],
    ['I cook what we have. We have nothing. I am an artist.', 'The frozen boar in the forest is frozen, not rotten. I am not proud.'],
    { inn: "A cot in the common hall. The fire never dies. Brothers' rule.", shop: 'Black bread, onion soup, a wine the Watch would call wine.' });
  N('cb_smith', 'Garth the armourer', 'smith', 'castleblack', null, 'npc:smith',
    ['Black steel. Black mail. Black everything. Set it down.', 'Dead brothers took good blades with them. I want them back.', 'Your edge is glass. Good. Mind it on the ice.'],
    ['Ten names on the forge wall this month. It is getting to be a long wall.', 'I reforge what the dead drop. The steel does not know who held it.'],
    { shop: 'Blades, mail, boots that keep toes. Watch issue.' });
  N('cb_ranger', 'Ranger Cregan Snow', 'ranger', 'castleblack', null, 'npc:ranger',
    ['Back from the Fist. Three of us went. One of us is talking to you.', 'The forest moves at night. Not the trees.', 'You are going north. Learn the ground or the ground learns you.'],
    ['Cache under the cairn at the Fist. Oilcloth. Ten blades. Dead men walk over it.', 'Rangers do not run. We walk away quickly.']);
  N('cb_turncloak', 'Varra, a wildling turncloak', 'turncloak', 'castleblack', null, 'npc:smuggler',
    ['The crows put me in a cell. The cold put me on this side of the Wall. Ask your questions.', 'I have seen where it comes from. You have not. Listen.', 'Free folk, you call wildlings. The dead call us meat. We are all on one side now.'],
    ['There is a hall in the forest where a man fed his sons to the cold. The sons came back.', 'Hardhome has thousands with the sea at their backs. Your crows have boats. Some.']);

  /* Riverrun */
  N('rr_lord', 'Ser Robin Mooton, castellan', 'steward', 'riverrun', null, 'npc:steward',
    ['The rivers are full and the wells are low. Report.', 'From the capital? The Hand lives, then. Good. Speak.', 'Riverrun holds. Three rivers, a hundred fords, and the dead crossing every one.'],
    ['The bank is lined with dead bowmen. The women cannot reach the water.', 'The Twins hold the only bridge north. The Freys know it.']);
  N('rr_maester', 'Maester Elwood', 'maester', 'riverrun', null, 'npc:maester',
    ['Ink and ice. Odd pairing. Sit.', 'The castellan sent you. Of course. Mind the cores on the sill; they do not melt.', 'Quickly. I have a letter to finish that nobody will believe.'],
    ['Harrenhal is a ruin and ruins remember. Something cold nests there.', 'Wraiths over the Tumblestone at night. The water freezes where they pass.']);
  N('rr_arms', 'Ser Jon Piper', 'arms', 'riverrun', null, 'npc:arms',
    ['Riverlords fight at fords. You will learn to stand in water.', 'Dead archers are nothing up close. Getting close is the trick.', 'Back. Wet to the knee. That means you closed with them. Good.'],
    ['Three rivers mean three fronts. I have men for one.', 'A charge in the shallows is a charge in mud. Let the dead riders learn that.']);
  N('rr_inn', 'Hetty of the ferry', 'innkeep', 'riverrun', null, 'npc:innkeep',
    ['Ferry inn. Ferry is not running. Inn is.', 'Sit. Eat. The smith has not eaten in two days; you can eat for him.', 'From the south? You will want a bed before the fords.'],
    ['Tomard works and does not eat. I will send bread with the next fool who passes.', 'The ferryman says dead riders charge the raft. He is not a dramatic man.'],
    { inn: 'A bed above the taproom with the river under it. Pay.', shop: 'Trout when there is trout. Bread, cheese, river ale.' });
  N('rr_smith', 'Tomard the smith', 'smith', 'riverrun', null, 'npc:smith',
    ['Working. Talk while I work.', 'Bread? From Hetty. Tell her I ate. I will eat.', 'Set it down. River damp takes an edge in a night.'],
    ['Riverland steel is soft. I temper it harder. It still bends.', 'Every ford needs spears. I have made four hundred. Not enough.'],
    { shop: 'Spears, swords, mail. Riverland work.' });
  N('rr_ferry', 'Watt the ferryman', 'ferryman', 'riverrun', null, 'npc:ranger',
    ['Raft is tied. Dead riders charge anything on the water.', 'Eight horses on the far bank that should have been meat by now.', 'You want to cross. I want to live. Clear the bank and we both get our way.'],
    ['Thirty years on this river. Never been charged by a dead horse before this spring.', "The far bank is theirs. The near bank is mine. The river is nobody's."]);
  N('rr_carter', 'Wat the carter', 'carter', 'riverrun', null, 'npc:smuggler',
    ['Grain for the Twins. Toll for the bridge. Me in the middle.', 'Walk beside the wagon. The dead like wagons. I do not know why.', 'Oxen are steady. I am not.'],
    ['Every sack counted. The Freys will count again.', 'If the wagon arrives the bridge opens. If not, I am a dead man either way.']);

  /* The Eyrie */
  N('ey_lord', 'Lady Maris Arryn', 'steward', 'eyrie', null, 'npc:steward',
    ['You climbed. That says enough. Speak.', 'The Vale is high and the dead are slow. It is not enough. Report.', 'Gulltown is silent, the road is silent. Tell me something that is not.'],
    ['Mountains the dead climb slowly. The living cannot climb fast enough.', 'The Gates of the Moon hold the road. The Eyrie holds the sky. The sky has wraiths now.']);
  N('ey_maester', 'Maester Rhodry', 'maester', 'eyrie', null, 'npc:maester',
    ['Thin air. Short sentences. Sit.', 'Lady Maris sends you. Mind the feathers; they are evidence.', 'You climbed six hundred steps to see me. Make it worth both our while.'],
    ['Ice eagles. Dead ones. Flying. I have no chapter for that.', 'The wraiths come in with the wind. The wind is always.']);
  N('ey_arms', 'Ser Jasper Hunter', 'arms', 'eyrie', null, 'npc:arms',
    ['Vale knights fight on slopes. Learn which foot is uphill.', 'Wraiths take half a blow. Hit twice.', 'Back from the cells. Still have your wits? Good. Some do not.'],
    ['Six hundred steps. The dead climb them without stopping. I stop twice.', 'Mountain clans used to be the problem. I miss them.']);
  N('ey_inn', 'Rolf of the Gates of the Moon', 'innkeep', 'eyrie', null, 'npc:innkeep',
    ['Last fire before the climb. Sit.', 'From the lowlands? Eat before the steps.', 'Mule, bed, bowl. Pick your order.'],
    ['Sky cells are empty of prisoners and full of wraiths. The gaoler drinks here. A lot.', 'The falconer buries feathers. I pour him another.'],
    { inn: 'A bed at the foot of the mountain. Warmer than the top.', shop: 'Mountain goat, hard bread, a wine that climbs.' });
  N('ey_smith', 'Benedar the smith', 'smith', 'eyrie', null, 'npc:smith',
    ['Thin air makes a hot forge. Set it down.', 'Vale steel. Falcon on the hilt if you pay for it.', 'Wraiths need an edge that bites cold. I do what I can.'],
    ['I shoe mules. I forge swords. The mules are more grateful.', 'The gaoler wants bars. I tell him wraiths do not care about bars.'],
    { shop: 'Swords, spears, light mail for the climb.' });
  N('ey_falconer', 'Hugo the falconer', 'falconer', 'eyrie', null, 'npc:ranger',
    ['My birds are dead and flying. I want their feathers back.', 'Ice eagles took the mews. They were my eagles first.', 'Hoods, jesses, bells. I buried the bells.'],
    ['A falcon knows its master. These do not know anything.', 'Eight feathers. I will bury what I can.']);
  N('ey_gaoler', "Kett, the sky cells' keeper", 'keeper', 'eyrie', null, 'npc:steward',
    ['Cells are empty. Not of wraiths.', 'I am paid to keep the cells. Not to die in them.', 'Wind comes in with company. Eight of them this week.'],
    ['Prisoners used to jump. Now the sky comes in to them.', 'I lock doors for a living. There is no door for wind.']);

  /* Oldtown */
  N('ot_lord', 'Lady Alysanne Hightower', 'steward', 'oldtown', null, 'npc:steward',
    ['The lamp burns. The city lives. Speak.', 'From upriver? The Citadel will want you. I want you first.', 'Oldtown has outlived every war in Westeros. I intend it to outlive this.'],
    ['The archmaesters argue. The dead do not. One side has the advantage.', 'Ships still come to the Hightower lamp. Some of them.']);
  N('ot_archmaester', 'Archmaester Hobber', 'maester', 'oldtown', null, 'npc:maester',
    ['You have killed one with your own hands? Sit. I have questions. Forty.', 'The Citadel does not believe ravens. It believes witnesses. You are one.', 'Do not touch the specimens. Some of them touch back.'],
    ['Eight thousand years of records and not one says how the Long Night ended.', "Knowledge is the Citadel's coin. We pay our debts in it."]);
  N('ot_arms', 'Ser Ryam Beesbury', 'arms', 'oldtown', null, 'npc:arms',
    ['City guard stance. Short sword, big shield. Learn it.', 'The quay is where they come up. Dead sailors. Mind the oil flasks.', 'Back. Honeywine on your boots. Good; you were at the water.'],
    ['Novices make poor soldiers. They make worse corpses. I train them anyway.', 'The Hightower guards the lamp. I guard the Hightower. Someone guards me, I hope.']);
  N('ot_inn', 'Jonquil the innkeep', 'innkeep', 'oldtown', null, 'npc:innkeep',
    ['Novices, sailors, swords. Sit wherever is empty.', 'The Honeywine is quiet tonight. Quiet is good. Eat.', 'The archmaester will want to ask you things. Drink first.'],
    ['Bats in the Citadel stacks. The novices will not go down. The archmaesters will not either.', 'The lamp burns all night. My lamps too. Oil is dear.'],
    { inn: 'A room over the river with a shutter that locks. Pay.', shop: 'Bread, river fish, Arbor red from before, cider from now.' });
  N('ot_smith', 'Ulwyck the smith', 'smith', 'oldtown', null, 'npc:smith',
    ['Oldtown steel. Older than most. Set it down.', 'The Citadel wants instruments. The guard wants blades. I make blades.', 'Mail for the quay. Sailors come up wet and angry.'],
    ['I made a brass astrolabe once. Now I make axes. Same hammer.', 'The lamp needs oil, the forge needs coal, the city needs both.'],
    { shop: 'Short swords, shields, mail. City guard pattern.' });
  N('ot_novice', 'Novice Hugh', 'novice', 'oldtown', null, 'npc:septon',
    ['The lower stacks are full of bats. Not ordinary bats. The bite goes grey.', 'Novices are cheaper than archmaesters. That is why I am here talking to you.', 'I was going to forge a link in healing. I am forging one in running.'],
    ['Ten bats at least. The archmaester counted from upstairs.', 'Books do not burn, they say. The archmaesters say a lot of things from upstairs.']);
  N('ot_harbour', 'Harbour master Rhogar', 'harbour', 'oldtown', null, 'npc:ranger',
    ['The lamp guides every ship that still sails. It needs oil.', 'Dead sailors on the quay carry oil flasks. I do not know why. I know I want them.', 'Ships come. Some. Fewer. Speak.'],
    ['The Hightower lamp has burned a thousand years. Not on my watch does it go out.', 'Sailors who drowned in the Whispering Sound come up the steps at dusk.']);

  /* the road north and the lesser places */
  N('tw_lord', 'Ser Lucan Frey, keeper of the toll', 'steward', 'twins', null, 'npc:steward',
    ['The bridge is ours. The toll is grain. Speak.', 'Every sack counted. The Freys always count. Report.', 'Past the bridge is the Neck. Nothing comes through it alive now.'],
    ['We hold the only bridge over the Green Fork. We know what that is worth.', 'A Walker holds Moat Cailin. Not a wight. A Walker.']);
  N('hh_warden', 'Pate, warden of the ruin', 'warden', 'harrenhal', null, 'npc:steward',
    ['Harrenhal is a ruin. I am its warden. Do not laugh.', 'Nobody who sleeps inside the walls wakes. Camp outside.', 'Something cold nests in the burned towers. Its servants carry bone that frost will not leave.'],
    ['Harren built it to last forever. It lasted a day against dragons. It is lasting longer against this.', 'I count the towers each dawn. Five. Still five.']);
  N('mc_crannog', 'Howland of the Neck, a crannogman', 'ranger', 'moatcailin', null, 'npc:ranger',
    ['The Neck is ours. Was ours. The Walker took the ruin and we took the bog.', 'Three towers still stand. It stands in the middle one.', 'Crannogmen do not fight Walkers. We show others where to.'],
    ['Every soldier who ever died at Moat Cailin is up and in the causeway.', 'Frogs are quiet. Frogs are never quiet. That is how you know.']);
  N('wh_lord', 'Lord Osric Manderly', 'steward', 'whiteharbor', null, 'npc:steward',
    ['White Harbor feeds its people. That makes us a target. Speak.', 'The chain is up. The gate opened for you. Do not waste that.', 'From the Twins? The bridge opened, then. Good. Report.'],
    ['Winterfell has gone quiet. No ravens, no riders, no smoke seen from the road.', 'Ships still come in. The North can be fed by sea if the port holds.']);
  N('wh_captain', 'Captain Edda of the harbour', 'captain', 'whiteharbor', null, 'npc:ranger',
    ['Harbour chain is up. Ships wait outside. I decide who comes in.', 'From the south? The lord will want you. I wanted a look first.', 'Keep off the seal rocks at night.'],
    ['Drowned men come up with the seals. The seals leave.', 'White Harbor was built by southerners. It still thinks like one.']);
  N('df_castellan', 'Castellan Morgan Slate', 'warden', 'dreadfort', null, 'npc:steward',
    ['The Dreadfort went dark first. I am what is left of its garrison. Speak.', 'Walkers come out of the keep in twenties. Like a garrison. I had a garrison once.', 'You have glass. Good. Nothing else frightens them.'],
    ['This castle was a tomb before. It is honest about it now.', 'I hold the gatehouse. The rest is theirs.']);
  N('lh_lord', 'Lord Hallis Umber', 'steward', 'lasthearth', null, 'npc:steward',
    ['My gate was oak and iron. It flattened it with one swing. Speak.', 'Last Hearth burns. The dead giants carry the fire with them. Report.', 'An Umber does not run. We did. Then we laughed. Tell me what you want.'],
    ['Kill it or I bury what is left of my house under what is left of my hall.', 'The Watch sends for every sword. They have sent before. Now they mean it.']);
  N('lh_smith', 'Brenna the smith', 'smith', 'lasthearth', null, 'npc:smith',
    ['The hall burned. The forge did not. Set it down.', 'Hearth-stones, warm from the hall, in dead giants. I have seen stranger. No, I have not.', 'Umber steel. Heavy. Like the men.'],
    ['I forged the gate hinges. I will forge them again.', 'Giants do not need weapons. The dead ones carry trees anyway.'],
    { shop: 'Axes, heavy mail, a shield that stops a club. Once.' });
  N('kh_lord', 'Lord Edric Karstark', 'steward', 'karhold', null, 'npc:steward',
    ['Karhold holds. Barely. Speak.', 'The sea is frozen to the horizon. Things walk on it.', 'A sword from Winterfell? Then Winterfell stands. Good.'],
    ['Karstarks are Starks with longer memories. We remember the Long Night.', 'The dead come over the ice from the east. There is nothing east.']);
  N('dw_lady', 'Lady Mina Glover', 'steward', 'deepwood', null, 'npc:steward',
    ['Deepwood is wood and a motte. The wood is theirs. Speak.', 'The wolfswood is full. Not of game. Report.', 'Ironborn raided us once. I would take ironborn now.'],
    ['Trees hide them until they are on the palisade.', 'The motte holds. The village does not exist any more.']);
  N('gt_master', 'Harbour master Elys Grafton', 'harbour', 'gulltown', null, 'npc:ranger',
    ['Gulltown stands. The ships still come. Tell the Eyrie.', 'The mountain road has been silent ten days. You walked it. You are the first.', 'Port is open. Gate is shut at dusk.'],
    ['The Vale is not an island yet. Give it a year.', 'Sailors say the Narrow Sea is empty. Sailors say many things.']);
  N('dk_reeve', 'Reeve Alyn of Duskendale', 'warden', 'duskendale', null, 'npc:steward',
    ['Duskendale had a lord. It has a reeve now. Speak.', 'Something with a crown walked in from the capital road. The dead gather to it.', "Smuggler's crates on the road. Everyone knows. Nobody opens them."],
    ['A king is still a king to the dead. That is the trouble.', 'We shut the harbour. We shut the gate. We could not shut the crypts.']);
  N('ln_reeve', 'Reeve Tomas of Lannisport', 'warden', 'lannisport', null, 'npc:steward',
    ['Lannisport stands. Tell the Rock, since the ravens will not.', 'The sept has a roof and a congregation. Half the prayers in the west are said under it.', 'The city has walls. The dead have time.'],
    ['Gold does not buy walls fast enough.', 'The septon of the Rock worries about us. Tell him to worry about himself.']);
  N('hn_castellan', 'Castellan Hugh Tarly', 'warden', 'hornhill', null, 'npc:steward',
    ['Horn Hill holds. The lord rides with Highgarden. I hold the hill. Speak.', 'The dead come up from the Red Mountains in files. Like an army. They were one.', 'Marcher castles were built for Dornish raids. They will do.'],
    ['We hunt the hills. Now the hills hunt back.', "The lord's son reads too much. He went to the Wall. Books may be useful there."]);
  N('yw_lord', 'Lord Anders Yronwood', 'steward', 'yronwood', null, 'npc:steward',
    ['Yronwood holds the Boneway. We always have. Speak.', 'The dead come down the pass from the north. Nothing comes down the pass from the north.', 'Bloodroyal, they call us. Lately it is just blood.'],
    ['The Boneway is a pass of bones. The bones are walking.', 'Sunspear sends riders. I send them back with the same news.']);
  N('cs_woman', 'Elra, a woman of the hall', 'elder', 'crasters', null, 'npc:smuggler',
    ['The hall belonged to a man who gave his sons to the cold. The sons came back.', 'We ran when the sons came. I came back for the others. There were no others.', 'Burn it. Somebody should have, years ago.'],
    ['Twenty-five of them hold the hall. White. Cold. His.', 'Free folk have no lords. We had him. It was worse.']);
  N('hd_elder', 'Wyn, a free folk elder', 'elder', 'hardhome', null, 'npc:steward',
    ['Thousands here. The sea behind, the dead in front. You have boats?', 'Crows with boats. I have lived long enough to see that.', 'Walk in front. You have the glass.'],
    ['The ones who stay will be walking by morning.', 'Hardhome was cursed before. We came anyway. There was nowhere else.']);
  N('ft_ranger', 'Ranger Doss', 'ranger', 'fist', null, 'npc:ranger',
    ['The Fist. Three hundred rangers died here. I was late. That is why I am alive.', 'The cache is under the cairn at the north edge. Dead men walk over it.', 'It comes south. A column of cold down from the Frostfangs. Look.'],
    ['Every dead thing we ever fought answers to it.', 'If it reaches the Wall there is no Wall.']);

  /* ---------------- quests ---------------- */
  const XP = L => 80 + 45 * L + 6 * L * L; /* the ARCH curve; ~1.5 levels' worth per main quest, 0.8 per side quest */
  const QUESTS = [];
  const mk = (id, title, lvl, type, poi, giver, target, n, offer, progress, done, x) => { const q = { id, title, main: false, prev: null, lvl, type, poi, giver, target, n: n || 1,
    text: { offer, progress, done }, reward: { xp: Math.round(XP(lvl) * 1.5), gold: Math.round(14 * lvl + 0.9 * lvl * lvl) } }; if (x) { for (const k in x) if (k !== 'reward') q[k] = x[k]; if (x.reward) Object.assign(q.reward, x.reward); } QUESTS.push(q); return q; };
  let lastMain = null;
  const M = (...a) => { const q = mk(...a); q.main = true; q.prev = lastMain; lastMain = q.id; return q; };
  const S = (...a) => { const q = mk(...a); q.reward.xp = Math.round(XP(q.lvl) * 0.8); q.reward.gold = Math.round(q.reward.gold * 0.7); return q; };

  /* the main chain: the seat → the capital → the Riverlands → the Neck → the North → the Wall → beyond */
  M('m01', 'Dead at the gate', 1, 'kill', 'seat', 'seat:steward', 'axe', 6,
    ['The dead are at the gate again. Axemen, mostly. Farmers once, by their hands.', 'Six of them stand between the wall and the road. Put them back down.', 'Do not let them get behind you. They are slow, and they are many.'],
    'Wights put down at the gate', 'Six down. They will be back by morning, but the road is open for now. Here. Earned.');
  M('m02', "The maester's word", 2, 'talk', 'seat', 'seat:steward', 'seat:maester', 1,
    ['The maester has been up in his tower three nights with his books and his candles.', 'He says he knows what kills these things for good. Go and hear him out.', 'Mind, he talks. Let him. Then come back with something I can use.'],
    'Hear the maester out', 'So he told you. Black glass. I have heard stranger things, and none of them from a maester.');
  M('m03', 'Black glass', 3, 'collect', 'seat', 'seat:maester', 'dragonglass', 5,
    ["Dragonglass. Obsidian, if you want the Citadel's word. The old songs say it kills them for good.", 'The dead keep {hero} in the vault below the walls. The shards are there too, in their flesh.', 'Bring me five shards. Bring {hero} out alive. If the songs are right, your house needs both.'],
    'Dragonglass shards gathered from the vault', 'Five shards; a knife by dusk. And {hero} walks free and will ride for {house}.',
    { from: 'crypt', rescue: true, hero: 'house:0', reward: { hero: 'house:0' } });
  M('m04', 'Hounds of the night', 4, 'kill', 'seat', 'seat:arms', 'hound', 8,
    ['The kennels emptied themselves two nights ago. The hounds are dead and still hungry.', 'Eight of them run the fields in a pack. They go for the legs. Keep yours under you.', 'Hit the first one hard. The rest come in low behind it.'],
    'Dead hounds put down', 'Eight. Good. A pack that size could have pulled down a horse. Now I can spare a blade for the road.',
    { reward: { gems: 10 } });
  M('m05', 'The kingsroad', 6, 'reach', 'kingslanding', 'seat:steward', 'kingslanding', 1,
    ['Ravens come back from the capital with nothing on them. That is a message of its own.', "Ride to King's Landing. Find the Hand, tell him what walks here, and hear what walks there.", 'Stay on the road. The dead keep to the fields, mostly. Mostly.'],
    "Reach King's Landing", 'The city gates. They still open, which is more than some gates do now.');
  M('m06', "The Hand's errand", 8, 'talk', 'kingslanding', 'kl_captain', 'kl_hand', 1,
    ['You want the Hand. Half the city wants the Hand. The other half wants him gone.', 'He is in the Tower. Tell the door you came from the gate and I sent you.', 'And wipe your boots. He notices.'],
    "Speak with the King's Hand", 'You found him, then. He has a way of making work for people who find him.');
  M('m07', 'Turned cloaks', 9, 'kill', 'kingslanding', 'kl_hand', 'sword', 12,
    ['Gold cloaks died holding the River Gate. They are back in the same cloaks, holding it for the other side.', 'Twelve of them. Swordsmen, slow and heavy. They take two hits where a farmer takes one.', 'The city cannot see dead guards on its walls. Clear them.'],
    'Turned gold cloaks put down', 'The River Gate is ours again. The city will not thank you. The city does not know. I do.');
  M('m08', 'Crown of rot', 11, 'boss', 'duskendale', 'kl_hand', 'kingwight', 1,
    ["Something crawled out of a king's crypt and walked to Duskendale. It wears a crown.", 'The dead gather to it, and it keeps a court. {hero} of your house is in that court, in chains.', 'End the king. The chains open with him. Not a thing for one blade, but one blade is what we have.'],
    'Put down the Crowned Corpse at Duskendale', 'The crown came off; the rest followed. {hero} rides for {house} now. The rot comes from the north.',
    { rescue: true, hero: 'house:1', reward: { hero: 'house:1', gems: 15 } });
  M('m09', 'Ravens north', 13, 'reach', 'riverrun', 'kl_hand', 'riverrun', 1,
    ['Riverrun answers no ravens. The Riverlands are the road to the North, and the road is dark.', "Go to Riverrun. If the Tullys' castellan lives, he will know where the dead cross the rivers.", 'If he does not live, you will know soon enough.'],
    'Reach Riverrun', 'Riverrun stands. Its gates are shut and its river is full. But it stands.');
  M('m10', 'The Tumblestone runs red', 15, 'kill', 'riverrun', 'rr_lord', 'archer', 15,
    ['Dead bowmen line the far bank of the Tumblestone. They shoot anything that comes to the water.', 'Fifteen that I have counted. They do not miss much. Close with them; they are nothing up close.', 'Our wells are low. We need that river.'],
    'Dead archers cleared from the riverbank', 'The bank is quiet. The women are already at the water. You bought us that. Here.');
  M('m11', "Harren's shadow", 17, 'collect', 'harrenhal', 'rr_maester', 'coldbone', 6,
    ['Harrenhal is a ruin, and ruins remember. Something cold has nested in the burned towers.', 'Its servants carry bone that frost will not leave. Bring me six pieces; I need to know what it is.', 'Do not sleep inside the walls. No one who ever has woke up.'],
    'Frost-bone gathered at Harrenhal', "Cold to the touch after a day by my fire. This is not a dead man's bone. This is something older.",
    { from: 'walker' });
  M('m12', 'Toll of the Twins', 19, 'escort', 'twins', 'rr_lord', 'rr_carter', 1,
    ['The Twins hold the only bridge over the Green Fork. The Freys will not open it for nothing.', 'A wagon of grain goes north as our toll. Walk beside it. The dead like wagons.', 'If the wagon arrives, the bridge opens. If not, the North is cut off.'],
    'Bring the grain wagon to the Twins', 'The grain is in. The Freys counted every sack. The bridge is open for as long as that lasts.',
    { to: 'twins', reward: { gems: 20 } });
  M('m13', 'The Neck', 21, 'boss', 'moatcailin', 'tw_lord', 'neckwalker', 1,
    ['Past the bridge is the Neck, and in the Neck is Moat Cailin. Nothing comes through it alive now.', 'A Walker holds the ruin. Not a wight; a Walker. It raised every soldier who ever died there.', 'Kill it and the causeway opens. Fail, and the Freys are the last living men on this river.'],
    'Put down the Walker of the Neck at Moat Cailin', 'The causeway is clear. The Freys say they always believed in your house. They say that to the winner.');
  M('m14', 'White Harbor', 24, 'reach', 'whiteharbor', 'tw_lord', 'whiteharbor', 1,
    ['White Harbor has ships, walls and a lord who feeds his people. That makes it a target.', 'Go north along the coast. If the port holds, the North can still be supplied by sea.', 'Lord Manderly holds {hero} of your house as a deserter. Reach the gate; your word frees them.'],
    'Reach White Harbor', 'White Harbor. The gate opened. {hero} is freed on your word and rides for {house}.',
    { rescue: true, hero: 'house:2', reward: { hero: 'house:2' } });
  M('m15', "The wolves' den", 27, 'talk', 'winterfell', 'wh_lord', 'wf_lord', 1,
    ['Winterfell has gone quiet. No ravens, no riders, no smoke seen from the road.', "Ride to the wolves' den. If Lord Stark holds, the North holds. If not, I need to know today.", 'Take the kingsroad. Everything else is snow now.'],
    'Speak with the lord of Winterfell', 'Winterfell holds. Barely, by the look of the walls. But its lord is alive and he has a plan.');
  M('m16', 'Dread in the fort', 30, 'kill', 'dreadfort', 'wf_arms', 'walker', 20,
    ['The Dreadfort went dark first. Now Walkers come out of it in twenties, like a garrison.', 'Twenty of them. White things with ice for swords. A glass edge is the only thing they fear.', 'Break the garrison. Then we can look north instead of over our shoulders.'],
    'Walkers put down at the Dreadfort', 'Twenty. The Dreadfort is a tomb again, which is what it always should have been.',
    { reward: { gems: 25 } });
  M('m17', 'Last Hearth burning', 33, 'collect', 'lasthearth', 'wf_maester', 'emberstone', 8,
    ['Last Hearth burns, and the Umbers say the dead giants carry the fire with them.', 'Hearth-stones, warm from the hall, lodged in their flesh. Bring me eight. Fire that walks is new.', 'The Umbers will help, if any are left to help.'],
    'Hearth-stones taken from the dead giants', 'Still warm. Fire the cold cannot put out. If I can learn why, we have a weapon.',
    { from: 'giant' });
  M('m18', 'The giant of the Gift', 36, 'boss', 'lasthearth', 'lh_lord', 'giantwight', 1,
    ['There is a giant in the Gift. Dead, twice the size of the rest, with a weirwood for a club.', 'It flattened my gate with one swing. My gate was oak and iron.', 'Kill it, or I bury what is left of my house under what is left of my hall.'],
    'Put down the Giant of the Gift', 'It fell toward us. We all ran. Then we all laughed. I have not heard that sound in a year.');
  M('m19', 'Black brothers', 39, 'reach', 'castleblack', 'lh_lord', 'castleblack', 1,
    ['The Watch sends for every sword in the North. They have sent before. Now they mean it.', 'Ride to Castle Black. Whatever is behind the dead is behind the Wall.', 'Dress warm. That is not a joke.'],
    'Reach Castle Black', 'Castle Black. Seven hundred feet of ice behind it and a handful of men in front.');
  M('m20', 'Beyond the gate', 42, 'talk', 'castleblack', 'cb_lc', 'cb_turncloak', 1,
    ['We have a wildling in the ice cells who says she has seen where the cold comes from.', '{hero} of your house is in the next cell, taken on the road for a wight. I trust neither.', 'Hear her. Then tell me if I should hang them or feed them.'],
    'Hear the wildling turncloak', 'Feed them, then. She knows the ground. Both walk free, and {hero} rides for {house}.',
    { rescue: true, hero: 'house:3', reward: { hero: 'house:3', gems: 30 } });
  M('m21', "Craster's cold hall", 45, 'kill', 'crasters', 'cb_turncloak', 'walker', 25,
    ['There is a hall in the Haunted Forest where a man gave his sons to the cold for years.', 'The sons came back. Twenty-five Walkers hold the hall now. It is their door south.', 'Shut it. I will show the path. I will not go inside.'],
    'Walkers put down at the cold hall', 'The hall is empty. Burn it. I should have asked someone to burn it years ago.');
  M('m22', 'The Fist', 48, 'collect', 'fist', 'cb_ranger', 'frostglass', 10,
    ['The rangers died on the Fist of the First Men. They had a cache of dragonglass with them.', 'Ten blades, wrapped in oilcloth, under the cairn at the north edge. The dead walk over it.', 'Bring them back. Ten men might live for each blade.'],
    'Dragonglass blades recovered from the Fist', 'Ten blades. Ten brothers who died carrying them. Hand them out. Then go to the Lord Commander.',
    { from: 'any' });
  M('m23', 'Hardhome ash', 50, 'escort', 'hardhome', 'cb_turncloak', 'hd_elder', 1,
    ['The free folk are at Hardhome. Thousands, with the sea at their backs and the dead in front.', 'The Watch has sent boats. Someone has to walk the elders from the village to the shore.', 'Whoever carries the glass walks in front.'],
    'Walk the free folk to the boats at Hardhome', 'The boats are full. The ones who stayed will be walking by morning. Who could be saved, was.',
    { to: 'hardhome' });
  M('m24', 'The long night ends', 52, 'boss', 'fist', 'cb_lc', 'palelord', 1,
    ['It is coming south. The rangers see a column of cold walking down from the Frostfangs.', 'Every dead thing we ever fought answers to it. The brothers call it the Pale Lord.', 'Meet it at the Fist. If it reaches the Wall, there is no Wall. Hold the door.'],
    'Put down the Pale Lord at the Fist', 'It broke like ice in spring. The dead fell where they stood, from here to Dorne. The door held.',
    { reward: { gems: 40 } });

  /* side quests: three per hub */
  S('s_wf1', 'Crypt watch', 2, 'kill', 'winterfell', 'wf_crypt', 'crypt', 5,
    ['The old kings are getting up. I keep the crypts, I do not keep the kings in them.', 'Five have climbed the stair so far. Put them back on their shelves.'],
    'Crypt wights returned to the dark', 'Five back where they belong. I have put stones over them. Stones have not worked before.');
  S('s_wf2', 'Wolf country', 3, 'kill', 'winterfell', 'wf_hunter', 'wolf', 6,
    ['Direwolves, dead ones, in the wolfswood. They hunt in threes now, same as before.', 'Six of them have my trapline. I want it back.'],
    'Dead direwolves put down', 'Six. The wood is quiet. Quiet is not the same as safe, but I will take it.');
  S('s_wf3', "The smith's iron", 5, 'collect', 'winterfell', 'wf_smith', 'graveiron', 6,
    ['Every dead man comes wearing iron I could use, if someone pried it off him.', 'Six pieces of old iron. I will make it new.'],
    'Grave-iron brought to the forge', 'Good iron under the rust. Northern iron. The next blade off this anvil is sharper for it.', { from: 'any' });
  S('s_cr1', 'The lower shafts', 2, 'kill', 'casterly', 'cr_miner', 'crawler', 6,
    ['The dead come up the old shaft on their bellies. Crawlers, the men call them. Six at least.', 'Clear the shaft so I can seal it. I cannot seal it with them in it.'],
    'Crawlers cleared from the shaft', 'Sealed. Gold stays down there with them. The lord will not like that. The lord can go down himself.');
  S('s_cr2', 'The Lannisport road', 3, 'reach', 'lannisport', 'cr_septon', 'lannisport', 1,
    ['The sept at Lannisport has not sent word in a week. I need to know if the Seven still have a roof.', 'Walk the road down to the city and look.'],
    'Reach Lannisport', 'A roof and a congregation, you say. Good. Half the prayers in the west are said under it.');
  S('s_cr3', 'Debts collected', 5, 'collect', 'casterly', 'cr_inn', 'goldtooth', 5,
    ['The dead swordsmen on the road were sellswords, paid in gold. The gold is still on them.', 'Five pieces. I am owed. Dead men drink for free otherwise.'],
    'Gold taken back from the dead sellswords', 'Five. The ledger is square. The first cup is on the dead.', { from: 'sword' });
  S('s_se1', 'The cliff stair', 2, 'kill', 'stormsend', 'se_arms', 'shield', 5,
    ['Drowned men come up the cliff path in mail and shields. Arrows bounce. Get in close.', 'Five of them are on the stair now. I need that stair.'],
    'Drowned shieldmen cleared from the stair', 'The stair is clear. Salt and rot still on it, but nothing standing.');
  S('s_se2', 'Salt fish', 3, 'collect', 'stormsend', 'se_inn', 'saltfish', 6,
    ['The fishermen will not go out. The fish they do bring in have teeth marks I do not like.', 'Six that look fit to eat, from the drowned on the shore. I am not proud.'],
    'Fish taken from the drowned', 'Six. The stew will not kill anyone. That is the best I can promise this year.', { from: 'any' });
  S('s_se3', 'The old septon', 5, 'talk', 'stormsend', 'se_fisher', 'se_septon', 1,
    ['The septon has not come down from the sept for three days. He is old. See if he is still praying.', 'Or still anything.'],
    'Look in on the septon', 'Alive and arguing with the Seven. Good. Someone should.');
  S('s_ds1', 'The shingle', 2, 'kill', 'dragonstone', 'ds_arms', 'axe', 6,
    ['Fishermen the sea took are coming back up the shingle with their axes. Six on the beach now.', 'Put them down before the tide brings cousins.'],
    'Drowned axemen cleared from the shingle', "Six. The tide will bring more. That is tomorrow's work.");
  S('s_ds2', 'Glass for the smith', 3, 'collect', 'dragonstone', 'ds_smith', 'dragonglass', 6,
    ['This island is made of dragonglass and I am the only man grinding it. Bring me shards.', 'Six. Pulled from the dead, chipped from the rocks, I do not care.'],
    'Dragonglass brought to the forge', 'Six. I will have edges for the whole watch by morning. Take this one.', { from: 'any' });
  S('s_ds3', "The smuggler's cove", 5, 'talk', 'dragonstone', 'ds_harbour', 'ds_smuggler', 1,
    ['A smuggler keeps a boat in the cove under the cliff. He knows the sea roads better than my pilots.', 'Find him and ask what he has seen. He will lie, but he lies in a useful direction.'],
    'Find the smuggler in the cove', 'He said the sea is empty of ships and full of walkers. For once I believe him.');
  S('s_pk1', 'The bridge chains', 2, 'kill', 'pyke', 'pk_arms', 'axe', 6,
    ['Drowned reavers climb the bridge chains at night. Six on the second bridge now.', 'Put them back in the sea. The sea can keep them this time.'],
    'Drowned reavers cleared from the bridge', 'Six. The chains are iron and slick. Nobody fell. That is the Iron Islands for you.');
  S('s_pk2', 'Salt and iron', 3, 'collect', 'pyke', 'pk_smith', 'seairon', 6,
    ['The dead come out of the water wearing iron the sea has not finished eating.', 'Six pieces. I will beat the salt out of them.'],
    'Sea-iron brought to the forge', 'Six. Iron from the sea pays for itself. Here.', { from: 'any' });
  S('s_pk3', 'The drowned priest', 5, 'talk', 'pyke', 'pk_inn', 'pk_priest', 1,
    ['The drowned priest preaches on the rocks below the castle. People are starting to listen.', 'Go and hear what he says. If it is about the dead rising, we may have a problem.'],
    'Hear the drowned priest', 'He says the sea is angry. The sea is always angry. But he is not wrong about the dead.');
  S('s_hg1', 'The river stair', 2, 'kill', 'highgarden', 'hg_arms', 'sword', 5,
    ['Bloated swordsmen come up the river stair off the Mander. Slow and heavy. Five on the stair now.', 'Clear them before the water brings the next flood.'],
    'Drowned swordsmen cleared from the stair', 'Five. The stair is slick with what they left. The gardeners will see to it.');
  S('s_hg2', 'Herbs by the river', 3, 'collect', 'highgarden', 'hg_gardener', 'riverherb', 6,
    ['The gardens are a yard of spears now, but the herbs still grow by the river where the dead walk.', 'Six bundles. The maester needs them for the wounded.'],
    'Herbs gathered by the river', 'Six. The maester will have his poultices. The roses will have to wait a year.', { from: 'any' });
  S('s_hg3', "The septa's bell", 5, 'talk', 'highgarden', 'hg_inn', 'hg_septon', 1,
    ['The septa rings the bell at dusk so the field hands come in. She did not ring it last night.', 'Go and see why. I will keep the stew hot.'],
    'Find the septa', 'She lost the rope to a dead hand through the window. She is fine. The bell rings tonight.');
  S('s_ss1', 'Old bones', 2, 'kill', 'sunspear', 'ss_arms', 'crypt', 5,
    ['Bones from the old wars come out of the sand in armour older than the gate. Five on the road.', 'Break them. Then break the pieces.'],
    'Old bones broken on the road', 'Five. Sand covers them again. It will not hold them, but it covers them.');
  S('s_ss2', 'Water rights', 3, 'collect', 'sunspear', 'ss_inn', 'waterskin', 6,
    ['The dead carry waterskins they will never drink from. In Dorne that is a crime against the living.', 'Six skins. The Shadow City is thirsty.'],
    'Waterskins taken from the dead', 'Six. A whole street drinks tonight. In Dorne that is as good as a song.', { from: 'any' });
  S('s_ss3', 'The sand rider', 5, 'talk', 'sunspear', 'ss_lord', 'ss_rider', 1,
    ['A sand rider came in from the Broken Arm with a story about dead walking out of the dunes.', 'Hear it. Riders see what walls do not.'],
    'Hear the sand rider', 'Out of the dunes in a line, he says, all facing north. They are not coming for us. They are going.');
  S('s_kl1', 'Flea Bottom', 7, 'kill', 'kingslanding', 'kl_inn', 'crawler', 8,
    ['Things crawl out of the gutters in Flea Bottom at night. Eight is the count from my doorstep.', 'Flea Bottom never asked the crown for anything. It is asking you.'],
    'Crawlers cleared from Flea Bottom', 'Eight. The street slept last night. Nobody will remember who did it. I will.');
  S('s_kl2', 'Seven stars', 9, 'collect', 'kingslanding', 'kl_septon', 'sevenstar', 8,
    ['The dead gold cloaks wear the seven-pointed star on their cloaks. It should not be on them.', 'Bring me eight stars. I will bless them and give them to men who can still kneel.'],
    'Seven-pointed stars taken from the dead', 'Eight stars. Eight living men wear them tonight. Thank the Seven. Or thank yourself.', { from: 'sword' });
  S('s_kl3', "The smuggler's crates", 11, 'reach', 'duskendale', 'kl_smuggler', 'duskendale', 1,
    ['I have crates on the Duskendale road that I would rather the crown did not find. Or the dead.', 'Go and see if they are still there. Do not open them.'],
    'Check the crates on the Duskendale road', 'Still there, you say, and unopened. Honest or a fool. Here, either way.');
  S('s_rr1', 'The ferry', 13, 'kill', 'riverrun', 'rr_ferry', 'rider', 8,
    ['Dead riders run the far bank and charge anyone on the ferry. Eight horses that should be meat by now.', 'Clear them so I can cross without a lance in my ribs.'],
    'Dead riders cleared from the far bank', 'Eight. I crossed this morning. Nothing charged. I had forgotten what that was like.');
  S('s_rr2', 'Ice in summer', 15, 'collect', 'riverrun', 'rr_maester', 'icecore', 8,
    ['Wraiths drift over the Tumblestone at night. They leave cores of ice that do not melt by day.', 'Bring me eight. The Citadel will not believe a letter. They will believe ice in high summer.'],
    'Ice cores taken from the wraiths', 'Eight, still frozen in my hand. The Citadel will believe this. Or they will not, and I stop writing.', { from: 'wraith' });
  S('s_rr3', "Hetty's bread", 17, 'talk', 'riverrun', 'rr_inn', 'rr_smith', 1,
    ['Tomard the smith has not eaten in two days. He works, he does not eat. Take him this bread.', 'And tell him Hetty says to stop.'],
    'Take bread to the smith', 'He ate? Good. Men are easier to keep alive than dead men are to keep dead.');
  S('s_ey1', 'The sky cells', 20, 'kill', 'eyrie', 'ey_gaoler', 'wraith', 8,
    ['The sky cells are empty of prisoners and full of wraiths. They come in with the wind.', 'Eight. I am paid to keep the cells. Not to die in them.'],
    'Wraiths cleared from the sky cells', 'Eight. The cells are empty again. First time I have been glad of that.');
  S('s_ey2', "Falcon's return", 23, 'collect', 'eyrie', 'ey_falconer', 'icefeather', 8,
    ['Ice eagles took the mews. My birds are dead and flying. I want their feathers back.', 'Eight. I will bury what I can.'],
    'Feathers taken from the ice eagles', 'Eight feathers. I buried them with the hoods. Foolish. Necessary.', { from: 'eagle' });
  S('s_ey3', 'The mountain road', 26, 'reach', 'gulltown', 'ey_lord', 'gulltown', 1,
    ['Gulltown is our port and our purse. The road down the mountain has been silent for ten days.', 'Walk it. Tell me what still stands at the bottom.'],
    'Reach Gulltown', 'Gulltown stands and the ships still come. The Vale is not an island yet.');
  S('s_ot1', 'The lower stacks', 6, 'kill', 'oldtown', 'ot_novice', 'bat', 10,
    ["Bats have taken the Citadel's lower stacks. Not ordinary bats. They bite and the bite goes grey.", 'Ten of them. The archmaesters will not go down. Novices are cheaper.'],
    'Cave bats cleared from the stacks', 'Ten. The stacks are quiet. The archmaester says I should have done it myself. He said it from upstairs.');
  S('s_ot2', 'Lamp oil', 8, 'collect', 'oldtown', 'ot_harbour', 'lampoil', 8,
    ['The Hightower lamp guides every ship that still sails. The dead on the quay carry oil flasks, somehow.', 'Eight flasks. The lamp does not care where the oil came from.'],
    'Oil flasks taken from the dead on the quay', 'Eight. The lamp burns another week. Ships will come. Some of them.', { from: 'any' });
  S('s_ot3', "The archmaester's question", 10, 'talk', 'oldtown', 'ot_lord', 'ot_archmaester', 1,
    ['The archmaester wants to see someone who has killed one of the dead with their own hands.', 'He wants to ask questions. Indulge him. The Citadel pays its debts in knowledge.'],
    'Answer the archmaester', 'He asked forty questions and wrote down three answers. That is the Citadel. Here is their thanks.');
  S('s_cb1', 'The tunnel', 38, 'kill', 'castleblack', 'cb_arms', 'thenn', 10,
    ['Dead Thenns are in the tunnel under the Wall. Bronze armour, bronze axes. Ten of them.', 'If they open the gate from inside, we are done. Go in and make sure they do not.'],
    'Dead Thenns cleared from the tunnel', 'Ten. The tunnel is ours. The gate is shut. For tonight, that is a victory.');
  S('s_cb2', "Brothers' blades", 41, 'collect', 'castleblack', 'cb_smith', 'blackblade', 10,
    ['Every brother who died out there took a good blade with him. The dead do not clean steel.', 'Ten blades. I will reforge them for the men still breathing.'],
    "Brothers' blades recovered", 'Ten. I will put ten names on the forge wall. It is getting to be a long wall.', { from: 'any' });
  S('s_cb3', "The cook's pot", 44, 'collect', 'castleblack', 'cb_cook', 'boarmeat', 8,
    ['The brothers eat what I cook. I cook what we have. We have nothing.', 'There are dead boars in the Haunted Forest. The meat on them is frozen, not rotten. Eight haunches.'],
    'Frozen boar brought to the kitchens', 'Eight. The stew tonight is boar. Nobody asks where. Good.', { from: 'boar' });

  /* fill npc.quests from the givers; 'seat:<role>' goes to that role at every seat */
  const byId = {}; for (const n of NPCS) byId[n.id] = n;
  for (const q of QUESTS) {
    if (q.giver.indexOf('seat:') === 0) { const role = q.giver.slice(5); for (const n of NPCS) if (n.role === role && Object.values(SEATS).indexOf(n.poi) >= 0) n.quests.push(q.id); }
    else if (byId[q.giver]) byId[q.giver].quests.push(q.id);
  }

  /* ---------------- story ---------------- */
  const prologue = {
    stark: ['Snow on the glass gardens in high summer. The old men at Winterfell say that is the first sign.', 'Then the crypt doors would not stay shut. The dead of the North walk, and they walk south.',
      'Lord Stark keeps his seat. Every banner he has is on the walls, and still the walls are thin.', '{hero} rides for Winterfell. Not a lord today, not a legend. A blade with a name attached.', 'The lord has work for anyone who can hold a sword and keep their feet. Go to the gate.'],
    lannister: ['Gold pays for walls, and the Rock has more walls than any seat in Westeros. It was not enough.', 'The dead came up the mine shafts first. Miners who had been buried, and some who had not.',
      'Ser Kevan holds the Rock for the lord. He has paid for every sword that still answers.', '{hero} rides for Casterly Rock. Sworn to the lion, fed by the lion, and owed to it.', 'The castellan wants the mines cleared and the roads open. Start with whatever is nearest.'],
    baratheon: ["Storm's End has never fallen. The old men say it as a boast. The young ones say it as a prayer.", 'What the sea gives back now does not stay dead. Drowned men walk up the cliff path at dusk.',
      'The castellan has sealed the lower gate and set every sword on the walls above it.', "{hero} rides for Storm's End. Fury is the house word; patience is what the castellan wants.", 'Report to the gate. There is a smell of salt and rot coming up the stair, and it is getting closer.'],
    targaryen: ['Dragonstone is black glass and black smoke, and now something colder has come to it.', 'The dead rose on the beaches first. Fishermen lost to the sea, walking back up the shingle.',
      'The prince holds the island by the old blood and a thin garrison that grows thinner.', '{hero} rides for Dragonstone. The banner is red, the castle is black, the dead are grey.', 'Someone has to hold the gate road until the ships come. The castellan decided who.'],
    greyjoy: ['Pyke stands on its rocks because nothing else will. The sea has been trying to take it for ages.', 'Now the sea sends back what it took. Drowned reavers crawl up the bridge chains at night.',
      'The lord keeps his hall. The Reader keeps the accounts, which are mostly of the dead.', '{hero} rides for Pyke. The blade was paid for with iron, as the saying goes.', 'The bridges need clearing before the next tide brings more. Go to the gate and start.'],
    tyrell: ['Highgarden was roses and running water. The roses are still there. So is the water, red.', 'The dead came up the Mander on the current, bloated, and climbed the river stairs.',
      'Ser Garlan holds the castle for his father. He has turned the gardens into a yard of spears.', '{hero} rides for Highgarden. The rose has thorns, the sworn swords say, and this is one.', 'The river gate is where it is worst. The castellan wants a blade there before the dark.'],
    martell: ['Sunspear bakes in the sun as it always has. The dead do not mind the heat. That is new.', 'They came out of the sand first, old bones from older wars, walking toward the Shadow City.',
      'The prince keeps his seat behind the Threefold Gate. His captains keep the walls.', '{hero} rides for Sunspear. Unbowed is the word. Unburied is the problem.', 'The captain wants the roads to the gates cleared. Dead bones break like any others. Go.'] };
  const regions = { dorne: 'Dorne. Sand, sun and old bones that have forgotten to stay buried.', reach: 'The Reach. The richest fields in Westeros, and now the best fed graves.',
    stormlands: 'The Stormlands. The sea breaks on the cliffs and gives back its drowned.', westerlands: 'The Westerlands. Gold under the hills, and something cold walking the mine roads.',
    ironislands: 'The Iron Islands. Wet rock, grey sea, and reavers who did not stay down.', crownlands: 'The Crownlands. Every road leads to the capital. So do the dead.',
    riverlands: 'The Riverlands. Three rivers, a hundred fords, and the dead crossing every one.', vale: 'The Vale. Mountains the dead climb slowly and the living cannot climb fast enough.',
    north: 'The North. The snow does not melt here now, and the cold has learned to walk.', wall: 'The Wall. Seven hundred feet of ice, and the one thing it was built for is coming.',
    beyond: 'Beyond the Wall. No lords, no laws, and the cold is a thing with a will of its own.', alwayswinter: 'The Lands of Always Winter. Where the cold comes from. Nothing here was ever alive.' };
  const boss = { sandwight: 'The Spear of the Sands. A Dornish lord buried with his spear. He kept the spear.', rotknight: 'The Rotting Knight. He drowned in the Mander in full plate. The plate held.',
    stormwight: 'The Drowned Captain. Shipbreaker Bay took his ship. He came back for the castle.', goldwight: 'The Gilded Dead. A lord buried in gold armour in the deep mines. The gold did not rust.',
    drownedking: 'The Drowned Reaver. He went under with his longship and brought the crew back with him.', kingwight: 'The Crowned Corpse. A king from the crypts below the sept, still wearing his crown.',
    neckwalker: "The Walker of the Neck. It raised Moat Cailin's dead and holds the only road north.", skywight: 'The Hollow Falcon. A knight of the Vale who fell from the Eyrie and stood back up.',
    giantwight: 'The Giant of the Gift. It walked out of the snow with a tree for a club.', palelord: 'The Pale Lord. The cold that walks. It waited eight thousand years. It is not patient.' };
  /* the Hall of the Fallen: {name} {lvl} {killer} are filled by the death screen */
  const epitaphs = ['{name}, level {lvl}. Fell to {killer}. The ground was cold. It got colder.', '{name} held for {lvl} levels. {killer} held longer. The snow keeps the rest.',
    'Here lies {name}. A blade sworn to the house, broken at level {lvl} by {killer}.', '{name} went down facing {killer}. Level {lvl}. The dead would have welcomed them. The house did not let them.',
    '{name}. Level {lvl}. {killer} finished what the cold started. The name stays on the wall.'];
  const nextHero = ['The house does not end with one blade. Another takes the oath.', 'The dead have one name less to fear. The house has one more to send.',
    'A new sword, the same door. Hold it.', 'The fallen are counted. The living ride. Choose who rides next.', 'What was learned on the road is not lost; it is on the wall. The next hero reads it and rides.'];
  const levelup = ['A little harder to kill. The dead will have to try a little harder.', 'The master-at-arms would nod. He would not say anything. That is the nod.',
    'Another level. Another scar nobody will remember getting.', 'Stronger. Not strong enough. There is no such thing, this far north.', 'Something was learned out there. Mostly where not to stand.'];
  const titles = [{ id: 'sworn', title: 'the Sworn', line: 'The oath is taken. The gate is yours to hold.' }, { id: 'gateholder', title: 'Gate-Holder', line: 'The first six went down. The road is open for now.' },
    { id: 'glasscarrier', title: 'Glass-Carrier', line: 'A knife of frozen fire. The dead have reason to fear.' }, { id: 'houndbreaker', title: 'Hound-Breaker', line: 'A pack that could pull down a horse. It did not.' },
    { id: 'roadwalker', title: 'Road-Walker', line: "King's Landing reached. Every road led here. So did the dead." }, { id: 'fordkeeper', title: 'Ford-Keeper', line: 'The Tumblestone runs clear. The women are at the water.' },
    { id: 'neckbreaker', title: 'Neck-Breaker', line: 'The causeway is open. The Walker of the Neck is not.' }, { id: 'wolffriend', title: 'Wolf-Friend', line: 'Winterfell holds, and its lord knows the name.' },
    { id: 'blackbrother', title: 'Black Brother', line: 'Castle Black reached. Seven hundred feet of ice behind, a handful of men in front.' }, { id: 'doorholder', title: 'Door-Holder', line: 'The Pale Lord broke like ice in spring. The door held.' }];

  /* ---------------- dialogs ---------------- */
  const dialogs = {};
  const qc = n => n.quests.map(id => ({ t: QUESTS.find(q => q.id === id).title, quest: id }));
  const LEAVE = { t: 'Leave', close: true };
  /* hand-written trees; node 0 opens, the quest choices are appended to node 0 */
  const SP = {
    wf_lord: [{ text: 'Winterfell has stood for eight thousand years. I intend it to stand one more winter.', choices: [{ t: 'The North?', next: 1 }] },
      { text: 'Cold, large and honest. Right now it is also dead in places. Keep to the roads.', choices: [{ t: 'The dead?', next: 2 }, { t: 'Back', next: 0 }] },
      { text: 'They come from the Wall. Everything bad does. The maester says black glass stops them. I say try it.', choices: [{ t: 'Back', next: 0 }] }],
    cr_lord: [{ text: 'The Rock has gold enough to pay every sword in the west. Swords are what we lack.', choices: [{ t: 'The mines?', next: 1 }] },
      { text: 'Sealed where we could. The dead know the old shafts better than the maps. Clear what you can.', choices: [{ t: 'Back', next: 0 }] }],
    se_lord: [{ text: "Storm's End has never fallen. I would rather it did not start on my watch.", choices: [{ t: 'The sea?', next: 1 }] },
      { text: 'It gives back what it took. Drowned men on the stair every dusk. The stair is three men wide. Hold it.', choices: [{ t: 'Back', next: 0 }] }],
    ds_lord: [{ text: 'Dragonstone has held through worse. I cannot remember when, but the maester says so.', choices: [{ t: 'The glass?', next: 1 }] },
      { text: 'This island is made of it. Ulf grinds it. Nobody else in the realm has as much. Use it.', choices: [{ t: 'Back', next: 0 }] }],
    pk_lord: [{ text: 'Pyke has stood on these rocks since before the Andals. The dead can wait their turn.', choices: [{ t: 'The books?', next: 1 }] },
      { text: 'Say the dead walked once before and that it ended. They do not say how. I am reading faster.', choices: [{ t: 'Back', next: 0 }] }],
    hg_lord: [{ text: 'Highgarden was never built for war. Everything is a fortress now.', choices: [{ t: 'The river?', next: 1 }] },
      { text: 'The Mander brings them up bloated and slow. The river stair is where we lose people. Hold it.', choices: [{ t: 'Back', next: 0 }] }],
    ss_lord: [{ text: 'Sunspear has outlasted dragons. It will outlast a few walking bones.', choices: [{ t: 'The riders?', next: 1 }] },
      { text: 'They say the dead face north, all of them, as if called. Whatever calls them is not in Dorne.', choices: [{ t: 'Back', next: 0 }] }],
    kl_hand: [{ text: 'The Hand of the King. The king hunts. I govern. Today governing means burying the same men twice.', choices: [{ t: 'The city?', next: 1 }] },
      { text: 'Half a million mouths behind walls the dead test every night. The gold cloaks hold. Some of them.', choices: [{ t: 'The North?', next: 2 }, { t: 'Back', next: 0 }] },
      { text: 'No ravens from past the Neck in a month. Whatever this is, it comes from there. Someone must go.', choices: [{ t: 'Back', next: 0 }] }],
    kl_captain: [{ text: 'Commander of the gold cloaks. I was paid to keep the peace. Nobody said with whom.', choices: [{ t: 'Advice?', next: 1 }] },
      { text: 'Hit them before they hit you. Then hit them again. The dead do not learn. You should.', choices: [{ t: 'Back', next: 0 }] }],
    rr_lord: [{ text: 'Castellan of Riverrun. Three rivers, one garrison. The arithmetic is not kind.', choices: [{ t: 'The Twins?', next: 1 }] },
      { text: 'The Freys hold the only bridge north and they know it. They want grain for the toll. We will pay it.', choices: [{ t: 'Back', next: 0 }] }],
    rr_maester: [{ text: 'Maester of Riverrun. I write letters nobody believes. Sit.', choices: [{ t: 'Harrenhal?', next: 1 }] },
      { text: 'A ruin that remembers. Something cold nests in the burned towers. Do not sleep within the walls.', choices: [{ t: 'Back', next: 0 }] }],
    tw_lord: [{ text: 'Keeper of the toll. The Freys count. That is what we do.', choices: [{ t: 'The Neck?', next: 1 }] },
      { text: 'Moat Cailin. A Walker holds it and every soldier who ever died there walks the causeway. Kill it.', choices: [{ t: 'Back', next: 0 }] }],
    wh_lord: [{ text: 'Lord of White Harbor. I feed my people. Lately I feed them behind a chain.', choices: [{ t: 'Winterfell?', next: 1 }] },
      { text: 'Silent. No ravens, no riders, no smoke. If the wolves have fallen the North has no head. Go and see.', choices: [{ t: 'Back', next: 0 }] }],
    lh_lord: [{ text: 'An Umber. We do not run. We did, once, from a giant with a tree. Then we laughed.', choices: [{ t: 'The Watch?', next: 1 }] },
      { text: 'They send for every sword. They have sent before. This time the ravens are shaking. Go.', choices: [{ t: 'Back', next: 0 }] }],
    cb_lc: [{ text: 'Lord Commander of the Watch. Nine hundred brothers once. I do not count any more.', choices: [{ t: 'Beyond?', next: 1 }] },
      { text: 'A hall where a man fed his sons to the cold. A cairn of dead rangers. A village at the sea. Then it.', choices: [{ t: 'It?', next: 2 }, { t: 'Back', next: 0 }] },
      { text: 'The brothers call it the Pale Lord. Every dead thing answers to it. If it reaches the Wall, there is none.', choices: [{ t: 'Back', next: 0 }] }],
    cb_turncloak: [{ text: 'Varra. Free folk. The crows call me turncloak. The dead call me nothing; they do not talk.', choices: [{ t: 'Where it comes from?', next: 1 }] },
      { text: 'North of the Frostfangs, where nothing grows. It walks south in winter. This winter it did not stop.', choices: [{ t: 'Back', next: 0 }] }],
    cb_ranger: [{ text: 'Ranger. Three of us went to the Fist. One came back. Ask.', choices: [{ t: 'The Fist?', next: 1 }] },
      { text: 'A hill of stone where three hundred rangers died. Their glass is still there, under the cairn.', choices: [{ t: 'Back', next: 0 }] }] };
  const ROLE_TALK = { maester: 'The old songs call it frozen fire. Whatever it is, the dead do not like it.', arms: 'The dead do not tire and do not fear. You do both. Use the first; swallow the second.' };
  for (const n of NPCS) {
    let nodes;
    if (SP[n.id]) { nodes = SP[n.id].map(x => ({ text: x.text, choices: x.choices.slice() })); }
    else { nodes = [{ text: n.lines.greet[0], choices: [{ t: 'Tell me something.', next: 1 }] }, { text: ROLE_TALK[n.role] || n.lines.idle[0], choices: [{ t: 'And?', next: 2 }, { t: 'Back', next: 0 }] }, { text: n.lines.idle[1], choices: [{ t: 'Back', next: 0 }] }]; }
    const c0 = nodes[0].choices;
    c0.unshift(...qc(n));
    if (n.lines.inn) c0.push({ t: 'A bed and a meal.', inn: true });
    if (n.lines.shop) c0.push({ t: 'What do you sell?', shop: true });
    c0.push(LEAVE);
    dialogs[n.id] = nodes;
  }

  /* ---------------- registration + resolver ---------------- */
  const HOUSE_NAMES = { stark: 'Stark', lannister: 'Lannister', baratheon: 'Baratheon', targaryen: 'Targaryen', greyjoy: 'Greyjoy', tyrell: 'Tyrell', martell: 'Martell' };
  D.npcs = NPCS; D.npcById = byId;
  D.quests = QUESTS; D.questById = {}; for (const q of QUESTS) D.questById[q.id] = q;
  D.story = { prologue, regions, boss, epitaphs, death: epitaphs, nextHero, levelup, titles, dialogs, seats: SEATS, seatNames: SEAT_NAMES, hubs: HUBS, main: QUESTS.filter(q => q.main).map(q => q.id), houseChamps: HOUSE_CHAMPS };
  const champName = id => { const c = D.champs && (D.champs[id] || (Array.isArray(D.champs) && D.champs.find(x => x && x.id === id))); return (c && (c.name || c.n)) || CHAMP_NAMES[id] || id; };
  const champOf = (house, i) => { const list = HOUSE_CHAMPS[house] || HOUSE_CHAMPS.stark; return list[Math.min(i, list.length - 1)]; };
  const seatNpc = (house, role) => NPCS.find(n => n.poi === (SEATS[house] || 'winterfell') && n.role === role);
  const resolveId = (v, house) => { if (typeof v !== 'string') return v; if (v === 'seat') return SEATS[house] || 'winterfell'; if (v.indexOf('seat:') === 0) { const n = seatNpc(house, v.slice(5)); return n ? n.id : v; } if (v.indexOf('house:') === 0) return champOf(house, +v.slice(6) || 0); return v; };
  const ctx = (house, q) => { const c = { house: HOUSE_NAMES[house] || house, seat: SEAT_NAMES[SEATS[house]] || 'the seat' }; if (q && q.hero) c.hero = champName(resolveId(q.hero, house)); return c; };
  const fmt = (s, c) => typeof s === 'string' ? s.replace(/\{(\w+)\}/g, (m, k) => c && c[k] != null ? c[k] : m) : s;
  R.story = { seats: SEATS, hubs: HUBS, champName, champOf, seatNpc, fmt, ctx, resolveId,
    seatOf: house => SEATS[house] || 'winterfell',
    pick: arr => arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : '',
    line: (npcId, kind) => { const n = byId[npcId]; return n ? R.story.pick(n.lines[kind || 'greet']) : ''; },
    /* a copy of the quest with every placeholder resolved for this house (poi, giver, target, hero, reward.hero, text) */
    resolve: (q, house) => { if (typeof q === 'string') q = D.questById[q]; if (!q) return null; house = house || (R.state && R.state.acc && R.state.acc.house) || (R.state && R.state.p && R.state.p.house) || 'stark';
      const c = ctx(house, q); const r = Object.assign({}, q, { poi: resolveId(q.poi, house), giver: resolveId(q.giver, house), target: resolveId(q.target, house), reward: Object.assign({}, q.reward) });
      if (q.hero) r.hero = resolveId(q.hero, house); if (q.reward && q.reward.hero) r.reward.hero = resolveId(q.reward.hero, house);
      r.text = { offer: q.text.offer.map(s => fmt(s, c)), progress: fmt(q.text.progress, c), done: fmt(q.text.done, c) }; return r; },
    prologue: house => (prologue[house] || prologue.stark).map(s => fmt(s, { hero: champName(champOf(house, 0)), house: HOUSE_NAMES[house] || house })),
    epitaph: (name, lvl, killer) => fmt(R.story.pick(epitaphs), { name, lvl, killer }) };
})();
