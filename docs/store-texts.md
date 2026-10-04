# HOLDOR — მზა ტექსტები (ბოტი, არხები, X, პირველი პოსტები)

ყველა ტექსტი გამზადებულია ჩასასმელად. **რიცხვები ნამდვილია:** 50 ეტაპი, 49 ჩემპიონი, 224 ნივთი — თამაშის მონაცემიდან. ჩატი, ქვეყნების ომი და ახალი ნივთები **მხოლოდ release-ის შემდეგ** არსებობს Telegram-ში: სანამ release არ არის, ამ პუნქტებიანი ტექსტები არ გამოაქვეყნო.
სავაჭრო ნიშნების წესი (იხ. `docs/marketing-plan.md` §2): არ ვწერთ GoT / HBO / Westeros / Hodor / პერსონაჟების სახელებს.
ფაილები: `docs/marketing/bot_banner_640x360.png` (ბოტის სურათი), `avatar_640.png` (ავატარი ყველგან), `x_header_1500x500.png` (X-ის ჰედერი), `bot_banner_1280x720.png` (დიდი ვერსია პოსტებისთვის).

## 1. BotFather (შენს ჩატში BotFather-თან; ტოკენს არავის უგზავნი)
| ბრძანება | რა ჩასვა |
|---|---|
| `/setname` | `HOLDOR — Hold the Door` |
| `/setabouttext` (≤120) | `Free tower defense in Telegram. Build towers, lead your champion, hold the door against the dead.` (97) |
| `/setdescription` (≤512) | იხ. §1.1 (EN, 307) — ან §1.2 (KA, 300) |
| `/setdescriptionpic` | ატვირთე `bot_banner_640x360.png` (ზუსტად 640×360) |
| `/setuserpic` | ატვირთე `avatar_640.png` |
| `/setmenubutton` | ღილაკის ტექსტი: `▶ Play free` · URL: `https://bekagnp-design.github.io/holdor/` (ისევე, როგორც ახლა გაქვს) |
| `/setcommands` | **მხოლოდ ბოტის /start მისალმების (ავტო 1) გაშვების შემდეგ:** `start - Start playing` · `play - Open the game` |
`card_1280x720.png` / `card_640x360.png` — ბმულის ბარათი (BotFather → Mini Apps → Direct Link → Set Photo or GIF), ნამდვილი კადრებით v1.0.96-დან; თავიდან აიგება `docs/marketing/tools/make_card.js` + `compose_card.js`-ით.
ბოტის ენის მიხედვით აღწერა: BotFather-ში ყოველ ენაზე ცალკე (`/setdescription` → აირჩიე ენა). ქართულისთვის — §1.2.

### 1.1 Description (EN, ≤512)
```
HOLDOR — Hold the Door ❄️

The dead are at the gate. You are the last wall.

⚔️ Build towers and lead a champion into battle
🏰 50 stages, a daily Hold challenge, weekly realm wars
🎁 Chests, gear and 49 champions to collect
🌍 Fight for your country against players worldwide

Free to play. Tap PLAY to start.
```
### 1.2 Description (KA, ≤512)
```
HOLDOR — დაიცავი კარი ❄️

მკვდრები კართან არიან. შენ ბოლო კედელი ხარ.

⚔️ ააშენე კოშკები და ჩემპიონს ბრძოლაში უხელმძღვანელე
🏰 50 ეტაპი, ყოველდღიური Hold და კვირის ომი ქვეყნებს შორის
🎁 ყუთები, აღჭურვილობა და 49 ჩემპიონი
🌍 იბრძოლე შენი ქვეყნისთვის მსოფლიოს მოთამაშეებთან

თამაში უფასოა. დააჭირე PLAY-ს.
```
**About (KA, ≤120):** `უფასო tower defense Telegram-ში. ააშენე კოშკები, ჩაუდექი სათავეში შენს ჩემპიონს და დაიცავი კარი მკვდრებისგან.` (109)

### 1.3 /start მისალმება (ბოტის კოდი, `[ავტო 1]`; ახლა ბოტს ამ ბრძანებაზე პასუხი არ აქვს)
EN (174):
```
🚪 Welcome, defender!

The dead are at the gate and you are the last wall. Build towers, lead your champion, and hold the door.

Tap PLAY — the first battle takes two minutes.
```
KA:
```
🚪 კეთილი იყოს შენი მობრძანება, დამცველო!

მკვდრები კართან არიან და შენ ბოლო კედელი ხარ. ააშენე კოშკები, უხელმძღვანელე ჩემპიონს და დაიცავი კარი.

დააჭირე PLAY-ს — პირველი ბრძოლა ორ წუთს გრძელდება.
```
(მისალმებას ახლავს სურათი `bot_banner_1280x720.png` და ღილაკი „▶ Play free“, რომელიც წყაროს კოდს გადასცემს.)

## 2. Telegram არხები
| | EN | KA |
|---|---|---|
| სახელი | `HOLDOR News` | `HOLDOR · ქართული` |
| აღწერა (≤255) | `Daily Hold top-10, weekly realm war results, updates and tips for HOLDOR — the free tower defense in Telegram. Play: t.me/HoldorTDBot/play` (138) | `HOLDOR-ის სიახლეები: დღის Hold-ის ტოპ-10, ქვეყნების კვირის ომის შედეგები, რჩევები. თამაში უფასოა: t.me/HoldorTDBot/play` (119) |
| ავატარი | `avatar_640.png` | იგივე |
**გაწერილი ბმული არხში:** `https://t.me/HoldorTDBot/play?startapp=s_tg` (EN) და `…?startapp=s_ka` (KA).
**პირველი (დამაგრებული) პოსტი:** §5.1.

