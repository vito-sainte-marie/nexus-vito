// NEXUS Inventaire V2 — mode test terrain manager.
// Chargé uniquement par nexus-auth.js sur NEXUS-Inventaire-v1.html.
(function () {
  'use strict';

  const ROLES_TEST = [
    { code: 'caissier', label: 'Caissier', icon: '🧾' },
    { code: 'pompiste', label: 'Pompiste', icon: '⛽' },
    { code: 'renfort', label: 'Renfort', icon: '📦' },
  ];
  // Le parcours historique conserve produitsZone entre ouverture et clôture.
  // En V2 test, ce serait faux : une mission « début » et une mission « fin »
  // peuvent avoir des périmètres différents. On garde donc le moment métier
  // explicitement et on recharge produitsZone au changement de phase.
  let momentMissionTest = 'debut';

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

  function idsMissionsTest(moment) {
    if (!roleTestActif() || typeof missionsDuJour === 'undefined') return new Set();
    const ids = new Set();
    (missionsDuJour || [])
      .filter(m => !moment || m.moment_code === moment)
      .forEach(m => (m.produit_ids || []).forEach(id => ids.add(id)));
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
      'font-family:var(--sans)', 'font-size:12px', 'font-weight:600', 'cursor:pointer',
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
      </div>`;
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
    // À l'accueil on vérifie l'existence d'au moins une mission du rôle. La
    // garde spécifique début/fin est appliquée au clic sur chaque parcours.
    const ids = idsMissionsTest();
    if (!ids.size) {
      const selecteur = document.getElementById('nexusModeTestManager');
      if (selecteur) selecteur.insertAdjacentHTML('afterend', `
        <div class="etat-banner" style="border-color:var(--amber);">
          <b>Aucune mission V2 applicable pour ce test.</b><br>
          NEXUS ne bascule pas vers le catalogue complet. Vérifiez les règles de mission ou changez de rôle/quart.
        </div>`);
      const carte = document.getElementById('carteOuverture');
      if (carte) carte.classList.add('disabled');
    }
  }

  function signalerMissionMomentAbsente(moment) {
    injecterSelecteur();
    const selecteur = document.getElementById('nexusModeTestManager');
    if (!selecteur) return;
    const label = moment === 'fin' ? 'de fin de quart' : 'de début de quart';
    selecteur.insertAdjacentHTML('afterend', `
      <div class="etat-banner" style="border-color:var(--amber);">
        <b>Aucune mission ${label} applicable.</b><br>
        NEXUS ne remplace pas ce périmètre vide par le catalogue ou par une mission d'un autre moment.
      </div>`);
  }

  function installerSurcharges() {
    if (typeof renderAccueil !== 'function' || typeof restreindreAuPlanQuart !== 'function') {
      console.error('Mode test Inventaire V2 : fonctions de la page non disponibles.');
      return;
    }

    const chargerMissionsOriginal = typeof chargerMissionsDuJour === 'function' ? chargerMissionsDuJour : null;
    if (chargerMissionsOriginal) {
      chargerMissionsDuJour = async function () {
        if (!roleTestActif()) return chargerMissionsOriginal();
        const D = typeof NexusInventaireMissionsDonnees !== 'undefined' ? NexusInventaireMissionsDonnees : null;
        if (!D) { missionsDuJour = []; return; }
        try {
          const roleReel = employeeCourant.role_reel || employeeCourant.role;
          missionsDuJour = await D.chargerMissionsPourRole(
            nexusClient, employeeCourant.site_id, dateISO(), quartActuel, roleReel
          );
        } catch (e) {
          console.error('Projection missions manager test:', e);
          missionsDuJour = [];
        }
      };
    }

    // Vérité opérationnelle stricte : le filtre utilise le moment actif,
    // jamais l'union début+pendant+fin. Une référence de début ne devient
    // donc pas artificiellement obligatoire à la clôture et inversement.
    const restreindrePlanOriginal = restreindreAuPlanQuart;
    restreindreAuPlanQuart = function (liste) {
      const actif = roleTestActif();
      if (!actif) return restreindrePlanOriginal(liste);
      const ids = idsMissionsTest(momentMissionTest);
      return (liste || []).filter(p => ids.has(p.id) || (p.inventaire_categories && p.inventaire_categories.nom === JAUGEAGE_NOM));
    };

    const couvertureOriginale = renderBlocCouvertureQuart;
    renderBlocCouvertureQuart = function () {
      const actif = roleTestActif();
      if (!actif) return couvertureOriginale();
      const ids = idsMissionsTest(momentMissionTest);
      if (!ids.size || typeof NexusInventaireMoteur === 'undefined') return '';
      const jauge = NexusInventaireMoteur.jaugePerimetre(Array.from(ids), comptesFaitsDuPlan());
      const phase = momentMissionTest === 'fin' ? 'Fin de quart' : 'Début de quart';
      return `
        <div class="etat-banner">
          <div class="progression-bloc" style="margin:0;">
            <div class="progression-haut"><span><b>🧪 Périmètre test V2 · ${libelleRole(actif)}</b></span><span>${phase}</span></div>
            <div class="progression-barre"><div class="progression-remplie" style="width:${jauge.pct}%"></div></div>
            <div class="progression-globale">${jauge.faits} sur ${jauge.total} références prévues</div>
          </div>
        </div>`;
    };

    const demarrerOriginal = demarrerOuverture;
    demarrerOuverture = async function () {
      if (!roleTestActif()) return demarrerOriginal();
      momentMissionTest = 'debut';
      if (!idsMissionsTest('debut').size) { signalerMissionMomentAbsente('debut'); return; }
      // Force le rechargement pour éviter de réutiliser un produitsZone issu
      // d'une phase précédente ou d'un ancien plan technique.
      produitsZone = [];
      return demarrerOriginal();
    };

    if (typeof demarrerCloture === 'function') {
      const demarrerClotureOriginal = demarrerCloture;
      demarrerCloture = async function () {
        if (!roleTestActif()) return demarrerClotureOriginal();
        momentMissionTest = 'fin';
        if (!idsMissionsTest('fin').size) { signalerMissionMomentAbsente('fin'); return; }
        produitsZone = [];
        return demarrerClotureOriginal();
      };
    }

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
    if (!actif) { injecterSelecteur(); return; }

    if (actif === 'caissier') {
      zonesAutorisees = ['boutique']; zoneActive = 'boutique';
    } else if (actif === 'pompiste') {
      zonesAutorisees = ['piste']; zoneActive = 'piste';
    } else {
      zonesAutorisees = ['piste', 'boutique'];
      if (!zoneActive || !zonesAutorisees.includes(zoneActive)) zoneActive = 'boutique';
    }

    if (typeof chargerMissionsDuJour === 'function') await chargerMissionsDuJour();
    if (typeof renderAccueil === 'function') await renderAccueil();
  }

  function demarrerInstallation() {
    try { installerSurcharges(); appliquerModeTestInitial(); }
    catch (e) { console.error('Initialisation mode test terrain Inventaire V2:', e); }
  }

  if (document.readyState === 'complete') setTimeout(demarrerInstallation, 0);
  else window.addEventListener('load', demarrerInstallation, { once: true });
})();

// Extension terrain commune (manager en test ET employés réels) : les références
// cigarettes sont comptées en paquets + cartouches, puis converties en paquets
// avant de rejoindre le moteur historique. Chargement depuis ce compagnon déjà
// présent sur la page afin d'éviter une nouvelle dépendance dans le HTML principal.
(function chargerComptageConditionnementCigarettes(){
  if(document.querySelector('script[data-nexus-cigarettes-conditionnement]')) return;
  const s=document.createElement('script');
  s.src='nexus-inventaire-cigarettes-conditionnement-v1.js?v=20260831-1015';
  s.defer=true;
  s.dataset.nexusCigarettesConditionnement='1';
  document.head.appendChild(s);
})();
