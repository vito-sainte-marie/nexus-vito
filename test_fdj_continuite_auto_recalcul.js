// Test — Continuité FDJ v2 : résolution + recalcul indissociables (16/08/2026)
//
// Spécification de Frédéric : "une chaîne rétablie ne signifie pas
// forcément que les anciens écarts calculés pendant la rupture sont
// automatiquement valides [...] résolution de l'alerte + recalcul des
// données doivent être indissociables", avec décision explicite (question
// posée via AskUserQuestion) : "Recalculer et réécrire automatiquement"
// l'écart de caisse — MÊME pour un quart déjà validé par un manager — sauf
// pour les jeux dont le stock_initial a été confirmé par un humain
// (stock_initial_auto=false), qui suivent le flux d'alerte manuelle
// existant, inchangé.
//
// Extrait les fonctions réelles (jamais réécrites à la main) de
// NEXUS-FDJ-Manager-v1.html via regex + comptage d'accolades, comme tous
// les tests de ce module. Consomme le vrai nexus-fdj-moteur.js (require()
// direct, aucun mock du moteur de calcul — seul Supabase est simulé).

const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

const CHEMIN_BASE = __dirname;

require(`${CHEMIN_BASE}/nexus-fdj-moteur.js`);
const NexusFdjMoteur = global.NexusFdjMoteur;

const html = fs.readFileSync(`${CHEMIN_BASE}/NEXUS-FDJ-Manager-v1.html`, 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function extraire(nomFonction) {
  const debut = (() => {
    const iAsync = script.indexOf(`async function ${nomFonction}(`);
    if (iAsync !== -1) return iAsync;
    return script.indexOf(`function ${nomFonction}(`);
  })();
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
  let i = script.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (script[j] === '{') profondeur++;
    else if (script[j] === '}') profondeur--;
    j++;
  }
  return script.slice(debut, j);
}

// ------------------------------------------------------------
// 0) GARDE STRUCTURELLE (PR #62, point 4) — l'écran manager ne doit plus
//    écrire directement dans `fdj_cash_controls`. C'est la table du cycle
//    de caisse : la RLS y est refermée par la Phase C et les seules
//    écritures admises passent par les commandes serveur. Cette garde-ci
//    est statique et ne coûte rien : elle relit le script de l'écran et
//    exige que CHAQUE accès à la table soit suivi d'un `.select`. Elle
//    mordrait immédiatement si quelqu'un réintroduisait un `.update`
//    « juste pour ce cas-là » — c'est exactement ainsi que la dernière
//    écriture directe avait survécu.
// ------------------------------------------------------------
(() => {
  const occurrences = [...script.matchAll(/from\(\s*'fdj_cash_controls'\s*\)/g)];
  assert.ok(occurrences.length > 0, 'La table de caisse doit toujours être lue par cet écran — une garde qui ne voit rien ne garde rien.');
  for (const m of occurrences) {
    const suite = script.slice(m.index + m[0].length).replace(/^[\s\r\n]*/, '');
    assert.ok(suite.startsWith('.select'),
      `Écriture directe sur fdj_cash_controls : accès suivi de « ${suite.slice(0, 48)} » au lieu de « .select ». `
      + 'Les écritures du cycle de caisse passent par les commandes serveur (fdj_corriger_caisse_manager, fdj_valider_caisse, …).');
  }
  console.log(`OK — les ${occurrences.length} accès de l'écran manager à fdj_cash_controls sont des lectures ; aucune écriture directe.`);
})();

