// Lot D4 (Guardian 6810437636) : sélecteur global des découvertes de l'accueil Tempo v2.
const assert = require('assert');
global.window = global;
require('./nexus-tempo.js');
const T = window.NexusTempo;
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
const c = (activite, type, cle, sens, extra) => Object.assign({ activite, type, cle: cle || '', sens: sens === undefined ? 1 : sens, rang: T.RANG_PRIORITE ? T.RANG_PRIORITE[type] : ({ masquee: 1, repartition: 1, decrochage: 1, variation: 2, simple: 2, relation: 3 })[type], net: true, source: {} }, extra || {});
const e = (cands, motif) => ({ etat: 'ok', motif: motif || null, candidats: cands });
const vide = { etat: 'insuffisant', motif: null, candidats: [] };

t('constantes nommées', () => { assert.strictEqual(T.NB_DECOUVERTES_ACCUEIL, 3); assert.strictEqual(T.RANGS_PERDUS_FRAICHEUR, 1); });

t('diversité : deux candidats nets d\'une même activité ne prennent pas toute la place', () => {
  const r = T.selectionnerDecouvertes({
    piste: e([c('piste', 'masquee', 'sp95', -1), c('piste', 'repartition', 'gazole', 1), c('piste', 'variation', '', -1)]),
    boutique: e([c('boutique', 'simple', '', 1)]), fdj: vide });
  assert.strictEqual(r.length, 3);
  assert.deepStrictEqual(r.map(x => x.activite).sort(), ['boutique', 'piste', 'piste']);
  assert.strictEqual(r.filter(x => x.activite === 'piste' && x.type === 'masquee').length, 1);
});

t('diversité : un candidat par activité passe avant le deuxième de la première', () => {
  const r = T.selectionnerDecouvertes({
    piste: e([c('piste', 'masquee', 'sp95'), c('piste', 'repartition', 'gazole'), c('piste', 'variation')]),
    boutique: e([c('boutique', 'simple')]), fdj: e([c('fdj', 'variation')]) });
  assert.deepStrictEqual(r.map(x => x.activite + ':' + x.type), ['piste:masquee', 'boutique:simple', 'fdj:variation']);
});

t('une seule activité nette : on complète jusqu\'à trois', () => {
  const r = T.selectionnerDecouvertes({ piste: e([c('piste', 'masquee', 'a'), c('piste', 'repartition', 'b'), c('piste', 'variation'), c('piste', 'variation', 'z')]), boutique: vide, fdj: vide });
  assert.strictEqual(r.length, 3);
});

t('la relation croisée ne prend une place que s\'il en reste une', () => {
  const croise = { etat: 'ok', motif: null, candidats: [c('croise', 'relation', '', 1)] };
  const plein = T.selectionnerDecouvertes({ piste: e([c('piste', 'masquee', 'a')]), boutique: e([c('boutique', 'simple')]), fdj: e([c('fdj', 'variation')]), croise });
  assert.ok(!plein.some(x => x.activite === 'croise'));
  const reste = T.selectionnerDecouvertes({ piste: e([c('piste', 'masquee', 'a')]), boutique: e([c('boutique', 'simple')]), fdj: vide, croise });
  assert.ok(reste.some(x => x.activite === 'croise'));
  assert.strictEqual(reste.length, 3);
  assert.strictEqual(reste[2].activite, 'croise');
});

t('ordre A7 entre activités : masqué avant variation simple, sans départage par z', () => {
  const r = T.selectionnerDecouvertes({ piste: e([c('piste', 'variation', '', 1, { z: 9 })]), boutique: e([c('boutique', 'masquee', 'x')]), fdj: e([c('fdj', 'variation', '', 1, { z: 8 })]) });
  assert.deepStrictEqual(r.map(x => x.activite), ['boutique', 'piste', 'fdj']);
});

t('un candidat non net n\'est jamais affiché', () => {
  const r = T.selectionnerDecouvertes({ piste: e([c('piste', 'masquee', 'a', 1, { net: false })]), boutique: vide, fdj: vide });
  assert.strictEqual(r.length, 0);
});

t('un candidat non net ne bloque pas le suivant de son activité', () => {
  const r = T.selectionnerDecouvertes({ piste: e([c('piste', 'masquee', 'a', 1, { net: false }), c('piste', 'variation')]), boutique: vide, fdj: vide });
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].type, 'variation');
});

