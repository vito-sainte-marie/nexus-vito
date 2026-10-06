// ============================================================================
// SUPPRIMER UN DOUBLON DEPUIS LA BOÎTE DE RÉCEPTION (06/10/2026)
//
// Le 06/10 à 21:46, trois bons (SMPSJ, RMSJ, SPCRG) déjà reçus ont été
// redéposés ; le bouton « Supprimer » existant effaçait la ligne mais laissait
// sa ligne de file OCR, et ne disait pas lequel des deux était le doublon.
// Cette épreuve EXÉCUTE nexusDoublonsDocuments, puis supprimerDoublon et
// effacerDocument extraits de la page, contre une base simulée.
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

const { nexusDoublonsDocuments } = new Function(`${lire('nexus-doublons-documents.js')}\n return { nexusDoublonsDocuments };`)();

// --- Fonctions de la page -------------------------------------------------
const page = lire('NEXUS-Boite-Reception-v1.html');
const extraire = (debut, fin, nom) => {
  const i = unique(page, debut, nom);
  const j = page.indexOf(fin, i);
  assert(j > i, `${nom} : fin introuvable`);
  return page.slice(i, j + fin.length);
};
const srcEffacer = extraire('  async function effacerDocument(', '\n    return true;\n  }\n', 'effacerDocument');
const srcDoublon = extraire('  async function supprimerDoublon(', '\n    render();\n  }\n', 'supprimerDoublon');

// --- Base simulée ---------------------------------------------------------
function baseSimulee(tables, { stockageAutorise = true } = {}) {
  const journal = { stockage: [] };
  const from = nom => {
    const filtres = [];
    let mode = 'select', opts = {}, retour = false;
    const lignes = () => tables[nom].filter(l => filtres.every(f => f(l)));
    const b = {
      select(_c, o) { if (mode === 'delete') retour = true; else opts = o || {}; return b; },
      delete() { mode = 'delete'; return b; },
      eq(c, v) { filtres.push(l => l[c] === v); return b; },
      not(c, _op, _v) { filtres.push(l => l[c] != null); return b; },
      limit() { return b; },
      maybeSingle() { const r = lignes(); return Promise.resolve({ data: r[0] || null, error: null }); },
      then(ok, ko) {
        let res;
        if (mode === 'delete') {
          const r = lignes();
          tables[nom] = tables[nom].filter(l => !r.includes(l));
          res = { data: retour ? r.map(l => ({ id: l.id })) : null, error: null };
        } else if (opts.head) res = { data: null, count: lignes().length, error: null };
        else res = { data: lignes(), error: null };
        return Promise.resolve(res).then(ok, ko);
      },
    };
    return b;
  };
  const client = {
    from,
    storage: { from: () => ({ remove: async chemins => { journal.stockage.push(...chemins); return { data: stockageAutorise ? chemins.map(name => ({ name })) : [], error: null }; } }) },
  };
  return { client, tables, journal };
}

function charger(base, doublons, reponseConfirm = true) {
  const alertes = [], confirmations = [];
  const env = {
    nexusClient: base.client, BUCKET: 'documents-a-traiter', doublons,
    nomFichier: c => (c || '').split('/').pop(),
    chargerDocumentsRecents: async () => {}, render: () => {},
    alert: m => alertes.push(m), confirm: m => { confirmations.push(m); return reponseConfirm; },
    console: { error() {}, warn() {}, log() {} },
  };
  const f = new Function(...Object.keys(env), `${srcEffacer}\n${srcDoublon}\n return { effacerDocument, supprimerDoublon };`)(...Object.values(env));
  return Object.assign(f, { alertes, confirmations });
}

