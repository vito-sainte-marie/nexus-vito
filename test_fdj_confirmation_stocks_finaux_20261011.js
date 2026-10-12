// Test — confirmation des stocks finaux avant clôture (handoff MISSION
// PATRIMOINE du 11/10/2026, decision-1 de l'arbitre).
//
// Règle arbitrée : à la validation d'un quart FDJ, aucune quantité finale ne
// reste indéterminée. Fin vide à stock disponible nul -> 0 explicite, posé et
// tracé. Fin vide à stock disponible > 0 (ou début inconnu) -> une fenêtre
// unique demande, jeu par jeu et sans choix présélectionné, « Confirmer 0 »
// ou « Corriger la saisie » ; la validation reste impossible tant qu'un jeu
// n'a pas de choix. Mêmes règles pour l'employé, le manager et les
// régularisations. Une quantité saisie n'est jamais remplacée par 0.
//
// Ce test garde :
//   · le moteur (NexusFdjMoteur.stocksFinauxAConfirmer) ;
//   · la fenêtre de choix des deux écrans, exécutée sur un DOM minimal ;
//   · le câblage des écrans (garde avant tout envoi, refus serveur relu,
//     marqueur stock_final_confirme_zero envoyé seulement à la validation) ;
//   · la migration 20261011220000 (gardes des six commandes, aucune fin
//     saisie remplacée, aucun mouvement de stock, ACL).
// Chaque contrôle est éprouvé par mutation : la source mutée doit le faire
// rougir, sinon le contrôle ne protège rien.
//
// Le comportement en base est recetté sous rollback sur nexus-test :
// docs/recette/fdj-continuite-quantite-absente-zero-20261011.md.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

require(path.join(__dirname, 'nexus-fdj-moteur.js'));
const M = globalThis.NexusFdjMoteur;
assert.ok(M, 'NexusFdjMoteur non chargé');

const SOURCES = {
  employe: fs.readFileSync(path.join(__dirname, 'NEXUS-FDJ-v1.html'), 'utf8'),
  manager: fs.readFileSync(path.join(__dirname, 'NEXUS-FDJ-Manager-v1.html'), 'utf8'),
  migration: fs.readFileSync(path.join(__dirname, 'supabase', 'migrations',
    '20261011220000_fdj_confirmation_stocks_finaux.sql'), 'utf8'),
};

// ------------------------------------------------------------------
// 1. Moteur.
// ------------------------------------------------------------------
let nbTests = 0, nbOk = 0;
function test(nom, fn) {
  nbTests++;
  try { fn(); nbOk++; console.log(`  OK  ${nom}`); }
  catch (e) { console.log(`FAIL  ${nom}`); console.log(`      ${e.message}`); }
}

test('moteur : exports stocksFinauxAConfirmer et absentStock', () => {
  assert.strictEqual(typeof M.stocksFinauxAConfirmer, 'function');
  assert.strictEqual(typeof M.absentStock, 'function');
});

test('moteur : une fin saisie (0, \'3\', 7) ne demande rien', () => {
  const r = M.stocksFinauxAConfirmer([
    { game_id: 'a', stock_initial: 5, appro: 0, stock_final: 0 },
    { game_id: 'b', stock_initial: 5, appro: 0, stock_final: '3' },
    { game_id: 'c', stock_initial: 10, appro: 2, stock_final: 7 },
  ]);
  assert.deepStrictEqual(r, { zeroAutomatique: [], aConfirmer: [] });
});

test('moteur : fin vide à stock disponible nul -> zéro automatique', () => {
  const r = M.stocksFinauxAConfirmer([
    { game_id: 'a', stock_initial: 0, appro: 0, stock_final: null },
    { game_id: 'b', stock_initial: 0, appro: null, stock_final: '' },
  ]);
  assert.deepStrictEqual(r, { zeroAutomatique: ['a', 'b'], aConfirmer: [] });
});

test('moteur : fin vide à stock disponible > 0 -> à confirmer, avec le disponible', () => {
  const r = M.stocksFinauxAConfirmer([
    { game_id: 'a', stock_initial: 4, appro: 0, stock_final: null },
    { game_id: 'b', stock_initial: 0, appro: 25, stock_final: undefined },
    { game_id: 'c', stock_initial: '5', appro: '2', stock_final: '' },
  ]);
  assert.deepStrictEqual(r.zeroAutomatique, []);
  assert.deepStrictEqual(r.aConfirmer, [
    { game_id: 'a', disponible: 4 },
    { game_id: 'b', disponible: 25 },
    { game_id: 'c', disponible: 7 },
  ]);
});

test('moteur : début inconnu -> à confirmer, disponible null', () => {
  const r = M.stocksFinauxAConfirmer([{ game_id: 'a', stock_initial: null, appro: 3, stock_final: null }]);
  assert.deepStrictEqual(r, { zeroAutomatique: [], aConfirmer: [{ game_id: 'a', disponible: null }] });
});

test('moteur : plusieurs jeux, ordre conservé, cas mêlés', () => {
  const r = M.stocksFinauxAConfirmer([
    { game_id: 'z', stock_initial: 2, appro: 0, stock_final: null },
    { game_id: 'y', stock_initial: 0, appro: 0, stock_final: null },
    { game_id: 'x', stock_initial: 8, appro: 0, stock_final: 8 },
    { game_id: 'w', stock_initial: 1, appro: 0, stock_final: null },
  ]);
  assert.deepStrictEqual(r.zeroAutomatique, ['y']);
  assert.deepStrictEqual(r.aConfirmer.map(a => a.game_id), ['z', 'w']);
});

test('moteur : entrée null ou vide, ligne sans game_id ignorée', () => {
  assert.deepStrictEqual(M.stocksFinauxAConfirmer(null), { zeroAutomatique: [], aConfirmer: [] });
  assert.deepStrictEqual(M.stocksFinauxAConfirmer([]), { zeroAutomatique: [], aConfirmer: [] });
  assert.deepStrictEqual(M.stocksFinauxAConfirmer([null, { stock_initial: 4, stock_final: null }]),
    { zeroAutomatique: [], aConfirmer: [] });
});