## 3. X (Twitter)
- **სახელი:** `HOLDOR · Hold the Door` · **ავატარი:** `avatar_640.png` · **ჰედერი:** `x_header_1500x500.png`
- **ბიო (≤160, 95):** `Free tower defense inside Telegram. Hold the door against the dead. 🚪❄️ New: weekly realm wars.`
- **ბმული ბიოში:** `https://t.me/HoldorTDBot/play?startapp=s_x`
- **ლოკაცია:** `Telegram` (ან ცარიელი)
- **ჰეშტეგები (მხოლოდ ესენი):** `#towerdefense #telegramgames #miniapp #indiegame #gamedev` (არა #GameOfThrones და მსგავსი)

## 4. YouTube / TikTok / Instagram
- **სახელი:** `HOLDOR` · **handle:** `@playholdor` · **ბიო:** `Free tower defense in Telegram. Hold the door against the dead. ❄️ Link ↓`
- **ბმული:** `https://t.me/HoldorTDBot/play?startapp=s_yt1` (YouTube), `s_tt` (TikTok), `s_ig` (Instagram)
- **კლიპის სტრუქტურა (15–25 წმ):** 0–2 წმ: ჰუკი ტიტრით („Can you hold the door?“); 2–18 წმ: ბრძოლა ან ჭედვა; 18–25 წმ: „Free in Telegram — link in bio“.

## 5. პირველი პოსტები (დრაფტი; გადაიკითხე შენი ხმით)
**ჩასვი `[ ]` ადგილებში რეალური რიცხვი ბაზიდან, ან წაშალე ის წინადადება — არაფერი გამოვიგონოთ.**

### 5.1 EN
1. **დამაგრებული / გაშვება:** `HOLDOR is live: a free tower defense inside Telegram. The dead are at the gate. Build towers, lead a champion, hold the door. ▶ t.me/HoldorTDBot/play?startapp=s_x`
2. **კლიპი:** `The last 10 seconds of a run. Would you hold? 🚪❄️ #towerdefense #telegramgames` + 15–25 წმ კლიპი
3. **ნივთები:** `224 item kinds, each with its own drawing, forged with a hammer. Which one is your Legendary? ⚒️` + `item.png`
4. **ქვეყნების ომი:** `Every week your country fights. Score = the average weekly Hold waves of its top 50 players + a bonus for players active 3+ days — so a small country can beat a big one.` + `docs/marketing/shots` ან ომის ეკრანი
5. **რჩევა:** `Tip: [ერთი რჩევა, რომელიც შენ თვითონ გამოცადე თამაშში].` (გამოგონილ რჩევას ნუ დაწერ — მხოლოდ ისეთს, რომელიც გამართლდა)
6. **გახსნილი დეველოპმენტი:** `We build HOLDOR in the open: new version every few days. This week: a forge scene with a real hammer.` + ჭედვის კლიპი
7. **კითხვა:** `Which should we build next: private chat with friends, or more champions? 👇`
8. **სკივრი:** `Chests can climb a tier: tap for luck, and a wooden chest may open as a Dragon chest. 🎁` + სკივრის კლიპი
9. **ტოპ-10 შაბლონი:** `Today's Hold top-10 ⚔️ 1. [name] [waves] 2. … Can you beat it? ▶ t.me/HoldorTDBot/play?startapp=s_x` (მონაცემი: `leaderboard.today`)
10. **ომის შედეგის შაბლონი:** `This week's realm war: [country] wins with [score] points ([players] players). Next week starts Monday. 🏆` (მონაცემი: `realm_war`)

### 5.2 KA
1. `HOLDOR უკვე თამაშდება: უფასო tower defense Telegram-ში. მკვდრები კართან არიან. ააშენე კოშკები, უხელმძღვანელე ჩემპიონს და დაიცავი კარი. ▶ t.me/HoldorTDBot/play?startapp=s_ka`
2. `ბრძოლის ბოლო 10 წამი. შენ გაუძლებდი? 🚪❄️` + კლიპი
3. `224 სახეობის ნივთი — თითოს თავისი ნახატი აქვს და ჩაქუჩით იჭედება. რომელია შენი Legendary? ⚒️`
4. `ყოველ კვირას შენი ქვეყანა იბრძვის. ქულა = ტოპ-50 მოთამაშის საშუალო Hold-ის ტალღები + ბონუსი მათთვის, ვინც 3+ დღე ითამაშა. პატარა ქვეყანაც შეიძლება დიდს აჯობოს.`
5. `რას დავამატოთ შემდეგ: მეგობრებთან პირადი ჩატი თუ მეტი ჩემპიონი? 👇`

## 6. პასუხები ხშირ კითხვებზე (არხის კომენტარებში)
- **„უფასოა?“** — დიახ. ყიდვა ნებაყოფლობითია და ძალას PvP-ში არ ყიდის.
- **„რა სახელია?“** — HOLDOR. (სახელის შესახებ იურისტის პასუხამდე სხვას ნუ დაწერ.)
- **„ტელეფონზე სად ვითამაშო?“** — Telegram-ში ბოტის ღილაკი ▶ Play; ბმული: `t.me/HoldorTDBot/play`.
- **„ფულს ვიღებ თამაშით?“** — არა; HOLDOR Coin არ არის გაყიდვაში, დაპირებას ნუ დაწერ.