// ------------------------------------------------------------
// FAUX CLIENT SUPABASE — générique, en mémoire, suffisant pour
// select/eq/in/order/limit/maybeSingle/single/update/insert/upsert. Ne
// simule qu'un filtrage exact par égalité (aucune requête de ce lot n'a
// besoin de plus), fidèle au style déjà établi dans ce projet (jamais
// jsdom, uniquement des objets minimaux).
// ------------------------------------------------------------
function creerNexusClientFake(tables, obtenirJeux) {
  function correspond(ligne, filtres) { return filtres.every(([c, v]) => ligne[c] === v); }
  function from(table) {
    tables[table] = tables[table] || [];
    return {
      select() {
        const filtres = [];
        let inFiltre = null, limiteN = null;
        const api = {
          eq(c, v) { filtres.push([c, v]); return api; },
          in(c, v) { inFiltre = [c, v]; return api; },
          order() { return api; },
          limit(n) { limiteN = n; return api; },
          maybeSingle() {
            const lignes = tables[table].filter(l => correspond(l, filtres));
            return Promise.resolve({ data: lignes[0] || null, error: null });
          },
          single() {
            const lignes = tables[table].filter(l => correspond(l, filtres));
            return Promise.resolve({ data: lignes[0] || null, error: lignes[0] ? null : { message: 'introuvable' } });
          },
          then(resolve) {
            let lignes = tables[table].filter(l => correspond(l, filtres));
            if (inFiltre) lignes = lignes.filter(l => inFiltre[1].includes(l[inFiltre[0]]));
            if (limiteN) lignes = lignes.slice(0, limiteN);
            resolve({ data: lignes, error: null });
          },
        };
        return api;
      },
      update(patch) {
        // Contrepartie dynamique de la garde 0 : si un chemin d'exécution
        // atteignait malgré tout la table de caisse en écriture, le test
        // s'arrête ici plutôt que de valider un résultat obtenu par le
        // mauvais moyen.
        assert.notStrictEqual(table, 'fdj_cash_controls',
          'Écriture directe sur fdj_cash_controls pendant le test : le recalcul doit passer par fdj_corriger_caisse_manager.');
        const filtres = [];
        const api = {
          eq(c, v) { filtres.push([c, v]); return api; },
          then(resolve) {
            tables[table] = tables[table].map(l => correspond(l, filtres) ? Object.assign(l, patch) : l);
            resolve({ data: null, error: null });
          },
        };
        return api;
      },
      insert(lignesEntree) {
        const arr = Array.isArray(lignesEntree) ? lignesEntree : [lignesEntree];
        const inserees = arr.map(l => ({ id: l.id || `id-${Math.random().toString(36).slice(2, 8)}`, ...l }));
        tables[table].push(...inserees);
        return Promise.resolve({ data: inserees, error: null });
      },
      upsert(lignesEntree) {
        const arr = Array.isArray(lignesEntree) ? lignesEntree : [lignesEntree];
        arr.forEach(l => {
          const idx = tables[table].findIndex(x => l.game_id !== undefined
            ? x.shift_id === l.shift_id && x.game_id === l.game_id
            : x.shift_id === l.shift_id);
          if (idx >= 0) tables[table][idx] = { ...tables[table][idx], ...l };
          else tables[table].push({ id: `id-${Math.random().toString(36).slice(2, 8)}`, ...l });
        });
        return Promise.resolve({ data: arr, error: null });
      },
    };
  }
  return { from, rpc: creerRpc(tables, obtenirJeux) };
}

// ------------------------------------------------------------
// FAUSSE COMMANDE SERVEUR `fdj_corriger_caisse_manager`
//
// Portage fidèle de supabase/migrations/20260916220700_fdj_commandes_caisse_manager.sql
// (et, pour la formule, de `fdj_calculer_caisse` — 20260916220600). Ce qui
// compte ici n'est pas d'imiter PostgreSQL mais de reproduire les quatre
// comportements dont l'écran dépend :
//   · le motif est exigé (≥ 5 caractères utiles) ;
//   · une caisse non confirmée n'est pas corrigeable — la commande répond
//     `caisse_non_confirmee` au lieu d'écrire ;
//   · la caisse est RECALCULÉE depuis les comptages (jamais depuis les
//     valeurs déjà stockées), donc depuis ce que les deux boucles de
//     correction viennent de rétablir ;
//   · `ecart_origine` / `caisse_reelle_origine` ne figurent pas dans le
//     calcul, donc ne peuvent pas être réécrits — la sentinelle des tests
//     le vérifie côté appelant.
// La trace d'audit porte l'action réelle de la commande,
// `fdj_caisse_corrigee_par_manager` : ce n'est plus l'écran qui nomme le
// geste, et l'acteur n'est plus `null`.
// ------------------------------------------------------------
const UID_MANAGER_TEST = 'mgr-test';

