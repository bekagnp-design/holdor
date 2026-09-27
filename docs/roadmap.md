# HOLDOR — ვერსიების გეგმა

2026-09-27 (მეხუთე რედაქცია — v1.0.54-ის შემდეგ; repo-ს ასლი). ერთი ვერსია = ერთი თემა; ყოველი ვერსია ცალკე ტესტდება. **წესი:** ყოველი პასუხის ბოლოს — „შემდეგი ნაბიჯი“ და ერთი განვითარების იდეა.

## გაკეთებული
| ვერსია | თემა | რას შეიცავს |
|---|---|---|
| **v1.0.48** ✅ | ბარათები + მოკლე ტური | CR-ის ბარათები, ანგარიშის დონე მხოლოდ აფგრეიდებიდან + ყუთი ყოველ დონეზე, 5 მოკლე ტური. |
| **v1.0.49** ✅ | ლიდერბორდი სავარძლების მიხედვით (backend v3) | სავარძელი = ცალკე დამცველი (`tg_id + seat`), „B K II“. **შენგან:** `backend/holdor_v3.sql` Supabase-ში — ნებისმიერ რელიზამდე ≥ v1.0.49. |
| **v1.0.50** ✅ | წიგნი + რანკები | KR-ის სტილის ენციკლოპედია, თამაშთან ერთად ივსება; რანკი Iron → Challenger ტროფეებით. |
| **v1.0.51** ✅ | ციხე: Train + Spell shop | ჯარის დონე 1–10 + სახლის ერთეული; ერთჯერადი ნივთები 🎒-ით, ერთი ბრძოლაზე. |
| **v1.0.52** ✅ | ჩემპიონები I: რიგი + Stark/Targaryen | გახსნის ახალი რიგი, 9 სქილი + 10 ულტიმატი, ranged −20%. |
| **v1.0.53** ✅ | ჩემპიონები II: Lannister/Baratheon | 13 სქილი + 7 ულტიმატი; სიგნატურები Host/Smash/Debts Paid/Firestorm/Wildfire/Fortify/War Cry. |
| **v1.0.54** ✅ | ჩემპიონები III: Greyjoy/Tyrell | 11 ახალი სქილი + 12 ახალი ულტიმატი; სიგნატურები Kraken → Euron, Charge → Loras. 42/49 ჩემპიონი უნიკალურია. დევს `beta/index.html`-ში. |

GitHub Pages-ის root (`index.html`, რასაც Telegram ხსნის) ამჟამად **v1.0.48**-ია (ხელით ატვირთული) — პირველ რელიზამდე.

## ჩემპიონების რიგი (ცოცხალია v1.0.52-დან)
- **Stark:** Brienne → Robb → Bran → Sansa → Ned → Arya → **Jon**
- **Lannister:** Kevan → Bronn → The Mountain → Tywin → Jaime → Cersei → **Tyrion**
- **Baratheon:** Gendry → Barristan → Davos → Renly → Melisandre → Robert → **Stannis**
- **Targaryen:** Viserys → Missandei → Daario → Grey Worm → Jorah → Drogo → **Daenerys**
- **Greyjoy:** Rodrik → Aeron → Balon → Victarion → Yara → Euron → **Theon**
- **Tyrell:** Garlan → Randyll → Mace → Loras → Olenna → Sam → **Margaery**
- **Martell:** Areo → Nymeria → Obara → Tyene → Doran → Ellaria → **Oberyn**

