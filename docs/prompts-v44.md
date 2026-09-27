# HOLDOR — პრომპტები v1.0.44 (ყუთები · სქილის აიქონები · 13 ბრძოლის ველი)

ყველა სურათი ცალ-ცალკე დააგენერირე, ფაილს დაარქვი ზუსტად ის სახელი, რაც წერია — ამ სახელით ვაბამ კოდში (`CHEST_ART`, `SKILL_ART`, ფონები). ჯერ **ერთი** სურათი გამომიგზავნე სტილის დასამტკიცებლად, მერე დანარჩენი იმავე სურათის რეფერენსით.

---

## 1. ყუთები — 8 სურათი (4 ხარისხი × დახურული/ღია)

ფაილები: `chest_wood.png`, `chest_wood_open.png`, `chest_iron.png`, `chest_iron_open.png`, `chest_valyrian.png`, `chest_valyrian_open.png`, `chest_dragon.png`, `chest_dragon_open.png`. ზომა 1024×1024 (ჩამოვიყვან 256-ზე), ფონი **მაჯენტა #FF00FF**.

**სტილის ბლოკი (ყველა ყუთისთვის):**
```
flat 2D mobile game treasure chest icon in the style of Kingdom Rush and Clash Royale, chunky exaggerated proportions, clean thick dark outline, cel-shaded with glossy highlights, front three-quarter view slightly from above, single chest centered, fills 85% of the frame, plain solid magenta (#FF00FF) background, no ground shadow, no text, no watermark, no signature
```

| ფაილი | აღწერა (სტილის ბლოკის შემდეგ) |
|---|---|
| `chest_wood.png` | `a small rough wooden chest with iron corner bands and a plain iron lock, weathered pine planks, closed lid` |
| `chest_wood_open.png` | `the same small wooden chest with the lid thrown open, a soft warm glow and a few gold coins spilling over the edge` |
| `chest_iron.png` | `a heavy grey iron-plated chest with riveted steel bands, a large padlock with a blue Night's Watch crow emblem, closed lid` |
| `chest_iron_open.png` | `the same iron chest open, bright golden light bursting out, gold coins and a silver card visible inside` |
| `chest_valyrian.png` | `an ornate dark purple chest with swirling Valyrian steel bands, glowing violet runes along the lid, a dragon-shaped lock, closed` |
| `chest_valyrian_open.png` | `the same Valyrian chest open, violet and gold light pouring out, purple gem shards and gold inside, small magical sparkles` |
| `chest_dragon.png` | `a legendary dark red and black chest shaped with dragon scales, gold dragon-claw feet, a gold dragon head as the lock, small flames licking the edges, closed` |
| `chest_dragon_open.png` | `the same dragon chest open, a column of fire and golden light rising from it, gold coins overflowing, embers floating` |

---

## 2. სქილის აიქონები — 30 სურათი

ფაილები: `skill_<id>.png` (id ქვემოთ ცხრილში). ზომა 512×512, ფონი **მაჯენტა #FF00FF**. კვადრატული, მომრგვალებული კუთხეებით — ბარათებზე 20–40 px ზომაში გამოჩნდება, ამიტომ **ერთი მარტივი, სქელი სიმბოლო** უნდა იყოს, დეტალების გარეშე.

**სტილის ბლოკი:**
```
flat 2D mobile game skill icon in the style of Kingdom Rush, a single bold symbol inside a rounded square badge with a thick dark outline and a glossy gradient background, cel-shaded, high contrast, readable at 32 pixels, centered, fills 90% of the frame, plain solid magenta (#FF00FF) background outside the badge, no text, no watermark
```

| id | სახელი | აღწერა | ბეიჯის ფერი |
|---|---|---|---|
| cleave | Cleave | a curved sword slash in a wide arc | red |
| crit | Precision | an arrow hitting the center of a target | yellow |
| execute | Execute | a skull split by a blade | purple |
| shield | Bulwark | a round shield with a glowing rim | blue |
| taunt | Challenge | a war horn with three shout lines | orange |
| rally | Rally | a fluttering banner on a spear | gold |
| goldtouch | Iron Price | a hand holding a stack of coins | gold |
| heal | Mend | a green heart with a hammer | green |
| poison | Venom | a dripping green vial | toxic green |
| burn | Kindle | a flame on a sword tip | orange-red |
| slowaura | Dread | a frost snowflake over a footprint | ice blue |
| stun | Stagger | three spinning stars over a helmet | yellow |
| multishot | Volley | three arrows fanning out | gold |
| pierce | Pierce | one arrow passing through two silhouettes | pale blue |
| summon | Bannermen | two helmeted soldiers under one banner | brown |
| firestorm | Firestorm (ult) | meteors of fire falling from the sky | orange |
| blizzard | Blizzard (ult) | a snow storm swirl with a snowflake | ice blue |
| assassinate | Valar Morghulis (ult) | a dagger and a face mask | white |
| warcry | War Cry (ult) | a war horn blowing with sound rings | gold |
| fortify | Fortify (ult) | a stone wall with a repair hammer | blue |
| reinforce | Host (ult) | a line of shields | brown |
| wildfire | Wildfire (ult) | a jar of green fire | green |
| kraken | Kraken (ult) | tentacles rising from water | teal |
| linestrike | Charge (ult) | a knight on horseback charging with a lance | gold |
| dragonstrike | Dracarys (ult) | a dragon head breathing fire | red |
| goldrain | Debts Paid (ult) | coins raining from a cloud | gold |
| cloud | Poison Cloud (ult) | a green skull-shaped cloud | green |
| smash | Smash (ult) | a war hammer cracking the ground | brown-gold |
| oath | Oath (ult) | a glowing sword raised with a halo | white-gold |

