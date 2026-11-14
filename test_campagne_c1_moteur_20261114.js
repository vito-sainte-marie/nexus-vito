'use strict';
const assert = require('assert');
require('./nexus-simulateur-promo.js');
const S = globalThis.NexusSimulateurPromo;
const base = { paHabituelHt: 1.18, paPromoHt: 0.94, pvHabituelTtc: 2.15 * 1.085, pvPromoTtc: 1.3725 * 1.085, tva: 8.5, ventesJour: 1, jours: 30 };
const r = S.analyserObjectif(base);
assert.strictEqual(r.statut, 'ok');
assert(Math.abs(r.pvPromoHt - 1.3725) < 1e-9, 'TTC→HT avec la TVA du produit');
assert(Math.abs(r.margeHabituelle - 0.97) < 1e-9 && Math.abs(r.margePromo - 0.4325) < 1e-9, 'marges unitaires');
assert.strictEqual(r.seuil, 68, 'seuil exact arrondi au supérieur (67,28 → 68)');
assert.strictEqual(r.seuilPlus10, 75, '+10 % : 74,01 → 75');
assert(Math.abs(r.rythmeMin - 68 / 30) < 1e-9, 'rythme minimal décimal');
assert.strictEqual(r.objectifPropose, 3, 'objectif proposé = rythme minimal (seuil / jours) arrondi au supérieur');
{ const d = S.analyserObjectif(Object.assign({}, base, { ventesJour: 3, jours: 10 }));
  assert.strictEqual(d.objectifPropose, Math.ceil(d.seuil / 10 - 1e-9), 'objectif = plafond(seuil / jours)');
  assert.strictEqual(d.objectifPropose, 7, 'divergence : 6,8/jour → 7 (et non 8 avec le +10 %)');
  assert(d.seuilPlus10 > d.seuil, '+10 % reste une information secondaire'); }
assert.notStrictEqual(r.rythmeMin, r.objectifPropose, 'rythme et objectif jamais confondus');
assert.strictEqual(r.faisabilite, 'a-confirmer');
assert.strictEqual(S.plafond(67 + 1e-12), 67, 'tolérance flottant');
// faisabilité
assert.strictEqual(S.analyserObjectif(Object.assign({}, base, { meilleurRythmeObserve: 2 })).faisabilite, 'depasse-observe');
assert.strictEqual(S.analyserObjectif(Object.assign({}, base, { meilleurRythmeObserve: 5 })).faisabilite, 'dans-observe');
// cas limites
assert.strictEqual(S.analyserObjectif(Object.assign({}, base, { tva: null })).statut, 'tva-manquante');
assert.strictEqual(S.analyserObjectif(Object.assign({}, base, { pvPromoTtc: '' })).statut, 'prix-manquant');
assert.strictEqual(S.analyserObjectif(Object.assign({}, base, { paPromoHt: 1.5 })).statut, 'marge-promo-nulle');
assert.strictEqual(S.analyserObjectif(Object.assign({}, base, { paHabituelHt: 3 })).statut, 'marge-habituelle-nulle');
assert.strictEqual(S.analyserObjectif(Object.assign({}, base, { ventesJour: 0 })).statut, 'sans-reference');
const mieux = S.analyserObjectif(Object.assign({}, base, { paPromoHt: 0.3 }));
assert.strictEqual(mieux.statut, 'aucune-hausse');
assert.strictEqual(mieux.objectifPropose, null, 'pas d\'objectif artificiel');
// période de référence : promotion exclue, ventes/jour sur jours réels (dates incluses)
const rows = [
  { article: 'X', periode_debut: '2026-09-01', periode_fin: '2026-09-30', quantite: 60, ca: 120, marge: 60 },
  { article: 'X', periode_debut: '2026-10-01', periode_fin: '2026-10-10', quantite: 50, ca: 80, marge: 30 }
];
const sg = S.suggestions(rows, 'X', '2026-10-20');
assert(sg, 'suggestion');
assert.strictEqual(sg.ventesJour, 2, '60 ventes / 30 jours réels');
assert.deepStrictEqual(sg.source, { debut: '2026-09-01', fin: '2026-09-30' }, 'la période à prix réduit est écartée');
assert.strictEqual(sg.meilleurRythmeObserve, 5, 'meilleur rythme observé en prix réduit');
assert.strictEqual(S.suggestions(rows, 'Y', '2026-10-20'), null, 'produit sans historique');
console.log('ok');

