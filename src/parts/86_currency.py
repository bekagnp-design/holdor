# v1.0.83 — the currencies redrawn: a gold dragon coin, an obsidian dragonglass shard; the 💎 / 🪙 emoji in texts become the drawings.
import re
i = s.find("/* =========================== THE BOOK (v1.0.50)"); assert i > 0, 'book anchor'
s = s[:i] + mod('currency.js').rstrip('\n') + '\n' + s[i:]
hub, n1 = re.subn(r"const GOLD_SVG='[^\n]*';", "const GOLD_SVG=CUR_GOLD;", hub); assert n1 == 1, 'gold svg'
hub, n2 = re.subn(r"const GEM_SVG='[^\n]*';", "const GEM_SVG=CUR_GEM;", hub); assert n2 == 1, 'gem svg'
rep("\n</style>\n</head>", """
/* v1.0.83: the currencies */
.cic{display:inline-block;width:1.05em;height:1.05em;vertical-align:-.18em;margin:0 .05em}.cic svg{width:100%;height:100%;display:block;filter:drop-shadow(0 1px 0 rgba(0,0,0,.45))}
</style>
</head>""", 1, 'currency-css')
