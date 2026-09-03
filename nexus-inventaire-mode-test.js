// NEXUS Inventaire V2 — simulation terrain manager.
// Un manager/gerant peut éprouver le parcours d'un rôle sans écrire de donnée
// opérationnelle. Le rôle réel reste l'identité de sécurité ; test_role ne sert
// qu'à projeter le parcours et les missions visibles.
(function () {
  'use strict';

  const ROLES_TEST = [
    { code: 'caissier', label: 'Caissière', icon: '🧾' },
    { code: 'pompiste', label: 'Pompiste', icon: '⛽' },
    { code: 'renfort', label: 'Renfort', icon: '📦' },
  ];
  const UUID_QUART_SIMULATION = '00000000-0000-4000-8000-000000000101';
  const UUID_EMPLOYE_SIMULATION = '00000000-0000-4000-8000-000000000102';
  let momentMissionTest = 'debut';
  let demarrerMissionPendantTest = null;
  let surchargesInstallees = false;

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

  function htmlSelecteurTest() {
    if (!estManagerReel()) return '';
    const actif = roleTestActif();
    const boutons = ROLES_TEST.map(r => `
      <button type="button" data-nexus-test-role="${r.code}" class="nexus-mode-test-role${actif === r.code ? ' actif' : ''}">
        ${r.label}
      </button>`).join('');
    const titre = actif ? `Simulation ${libelleRole(actif)}` : 'Tester un parcours terrain';
    const copie = actif
      ? `Vous restez connecté comme manager et visualisez le parcours ${libelleRole(actif)}.`
      : 'Choisissez un rôle pour vérifier son parcours sans toucher aux données officielles.';
    const boutonMissionPendant = actif && idsMissionsTest('pendant').size
      ? `<button type="button" id="nexusTesterMissionPendant" class="btn-primary" style="margin-top:12px;">
           Tester le contrôle ciblé pendant le quart
         </button>`
      : '';
    return `
      <div id="nexusModeTestManager" class="nexus-mode-test-card">
        <div class="nexus-mode-test-head">
          <div>
            <div class="nexus-mode-test-kicker">Mode simulation</div>
            <div class="nexus-mode-test-title">${titre}</div>
          </div>
          ${actif ? '<button type="button" id="nexusQuitterModeTest" class="nexus-mode-test-exit">Quitter le test</button>' : ''}
        </div>
        <div class="nexus-mode-test-copy">${copie}</div>
        ${actif ? '<div class="nexus-mode-test-proof">Aucune donnée réelle n’est enregistrée</div>' : ''}
        <div class="nexus-mode-test-roles">${boutons}</div>
        ${boutonMissionPendant}
      </div>`;
  }

  function brancherSelecteur() {
    document.querySelectorAll('[data-nexus-test-role]').forEach(btn => {
      btn.addEventListener('click', () => { window.location.href = urlPourRole(btn.dataset.nexusTestRole); });
    });
    const quitter = document.getElementById('nexusQuitterModeTest');
    if (quitter) quitter.addEventListener('click', () => { window.location.href = urlPourRole(null); });
    const pendant = document.getElementById('nexusTesterMissionPendant');
    if (pendant) pendant.addEventListener('click', () => {
      if (typeof demarrerMissionPendantTest === 'function') demarrerMissionPendantTest();
    });
  }

  function injecterSelecteur() {
    if (!estManagerReel()) return;
    document.body.classList.toggle('nexus-mode-test-actif', !!roleTestActif());
    const content = document.getElementById('content');
    if (!content) return;
    const ancien = document.getElementById('nexusModeTestManager');
    if (ancien) ancien.remove();
    content.insertAdjacentHTML('afterbegin', htmlSelecteurTest());
    brancherSelecteur();

    const actif = roleTestActif();
    if (!actif || idsMissionsTest().size) return;
    const selecteur = document.getElementById('nexusModeTestManager');
    if (selecteur) selecteur.insertAdjacentHTML('afterend', `
      <div class="etat-banner" style="border-color:var(--amber);">
        <b>Aucune mission applicable pour ce test.</b><br>
        NEXUS ne remplace pas un périmètre vide par le catalogue complet.
      </div>`);
    const carte = document.getElementById('carteOuverture');
    if (carte) carte.classList.add('disabled');
  }

  function signalerMissionMomentAbsente(moment) {
    injecterSelecteur();
    const selecteur = document.getElementById('nexusModeTestManager');
    if (!selecteur) return;
    const label = moment === 'fin' ? 'de fin de quart' : (moment === 'pendant' ? 'pendant le quart' : 'de début de quart');
    selecteur.insertAdjacentHTML('afterend', `
      <div class="etat-banner" style="border-color:var(--amber);">
        <b>Aucune mission ${label} applicable.</b><br>
        NEXUS conserve un périmètre vide plutôt que d'inventer une mission.
      </div>`);
  }

  function afficherFinSimulation(phase) {
    const role = roleTestActif();
    const titre = phase === 'cloture'
      ? 'Simulation de clôture terminée'
      : (phase === 'mission' ? 'Contrôle ciblé simulé terminé' : "Simulation d'ouverture terminée");
    const titreEl = document.getElementById('titre');
    const sousTitreEl = document.getElementById('sousTitre');
    const content = document.getElementById('content');
    if (titreEl) titreEl.textContent = titre;
    if (sousTitreEl) sousTitreEl.textContent = 'Aucune donnée officielle n’a été modifiée.';
    if (!content) return;
    content.innerHTML = `
      <div class="resume-card">
        <div class="checkmark">✓</div>
        <div class="final-greet">Test ${libelleRole(role)} terminé</div>
        <div style="font-size:12.5px;color:var(--text-mid);line-height:1.55;margin-top:10px;">
          Les saisies sont restées locales à cette simulation : aucun comptage, mouvement, statut de quart, alerte ou indicateur d'adoption n'a été enregistré.
        </div>
      </div>
      <button class="btn-primary" id="btnRetourSimulation">Retour à l'inventaire</button>`;
    document.getElementById('btnRetourSimulation')?.addEventListener('click', () => { window.location.href = urlPourRole(role); });
  }

  function neutraliserEcrituresTerrain() {
    function remplacerFonctionGlobale(nom, valeurSimulation) {
      if (typeof globalThis[nom] !== 'function') return;
      const original = globalThis[nom];
      globalThis[nom] = async function (...args) {
        if (!roleTestActif()) return original.apply(this, args);
        return typeof valeurSimulation === 'function' ? valeurSimulation(...args) : valeurSimulation;
      };
    }

    remplacerFonctionGlobale('ecrireTransmisImmediat', { simulation: true });
    remplacerFonctionGlobale('ecrireOuvertureImmediat', { simulation: true });
    remplacerFonctionGlobale('ecrireProductionInitialeImmediat', { simulation: true });
    remplacerFonctionGlobale('ecrireMouvementImmediat', { simulation: true });

    // Le test possède son quart virtuel : aucune création de quart ou de
    // présence manager dans les tables opérationnelles, même si aucun quart
    // réel n'existe encore au moment du test.
    remplacerFonctionGlobale('obtenirOuCreerQuart', () => ({
      id: UUID_QUART_SIMULATION,
      site: employeeCourant.site_id,
      date: dateISO(),
      quart: quartActuel,
      statut: 'simulation',
      ouvert_le: new Date().toISOString(),
    }));
    remplacerFonctionGlobale('obtenirOuCreerQuartEmploye', () => ({
      id: UUID_EMPLOYE_SIMULATION,
      quart_id: UUID_QUART_SIMULATION,
      employee_id: employeeCourant.id,
      role: roleTestActif(),
      a_valide_ouverture: false,
      a_valide_cloture: false,
      heure_arrivee: new Date().toISOString(),
    }));

    if (typeof flusherMesuresAdoption === 'function') {
      const original = flusherMesuresAdoption;
      flusherMesuresAdoption = async function (...args) {
        if (roleTestActif()) return;
        return original.apply(this, args);
      };
    }

    if (typeof validerOuverture === 'function') {
      const original = validerOuverture;
      validerOuverture = async function (...args) {
        if (roleTestActif()) { afficherFinSimulation('ouverture'); return; }
        return original.apply(this, args);
      };
    }
    if (typeof validerCloture === 'function') {
      const original = validerCloture;
      validerCloture = async function (...args) {
        if (roleTestActif()) { afficherFinSimulation('cloture'); return; }
        return original.apply(this, args);
      };
    }
  }

  function installerSurcharges() {
    if (surchargesInstallees) return true;
    if (typeof renderAccueil !== 'function' || typeof restreindreAuPlanQuart !== 'function') return false;
    surchargesInstallees = true;

    const chargerMissionsOriginal = typeof chargerMissionsDuJour === 'function' ? chargerMissionsDuJour : null;
    if (chargerMissionsOriginal) {
      chargerMissionsDuJour = async function () {
        const actif = roleTestActif();
        if (!actif) return chargerMissionsOriginal();
        const D = typeof NexusInventaireMissionsDonnees !== 'undefined' ? NexusInventaireMissionsDonnees : null;
        if (!D) { missionsDuJour = []; return; }
        try {
          // Rôle simulé = vérité du test. Le rôle réel manager ne doit jamais
          // décider du périmètre affiché pendant cette projection.
          missionsDuJour = await D.chargerMissionsPourRole(
            nexusClient, employeeCourant.site_id, dateISO(), quartActuel, actif
          );
        } catch (e) {
          console.error('Projection missions manager test:', e);
          missionsDuJour = [];
        }
      };
    }

    // En simulation, le périmètre vient exclusivement des missions du rôle
    // simulé. On ne crée/ne modifie donc aucun plan de comptage officiel.
    if (typeof chargerEtAppliquerPlanQuart === 'function') {
      const original = chargerEtAppliquerPlanQuart;
      chargerEtAppliquerPlanQuart = async function (...args) {
        if (!roleTestActif()) return original.apply(this, args);
        if (typeof chargerMissionsDuJour === 'function') await chargerMissionsDuJour();
        produitsPlanIds = idsMissionsTest(momentMissionTest);
        planQuartActif = null;
        planItemIdParProduit = {};
        regleSnapshotParProduit = {};
      };
    }

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
      const phase = momentMissionTest === 'fin' ? 'Fin de quart' : (momentMissionTest === 'pendant' ? 'Pendant le quart' : 'Début de quart');
      return `
        <div class="etat-banner">
          <div class="progression-bloc" style="margin:0;">
            <div class="progression-haut"><span><b>🧪 Test ${libelleRole(actif)}</b></span><span>${phase}</span></div>
            <div class="progression-barre"><div class="progression-remplie" style="width:${jauge.pct}%"></div></div>
            <div class="progression-globale">${jauge.faits} sur ${jauge.total} références prévues</div>
          </div>
        </div>`;
    };

    const demarrerOriginal = demarrerOuverture;
    demarrerMissionPendantTest = async function () {
      if (!roleTestActif()) return;
      momentMissionTest = 'pendant';
      if (!idsMissionsTest('pendant').size) { signalerMissionMomentAbsente('pendant'); return; }
      produitsZone = [];
      return demarrerOriginal();
    };
    demarrerOuverture = async function () {
      if (!roleTestActif()) return demarrerOriginal();
      momentMissionTest = 'debut';
      if (!idsMissionsTest('debut').size) { signalerMissionMomentAbsente('debut'); return; }
      produitsZone = [];
      return demarrerOriginal();
    };

    if (typeof demarrerCloture === 'function') {
      const original = demarrerCloture;
      demarrerCloture = async function () {
        if (!roleTestActif()) return original();
        momentMissionTest = 'fin';
        if (!idsMissionsTest('fin').size) { signalerMissionMomentAbsente('fin'); return; }
        produitsZone = [];
        return original();
      };
    }

    const renderAccueilOriginal = renderAccueil;
    renderAccueil = async function () {
      const resultat = await renderAccueilOriginal();
      injecterSelecteur();
      return resultat;
    };

    if (typeof renderChoixZone === 'function') {
      const renderChoixZoneOriginal = renderChoixZone;
      renderChoixZone = function () {
        const resultat = renderChoixZoneOriginal();
        injecterSelecteur();
        return resultat;
      };
    }

    neutraliserEcrituresTerrain();
    window.NEXUS_INVENTAIRE_MODE_TEST_READY = true;
    return true;
  }

  function tenterInstallation() {
    try {
      return installerSurcharges();
    } catch (e) {
      console.error('Initialisation mode test terrain Inventaire V2:', e);
      return false;
    }
  }

  window.NexusInventaireModeTest = {
    moment: () => momentMissionTest,
    terminer: afficherFinSimulation,
    actif: roleTestActif,
    rafraichir: injecterSelecteur,
  };

  // Installer les gardes au plus tôt ; nexusRequireAuth attend le drapeau READY
  // lorsqu'un test_role est demandé, ce qui garantit que le quart virtuel et
  // les no-op d'écriture sont en place avant l'initialisation opérationnelle.
  if (!tenterInstallation()) {
    let essaisInstallation = 0;
    const timerInstallation = setInterval(() => {
      essaisInstallation++;
      if (tenterInstallation() || essaisInstallation > 100) clearInterval(timerInstallation);
    }, 25);
  }

})();

// Extension terrain commune (manager en test ET employés réels) : les références
// cigarettes restent comptées en paquets + cartouches puis converties en paquets.
(function chargerComptageConditionnementCigarettes(){
  if(document.querySelector('script[data-nexus-cigarettes-conditionnement]')) return;
  const s=document.createElement('script');
  s.src='nexus-inventaire-cigarettes-conditionnement-v1.js?v=20260903-1156';
  s.defer=true;
  s.dataset.nexusCigarettesConditionnement='1';
  document.head.appendChild(s);
})();