// ------------------------------------------------------------------
// 2. Outils d'extraction.
// ------------------------------------------------------------------
// Fonction de premier niveau d'un écran : de « function nom( » (indentée de
// deux espaces) jusqu'à la première accolade fermante au même niveau.
function extraireFonction(src, nom) {
  const m = new RegExp(`^  (async )?function ${nom}\\(`, 'm').exec(src);
  if (!m) throw new Error(`${nom} absente`);
  const fin = src.indexOf('\n  }\n', m.index);
  if (fin < 0) throw new Error(`${nom} : fin introuvable`);
  return src.slice(m.index, fin + 4) + '\n';
}
function extraireFmtNum(src) {
  const m = /^\s*function fmtNum\(n\) \{.*\}$/m.exec(src);
  if (!m) throw new Error('fmtNum absente');
  return m[0] + '\n';
}
function tranche(src, debut, fin) {
  const i = src.indexOf(debut);
  if (i < 0) throw new Error(`début de tranche introuvable : ${debut}`);
  const j = src.indexOf(fin, i + debut.length);
  if (j < 0) throw new Error(`fin de tranche introuvable : ${fin}`);
  return src.slice(i, j + fin.length);
}
// Corps d'une fonction de la migration, en-tête compris. Jamais le fichier
// entier : l'en-tête de commentaires cite les mêmes noms.
function corpsFonction(sql, nom) {
  const m = new RegExp(`create or replace function public\\.${nom}\\(`, 'i').exec(sql);
  if (!m) throw new Error(`${nom} absente de la migration`);
  const reste = sql.slice(m.index);
  const ouverture = /\bas (\$(?:function)?\$)/i.exec(reste);
  if (!ouverture) throw new Error(`${nom} : corps introuvable`);
  const debut = ouverture.index + ouverture[0].length;
  const j = reste.indexOf(ouverture[1], debut);
  if (j < 0) throw new Error(`${nom} : fin du corps introuvable`);
  return reste.slice(0, j);
}
function avant(texte, a, b, contexte) {
  const ia = typeof a === 'string' ? texte.indexOf(a) : texte.search(a);
  const ib = typeof b === 'string' ? texte.indexOf(b) : texte.search(b);
  if (ia < 0) throw new Error(`${contexte} : ${a} absent`);
  if (ib < 0) throw new Error(`${contexte} : ${b} absent`);
  if (ia > ib) throw new Error(`${contexte} : ${a} doit précéder ${b}`);
}

// ------------------------------------------------------------------
// 3. DOM minimal pour exécuter la fenêtre de choix.
// ------------------------------------------------------------------
class El {
  constructor(tag) {
    this.tagName = tag; this.className = ''; this.id = ''; this.type = '';
    this.textContent = ''; this.innerHTML = ''; this.disabled = false;
    this.dataset = {}; this.attributs = {}; this.children = []; this.parent = null;
    this.ecouteurs = {};
  }
  setAttribute(k, v) { this.attributs[k] = String(v); }
  getAttribute(k) { return k in this.attributs ? this.attributs[k] : null; }
  appendChild(e) { e.parent = this; this.children.push(e); return e; }
  append(...es) { es.forEach(e => this.appendChild(e)); }
  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter(c => c !== this);
    this.parent = null;
  }
  addEventListener(t, f) { (this.ecouteurs[t] = this.ecouteurs[t] || []).push(f); }
  // Un clic atteint les écouteurs même sur un bouton désactivé : la garde
  // doit tenir dans le code, pas seulement dans l'attribut.
  click() {
    const ev = { target: this, preventDefault() {}, stopPropagation() {} };
    for (let n = this; n; n = n.parent) (n.ecouteurs.click || []).forEach(f => f(ev));
  }
  querySelectorAll(sel) {
    const cls = sel.replace(/^\./, '');
    const out = [];
    const marcher = e => e.children.forEach(c => {
      if (c.className.split(' ').includes(cls)) out.push(c);
      marcher(c);
    });
    marcher(this);
    return out;
  }
}
function nouveauDocument() {
  return { body: new El('body'), createElement: tag => new El(tag) };
}
function chargerFenetre(src) {
  const document = nouveauDocument();
  const code = extraireFmtNum(src) + extraireFonction(src, 'libelleDisponible')
    + extraireFonction(src, 'resoudreStocksFinaux')
    + '\nreturn { resoudreStocksFinaux, libelleDisponible };';
  return Object.assign({ document }, new Function('document', code)(document));
}
const attendreTour = () => new Promise(r => setImmediate(r));
async function issue(promesse) {
  let fait = false, valeur;
  promesse.then(v => { fait = true; valeur = v; });
  await attendreTour();
  return { fait, valeur };
}