// Forme des données du 06/10 (identifiants fictifs).
const etat = () => ({
  supporting_documents: [
    { id: 'b-smpsj-1', fichier_hash: 'h-smpsj', fichier_path: 's/bons/1-BONS_SMPSJ.pdf', client_id: 'c-smpsj', documents_ocr_file_id: 'o1', created_at: '2026-10-06T19:11:45Z' },
    { id: 'b-smpsj-2', fichier_hash: 'h-smpsj', fichier_path: 's/bons/2-BONS_SMPSJ.pdf', client_id: 'c-smpsj', documents_ocr_file_id: 'o2', created_at: '2026-10-06T21:46:06Z' },
    { id: 'b-spcrg-1', fichier_hash: 'h-spcrg', fichier_path: 's/bons/1-BONS_SPCRG.pdf', client_id: 'c-spcrg', documents_ocr_file_id: 'o3', created_at: '2026-10-06T20:54:24Z' },
  ],
  documents_ocr_file: [{ id: 'o1' }, { id: 'o2' }, { id: 'o3' }],
  invoices: [],
});
const enDocs = t => [
  ...t.supporting_documents.map(b => Object.assign({ type: 'bon' }, b)),
  ...t.invoices.map(f => Object.assign({ type: 'facture' }, f)),
];

