// Test — FDJ Fiabilisation Étape 4 (18/08/2026, cahier
// NEXUS_FDJ_Audit_Fiabilisation_Chaine_Quarts.pdf, §8 "Replay chronologique
// après correction rétroactive"). Couvre rejouerReleveApresPropagation :
// recalcule et repose une version de fdj_releves_cloture quand la
// propagation Étape 2 a modifié silencieusement ventes/écart du quart
// suivant, sans quoi le relevé affiché/exporté restait périmé sans alerte.
//
// Extrait la fonction réelle (jamais réécrite à la main) de
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
// FAUX CLIENT SUPABASE — même style minimal que test_fdj_continuite_auto_recalcul.js.
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
            // Tri par version_num décroissant si demandé (seul cas utilisé ici) —
            // le faux order() ci-dessus ignore ses arguments, donc on trie
            // systématiquement par version_num desc quand la colonne existe,
            // fidèle à l'usage réel de cette fonction (order + limit(1)).
            lignes = lignes.slice().sort((a, b) => (b.version_num || 0) - (a.version_num || 0));
            if (limiteN) lignes = lignes.slice(0, limiteN);
            resolve({ data: lignes, error: null });
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
    };
  }
  return { from };
}

function nouveauContexte(tables) {
  const ctx = {
    console,
    NexusFdjMoteur,
    siteId: 'site-test',
    nexusClient: creerNexusClientFake(tables),
  };
  ctx.globalThis = ctx;
  const src = [
    extraire('rejouerReleveApresPropagation'),
    'globalThis.__rejouerReleveApresPropagation = rejouerReleveApresPropagation;',
  ].join('\n\n');
  vm.runInNewContext(src, ctx);
  return ctx;
}

// ------------------------------------------------------------
// 1) Aucun relevé encore posé pour ce quart -> true (rien à synchroniser,
//    pas un échec) et aucune ligne insérée.
// ------------------------------------------------------------
async function test1() {
  const tables = { fdj_releves_cloture: [], fdj_shift_counts: [], fdj_reports: [], fdj_cash_controls: [], fdj_alertes: [] };
  const ctx = nouveauContexte(tables);
  const ok = await ctx.__rejouerReleveApresPropagation('shiftX', ['g1']);
  assert.strictEqual(ok, true);
  assert.strictEqual(tables.fdj_releves_cloture.length, 0);
  console.log('OK — pas de relevé existant -> rien à synchroniser, retourne true sans écriture.');
}

// ------------------------------------------------------------
// 2) Relevé existant, données réellement modifiées par la propagation
//    (ventes/écart mis à jour en base par appliquerCorrectionsAutomatiquesContinuite,
//    en amont de cette fonction) -> nouvelle version posée, ancienne
//    conservée, diff exact, jamais qualifié de régularisation manager.
// ------------------------------------------------------------
async function test2() {
  const tables = {
    fdj_releves_cloture: [{
      id: 'releve-v1', site: 'site-test', shift_id: 'cur1', date: '2026-08-17', quart: '2', employee_id: 'emp1',
      version_num: 1, type_version: 'validation_employe', cree_par: 'emp1',
      stock_initial_par_jeu: { g1: 35 }, appro_par_jeu: { g1: 5 }, stock_final_par_jeu: { g1: 20 }, ventes_par_jeu: { g1: { qte: 20, valeur: 40 } },
      ventes_grattage_valeur: 40, lots_payes_grattage: 10, caisse_tirages: 20, regularisations: 5,
      caisse_attendue: 55, caisse_reelle: 190, ecart: 135,
      statut: 'valide_avec_ecart', caractere: 'definitif', anomalie_chaine: { chaine_interrompue: false, continuite_stock_a_verifier: false },
      signature: { utilisateur_id: 'emp1' },
    }],
    // stock_initial déjà corrigé par appliquerCorrectionsAutomatiquesContinuite
    // avant l'appel (35 -> 40), ventes déjà recalculées (25 au lieu de 20).
    fdj_shift_counts: [{ shift_id: 'cur1', game_id: 'g1', stock_initial: 40, appro: 5, stock_final: 20, ventes_qte: 25, ventes_valeur: 50 }],
    fdj_reports: [
      { shift_id: 'cur1', type_rapport: 'journalier', lots_payes_grattage: 10 },
      { shift_id: 'cur1', type_rapport: 'temps_reel', caisse_tirages: 20 },
    ],
    fdj_cash_controls: [{ shift_id: 'cur1', caisse_reelle: 190, regularisations: 5, ecart: 125, caisse_attendue: 65, ventes_grattage_valeur: 50, caisse_grattage: 40 }],
    fdj_alertes: [],
  };
  const ctx = nouveauContexte(tables);
  const ok = await ctx.__rejouerReleveApresPropagation('cur1', ['g1']);
  assert.strictEqual(ok, true);

  const releves = tables.fdj_releves_cloture.filter(r => r.shift_id === 'cur1').sort((a, b) => a.version_num - b.version_num);
  assert.strictEqual(releves.length, 2, 'Une nouvelle version doit être posée, la version 1 reste intacte');
  assert.strictEqual(releves[0].ecart, 135, 'La version 1 ne doit jamais être réécrite');

  const v2 = releves[1];
  assert.strictEqual(v2.version_num, 2);
  assert.strictEqual(v2.type_version, 'recalcul_automatique_chaine', 'Jamais qualifié de régularisation manager — c\'est NEXUS qui recalcule, pas un humain');
  assert.strictEqual(v2.cree_par, null);
  assert.strictEqual(v2.ecart, 125, 'Le nouveau relevé porte l\'écart déjà recalculé en base par la propagation Étape 2');
  assert.strictEqual(v2.stock_initial_par_jeu.g1, 40);
  assert.ok(v2.diff_vs_precedent, 'Un différentiel doit être posé');
  assert.deepStrictEqual(v2.diff_vs_precedent.ecart, { avant: 135, apres: 125 });
  assert.ok(v2.motif_regularisation.includes('g1'), 'Le motif doit citer le(s) jeu(x) concerné(s) pour audit lisible');
  assert.strictEqual(v2.signature.role, 'system');

  console.log('OK — relevé existant + données réellement modifiées -> nouvelle version recalcul_automatique_chaine posée, diff exact, ancienne version intacte.');
}

