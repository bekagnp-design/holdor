# v1.1.3 — films: short thriller scenes drawn by the engine (src/mod/film.js + film.css) and their sounds.
i = s.find('window.HOLDOR={'); assert i > 0, 'exports anchor'
s = s[:i] + mod('film.js').rstrip('\n') + '\n' + s[i:]
rep("\n</style>\n</head>", "\n" + mod('film.css').rstrip('\n') + "\n</style>\n</head>", 1, 'film-css')
# the film sounds, in the same synth as the rest of the game
rep("    tick:()=>tone({f:1000,type:'square',d:0.03,vol:0.05,lp:3000}),",
    "    tick:()=>tone({f:1000,type:'square',d:0.03,vol:0.05,lp:3000}),\n"
    "    f_wind:()=>{noise({d:2.6,f:260,f2:900,q:0.4,vol:0.10,a:0.9,verb:0.4});},\n"
    "    f_drone:()=>{[55,55.7,82.4].forEach((f,i)=>tone({f,type:'sawtooth',a:1.4,d:2.6,vol:0.05-i*0.01,lp:420,verb:0.5}));},\n"
    "    f_heartbeat:()=>{boom(0,0.34,52);boom(0.17,0.26,48);},\n"
    "    f_thud:()=>{boom(0,0.42,60);noise({d:0.25,f:300,f2:90,type:'lowpass',vol:0.3});},\n"
    "    f_knock3:()=>{knock(0,0.38);knock(0.34,0.4);knock(0.68,0.46);},\n"
    "    f_sting:()=>{[196,277,392,554].forEach((f,i)=>tone({f,f2:f*1.04,type:'sawtooth',a:0.02,d:1.2,vol:0.07,lp:2600,verb:0.55,detune:i*7}));noise({d:0.9,f:2400,f2:6000,q:0.5,vol:0.07,verb:0.5});boom(0,0.3,46);},\n"
    "    f_whisper:()=>{noise({d:1.5,f:3200,f2:5200,q:3,vol:0.06,a:0.5,verb:0.7});noise({d:1.2,f:2100,f2:2900,q:4,vol:0.04,a:0.4,at:0.25,verb:0.7});},\n"
    "    f_thunder:()=>{noise({d:2.2,f:200,f2:60,type:'lowpass',vol:0.38,a:0.05,verb:0.6});boom(0.1,0.34,40);},\n"
    "    f_crow:()=>{[0,0.28].forEach(a=>{tone({f:520,f2:330,type:'sawtooth',d:0.2,vol:0.1,at:a,lp:1800,verb:0.3});noise({d:0.2,f:1400,f2:700,q:1.5,vol:0.07,at:a});});},\n"
    "    f_cold:()=>{[1568,2349,3136].forEach((f,i)=>tone({f,type:'sine',a:0.01,d:1.6,vol:0.05,at:i*0.05,verb:0.8}));},\n"
    "    f_gallop:()=>{for(let i=0;i<10;i++)knock(i*0.2+(i%2?0.07:0),0.12+i*0.015);},\n"
    "    f_relief:()=>{arp([262,330,392,523],0.18,{vol:0.1,d:1.4,verb:0.6});},", 1, 'film-sfx')