(async () => {
  console.log('Règle : quelle ligne est conservée');

  await cas('le premier dépôt est conservé, la copie proposée', () => {
    const r = nexusDoublonsDocuments(enDocs(etat()));
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].garde.id, 'b-smpsj-1');
    assert.strictEqual(r[0].doublon.id, 'b-smpsj-2');
    assert.strictEqual(r[0].supprimable, true);
  });

  await cas('un fichier déposé une seule fois n’est pas un doublon', () => {
    const r = nexusDoublonsDocuments(enDocs(etat()));
    assert(!r.some(x => x.garde.id === 'b-spcrg-1' || x.doublon.id === 'b-spcrg-1'));
  });

  await cas('une facture et un bon de même empreinte ne se confondent pas', () => {
    const r = nexusDoublonsDocuments([
      { type: 'facture', id: 'f', fichier_hash: 'h', created_at: '1' },
      { type: 'bon', id: 'b', fichier_hash: 'h', created_at: '2' },
    ]);
    assert.strictEqual(r.length, 0);
  });

  await cas('sans empreinte, jamais de doublon', () => {
    assert.strictEqual(nexusDoublonsDocuments([{ type: 'bon', id: 'a' }, { type: 'bon', id: 'b' }]).length, 0);
  });

  await cas('la facture envoyée est conservée même si elle est la plus récente', () => {
    const r = nexusDoublonsDocuments([
      { type: 'facture', id: 'ancienne', fichier_hash: 'h', statut: 'identifiee', client_id: 'c', created_at: '2026-10-06T20:54Z' },
      { type: 'facture', id: 'envoyee', fichier_hash: 'h', statut: 'envoyee', client_id: 'c', created_at: '2026-10-06T21:44Z' },
    ]);
    assert.strictEqual(r[0].garde.id, 'envoyee');
    assert.strictEqual(r[0].supprimable, true);
  });

  await cas('la ligne rattachée à un client est conservée plutôt que la ligne sans client', () => {
    const r = nexusDoublonsDocuments([
      { type: 'bon', id: 'sans', fichier_hash: 'h', client_id: null, created_at: '1' },
      { type: 'bon', id: 'avec', fichier_hash: 'h', client_id: 'c', created_at: '2' },
    ]);
    assert.strictEqual(r[0].garde.id, 'avec');
  });

  await cas('deux factures envoyées : rien n’est proposé à la suppression', () => {
    const r = nexusDoublonsDocuments([
      { type: 'facture', id: 'a', fichier_hash: 'h', statut: 'envoyee', created_at: '1' },
      { type: 'facture', id: 'b', fichier_hash: 'h', statut: 'envoyee', created_at: '2' },
    ]);
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].supprimable, false);
  });

  await cas('trois dépôts du même fichier : deux copies, une seule ligne conservée', () => {
    const r = nexusDoublonsDocuments([
      { type: 'bon', id: 'a', fichier_hash: 'h', created_at: '3' },
      { type: 'bon', id: 'b', fichier_hash: 'h', created_at: '1' },
      { type: 'bon', id: 'c', fichier_hash: 'h', created_at: '2' },
    ]);
    assert.deepStrictEqual(r.map(x => x.garde.id), ['b', 'b']);
    assert.deepStrictEqual(r.map(x => x.doublon.id).sort(), ['a', 'c']);
  });

  console.log('Page : supprimer le doublon');

  await cas('supprimer le doublon retire le bon, sa ligne OCR et son fichier ; l’original reste', async () => {
    const base = baseSimulee(etat());
    const f = charger(base, nexusDoublonsDocuments(enDocs(base.tables)));
    await f.supprimerDoublon('bon', 'b-smpsj-2');
    assert.deepStrictEqual(base.tables.supporting_documents.map(b => b.id), ['b-smpsj-1', 'b-spcrg-1']);
    assert.deepStrictEqual(base.tables.documents_ocr_file.map(o => o.id), ['o1', 'o3']);
    assert.deepStrictEqual(base.journal.stockage, ['s/bons/2-BONS_SMPSJ.pdf']);
    assert.strictEqual(f.alertes.length, 0);
  });

  await cas('si la ligne conservée a disparu, rien n’est supprimé', async () => {
    const base = baseSimulee(etat());
    const f = charger(base, nexusDoublonsDocuments(enDocs(base.tables)));
    base.tables.supporting_documents = base.tables.supporting_documents.filter(b => b.id !== 'b-smpsj-1');
    await f.supprimerDoublon('bon', 'b-smpsj-2');
    assert(base.tables.supporting_documents.some(b => b.id === 'b-smpsj-2'));
    assert.strictEqual(f.alertes.length, 1);
    assert.strictEqual(f.confirmations.length, 0);
  });

  await cas('annuler la confirmation ne supprime rien', async () => {
    const base = baseSimulee(etat());
    const f = charger(base, nexusDoublonsDocuments(enDocs(base.tables)), false);
    await f.supprimerDoublon('bon', 'b-smpsj-2');
    assert.strictEqual(base.tables.supporting_documents.length, 3);
    assert.strictEqual(base.tables.documents_ocr_file.length, 3);
  });

  await cas('l’original n’est jamais supprimable par ce bouton', async () => {
    const base = baseSimulee(etat());
    const f = charger(base, nexusDoublonsDocuments(enDocs(base.tables)));
    await f.supprimerDoublon('bon', 'b-smpsj-1');
    assert.strictEqual(base.tables.supporting_documents.length, 3);
  });

  await cas('deux factures envoyées : le bouton ne supprime rien', async () => {
    const t = etat();
    t.invoices = [
      { id: 'f1', fichier_hash: 'h-f', fichier_path: 's/f1.pdf', statut: 'envoyee', client_id: 'c', created_at: '1' },
      { id: 'f2', fichier_hash: 'h-f', fichier_path: 's/f2.pdf', statut: 'envoyee', client_id: 'c', created_at: '2' },
    ];
    const base = baseSimulee(t);
    const f = charger(base, nexusDoublonsDocuments(enDocs(base.tables)));
    await f.supprimerDoublon('facture', 'f2');
    assert.deepStrictEqual(base.tables.invoices.map(x => x.id), ['f1', 'f2']);
    assert.strictEqual(f.confirmations.length, 0);
  });

  await cas('un fichier encore cité par une autre ligne reste dans le stockage', async () => {
    const t = etat();
    t.supporting_documents[1].fichier_path = t.supporting_documents[0].fichier_path;
    const base = baseSimulee(t);
    const f = charger(base, nexusDoublonsDocuments(enDocs(base.tables)));
    await f.supprimerDoublon('bon', 'b-smpsj-2');
    assert.strictEqual(base.tables.supporting_documents.length, 2);
    assert.deepStrictEqual(base.journal.stockage, []);
  });

  await cas('une suppression refusée par la base est signalée, la ligne OCR reste', async () => {
    const base = baseSimulee(etat());
    const f = charger(base, []);
    const ok = await f.effacerDocument('bon', 'inexistant', 'x.pdf');
    assert.strictEqual(ok, false);
    assert.strictEqual(f.alertes.length, 1);
    assert.strictEqual(base.tables.documents_ocr_file.length, 3);
  });

  await cas('la page affiche la section et charge la règle', () => {
    unique(page, '<script src="nexus-doublons-documents.js?v=', 'script de la règle');
    unique(page, '${sectionDoublons}', 'section Doublons');
    unique(page, 'doublons = nexusDoublonsDocuments(', 'calcul des doublons');
  });

  console.log(echecs ? `\n${echecs} échec(s)` : '\nTout est vert.');
  process.exit(echecs ? 1 : 0);
})();
