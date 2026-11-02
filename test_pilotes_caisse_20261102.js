// Test — pilotes de l'inventaire caisse (lot INVENTAIRE-CAISSE-RENFORT, décision-3).
// Refus par défaut ; isolation par site ; pilotesRenfort sans lecteur avant L3.
// SRC_MUTE : module muté (preuve de mutation). GARDE_EXTRA : fichier supplémentaire balayé par la garde statique.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const P = require(process.env.SRC_MUTE || './nexus-pilotes-inventaire.js');
let ok = 0;
function cas(nom, f) { f(); ok++; console.log('  ✓ ' + nom); }

const PILOTE = 'emp-pilote', AUTRE = 'emp-autre', SITE_B_EMP = 'emp-b';
const siteA = { pilotesCaisse: [PILOTE] };

cas('pilote : id présent dans une liste bien formée', () => assert.strictEqual(P.estPiloteCaisse(siteA, PILOTE), true));
cas('non-pilote : id absent de la liste', () => assert.strictEqual(P.estPiloteCaisse(siteA, AUTRE), false));
cas('clé absente, paramètres vides ou non objet → refus', () => {
  for (const p of [{}, undefined, null, 'x', 42, [], { reviewFrequency: 'daily' }]) assert.strictEqual(P.estPiloteCaisse(p, PILOTE), false);
});
cas('valeur malformée → refus (chaîne, objet, nombre, booléen)', () => {
  for (const v of [PILOTE, { [PILOTE]: true }, 1, true, null, 'emp-pilote,emp-autre']) assert.strictEqual(P.estPiloteCaisse({ pilotesCaisse: v }, PILOTE), false);
});
cas('liste partiellement corrompue → refus en bloc', () => {
  for (const l of [[PILOTE, 5], [PILOTE, null], [PILOTE, ''], [PILOTE, { id: PILOTE }]]) assert.strictEqual(P.estPiloteCaisse({ pilotesCaisse: l }, PILOTE), false);
});
cas('liste vide → refus', () => assert.strictEqual(P.estPiloteCaisse({ pilotesCaisse: [] }, PILOTE), false));
cas('id absent, vide ou non chaîne → refus', () => {
  for (const id of [undefined, null, '', '  ', 7, {}]) assert.strictEqual(P.estPiloteCaisse(siteA, id), false);
});
cas('pilotesRenfort ne confère jamais le pilote caisse', () => assert.strictEqual(P.estPiloteCaisse({ pilotesRenfort: [PILOTE] }, PILOTE), false));
cas('isolation entre sites : seuls les paramètres du site de l\'employé comptent', () => {
  const parametresParSite = { A: { pilotesCaisse: [PILOTE] }, B: {} };
  assert.strictEqual(P.estPiloteCaisse(parametresParSite.B, PILOTE), false);
  assert.strictEqual(P.estPiloteCaisse(parametresParSite.B, SITE_B_EMP), false);
  assert.strictEqual(P.estPiloteCaisse(parametresParSite.A, SITE_B_EMP), false);
});
cas('bascule en écriture : ajout, retrait, sans doublon, listes corrompues nettoyées', () => {
  assert.deepStrictEqual(P.baserPilote(undefined, PILOTE, true), [PILOTE]);
  assert.deepStrictEqual(P.baserPilote([PILOTE], PILOTE, true), [PILOTE]);
  assert.deepStrictEqual(P.baserPilote([PILOTE, AUTRE], PILOTE, false), [AUTRE]);
  assert.deepStrictEqual(P.baserPilote('corrompu', AUTRE, true), [AUTRE]);
  assert.deepStrictEqual(P.baserPilote([PILOTE, 5, null, PILOTE], AUTRE, true), [PILOTE, AUTRE]);
  assert.deepStrictEqual(P.baserPilote([PILOTE], '', true), [PILOTE]);
});
cas('normaliserListe : non-tableau → [], sans doublon ni vide', () => {
  assert.deepStrictEqual(P.normaliserListe('x'), []);
  assert.deepStrictEqual(P.normaliserListe([' a ', 'a', '', 3]), ['a']);
});

// ── Garde statique : pilotesRenfort n'a aucun lecteur avant L3 ──
const RACINE = __dirname;
const AUTORISES = new Set(['nexus-pilotes-inventaire.js', 'NEXUS-Parametres-Inventaire-v1.html']);
cas('pilotesRenfort : référencé seulement par ses fichiers autorisés (défaut + module), aucun lecteur', () => {
  const fichiers = fs.readdirSync(RACINE).filter((f) => /\.(js|html)$/.test(f) && !f.startsWith('test_'));
  const extra = process.env.GARDE_EXTRA ? [process.env.GARDE_EXTRA] : [];
  const fautifs = [];
  for (const f of [...fichiers.map((x) => path.join(RACINE, x)), ...extra]) {
    if (AUTORISES.has(path.basename(f)) && !extra.includes(f)) continue;
    if (/pilotesRenfort/.test(fs.readFileSync(f, 'utf8'))) fautifs.push(path.basename(f));
  }
  assert.deepStrictEqual(fautifs, [], 'lecteur(s) de pilotesRenfort : ' + fautifs.join(', '));
  // Dans les fichiers autorisés : le module n'expose aucune lecture de pilotesRenfort (hors commentaires),
  // et la page Paramètres ne le référence que dans les défauts.
  const code = fs.readFileSync(path.join(RACINE, 'nexus-pilotes-inventaire.js'), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(!/pilotesRenfort/.test(code), 'le module ne doit pas lire pilotesRenfort');
  const page = fs.readFileSync(path.join(RACINE, 'NEXUS-Parametres-Inventaire-v1.html'), 'utf8');
  const lignes = page.split('\n').filter((l) => /pilotesRenfort/.test(l) && !/^\s*\/\//.test(l));
  assert.strictEqual(lignes.length, 1, 'une seule ligne de code (les défauts) : ' + lignes.join(' | '));
  assert.ok(/pilotesCaisse:\s*\[\],\s*pilotesRenfort:\s*\[\]/.test(lignes[0]), 'défauts vides attendus');
});

// ── Câblage : lecture scoped au site de l'employé, aucune migration ──
cas('lecteur de la page Inventaire : paramètres du site de l\'employé courant, refus par défaut', () => {
  const html = fs.readFileSync(path.join(RACINE, 'NEXUS-Inventaire-v1.html'), 'utf8');
  const i = html.indexOf('async function chargerReglagesPlanComptage');
  const corps = html.slice(i, html.indexOf('\n  }\n', i));
  assert.ok(/const site = employeeCourant\.site_id;/.test(corps) && /\.eq\('site', site\)/.test(corps));
  assert.ok(/poserPiloteCaisse\(p\);/.test(corps));
  assert.ok(/function poserPiloteCaisse\(p\) \{ piloteCaisseCourant = NexusPilotesInventaire\.estPiloteCaisse\(p, employeeCourant\.id\); \}/.test(html));
  assert.ok(html.includes('nexus-pilotes-inventaire.js'));
});
console.log(`\n${ok} contrôles OK`);