## შემდეგი ვერსიები (რიგით)
| ვერსია | თემა | რას შეიცავს | შენგან |
|---|---|---|---|
| **v1.0.55** | ჩემპიონები IV (Martell) + ბალანსი | ბოლო 7 უნიკალური კომპლექტი (Poison Cloud → Ellaria; Oberyn — „Say her name“ დუელი, Areo — Longaxe, Doran — Patience, Obara — Spear, Nymeria — Whip, Tyene — Poisoned Blade); ბოტით (`src/tools/bot45.js`, `tune45.js`) 50 ეტაპის ხელახალი ბალანსი 49-ივე კომპლექტით; ტალანტების ხე 3 საფეხურით (5/10/15). | — |
| **v1.0.56** | Duel I (Events-ის ბარათი): ვარჯიში AI-სთან | Events ტაბში ბარათი „Duel“ Daily Hold-ის გვერდით; ინტერვიუს წესები (`docs/pvp-interview.md`, Q1–Q28 + Q29–Q32); Train-ის ჯარი მოწინააღმდეგეს ეგზავნება; მინი-რუკა. | Q29–Q32; 10 ერთეულის სპრაიტი (სურვილისამებრ). |
| **v1.0.57** | Duel II: real-time მეგობართან | Telegram ლინკით გამოწვევა, Supabase Realtime, გაწყვეტაზე AI. | SQL ერთხელ; ტესტი ძმასთან. |
| **v1.0.58** | Duel III: ჯილდო + რანკი | ყუთი მოგებაზე (≤3 დღეში), ურთიერთი ანგარიში, Duel-ის ტროფეები რანკში (±), Duel-ის ლიდერბორდი Events-ში. | SQL ერთხელ. |

## არტი და ვიდეო — ცალკე ვერსია არ სჭირდება
- 7 სახლის დახატული კუნძული, 4 event ბანერი, ყუთების 8 სურათი, სქილის აიქონები (30 ძველი + ~60 ახალი მექანიკისთვის — პრომპტები v1.0.55-ის შემდეგ ერთად), ბრძოლის ველების image kit (Dorne ჯერ) — `docs/prompts-v44.md`, `docs/prompts-v45.md`.
- სახლების ვიდეოები: Veo პრომპტების v3 ჩემპიონების ახალი რიგით — v1.0.55-ის შემდეგ.
- Duel-ის ერთეულების სპრაიტები (10) — v1.0.56-მდე.

## იდეები (დასამტკიცებელი)
- **სახლის პასიური:** ყოველ სახლს ერთი მუდმივი თვისება ბრძოლაში (მაგ. Lannister +10% ოქრო მოკვლიდან; Stark +1 ძმა Brothers-ში; Targaryen Dracarys-ის cooldown −15%).
- წიგნში „Strategy“ ლენტი: ეტაპის რჩევა, რომელიც ეტაპის დაკარგვის შემდეგ იხსნება.
- ჩემპიონების სინერგია ორ სავარძელს შორის ან მეგობართან Duel-ში (Renly + Margaery Charm, Robb + Jon Frostbite).
- Telegram-ში ცალკე beta Mini App (`…/holdor/beta/`), რომ beta-ც ნამდვილი Telegram-ის შესვლით შემოწმდეს.

## მოგვიანებით / სურვილისამებრ
- Hold-ის სეზონები (14 დღე); ბოტის შეტყობინებები (`pg_cron` + `pg_net`); Duel matchmaking; სახლების ომი; Achievements; De-branding სტორამდე.

## წესები
- ყოველი ვერსია: `python3 src/build.py` → `node tests/run_core.js` (ყველა OK) → PR (მხოლოდ `src/`, `tests/`, `docs/`, `beta/`) → შენ merge → `https://bekagnp-design.github.io/holdor/beta/`-ზე ამოწმებ → შენი „release“ → ცალკე PR: `beta/index.html` → `index.html` → merge → Telegram.
- ხელით ნაბიჯები სათითაოდ; SQL — კლიენტამდე, რომელსაც ის სჭირდება. სტატისტიკა მხოლოდ სერვერიდან. KR Battles მხოლოდ მექანიკის რეფერენსია. PvP = Events-ის ივენთი.
- ყოველი პასუხის ბოლოს — „შემდეგი ნაბიჯი“ + განვითარების იდეა.
