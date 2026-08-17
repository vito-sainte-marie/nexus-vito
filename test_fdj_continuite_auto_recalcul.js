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
// FAUX CLIENT SUPABASE — générique, en mémoire, suffisant pour
// select/eq/in/order/limit/maybeSingle/single/update/insert/upsert. Ne
// simule qu'un filtrage exact par égalité (aucune requête de ce lot n'a
// besoin de plus), fidèle au style déjà établi dans ce projet (jamais
// jsdom, uniquement des objets minimaux).
// ------------------------------------------------------------
function creerNexusClientFake(tables) {
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
  return { from };
}

function nouveauContexte(tables, jeuxInitiaux) {
  const ctx = {
    console,
    NexusFdjMoteur,
    siteId: 'site-test',
    jeux: jeuxInitiaux || [],
    nexusClient: creerNexusClientFake(tables),
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

  const logRecalcul = tables.fdj_audit_log.find(l => l.action === 'fdj_ecart_recalcule_apres_retablissement_chaine');
  assert.ok(logRecalcul, 'Une trace d\'audit doit être posée pour le recalcul automatique (jamais un écrasement silencieux)');
  assert.strictEqual(logRecalcul.nouvelle_valeur.ecart, 5, 'La trace d\'audit doit porter le nouvel écart');

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
      { shift_id: 'cur1', caisse_reelle: 190, regularisations: 5, ecart: 999, caisse_attendue: 999, ventes_grattage_valeur: 999, caisse_grattage: 999 },
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
      { shift_id: 'cur2', caisse_reelle: 190, regularisations: 5, ecart: 999, caisse_attendue: 999, ventes_grattage_valeur: 999, caisse_grattage: 999 },
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