async function controlerFenetre(src) {
  const { document, resoudreStocksFinaux, libelleDisponible } = chargerFenetre(src);
  const liste = [
    { game_id: 'a', nom: 'CHAMBRE FORTE', libelleDispo: libelleDisponible(5) },
    { game_id: 'b', nom: 'BANCO 1€', libelleDispo: libelleDisponible(null) },
  ];
  const p = resoudreStocksFinaux(liste);
  const overlay = document.body.children[0];
  assert.ok(overlay, 'aucune fenêtre ouverte');
  const blocs = overlay.querySelectorAll('.stock-final-choix');
  assert.strictEqual(blocs.length, 2, 'une fenêtre unique doit lister les deux jeux');
  assert.strictEqual(blocs[0].querySelectorAll('.stock-final-question')[0].textContent,
    'Le stock final de CHAMBRE FORTE est-il bien de 0 ticket, ou avez-vous oublié de le renseigner ?');
  assert.strictEqual(blocs[1].querySelectorAll('.stock-final-dispo')[0].textContent, 'stock de départ inconnu');
  const boutons = overlay.querySelectorAll('.stock-final-bouton');
  assert.strictEqual(boutons.length, 4);
  assert.ok(boutons.every(b => b.getAttribute('aria-pressed') === 'false'), 'un choix est présélectionné');
  const valider = overlay.querySelectorAll('btn-primary')[0];
  assert.ok(valider && valider.textContent === 'Valider ces choix', 'bouton de validation absent');
  assert.strictEqual(valider.disabled, true, 'validation possible avant tout choix');
  valider.click();
  assert.strictEqual((await issue(p)).fait, false, 'la fenêtre se ferme sans aucun choix');

  const [aConfirmer, , , bCorriger] = boutons;
  assert.strictEqual(aConfirmer.textContent, 'Confirmer 0');
  assert.strictEqual(bCorriger.textContent, 'Corriger la saisie');
  aConfirmer.click();
  assert.strictEqual(aConfirmer.getAttribute('aria-pressed'), 'true');
  assert.strictEqual(valider.disabled, true, 'validation possible avec un jeu sans choix');
  valider.click();
  assert.strictEqual((await issue(p)).fait, false, 'la fenêtre se ferme avec un jeu sans choix');
  assert.strictEqual(document.body.children.length, 1, 'un clic de choix a fermé la fenêtre');

  bCorriger.click();
  assert.strictEqual(valider.disabled, false);
  valider.click();
  const r = await issue(p);
  assert.ok(r.fait, 'la fenêtre ne se ferme pas avec tous les choix');
  assert.deepStrictEqual(r.valeur, { confirmes: ['a'], corriger: ['b'] });
  assert.strictEqual(document.body.children.length, 0, 'fenêtre restée affichée');

  // Retour et clic hors fenêtre : rien n'est décidé.
  const p2 = resoudreStocksFinaux(liste.slice(0, 1));
  const retour = document.body.children[0].querySelectorAll('btn-ghost')[0];
  retour.click();
  assert.deepStrictEqual(await issue(p2), { fait: true, valeur: null });
  const p3 = resoudreStocksFinaux(liste.slice(0, 1));
  document.body.children[0].click();
  assert.deepStrictEqual(await issue(p3), { fait: true, valeur: null });

  assert.strictEqual(libelleDisponible(1), '1 ticket disponible');
  assert.strictEqual(libelleDisponible(5), '5 tickets disponibles');
}

// ------------------------------------------------------------------
// 4. Contrôles.
// ------------------------------------------------------------------
const MIG_HELPERS = [
  'fdj_stocks_finaux_a_confirmer(uuid, jsonb, boolean)',
  'fdj_poser_stocks_finaux_confirmes(uuid, jsonb, text, uuid, boolean, boolean)',
  'fdj_exiger_stocks_finaux_determines(uuid, jsonb, text, uuid, boolean)',
];
const MIG_COMMANDES = [
  'fdj_confirmer_caisse(uuid, jsonb, numeric, numeric, numeric, numeric)',
  'fdj_corriger_caisse_confirmee(uuid, text, text, jsonb, numeric, numeric, numeric, numeric)',
  'fdj_manager_enregistrer_comptages(uuid, jsonb)',
  'fdj_manager_modifier_quart(uuid, date, text, text)',
  'fdj_manager_changer_statut_quart(uuid, text)',
  'fdj_manager_creer_quart(date, text, uuid, text)',
];
const exigerSur = (premier, source, seulement) => new RegExp(
  `perform public\\.fdj_exiger_stocks_finaux_determines\\(\\s*${premier},\\s*\\w+,\\s*'${source}',\\s*[^,]+,\\s*${seulement}\\s*\\)`);

