// Test — Continuité FDJ : quantité absente traitée comme 0 (handoff
// MISSION PATRIMOINE du 11/10/2026, Frédéric).
//
// Cas constaté : MISSION PATRIMOINE (stock 0) a disparu, sans invite, de
// quatre quarts employé consécutifs. Une saisie manager avait créé sa ligne
// avec un début 0 et une fin vide ; l'écran n'héritait que des fins non
// vides, puis n'envoyait que les jeux comptés.
//
//   1. Moteur : stocksFinauxHerites hérite 0 d'une fin absente à stock nul,
//      la fin quand elle existe, et rien quand il restait du stock.
//   2. Écran : chargerDernierStockFinal passe par le moteur et lit début et
//      appro du quart précédent.
//   3. Migration : l'autorité métier est en base (fdj_stock_initial_herite,
//      fdj_completer_continuite_quart), câblée aux trois écritures employé,
//      sans jamais remplacer une valeur saisie ni toucher un quart validé.
//
// La base (séquence du handoff, appro réel, modification manager, quart déjà
// ouvert, quart certifié, cas inconnu, ACL) est éprouvée sous rollback sur
// nexus-test : voir docs/recette/fdj-continuite-quantite-absente-zero-20261011.md.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

require(path.join(__dirname, 'nexus-fdj-moteur.js'));
const M = globalThis.NexusFdjMoteur;
assert.ok(M, 'NexusFdjMoteur non chargé');

let nbTests = 0, nbOk = 0;
function test(nom, fn) {
  nbTests++;
  try {
    fn();
    nbOk++;
    console.log(`  OK  ${nom}`);
  } catch (e) {
    console.log(`FAIL  ${nom}`);
    console.log(`      ${e.message}`);
  }
}

test('Cas du handoff : fin absente, début 0, appro 0 -> hérité 0 (le jeu reste présent)', () => {
  const r = M.stocksFinauxHerites([{ game_id: 'mp', stock_initial: 0, appro: 0, stock_final: null }]);
  assert.deepStrictEqual(r, { mp: 0 });
  assert.deepStrictEqual(M.stocksFinauxHerites([{ game_id: 'mp', stock_initial: 0, appro: null, stock_final: '' }]), { mp: 0 }, 'appro absent = 0, fin vide = absente');
  assert.deepStrictEqual(M.stocksFinauxHerites([{ game_id: 'mp', stock_initial: 5, appro: -5, stock_final: null }]), { mp: 0 }, 'début + appro = 0');
});

test('Fin renseignée -> cette fin, jamais remplacée par 0', () => {
  assert.deepStrictEqual(M.stocksFinauxHerites([{ game_id: 'g', stock_initial: 10, appro: 5, stock_final: 7 }]), { g: 7 });
  assert.deepStrictEqual(M.stocksFinauxHerites([{ game_id: 'g', stock_initial: null, appro: 0, stock_final: 0 }]), { g: 0 });
  assert.deepStrictEqual(M.stocksFinauxHerites([{ game_id: 'g', stock_initial: 0, appro: 0, stock_final: '3' }]), { g: 3 }, 'fin numérique en texte');
});

test('Il restait du stock et la fin manque -> rien d\'hérité (0 fabriquerait une vente)', () => {
  assert.deepStrictEqual(M.stocksFinauxHerites([{ game_id: 'g', stock_initial: 4, appro: 0, stock_final: null }]), {});
  assert.deepStrictEqual(M.stocksFinauxHerites([{ game_id: 'g', stock_initial: 0, appro: 25, stock_final: null }]), {}, 'appro réel sans fin');
});

test('Ligne entièrement vide -> rien d\'hérité', () => {
  assert.deepStrictEqual(M.stocksFinauxHerites([{ game_id: 'g', stock_initial: null, appro: 0, stock_final: null }]), {});
  assert.deepStrictEqual(M.stocksFinauxHerites([]), {});
  assert.deepStrictEqual(M.stocksFinauxHerites(null), {});
});

test('Plusieurs jeux : chacun selon sa propre ligne', () => {
  const r = M.stocksFinauxHerites([
    { game_id: 'mp', stock_initial: 0, appro: 0, stock_final: null },
    { game_id: 'a', stock_initial: 10, appro: 0, stock_final: 8 },
    { game_id: 'b', stock_initial: 2, appro: 0, stock_final: null },
  ]);
  assert.deepStrictEqual(r, { mp: 0, a: 8 });
});

