# ---- v1.0.48: the realm button shows the realm's flag; the title art reaches further down on tall screens ----
rep("<span class=\"e\">${LANGS[sel.j].f==='🌍'?'🌍':'🏳️'}</span> Fight for ${sel.c}", "<span class=\"e\">${flag(sel.c,20)}</span> Fight for ${sel.c}", 1, 'realm-flag')
rep(".hasbg .bgimg{object-fit:cover;object-position:50% 6%;height:74%;top:0;bottom:auto}", ".hasbg .bgimg{object-fit:cover;object-position:50% 6%;height:84%;top:0;bottom:auto}", 1, 'title-h')
rep(".hasbg .veil{background:linear-gradient(180deg,rgba(6,11,20,.28) 0%,rgba(6,11,20,0) 22%,rgba(6,11,20,0) 52%,rgba(6,11,20,.55) 68%,rgba(6,11,20,.97) 78%)}",
    ".hasbg .veil{background:linear-gradient(180deg,rgba(6,11,20,.28) 0%,rgba(6,11,20,0) 22%,rgba(6,11,20,0) 60%,rgba(6,11,20,.55) 76%,rgba(6,11,20,.97) 86%)}", 1, 'title-veil')
