#!/usr/bin/env python3
# The gear kinds: every slot has several kinds, each with its own main stats and its own pool of special effects (perks).
# Source of truth for: the server config (holdor_v12.sql between the KINDS markers) and the art prompts (docs/prompts-gear.md).
# usage: python3 backend/gear_kinds.py   — rewrites both. A perk is one of the game's skill mechanics (SK) granted by an item.
import json, os, re
B = os.path.dirname(os.path.abspath(__file__)); R = os.path.dirname(B)
# slot: [(name, emoji, main stats, perks, what the icon shows)]
K = {
 'weapon': [
  ('Sword', '⚔️', ['dmg', 'rate'], ['bleed', 'sunder', 'parry', 'blood'], 'a straight one-handed longsword, point up, plain crossguard and leather grip'),
  ('Axe', '🪓', ['dmg', 'crit'], ['bleed', 'execute', 'warhammer', 'blood'], 'a broad single-headed battle axe with a wooden haft, head up'),
  ('Spear', '🔱', ['dmg', 'range'], ['knock', 'duelist', 'pierce', 'momentum'], 'a long spear with a leaf-shaped iron head, standing upright'),
  ('Bow', '🏹', ['rate', 'range'], ['multishot', 'pierce', 'volley', 'keepback'], 'a wooden recurve bow, unstrung silhouette with a plain grip'),
  ('Crossbow', '🎯', ['dmg', 'range'], ['pierce', 'sunder', 'duelist', 'chain'], 'a heavy steel-limbed crossbow with a wooden stock, seen from the side'),
  ('Staff', '🪄', ['cdr', 'dmg'], ['storm', 'burn', 'howl', 'quickstudy'], 'a gnarled wooden staff with a simple carved head (no gem, no glow)'),
  ('Dagger', '🗡️', ['crit', 'rate'], ['execute', 'poison', 'viper', 'waitstrike'], 'a slim double-edged dagger with a wrapped grip, point up'),
  ('Warhammer', '🔨', ['dmg', 'hp'], ['stun', 'warhammer', 'knock', 'sunder'], 'a two-faced iron warhammer on a short thick haft'),
  ('Halberd', '⚜️', ['dmg', 'range'], ['cleave', 'chain', 'duelist', 'knock'], 'a tall halberd: an axe blade, a spike and a hook on a long pole'),
  ('Flail', '⛓️', ['dmg', 'rate'], ['bleed', 'stun', 'charm', 'drownaura'], 'a spiked iron ball flail on a chain and a short wooden handle')],
 'offhand': [
  ('Shield', '🛡️', ['armor', 'hp'], ['discipline', 'thorns', 'parry', 'whatisdead'], 'a round wooden shield with an iron rim and boss'),
  ('Buckler', '🔘', ['armor', 'rate'], ['parry', 'keepback', 'thorns', 'contempt'], 'a small round buckler, plain steel with a leather grip'),
  ('Kite shield', '🔰', ['hp', 'armor'], ['discipline', 'contempt', 'shield', 'rally'], 'a tall kite shield, iron-banded wood, pointed bottom'),
  ('Tome', '📖', ['cdr', 'hp'], ['quickstudy', 'rations', 'heal', 'storm'], 'a thick leather-bound book with brass corners, closed'),
  ('Torch', '🔥', ['dmg', 'hp'], ['burn', 'drownaura', 'howl', 'slowaura'], 'a wooden torch wrapped in oiled rags with a small plain flame'),
  ('Orb', '🔮', ['cdr', 'dmg'], ['storm', 'poison', 'frostbite', 'charm'], 'a smooth glass orb in a small iron claw stand (dull, no glow)')],
 'helmet': [
  ('Helm', '⛑️', ['hp', 'armor'], ['contempt', 'whatisdead', 'shield', 'thorns'], 'an open knight helm with a nasal bar, dented steel'),
  ('Hood', '🧢', ['crit', 'cdr'], ['viper', 'howl', 'slowaura', 'waitstrike'], 'a deep dark-cloth hood with a stitched edge'),
  ('Crown', '👑', ['gold', 'hp'], ['tribute', 'goldtouch', 'hand', 'drill'], 'a plain iron crown with a low band and four short points'),
  ('Coif', '🪖', ['armor', 'regen'], ['thorns', 'shield', 'rations', 'discipline'], 'a chainmail coif hanging open, riveted rings'),
  ('Mask', '🎭', ['crit', 'lifesteal'], ['viper', 'poison', 'execute', 'bleed'], 'a plain leather half-mask with two eye slits and a strap'),
  ('Horned helm', '🐂', ['dmg', 'hp'], ['blood', 'stun', 'knock', 'bleed'], 'a rounded iron helm with two curved bull horns')],
 'armor': [
  ('Mail', '🧥', ['armor', 'hp'], ['thorns', 'discipline', 'whatisdead', 'contempt'], 'a chainmail hauberk with short sleeves and a leather belt'),
  ('Plate', '🥋', ['armor', 'hp'], ['contempt', 'shield', 'parry', 'thorns'], 'a full plate breastplate with pauldrons, riveted steel'),
  ('Robe', '👘', ['cdr', 'regen'], ['rations', 'heal', 'quickstudy', 'storm'], 'a long plain cloth robe with wide sleeves and a rope belt'),
  ('Jerkin', '🦺', ['spd', 'hp'], ['keepback', 'momentum', 'favour', 'reave'], 'a padded leather jerkin with metal studs and lacing'),
  ('Cloak', '🧣', ['spd', 'crit'], ['howl', 'slowaura', 'viper', 'waitstrike'], 'a long travelling cloak with a clasp at the neck, folded'),
  ('Brigandine', '🥼', ['armor', 'rate'], ['drill', 'bleed', 'sunder', 'discipline'], 'a cloth coat with riveted steel plates showing inside, buckled')],
 'gloves': [
  ('Gauntlets', '🧤', ['rate', 'armor'], ['stun', 'warhammer', 'parry', 'knock'], 'a pair of steel gauntlets, fingers up'),
  ('Gloves', '🥊', ['rate', 'crit'], ['poison', 'viper', 'chain', 'bleed'], 'a pair of plain leather gloves with cuffs'),
  ('Bracers', '💪', ['dmg', 'armor'], ['thorns', 'sunder', 'shield', 'parry'], 'a pair of leather forearm bracers with metal studs'),
  ('Mitts', '🫱', ['rate', 'regen'], ['frostbite', 'burn', 'charm', 'storm'], 'a pair of thick fur-lined mitts')],
 'boots': [
  ('Boots', '🥾', ['spd'], ['momentum', 'keepback', 'reave', 'trap'], 'a pair of sturdy leather boots with metal toe caps'),
  ('Greaves', '🦿', ['spd', 'armor'], ['thorns', 'contempt', 'knock', 'shield'], 'a pair of steel greaves with strapped shin guards'),
  ('Sandals', '🩴', ['spd', 'regen'], ['waitstrike', 'howl', 'favour', 'rations'], 'a pair of light leather sandals with long lacing'),
  ('Spurs', '⚙️', ['spd', 'dmg'], ['momentum', 'bleed', 'cleave', 'drill'], 'a pair of riding boots with prominent iron spurs')],
 'ring': [
  ('Ring', '💍', ['dmg', 'rate', 'cdr', 'lifesteal'], ['poison', 'burn', 'frostbite', 'reave'], 'a simple iron ring with a flat band (no gem)'),
  ('Signet', '🏵️', ['gold', 'cdr'], ['goldtouch', 'tribute', 'hand', 'quickstudy'], 'a heavy gold signet ring with a flat engraved face, no gem'),
  ('Band', '⭕', ['crit', 'rate'], ['execute', 'viper', 'chain', 'stun'], 'a thin silver band with a twisted-wire pattern'),
  ('Seal', '🔴', ['armor', 'hp'], ['whatisdead', 'thorns', 'parry', 'shield'], 'a thick bronze seal ring with a round flat stamp'),
  ('Loop', '🪢', ['lifesteal', 'regen'], ['reave', 'rations', 'heal', 'sunaura'], 'a braided leather loop ring with a small bead'),
  ('Claw ring', '🐾', ['dmg', 'crit'], ['bleed', 'sunder', 'duelist', 'momentum'], 'a dark iron ring with a curved animal claw on top')],
 'amulet': [
  ('Amulet', '📿', ['hp', 'cdr', 'gold', 'lifesteal'], ['whatisdead', 'quickstudy', 'tribute', 'reave'], 'a round bronze amulet on a leather cord, plain disc with a knot pattern'),
  ('Pendant', '🔗', ['regen', 'armor'], ['heal', 'rations', 'discipline', 'sunaura'], 'a teardrop-shaped pendant on a fine chain, plain metal'),
  ('Talisman', '🧿', ['crit', 'cdr'], ['storm', 'waitstrike', 'viper', 'quickstudy'], 'a carved bone talisman on a cord with a small wrapped thread'),
  ('Charm', '🍀', ['gold', 'spd'], ['tribute', 'goldtouch', 'trap', 'favour'], 'a small clover-shaped metal charm on a short chain'),
  ('Fang', '🦷', ['dmg', 'lifesteal'], ['reave', 'bleed', 'blood', 'poison'], 'a large curved animal fang set in a plain metal cap on a cord'),
  ('Relic', '🏺', ['hp', 'armor'], ['whatisdead', 'shield', 'thorns', 'contempt'], 'an old small clay-and-iron reliquary on a chain, closed')],
 'banner': [
  ('Banner', '🚩', ['range', 'cdr', 'gold', 'regen'], ['rally', 'forge', 'siegecraft', 'drill'], 'a small cloth banner on a wooden pole, plain dark red fabric, swallow-tail edge, no emblem'),
  ('Standard', '🏴', ['range', 'hp'], ['rally', 'siegecraft', 'favour', 'discipline'], 'a tall war standard: a square cloth on a crossbar and a long pole, plain dark blue fabric, no emblem'),
  ('Pennant', '🎏', ['spd', 'cdr'], ['rally', 'hand', 'howl', 'drill'], 'a long triangular pennant on a slim pole, plain cloth'),
  ('War horn', '📯', ['cdr', 'gold'], ['howl', 'rally', 'favour', 'tribute'], 'a curved bull-horn war horn with a metal rim and a leather strap'),
  ('Totem', '🗿', ['regen', 'hp'], ['sunaura', 'heal', 'rations', 'bloodmagic'], 'a short carved wooden totem pole with a simple face'),
  ('Sigil', '🔱', ['crit', 'range'], ['forge', 'siegecraft', 'sunder', 'hand'], 'a flat iron plaque on a short pole with a plain geometric mark')],
}
# v1.0.86: the kinds grow to the hundreds. Each new kind is named for itself and built on one of the first 54 (its main stats and
# perk pool, the perks turned so that siblings differ); the first 54 keep their places, so every item already rolled keeps its kind.
X = {
 'weapon': [('Longsword','Sword'),('Greatsword','Sword'),('Bastard sword','Sword'),('Falchion','Sword'),('Scimitar','Sword'),('Sabre','Sword'),('Rapier','Dagger'),('Estoc','Sword'),('Gladius','Sword'),('Cutlass','Sword'),
  ('Dirk','Dagger'),('Stiletto','Dagger'),('Kris','Dagger'),('Battle axe','Axe'),('Hatchet','Axe'),('Bearded axe','Axe'),('Labrys','Axe'),('Great axe','Axe'),('Glaive','Halberd'),('Bardiche','Halberd'),
  ('Poleaxe','Halberd'),('Pike','Spear'),('Lance','Spear'),('Javelin','Spear'),('Trident','Spear'),('Morningstar','Warhammer'),('Maul','Warhammer'),('Mace','Warhammer'),('Longbow','Bow'),('Recurve bow','Bow'),
  ('Arbalest','Crossbow'),('Wand','Staff'),('Sceptre','Staff'),('Scourge','Flail'),('Chain flail','Flail'),('Weirwood staff','Staff'),('Hunting bow','Bow'),('War pick hammer','Warhammer'),('Cleaver','Axe'),('Harpoon','Spear')],
 'offhand': [('Tower shield','Kite shield'),('Heater shield','Kite shield'),('Pavise','Kite shield'),('Targe','Buckler'),('Aegis','Shield'),('Bulwark','Shield'),('Ward','Shield'),('Grimoire','Tome'),('Codex','Tome'),
  ('Scroll','Tome'),('Ledger','Tome'),('Lantern','Torch'),('Brazier','Torch'),('Globe','Orb'),('Skull','Orb'),('Crystal','Orb'),('Seer\'s eye','Orb'),('Iron targe','Buckler'),('Oak shield','Shield'),('Raven tome','Tome')],
 'helmet': [('Great helm','Helm'),('Barbute','Helm'),('Sallet','Helm'),('Bascinet','Helm'),('Casque','Helm'),('Kettle helm','Helm'),('Circlet','Crown'),('Diadem','Crown'),('Tiara','Crown'),('Cowl','Hood'),
  ('Visage','Mask'),('Antler helm','Horned helm'),('Mail coif','Coif'),('Iron cap','Coif'),('Winged helm','Helm'),('Ram helm','Horned helm'),('Shadow hood','Hood'),('Death mask','Mask')],
 'armor': [('Hauberk','Mail'),('Byrnie','Mail'),('Scale','Mail'),('Lamellar','Mail'),('Cuirass','Plate'),('Breastplate','Plate'),('Carapace','Plate'),('Vestment','Robe'),('Cassock','Robe'),('Tabard','Robe'),
  ('Mantle','Cloak'),('Cape','Cloak'),('Shroud','Cloak'),('Jack','Brigandine'),('Gambeson','Jerkin'),('Doublet','Jerkin'),('Harness','Jerkin'),('Coat of plates','Brigandine'),('Fur cloak','Cloak'),('Night\'s robe','Robe')],
 'gloves': [('War gauntlets','Gauntlets'),('Iron gauntlets','Gauntlets'),('Vambraces','Bracers'),('Cuffs','Bracers'),('Riding gloves','Gloves'),('Archer\'s gloves','Gloves'),('Grips','Gloves'),('Fur mitts','Mitts'),
  ('Wool mitts','Mitts'),('Steel bracers','Bracers'),('Plate gauntlets','Gauntlets'),('Hunter\'s gloves','Gloves')],
 'boots': [('Sabatons','Greaves'),('War boots','Boots'),('Riding boots','Boots'),('Traveller\'s boots','Boots'),('Iron greaves','Greaves'),('Silk sandals','Sandals'),('Ranger boots','Boots'),
  ('Steel treads','Boots'),('Swift steps','Boots'),('Knight\'s spurs','Spurs'),('Desert sandals','Sandals'),('Snow boots','Boots')],
 'ring': [('Hoop','Band'),('Coil','Loop'),('Braid','Loop'),('Iron ring','Ring'),('Ruby ring','Ring'),('Lord\'s signet','Signet'),('Maester\'s seal','Seal'),('Wolf claw ring','Claw ring'),('Twin band','Band'),
  ('Silver ring','Ring'),('Old seal','Seal'),('Merchant\'s signet','Signet'),('Bone ring','Ring'),('Leather loop','Loop'),('Dragon claw ring','Claw ring'),('Gold band','Band')],
 'amulet': [('Medallion','Amulet'),('Torc','Amulet'),('Necklace','Amulet'),('Locket','Pendant'),('Tear','Pendant'),('Idol','Talisman'),('Rune','Talisman'),('Token','Charm'),('Clover','Charm'),('Tooth','Fang'),
  ('Tusk','Fang'),('Phial','Relic'),('Vial','Relic'),('Urn','Relic'),('Chain of office','Amulet'),('Wolf fang','Fang'),('Lucky token','Charm'),('Old idol','Talisman')],
 'banner': [('Flag','Banner'),('Ensign','Banner'),('Colours','Banner'),('Gonfalon','Standard'),('Vexillum','Standard'),('Streamer','Pennant'),('Battle horn','War horn'),('Effigy','Totem'),('Plaque','Sigil'),
  ('House banner','Banner'),('War standard','Standard'),('Long pennant','Pennant'),('Hunting horn','War horn'),('Weirwood totem','Totem')],
}
for _s, _lst in X.items():
    _by = {k[0]: k for k in K[_s]}
    for _i, (_n, _base) in enumerate(_lst):
        n0, e0, m0, p0, a0 = _by[_base]
        _r = (_i % len(p0)) or 1
        K[_s].append((_n, e0, list(m0) if _i % 2 == 0 else list(reversed(m0)), p0[_r:] + p0[:_r], a0.replace(_base.lower(), _n.lower())))
