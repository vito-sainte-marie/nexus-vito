// ============================================================================
// VOIR UN BON OU UNE FACTURE (06/10/2026)
//
// Aucun écran n'ouvrait le fichier d'une facture ou d'un bon : la Boîte de
// réception n'offrait que « Supprimer », Compte client que « Envoyer ».
// Cette épreuve EXÉCUTE nexusVoirDocument (stockage et fenêtres simulés), puis
// les fonctions d'affichage des deux écrans, et vérifie qu'elles sont câblées.
// ============================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const unique = (src, motif, nom) => {
  const n = src.split(motif).length - 1;
  assert.strictEqual(n, 1, `${nom} : ancre attendue une fois, trouvée ${n} fois`);
  return src.indexOf(motif);
};

let echecs = 0;
const cas = async (nom, fn) => {
  try { await fn(); console.log('  ✓ ' + nom); }
  catch (e) { echecs++; console.log('  ✗ ' + nom + '\n      ' + e.message); }
};

const aide = lire('nexus-voir-document.js');
const fabriquer = new Function('nexusClient', 'window', 'alert', 'console',
  `${aide}\n return { nexusVoirDocument, NEXUS_BUCKET_DOCUMENTS, NEXUS_DUREE_LIEN_DOCUMENT_S };`);
const silence = { error() {}, log() {} };

// journal : ordre des événements, pour prouver que l'onglet s'ouvre avant l'attente.
function simuler({ lien = 'https://signe/doc.pdf', erreur = null, ongletRefuse = false } = {}) {
  const journal = [], alertes = [];
  const onglet = { opener: 'nexus', ferme: false, location: { href: '' }, close() { this.ferme = true; } };
  const fenetre = { location: { href: 'nexus' }, open: (u, cible) => { journal.push(['open', u, cible]); return ongletRefuse ? null : onglet; } };
  const client = { storage: { from: b => ({ createSignedUrl: async (c, d) => { journal.push(['signe', b, c, d]); return erreur ? { data: null, error: erreur } : { data: { signedUrl: lien }, error: null }; } }) } };
  const m = fabriquer(client, fenetre, x => alertes.push(x), silence);
  return { m, journal, alertes, onglet, fenetre };
}

