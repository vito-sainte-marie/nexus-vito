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
  const r = A.cycleDeVie(a2, v, ctx); assert.strictEqual(r.anomalies[0].cycle, 'verifiee'); assert.strictEqual(A.reevaluations(r).length, 0);
});
ok('3 même fichier réimporté : verifiee, aucune réévaluation', () => {
  const l = ligne({ margeEstimee: ecartReleve(0.59) }), a1 = A.anomaliesLigne(l, ctx);
  const v = [{ code: 'S2', cle: a1[0].cle, empreinte: 'autre', gravite: 59, identiteDonnees: a1[0].identiteDonnees, verifie_le: 'x' }];
  const r = A.cycleDeVie(A.anomaliesLigne(l, ctx), v, ctx); assert.strictEqual(r.anomalies[0].cycle, 'verifiee'); assert.strictEqual(A.reevaluations(r).length, 0);
});
ok('4 incohérence disparue : resolue, mentionnée', () => {
  const a1 = A.anomaliesLigne(ligne({ margeEstimee: ecartReleve(0.59) }), ctx)[0];
  const r = A.cycleDeVie(A.anomaliesLigne(ligne(), ctx), [{ code: 'S2', cle: a1.cle, empreinte: a1.empreinte, gravite: a1.gravite, identiteDonnees: a1.identiteDonnees, verifie_le: 'x' }], { ...ctx, fichierHash: 'H2', dateReleve: '2026-11-30' });
  assert.strictEqual(r.resolues.length, 1); assert.strictEqual(A.reevaluations(r)[0].cycle, 'resolue');
});
ok('5 persistante : un seul nouveau contrôle', () => {
  const a1 = A.anomaliesLigne(ligne({ margeEstimee: ecartReleve(0.30) }), ctx)[0];
  const ctx2 = { ...ctx, fichierHash: 'H2', dateReleve: '2026-11-30' };
  const r = A.cycleDeVie(A.anomaliesLigne(ligne({ margeEstimee: ecartReleve(0.32) }), ctx2), [{ code: 'S2', cle: a1.cle, empreinte: a1.empreinte, gravite: a1.gravite, identiteDonnees: a1.identiteDonnees, verifie_le: 'x' }], ctx2);
  assert.strictEqual(r.anomalies[0].cycle, 'persistante'); assert.strictEqual(r.anomalies.filter(a => a.nouveauControle).length, 1);
});
ok('6 aggravée, puis nouvelle cause : contrôle distinct', () => {
  const a1 = A.anomaliesLigne(ligne({ margeEstimee: ecartReleve(0.20) }), ctx)[0];
  const v = [{ code: 'S2', cle: a1.cle, empreinte: a1.empreinte, gravite: a1.gravite, identiteDonnees: a1.identiteDonnees, verifie_le: 'x' }];
  const ctx2 = { ...ctx, fichierHash: 'H2', dateReleve: '2026-11-30' };
  const r = A.cycleDeVie(A.anomaliesLigne(ligne({ margeEstimee: ecartReleve(0.45), tva: { etat: 'a_verifier', taux: 20 } }), ctx2), v, ctx2);
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
  const an = A.anomaliesLigne(ligne({ alertes: [{ code: 'A3' }], taux: -0.1, variationCout: 0.3, variationPv: 0.62, tva: { etat: 'a_verifier', taux: 10 } }), ctx);
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
ok('12 le moteur avec et sans le module anomalies : mêmes lignes, seul le champ additif disparaît', () => {
  const Module = require('module'), path = require.resolve('./nexus-politique-tarifaire.js'), orig = Module._load, saved = global.NexusAnomaliesTarifaires;
  const rows = [
    { article: 'CAFE', code_barres: '3111', categorie: 'EPICERIE', quantite: 10, prix_vente_ht: 2, pa: 1, ca_ht: 20, tva: 5.5 },
    { article: 'BOISSON 24P', code_barres: '', categorie: 'BOISSON', quantite: 5, prix_vente_ht: 1, pa: 11, ca_ht: 5, tva: 20 },
    { article: 'GAZ 13KG', code_barres: '3222', categorie: 'GAZ', quantite: 3, prix_vente_ht: 30, pa: 31, ca_ht: 90, tva: 20 }];
  const prec = rows.map(r => ({ ...r, pa: r.pa * 0.8, prix_vente_ht: r.prix_vente_ht * 0.9 }));
  const charge = sans => {
    delete require.cache[path];
    if (sans) { delete global.NexusAnomaliesTarifaires; Module._load = function (r, ...a) { if (/nexus-anomalies-tarifaires/.test(r)) throw new Error('absent'); return orig.call(this, r, ...a); }; }
    try { return require(path).analyser(rows, prec, { periode: ctx.periode, stockFourni: false }); } finally { Module._load = orig; global.NexusAnomaliesTarifaires = saved; }
  };
  const sans = charge(true), avec = charge(false);
  assert.ok(sans.lignes.every(l => l.anomalies === undefined), 'sans module : aucun champ additif');
  assert.ok(avec.lignes.every(l => Array.isArray(l.anomalies)), 'avec module : champ additif présent');
  const nu = r => { const j = JSON.parse(JSON.stringify(r)); j.lignes.forEach(l => { delete l.anomalies; delete l.anomaliesResolues; }); return j; };
  assert.deepStrictEqual(nu(avec), nu(sans));
});
ok('13 clé de référence : égale à tarif_cle_reference (SQL), libellés accentués et espaces multiples', () => {
  assert.strictEqual(A.cle({ code_barres: ' 3000 ', article: 'x' }), 'cb:3000');
  assert.strictEqual(A.cle({ code_barres: '', article: '  Crème   BRÛLÉE \t  Été ' }), 'lib:crème brûlée été');
  assert.strictEqual(A.cle({ code_barres: null, article: 'Éclair' }), 'lib:éclair');
  assert.strictEqual(A.cle({ code_barres: '  ', article: ' ' }), null);
  assert.strictEqual(A.cle({ article: 'A  B' }), A.cle({ article: ' a b ' }));
  assert.notStrictEqual(A.cle({ article: 'Éclair' }), A.cle({ article: 'Eclair' }));
});
ok('14 sans nouvel import : période changée sur le même fichier, aucune réévaluation', () => {
  const a1 = A.anomaliesLigne(ligne({ margeEstimee: ecartReleve(0.30) }), ctx)[0];
  const v = [{ code: 'S2', cle: a1.cle, empreinte: a1.empreinte, gravite: a1.gravite, identiteDonnees: a1.identiteDonnees, verifie_le: 'x' }];
  const ctx2 = { ...ctx, periode: { debut: '2026-11-01', fin: '2026-11-30' } };
  const r = A.cycleDeVie(A.anomaliesLigne(ligne({ margeEstimee: ecartReleve(0.60) }), ctx2), v, ctx2);
  assert.strictEqual(r.anomalies[0].cycle, 'verifiee'); assert.strictEqual(A.reevaluations(r).length, 0);
});
ok('15 périmètre filtré, même import : anomalie absente, pas de résolution ; nouvel import : résolue', () => {
  const a1 = A.anomaliesLigne(ligne({ margeEstimee: ecartReleve(0.30) }), ctx)[0];
  const v = [{ code: 'S2', cle: a1.cle, empreinte: a1.empreinte, gravite: a1.gravite, identiteDonnees: a1.identiteDonnees, verifie_le: 'x' }];
  assert.strictEqual(A.reevaluations(A.cycleDeVie([], v, ctx)).length, 0);
  assert.strictEqual(A.reevaluations(A.cycleDeVie([], v, { ...ctx, fichierHash: 'H2' })).length, 0, 'S2 exige aussi une nouvelle date de relevé');
  assert.strictEqual(A.reevaluations(A.cycleDeVie([], v, { ...ctx, fichierHash: 'H2', dateReleve: '2026-11-30' })).length, 1);
  assert.strictEqual(A.reevaluations(A.cycleDeVie([], v, { fichierHash: null, dateReleve: null })).length, 0);
});
ok('16 S3 sans relevé : nouvel import suffit (fichierHash seul) ; S7 limité à a_verifier ; S6 à 50 % ; seuils lus des réglages', () => {
  const a3 = A.anomaliesLigne(ligne({ variationCout: 0.2 }), ctx)[0];
  const v = [{ code: 'S3', cle: a3.cle, empreinte: a3.empreinte, gravite: a3.gravite, identiteDonnees: a3.identiteDonnees, verifie_le: 'x' }];
  assert.strictEqual(A.cycleDeVie([], v, { ...ctx, fichierHash: 'H2' }).resolues.length, 1);
  assert.strictEqual(codes(A.anomaliesLigne(ligne({ tva: { etat: 'a_confirmer', taux: 10 } }), ctx)), '');
  assert.strictEqual(codes(A.anomaliesLigne(ligne({ tva: { etat: 'a_verifier', taux: 10 } }), ctx)), 'S7');
  assert.strictEqual(codes(A.anomaliesLigne(ligne({ variationPv: 0.3 }), ctx)), '');
  assert.strictEqual(codes(A.anomaliesLigne(ligne({ variationPv: 0.5 }), ctx)), 'S6');
  assert.strictEqual(codes(A.anomaliesLigne(ligne({ variationPv: 0.3 }), { ...ctx, reglages: { variationSuspecte: 0.25 } })), 'S6');
  assert.strictEqual(codes(A.anomaliesLigne(ligne({ variationCout: 0.2 }), { ...ctx, reglages: { variationNotable: 0.25 } })), '');
  assert.strictEqual(codes(A.anomaliesLigne(ligne({ margeEstimee: ecartReleve(0.2) }), { ...ctx, reglages: { ecartStockInsuffisant: 0.25 } })), '');
});
console.log('test_anomalies_tarifaires : ' + n + ' épreuves OK');