const CONTROLES = {
  // --- Fenêtre de choix (règles 2 à 5) ---
  employe_fenetre_de_choix: S => controlerFenetre(S.employe),
  manager_fenetre_de_choix: S => controlerFenetre(S.manager),

  // --- Écran employé ---
  employe_garde_avant_reconciliation: S => {
    const h = tranche(S.employe, "getElementById('btnSuiteGrattage').addEventListener",
      'verifierReconciliationApproActivation()');
    // Tous les jeux de l'écran, saisis ou non (aucun jeu actif écarté).
    assert.ok(/stocksFinauxAConfirmer\(\s*jeux\.map\(/.test(h), 'la garde ne porte pas sur tous les jeux');
    avant(h, 'await resoudreStocksFinaux(', 'if (!reponse) return;', 'grattage');
    avant(h, 'if (!reponse) return;', 'verifierReconciliationApproActivation()', 'grattage');
    assert.ok(/if \(reponse\.corriger\.length\) \{ revenirAuJeuACorriger\(reponse\.corriger\[0\]\); return; \}/.test(h),
      '« Corriger la saisie » ne revient pas au jeu');
  },
  employe_aucun_confirm_natif: S => {
    const zones = [
      tranche(S.employe, "getElementById('btnSuiteGrattage').addEventListener", 'verifierReconciliationApproActivation()'),
      tranche(S.employe, 'async function orchestrerSortieCaisse()', 'function renderConfirmationBrouillon'),
      extraireFonction(S.employe, 'resoudreStocksFinaux'),
    ];
    zones.forEach(z => assert.ok(!/\bconfirm\(/.test(z), 'confirm() natif dans le parcours de confirmation'));
  },
  employe_refus_serveur_propose_le_choix: S => {
    const o = tranche(S.employe, 'async function orchestrerSortieCaisse()', 'function renderConfirmationBrouillon');
    const motifMigration = /'motif', '(stocks_finaux_a_confirmer)',/.exec(corpsFonction(S.migration, 'fdj_confirmer_caisse'));
    assert.ok(motifMigration, 'motif de refus absent de fdj_confirmer_caisse');
    assert.ok(o.includes(`data.motif === '${motifMigration[1]}'`), 'l\'écran ne reconnaît pas le refus du serveur');
    avant(o, 'await resoudreStocksFinaux(', 'if (!reponse) return; // fenêtre refermée', 'sortie de caisse');
    avant(o, 'if (!reponse) return; // fenêtre refermée', 'chargeUtileCaisse(false)));', 'sortie de caisse');
  },
  employe_marqueur_seulement_a_la_validation: S => {
    const f = new Function('jeux', 'countsSaisie',
      extraireFonction(S.employe, 'construireComptagesAEnvoyer') + '\nreturn construireComptagesAEnvoyer;');
    const jeux = [{ id: 'a' }, { id: 'b' }];
    const counts = {
      a: { stock_initial: 5, appro: 0, stock_final: 0, stock_final_confirme_zero: true },
      b: { stock_initial: 5, appro: 0, stock_final: 3, stock_final_confirme_zero: true },
    };
    const v = f(jeux, counts)(false);
    assert.deepStrictEqual(v[0], { game_id: 'a', stock_initial: 5, appro: 0, stock_final: 0, stock_final_confirme_zero: true },
      'validation : le 0 confirmé n\'est pas marqué');
    assert.deepStrictEqual(v[1], { game_id: 'b', stock_initial: 5, appro: 0, stock_final: 3 },
      'une quantité saisie porte le marqueur');
    const b = f(jeux, counts)(true);
    assert.deepStrictEqual(b[0], { game_id: 'a', stock_initial: 5, appro: 0, stock_final: null },
      'brouillon : un 0 confirmé est écrit ou marqué avant la validation');
    assert.strictEqual(b[1].stock_final, 3);
  },
  employe_saisie_efface_la_confirmation: S => {
    const w = extraireFonction(S.employe, 'wireJeuInputs');
    assert.ok(w.includes("if (champ === 'stock_final') delete countsSaisie[gameId].stock_final_confirme_zero;"),
      'une frappe dans le stock final garde la confirmation précédente');
  },

  // --- Écran manager ---
  manager_lecture_du_refus_serveur: S => {
    const f = new Function(extraireFmtNum(S.manager) + extraireFonction(S.manager, 'libelleDisponible')
      + extraireFonction(S.manager, 'stocksFinauxDepuisErreur') + '\nreturn stocksFinauxDepuisErreur;')();
    const m1 = '[{"nom": "CHAMBRE FORTE", "appro": 0, "game_id": "b0fc194b-f8c3-4bbd-8d34-bc202040e6f6", "libelle": "CHAMBRE FORTE (5 tickets disponibles)", "disponible": 5, "stock_initial": 5}]';
    assert.deepStrictEqual(f({ code: '23514', details: m1, message: 'Stock final non déterminé' }),
      [{ game_id: 'b0fc194b-f8c3-4bbd-8d34-bc202040e6f6', nom: 'CHAMBRE FORTE', libelleDispo: '5 tickets disponibles' }]);
    const m3 = JSON.stringify([
      { nom: 'BANCO 1€', game_id: 'f722103a-04c3-4bc2-a703-59d8dd2d966c', disponible: 4 },
      { nom: 'CHAMBRE FORTE', game_id: 'b0fc194b-f8c3-4bbd-8d34-bc202040e6f6', disponible: 5 },
      { nom: 'INCONNU', game_id: 'c', disponible: null },
    ]);
    assert.deepStrictEqual(f({ code: '23514', details: m3 }).map(x => [x.nom, x.libelleDispo]),
      [['BANCO 1€', '4 tickets disponibles'], ['CHAMBRE FORTE', '5 tickets disponibles'], ['INCONNU', 'stock de départ inconnu']]);
    assert.strictEqual(f(null), null);
    assert.strictEqual(f({ code: '42501', details: m1 }), null, 'une autre erreur ouvre la fenêtre');
    assert.strictEqual(f({ code: '23514', details: 'pas du json' }), null);
    assert.strictEqual(f({ code: '23514', details: '[]' }), null);
  },
  manager_passage_a_valide_couvre_tous_les_jeux_actifs: S => {
    const f = new Function('jeux', 'edition', 'NexusFdjMoteur', 'lignesComptagesEdition',
      extraireFmtNum(S.manager) + extraireFonction(S.manager, 'libelleDisponible')
      + extraireFonction(S.manager, 'stocksFinauxAConfirmerEdition') + '\nreturn stocksFinauxAConfirmerEdition;');
    const jeux = [{ id: 'a', nom: 'A' }, { id: 'b', nom: 'B' }, { id: 'c', nom: 'C' }, { id: 'd', nom: 'D' }];
    const edition = { counts: {
      a: { stock_initial: 5, appro: 0, stock_final: null },
      c: { stock_initial: 0, appro: 0, stock_final: null },
      d: { stock_initial: 5, appro: 0, stock_final: 0, stock_final_confirme_zero: true },
    } };
    const r = f(jeux, edition, M, () => [])(true);
    assert.deepStrictEqual(r, [
      { game_id: 'a', nom: 'A', libelleDispo: '5 tickets disponibles' },
      { game_id: 'b', nom: 'B', libelleDispo: 'stock de départ inconnu' },
    ], 'un jeu actif sans comptage est écarté du passage à « Validé »');
  },
  manager_garde_avant_reseau: S => {
    const e = extraireFonction(S.manager, 'enregistrerEdition');
    const garde = 'if (await resoudreListeStocksFinaux(aConfirmer) === \'stop\') return;';
    const i = e.indexOf(garde);
    assert.ok(i > 0, 'garde de l\'écran absente avant l\'enregistrement');
    assert.ok(!e.slice(0, i).includes('nexusClient.rpc('), 'une commande part avant la garde');
    avant(e, garde, "nexusClient.rpc('fdj_manager_modifier_quart'", 'enregistrerEdition');
    avant(e, garde, "nexusClient.rpc('fdj_manager_creer_quart'", 'enregistrerEdition');
  },
  manager_validation_apres_comptages: S => {
    const e = extraireFonction(S.manager, 'enregistrerEdition');
    const k = e.indexOf('    if (validerApresComptages) {');
    assert.ok(k > 0, 'validation après comptages absente');
    avant(e, "nexusClient.rpc('fdj_manager_enregistrer_comptages'", '    if (validerApresComptages) {', 'enregistrerEdition');
    const statuts = e.slice(0, k).match(/p_statut: [^\n]+/g) || [];
    assert.strictEqual(statuts.length, 3, `p_statut avant les comptages : ${statuts.length} au lieu de 3`);
    statuts.forEach(s => assert.ok(/passeAValide \?|existant\.statut !== 'valide'\) \? existant\.statut/.test(s),
      `un quart passe à « Validé » avant ses comptages : ${s}`));
    assert.ok(/p_statut: 'valide'/.test(e.slice(k)), 'la validation finale n\'est pas demandée');
  },
  manager_confirmation_preserve_la_saisie: S => {
    const f = new Function('edition', 'NexusFdjMoteur',
      extraireFonction(S.manager, 'appliquerChoixStocksFinauxEdition') + '\nreturn appliquerChoixStocksFinauxEdition;');
    const edition = { counts: {
      a: { stock_initial: 5, appro: 0, stock_final: 3 },
      b: { stock_initial: 5, appro: 0, stock_final: null },
      c: { stock_initial: 5, appro: 0, stock_final: 0 },
    } };
    f(edition, M)({ confirmes: ['a', 'b', 'c', 'd'], corriger: [] });
    assert.deepStrictEqual(edition.counts.a, { stock_initial: 5, appro: 0, stock_final: 3 }, 'une quantité saisie est remplacée par 0');
    assert.deepStrictEqual(edition.counts.b, { stock_initial: 5, appro: 0, stock_final: 0, stock_final_confirme_zero: true });
    assert.strictEqual(edition.counts.c.stock_final_confirme_zero, true);
    assert.deepStrictEqual(edition.counts.d, { stock_initial: null, appro: 0, stock_final: 0, stock_final_confirme_zero: true });
  },
  manager_saisie_efface_la_confirmation: S => {
    assert.ok(S.manager.includes("if (champ === 'stock_final') delete edition.counts[gameId].stock_final_confirme_zero;"),
      'une frappe dans le stock final garde la confirmation précédente');
  },

  // --- Migration 20261011220000 ---
  migration_refus_lisible_par_l_ecran: S => {
    const x = corpsFonction(S.migration, 'fdj_exiger_stocks_finaux_determines');
    assert.ok(/using errcode = 'check_violation', detail = v_a_confirmer::text;/.test(x),
      'le refus n\'est pas un 23514 portant la liste des jeux');
    assert.ok(S.manager.includes("error.code !== '23514'"), 'l\'écran manager ne lit pas le 23514');
  },
  migration_aucune_fin_saisie_remplacee: S => {
    const p = corpsFonction(S.migration, 'fdj_poser_stocks_finaux_confirmes');
    assert.ok(/update public\.fdj_shift_counts c[\s\S]*?where c\.id = v_r\.id\s+and c\.stock_final is null;/.test(p),
      'l\'écriture du 0 ne se limite pas aux fins vides');
    assert.ok(p.includes('(c.stock_final is null or c.stock_final = 0))'),
      'une confirmation à 0 peut viser une quantité saisie');
    assert.strictEqual((S.migration.match(/update public\.fdj_shift_counts/g) || []).length, 1,
      'la migration écrit les comptages ailleurs que dans la pose du 0');
  },
  migration_aucun_mouvement_de_stock: S => {
    assert.ok(!/fdj_stock_movements/.test(S.migration), 'la migration touche les mouvements de stock');
    assert.ok(!/\bdelete\s+from\b/i.test(S.migration), 'la migration supprime des lignes');
    assert.ok(!/\btruncate\b/i.test(S.migration), 'la migration vide une table');
  },
  migration_zero_automatique_a_stock_nul: S => {
    const a = corpsFonction(S.migration, 'fdj_stocks_finaux_a_confirmer');
    assert.ok(a.includes('and not (c.stock_initial is not null and c.stock_initial + coalesce(c.appro, 0) = 0);'),
      'un stock disponible nul est demandé à l\'utilisateur');
    const x = corpsFonction(S.migration, 'fdj_exiger_stocks_finaux_determines');
    assert.ok(/p_shift_id, p_comptages, p_source, p_acteur, p_seulement_comptages, true\s*\)/.test(x),
      'la garde ne pose pas le 0 automatique');
    assert.ok(corpsFonction(S.migration, 'fdj_poser_stocks_finaux_confirmes').includes("'stock_final_zero_automatique'"),
      'le 0 automatique n\'est pas tracé');
  },
  migration_confirmer_caisse_propose_le_choix: S => {
    const c = corpsFonction(S.migration, 'fdj_confirmer_caisse');
    avant(c, 'public.fdj_ecrire_saisies_caisse(', 'public.fdj_stocks_finaux_a_confirmer(', 'fdj_confirmer_caisse');
    avant(c, 'public.fdj_stocks_finaux_a_confirmer(', "'motif', 'stocks_finaux_a_confirmer',", 'fdj_confirmer_caisse');
    avant(c, "'motif', 'stocks_finaux_a_confirmer',", 'public.fdj_calculer_caisse(', 'fdj_confirmer_caisse');
    avant(c, "'motif', 'stocks_finaux_a_confirmer',", 'insert into public.fdj_cash_controls', 'fdj_confirmer_caisse');
    assert.ok(/'jeux', v_a_confirmer,/.test(c), 'le refus ne porte pas la liste des jeux');
    assert.ok(/fdj_poser_stocks_finaux_confirmes\(\s*p_shift_id, p_comptages, 'fdj_confirmer_caisse', v_uid, false, true\s*\)/.test(c),
      'la confirmation employé ne pose pas le 0 automatique ni les 0 confirmés');
    avant(c, 'fdj_poser_stocks_finaux_confirmes(', 'insert into public.fdj_cash_controls', 'fdj_confirmer_caisse');
  },
  migration_creer_quart_garde: S => {
    const c = corpsFonction(S.migration, 'fdj_manager_creer_quart');
    assert.ok(c.includes("case when p_statut = 'valide' then 'brouillon' else p_statut end,"),
      'un quart demandé « Validé » naît validé');
    const g = exigerSur('v_shift\\.id', 'fdj_manager_creer_quart', 'false');
    assert.ok(g.test(c), 'garde absente ou limitée aux comptages envoyés');
    avant(c, 'fdj_completer_continuite_quart(', g, 'fdj_manager_creer_quart');
    avant(c, g, "set statut = 'valide'", 'fdj_manager_creer_quart');
  },
  migration_modifier_quart_garde: S => {
    const c = corpsFonction(S.migration, 'fdj_manager_modifier_quart');
    const g = exigerSur('p_shift_id', 'fdj_manager_modifier_quart', 'false');
    assert.ok(g.test(c), 'garde absente ou limitée aux comptages envoyés');
    avant(c, "if p_statut = 'valide' and v_avant.statut is distinct from 'valide' then", g, 'fdj_manager_modifier_quart');
    avant(c, 'fdj_completer_continuite_quart(', g, 'fdj_manager_modifier_quart');
    avant(c, g, 'statut = p_statut', 'fdj_manager_modifier_quart');
  },
  migration_changer_statut_garde: S => {
    const c = corpsFonction(S.migration, 'fdj_manager_changer_statut_quart');
    const g = exigerSur('p_shift_id', 'fdj_manager_changer_statut_quart', 'false');
    assert.ok(g.test(c), 'garde absente ou limitée aux comptages envoyés');
    avant(c, "if p_statut = 'valide' and v_avant.statut is distinct from 'valide' then", g, 'fdj_manager_changer_statut_quart');
    avant(c, 'fdj_completer_continuite_quart(', g, 'fdj_manager_changer_statut_quart');
    avant(c, g, 'set statut = p_statut', 'fdj_manager_changer_statut_quart');
  },
  migration_date_de_validation_preservee: S => {
    const c = corpsFonction(S.migration, 'fdj_manager_modifier_quart');
    assert.ok(c.includes("valide_le = case when p_statut = 'valide' then coalesce(valide_le, now()) end"),
      'la date initiale de validation est réécrite');
  },
  migration_regularisation_manager_garde: S => {
    const c = corpsFonction(S.migration, 'fdj_manager_enregistrer_comptages');
    assert.ok(/if v_shift\.statut = 'valide' then\s*perform public\.fdj_exiger_stocks_finaux_determines\(/.test(c),
      'une régularisation d\'un quart validé n\'est pas gardée');
    avant(c, 'end loop;', 'fdj_exiger_stocks_finaux_determines(', 'fdj_manager_enregistrer_comptages');
  },
  migration_correction_caisse_garde: S => {
    const c = corpsFonction(S.migration, 'fdj_corriger_caisse_confirmee');
    assert.ok(/if p_comptages is not null then\s*perform public\.fdj_exiger_stocks_finaux_determines\(/.test(c),
      'une correction des comptages n\'est pas gardée');
    avant(c, 'public.fdj_ecrire_saisies_caisse(', 'fdj_exiger_stocks_finaux_determines(', 'fdj_corriger_caisse_confirmee');
    avant(c, 'fdj_exiger_stocks_finaux_determines(', 'public.fdj_calculer_caisse(', 'fdj_corriger_caisse_confirmee');
  },
  // Une régularisation ne bute pas sur un jeu qu'elle ne touche pas.
  migration_regularisation_bornee_aux_jeux_envoyes: S => {
    assert.ok(exigerSur('p_shift_id', 'fdj_corriger_caisse_confirmee', 'true')
      .test(corpsFonction(S.migration, 'fdj_corriger_caisse_confirmee')), 'correction : périmètre non borné');
    assert.ok(exigerSur('p_shift_id', 'fdj_manager_enregistrer_comptages', 'true')
      .test(corpsFonction(S.migration, 'fdj_manager_enregistrer_comptages')), 'régularisation : périmètre non borné');
  },
  migration_idempotence_confirmation: S => {
    const p = corpsFonction(S.migration, 'fdj_poser_stocks_finaux_confirmes');
    assert.ok(/elsif exists \(\s*select 1 from public\.fdj_audit_log a\s+where a\.shift_id = p_shift_id\s+and a\.action = 'confirmation_stock_final_zero'/.test(p),
      'une confirmation déjà tracée l\'est une seconde fois');
    assert.ok(/v_action := 'confirmation_stock_final_zero';/.test(p), 'le choix de l\'utilisateur n\'est pas tracé comme tel');
  },
  migration_acl: S => {
    const sql = S.migration;
    MIG_HELPERS.forEach(f => {
      ['public', 'anon', 'authenticated'].forEach(r =>
        assert.ok(sql.includes(`revoke all on function public.${f} from ${r};\n`), `${f} : pas de revoke ${r}`));
      assert.ok(sql.includes(`grant execute on function public.${f} to service_role;\n`), `${f} : pas de grant service_role`);
    });
    MIG_COMMANDES.forEach(f => {
      ['public', 'anon'].forEach(r =>
        assert.ok(sql.includes(`revoke all on function public.${f} from ${r};\n`), `${f} : pas de revoke ${r}`));
      ['authenticated', 'service_role'].forEach(r =>
        assert.ok(sql.includes(`grant execute on function public.${f} to ${r};\n`), `${f} : pas de grant ${r}`));
    });
    const grants = sql.match(/^grant [^;]+;/gm) || [];
    grants.forEach(g => {
      assert.ok(!/ to (anon|public)\b/.test(g), `droit ouvert : ${g}`);
      assert.ok(!(/ to authenticated/.test(g) && MIG_HELPERS.some(h => g.includes(h))), `aide ouverte : ${g}`);
    });
  },
  migration_a_confirmer_lecture_seule: S => {
    const a = corpsFonction(S.migration, 'fdj_stocks_finaux_a_confirmer');
    assert.ok(/\nstable\nsecurity definer\n/.test(a), 'la lecture des jeux à confirmer n\'est pas STABLE');
    assert.ok(!/\b(insert|update|delete)\b/i.test(a.replace(/--[^\n]*/g, '')), 'la lecture écrit');
  },
  migration_code_d_abord: S => {
    assert.ok(S.migration.includes("-- Ordre de déploiement : CODE D'ABORD."), 'ordre de déploiement non déclaré');
  },
};

const MUTATIONS = [
  // Fenêtre employé
  ['employe_fenetre_de_choix', 'employe', '      valider.disabled = true;\n', ''],
  ['employe_fenetre_de_choix', 'employe', "b.setAttribute('aria-pressed', 'false');", "b.setAttribute('aria-pressed', valeur === 'confirmer' ? 'true' : 'false');"],
  ['employe_fenetre_de_choix', 'employe', 'const choix = new Map();', "const choix = new Map(liste.map(l => [l.game_id, 'confirmer']));"],
  ['employe_fenetre_de_choix', 'employe', 'if (liste.some(l => !choix.has(l.game_id))) return;', ''],
  // Fenêtre manager
  ['manager_fenetre_de_choix', 'manager', "valider.textContent = 'Valider ces choix'; valider.disabled = true;", "valider.textContent = 'Valider ces choix';"],
  ['manager_fenetre_de_choix', 'manager', "b.setAttribute('aria-pressed', 'false');", "b.setAttribute('aria-pressed', valeur === 'confirmer' ? 'true' : 'false');"],
  ['manager_fenetre_de_choix', 'manager', 'const choix = new Map();', "const choix = new Map(liste.map(l => [l.game_id, 'confirmer']));"],
  ['manager_fenetre_de_choix', 'manager', 'if (liste.some(l => !choix.has(l.game_id))) return;', ''],
  // Écran employé
  ['employe_garde_avant_reconciliation', 'employe', "if (!reponse) return; // reste sur l'écran, rien n'est décidé", "// reste sur l'écran, rien n'est décidé"],
  ['employe_garde_avant_reconciliation', 'employe', 'jeux.map(j => Object.assign({ game_id: j.id }, countsSaisie[j.id]))', 'jeux.filter(j => countsSaisie[j.id]).map(j => Object.assign({ game_id: j.id }, countsSaisie[j.id]))'],
  ['employe_aucun_confirm_natif', 'employe', "if (!reponse) return; // reste sur l'écran, rien n'est décidé", "if (!reponse && !confirm('Valider quand même ?')) return; // reste sur l'écran, rien n'est décidé"],
  ['employe_refus_serveur_propose_le_choix', 'employe', "data.motif === 'stocks_finaux_a_confirmer'", "data.motif === 'saisie_incomplete'"],
  ['employe_refus_serveur_propose_le_choix', 'employe', 'if (!reponse) return; // fenêtre refermée : le brouillon serveur reste, rien n\'est validé', '// fenêtre refermée'],
  ['employe_refus_serveur_propose_le_choix', 'employe', '({ data, error } = await nexusClient.rpc(rpc, chargeUtileCaisse(false)));', '({ data, error } = await nexusClient.rpc(rpc, chargeUtileCaisse(true)));'],
  ['employe_marqueur_seulement_a_la_validation', 'employe', 'if (confirmeZero && !pourBrouillon) ligne.stock_final_confirme_zero = true;', 'if (s.stock_final_confirme_zero) ligne.stock_final_confirme_zero = true;'],
  ['employe_saisie_efface_la_confirmation', 'employe', "if (champ === 'stock_final') delete countsSaisie[gameId].stock_final_confirme_zero;", ''],
  // Écran manager
  ['manager_lecture_du_refus_serveur', 'manager', "if (!error || error.code !== '23514' || !error.details) return null;", 'if (!error || !error.details) return null;'],
  ['manager_passage_a_valide_couvre_tous_les_jeux_actifs', 'manager', 'const lignes = passeAValide\n', 'const lignes = false\n'],
  ['manager_garde_avant_reseau', 'manager', "if (await resoudreListeStocksFinaux(aConfirmer) === 'stop') return;", 'resoudreListeStocksFinaux(aConfirmer);'],
  ['manager_validation_apres_comptages', 'manager', "p_statut: passeAValide ? (edition.statutShiftBase || 'brouillon') : edition.statutShift", 'p_statut: edition.statutShift'],
  ['manager_validation_apres_comptages', 'manager', "p_statut: passeAValide ? 'brouillon' : edition.statutShift", 'p_statut: edition.statutShift'],
  ['manager_validation_apres_comptages', 'manager', '? existant.statut : edition.statutShift', '? edition.statutShift : edition.statutShift'],
  ['manager_validation_apres_comptages', 'manager', '    if (validerApresComptages) {', '    if (false) {'],
  ['manager_confirmation_preserve_la_saisie', 'manager', 'if (!NexusFdjMoteur.absentStock(s.stock_final) && Number(s.stock_final) !== 0) return;', ''],
  ['manager_saisie_efface_la_confirmation', 'manager', "if (champ === 'stock_final') delete edition.counts[gameId].stock_final_confirme_zero;", ''],
  // Migration
  ['migration_refus_lisible_par_l_ecran', 'migration', "using errcode = 'check_violation', detail = v_a_confirmer::text;", "using errcode = 'raise_exception';"],
  ['migration_aucune_fin_saisie_remplacee', 'migration', 'where c.id = v_r.id\n         and c.stock_final is null;', 'where c.id = v_r.id;'],
  ['migration_aucune_fin_saisie_remplacee', 'migration', '(c.stock_final is null or c.stock_final = 0))', 'true)'],
  ['migration_aucun_mouvement_de_stock', 'migration', "v_action := 'confirmation_stock_final_zero';", "delete from public.fdj_stock_movements where shift_id = p_shift_id; v_action := 'confirmation_stock_final_zero';"],
  ['migration_zero_automatique_a_stock_nul', 'migration', 'and not (c.stock_initial is not null and c.stock_initial + coalesce(c.appro, 0) = 0);', ';'],
  ['migration_zero_automatique_a_stock_nul', 'migration', 'p_shift_id, p_comptages, p_source, p_acteur, p_seulement_comptages, true', 'p_shift_id, p_comptages, p_source, p_acteur, p_seulement_comptages, false'],
  ['migration_confirmer_caisse_propose_le_choix', 'migration', "'motif', 'stocks_finaux_a_confirmer',", "'motif', 'saisie_incomplete',"],
  ['migration_confirmer_caisse_propose_le_choix', 'migration', "p_shift_id, p_comptages, 'fdj_confirmer_caisse', v_uid, false, true", "p_shift_id, p_comptages, 'fdj_confirmer_caisse', v_uid, false, false"],
  ['migration_creer_quart_garde', 'migration', "case when p_statut = 'valide' then 'brouillon' else p_statut end,", 'p_statut,'],
  ['migration_creer_quart_garde', 'migration', "v_shift.id, null, 'fdj_manager_creer_quart', (select auth.uid()), false", "v_shift.id, null, 'fdj_manager_creer_quart', (select auth.uid()), true"],
  ['migration_modifier_quart_garde', 'migration', "p_shift_id, null, 'fdj_manager_modifier_quart', (select auth.uid()), false", "p_shift_id, null, 'fdj_manager_modifier_quart', (select auth.uid()), true"],
  ['migration_changer_statut_garde', 'migration', "p_shift_id, null, 'fdj_manager_changer_statut_quart', (select auth.uid()), false", "p_shift_id, null, 'fdj_manager_changer_statut_quart', (select auth.uid()), true"],
  ['migration_date_de_validation_preservee', 'migration', "valide_le = case when p_statut = 'valide' then coalesce(valide_le, now()) end", "valide_le = case when p_statut = 'valide' then now() end"],
  ['migration_regularisation_manager_garde', 'migration', "if v_shift.statut = 'valide' then", 'if false then'],
  ['migration_correction_caisse_garde', 'migration', '  if p_comptages is not null then\n    perform public.fdj_exiger_stocks_finaux_determines(', '  if false then\n    perform public.fdj_exiger_stocks_finaux_determines('],
  ['migration_regularisation_bornee_aux_jeux_envoyes', 'migration', "p_shift_id, p_comptages, 'fdj_corriger_caisse_confirmee', v_uid, true", "p_shift_id, p_comptages, 'fdj_corriger_caisse_confirmee', v_uid, false"],
  ['migration_regularisation_bornee_aux_jeux_envoyes', 'migration', "p_shift_id, p_comptages, 'fdj_manager_enregistrer_comptages', (select auth.uid()), true\n", "p_shift_id, p_comptages, 'fdj_manager_enregistrer_comptages', (select auth.uid()), false\n"],
  ['migration_idempotence_confirmation', 'migration', "and a.action = 'confirmation_stock_final_zero'", "and a.action = 'jamais'"],
  ['migration_acl', 'migration', 'revoke all on function public.fdj_exiger_stocks_finaux_determines(uuid, jsonb, text, uuid, boolean) from authenticated;\n', 'grant execute on function public.fdj_exiger_stocks_finaux_determines(uuid, jsonb, text, uuid, boolean) to authenticated;\n'],
  ['migration_acl', 'migration', 'grant execute on function public.fdj_manager_creer_quart(date, text, uuid, text) to authenticated;\n', ''],
  ['migration_a_confirmer_lecture_seule', 'migration', 'stable\nsecurity definer', 'security definer'],
  ['migration_a_confirmer_lecture_seule', 'migration', 'return v_liste;', "insert into public.fdj_audit_log (action) values ('x'); return v_liste;"],
  ['migration_code_d_abord', 'migration', "-- Ordre de déploiement : CODE D'ABORD.", '-- Ordre de déploiement : indifférent.'],
];

// ------------------------------------------------------------------
// 5. Exécution : contrôles réels, puis preuve par mutation.
// ------------------------------------------------------------------
async function main() {
  const echecs = [];
  let reussis = 0;
  const executer = async (nom, sources) => {
    try { await CONTROLES[nom](sources); return null; }
    catch (e) { return e.message; }
  };

  for (const nom of Object.keys(CONTROLES)) {
    const err = await executer(nom, SOURCES);
    if (err) { echecs.push(`${nom} : ${err}`); console.log(`FAIL  ${nom}\n      ${err}`); }
    else { reussis++; console.log(`  OK  ${nom}`); }
  }

  const vises = new Set();
  for (const [nom, cle, ancre, remplacement] of MUTATIONS) {
    const libelle = `mutation ${nom} [${ancre.trim().slice(0, 60)}]`;
    if (!CONTROLES[nom]) { echecs.push(`${libelle} : contrôle inconnu`); continue; }
    vises.add(nom);
    const n = SOURCES[cle].split(ancre).length - 1;
    if (n !== 1) { echecs.push(`${libelle} : échec ancre ×${n}`); console.log(`FAIL  ${libelle} : échec ancre ×${n}`); continue; }
    const mutees = Object.assign({}, SOURCES, { [cle]: SOURCES[cle].replace(ancre, () => remplacement) });
    const err = await executer(nom, mutees);
    if (!err) { echecs.push(`${libelle} : la mutation ne fait pas rougir le contrôle`); console.log(`FAIL  ${libelle} : muet`); }
    else { reussis++; console.log(`  OK  ${libelle}`); }
  }
  Object.keys(CONTROLES).filter(n => !vises.has(n)).forEach(n => {
    echecs.push(`${n} : aucune mutation ne l'éprouve`);
    console.log(`FAIL  ${n} : aucune mutation ne l'éprouve`);
  });

  console.log(`\nMoteur : ${nbOk}/${nbTests} tests OK`);
  console.log(`${reussis} vérification(s) réussie(s), ${echecs.length} échec(s).`);
  if (echecs.length || nbOk !== nbTests) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