SLOTS = list(K)
def cfg():
    return {'kinds': {s: [{'n': n, 'main': m, 'perks': p} for (n, e, m, p, a) in K[s]] for s in SLOTS},
            'perk_p': [0, 40, 100, 100, 100], 'perk2_p': [0, 0, 0, 100, 100]}
def sheets():   # the icons in reading order, nine to a sheet
    flat = [(s, n, a) for s in SLOTS for (n, e, m, p, a) in K[s]]
    return [flat[i:i + 9] for i in range(0, len(flat), 9)]
if __name__ == '__main__':
    import sys
    if '--v22' in sys.argv:   # v1.0.86: the full list goes to holdor_v22.sql and src/gear_kinds.json (the app's names and emoji)
        js = json.dumps(cfg(), separators=(',', ':'), ensure_ascii=False).replace("'", "''")
        p = os.path.join(B, 'holdor_v22.sql'); t = open(p).read()
        t = re.sub(r"(-- KINDS-BEGIN\n).*?(\n-- KINDS-END)", lambda m: m.group(1) + "update econ_config set v = v || '" + js + "'::jsonb where k = 'gear';" + m.group(2), t, flags=re.S)
        open(p, 'w').write(t)
        open(os.path.join(R, 'src', 'gear_kinds.json'), 'w').write(json.dumps({s: [[n, e] for (n, e, m, p, a) in K[s]] for s in SLOTS}, ensure_ascii=False, separators=(',', ':')))
        print('kinds:', sum(len(v) for v in K.values()), {s: len(K[s]) for s in SLOTS}); sys.exit(0)
    K54 = {s: v[:{'weapon': 10, 'offhand': 6, 'helmet': 6, 'armor': 6, 'gloves': 4, 'boots': 4, 'ring': 6, 'amulet': 6, 'banner': 6}[s]] for s, v in K.items()}
    K.clear(); K.update(K54)   # holdor_v12.sql keeps the first 54
    p = os.path.join(B, 'holdor_v12.sql'); t = open(p).read()
    js = json.dumps(cfg(), separators=(',', ':'), ensure_ascii=False).replace("'", "''")
    t = re.sub(r"(-- KINDS-BEGIN\n).*?(\n-- KINDS-END)", lambda m: m.group(1) + "update econ_config set v = v || '" + js + "'::jsonb where k = 'gear';" + m.group(2), t, flags=re.S)
    open(p, 'w').write(t)
    print('kinds:', sum(len(v) for v in K.values()), 'slots:', len(K), 'sheets:', len(sheets()), 'perks used:', len({x for s in K.values() for k in s for x in k[3]}))
