// Épreuves de la logique pure des relevés piste (lot FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016).
const assert = require('assert');
const R = require('./nexus-releves-piste.js');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }

t('ordre physique P1 GO|SP, P2 SP|GO, P3 GO|SP, P4 SP|GO', () => {
  assert.deepStrictEqual(R.ORDRE_PHYSIQUE, { 1: ['GO', 'SP'], 2: ['SP', 'GO'], 3: ['GO', 'SP'], 4: ['SP', 'GO'] });
});
t('ordre de recopie Decenium : SP puis GO par pompe, puis GNR', () => {
  const o = R.ordreRecopieDecenium().map(x => (x.pompe || '') + x.produit);
  assert.deepStrictEqual(o, ['1SP','1GO','2SP','2GO','3SP','3GO','4SP','4GO','GNR']);
});
t('saisie nettoyée à 7 chiffres', () => {
  assert.strictEqual(R.nettoyerSaisie('12 34a5678'), '1234567');
  assert.strictEqual(R.nettoyerSaisie(null), '');
});
t('conversion 7→6 : sans perte si le chiffre retiré est 0', () => {
  assert.deepStrictEqual(R.convertirSeptVersSix('0123456'), { valeurDecenium: '123456', troncatureSansPerte: true, chiffreRetire: '0' });
});
t('conversion 7→6 : avec perte signalée sinon', () => {
  const c = R.convertirSeptVersSix('1234567');
  assert.strictEqual(c.valeurDecenium, '234567');
  assert.strictEqual(c.troncatureSansPerte, false);
});
t('conversion refuse une valeur non 7 chiffres', () => {
  assert.strictEqual(R.convertirSeptVersSix('12345'), null);
});
t('index inférieur au précédent = alerte forte', () => {
  assert.strictEqual(R.controlerIndex('0001000', 1500).niveau, 'fort');
});
t('écart > 4000 L = indicatif, non bloquant', () => {
  const c = R.controlerIndex('0010000', 1000);
  assert.strictEqual(c.niveau, 'indicatif');
});
t('écart ≤ 4000 L et sans référence = ok', () => {
  assert.strictEqual(R.controlerIndex('0002000', 1000).niveau, 'ok');
  assert.strictEqual(R.controlerIndex('0002000', null).niveau, 'ok');
});
t('revue : recul sans motif bloque, avec motif débloque, écart élevé ne bloque pas', () => {
  const s = {}, prec = {};
  R.POMPES.forEach(p => R.ORDRE_PHYSIQUE[p].forEach(pr => { s[`${p}-${pr}`] = '0100000'; prec[`${p}-${pr}`] = 100000; }));
  s['1-GO'] = '0050000'; s['2-SP'] = '0200000';
  let r = R.revueAnomalies(s, prec, {});
  assert.strictEqual(r.peutValider, false);
  r = R.revueAnomalies(s, prec, { '1-GO': 'compteur remplacé' });
  assert.strictEqual(r.peutValider, true);
  assert.ok(r.lignes.some(l => l.clef === '2-SP' && l.code === 'ECART_ELEVE' && !l.bloquant));
});
t('revue : une valeur manquante bloque', () => {
  assert.strictEqual(R.revueAnomalies({}, {}, {}).peutValider, false);
});
t('Q1/Q2 compteur par compteur sans trancher', () => {
  const q = R.comparerQ1Q2({ '1-GO': '0000100', '1-SP': '0000200' }, { '1-GO': '0000100', '1-SP': '0000250' });
  assert.strictEqual(q.find(x => x.clef === '1-GO').etat, 'concordant');
  assert.strictEqual(q.find(x => x.clef === '1-SP').etat, 'divergent');
  assert.strictEqual(q.find(x => x.clef === '2-GO').etat, 'incomplet');
});
t('corriger une valeur cochée annule la coche', () => {
  const l = R.appliquerCorrection({ valeurSept: '0000100', recopiee: true }, '0000101');
  assert.strictEqual(l.recopiee, false);
  assert.strictEqual(R.appliquerCorrection({ valeurSept: '0000100', recopiee: true }, '0000100').recopiee, true);
});
t('texte de confirmation exact et GNR de référence', () => {
  assert.strictEqual(R.TEXTE_CONFIRMATION_RECOPIE, 'Je confirme avoir recopié les valeurs dans Decenium.');
  assert.strictEqual(R.GNR_INDEX_REFERENCE, 1191213);
});

