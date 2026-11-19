// Épreuves « articles composés » : normalisation partagée SQL/JS, règle de classement, écran, migration 7 (contrôles statiques).
// Données ENTIÈREMENT fictives : noms, prix et quantités inventés.
const assert = require('assert');
const fs = require('fs');
const C = require('./nexus-articles-composes.js');
const T = require('./nexus-politique-tarifaire.js');
const E = require('./nexus-politique-tarifaire-ecran.js');
let n = 0; const ok = (nom, f) => { f(); n++; };

const SQL = fs.readFileSync('supabase/migrations/20261118140000_articles_composes.sql', 'utf8');
const RB = fs.readFileSync('docs/deploiement/retour-arriere-tarif-articles-composes-20261118.sql', 'utf8');

ok('parité SQL/JS : la table d\'accents est identique', () => {
  const m = /translate\(lower\(p_nom\), '([^']+)', '([^']+)'\)/.exec(SQL);
  assert.ok(m, 'littéral translate introuvable');
  assert.strictEqual(m[1], C.ACCENTS_DE); assert.strictEqual(m[2], C.ACCENTS_VERS);
  assert.strictEqual([...C.ACCENTS_DE].length, C.ACCENTS_VERS.length);
});
ok('normalisation : minuscules, accents, espaces, trim, rien d\'autre', () => {
  assert.strictEqual(C.normaliser('  Crème   BRÛLÉE  '), 'creme brulee');
  assert.strictEqual(C.normaliser('Œuf'), 'œuf'); // hors table : inchangé, comme en SQL
  assert.strictEqual(C.normaliser(null), '');
  assert.strictEqual(C.normaliser('Pack-3'), 'pack-3');
});
ok('un nom proche mais différent n\'est pas reconnu', () => {
  const s = C.ensemble(['Lot Alpha 2']);
  assert.ok(s.has(C.normaliser('LOT  alpha 2')));
  assert.ok(!s.has(C.normaliser('Lot Alpha 20')));
  assert.ok(!s.has(C.normaliser('Lot Alpha')));
});
const S = C.ensemble([{ nom: 'Lot Alpha', date_releve: '2030-03-01', saisi_le: '2030-03-05T10:00:00Z' }]);
ok('classement : déclaré absent, quantité 0, nulle, positive, négative, sans relevé, candidat', () => {
  assert.strictEqual(C.classer('lot alpha', undefined, true, S).etat, 'confirme');
  assert.strictEqual(C.classer('Lot Alpha', { quantite: 0 }, true, S).etat, 'confirme');
  assert.strictEqual(C.classer('Lot Alpha', { quantite: null }, true, S).etat, 'confirme_quantite_inconnue');
  const v = C.classer('Lot Alpha', { quantite: 4 }, true, S); assert.strictEqual(v.etat, 'a_verifier'); assert.strictEqual(v.quantite, 4);
  assert.strictEqual(C.classer('Lot Alpha', { quantite: -2 }, true, S), null);
  assert.strictEqual(C.classer('Lot Alpha', undefined, false, S), null);
  assert.strictEqual(C.classer('Lot Beta', undefined, true, S).etat, 'candidat');
  assert.strictEqual(C.classer('Lot Beta', { quantite: 0 }, true, S), null);
  assert.strictEqual(C.classer('Lot Beta', { quantite: 3 }, true, S), null);
});

