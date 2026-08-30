// NEXUS Inventaire V2 — mode test terrain manager.
// Chargé uniquement par nexus-auth.js sur NEXUS-Inventaire-v1.html.
//
// Objectifs :
// 1. permettre au manager/gérant de choisir Caissier, Pompiste ou Renfort ;
// 2. ne jamais modifier le rôle RH, les shifts ou inventaire_quart_employes ;
// 3. en mode test, faire du périmètre des Missions V2 la vérité de l'écran
//    de comptage — jamais le catalogue/plan complet en repli silencieux ;
// 4. si aucune mission n'est calculable, afficher un état neutre et bloquer
//    le démarrage plutôt que de présenter 112 références par défaut.
(function () {
  'use strict';

  const ROLES_TEST = [
    { code: 'caissier', label: 'Caissier', icon: '🧾' },
    { code: 'pompiste', label: 'Pompiste', icon: '⛽' },
    { code: 'renfort', label: 'Renfort', icon: '📦' },
  ];

  function estManagerReel() {
    if (typeof employeeCourant === 'undefined' || !employeeCourant) return false;
    const role = employeeCourant.role_reel || employeeCourant.role;
    return role === 'manager' || role === 'gerant';
  }

  function roleTestActif() {
    if (!estManagerReel()) return null;
    const role = employeeCourant.role_test_inventaire;
    return ROLES_TEST.some(r => r.code === role) ? role : null;
  }

  function libelleRole(code) {
    const r = ROLES_TEST.find(x => x.code === code);
    return r ? r.label : code;
  }

  function idsMissionsTest() {
    if (!roleTestActif() || typeof missionsDuJour === 'undefined') return new Set();
    const ids = new Set();
    (missionsDuJour || []).forEach(m => (m.produit_ids || []).forEach(id => ids.add(id)));
    return ids;
  }

  function urlPourRole(role) {
    const url = new URL(window.location.href);
    if (role) url.searchParams.set('test_role', role);
    else url.searchParams.delete('test_role');
    return url.pathname.split('/').pop() + url.search + url.hash;
  }

  function styleBouton(actif) {
    return [
      'flex:1', 'min-width:92px', 'border-radius:10px', 'padding:10px 8px',
      'font-family:var(--sans)', 'font-size:12px', 'font-weight:600',
      'cursor:pointer',
      actif
        ? 'border:1px solid var(--cyan);background:rgba(79,195,217,.14);color:var(--cyan)'
        : 'border:1px solid var(--hairline);background:var(--panel-raised);color:var(--text-mid)'
    ].join(';');
  }

  function htmlSelecteurTest() {
    if (!estManagerReel()) return '';
    const actif = roleTestActif();
    const boutons = ROLES_TEST.map(r => `
      <button type="button" data-nexus-test-role="${r.code}" style="${styleBouton(actif === r.code)}">
        ${r.icon} ${r.label}
      </button>
    `).join('');

    const statut = actif
      ? `<div style="font-size:12px;color:var(--text-mid);line-height:1.45;margin-top:8px;">
           Vous restez connecté comme <b style="color:var(--text);">manager</b>. NEXUS affiche uniquement le parcours terrain <b style="color:var(--cyan);">${libelleRole(actif)}</b>.
         </div>`
      : `<div style="font-size:12px;color:var(--text-mid);line-height:1.45;margin-top:8px;">
           Choisissez un rôle pour éprouver son parcours Inventaire V2 sans créer de fausse prise de poste.
         </div>`;

    return `
      <div id="nexusModeTestManager" class="etat-banner" style="border-color:rgba(79,195,217,.35);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div style="font-weight:700;color:var(--text);">🧪 Mode test terrain</div>
          ${actif ? '<button type="button" id="nexusQuitterModeTest" style="border:0;background:none;color:var(--text-dim);font-size:11px;cursor:pointer;">Quitter le test</button>' : ''}
        </div>
        ${statut}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">${boutons}</div>
      </div>
    `;
  }

  function brancherSelecteur() {
    document.querySelectorAll('[data-nexus-test-role]').forEach(btn => {
      btn.addEventListener('click', () => { window.location.href = urlPourRole(btn.dataset.nexusTestRole); });
    });
    const quitter = document.getElementById('nexusQuitterModeTest');
    if (quitter) quitter.addEventListener('click', () => { window.location.href = urlPourRole(null); });
  }

  function injecterSelecteur() {
    if (!estManagerReel()) return;
    const content = document.getElementById('content');
    if (!content) return;
    const ancien = document.getElementById('nexusModeTestManager');
    if (ancien) ancien.remove();
    content.insertAdjacentHTML('afterbegin', htmlSelecteurTest());
    brancherSelecteur();

    const actif = roleTestActif();
    if (!actif) return;
    const ids = idsMissionsTest();
    if (!ids.size) {
      const selecteur = document.getElementById('nexusModeTestManager');
      if (selecteur) selecteur.insertAdjacentHTML('afterend', `
        <div class="etat-banner" style="border-color:var(--amber);">
          <b>Aucune mission V2 applicable pour ce test.</b><br>
          NEXUS ne bascule pas vers le catalogue complet. Vérifiez les règles de mission ou changez de rôle/quart.
        </div>
      `);
      const carte = document.getElementById('carteOuverture');
      if (carte) carte.classList.add('disabled');
    }
  }

  function installerSurcharges() {
    if (typeof renderAccueil !== 'function' || typeof restreindreAuPlanQuart !== 'function') {
      console.error('Mode test Inventaire V2 : fonctions de la page non disponibles.');
      return;
    }

    // En mode test, la vérité opérationnelle = union dédupliquée des
    // produit_ids des Missions V2 projetées pour le rôle testé.
    const restreindrePlanOriginal = restreindreAuPlanQuart;
    restreindreAuPlanQuart = function (liste) {
      const actif = roleTestActif();
      if (!actif) return restreindrePlanOriginal(liste);
      const ids = idsMissionsTest();
      return (liste || []).filter(p => ids.has(p.id) || (p.inventaire_categories && p.inventaire_categories.nom === JAUGEAGE_NOM));
    };

    // Le vieux plan du quart ne doit pas réapparaître visuellement comme
    // jauge principale pendant le test. On affiche une jauge V2 sur l'union
    // des missions testées ; les jauges mission par mission restent dessous.
    const couvertureOriginale = renderBlocCouvertureQuart;
    renderBlocCouvertureQuart = function () {
      const actif = roleTestActif();
      if (!actif) return couvertureOriginale();
      const ids = idsMissionsTest();
      if (!ids.size || typeof NexusInventaireMoteur === 'undefined') return '';
      const jauge = NexusInventaireMoteur.jaugePerimetre(Array.from(ids), comptesFaitsDuPlan());
      return `
        <div class="etat-banner">
          <div class="progression-bloc" style="margin:0;">
            <div class="progression-haut"><span><b>🧪 Périmètre test V2 · ${libelleRole(actif)}</b></span></div>
            <div class="progression-barre"><div class="progression-remplie" style="width:${jauge.pct}%"></div></div>
            <div class="progression-globale">${jauge.faits} sur ${jauge.total} références prévues</div>
          </div>
        </div>`;
    };

    // Garde dure : zéro mission V2 ne doit jamais déclencher le catalogue
    // complet par le chemin de démarrage historique.
    const demarrerOriginal = demarrerOuverture;
    demarrerOuverture = function () {
      if (roleTestActif() && !idsMissionsTest().size) {
        injecterSelecteur();
        return;
      }
      return demarrerOriginal();
    };

    // Chaque retour à l'accueil réinjecte le sélecteur car renderAccueil
    // remplace intégralement #content.
    const renderAccueilOriginal = renderAccueil;
    renderAccueil = async function () {
      const resultat = await renderAccueilOriginal();
      injecterSelecteur();
      return resultat;
    };
  }

  async function appliquerModeTestInitial() {
    if (!estManagerReel()) return;
    const actif = roleTestActif();
    if (!actif) {
      injecterSelecteur();
      return;
    }

    // Le rôle RH / roleDuJour restent manager. Seule la zone d'expérience
    // terrain est forcée lorsque le rôle ne peut travailler que dans une zone.
    if (actif === 'caissier') {
      zonesAutorisees = ['boutique'];
      zoneActive = 'boutique';
    } else if (actif === 'pompiste') {
      zonesAutorisees = ['piste'];
      zoneActive = 'piste';
    } else {
      zonesAutorisees = ['piste', 'boutique'];
      if (!zoneActive || !zonesAutorisees.includes(zoneActive)) zoneActive = 'boutique';
    }

    // chargerMissionsDuJour reçoit toujours le rôle réel manager ; le module
    // missions détecte test_role dans l'URL et renvoie une projection pure,
    // sans INSERT/UPDATE de présence ou mission.
    if (typeof chargerMissionsDuJour === 'function') await chargerMissionsDuJour();
    if (typeof renderAccueil === 'function') await renderAccueil();
  }

  function demarrerInstallation() {
    try {
      installerSurcharges();
      appliquerModeTestInitial();
    } catch (e) {
      console.error('Initialisation mode test terrain Inventaire V2:', e);
    }
  }

  if (document.readyState === 'complete') setTimeout(demarrerInstallation, 0);
  else window.addEventListener('load', demarrerInstallation, { once: true });
})();