(async () => {
  console.log('nexusVoirDocument — exécutée');

  await cas('ouvre l\'onglet pendant le clic, PUIS signe, puis y charge le lien', async () => {
    const s = simuler();
    assert.strictEqual(await s.m.nexusVoirDocument('vito-sainte-marie/bons/b.pdf'), true);
    assert.deepStrictEqual(s.journal.map(e => e[0]), ['open', 'signe'], 'l\'onglet doit précéder l\'attente du lien (Safari bloque sinon)');
    assert.deepStrictEqual(s.journal[1], ['signe', 'documents-a-traiter', 'vito-sainte-marie/bons/b.pdf', 300]);
    assert.strictEqual(s.onglet.location.href, 'https://signe/doc.pdf');
    assert.strictEqual(s.onglet.opener, null, 'l\'onglet garde un accès à NEXUS');
    assert.strictEqual(s.fenetre.location.href, 'nexus', 'NEXUS a été quitté alors qu\'un onglet était ouvert');
  });

  await cas('lien de courte durée (≤ 15 min), jamais les dix ans des preuves', async () => {
    const { NEXUS_DUREE_LIEN_DOCUMENT_S: d } = simuler().m;
    assert.ok(d > 0 && d <= 900, `durée ${d}`);
  });

  await cas('refus du stockage → onglet refermé, alerte qui dit pourquoi, rien d\'ouvert', async () => {
    const s = simuler({ erreur: { message: 'Object not found' } });
    assert.strictEqual(await s.m.nexusVoirDocument('x.pdf'), false);
    assert.strictEqual(s.onglet.ferme, true);
    assert.strictEqual(s.onglet.location.href, '');
    assert.strictEqual(s.alertes.length, 1);
    assert.match(s.alertes[0], /Object not found/);
  });

  await cas('onglet refusé par le navigateur → le document s\'ouvre quand même, ici', async () => {
    const s = simuler({ ongletRefuse: true });
    assert.strictEqual(await s.m.nexusVoirDocument('x.pdf'), true);
    assert.strictEqual(s.fenetre.location.href, 'https://signe/doc.pdf');
  });

  await cas('pas de chemin → alerte, ni onglet ni appel au stockage', async () => {
    const s = simuler();
    assert.strictEqual(await s.m.nexusVoirDocument(null), false);
    assert.deepStrictEqual(s.journal, []);
    assert.strictEqual(s.alertes.length, 1);
  });

  console.log('Boîte de réception — bouton « Voir »');
  const br = lire('NEXUS-Boite-Reception-v1.html');
  const dB = unique(br, '  function boutonVoir(chemin) {', 'boutonVoir');
  const fB = unique(br, '  function carteBon(d) {', 'carteBon');
  const boutonVoir = new Function(`${br.slice(dB, fB)}\n return boutonVoir;`)();

  await cas('le chemin voyage échappé dans un attribut, jamais dans le code du clic', async () => {
    const h = boutonVoir(`site/bons/l'été "x" <b>.pdf`);
    assert.match(h, /data-chemin="site\/bons\/l&#39;été &quot;x&quot; &lt;b&gt;\.pdf"/);
    assert.match(h, /onclick="nexusVoirDocument\(this\.dataset\.chemin\)"/);
    assert.strictEqual(boutonVoir(null), '');
  });

  await cas('« Voir » est câblé sur les cartes bon ET facture, et l\'aide est chargée', async () => {
    assert.strictEqual(br.split('${boutonVoir(d.fichier_path)}').length - 1, 2, 'un des deux types de carte n\'a pas son bouton');
    assert.match(br, /<script src="nexus-voir-document\.js\?v=\d+"><\/script>/);
  });

  console.log('Compte client — « Voir » la facture et les bons de sa période');
  const cc = lire('NEXUS-Comptes-Clients-v1.html');
  const dL = unique(cc, '  function lignesBonsDeLaFacture(c, f) {', 'lignesBonsDeLaFacture');
  const fL = unique(cc, '  function renderFacturesBloc(c) {', 'renderFacturesBloc');
  const dEsc = unique(cc, '  function escHtml(s) {', 'escHtml');
  const escSrc = cc.slice(dEsc, cc.indexOf('\n', dEsc));
  const lignes = new Function(`${escSrc}\n${cc.slice(dL, fL)}\n return lignesBonsDeLaFacture;`)();

  await cas('seuls les bons de la période de la facture, dans l\'ordre de dépôt', async () => {
    const c = { bons: [
      { billing_period_id: 'p-aout', fichier_path: 'b2.pdf', created_at: '2026-09-02' },
      { billing_period_id: 'p-juil', fichier_path: 'bj.pdf', created_at: '2026-08-01' },
      { billing_period_id: 'p-aout', fichier_path: 'b1.pdf', created_at: '2026-09-01' },
    ] };
    const h = lignes(c, { billing_period_id: 'p-aout' });
    assert.deepStrictEqual([...h.matchAll(/data-voir-document="([^"]+)"/g)].map(m => m[1]), ['b1.pdf', 'b2.pdf']);
    assert.match(h, /Voir bon 1/);
  });

  await cas('rien à montrer : facture sans période, aucun bon de la période', async () => {
    assert.strictEqual(lignes({ bons: [{ billing_period_id: 'p', fichier_path: 'b.pdf' }] }, { billing_period_id: null }), '');
    assert.strictEqual(lignes({ bons: [] }, { billing_period_id: 'p' }), '');
  });

  await cas('bouton de la facture, chemin des bons chargé, clic relié à l\'aide', async () => {
    assert.match(cc, /f\.fichier_path \? `<button type="button" class="btn-voir" data-voir-document="\$\{escHtml\(f\.fichier_path\)\}">Voir<\/button>`/);
    assert.match(cc, /\$\{lignesBonsDeLaFacture\(c, f\)\}/);
    const ch = cc.slice(cc.indexOf('async function chargerClients'), cc.indexOf('async function journaliser'));
    assert.match(ch, /from\('supporting_documents'\)\.select\('[^']*fichier_path[^']*'\)\.eq\('type_document', 'bon'\)/, 'les chemins des bons ne sont pas chargés');
    assert.match(cc, /querySelectorAll\('\[data-voir-document\]'\)\.forEach\(btn => \{\s*btn\.addEventListener\('click', \(\) => nexusVoirDocument\(btn\.dataset\.voirDocument\)\);/);
    assert.match(cc, /<script src="nexus-voir-document\.js\?v=\d+"><\/script>/);
  });

  console.log(echecs ? `\n${echecs} échec(s)` : '\nToutes les épreuves passent.');
  process.exit(echecs ? 1 : 0);
})();