// ---- Arbitrages du 17/10 : début de quart, habilitation, tolérance de nuit ----
t('quatre moments ; début/fin distingués', () => {
  assert.deepStrictEqual(R.MOMENTS, ['debut_q1', 'fin_q1', 'debut_q2', 'fin_q2']);
  assert.ok(R.estDebut('debut_q1') && R.estDebut('debut_q2') && R.estFin('fin_q1') && R.estFin('fin_q2'));
  assert.ok(!R.estFin('debut_q1') && !R.estDebut('fin_q2'));
});
t('habilitation : le pompiste ne voit que les moments de son quart réel', () => {
  assert.deepStrictEqual(R.momentsHabilites(['matin']), ['debut_q1', 'fin_q1']);
  assert.deepStrictEqual(R.momentsHabilites(['soir']), ['debut_q2', 'fin_q2']);
  assert.deepStrictEqual(R.momentsHabilites(['Q1', 'Q2']), R.MOMENTS);
  assert.deepStrictEqual(R.momentsHabilites([]), []);
  assert.deepStrictEqual(R.momentsHabilites(null), []);
  assert.deepStrictEqual(R.momentsHabilites(['inconnu']), []);
  assert.deepStrictEqual(R.momentsHabilites([], 'manager'), R.MOMENTS);
  assert.deepStrictEqual(R.momentsHabilites([], 'gerant'), R.MOMENTS);
  assert.deepStrictEqual(R.momentsHabilites([], 'pompiste'), []);
});
t('tolérance de nuit : 0, +1, +2..+9, >=+10, diminution', () => {
  assert.strictEqual(R.classerEcartNuit(0).code, 'conforme');
  assert.strictEqual(R.classerEcartNuit(1).code, 'toleree');
  [2, 5, 9].forEach(e => assert.strictEqual(R.classerEcartNuit(e).code, 'a_justifier'));
  [10, 11, 500].forEach(e => assert.strictEqual(R.classerEcartNuit(e).code, 'alerte_prioritaire'));
  [-1, -9999].forEach(e => assert.strictEqual(R.classerEcartNuit(e).code, 'diminution'));
  assert.strictEqual(R.classerEcartNuit(null).code, null);
});
t('début : 2 derniers chiffres concordants → confirmée ; différents → refusés', () => {
  const ok = R.evaluerDebut('0123456', '56');
  assert.deepStrictEqual([ok.ok, ok.statut, ok.valeurSept], [true, 'confirmee_deux_chiffres', '0123456']);
  const ko = R.evaluerDebut('0123456', '57');
  assert.deepStrictEqual([ko.ok, ko.raison], [false, 'DEUX_CHIFFRES_DIFFERENTS']);
  assert.strictEqual(R.evaluerDebut('0123456', '0123460').statut, 'saisie_complete');
});
t('début : référence indisponible → sept chiffres requis', () => {
  assert.strictEqual(R.evaluerDebut(null, '56').ok, false);
  assert.strictEqual(R.evaluerDebut(null, '56').raison, 'SEPT_CHIFFRES_REQUIS');
  const c = R.evaluerDebut(null, '0123456');
  assert.deepStrictEqual([c.ok, c.statut, c.valeurSept], [true, 'indisponible', '0123456']);
});
t('retour à zéro du compteur : diminution signalée, jamais bloquante au début de Q1', () => {
  const s = {}, pr = {};
  R.POMPES.forEach(p => R.ORDRE_PHYSIQUE[p].forEach(x => { s[p + '-' + x] = '0000005'; pr[p + '-' + x] = 9999990; }));
  const r = R.revueAnomalies(s, pr, {}, 'debut_q1');
  assert.ok(r.lignes.some(l => l.code === 'NUIT_DIMINUTION'));
  assert.strictEqual(r.peutValider, true);
});
t('début de Q1 : contrôle par compteur, les huit indépendants', () => {
  const s = {}, pr = {};
  R.POMPES.forEach(p => R.ORDRE_PHYSIQUE[p].forEach(x => { s[p + '-' + x] = '0001000'; pr[p + '-' + x] = 1000; }));
  s['2-GO'] = '0001001'; s['3-SP'] = '0001012';
  const r = R.revueAnomalies(s, pr, {}, 'debut_q1');
  const par = Object.fromEntries(r.lignes.map(l => [l.clef, l.code]));
  assert.strictEqual(par['2-GO'], 'NUIT_TOLEREE');
  assert.strictEqual(par['3-SP'], 'NUIT_ALERTE_PRIORITAIRE');
  assert.strictEqual(Object.keys(par).length, 2);
  assert.strictEqual(r.peutValider, true);
});
t('index identiques fin puis début : aucune anomalie (deux attestations distinctes)', () => {
  const s = {}, pr = {};
  R.POMPES.forEach(p => R.ORDRE_PHYSIQUE[p].forEach(x => { s[p + '-' + x] = '0004242'; pr[p + '-' + x] = 4242; }));
  assert.strictEqual(R.revueAnomalies(s, pr, {}, 'debut_q1').lignes.length, 0);
});
t('cause de l\'échec photo : refus du serveur distinct du réseau', () => {
  assert.strictEqual(R.causePhoto({ statusCode: '403', message: 'new row violates row-level security policy' }, true).type, 'refus');
  assert.ok(/quart en cours/.test(R.causePhoto({ statusCode: '403', message: 'x' }, true).message));
  assert.strictEqual(R.causePhoto({ statusCode: '413', message: 'Payload too large' }, true).type, 'refus');
  assert.strictEqual(R.causePhoto({ message: 'Failed to fetch' }, true).type, 'reseau');
  assert.strictEqual(R.causePhoto({ statusCode: '403', message: 'x' }, false).type, 'reseau');
  assert.strictEqual(R.causePhoto(null, true).type, 'reseau');
});
t('photo Android : extension d\'après le type, nom sans extension toléré, format inconnu refusé', () => {
  const e = (name, type) => R.extensionPhoto({ name, type });
  assert.deepStrictEqual(e('IMG_2026.jpg', 'image/jpeg'), { ext: 'jpg', contentType: 'image/jpeg' });
  assert.strictEqual(e('image', 'image/jpeg').ext, 'jpg');          // Android : nom sans extension
  assert.strictEqual(e('1699999999', 'image/jpeg').ext, 'jpg');
  assert.strictEqual(e('1699.tmp', 'image/png').ext, 'png');         // le type prime sur un nom trompeur
  assert.strictEqual(e('photo', '').ext, 'jpg');                    // type absent : JPEG d'appareil
  assert.strictEqual(e('photo.JPEG', '').ext, 'jpg');
  assert.strictEqual(e('a.heif', 'image/heif').ext, 'heic');
  assert.strictEqual(e('a.webp', 'image/webp').contentType, 'image/webp');
  assert.strictEqual(e('a.gif', 'image/gif'), null);                // hors politique : refus clair
  assert.strictEqual(e('a.avif', 'image/avif'), null);
  assert.strictEqual(R.extensionPhoto(null).ext, 'jpg');
});
t('pré-contrôle pompiste : seul un false franc bloque l\'envoi', () => {
  assert.strictEqual(R.precontrolePompiste({ data: false, error: null }).ok, false);
  assert.ok(/quart en cours/.test(R.precontrolePompiste({ data: false, error: null }).message));
  assert.strictEqual(R.precontrolePompiste({ data: true, error: null }).ok, true);
  assert.strictEqual(R.precontrolePompiste({ data: null, error: { message: 'x' } }).ok, true);
  assert.strictEqual(R.precontrolePompiste({ data: false, error: { message: 'x' } }).ok, true);
  assert.strictEqual(R.precontrolePompiste(null).ok, true);
});
t('historique manager : regroupe par moment, garde les auteurs, compare Q1/Q2 sans trancher', () => {
  const vals = (base, decal) => [1, 2, 3, 4].flatMap(p => ['SP', 'GO'].map(pr => ({ pompe: p, produit: pr, valeur_sept_chiffres: String(base + p * 10 + (pr === 'GO' ? 1 : 0) + (p === 3 && pr === 'GO' ? decal : 0)).padStart(7, '0'), recopiee: pr === 'SP' })));
  const rel = (id, moment, auteur, statut, v, extra) => Object.assign({ id, moment, auteur, auteur_nom: 'n' + auteur, statut, cree_le: '2026-10-17T0' + id + ':00:00Z', carburant_index_valeurs: v }, extra);
  const s = R.synthetiserJournee([
    rel('1', 'fin_q1', 'A', 'final', vals(1000, 0)),
    rel('2', 'debut_q2', 'B', 'final', vals(1000, 5)),
    rel('3', 'debut_q2', 'C', 'brouillon', vals(1000, 0).slice(0, 3)),
  ]);
  assert.strictEqual(s.parMoment.debut_q2.length, 2);
  assert.strictEqual(s.parMoment.fin_q1[0].auteurNom, 'nA');
  assert.strictEqual(s.parMoment.fin_q1[0].recopiees, 4);
  assert.strictEqual(s.q1q2.complete, true);
  assert.strictEqual(s.q1q2.divergents, 1);                       // le brouillon incomplet ne compte pas
  assert.strictEqual(s.q1q2.memeAuteur, false);
  assert.strictEqual(s.q1q2.lignes.find(l => l.etat === 'divergent').ecart, 5);
  const m = R.synthetiserJournee([rel('1', 'fin_q1', 'A', 'final', vals(1000, 0)), rel('2', 'debut_q2', 'A', 'final', vals(1000, 0))]);
  assert.strictEqual(m.q1q2.divergents, 0);
  assert.strictEqual(m.q1q2.memeAuteur, true);                    // pas deux déclarations indépendantes
  const nuit = R.synthetiserJournee([rel('1', 'debut_q1', 'A', 'final', vals(1000, 0).map((v, i) => i === 2 ? Object.assign({}, v, { anomalie_nuit: 'a_justifier', ecart_nuit: 4 }) : Object.assign({}, v, { anomalie_nuit: 'conforme', ecart_nuit: 0 })))]);
  assert.strictEqual(nuit.anomaliesTotal, 1);
  assert.deepStrictEqual(nuit.parMoment.debut_q1[0].anomalies[0], { clef: '2-SP', code: 'a_justifier', ecart: 4 });
  assert.strictEqual(R.synthetiserJournee(null).q1q2.complete, false);
});
console.log(n + '/' + n + ' réussies');
