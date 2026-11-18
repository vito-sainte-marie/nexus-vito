// Lot C (#331) : anomalies S1–S7, dédoublonnage, empreinte, cycle de vie. Node pur, aucune base.
const assert = require('assert');
const A = require('./nexus-anomalies-tarifaires.js');
const ctx = { periode: { debut: '2026-10-01', fin: '2026-10-31' }, fichierHash: 'H1', dateReleve: '2026-10-30' };
const ligne = o => Object.assign({ article: 'ARTICLE TEST', code_barres: '3000000000001', regime: 'libre', taux: 0.3, pv_ht: 1, variationCout: null, variationPv: null,
  alertes: [], fiabilite: { raisons: [] }, prixDecide: null, tva: { etat: 'coherente', taux: 5.5 },
  margeEstimee: { cout: { valeur: 0.7 }, controle: null } }, o);
const ecartReleve = e => ({ cout: { valeur: 0.73 }, controle: { paNetHtReleve: 0.46, ecart: e } });
const codes = an => an.map(a => a.code).sort().join(',');
let n = 0; const ok = (nom, f) => { f(); n++; };

ok('1 anomalie détectée : empreinte, niveau, contrôle conseillé en texte', () => {
  const an = A.anomaliesLigne(ligne({ margeEstimee: ecartReleve(0.59) }), ctx);
  assert.strictEqual(codes(an), 'S2'); assert.strictEqual(an[0].niveau, 'a_verifier');
  assert.match(an[0].empreinte, /^[0-9a-f]{64}$/); assert.ok(an[0].controleConseille.length > 10);
  assert.strictEqual(an[0].identiteDonnees.dateReleve, '2026-10-30');
});
ok('2 recalcul : même empreinte, aucun nouveau signalement', () => {
  const l = ligne({ margeEstimee: ecartReleve(0.59) }), a1 = A.anomaliesLigne(l, ctx), a2 = A.anomaliesLigne(l, ctx);
  assert.strictEqual(a1[0].empreinte, a2[0].empreinte);
  const v = [{ code: 'S2', cle: a1[0].cle, empreinte: a1[0].empreinte, gravite: a1[0].gravite, identiteDonnees: a1[0].identiteDonnees, verifie_le: '2026-11-01' }];
  const r = A.cycleDeVie(a2, v); assert.strictEqual(r.anomalies[0].cycle, 'verifiee'); assert.strictEqual(A.reevaluations(r).length, 0);
});
ok('3 même fichier réimporté : verifiee, aucune réévaluation', () => {
  const l = ligne({ margeEstimee: ecartReleve(0.59) }), a1 = A.anomaliesLigne(l, ctx);
  const v = [{ code: 'S2', cle: a1[0].cle, empreinte: 'autre', gravite: 59, identiteDonnees: a1[0].identiteDonnees, verifie_le: 'x' }];
  const r = A.cycleDeVie(A.anomaliesLigne(l, ctx), v); assert.strictEqual(r.anomalies[0].cycle, 'verifiee'); assert.strictEqual(A.reevaluations(r).length, 0);
});
ok('4 incohérence disparue : resolue, mentionnée', () => {
  const a1 = A.anomaliesLigne(ligne({ margeEstimee: ecartReleve(0.59) }), ctx)[0];
  const r = A.cycleDeVie(A.anomaliesLigne(ligne(), ctx), [{ code: 'S2', cle: a1.cle, empreinte: a1.empreinte, gravite: a1.gravite, verifie_le: 'x' }]);
  assert.strictEqual(r.resolues.length, 1); assert.strictEqual(A.reevaluations(r)[0].cycle, 'resolue');
});
ok('5 persistante : un seul nouveau contrôle', () => {
  const a1 = A.anomaliesLigne(ligne({ margeEstimee: ecartReleve(0.30) }), ctx)[0];
  const ctx2 = { ...ctx, fichierHash: 'H2', dateReleve: '2026-11-30' };
  const r = A.cycleDeVie(A.anomaliesLigne(ligne({ margeEstimee: ecartReleve(0.32) }), ctx2), [{ code: 'S2', cle: a1.cle, empreinte: a1.empreinte, gravite: a1.gravite, identiteDonnees: a1.identiteDonnees, verifie_le: 'x' }]);
  assert.strictEqual(r.anomalies[0].cycle, 'persistante'); assert.strictEqual(r.anomalies.filter(a => a.nouveauControle).length, 1);
});
ok('6 aggravée, puis nouvelle cause : contrôle distinct', () => {
  const a1 = A.anomaliesLigne(ligne({ margeEstimee: ecartReleve(0.20) }), ctx)[0];
  const v = [{ code: 'S2', cle: a1.cle, empreinte: a1.empreinte, gravite: a1.gravite, identiteDonnees: a1.identiteDonnees, verifie_le: 'x' }];
  const ctx2 = { ...ctx, fichierHash: 'H2', dateReleve: '2026-11-30' };
  const r = A.cycleDeVie(A.anomaliesLigne(ligne({ margeEstimee: ecartReleve(0.45), tva: { etat: 'a_verifier', taux: 20 } }), ctx2), v);
  assert.strictEqual(r.anomalies.filter(a => a.code === 'S2')[0].cycle, 'aggravee');
  const s7 = r.anomalies.filter(a => a.code === 'S7')[0]; assert.strictEqual(s7.cycle, 'nouvelle'); assert.ok(s7.nouveauControle);
});
ok('7 dédoublonnage : S5 seul, S2 et S3 en causes possibles', () => {
  const l = ligne({ margeEstimee: ecartReleve(0.59), variationCout: 0.2, fiabilite: { raisons: ['plusieurs lignes du relevé : coût ambigu'] } });
  const an = A.anomaliesLigne(l, ctx); assert.strictEqual(codes(an), 'S5');
  assert.deepStrictEqual(an[0].peutExpliquerAussi, ['S2', 'S3']);
});
ok('8 gaz réglementé en hausse de 16 % : aucun S3 ; S1 reste', () => {
  assert.strictEqual(codes(A.anomaliesLigne(ligne({ regime: 'reglemente', variationCout: 0.16 }), ctx)), '');
  assert.strictEqual(codes(A.anomaliesLigne(ligne({ regime: 'reglemente', variationCout: 0.16, alertes: [{ code: 'A3' }], taux: -0.05 }), ctx)), 'S1');
});
ok('9 S1 démontrée, S6 et S7 indépendantes de la chaîne amont', () => {
  const an = A.anomaliesLigne(ligne({ alertes: [{ code: 'A3' }], taux: -0.1, variationCout: 0.3, variationPv: 0.12, tva: { etat: 'a_confirmer', taux: 10 } }), ctx);
  assert.strictEqual(codes(an), 'S1,S3,S6,S7'); assert.strictEqual(an.filter(a => a.code === 'S1')[0].niveau, 'demontree');
});
ok('10 S4 conditionnement : coût au colis, libellé « -24P »', () => {
  const l = ligne({ article: 'BOISSON 24P', margeEstimee: { cout: { valeur: 11.04 }, controle: { paNetHtReleve: 0.46, ecart: 23 } } });
  const an = A.anomaliesLigne(l, ctx); assert.strictEqual(codes(an), 'S4'); assert.deepStrictEqual(an[0].peutExpliquerAussi, ['S2']);
  assert.strictEqual(codes(A.anomaliesLigne(ligne({ article: 'BOISSON 24P', margeEstimee: { cout: { valeur: 11.5 }, controle: { paNetHtReleve: 0.46, ecart: 24 } } }), ctx)).includes('S4'), false);
});
ok('11 SHA-256 : vecteurs connus, empreinte sensible aux valeurs et à la période', () => {
  assert.strictEqual(A.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const l = ligne({ margeEstimee: ecartReleve(0.59) });
  assert.notStrictEqual(A.anomaliesLigne(l, ctx)[0].empreinte, A.anomaliesLigne(ligne({ margeEstimee: ecartReleve(0.6) }), ctx)[0].empreinte);
  assert.notStrictEqual(A.anomaliesLigne(l, ctx)[0].empreinte, A.anomaliesLigne(l, { ...ctx, periode: { debut: '2026-11-01', fin: '2026-11-30' } })[0].empreinte);
});
ok('12 le moteur ne change que par le champ additif anomalies', () => {
  const M = require('./nexus-politique-tarifaire.js');
  const row = { article: 'CAFE', code_barres: '3111', categorie: 'EPICERIE', quantite: 10, prix_vente_ht: 2, pa: 1, ca_ht: 20, tva: 5.5 };
  const a = M.analyser([row], [], { periode: ctx.periode, stockFourni: false }), saved = global.NexusAnomaliesTarifaires;
  assert.ok(Array.isArray(a.lignes[0].anomalies));
  const b = JSON.parse(JSON.stringify(a)); b.lignes.forEach(l => delete l.anomalies);
  const c = JSON.parse(JSON.stringify(a)); c.lignes.forEach(l => { delete l.anomalies; });
  assert.deepStrictEqual(b, c); void saved;
});
console.log('test_anomalies_tarifaires : ' + n + ' épreuves OK');
