/* HOLDOR RPG boot (A01): assets ready → no save: the intro; a saved living hero: the world; a saved dead hero: the 'heroes' screen
   (afterDeath) over the world; version label bottom-left for 3 s. Uncaught errors → #err + R.errors (installed by the core). */
(function () {
  let booted = false;
  const label = () => { const host = document.getElementById('ui') || document.body; if (!host || document.getElementById('ver')) return;
    const d = document.createElement('div'); d.id = 'ver'; d.textContent = 'v' + R.VERSION;
    d.style.cssText = 'position:absolute;left:10px;bottom:calc(8px + env(safe-area-inset-bottom));font:12px var(--f-display,Georgia,serif);color:rgba(233,238,245,.55);pointer-events:none;z-index:50;transition:opacity .6s';
    host.appendChild(d); setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 700); }, 3000); };
  // the doors in: a saved hero → the world (dead → the heroes screen over it); no hero → the intro; no intro built yet → the house's first champion, so the game is playable
  const enter = () => {
    const has = R.load() && R.state.p && R.state.p.hero;
    if (has) {
      R.enterWorld();
      if (R.player.dead) { if (R.screens.heroes) { R.ui.open('heroes', { afterDeath: true }); R.boot = 'heroes'; } else { R.newHero(R.state.p.hero); R.boot = 'default'; } }
      else R.boot = 'world';
    } else if (R.screens.intro) { R.ui.open('intro'); R.boot = 'intro'; }
    else { if (!R.state) R.state = R.newState('stark'); R.newHero(R.firstChamp(R.state.acc.house)); R.boot = 'default'; }
    label(); R.bus.emit('boot', R.boot);
  };
  const boot = () => { if (booted) return; booted = true;
    const ready = R.assets && R.assets.ready;
    if (ready && typeof ready.then === 'function') {
      let done = false; const go = () => { if (!done) { done = true; try { enter(); } catch (e) { R.err((e && e.message) || e, 'boot'); } } };
      ready.then(go, e => { R.err((e && e.message) || e, 'assets'); go(); }); setTimeout(go, 8000);   // never wait on assets for ever
    } else { try { enter(); } catch (e) { R.err((e && e.message) || e, 'boot'); } } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