// ------------------------------------------------------------
// 3) Relevé existant mais RIEN n'a réellement changé depuis la DERNIÈRE
//    version (ex. un deuxième appel après un premier recalcul déjà posé,
//    aucune correction supplémentaire depuis) -> aucune nouvelle version,
//    jamais un bruit inutile dans l'historique (même discipline que
//    synchroniserRelevesApresRetablissementChaine — voir statutRelevecloture,
//    qui force toujours 'recalcule_automatiquement' pour ce type_version :
//    seule une comparaison entre DEUX versions déjà de ce type peut donc
//    légitimement produire un diff vide).
// ------------------------------------------------------------
async function test3() {
  const releveDejaRecalcule = {
    id: 'releve-v1', site: 'site-test', shift_id: 'cur2', date: '2026-08-17', quart: '1', employee_id: 'emp2',
    version_num: 1, type_version: 'recalcul_automatique_chaine', cree_par: null,
    stock_initial_par_jeu: { g1: 40 }, appro_par_jeu: { g1: 0 }, stock_final_par_jeu: { g1: 20 }, ventes_par_jeu: { g1: { qte: 20, valeur: 40 } },
    ventes_grattage_valeur: 40, lots_payes_grattage: 0, caisse_tirages: 0, regularisations: 0,
    caisse_attendue: 40, caisse_reelle: 40, ecart: 0,
    statut: 'recalcule_automatiquement', caractere: 'definitif', anomalie_chaine: { chaine_interrompue: false, continuite_stock_a_verifier: false },
    signature: { utilisateur_id: null, role: 'system' },
  };
  const tables = {
    fdj_releves_cloture: [releveDejaRecalcule],
    fdj_shift_counts: [{ shift_id: 'cur2', game_id: 'g1', stock_initial: 40, appro: 0, stock_final: 20, ventes_qte: 20, ventes_valeur: 40 }],
    fdj_reports: [
      { shift_id: 'cur2', type_rapport: 'journalier', lots_payes_grattage: 0 },
      { shift_id: 'cur2', type_rapport: 'temps_reel', caisse_tirages: 0 },
    ],
    fdj_cash_controls: [{ shift_id: 'cur2', caisse_reelle: 40, regularisations: 0, ecart: 0, caisse_attendue: 40, ventes_grattage_valeur: 40, caisse_grattage: 40 }],
    fdj_alertes: [],
  };
  const ctx = nouveauContexte(tables);
  const ok = await ctx.__rejouerReleveApresPropagation('cur2', ['g1']);
  assert.strictEqual(ok, true);
  assert.strictEqual(tables.fdj_releves_cloture.filter(r => r.shift_id === 'cur2').length, 1, 'Rien n\'a changé depuis le dernier recalcul -> aucune nouvelle version, pas de bruit');
  console.log('OK — rien n\'a réellement changé depuis la dernière version -> aucune version inutile posée.');
}

(async () => {
  await test1();
  await test2();
  await test3();
  console.log('\nTous les tests "FDJ Fiabilisation Étape 4 — replay" passent.');
})().catch(e => { console.error(e); process.exit(1); });
