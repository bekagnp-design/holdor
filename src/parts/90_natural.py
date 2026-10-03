# v1.0.87 — natural items: the drawings get real materials (src/mod/gearart.js: ridged blades, grained wood, leather, bone, dyed cloth,
# cut gems, grit and a soft bevel through one shared filter, other metals and poses for sibling kinds), and the slot they sit in is a
# dark worn-leather well with the rarity on its rim instead of a glossy blue tile.
rep("\n</style>\n</head>", """
/* v1.0.87: natural item slots */
.gic{background:radial-gradient(circle at 50% 38%,#40362c,#1c1612 70%,#120e0b);box-shadow:inset 0 2px 5px rgba(0,0,0,.75),inset 0 -1px 0 rgba(255,235,200,.06),0 1px 0 rgba(0,0,0,.4);border-color:color-mix(in srgb,var(--gc,#5a6c85) 80%,#3a2c20)}
.gic svg{width:86%;height:86%;filter:drop-shadow(0 2px 1.5px rgba(0,0,0,.65))}
.gic.r3::after,.gic.r4::after{background:linear-gradient(115deg,transparent 44%,rgba(255,240,210,.16) 50%,transparent 56%);animation-duration:5s}
.gic.r4{box-shadow:inset 0 2px 5px rgba(0,0,0,.75),0 0 9px rgba(230,180,90,.35)}
</style>
</head>""", 1, 'natural-css')
