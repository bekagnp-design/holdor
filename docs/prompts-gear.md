# HOLDOR — პრომპტები v1.0.63: აღჭურვილობის (ითემების) ხატები

## როგორ მუშაობს

ახლა ყოველი ითემი ემოჯით ჩანს (⚔️ 🪓 ⛑️ 🧥 …), 54 სახეობა (ხმალი, ცული, შუბი, მშვილდი, ჯვარედინი მშვილდი, ჯოხი, ხანჯალი, უორჰამერი … ბეჭედი, სიგილი, ტოტემი…). ხატები რომ მოვა, კოდი თვითონ ჩასვამს — **ფერს, ხარისხის ჩარჩოს, სეტის ემბლემას და ★-ებს კოდი ხატავს**, ამიტომ თითო ითემზე ერთი **ნეიტრალური** ხატი გვჭირდება (ფოლადი / ტყავი / ქსოვილი, ხის; ყოველგვარი ნათების გარეშე).

სულ **7 ფურცელი**: 54 ითემის სახეობა (6 ფურცელი × 9) + 12 სეტის ემბლემა. ყოველ ფურცელზე ობიექტები **მაჯენტა (#FF00FF) ფონზე**, ბადეში, ერთი ერთ უჯრაში. ფაილს მომაწოდებ და ჩავსვამ (`setGearSheet('kinds1' … 'kinds6' | 'sets', სურათი)`) — მაჯენტა თვითონ გამჭვირვალე ხდება.

**თანმიმდევრობა:** ერთ ჯერზე ერთი ფურცელი. დაიწყე **ფურცელი 1-ით** (იარაღები) — გამომიგზავნე, ჩავსვამ, გაჩვენებ და მხოლოდ მერე გადავიდეთ შემდეგზე. უჯრების რიგი **მარცხნიდან მარჯვნივ, ზემოდან ქვემოთ** მკაცრად დაიცავი — რიგით ვჭრი.

**ფაილის სახელები:** `gear_kinds1.png` … `gear_kinds6.png`, `gear_sets.png`.

Kingdom Rush / Raid — მხოლოდ მექანიკის რეფერენსია; სახელები, ხატები, სტილი არ ვაკოპირებთ.

---

## სტილის ბლოკი (ყველა ფურცელზე ერთი და იგივე — თავში ჩასვი)

ზომა **1536×1536** (ფურცელი 7-ზე — **2048×1536**), PNG.

```
a sprite sheet of separate fantasy medieval game item icons on a flat solid magenta #FF00FF background, laid out in a strict grid with wide even gaps between cells, each item centered in its own cell and completely inside it, all items drawn at the same scale and the same three-quarter front view, hand-painted 2D mobile-game icon style, soft cel shading, thick dark-brown outline, warm light from the top left, chunky readable silhouette that stays clear at 64 px, neutral materials only (steel, dark leather, wood, plain cloth) with muted colours and NO glow, NO magical aura, NO coloured gemstones, NO text, NO characters, NO hands, NO ground shadow, NO border, NO frame, NO vignette, nothing touching the magenta except the item itself
```

ქვემოთ ყოველი ფურცლისთვის ეს ბლოკი + „CELLS" ნაწილი (დაამატე ბლოკის ბოლოს).

---

## ფურცელი 1 — `gear_kinds1.png` (3×3: Sword, Axe, Spear, Bow, Crossbow, Staff, Dagger, Warhammer, Halberd)

```
CELLS, 3 columns by 3 rows, in reading order (left to right, top to bottom):
1 a straight one-handed longsword, point up, plain crossguard and leather grip;
2 a broad single-headed battle axe with a wooden haft, head up;
3 a long spear with a leaf-shaped iron head, standing upright;
4 a wooden recurve bow, unstrung silhouette with a plain grip;
5 a heavy steel-limbed crossbow with a wooden stock, seen from the side;
6 a gnarled wooden staff with a simple carved head (no gem, no glow);
7 a slim double-edged dagger with a wrapped grip, point up;
8 a two-faced iron warhammer on a short thick haft;
9 a tall halberd: an axe blade, a spike and a hook on a long pole.
```

## ფურცელი 2 — `gear_kinds2.png` (3×3: Flail, Shield, Buckler, Kite shield, Tome, Torch, Orb, Helm, Hood)

```
CELLS, 3 columns by 3 rows, in reading order (left to right, top to bottom):
1 a spiked iron ball flail on a chain and a short wooden handle;
2 a round wooden shield with an iron rim and boss;
3 a small round buckler, plain steel with a leather grip;
4 a tall kite shield, iron-banded wood, pointed bottom;
5 a thick leather-bound book with brass corners, closed;
6 a wooden torch wrapped in oiled rags with a small plain flame;
7 a smooth glass orb in a small iron claw stand (dull, no glow);
8 an open knight helm with a nasal bar, dented steel;
9 a deep dark-cloth hood with a stitched edge.
```

## ფურცელი 3 — `gear_kinds3.png` (3×3: Crown, Coif, Mask, Horned helm, Mail, Plate, Robe, Jerkin, Cloak)

```
CELLS, 3 columns by 3 rows, in reading order (left to right, top to bottom):
1 a plain iron crown with a low band and four short points;
2 a chainmail coif hanging open, riveted rings;
3 a plain leather half-mask with two eye slits and a strap;
4 a rounded iron helm with two curved bull horns;
5 a chainmail hauberk with short sleeves and a leather belt;
6 a full plate breastplate with pauldrons, riveted steel;
7 a long plain cloth robe with wide sleeves and a rope belt;
8 a padded leather jerkin with metal studs and lacing;
9 a long travelling cloak with a clasp at the neck, folded.
```

## ფურცელი 4 — `gear_kinds4.png` (3×3: Brigandine, Gauntlets, Gloves, Bracers, Mitts, Boots, Greaves, Sandals, Spurs)

```
CELLS, 3 columns by 3 rows, in reading order (left to right, top to bottom):
1 a cloth coat with riveted steel plates showing inside, buckled;
2 a pair of steel gauntlets, fingers up;
3 a pair of plain leather gloves with cuffs;
4 a pair of leather forearm bracers with metal studs;
5 a pair of thick fur-lined mitts;
6 a pair of sturdy leather boots with metal toe caps;
7 a pair of steel greaves with strapped shin guards;
8 a pair of light leather sandals with long lacing;
9 a pair of riding boots with prominent iron spurs.
```

## ფურცელი 5 — `gear_kinds5.png` (3×3: Ring, Signet, Band, Seal, Loop, Claw ring, Amulet, Pendant, Talisman)

```
CELLS, 3 columns by 3 rows, in reading order (left to right, top to bottom):
1 a simple iron ring with a flat band (no gem);
2 a heavy gold signet ring with a flat engraved face, no gem;
3 a thin silver band with a twisted-wire pattern;
4 a thick bronze seal ring with a round flat stamp;
5 a braided leather loop ring with a small bead;
6 a dark iron ring with a curved animal claw on top;
7 a round bronze amulet on a leather cord, plain disc with a knot pattern;
8 a teardrop-shaped pendant on a fine chain, plain metal;
9 a carved bone talisman on a cord with a small wrapped thread.
```

## ფურცელი 6 — `gear_kinds6.png` (3×3: Charm, Fang, Relic, Banner, Standard, Pennant, War horn, Totem, Sigil)

```
CELLS, 3 columns by 3 rows, in reading order (left to right, top to bottom):
1 a small clover-shaped metal charm on a short chain;
2 a large curved animal fang set in a plain metal cap on a cord;
3 an old small clay-and-iron reliquary on a chain, closed;
4 a small cloth banner on a wooden pole, plain dark red fabric, swallow-tail edge, no emblem;
5 a tall war standard: a square cloth on a crossbar and a long pole, plain dark blue fabric, no emblem;
6 a long triangular pennant on a slim pole, plain cloth;
7 a curved bull-horn war horn with a metal rim and a leather strap;
8 a short carved wooden totem pole with a simple face;
9 a flat iron plaque on a short pole with a plain geometric mark.
```

## ფურცელი 7 — `gear_sets.png` (4×3 — 2048×1536, სეტის ემბლემები)

ესენი მცირე ბეჯებია ხატის კუთხეში (13 px-მდე დაპატარავდება) — ამიტომ **ძალიან მარტივი, მკვეთრი სილუეტი, თითო ფერი**. ყოველი: მრგვალი ან ფარისებრი ბეჯი ერთი ცენტრალური ნიშნით.

```
a sprite sheet of 12 separate simple heraldic set emblems on a flat solid magenta #FF00FF background, laid out in a strict grid of 4 columns by 3 rows with wide even gaps, each emblem centered in its own cell and completely inside it, each emblem a round badge with a thick dark outline and ONE bold central symbol that reads clearly at 16 px, flat bold colours (one main colour plus cream and dark outline), hand-painted 2D mobile-game style, soft cel shading, NO text, NO letters, NO frame, NO shadow, NO glow. CELLS in reading order (left to right, top to bottom):
1 a grey wolf head in profile on dark slate;
2 a golden lion head facing front on crimson;
3 a three-headed dragon silhouette on black with orange;
4 a tentacled kraken head on deep teal;
5 a stag head with antlers on forest green;
6 a single open rose on soft pink and dark green;
7 a radiant sun disc on warm orange;
8 an anvil with a hammer on dark iron grey;
9 a stone wall with a round tower on sand grey;
10 a single blood drop on dark red;
11 a raven with spread wings on midnight blue;
12 a crossed arrow and hunting horn on olive brown.
```

---

## ჩასმის შემდეგ

- ხატი ყოველ ითემზე გამოჩნდება (ფორჯში, ჩანთაში, ფურცელზე). სეტის ემბლემა — ხატის კუთხეში.
- თუ რომელიმე უჯრა არ მოგეწონა — მხოლოდ იმას გადაახატინებ; ფურცელს თავიდან არ ვჭრი, უჯრას ვცვლი.
- **მოგვიანებით (არჩევითი):** ხარისხის მიხედვით ცალკე ვარიანტები (Legendary-ს უფრო მდიდრული სილუეტი) — ეს უკვე მერე, როცა ბაზისური ხატები დადგება.

## ორი არჩევანი შენზე

1. **თითო ხატი ყოველ ხარისხზე** (5× მეტი სურათი) — ლამაზი, მაგრამ ბევრი სამუშაო. ახლა არა: ჩარჩოს ფერი ხარისხს ისედაც აჩვენებს.
2. **სეტის ემბლემები ცალკე თუ ხატის ნაწილად** — ახლა ცალკეა (კუთხის ბეჯი), რომ ერთი და იგივე ხატი ყველა სეტში გამოვიყენოთ.
