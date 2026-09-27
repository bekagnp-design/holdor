# HOLDOR — პრომპტები v1.0.45: რუკების ნაკრები (50 ეტაპი)

## როგორ მუშაობს

ყოველ რეგიონს სჭირდება **2 სურათი**:

1. **მიწა** — რეგიონის ნიადაგი ზემოდან. გზის, ხეების, წყლის და შენობების **გარეშე** — მხოლოდ ნიადაგი.
2. **ობიექტების ფურცელი** — 9 ცალკე ობიექტი, 3×3 ბადეზე, მაჯენტა ფონზე (ხეები, ქვები, კარვები…).

დანარჩენს კოდი აკეთებს: გზას ხატავს ნიადაგზე, ზღვას/მდინარეს/ხიდებს ამატებს, კოშკების ადგილებს ათავსებს და ობიექტებს ყოველ ეტაპზე სხვანაირად ალაგებს. ასე 15 ნაკრებიდან 50 განსხვავებული რუკა გამოდის. სანამ სურათები არ მოვა, თამაში უკვე ახალ, კოდით დახატულ რუკებს იყენებს — სურათი მხოლოდ ანაცვლებს მათ.

**თანმიმდევრობა:** ერთ ჯერზე ერთი რეგიონი. დაიწყე **დორნით (#1)** — ორივე სურათი გამომიგზავნე, ჩავსვამ, გაჩვენებ და მხოლოდ მერე გადავიდეთ შემდეგზე. მომდევნო რეგიონებში პირველი მიღებული სურათი რეფერენსად მიაბი, რომ სტილი ერთნაირი დარჩეს.

**ფაილის სახელები:** `ground_<biome>.jpg` და `props_<biome>.png` (biome — ქვემოთ ცხრილში, მაგ. `ground_desert.jpg`, `props_desert.png`).

---

## 1. მიწა — სტილის ბლოკი (ყველასთვის ერთი)

ზომა **1080×1920** (პორტრეტი 9:16), JPG.

```
top-down view of natural terrain for a 2D mobile tower-defense battlefield, hand-painted in the style of Kingdom Rush, soft cel shading, portrait 9:16, evenly lit from the top left. The whole image is open ground only: no roads, no paths, no buildings, no trees, no bushes taller than grass, no rocks bigger than pebbles, no water, no characters, no text, no UI, no border, no vignette. Gentle large patches of lighter and darker ground and small details (grass tufts, pebbles, cracks, tiny flowers) spread evenly over the whole image. Muted mid-tone colours so small game units stay readable on top. [TERRAIN]
```

`[TERRAIN]`-ის ნაცვლად ჩასვი რეგიონის აღწერა ცხრილიდან (მე-3 ნაწილი).

## 2. ობიექტების ფურცელი — სტილის ბლოკი (ყველასთვის ერთი)

ზომა **1536×1536**, PNG, ფონი **მაჯენტა #FF00FF**.

```
sprite sheet of 9 separate game props arranged in a 3 by 3 grid, each prop centered in its own square cell with plenty of empty space around it, all props at the same scale, seen from a 3/4 top-down angle like Kingdom Rush, cartoon cel-shaded, thick dark outline, bright readable colours, flat solid magenta (#FF00FF) background everywhere, no ground under the props, no shadows, no text, no grid lines, no border. Props, left to right, top to bottom: [PROPS]
```

`[PROPS]`-ის ნაცვლად ჩასვი რეგიონის 9 ობიექტი **ზუსტად ამ თანმიმდევრობით** — კოდი უჯრის ნომრით ცნობს რა არის რა.

---

## 3. რეგიონები (კამპანიის რიგით)

### #1 დორნი — `desert` — ეტაპები 1–7
- **[TERRAIN]:** `warm orange desert sand with soft ripples, patches of red-brown hard ground and dry cracked earth, sparse tiny dry grass`
- **[PROPS]:** `1 a tall palm tree, 2 a second palm tree leaning the other way, 3 a dry thorny shrub, 4 a big sandstone boulder, 5 a cluster of small desert rocks, 6 a broken sandstone pillar ruin, 7 bleached bones with a skull, 8 an orange and red striped Dornish tent, 9 a dead twisted desert tree`

### #2 ზღვისპირა — `coast` — ეტაპები 8, 20, 30 (The Arbor, Maidenpool, Seagard)
- **[TERRAIN]:** `sandy coastal meadow, light sand mixed with short green grass, a few seashells and pebbles`
- **[PROPS]:** `1 a small palm tree, 2 a round green bush, 3 a grey coastal rock, 4 a large boulder, 5 a piece of driftwood, 6 a patch of wildflowers, 7 a clump of reeds, 8 a short wooden fence with grapevines, 9 a small oak tree`

### #3 ქალაქი — `city` — ეტაპები 9, 18, 24 (Oldtown, King's Landing, Lannisport)
- **[TERRAIN]:** `city outskirts: worn grass with patches of pale paving stones and packed earth, a few scattered straw bits`
- **[PROPS]:** `1 a small medieval house with a red tile roof, 2 a house with a brown shingle roof, 3 a stone house with a blue slate roof, 4 a broken stone column ruin, 5 a stack of wooden crates, 6 a group of barrels, 7 a stone well with a little roof, 8 a stone statue of a knight on a plinth, 9 a round trimmed bush`

### #4 რიჩი — `reach` — ეტაპები 10–13 (Uplands, Highgarden, Old Oak, Cider Hall)
- **[TERRAIN]:** `lush bright green meadow of the Reach, soft grass with many tiny pink, yellow and white flowers`
- **[PROPS]:** `1 a big round oak tree, 2 a second oak tree, 3 a round green bush, 4 a patch of wildflowers, 5 a rose bush with red roses, 6 a golden haystack, 7 a short wooden fence, 8 a mossy rock, 9 a wooden barrel`

### #5 მდინარის მიწები — `river` — ეტაპები 14, 22, 27, 31, 32 (Tumbleton, Stoney Sept, Riverrun, The Twins, Saltpans)
- **[TERRAIN]:** `green river country, soft grass with darker damp patches and small mud spots, clover`
- **[PROPS]:** `1 a weeping willow tree, 2 an oak tree, 3 a round bush, 4 a clump of tall reeds, 5 a few lily pads, 6 a smooth river rock, 7 a patch of wildflowers, 8 a haystack, 9 a wooden fence`

### #6 სტორმლენდი — `storm` — ეტაპები 15, 16 (Stonehelm, Storm's End)
- **[TERRAIN]:** `wet windswept heath, dark green-grey grass bent by the wind, dark wet soil patches, small puddles as dark spots`
- **[PROPS]:** `1 a tree bent by strong wind, 2 a second wind-bent tree, 3 a dark wet boulder, 4 a grey rock, 5 a ring of standing stones, 6 a purple heather bush, 7 a clump of reeds, 8 a dead tree, 9 a mossy rock`

### #7 მეფის ტყე — `forest` — ეტაპი 17 (The Kingswood)
- **[TERRAIN]:** `forest floor in dappled light, green moss and grass, fallen leaves, small ferns`
- **[PROPS]:** `1 a big oak tree, 2 a second oak tree, 3 a tall pine tree, 4 a second pine tree, 5 a birch tree, 6 a fern bush, 7 a fallen log, 8 a group of red mushrooms, 9 a mossy rock`

### #8 დამწვარი მიწა — `ash` — ეტაპები 19, 21 (Dragonstone, Harrenhal)
- **[TERRAIN]:** `scorched black and grey volcanic ground covered in ash, thin glowing orange cracks here and there`
- **[PROPS]:** `1 a burnt black tree, 2 a second burnt tree, 3 a black lava rock with glowing orange cracks, 4 a second lava rock, 5 a charred stone ruin, 6 scattered bones, 7 a dark rock, 8 a dead tree, 9 a big dark boulder`

### #9 ვესტერლენდი — `mountain` — ეტაპები 23, 25, 26, 28 (Clegane's Keep, Casterly Rock, The Golden Tooth, Ashemark)
- **[TERRAIN]:** `golden-olive hills, dry yellow-green grass with grey rocky patches and gravel`
- **[PROPS]:** `1 a big grey boulder with golden veins, 2 a second boulder, 3 a cluster of rocks, 4 a pine tree, 5 a second pine tree, 6 a rock with grass on it, 7 a single standing stone, 8 a yellow-green bush, 9 a dead tree`

### #10 რკინის კუნძულები — `sea` — ეტაპები 29, 35 (Pyke, Gulltown)
- **[TERRAIN]:** `grey rocky island ground, dark gravel, wet slate stones, patches of short grey-green grass`
- **[PROPS]:** `1 a jagged sea rock, 2 a second sea rock, 3 a boulder with barnacles, 4 a second boulder, 5 a piece of driftwood, 6 a wrecked longship hull, 7 a ring of standing stones, 8 a grey coastal bush, 9 a clump of sea grass`

### #11 ველი (მთები) — `vale` — ეტაპები 33, 34, 36, 37 (The High Road, The Eyrie, Heart's Home, The Grey Glen)
- **[TERRAIN]:** `high cold mountain pass, grey rock ground with patches of snow and short frozen grass`
- **[PROPS]:** `1 a pine tree with snow on the branches, 2 a second snowy pine, 3 a grey boulder with a snow cap, 4 a boulder, 5 a rock, 6 a second snow-capped rock, 7 a ring of standing stones, 8 a dead tree, 9 a fallen log`

### #12 ნეკი (ჭაობი) — `swamp` — ეტაპი 38 (Moat Cailin)
- **[TERRAIN]:** `dark green swamp ground, wet moss, black mud patches, small dark puddles, green mist faintly on the ground`
- **[PROPS]:** `1 a dead swamp tree, 2 a second dead tree, 3 a clump of reeds, 4 a second clump of reeds, 5 a rotting fallen log, 6 a few lily pads, 7 a group of pale mushrooms, 8 a murky green bush, 9 mossy stones`

### #13 თეთრი ნავსადგური — `northcity` — ეტაპი 39 (White Harbor)
- **[TERRAIN]:** `snowy town outskirts, grey paving stones half covered by snow, packed snow`
- **[PROPS]:** `1 a grey stone house with a snowy roof, 2 a second house with a snowy roof, 3 a third, smaller house with a snowy roof, 4 a stack of crates with snow, 5 barrels with snow, 6 a stone well with snow, 7 a snow-capped rock, 8 a snowy pine tree, 9 a merman statue on a plinth`

### #14 ჩრდილოეთი — `snow` — ეტაპები 40–46 (Barrowton … The Gift)
- **[TERRAIN]:** `bright snowy plain of the North, soft white snow with pale blue shadows and drifts, a few frozen grass tips`
- **[PROPS]:** `1 a snowy pine tree, 2 a second snowy pine, 3 a snow-capped rock, 4 a second snow-capped rock, 5 a dead tree with snow, 6 a ring of standing stones with snow, 7 a fur tent, 8 a campfire, 9 a snowy fallen log`

### #15 კედელი და მის იქით — `wall` — ეტაპები 47–50 (Castle Black … The Lands of Always Winter)
- **[TERRAIN]:** `frozen plain beyond the Wall, blue-white ice and deep snow, wind-carved drifts, a faint blue night light`
- **[PROPS]:** `1 a cluster of sharp ice spikes, 2 a second ice cluster, 3 a snowy pine tree, 4 a snow-capped boulder, 5 a second snow-capped boulder, 6 a frozen dead tree, 7 frozen bones and a skull, 8 a ring of standing stones in ice, 9 a snowy fallen log`

---

## 4. სურვილისამებრ

- **ძმები (Brothers):** ახლა კოდით დახატული შავი მოსასხამიანი მეომრები არიან, ხმლით და ფარით, და გზაზე იბრძვიან. თუ სურათით გინდა — `sworn_brother.png`, 3 კადრი ერთ ზოლში (idle, walk, attack), იგივე სტილით როგორც ჩემპიონები, მაჯენტა ფონზე.
- **ყუთები:** კოდში უკვე ახლიდან დავხატე (4 ხარისხი × დახურული/ღია). თუ სურათით გინდა, v44-ის პრომპტები (`chest_wood.png` …) ისევ მოქმედებს — ჩავსვამ და კოდის ნახატს ჩაანაცვლებს.