// ---- C1-b : objectifs versionnés, append-only, câblage de la page ----
{
  const fs = require('fs');
  const assert = require('assert');
  const sql = fs.readFileSync('supabase/migrations/20261114140000_campagne_objectifs_produits.sql', 'utf8');
  const page = fs.readFileSync('NEXUS-Campagne-v2.html', 'utf8');
  const objPage = fs.readFileSync('NEXUS-Campagne-v2-Objectifs.html', 'utf8');
  const voc = fs.readFileSync('nexus-vocabulaire.js', 'utf8');
  const SIM = require('./nexus-simulateur-promo.js');
  const t2 = (n, f) => { try { f(); console.log('  ok  ' + n); } catch (e) { console.log('  ECHEC ' + n + '\n     ' + e.message); process.exitCode = 1; } };

  t2('objectifs : table append-only (aucune politique ni droit UPDATE/DELETE)', () => {
    assert(/revoke update, delete, truncate/i.test(sql));
    assert(!/create policy[^;]*for (update|delete)/i.test(sql));
    assert(/unique \(campagne_id, article, version\)/.test(sql));
    assert(/revoke all on campagne_objectifs_produits from anon/.test(sql));
  });
  t2('objectifs : RLS par site, écriture manager/gérant, créateur sous condition', () => {
    assert(/enable row level security/.test(sql));
    assert(/site = current_employee_site_id\(\)/.test(sql));
    assert(/current_employee_role\(\) in \('manager','gerant'\)/.test(sql));
    assert(/acces_createur_autorise/.test(sql));
  });
  t2('objectifs : la page insère une nouvelle version, ne modifie jamais', () => {
    assert(/from\('campagne_objectifs_produits'\)\.insert\(/.test(objPage));
    assert(!/from\('campagne_objectifs_produits'\)\s*\.(update|upsert|delete)/.test(objPage));
    assert(/\+ 1/.test(objPage));
    assert(/moteur_version/.test(objPage) && /valide_par/.test(objPage));
    assert(!/campagne_objectifs_produits/.test(page), 'la page principale ne porte plus le bloc objectifs');
    assert(/NEXUS-Campagne-v2-Objectifs\.html\?campagne=/.test(page), 'Suivre ma promotion ouvre la page dédiée');
  });
  t2('objectifs : page câblée (tva lue, tableau, bouton, vocabulaire)', () => {
    assert(/select\([^)]*tva/.test(objPage));
    assert(/objValider/.test(objPage) && /objTable/.test(objPage));
    assert(/<details class="compar"(?![^>]*\bopen\b)/.test(objPage), 'détails repliés par défaut');
    assert(/SIM\.analyserObjectif/.test(objPage) && /nexusRequireProfessional\('NEXUS-Campagne-v2-Objectifs\.html'/.test(objPage));
    assert(/employee\.role !== 'manager' && employee\.role !== 'gerant'/.test(objPage));
    assert(/valider: 'Valider les objectifs'/.test(voc));
  });
  t2('simulateur : prix TTC convertis en HT via le moteur, TVA manquante suspend', () => {
    assert(/SIM\.ttcVersHt/.test(page) && /SIM\.tvaValide/.test(page));
    assert(/venteAvant: 'Prix de vente TTC avant'/.test(voc));
    assert(/tvaAComplete/.test(voc));
  });
  t2('suggestions : TVA et prix habituel TTC (HT × (1+TVA))', () => {
    const rows = [{ article: 'A', categorie: 'X', periode_debut: '2026-09-01', periode_fin: '2026-09-30', quantite: 100, ca: 215, marge: 115, tva: 8.5 }];
    const s = S.suggestions(rows, 'A', '2026-11-14');
    assert(s, 'suggestions renvoyées');
    assert.strictEqual(s.tva, 8.5);
    assert(Math.abs(s.pvHabituelTtc - 2.15 * 1.085) < 1e-9, 'pvHabituelTtc ' + s.pvHabituelTtc);
  });
}