function creerRpc(tables, obtenirJeux) {
  const gestionnaires = {
    async fdj_corriger_caisse_manager({ p_shift_id, p_motif, p_caisse_reelle, p_regularisations, p_commentaire }) {
      if (!p_motif || String(p_motif).trim().length < 5) {
        return { data: null, error: { code: '22023', message: 'Une correction managériale exige un motif explicite.' } };
      }
      tables.fdj_cash_controls = tables.fdj_cash_controls || [];
      const avant = tables.fdj_cash_controls.find(c => c.shift_id === p_shift_id);
      if (!avant) return { data: null, error: { code: 'P0002', message: 'Aucune caisse pour ce quart.' } };
      if (!avant.confirme_le) {
        return { data: { corrige: false, motif: 'caisse_non_confirmee', message: 'La caisse de ce quart n\'est pas encore confirmée.' }, error: null };
      }
      const valeursAvant = { ...avant };

      const jeux = await obtenirJeux();
      const counts = (tables.fdj_shift_counts || []).filter(c => c.shift_id === p_shift_id);
      let ventes = 0;
      for (const c of counts) {
        const jeu = (jeux || []).find(j => j.id === c.game_id);
        if (!jeu) continue; // `join fdj_games` : un comptage sans jeu ne compte pas
        const v = NexusFdjMoteur.calculerVentesJeu(
          { stock_initial: c.stock_initial, appro: c.appro, stock_final: c.stock_final }, jeu.prix);
        ventes += (v.valeur || 0);
      }
      const reports = (tables.fdj_reports || []).filter(r => r.shift_id === p_shift_id);
      const agrege = (type, colonne) => {
        const valeurs = reports.filter(r => r.type_rapport === type).map(r => r[colonne]).filter(v => v !== null && v !== undefined);
        return valeurs.length ? Math.max(...valeurs) : null; // max(...) filter (where …), fidèle au SQL
      };
      const lots = agrege('journalier', 'lots_payes_grattage');
      const tirages = agrege('temps_reel', 'caisse_tirages');
      const regul = (p_regularisations === null || p_regularisations === undefined) ? (avant.regularisations || 0) : p_regularisations;
      const reelle = (p_caisse_reelle === null || p_caisse_reelle === undefined) ? avant.caisse_reelle : p_caisse_reelle;
      const grattage = lots === null ? null : ventes - lots;
      const attendue = (grattage === null || tirages === null) ? null : grattage + tirages + regul;
      const ecart = (attendue === null || reelle === null || reelle === undefined)
        ? null : Math.round((reelle - attendue) * 100) / 100;

      const calc = {
        ventes_grattage_valeur: ventes, lots_payes_grattage: lots, caisse_tirages: tirages,
        caisse_grattage: grattage, regularisations: regul, caisse_attendue: attendue,
        caisse_reelle: reelle, ecart,
      };
      // `update … set` de la commande : exactement ces colonnes. Ni
      // `ecart_origine`, ni `caisse_reelle_origine` n'y sont.
      Object.assign(avant, calc, {
        version: (avant.version || 0) + 1,
        nb_corrections: (avant.nb_corrections || 0) + 1,
        derniere_correction_le: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      tables.fdj_caisse_evenements = tables.fdj_caisse_evenements || [];
      tables.fdj_caisse_evenements.push({
        shift_id: p_shift_id, evenement: 'correction_manager', acteur_id: UID_MANAGER_TEST,
        metadata: { source: 'fdj_corriger_caisse_manager', motif: p_motif, commentaire: p_commentaire || null },
      });
      tables.fdj_audit_log = tables.fdj_audit_log || [];
      tables.fdj_audit_log.push({
        site: avant.site || 'site-test', shift_id: p_shift_id,
        entite_type: 'fdj_cash_controls', entite_id: avant.id || null,
        action: 'fdj_caisse_corrigee_par_manager', acteur_id: UID_MANAGER_TEST,
        motif: p_motif, commentaire: p_commentaire || null,
        ancienne_valeur: valeursAvant, nouvelle_valeur: calc,
      });

      return {
        data: {
          corrige: true, version_precedente: valeursAvant.version || 0, version: avant.version,
          ecart_avant: valeursAvant.ecart, ecart,
          caisse_reelle_origine_preservee: avant.caisse_reelle_origine ?? null,
          ecart_origine_preserve: avant.ecart_origine ?? null,
        },
        error: null,
      };
    },
  };
  return (nom, params) => {
    const gestionnaire = gestionnaires[nom];
    assert.ok(gestionnaire, `RPC ${nom} non simulé dans ce test — une bascule vers une commande serveur n'a pas été répercutée ici.`);
    return gestionnaire(params || {});
  };
}

function nouveauContexte(tables, jeuxInitiaux) {
  const ctx = {
    console,
    NexusFdjMoteur,
    siteId: 'site-test',
    jeux: jeuxInitiaux || [],
    nexusClient: creerNexusClientFake(tables, () => (ctx.jeux && ctx.jeux.length) ? ctx.jeux : ctx.chargerJeux()),
    chargerJeux: async () => ctx.jeux,
  };
  ctx.globalThis = ctx;
  const src = [
    extraire('ecartsContinuiteStockQuart'),
    extraire('appliquerCorrectionsAutomatiquesContinuite'),
    extraire('synchroniserRelevesApresRetablissementChaine'),
    extraire('reconcilierAlertesChaine'),
    'globalThis.__ecartsContinuiteStockQuart = ecartsContinuiteStockQuart;',
    'globalThis.__appliquerCorrectionsAutomatiquesContinuite = appliquerCorrectionsAutomatiquesContinuite;',
    'globalThis.__synchroniserRelevesApresRetablissementChaine = synchroniserRelevesApresRetablissementChaine;',
    'globalThis.__reconcilierAlertesChaine = reconcilierAlertesChaine;',
  ].join('\n\n');
  vm.runInNewContext(src, ctx);
  return ctx;
}

// ------------------------------------------------------------
// 1) NexusFdjMoteur.ecartsContinuiteAAppliquer — fonction pure : sépare les
//    jeux en écart selon stock_initial_auto (true = éligible à la
//    correction automatique, false/absent = reste à revoir manuellement).
// ------------------------------------------------------------
(() => {
  const ecarts = [
    { game_id: 'g1', stock_final_precedent: 40, stock_initial_actuel: 35 },
    { game_id: 'g2', stock_final_precedent: 100, stock_initial_actuel: 90 },
    { game_id: 'g3', stock_final_precedent: 10, stock_initial_actuel: 8 },
  ];
  const autoMap = { g1: true, g2: false }; // g3 absent du map -> traité comme non-auto
  const { applicables, aRevoir } = NexusFdjMoteur.ecartsContinuiteAAppliquer(ecarts, autoMap);
  assert.deepStrictEqual(applicables.map(e => e.game_id), ['g1'], 'Seul g1 (stock_initial_auto=true) doit être auto-corrigé');
  assert.deepStrictEqual(aRevoir.map(e => e.game_id), ['g2', 'g3'], 'g2 (false) et g3 (absent du map) doivent rester à revoir manuellement');
  console.log('OK — ecartsContinuiteAAppliquer sépare correctement auto vs à revoir (jeu absent du map = prudence, jamais auto).');
})();

// ------------------------------------------------------------
// 2) appliquerCorrectionsAutomatiquesContinuite — corrige stock_initial +
//    ventes du jeu concerné, puis recalcule ET RÉÉCRIT l'écart de caisse du
//    quart entier (décision explicite de Frédéric), sans jamais toucher
//    ecart_origine/caisse_reelle_origine (constat d'origine, v2.108).
// ------------------------------------------------------------
async function test2() {
  const tables = {
    fdj_shift_counts: [
      { shift_id: 'cur1', game_id: 'g1', stock_initial: 35, appro: 5, stock_final: 20, ventes_qte: 20, ventes_valeur: 40, stock_initial_auto: true },
      { shift_id: 'cur1', game_id: 'g2', stock_initial: 90, appro: 0, stock_final: 50, ventes_qte: 40, ventes_valeur: 120, stock_initial_auto: false },
    ],
    fdj_reports: [
      { shift_id: 'cur1', type_rapport: 'journalier', lots_payes_grattage: 10 },
      { shift_id: 'cur1', type_rapport: 'temps_reel', caisse_tirages: 20 },
    ],
    fdj_cash_controls: [
      { shift_id: 'cur1', caisse_reelle: 190, regularisations: 5, ecart: 999, caisse_attendue: 999, ventes_grattage_valeur: 999, caisse_grattage: 999,
        // `confirme_le` : depuis la Vague 1, une caisse non confirmée n'est
        // pas corrigeable par la commande serveur (elle répond
        // `caisse_non_confirmee` au lieu d'écrire). Le quart de ce test est
        // validé, donc confirmé — c'est bien le cas nominal du recalcul.
        confirme_le: '2026-08-16T20:00:00.000Z', version: 3,
        ecart_origine: -1.23, caisse_reelle_origine: 111.11 }, // constat d'origine — sentinelle, ne doit JAMAIS bouger
    ],
    fdj_audit_log: [],
  };
  const ctx = nouveauContexte(tables, [{ id: 'g1', prix: 2 }, { id: 'g2', prix: 3 }]);

  await ctx.__appliquerCorrectionsAutomatiquesContinuite('cur1', [
    { game_id: 'g1', stock_final_precedent: 40, stock_initial_actuel: 35 },
  ]);

  const g1 = tables.fdj_shift_counts.find(c => c.game_id === 'g1');
  const g2 = tables.fdj_shift_counts.find(c => c.game_id === 'g2');
  assert.strictEqual(g1.stock_initial, 40, 'g1.stock_initial doit être corrigé avec le stock_final réel du quart précédent');
  assert.strictEqual(g1.ventes_qte, 25, 'g1.ventes_qte doit être recalculé avec le stock_initial corrigé (40+5-20)');
  assert.strictEqual(g1.ventes_valeur, 50, 'g1.ventes_valeur doit être recalculé (25 × prix 2€)');
  assert.strictEqual(g2.stock_initial, 90, 'g2 (non concerné par cette correction) ne doit jamais être touché');

  const cash = tables.fdj_cash_controls[0];
  assert.strictEqual(cash.ventes_grattage_valeur, 170, 'Ventes grattage totales recalculées (g1 corrigé 50€ + g2 inchangé 120€)');
  assert.strictEqual(cash.caisse_grattage, 160, 'Caisse grattage recalculée (170 - 10 lots payés)');
  assert.strictEqual(cash.caisse_attendue, 185, 'Caisse attendue recalculée (160 + 20 tirages + 5 régularisations)');
  assert.strictEqual(cash.ecart, 5, "Écart RÉÉCRIT avec la valeur recalculée (190 caisse réelle - 185 attendue), même si le quart était déjà validé — décision explicite de Frédéric");
  assert.strictEqual(cash.ecart_origine, -1.23, 'ecart_origine (constat d\'origine, v2.108) ne doit JAMAIS être réécrit automatiquement');
  assert.strictEqual(cash.caisse_reelle_origine, 111.11, 'caisse_reelle_origine ne doit JAMAIS être réécrit automatiquement');

  // La trace n'est plus posée par l'écran sous un nom à lui avec un acteur
  // `null` : c'est la commande serveur qui journalise, sous son action et
  // sous l'identité réelle de l'appelant.
  const logRecalcul = tables.fdj_audit_log.find(l => l.action === 'fdj_caisse_corrigee_par_manager');
  assert.ok(logRecalcul, 'Une trace d\'audit doit être posée pour le recalcul automatique (jamais un écrasement silencieux)');
  assert.strictEqual(logRecalcul.nouvelle_valeur.ecart, 5, 'La trace d\'audit doit porter le nouvel écart');
  assert.strictEqual(logRecalcul.ancienne_valeur.ecart, 999, 'La trace doit aussi porter l\'écart d\'avant — sinon la correction n\'est pas relisible');
  assert.ok(logRecalcul.acteur_id, 'La trace doit nommer un acteur : la commande journalise sous l\'identité du manager, jamais sous un acteur anonyme');
  assert.ok(/Recalcul automatique après rétablissement de chaîne/.test(logRecalcul.motif || ''),
    'Le motif transmis à la commande doit dire pourquoi la caisse est recalculée');
  const evtRecalcul = (tables.fdj_caisse_evenements || []).find(e => e.evenement === 'correction_manager');
  assert.ok(evtRecalcul, 'Le recalcul doit produire un événement de journal de caisse — l\'écriture directe n\'en produisait aucun');
  assert.strictEqual(evtRecalcul.metadata.source, 'fdj_corriger_caisse_manager');

  console.log('OK — appliquerCorrectionsAutomatiquesContinuite corrige stock+ventes et RÉÉCRIT l\'écart, sans jamais toucher le constat d\'origine.');
}

// ------------------------------------------------------------
// 3) reconcilierAlertesChaine — bout en bout : chaîne rétablie, DEUX jeux
//    en écart (un auto-corrigeable, un à revoir manuellement). Vérifie que
//    résolution de l'alerte + recalcul sont bien indissociables (jamais
//    l'un sans l'autre) ET que la ligne rouge (jamais réécrire une valeur
//    confirmée par un humain) est respectée.
// ------------------------------------------------------------
async function test3() {
  const tables = {
    fdj_alertes: [
      { id: 'alerte-chaine-1', site: 'site-test', type: 'chaine_interrompue', shift_id: 'cur1', shift_precedent_id: 'prev1', resolue_automatiquement: false, resolue_le: null },
    ],
    fdj_shift_counts: [
      { shift_id: 'prev1', game_id: 'g1', stock_final: 40 },
      { shift_id: 'prev1', game_id: 'g2', stock_final: 100 },
      { shift_id: 'cur1', game_id: 'g1', stock_initial: 35, appro: 5, stock_final: 20, ventes_qte: null, ventes_valeur: null, stock_initial_auto: true },
      { shift_id: 'cur1', game_id: 'g2', stock_initial: 90, appro: 0, stock_final: 50, ventes_qte: null, ventes_valeur: null, stock_initial_auto: false },
    ],
    fdj_reports: [
      { shift_id: 'cur1', type_rapport: 'journalier', lots_payes_grattage: 10 },
      { shift_id: 'cur1', type_rapport: 'temps_reel', caisse_tirages: 20 },
    ],
    fdj_cash_controls: [
      { shift_id: 'cur1', caisse_reelle: 190, regularisations: 5, ecart: 999, caisse_attendue: 999, ventes_grattage_valeur: 999, caisse_grattage: 999, confirme_le: '2026-08-16T20:00:00.000Z' },
    ],
    fdj_audit_log: [],
  };
  const ctx = nouveauContexte(tables, [{ id: 'g1', prix: 2 }, { id: 'g2', prix: 3 }]);

  const ensemble = [
    { id: 'prev1', date: '2026-08-16', quart: '1', statut: 'valide', employee_id: 'emp1' },
    { id: 'cur1', date: '2026-08-16', quart: '2', statut: 'valide', employee_id: 'emp1' },
  ];
  const alertesBrutes = tables.fdj_alertes.map(a => ({ ...a }));

  const mutations = await ctx.__reconcilierAlertesChaine(alertesBrutes, ensemble);
  assert.strictEqual(mutations, true, 'reconcilierAlertesChaine doit signaler qu\'une mutation a eu lieu');

  // Résolution de l'alerte racine "chaine_interrompue".
  const alerteResolue = tables.fdj_alertes.find(a => a.id === 'alerte-chaine-1');
  assert.strictEqual(alerteResolue.resolue_automatiquement, true, 'L\'alerte chaîne interrompue doit être résolue automatiquement');
  assert.ok(alerteResolue.resolue_le, 'resolue_le doit être posé');
  assert.ok(tables.fdj_audit_log.some(l => l.action === 'fdj_chaine_retablie_automatiquement'), 'Trace d\'audit de rétablissement de chaîne');

  // g1 (stock_initial_auto=true) : corrigé automatiquement, JAMAIS d'alerte manuelle posée.
  const g1 = tables.fdj_shift_counts.find(c => c.shift_id === 'cur1' && c.game_id === 'g1');
  assert.strictEqual(g1.stock_initial, 40, 'g1 doit être corrigé automatiquement (stock_initial_auto=true)');
  assert.ok(!tables.fdj_alertes.some(a => a.type === 'continuite_stock_a_verifier' && a.game_id === 'g1'), 'g1 ne doit jamais recevoir d\'alerte manuelle — il a été corrigé tout seul');

  // g2 (stock_initial_auto=false) : jamais touché, alerte manuelle posée à la place.
  const g2 = tables.fdj_shift_counts.find(c => c.shift_id === 'cur1' && c.game_id === 'g2');
  assert.strictEqual(g2.stock_initial, 90, 'g2 (confirmé par un humain) ne doit JAMAIS être réécrit automatiquement');
  const alerteG2 = tables.fdj_alertes.find(a => a.type === 'continuite_stock_a_verifier' && a.game_id === 'g2');
  assert.ok(alerteG2, 'g2 doit recevoir l\'alerte manuelle existante continuite_stock_a_verifier, comportement inchangé');
  assert.strictEqual(alerteG2.shift_id, 'cur1');
  assert.strictEqual(alerteG2.valeur_quart_precedent, 100);
  assert.strictEqual(alerteG2.valeur_saisie, 90);

  // Écart de caisse recalculé et réécrit (résolution + recalcul indissociables).
  const cash = tables.fdj_cash_controls[0];
  assert.strictEqual(cash.ecart, 5, 'L\'écart de caisse doit être recalculé avec la correction de g1 appliquée');

  console.log('OK — reconcilierAlertesChaine : résolution de l\'alerte, recalcul de l\'écart et flux manuel pour les jeux non-auto sont bien indissociables et corrects, bout en bout.');
}

// ------------------------------------------------------------
// 4) synchroniserRelevesApresRetablissementChaine — 16/08/2026, demande de
//    Frédéric : "Chaîne interrompue / donnée manquante → Relevé provisoire
//    — continuité à régulariser. Puis, lorsque le quart manquant est
//    complété : recalcul automatique, création d'une nouvelle version,
//    ancienne version conservée, statut final mis à jour." Un relevé
//    'provisoire' déjà posé (validation employé pendant que la chaîne
//    était rompue) doit recevoir une NOUVELLE version 'definitif' une fois
//    la chaîne rétablie et le stock intégralement corrigé — l'ancienne
//    version reste intacte, jamais réécrite.
// ------------------------------------------------------------
async function test4() {
  const jeuxTest = [{ id: 'g1', prix: 2 }];
  const tables = {
    fdj_alertes: [
      { id: 'alerte-chaine-2', site: 'site-test', type: 'chaine_interrompue', shift_id: 'cur2', shift_precedent_id: 'prev2', resolue_automatiquement: false, resolue_le: null },
    ],
    fdj_shift_counts: [
      { shift_id: 'prev2', game_id: 'g1', stock_final: 40 },
      { shift_id: 'cur2', game_id: 'g1', stock_initial: 35, appro: 5, stock_final: 20, ventes_qte: null, ventes_valeur: null, stock_initial_auto: true },
    ],
    fdj_reports: [
      { shift_id: 'cur2', type_rapport: 'journalier', lots_payes_grattage: 10 },
      { shift_id: 'cur2', type_rapport: 'temps_reel', caisse_tirages: 20 },
    ],
    fdj_cash_controls: [
      { shift_id: 'cur2', caisse_reelle: 190, regularisations: 5, ecart: 999, caisse_attendue: 999, ventes_grattage_valeur: 999, caisse_grattage: 999, confirme_le: '2026-08-16T20:00:00.000Z' },
    ],
    fdj_audit_log: [],
    // Relevé posé par l'employé PENDANT que la chaîne était encore rompue
    // (voir NEXUS-FDJ-v1.html::validerQuart, caractere='provisoire' dans
    // ce cas) — jamais réécrit par la suite, seule une nouvelle version
    // vient s'ajouter.
    fdj_releves_cloture: [
      {
        id: 'releve-v1', site: 'site-test', shift_id: 'cur2', date: '2026-08-16', quart: '2', employee_id: 'emp2',
        version_num: 1, type_version: 'validation_employe', cree_par: 'emp2',
        stock_initial_par_jeu: { g1: 35 }, appro_par_jeu: { g1: 5 }, stock_final_par_jeu: { g1: 20 }, ventes_par_jeu: { g1: { qte: 20, valeur: 40 } },
        ventes_grattage_valeur: 40, lots_payes_grattage: 10, caisse_tirages: 20, regularisations: 5,
        caisse_attendue: 55, caisse_reelle: 190, ecart: 135,
        statut: 'valide_avec_ecart', caractere: 'provisoire', anomalie_chaine: { rompue: true, manquants: [{ date: '2026-08-15', quart: '2' }] },
        signature: { utilisateur_id: 'emp2' },
      },
    ],
  };
  const ctx = nouveauContexte(tables, jeuxTest);

  const ensemble = [
    { id: 'prev2', date: '2026-08-16', quart: '1', statut: 'valide', employee_id: 'emp2' },
    { id: 'cur2', date: '2026-08-16', quart: '2', statut: 'valide', employee_id: 'emp2' },
  ];
  const alertesBrutes = tables.fdj_alertes.map(a => ({ ...a }));
  await ctx.__reconcilierAlertesChaine(alertesBrutes, ensemble);

  const relevesQuart = tables.fdj_releves_cloture.filter(r => r.shift_id === 'cur2').sort((a, b) => a.version_num - b.version_num);
  assert.strictEqual(relevesQuart.length, 2, 'Une nouvelle version doit être posée, la version 1 reste en place (2 lignes au total)');

  const v1 = relevesQuart[0];
  assert.strictEqual(v1.caractere, 'provisoire', 'La version 1 (posée pendant la rupture) ne doit JAMAIS être réécrite — elle reste provisoire pour toujours');
  assert.strictEqual(v1.ecart, 135, 'La version 1 conserve son écart original, jamais modifié');

  const v2 = relevesQuart[1];
  assert.strictEqual(v2.version_num, 2);
  assert.strictEqual(v2.type_version, 'recalcul_automatique_chaine', 'La nouvelle version doit être posée par NEXUS lui-même, jamais qualifiée de régularisation manager');
  assert.strictEqual(v2.cree_par, null, 'Aucun acteur humain — recalcul système (signature.role="system")');
  assert.strictEqual(v2.caractere, 'definitif', 'Chaîne rétablie ET aucune anomalie de stock restante -> le relevé devient enfin définitif');
  assert.strictEqual(v2.stock_initial_par_jeu.g1, 40, 'Le nouveau relevé reflète le stock_initial corrigé (40, hérité du vrai stock final du quart précédent)');
  assert.strictEqual(v2.ecart, 125, 'Le nouveau relevé porte l\'écart RECALCULÉ (190 caisse réelle - 65 attendue avec le stock corrigé)');
  assert.ok(v2.diff_vs_precedent, 'Un différentiel doit être posé (quelque chose a réellement changé)');
  assert.deepStrictEqual(v2.diff_vs_precedent.stock_initial_par_jeu, { g1: { avant: 35, apres: 40 } }, 'Diff : stock initial CASH-like 35 -> 40, exactement le mécanisme demandé par Frédéric');
  assert.deepStrictEqual(v2.diff_vs_precedent.ecart, { avant: 135, apres: 125 }, 'Diff : écart original 135€ -> écart recalculé 125€, les deux restent lisibles (v1 jamais effacée)');
  assert.strictEqual(v2.signature.role, 'system', 'Signature explicite "system" — jamais attribuée à un humain qui n\'a rien fait');

  console.log('OK — synchroniserRelevesApresRetablissementChaine : nouvelle version définitive posée après rétablissement de chaîne, version provisoire originale jamais réécrite, diff exact.');
}

(async () => {
  await test2();
  await test3();
  await test4();
  console.log('\nTous les tests "continuité FDJ v2 — recalcul automatique" passent.');
})().catch(e => { console.error(e); process.exit(1); });
