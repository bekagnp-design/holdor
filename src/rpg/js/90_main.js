/* HOLDOR RPG boot (A01 / G8): assets ready → the doors:
     no account (no hero, no fallen)        → the intro (title, house, hero, prologue)
     a saved living hero                    → the world
     a saved dead hero / an account between heroes → the 'heroes' screen (afterDeath) over the world
   Inside Telegram (Telegram.WebApp.initData non-empty) the boot waits for R.net's first login + server load at most R.BOOT_NET_MS
   (2.5 s) so the newer of local / server save picks the door; a server save that arrives later re-routes once ('netload').
   Outside Telegram (or offline) it never waits on the network. The inline loader #boot of the template is removed when a door opens.
   Version label bottom-left for 3 s. Uncaught errors → #err + R.errors (installed by the core). */
(function () {
  let booted = false, entered = false;
  R.BOOT_NET_MS = 2500;
  const label = () => { const host = document.getElementById('ui') || document.body; if (!host || document.getElementById('ver')) return;
    const d = document.createElement('div'); d.id = 'ver'; d.textContent = 'v' + R.VERSION;
    d.style.cssText = 'position:absolute;left:10px;bottom:calc(8px + env(safe-area-inset-bottom));font:12px var(--f-display,Georgia,serif);color:rgba(233,238,245,.55);pointer-events:none;z-index:50;transition:opacity .6s';
    host.appendChild(d); setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 700); }, 3000); };
  // the template's inline loader (shown while the 5.6 MB page parses): fades out once a door is open
  const unload = () => { const b = document.getElementById('boot'); if (!b || b.dataset.out) return; b.dataset.out = '1'; b.style.opacity = '0'; b.style.pointerEvents = 'none'; setTimeout(() => b.remove(), 450); };
  R.bootLoader = { done: unload, set: txt => { const t = document.getElementById('bootTxt'); if (t) t.textContent = txt; } };
  const tgInside = () => { try { const T = window.Telegram && window.Telegram.WebApp; return !!(T && T.initData); } catch (e) { return false; } };
  // which door the current R.state opens: 'world' | 'heroes' | 'intro'
  const doorOf = s => { if (!s || !s.p) return 'intro'; if (s.p.hero) return s.p.dead ? 'heroes' : 'world';
    const a = s.acc || {}; return (a.hall && a.hall.length) ? 'heroes' : 'intro'; };
  R.doorOf = doorOf;
  // open a door for the state in R.state (the boot, and a server save that replaced the local one)
  const route = () => {
    const door = doorOf(R.state);
    if (door === 'world' || door === 'heroes') {
      if (R.ui.cur) R.ui.close();
      R.clearEnts(); R.enterWorld();
      if (R.player && R.player.dead || door === 'heroes') {
        if (R.screens.heroes) { R.ui.open('heroes', { afterDeath: true }); R.boot = 'heroes'; }
        else { R.newHero(R.state.p.hero || R.firstChamp(R.state.acc.house)); R.boot = 'default'; }
      } else R.boot = 'world';
    } else if (R.screens.intro) { if (R.ui.cur !== 'intro') R.ui.open('intro'); R.boot = 'intro'; }
    else { const house = (R.state && R.state.acc && R.state.acc.house) || 'stark'; if (!R.state) R.state = R.newState(house); R.newHero(R.firstChamp(house)); R.boot = 'default'; }
    return R.boot;
  };
  R.route = route;
  const enter = () => {
    if (entered) return; entered = true;
    if (!R.load()) R.state = null;
    route();
    unload(); label(); R.bus.emit('boot', R.boot);
  };
  // a server save replaced the local one after the boot (R.net emits 'netload'): open its door once, unless the player is already where it leads
  R.bus.on('netload', () => { if (!entered) return; try {
    const door = doorOf(R.state);
    if (door === 'intro' && R.ui.cur === 'intro') return;
    if (door === 'world' && R.player && !R.player.dead && R.player.hero === R.state.p.hero && !R.ui.cur) { R.clearEnts(); R.enterWorld(); return; }
    route(); R.bus.emit('boot', R.boot);
  } catch (e) { R.err((e && e.message) || e, 'netload'); } });
  const go = () => { try { enter(); } catch (e) { R.err((e && e.message) || e, 'boot'); unload(); } };
  const boot = () => { if (booted) return; booted = true;
    // inside Telegram: start the login now (R.net logs in on window load otherwise) and give it a short head start
    let netP = null;
    if (tgInside() && R.net && typeof R.net.login === 'function') { try { R.bootLoader.set('Riding to the server…'); netP = Promise.resolve(R.net.login()).catch(() => false); } catch (e) { netP = null; } }
    const ready = R.assets && R.assets.ready;
    const cap = (p, ms) => new Promise(res => { let t = setTimeout(() => res(0), ms); Promise.resolve(p).then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); res(0); }); });
    const waits = [];
    if (ready && typeof ready.then === 'function') waits.push(cap(ready.then(() => 1, e => { R.err((e && e.message) || e, 'assets'); }), 8000));   // never wait on assets for ever
    if (netP) waits.push(cap(netP, R.BOOT_NET_MS));                                                                                          // nor on the network for more than 2.5 s
    if (!waits.length) return go();
    Promise.all(waits).then(go, go);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