t('fraîcheur : même sens sur la période précédente, la découverte descend d\'un rang', () => {
  const cur = { piste: e([c('piste', 'masquee', 'sp95', -1)]), boutique: e([c('boutique', 'simple', '', 1)]), fdj: vide };
  const prec = { piste: e([c('piste', 'masquee', 'sp95', -1)]), boutique: e([c('boutique', 'simple', '', -1)]), fdj: vide };
  const r = T.selectionnerDecouvertes(cur, prec);
  assert.deepStrictEqual(r.map(x => x.activite), ['boutique', 'piste']);
  assert.strictEqual(r[1].fraicheur.perdu, true);
  assert.strictEqual(r[0].fraicheur.perdu, false, 'sens opposé : aucun effet');
});

t('fraîcheur : période précédente non évaluable, aucun effet sur le rang', () => {
  const cur = { piste: e([c('piste', 'masquee', 'sp95', -1)]), boutique: e([c('boutique', 'simple', '', 1)]), fdj: vide };
  const sans = T.selectionnerDecouvertes(cur, null);
  const avec = T.selectionnerDecouvertes(cur, { piste: vide, boutique: vide, fdj: vide });
  assert.deepStrictEqual(avec.map(x => x.activite), sans.map(x => x.activite));
  avec.forEach(x => { assert.strictEqual(x.fraicheur.etat, 'non_evaluable'); assert.strictEqual(x.fraicheur.perdu, false); });
  assert.ok(/non évaluable/.test(avec[0].fraicheur.texte));
});

t('preuves : motif de rang et fraîcheur présents sur chaque carte', () => {
  const r = T.selectionnerDecouvertes({ piste: e([c('piste', 'masquee', 'sp95')], 'retenue par dépassement, z 4,5 contre 2,1, k = 2,0'), boutique: vide, fdj: e([c('fdj', 'variation')], 'ordre par défaut') });
  r.forEach(x => { assert.ok(x.motifRang && x.motifRang.length > 5); assert.ok(x.fraicheur && x.fraicheur.texte); });
  assert.ok(/dépassement/.test(r[0].motifRang));
  assert.ok(/1re de son activité/.test(r[1].motifRang));
});

t('cas Sainte-Marie : trois cartes, une par activité, relation et quart absents', () => {
  const croise = { etat: 'ok', motif: null, candidats: [c('croise', 'relation', '', 1)] };
  const r = T.selectionnerDecouvertes({ piste: e([c('piste', 'masquee', 'sp95', -1)]), boutique: e([c('boutique', 'decrochage', 'Gaz', 1)]), fdj: e([c('fdj', 'variation', '', 1)]), croise },
    { piste: vide, boutique: vide, fdj: e([c('fdj', 'variation', '', -1)]) });
  assert.strictEqual(r.length, 3);
  assert.deepStrictEqual(r.map(x => x.activite), ['piste', 'boutique', 'fdj']);
  assert.ok(!r.some(x => x.activite === 'croise'));
  assert.strictEqual(r.find(x => x.activite === 'fdj').fraicheur.perdu, false);
});

t('adaptateurs : Piste masquée, Boutique découplage sans masquée à part', () => {
  const piste = { etat: 'ok', carburants: [{ cle: 'sp95', nom: 'SP95', cmp: { ecart: -209 } }], total: { cmp: { ecart: 10 } }, candidats: [{ type: 'masquee', carburant: 'sp95', nom: 'SP95', I: 209, z: 4 }], motif: 'ordre par défaut' };
  const p = T.candidatsDecouvertes('piste', piste);
  assert.strictEqual(p.candidats[0].sens, -1);
  const bout = { etat: 'ok', global: { ecart: 5, caE: 100, caR: 80 }, categories: [{ nom: 'Gaz', contribution: 40 }], candidats: [{ type: 'masquee', categories: ['Gaz'] }, { type: 'decrochage', categories: ['Gaz'] }], retenue: { type: 'decrochage', categories: ['Gaz'] }, motif: 'x' };
  bout.retenue = bout.candidats[1];
  const b = T.candidatsDecouvertes('boutique', bout);
  assert.strictEqual(b.candidats.length, 1);
  assert.strictEqual(b.candidats[0].type, 'decrochage');
  assert.strictEqual(T.candidatsDecouvertes('fdj', { etat: 'insuffisant' }).candidats.length, 0);
  assert.strictEqual(T.candidatRelation({ etat: 'non-significative' }).candidats.length, 0);
});
t('une activité sans candidat net : le 2e candidat d\'une autre activité prend la place', () => {
  const r = T.selectionnerDecouvertes({ piste: e([c('piste', 'masquee', 'a'), c('piste', 'repartition', 'b')]), boutique: e([c('boutique', 'simple', '', 1, { net: false })]), fdj: vide });
  assert.deepStrictEqual(r.map(x => x.activite + ':' + x.type), ['piste:masquee', 'piste:repartition']);
  assert.ok(!r.some(x => x.activite === 'boutique'));
});

