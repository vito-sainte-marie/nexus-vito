/* NEXUS Skeleton, module optionnel (lot S1). Le CSS seul reste valide ; ce module pose les états,
   les délais (APPEAR 300 ms, MIN 600 ms, LONG 5000 ms), aria-busy, la zone vivante et la sortie longue. */
(function (root) {
  'use strict';
  var T = { APPEAR: 300, MIN: 600, LONG: 5000 };
  var ETATS = ['wait', 'loading', 'ready', 'refresh', 'error', 'empty', 'unavailable'];
  var live = null, longload = null, longTimer = null, suivi = [];

  function say(txt) {
    if (typeof document === 'undefined') return;
    if (!live) {
      live = document.createElement('div');
      live.className = 'nsk-live'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
      document.body.appendChild(live);
    }
    live.textContent = '';
    setTimeout(function () { live.textContent = txt; }, 30);
  }

  function setState(el, st) {
    if (!el || ETATS.indexOf(st) < 0) return;
    if (st === 'error' || st === 'empty' || st === 'unavailable') {
      if (!el.style.minHeight) el.style.minHeight = el.offsetHeight + 'px';
    } else if (st === 'wait' || st === 'loading' || st === 'ready') {
      el.style.minHeight = '';
    }
    el.setAttribute('data-state', st);
    el.setAttribute('aria-busy', (st === 'wait' || st === 'loading' || st === 'refresh') ? 'true' : 'false');
  }

  function titre(el) { return el.getAttribute('aria-label') || 'cette section'; }

  /* Textes neutres : ils constatent, ils n'expliquent pas et ne promettent rien. La page peut fournir les siens
     par options.messages = { error|empty|unavailable : { titre, detail, bouton } }. */
  var TEXTES = {
    error: { titre: 'Lecture impossible pour le moment.', detail: '', bouton: 'Réessayer' },
    empty: { titre: 'Aucune donnée à afficher.', detail: '', bouton: '' },
    unavailable: { titre: 'Donnée indisponible pour le moment.', detail: '', bouton: 'Réessayer' }
  };

  function message(el, st, relancer, perso) {
    var zone = el.querySelector(':scope > .nsk-msg-zone');
    if (!zone) { zone = document.createElement('div'); zone.className = 'nsk-msg-zone'; el.appendChild(zone); }
    var base = TEXTES[st] || TEXTES.unavailable, m = (perso && perso[st]) || {};
    var h = m.titre || base.titre, p = m.detail || base.detail, b = m.bouton != null ? m.bouton : base.bouton;
    zone.innerHTML = '';
    var box = document.createElement('div'); box.className = 'nsk-msg'; box.setAttribute('role', 'alert');
    var eh = document.createElement('b'); eh.textContent = h; box.appendChild(eh);
    if (p) { var ep = document.createElement('p'); ep.textContent = p; box.appendChild(ep); }
    if (b && relancer) {
      var bt = document.createElement('button'); bt.type = 'button'; bt.textContent = b;
      bt.addEventListener('click', relancer); box.appendChild(bt);
    }
    zone.appendChild(box);
  }

  function reveal(el, st, relancer, perso) {
    if (st === 'ready') {
      var j = 0;
      [].forEach.call(el.querySelectorAll('.nsk'), function (n) { n.style.setProperty('--d', Math.min(j++ * 45, 420) + 'ms'); });
      setState(el, 'ready');
      say('« ' + titre(el) + ' » : chargé');
    } else {
      message(el, st, relancer, perso);
      setState(el, st);
      say('« ' + titre(el) + ' » : ' + (st === 'empty' ? 'aucune donnée' : st === 'error' ? 'erreur' : 'indisponible'));
    }
    verifierSortie();
  }

  /* Les sections retirées de la page ne comptent plus : elles ne peuvent ni garder la bannière ni la placer. */
  function purger() { suivi = suivi.filter(function (e) { return e.isConnected !== false; }); }

  function enAttente() {
    purger();
    return suivi.some(function (e) { var s = e.getAttribute('data-state'); return s === 'wait' || s === 'loading'; });
  }

  function verifierSortie() {
    if (enAttente()) return;
    if (longTimer) { clearTimeout(longTimer); longTimer = null; }
    if (longload) longload.classList.remove('on');
  }

  function premierEnAttente() {
    for (var i = 0; i < suivi.length; i++) {
      var s = suivi[i].getAttribute('data-state');
      if ((s === 'wait' || s === 'loading') && suivi[i].parentNode) return suivi[i];
    }
    return null;
  }

  function armerSortieLongue(relancer) {
    if (longTimer) return;
    longTimer = setTimeout(function () {
      longTimer = null;
      if (!enAttente()) return;
      if (!longload) {
        longload = document.createElement('div'); longload.className = 'nsk-longload'; longload.setAttribute('role', 'status');
        var s = document.createElement('span'); s.textContent = 'Le chargement est plus long que prévu. Vos données arrivent peut-être encore.';
        var b1 = document.createElement('button'); b1.type = 'button'; b1.textContent = 'Réessayer';
        var b2 = document.createElement('button'); b2.type = 'button'; b2.textContent = 'Continuer d’attendre';
        b1.addEventListener('click', function () { longload.classList.remove('on'); var r = longload._relancer; if (r) r(); });
        b2.addEventListener('click', function () { longload.classList.remove('on'); });
        longload.appendChild(s); longload.appendChild(b1); longload.appendChild(b2);
      }
      longload._relancer = relancer;
      var premier = premierEnAttente();
      if (premier) premier.parentNode.insertBefore(longload, premier);
      else if (!longload.parentNode) document.body.appendChild(longload);
      longload.classList.add('on');
    }, T.LONG);
  }

  /* charge(el, fournisseur, relancer) : fournisseur() renvoie une promesse. L'écran n'est jamais retardé :
     le squelette n'apparaît qu'après APPEAR et reste au moins MIN une fois montré. */
  function charge(el, fournisseur, options) {
    options = options || {};
    /* Réessayer : la page peut fournir sa propre relance (options.relancer) ; sinon on relance la même lecture,
       sauf si elle est déjà en cours, pour ne jamais doubler une requête. */
    var relancer = function () {
      if (options.relancer) { options.relancer(); return; }
      if (el._nskEnCours) return;
      charge(el, fournisseur, options).catch(function () {});
    };
    var run = (el._nskRun = (el._nskRun || 0) + 1), debut = Date.now(), montre = 0;
    if (suivi.indexOf(el) < 0) suivi.push(el);
    el._nskEnCours = true;
    setState(el, 'wait');
    var t1 = setTimeout(function () {
      if (el._nskRun === run && el.getAttribute('data-state') === 'wait') { setState(el, 'loading'); montre = Date.now(); }
    }, T.APPEAR);
    armerSortieLongue(relancer);
    function fin(st) {
      if (el._nskRun !== run) return;
      clearTimeout(t1);
      var reste = montre ? T.MIN - (Date.now() - montre) : 0;
      if (reste > 0) setTimeout(function () { if (el._nskRun === run) reveal(el, st, relancer, options.messages); }, reste);
      else reveal(el, st, relancer, options.messages);
    }
    return Promise.resolve().then(fournisseur).then(function (r) {
      if (el._nskRun === run) el._nskEnCours = false;
      var vide = options.estVide ? options.estVide(r) : false;
      fin(vide ? 'empty' : 'ready'); return r;
    }, function (e) { if (el._nskRun === run) el._nskEnCours = false; fin(options.indisponible ? 'unavailable' : 'error'); throw e; });
  }

  /* pouls : rafraîchissement localisé, les anciennes données restent (opacité .55), durée minimale MIN. */
  function pouls(el, fournisseur, chip) {
    var run = (el._nskRun = (el._nskRun || 0) + 1), debut = Date.now();
    setState(el, 'refresh');
    if (chip) { chip.classList.remove('warn'); chip.textContent = 'Mise à jour…'; }
    function heure() { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
    function fin(ok) {
      if (el._nskRun !== run) return;
      var reste = Math.max(0, T.MIN - (Date.now() - debut));
      setTimeout(function () {
        if (el._nskRun !== run) return;
        setState(el, 'ready');
        el.querySelectorAll('.nsk').forEach(function (n) { n.style.removeProperty('--d'); });
        if (chip) { chip.classList.toggle('warn', !ok); chip.textContent = ok ? 'Mis à jour à ' + heure() : 'Mise à jour impossible, données de ' + heure() + ' conservées'; }
        say(ok ? 'Données à jour' : 'Mise à jour impossible, données précédentes conservées');
      }, reste);
    }
    return Promise.resolve().then(fournisseur).then(function (r) { fin(true); return r; }, function (e) { fin(false); throw e; });
  }

  root.NexusSkeleton = { T: T, ETATS: ETATS, setState: setState, charge: charge, pouls: pouls, say: say };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.NexusSkeleton;
})(typeof window !== 'undefined' ? window : globalThis);