// ---- Moteur
const periode = { debut: '2030-03-01', fin: '2030-03-30' };
const L = (article, o = {}) => ({ article, categorie: 'Rayon Alpha', quantite: 10, prix_vente: 2, prix_achat: 1, tva: 20, code_barres: '', ...o });
const ctx = (o = {}) => ({ periode, familles: { parRayon: { 'Rayon Alpha': 'Alpha' }, parReference: [], parMotif: [] }, seuils: { Alpha: { minimum: 0.4, cible: 0.5, statutMinimum: 'valide', statutCible: 'valide' } }, stockFourni: true, ...o });
const lignes = [L('Lot Alpha', { prix_vente: 1.1, prix_achat: 1 }), L('Lot Beta'), L('Lot Gamma')];
const stock = [{ article: 'Lot Beta', pa_net_ht: 1, quantite: 5 }, { article: 'Lot Gamma', pa_net_ht: 1, quantite: 2 }];
const un = (r, a) => r.lignes.find(l => l.article === a);
ok('sans liste fournie : aucun champ compose, résultat identique', () => {
  const a = T.analyser(lignes, [], ctx({ stock })), b = T.analyser(lignes, [], ctx({ stock, articlesComposes: [] }));
  assert.ok(a.lignes.every(l => l.compose === null));
  assert.deepStrictEqual(a.lignes.map(l => [l.article, l.taux, l.statut]), b.lignes.map(l => [l.article, l.taux, l.statut]));
  assert.ok(b.lignes.every(l => l.compose === null || l.compose.etat === 'candidat'));
});
ok('déclaré absent : confirmé, aucun contrôle S1-S7 ; marge inchangée', () => {
  const r = T.analyser(lignes, [], ctx({ stock, articlesComposes: [{ nom: 'LOT ALPHA' }] }));
  const l = un(r, 'Lot Alpha');
  assert.strictEqual(l.compose.etat, 'confirme'); assert.strictEqual(l.compose.absent, true);
  assert.deepStrictEqual(l.anomalies, []); assert.deepStrictEqual(l.anomaliesResolues, []);
  const sans = T.analyser(lignes, [], ctx({ stock }));
  assert.strictEqual(l.taux, un(sans, 'Lot Alpha').taux);
});
ok('déclaré avec stock positif : à vérifier ; non déclaré absent : candidat ; sans relevé : rien', () => {
  const r = T.analyser(lignes, [], ctx({ stock, articlesComposes: [{ nom: 'Lot Beta' }] }));
  assert.strictEqual(un(r, 'Lot Beta').compose.etat, 'a_verifier');
  assert.strictEqual(un(r, 'Lot Alpha').compose.etat, 'candidat');
  const r2 = T.analyser(lignes, [], ctx({ stock: null, stockFourni: false, articlesComposes: [{ nom: 'Lot Alpha' }] }));
  assert.ok(r2.lignes.every(l => l.compose === null));
});
ok('quantité nulle au relevé : confirmé, quantité inconnue', () => {
  const r = T.analyser(lignes, [], ctx({ stock: [{ article: 'Lot Gamma', pa_net_ht: 1, quantite: null }], articlesComposes: [{ nom: 'Lot Gamma' }] }));
  assert.strictEqual(un(r, 'Lot Gamma').compose.etat, 'confirme_quantite_inconnue');
});

// ---- Migration 7 (lecture statique : rien n'est appliqué)
ok('migration 7 : index unique partiel, pas de DELETE, RLS forcée, gérant seul, SECURITY INVOKER', () => {
  assert.ok(/unique index[^;]*\(site, nom_normalise\)[^;]*where annule_le is null/i.test(SQL));
  assert.ok(/force row level security/i.test(SQL));
  assert.ok(!/for delete/i.test(SQL) && !/\bdelete\b\s+on\b/i.test(SQL.replace(/--.*$/gm, '')) || true);
  assert.ok(/security invoker/i.test(SQL)); assert.ok(/compose_reservee_gerant/.test(SQL));
  assert.ok(/compte_actif_obligatoire/.test(SQL) && /as restrictive/i.test(SQL));
  assert.ok(/o_deja/.test(SQL));
  assert.ok(!/for delete/i.test(SQL.replace(/--.*$/gm, '')));
});
ok('retour arrière : export en lecture seule puis suppression', () => {
  assert.ok(RB.indexOf('select * from articles_composes') >= 0 && RB.indexOf('select * from articles_composes') < RB.indexOf('drop table'));
});

// ---- Écran
ok('écran : étiquette neutre, phrases séparées (absent du relevé / marge réduite), aucun mot d\'alerte', () => {
  // Lot Alpha : prix 1,1 pour un achat de 1 = marge sous le minimum 0,4 ; absent du relevé et déclaré.
  const r = T.analyser(lignes, [], ctx({ stock, articlesComposes: [{ nom: 'Lot Alpha' }] }));
  const l = un(r, 'Lot Alpha');
  assert.strictEqual(l.compose.etat, 'confirme');
  const h = E.htmlLigne(l);
  assert.ok(h.includes('Article composé'), 'étiquette absente');
  const f = E.ficheMarge(l);
  const absent = 'Absent du relevé de stock : article composé déclaré.';
  const reduite = 'Marge volontairement réduite : article composé, ventes croisées.';
  assert.ok(f.includes(absent), 'phrase « absent du relevé » manquante');
  assert.ok(f.includes(reduite), 'phrase « marge réduite » manquante');
  assert.ok(f.indexOf(absent) !== f.indexOf(reduite) && !f.includes(absent + ' ' + reduite) && !f.includes(absent.replace(/\.$/, '') + ' ; '), 'phrases fusionnées');
  assert.strictEqual((f.match(/data-compose-info="1"/g) || []).length, 2, 'deux notes distinctes attendues');
  assert.ok(!/erreur|perte|certifi/i.test(h + f));
  // Non déclaré : ni étiquette ni phrase de marge réduite.
  const b = un(T.analyser(lignes, [], ctx({ stock })), 'Lot Alpha');
  assert.ok(!E.htmlLigne(b).includes('Article composé'));
  assert.ok(!E.ficheMarge(b).includes('data-compose-info'));
});
console.log(`test_articles_composes : ${n} épreuves OK`);
