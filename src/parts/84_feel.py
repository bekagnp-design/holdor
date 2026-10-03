# v1.0.81 — feel: Telegram haptics on taps and rewards, and big kills that land (hit-stop, shake, flash, ring). src/mod/haptics.js.
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('haptics.js').rstrip('\n') + '\n' + s[i:]
rep("corpseFx(e,q);", "corpseFx(e,q);feelKill(e,q);", 1, 'feel-kill')