t('une relation non significative n\'est jamais retenue ni comptée parmi les écartées', () => {
  const rel = T.candidatRelation({ etat: 'ok', boutiqueFdj: { r: 0.2, significative: false } });
  assert.strictEqual(rel.candidats[0].net, false);
  const entrees = { piste: e([c('piste', 'masquee', 'a')]), boutique: vide, fdj: vide, croise: rel };
  const choix = T.selectionnerDecouvertes(entrees);
  assert.ok(!choix.some(x => x.activite === 'croise'));
  assert.deepStrictEqual(T.decouvertesEcartees(entrees, choix), []);
  const sig = T.candidatRelation({ etat: 'ok', boutiqueFdj: { r: 0.8, significative: true } });
  assert.strictEqual(sig.candidats[0].net, true);
});

t('les écartées sont nommées, une par une, et seulement quand il y en a', () => {
  const entrees = { piste: e([c('piste', 'masquee', 'a'), c('piste', 'repartition', 'b')]), boutique: e([c('boutique', 'simple')]), fdj: e([c('fdj', 'variation')]) };
  const choix = T.selectionnerDecouvertes(entrees, null, 3);
  const ec = T.decouvertesEcartees(entrees, choix);
  assert.strictEqual(ec.length, 1);
  assert.ok(/^Piste : /.test(ec[0]));
  assert.deepStrictEqual(T.decouvertesEcartees({ piste: e([c('piste', 'masquee', 'a')]), boutique: vide, fdj: vide }, T.selectionnerDecouvertes({ piste: e([c('piste', 'masquee', 'a')]), boutique: vide, fdj: vide })), []);
});

t('fraîcheur Boutique : calculée sur l\'import précédent (3 imports)', () => {
  global.window.NexusPeriodes || require('./nexus-periodes.js');
  const AP = window.NexusPeriodes.analyserPeriodes;
  const jr = (d, f) => (Date.parse(f) - Date.parse(d)) / 86400000 + 1;
  const L = (per, cats) => cats.map(([k, m, ca]) => ({ article: k + '-1', categorie: k, ca: ca * jr(per[0], per[1]), marge: m * jr(per[0], per[1]), periode_debut: per[0], periode_fin: per[1] }));
  const P0 = ['2026-02-16', '2026-03-29'], P1 = ['2026-04-27', '2026-06-07'], P2 = ['2026-06-08', '2026-06-30'];
  const rows = L(P0, [['Gaz', 100, 400], ['Boissons', 300, 1000]]).concat(L(P1, [['Gaz', 140, 560], ['Boissons', 270, 1000]]), L(P2, [['Gaz', 180, 720], ['Boissons', 240, 1000]]));
  const ab = T.analyseBoutique(rows, [], AP, []);
  assert.strictEqual(ab.etat, 'ok');
  const abPrec = T.analyseBoutique(rows.filter(x => x.periode_fin <= ab.reference.fin), [], AP, []);
  assert.strictEqual(abPrec.etat, 'ok');
  const r = T.selectionnerDecouvertes({ piste: vide, boutique: T.candidatsDecouvertes('boutique', ab), fdj: vide }, { piste: vide, boutique: T.candidatsDecouvertes('boutique', abPrec), fdj: vide });
  const b = r.find(x => x.activite === 'boutique');
  assert.strictEqual(b.fraicheur.etat, 'evaluable');
  assert.strictEqual(b.fraicheur.perdu, true);
});

t('fraîcheur Boutique : import précédent sans référence → non évaluable, raison réelle', () => {
  global.window.NexusPeriodes || require('./nexus-periodes.js');
  const AP = window.NexusPeriodes.analyserPeriodes;
  const rows = [{ article: 'Gaz-1', categorie: 'Gaz', ca: 1000, marge: 200, periode_debut: '2026-04-27', periode_fin: '2026-06-07' }, { article: 'Gaz-1', categorie: 'Gaz', ca: 1200, marge: 220, periode_debut: '2026-06-08', periode_fin: '2026-06-30' }];
  const abPrec = T.analyseBoutique(rows.filter(x => x.periode_fin <= '2026-06-07'), [], AP, []);
  assert.strictEqual(abPrec.etat, 'sans_reference');
  const r = T.selectionnerDecouvertes({ piste: vide, boutique: e([c('boutique', 'simple')]), fdj: vide }, { piste: vide, boutique: T.candidatsDecouvertes('boutique', abPrec), fdj: vide });
  assert.strictEqual(r[0].fraicheur.etat, 'non_evaluable');
  assert.ok(/pas de période de référence/.test(r[0].fraicheur.texte));
  assert.strictEqual(r[0].fraicheur.perdu, false);
});
console.log(n + ' épreuves');
