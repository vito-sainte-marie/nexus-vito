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
console.log(n + '/' + n + ' réussies');