ულტიმატებს (ult) ბეიჯზე **ოქროსფერი ჩარჩო** გაუკეთე, ჩვეულებრივ სქილებს — მუქი.

---

## 3. ბრძოლის ველის ფონები — 13 სურათი

ფაილები: `bg_01_sunspear.jpg` … `bg_13_castleblack.jpg`, ზომა **1080×1920** (პორტრეტი), JPG. გზას და კოშკების ადგილებს კოდი თვითონ ხატავს ზემოდან, ამიტომ ფონი უნდა იყოს **ღია მიწა გზის გარეშე**.

**შაბლონი (ყველასთვის):**
```
top-down view of a game battlefield for a 2D mobile tower-defense game, portrait 9:16, painted flat style with soft cel shading, [BIOME]. The middle of the image is open ground with no roads, no paths, no buildings and no text; scattered small rocks, bushes and a few trees only near the left and right edges. Along the bottom 15% of the image runs a horizontal wall of [WALL] with battlements, seen from above, with no gate (the gate is added later). Soft even lighting, no strong shadows, muted colors so game units stay readable on top. No characters, no creatures, no UI, no watermark.
```

| # | ფაილი | [BIOME] | [WALL] |
|---|---|---|---|
| 1 | `bg_01_sunspear.jpg` | orange desert sand and red rock outcrops, dry scrub, Dornish palms at the edges, warm sunset light | sandstone blocks |
| 2 | `bg_02_oldtown.jpg` | pale flagstone squares and grey-white city ruins of Oldtown, a tall lighthouse tower far in a corner, sea mist | white stone |
| 3 | `bg_03_highgarden.jpg` | lush green meadows of the Reach with rose bushes and hedgerows, soft golden light | ivy-covered pale stone |
| 4 | `bg_04_stormsend.jpg` | dark wet rock and wind-bent grass on a storm coast, rain streaks, grey-teal palette, lightning far away | black wet stone |
| 5 | `bg_05_kingslanding.jpg` | red-brown city streets and rooftops of King's Landing seen from above, cobblestones, smoke in the distance | red brick and pale stone |
| 6 | `bg_06_dragonstone.jpg` | black volcanic rock and ash, red cracks of heat, a dark sea at one edge, dark grey palette | black dragon-carved stone |
| 7 | `bg_07_harrenhal.jpg` | scorched ground and melted black ruins of Harrenhal, ash drifting, dull orange embers | half-melted black stone |
| 8 | `bg_08_casterlyrock.jpg` | grey mountain plateau with gold-veined rock, sparse pines, cold bright light | grey granite with gold trim |
| 9 | `bg_09_eyrie.jpg` | high mountain pass with snow patches, blue-white peaks, thin cold air, a blizzard haze | white mountain stone |
| 10 | `bg_10_twins.jpg` | green-grey river country in autumn, shallow streams at both edges, reeds and willows | grey river-stone |
| 11 | `bg_11_moatcailin.jpg` | dark bog and black water pools of the Neck, dead trees, green mist | mossy black basalt |
| 12 | `bg_12_winterfell.jpg` | a snowy northern forest clearing with dark pines and a grey sky, faint hot-spring steam | dark grey Winterfell stone with snow |
| 13 | `bg_13_castleblack.jpg` | a frozen plain at night beyond the Wall, blue-white snow, black sky with aurora, dead trees | ice blocks 700 feet high |

ჯერ **`bg_01_sunspear.jpg`** გამომიგზავნე — თუ ხედის კუთხე სწორია (მიწა ზემოდან, კედელი ქვევით), დანარჩენ 12-ს იმავე სურათს რეფერენსად მიაბამ.

---

## 4. სად რა მიბმა

| რა | კოდში | რას ცვლის |
|---|---|---|
| ყუთები | `CHEST_ART.wood`, `CHEST_ART.wood_open` … | Shop-ის ბარათები, Battle-ის ვარსკვლავების ყუთი, ცერემონია (დახურული → ღია) |
| სქილები | `SKILL_ART.cleave` … | გმირის ბარათები Collection-ში, Hero room-ის სქილების სია, ცერემონიის ბარათები |
| ფონები | `BG_ART[levelId]` (დაემატება) | ბრძოლის ველი ტურის მიხედვით; გზა/სლოტები ზემოდან იხატება |