const html = fs.readFileSync(path.join(__dirname, 'NEXUS-FDJ-v1.html'), 'utf8');
test('Écran : chargerDernierStockFinal passe par le moteur et lit début et appro', () => {
  const i = html.indexOf('async function chargerDernierStockFinal(');
  assert.ok(i >= 0, 'fonction introuvable');
  const corps = html.slice(i, html.indexOf('\n  }\n', i));
  assert.ok(/select\('game_id, stock_initial, appro, stock_final'\)/.test(corps), 'début et appro lus');
  assert.ok(/return NexusFdjMoteur\.stocksFinauxHerites\(counts \|\| \[\]\)/.test(corps), 'héritage par le moteur');
  assert.ok(!/if \(c\.stock_final !== null\) map\[/.test(corps), 'l\'ancien filtre qui écartait les fins absentes a disparu');
});

const sql = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20261011200000_fdj_continuite_quantite_absente_zero.sql'), 'utf8');
// Les commandes redéfinies sont recopiées de pg_get_functiondef (majuscules,
// délimiteur $function$) ; les nouvelles sont écrites à la main ($$).
function corpsFonction(nom) {
  const m = new RegExp(`create or replace function public\\.${nom}\\(`, 'i').exec(sql);
  assert.ok(m, `${nom} absente de la migration`);
  const reste = sql.slice(m.index);
  const ouverture = /\bas (\$(?:function)?\$)/i.exec(reste);
  assert.ok(ouverture, `${nom} : corps introuvable`);
  const debut = ouverture.index + ouverture[0].length;
  const j = reste.indexOf(ouverture[1], debut);
  assert.ok(j > 0, `${nom} : fin du corps introuvable`);
  return reste.slice(0, j);
}

test('Migration : héritage en base, « inconnu » n\'est pas 0', () => {
  const h = corpsFonction('fdj_stock_initial_herite');
  assert.ok(/s\.statut = 'valide'/.test(h), 'seuls les quarts validés font foi');
  assert.ok(/stock_initial \+ coalesce\(v_src\.appro, 0\) = 0 then\s+-- [^\n]*\n\s+valeur := 0;\s+regle  := 'quantite_absente_zero'/.test(h), 'absent à stock nul -> 0');
  assert.ok(/valeur := null;\s+regle  := 'inconnu'/.test(h), 'il restait du stock -> inconnu, jamais 0');
  assert.ok(/regle  := 'jamais_compte'/.test(h), 'jeu jamais compté -> 0');
});

test('Migration : complétion bornée au brouillon, aux débuts NULL, tracée', () => {
  const c = corpsFonction('fdj_completer_continuite_quart');
  assert.ok(/statut <> 'brouillon'/.test(c) || /statut is distinct from 'brouillon'/.test(c), 'quart validé jamais touché');
  assert.ok(/c\.id is not null and c\.stock_initial is null/.test(c), 'seules les lignes sans début sont visées');
  assert.ok(/where c\.id = v_jeu\.count_id\s+and c\.stock_initial is null;/.test(c), 'jamais de remplacement d\'une valeur saisie');
  assert.ok(!/stock_final\s*=/.test(c) && !/appro\s*=/.test(c), 'ni fin ni appro écrites');
  assert.ok(!/fdj_stock_movements/.test(c), 'aucun mouvement de stock');
  assert.ok(/v_herite\.regle = 'inconnu'/.test(c) && c.includes("'continuite_stock_a_verifier'"), 'inconnu -> alerte, aucune valeur');
  assert.ok(c.includes("'correction_stock_initial'"), 'journal');
});

test('Migration : câblée aux trois écritures employé et à la confirmation', () => {
  ['fdj_ecrire_saisies_caisse', 'fdj_valider_ouverture_quart', 'fdj_incrementer_appro_shift_count'].forEach(nom => {
    assert.ok(/fdj_completer_continuite_quart\(/.test(corpsFonction(nom)), `${nom} n'appelle pas la complétion`);
  });
  const conf = corpsFonction('fdj_confirmer_caisse');
  assert.ok(conf.includes("'saisie_incomplete'"), 'fin absente avec stock restant refusée');
  assert.ok(/continuite_stock_a_verifier/.test(conf), 'relevé : continuité à vérifier lue dans les alertes');
});

test('Migration : nouvelles fonctions fermées à anon et authenticated', () => {
  ['fdj_stock_initial_herite(uuid, uuid)', 'fdj_completer_continuite_quart(uuid, text, uuid)'].forEach(sig => {
    const e = sig.replace(/[()]/g, '\\$&');
    assert.ok(new RegExp(`revoke all on function public\\.${e} from public`).test(sql), `${sig} : public`);
    assert.ok(new RegExp(`revoke all on function public\\.${e} from anon`).test(sql), `${sig} : anon`);
    assert.ok(new RegExp(`revoke all on function public\\.${e} from authenticated`).test(sql), `${sig} : authenticated`);
  });
});

console.log(`\n${nbOk}/${nbTests} tests OK`);
if (nbOk !== nbTests) process.exit(1);
