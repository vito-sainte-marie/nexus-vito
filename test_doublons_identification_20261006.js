// ============================================================================
// DOUBLONS ET IDENTIFICATION DU CLIENT (06/10/2026)
//
// Le 06/10 à 20:54, onze factures et deux bons déjà reçus ont été redéposés
// par la Boîte de réception et enregistrés une seconde fois ; une facture
// « VERDIER Paul DIVERS » était rangée sous « VERDIER Paul ».
// Cette épreuve EXÉCUTE :
//   1. nexusIdentifierClient sur des factures au format Decenium (lignes, et
//      texte « à plat » tel que pdf.js le rend) ;
//   2. deposerFichier de la Boîte de réception contre une base simulée qui
//      applique, ou non, l'index unique sur fichier_hash.
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

const module_ = lire('nexus-identification-client.js');
const { nexusIdentifierClient } = new Function(`${module_}\n return { nexusIdentifierClient };`)();

// Comptes fictifs, mêmes formes que les vrais (deux paires principal / divers).
const CLIENTS = [
  { id: 'c-2aa', code_client: '2AA', raison_sociale: '2AA DEPANNAGE', siret: '11122233300020' },
  { id: 'c-bonyc', code_client: 'BONYC-020', raison_sociale: 'Bonyc Fuel Distribution Sainte Marie', siret: null },
  { id: 'c-dupont', code_client: 'DUPA-017', raison_sociale: 'DUPONT Anaïs', siret: null },
  { id: 'c-dupont-d', code_client: 'DUPA-014', raison_sociale: 'DUPONT Anaïs divers', siret: null },
  { id: 'c-vp', code_client: 'VERD-012', raison_sociale: 'VERDIER Paul', siret: null },
  { id: 'c-vp-d', code_client: 'VERD-011', raison_sociale: 'VERDIER Paul DIVERS', siret: null },
  { id: 'c-deau', code_client: 'DEAU-021', raison_sociale: 'DEAU HAURE SARL', siret: null },
  { id: 'c-smpsj', code_client: 'SMPSJ-009', raison_sociale: 'SAINT JAMES - SMPSJ', siret: '44455566600011' },
  { id: 'c-snta', code_client: 'SNTA-013', raison_sociale: 'SNTA', siret: null },
];
const CONTACTS = [
  { client_id: 'c-dupont', email_principal: 'dupont@exemple.test' },
  { client_id: 'c-dupont-d', email_principal: 'dupont@exemple.test' },
  { client_id: 'c-vp', email_principal: 'verdier@exemple.test' },
  { client_id: 'c-vp-d', email_principal: 'verdier@exemple.test' },
  { client_id: 'c-deau', email_principal: 'compta@deau.test', email_secondaire: 'dirigeant@deau.test' },
  { client_id: 'c-snta', email_principal: 'snta@exemple.test' },
];
const PIED = 'BONYC FUEL DISTRIBUTION STE MARIE - 97230 Sainte-Marie - Siret : 77788899900024';
const facture = (...lignes) => ['Facture Client', 'Référence : FAC-2026-0001', 'Date : 30/09/2026', ...lignes, 'Total TTC 100,00', PIED].join('\n');
const aPlat = t => t.replace(/\s*\n\s*/g, ' ');
const id = t => nexusIdentifierClient(t, CLIENTS, CONTACTS);
const lesDeux = (t, attendu, methode) => {
  for (const [forme, texte] of [['lignes', t], ['à plat', aPlat(t)]]) {
    const r = id(texte);
    assert.strictEqual(r.clientId, attendu, `${forme} : ${JSON.stringify(r)}`);
    if (methode) assert.strictEqual(r.methode, methode, `${forme} : méthode`);
  }
};

