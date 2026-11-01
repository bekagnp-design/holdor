# v1.4.6 — the demos draw with the battle's own drawing code (skilldemo.js / demo125.js): the global drawing context becomes a `let`
# so dmRun can point it at a demo canvas for one frame (and always puts it back in a finally).
rep("const canvas=$('#c'),ctx=canvas.getContext('2d');", "const canvas=$('#c');let ctx=canvas.getContext('2d');", 1, 'ctx-let')
