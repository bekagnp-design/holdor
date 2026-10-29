# v1.2.6 — the champion learns skills in battle. src/mod/learn126.js
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('learn126.js').rstrip('\n') + '\n' + s[i:]
rep("  if(boonCheck())return;   /* v1.0.80: a blessing first; the wave starts when one is chosen */", "  if(boonCheck()||learnCheck())return;   /* v1.0.80: a blessing first; v1.2.6: a skill to learn; the wave starts when one is chosen */", 1, 'learn-hook')