(async () => {
  console.log('nexusIdentifierClient — exécutée');

  await cas('DUPONT Anaïs et DUPONT Anaïs divers restent deux comptes', async () => {
    lesDeux(facture('DUPONT Anaís divers', 'dupont@exemple.test'), 'c-dupont-d', 'raison_sociale');
    lesDeux(facture('DUPONT Anaís', 'dupont@exemple.test'), 'c-dupont', 'raison_sociale');
  });

  await cas('VERDIER Paul et VERDIER Paul DIVERS restent deux comptes (les deux formats Decenium)', async () => {
    lesDeux(facture('VERDIER Paul', 'verdier@exemple.test'), 'c-vp');
    lesDeux(['Facture Client - FAC-2026-2381351', 'Dénomination : VERDIER Paul DIVERS', 'verdier@exemple.test', PIED].join('\n'), 'c-vp-d');
  });

  await cas('e-mail partagé seul : aucun compte choisi, les deux proposés', async () => {
    const r = id(facture('Madame X', 'dupont@exemple.test'));
    assert.strictEqual(r.clientId, null);
    assert.strictEqual(r.motif, 'AMBIGU_METIER');
    assert.strictEqual(r.methode, 'manuel');
    assert.deepStrictEqual([...r.candidats].sort(), ['c-dupont', 'c-dupont-d']);
  });

  await cas('« Siret Client » prime sur le nom ; le SIRET de l\'émetteur n\'est jamais pris', async () => {
    lesDeux(facture('DUPONT Anaís', 'Siret Client : 11122233300020'), 'c-2aa', 'siret');
    const r = id(facture('Inconnu SARL'));
    assert.strictEqual(r.clientId, null, 'le pied BONYC a désigné un compte');
    assert.strictEqual(r.siret, null, 'le SIRET émetteur a été lu comme SIRET client');
  });

  await cas('SIREN à 9 chiffres (Siret Client : 444555666) → le compte dont le SIRET commence ainsi', async () => {
    lesDeux(facture('Siret Client : 444555666'), 'c-smpsj', 'siret');
  });

  await cas('le pied de page « BONYC … STE MARIE » ne désigne pas le compte BONYC', async () => {
    assert.strictEqual(id(facture('Personne')).clientId, null);
  });

  await cas('plusieurs e-mails d\'un même compte → ce compte', async () => {
    lesDeux(facture('Madame Y', 'compta@deau.test; dirigeant@deau.test'), 'c-deau', 'email');
  });

  await cas('e-mails de deux comptes différents → ambigu', async () => {
    const r = id(facture('Madame Z', 'compta@deau.test', 'snta@exemple.test'));
    assert.strictEqual(r.clientId, null);
    assert.strictEqual(r.motif, 'AMBIGU_METIER');
  });

  await cas('repli sur la raison sociale sans SIRET ni e-mail ; code client en dernier recours', async () => {
    lesDeux(facture('DEAU HAURE SARL'), 'c-deau', 'raison_sociale');
    lesDeux(facture('Compte DUPA-014'), 'c-dupont-d', 'code_client');
  });

  await cas('nom en mots entiers : « SNTAX » ne désigne pas SNTA', async () => {
    assert.strictEqual(id(facture('SNTAX Martinique')).clientId, null);
  });

  console.log('Boîte de réception — deposerFichier exécutée contre une base simulée');
  const br = lire('NEXUS-Boite-Reception-v1.html');
  const dD = unique(br, '  async function dejaIngere(hash) {', 'dejaIngere');
  const fD = unique(br, '  async function gererFichiers(fileList) {', 'gererFichiers');
  const dN = unique(br, '  function nomFichierSur(nom) {', 'nomFichierSur');
  const nomSurSrc = br.slice(dN, br.indexOf('\n  }\n', dN) + 4);

  // Base simulée : tables, stockage, index unique optionnel sur fichier_hash.
  function base({ indexUnique = true, erreurLecture = false } = {}) {
    const t = { invoices: [], supporting_documents: [], documents_ocr_file: [] }, objets = [];
    let seq = 0;
    const requete = table => {
      const filtres = [];
      const q = {
        select() { return q; }, limit() { return q; },
        eq(c, v) { filtres.push(r => r[c] === v); return q; },
        then(ok) {
          if (erreurLecture) return ok({ data: null, error: { message: 'réseau' } });
          return ok({ data: t[table].filter(r => filtres.every(f => f(r))), error: null });
        },
        insert(ligne) {
          const conflit = indexUnique && ligne.fichier_hash && t[table].some(r => r.fichier_hash === ligne.fichier_hash);
          const res = conflit ? { data: null, error: { code: '23505', message: 'duplicate key' } }
            : (t[table].push(Object.assign({ id: `${table}-${++seq}` }, ligne)), { data: t[table][t[table].length - 1], error: null });
          const r = { select: () => r, single: () => Promise.resolve(res), then: ok => ok(res) };
          return r;
        },
        delete() { return { eq: (c, v) => { t[table] = t[table].filter(r => r[c] !== v); return Promise.resolve({ error: null }); } }; },
      };
      return q;
    };
    const client = {
      from: requete,
      storage: { from: () => ({ upload: async (chemin) => { objets.push(chemin); return { error: null }; } }) },
    };
    return { t, objets, client };
  }

  const TEXTE_FACTURE = facture('VERDIER Paul DIVERS', 'verdier@exemple.test');
  function boite(b) {
    const fabriquer = new Function('nexusClient', 'nexusIdentifierClient', 'console', 'Date',
      `const BUCKET = 'documents-a-traiter'; const SEUIL_CARACTERES_TEXTE_NATIF = 60;
       const siteId = 'site-x', employeeCourant = { id: 'emp-1' };
       const clientsListe = ${JSON.stringify(CLIENTS)}, contactsListe = ${JSON.stringify(CONTACTS)};
       async function sha256Hex(buf) { return 'h:' + Buffer.from(buf).toString(); }
       async function extraireTextePdf(buf) { const s = Buffer.from(buf).toString(); return s.startsWith('SCAN') ? '' : ${JSON.stringify(TEXTE_FACTURE)} + s; }
       async function periodeDocumentId() { return 'periode-1'; }
       ${nomSurSrc}
       ${br.slice(dD, fD)}
       return { deposerFichier };`);
    let n = 0;
    return fabriquer(b.client, nexusIdentifierClient, { error() {} }, { now: () => ++n }).deposerFichier;
  }
  // contenu = ce qui fait l'empreinte ; le nom ne compte pas.
  const fichier = (nom, contenu) => ({ name: nom, type: 'application/pdf', arrayBuffer: async () => Buffer.from(contenu) });

  await cas('même PDF, même nom, déposé deux fois → 1 facture, 1 envoi, le second « déjà reçu »', async () => {
    const b = base(), dep = boite(b);
    assert.strictEqual((await dep(fichier('a.pdf', 'A'))).ok, true);
    const r = await dep(fichier('a.pdf', 'A'));
    assert.strictEqual(r.deja, true); assert.match(r.raison, /DEJA_INGERE/);
    assert.strictEqual(b.t.invoices.length, 1); assert.strictEqual(b.objets.length, 1);
  });

  await cas('même PDF renommé ou venant d\'un autre dossier → 1 facture', async () => {
    const b = base(), dep = boite(b);
    await dep(fichier('a.pdf', 'A'));
    await dep(fichier('Copie de a (2).pdf', 'A'));
    await dep(fichier('autre/dossier/a.pdf', 'A'));
    assert.strictEqual(b.t.invoices.length, 1); assert.strictEqual(b.objets.length, 1);
  });

  await cas('deux PDF différents → 2 factures, chacune identifiée (DIVERS, pas le principal)', async () => {
    const b = base(), dep = boite(b);
    await dep(fichier('a.pdf', 'A')); await dep(fichier('b.pdf', 'B'));
    assert.strictEqual(b.t.invoices.length, 2);
    assert.ok(b.t.invoices.every(i => i.client_id === 'c-vp-d' && i.methode_identification === 'raison_sociale' && i.statut === 'identifiee'));
  });

  await cas('dépôts simultanés du même PDF : l\'index unique en laisse passer un seul', async () => {
    const b = base(), dep = boite(b);
    const rs = await Promise.all([dep(fichier('a.pdf', 'A')), dep(fichier('a.pdf', 'A')), dep(fichier('a (1).pdf', 'A'))]);
    assert.strictEqual(b.t.invoices.length, 1);
    assert.strictEqual(rs.filter(r => r.ok).length, 1);
    assert.ok(rs.filter(r => !r.ok).every(r => r.deja && r.orphelin), 'la copie envoyée en trop n\'est pas signalée');
  });

  await cas('témoin : sans index unique, ces dépôts simultanés créent des doublons (d\'où la migration)', async () => {
    const b = base({ indexUnique: false }), dep = boite(b);
    await Promise.all([dep(fichier('a.pdf', 'A')), dep(fichier('a.pdf', 'A'))]);
    assert.strictEqual(b.t.invoices.length, 2);
  });

  await cas('bon déjà reçu → ni envoi, ni file OCR, ni bon', async () => {
    const b = base(), dep = boite(b);
    assert.strictEqual((await dep(fichier('bon.jpg', 'SCAN-1'))).type, 'bon');
    assert.strictEqual((await dep(fichier('bon renommé.jpg', 'SCAN-1'))).deja, true);
    assert.strictEqual(b.t.supporting_documents.length, 1);
    assert.strictEqual(b.t.documents_ocr_file.length, 1);
    assert.strictEqual(b.objets.length, 1);
  });

  await cas('bon en course (23505) → l\'entrée de file OCR créée pour lui est retirée', async () => {
    const b = base(), dep = boite(b);
    await Promise.all([dep(fichier('bon.jpg', 'SCAN-1')), dep(fichier('bon.jpg', 'SCAN-1'))]);
    assert.strictEqual(b.t.supporting_documents.length, 1);
    assert.strictEqual(b.t.documents_ocr_file.length, 1, 'une entrée OCR orpheline reste dans la file');
    assert.strictEqual(b.t.supporting_documents[0].documents_ocr_file_id, b.t.documents_ocr_file[0].id);
  });

  await cas('vérification impossible → refus, rien d\'envoyé ni d\'enregistré', async () => {
    const b = base({ erreurLecture: true }), dep = boite(b);
    const r = await dep(fichier('a.pdf', 'A'));
    assert.strictEqual(r.ok, false); assert.ok(!r.deja);
    assert.strictEqual(b.objets.length, 0); assert.strictEqual(b.t.invoices.length, 0);
  });

  await cas('le module est chargé par la page, et l\'ancienne détection a disparu', async () => {
    assert.match(br, /<script src="nexus-identification-client\.js\?v=[^"]+"><\/script>/);
    assert.ok(!/REGEX_SIRET|detecterClient\(/.test(br), 'l\'ancienne règle (premier SIRET, premier e-mail) est encore là');
    assert.match(br, /select\('id, code_client, raison_sociale/);
  });

  console.log(echecs ? `\n${echecs} échec(s)` : '\nToutes les épreuves passent.');
  process.exit(echecs ? 1 : 0);
})();
