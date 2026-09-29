# HOLDOR — პრომპტები v1.0.62: აღჭურვილობის (ითემების) ხატები

## როგორ მუშაობს

ახლა ყოველი ითემი ემოჯით ჩანს (⚔️ 🪓 ⛑️ 🧥 …). ხატები რომ მოვა, კოდი თვითონ ჩასვამს — **ფერს, ხარისხის ჩარჩოს, სეტის ემბლემას და ★-ებს კოდი ხატავს**, ამიტომ თითო ითემზე ერთი **ნეიტრალური** ხატი გვჭირდება (ფოლადი / ტყავი / ქსოვილი, ყოველგვარი ნათების და ფერადი ბრწყინვალების გარეშე).

სულ **4 ფურცელი**: 24 ითემი + 12 სეტის ემბლემა. ყოველ ფურცელზე ობიექტები **მაჯენტა (#FF00FF) ფონზე**, ბადეში, ერთი ერთ უჯრაში. ფაილს მომაწოდებ და ჩავსვამ (`setGearSheet('armor' | 'weapons' | 'small' | 'sets', სურათი)`) — მაჯენტა თვითონ გამჭვირვალე ხდება.

**თანმიმდევრობა:** ერთ ჯერზე ერთი ფურცელი. დაიწყე **ფურცელი 1-ით** — გამომიგზავნე, ჩავსვამ, გაჩვენებ და მხოლოდ მერე გადავიდეთ შემდეგზე. უჯრების რიგი **მარცხნიდან მარჯვნივ, ზემოდან ქვემოთ** მკაცრად დაიცავი — რიგით ვჭრი.

**ფაილის სახელები:** `gear_armor.png`, `gear_weapons.png`, `gear_small.png`, `gear_sets.png`.

Kingdom Rush / Raid — მხოლოდ მექანიკის რეფერენსია; სახელები, ხატები, სტილი არ ვაკოპირებთ.

---

## სტილის ბლოკი (ყველა ფურცელზე ერთი და იგივე — თავში ჩასვი)

ზომა **1536×1536** (ფურცელი 4-ზე — **2048×1536**), PNG.

```
a sprite sheet of separate fantasy medieval game item icons on a flat solid magenta #FF00FF background, laid out in a strict grid with wide even gaps between cells, each item centered in its own cell and completely inside it, all items drawn at the same scale and the same three-quarter front view, hand-painted 2D mobile-game icon style, soft cel shading, thick dark-brown outline, warm light from the top left, chunky readable silhouette that stays clear at 64 px, neutral materials only (steel, dark leather, wood, plain cloth) with muted colours and NO glow, NO magical aura, NO coloured gemstones, NO text, NO characters, NO hands, NO ground shadow, NO border, NO frame, NO vignette, nothing touching the magenta except the item itself
```

ქვემოთ ყოველი ფურცლისთვის ეს ბლოკი + „CELLS" ნაწილი (დაამატე ბლოკის ბოლოს).

---

## ფურცელი 1 — `gear_armor.png` (3×3, დაცვა)

```
CELLS, 3 columns by 3 rows, in reading order (left to right, top to bottom):
1 a round wooden shield with an iron rim and boss;
2 a small round buckler, plain steel with a leather grip;
3 a tall kite shield, iron-banded wood, pointed bottom;
4 an open knight's helm with a nasal bar, dented steel;
5 a hooded mail coif with a leather hood over it;
6 a plain iron crown-helm with a low band and four short points;
7 a chainmail hauberk with short sleeves and a leather belt;
8 a full plate breastplate with pauldrons, riveted steel;
9 a padded leather jerkin with metal studs and lacing.
```

## ფურცელი 2 — `gear_weapons.png` (3×3, იარაღი და ხელთათმანები/ჩექმები)

```
CELLS, 3 columns by 3 rows, in reading order (left to right, top to bottom):
1 a straight one-handed longsword, point up, plain crossguard and leather grip;
2 a broad single-headed battle axe with a wooden haft, head up;
3 a long spear with a leaf-shaped iron head, standing upright;
4 a wooden recurve bow, unstrung silhouette with a plain grip;
5 a gnarled wooden staff with a simple carved head (no gem, no glow);
6 a pair of steel gauntlets, fingers up;
7 a pair of plain leather gloves with cuffs;
8 a pair of sturdy leather boots with metal toe caps;
9 a pair of steel greaves with strapped shin guards.
```

## ფურცელი 3 — `gear_small.png` (3×3, სამკაულები და დროშები; 7-9 უჯრა ცარიელი ფონია)

```
CELLS, 3 columns by 3 rows, in reading order (left to right, top to bottom); cells 7, 8 and 9 stay EMPTY magenta:
1 a simple iron ring with a flat band (no gem);
2 a heavy gold signet ring with a flat engraved face, no gem;
3 a round bronze amulet on a leather cord, plain disc with a knot pattern;
4 a teardrop-shaped pendant on a fine chain, plain metal;
5 a small cloth banner on a wooden pole, plain dark red fabric, swallow-tail edge, no emblem;
6 a tall war standard: a square cloth on a crossbar and a long pole, plain dark blue fabric, no emblem.
```

## ფურცელი 4 — `gear_sets.png` (4×3 — 2048×1536, სეტის ემბლემები)

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
