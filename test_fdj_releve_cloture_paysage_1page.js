// Test — Relevé de clôture FDJ : une seule page A4 paysage, DÉTAIL INTÉGRAL
// (lot FDJ-RELEVE-CLOTURE-A4-RECTO-20261011).
//
// Historique : le 21/08/2026 le relevé est passé en A4 paysage, une page.
// Pour tenir sur une page, il plafonnait le tableau de stock à 10 jeux et
// renvoyait le reste vers « + 19 autres — voir le détail dans l'app »
// (PDF du 10/10/2026, Q1 de Loane : 29 jeux, 10 imprimés). Le lot du
// 11/10 exige l'inverse : chaque jeu imprimé, aucune troncature, aucun
// renvoi ; si le contenu ne tient pas, le relevé n'est PAS généré et le
// conflit est remonté (jamais un masquage silencieux).
//
// Extrait les vraies fonctions de NEXUS-FDJ-Manager-v1.html, le vrai
// nexus-pdf-moteur.js et le vrai nexus-fdj-moteur.js ; pdf-lib est simulé
// au plus bas niveau et capture chaque texte dessiné, ce qui permet de
// vérifier le CONTENU imprimé et pas seulement le nombre de pages.

const fs = require('fs');
const assert = require('assert');

const CHEMIN_BASE = __dirname;
const html = fs.readFileSync(`${CHEMIN_BASE}/NEXUS-FDJ-Manager-v1.html`, 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function extraire(nomFonction) {
  const debut = (() => {
    const iAsync = script.indexOf(`async function ${nomFonction}(`);
    if (iAsync !== -1) return iAsync;
    return script.indexOf(`function ${nomFonction}(`);
  })();
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
  let i = script.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (script[j] === '{') profondeur++;
    else if (script[j] === '}') profondeur--;
    j++;
  }
  return script.slice(debut, j);
}
function extraireConst(nomConst) {
  const debut = script.indexOf(`const ${nomConst} = `);
  assert.ok(debut !== -1, `Constante ${nomConst} introuvable`);
  const fin = script.indexOf(';\n', debut);
  return script.slice(debut, fin + 1);
}

// ------------------------------------------------------------
// pdf-lib simulé : capture les pages créées et chaque texte dessiné.
// ------------------------------------------------------------
global.PDFLib = {
  PDFDocument: { create: async () => fakeDoc() },
  StandardFonts: { Helvetica: 'Helvetica', HelveticaBold: 'Helvetica-Bold' },
  rgb: (r, g, b) => ({ r, g, b }),
};
const srcPdfMoteur = fs.readFileSync(`${CHEMIN_BASE}/nexus-pdf-moteur.js`, 'utf8');
const NexusPdfMoteur = new Function('window', 'PDFLib', 'navigator', 'document', 'URL', srcPdfMoteur + '\nreturn window.NexusPdfMoteur;')({}, global.PDFLib, {}, {}, {});
require(`${CHEMIN_BASE}/nexus-fdj-moteur.js`);
const NexusFdjMoteur = globalThis.NexusFdjMoteur;
assert.ok(NexusFdjMoteur && typeof NexusFdjMoteur.labelResultatControle === 'function', 'nexus-fdj-moteur.js doit exposer NexusFdjMoteur');

let pagesCreees = [];
let textes = [];
const fakeFont = { widthOfTextAtSize: (t, s) => String(t).length * s * 0.5 };
function fakeDoc() {
  const pages = [];
  return {
    addPage: (dims) => {
      pagesCreees.push(dims);
      const p = { drawText: (t) => textes.push(String(t)), drawRectangle: () => {}, drawLine: () => {}, drawImage: () => {} };
      pages.push(p);
      return p;
    },
    getPages: () => pages,
    embedFont: async () => fakeFont,
    setTitle: () => {}, setAuthor: () => {}, setSubject: () => {}, setCreator: () => {}, setProducer: () => {},
    save: async () => new Uint8Array([1, 2, 3]),
  };
}

const SRC = [
  extraireConst('LABELS_DIFF_RELEVE'),
  extraire('formatValeurDiffReleve'),
  extraireConst('LIBELLES_TYPE_VERSION_RELEVE'),
  extraire('libelleTypeVersionReleve'),
  extraire('libelleCaractereReleve'),
  extraireConst('STATUTS_CAISSE'),
  extraire('labelStatutCaisse'),
  extraire('labelStatutRelevecloture'),
  extraire('libelleAnomalieChaine'),
  extraire('nomJeu'),
  extraire('nomEmploye'),
  extraire('jeuxDuSnapshot'),
  extraire('idsJeuxReleve'),
  extraire('construireReleveClotureQuartPdf'),
  extraire('fmtEuro'),
  extraire('fmtNum'),
].join('\n');

function generateur(jeux, employesSite) {
  return new Function('jeux', 'employesSite', 'NexusPdfMoteur', 'NexusFdjMoteur', 'siteId', `${SRC}\nreturn construireReleveClotureQuartPdf;`)(jeux, employesSite, NexusPdfMoteur, NexusFdjMoteur, 'site-test');
}

// ------------------------------------------------------------
// Données : 29 jeux (comme le Q1 du 10/10), prix réels de 1 à 15 €.
// ------------------------------------------------------------
const NOMS = ['BANCO 1€', 'GOAL 1€', 'CHAMBRE FORTE', 'FETICHE 2€', 'ASTRO 2€', 'BLACK JACK 2€', 'SOLITAIRE 2€', 'X10 2€', 'COLOR MIX 2€',
  'PERLE RARE 2€', 'TAROT DIVINATION 2€', 'MYTHIC JUNGLE 3€', 'MAXI GOAL 3€', 'MT CROISES 3€', 'VEGAS 3€', 'CASH POCKET 3€', 'JACKPOT 5€',
  'CASH 5€', 'TICKET OR 5€', 'MAXI MOTS CROISES 5€', 'X20 5€', 'SUPER 10 OU 200 5€', 'MAXI BLACKJACK 5€', 'EMERAUDE VS RUBIS 5€',
  'CHIFFRE D\'OR 5€', 'MILLIONNAIRE 10€', 'MEGA MOTS CROISES 10€', 'MEGA GOAL 10€', 'MISSION PATRIMOINE 15€'];
const PRIX = [1, 1, 3, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 10, 10, 10, 15];
const employesSite = [{ id: 'e1', nom: 'Loane' }, { id: 'e2', nom: 'Fred' }];
const shift = { id: '84e16ef6-4fc3-473d-baff-02c5b9e69ca3', date: '2026-10-10', quart: '1', employee_id: 'e1' };

// Construit jeux + versions. `sansVente` : nombre de jeux en fin de liste
// sans aucun mouvement (ils doivent rester imprimés). `nbRegul` : nombre
// de régularisations manager après la V1. `ecart` : réelle − attendue.
function scenario(opts) {
  const { n = 29, prefixe = '', ecart = 0, nbRegul = 1, sansVente = 0, finalAbsent = false, caractere = 'definitif' } = opts || {};
  const jeux = Array.from({ length: n }, (_, k) => ({ id: `j${k}`, nom: prefixe + (NOMS[k] || `JEU SUPPLÉMENTAIRE ${k}`), prix: PRIX[k] || 5, actif: true, ordre_affichage: 10 * (k + 1) }));
  const cartes = { stock_initial_par_jeu: {}, appro_par_jeu: {}, stock_final_par_jeu: {}, ventes_par_jeu: {} };
  let ventes = 0;
  jeux.forEach((j, k) => {
    const q = k < n - sansVente ? 2 + (k % 20) : 0;
    const i = 30 + k, a = k % 3 === 0 ? 50 : 0, f = i + a - q;
    cartes.stock_initial_par_jeu[j.id] = i; cartes.appro_par_jeu[j.id] = a; cartes.stock_final_par_jeu[j.id] = f;
    cartes.ventes_par_jeu[j.id] = { qte: q, valeur: q * j.prix };
    ventes += q * j.prix;
  });
  if (finalAbsent) {
    const der = jeux[n - 1].id;
    cartes.stock_final_par_jeu[der] = null;
    cartes.ventes_par_jeu[der] = { qte: null, valeur: null };
  }
  const attendue = ventes - 605 + 1442.5;
  const m = { ventes_grattage_valeur: ventes, lots_payes_grattage: 605, caisse_tirages: 1442.5, regularisations: 0, caisse_attendue: attendue, caisse_reelle: attendue + ecart, ecart };
  const base = { ...m, ...cartes, caractere, anomalie_chaine: { chaine_interrompue: false, continuite_stock_a_verifier: false } };
  const versions = [{ ...base, id: 'v1', version_num: 1, type_version: 'validation_employe', cree_le: '2026-10-10T17:34:27Z', statut: ecart === 0 ? 'conforme' : 'valide_avec_ecart', signature: { nom: 'Loane', role: 'caissier' } }];
  for (let k = 1; k <= nbRegul; k++) {
    versions.push({ ...base, id: `v${k + 1}`, version_num: k + 1, type_version: 'regularisation_manager', cree_par: 'e2', statut: 'regularise',
      cree_le: new Date(Date.parse('2026-10-11T10:00:00Z') + k * 3600000).toISOString(),
      motif_regularisation: k % 2 ? `Correction de comptage carnet n°${k} après recomptage contradictoire` : null, signature: { nom: 'Fred', role: 'manager' } });
  }
  const contexte = { nomStation: 'Vito Sainte-Marie Usine', cashLu: true, jeuxSupplementaires: [],
    cash: { resultat_controle: ecart === 0 ? 'conforme' : 'avec_ecart', controle_par: 'e2', controle_le: '2026-10-11T14:40:45Z', version: 3, nb_corrections: 2 } };
  return { jeux, versions, contexte };
}

// `tout` : textes dessinés, joints par une espace (une phrase coupée sur
// deux lignes reste cherchable).
async function produire(sc, sansContexte) {
  pagesCreees = [];
  textes = [];
  const gen = generateur(sc.jeux, employesSite);
  const pdf = sansContexte ? await gen(shift, sc.versions) : await gen(shift, sc.versions, sc.contexte);
  return { pdf, tout: textes.join(' ') };
}

function unePageA4Paysage(cas) {
  assert.strictEqual(pagesCreees.length, 1, `${cas} : exactement 1 page attendue, reçu ${pagesCreees.length}`);
  const [l, h] = pagesCreees[0];
  assert.ok(Math.abs(l - 841.89) < 0.01 && Math.abs(h - 595.28) < 0.01, `${cas} : A4 paysage attendu (841.89 x 595.28), reçu ${l} x ${h}`);
}

async function run() {
  // A. 29 jeux, dont 10 sans vente : tous imprimés, aucun renvoi.
  {
    const sc = scenario({ sansVente: 10 });
    const { pdf, tout } = await produire(sc);
    unePageA4Paysage('A');
    sc.jeux.forEach(j => assert.ok(textes.includes(j.nom), `A : le jeu « ${j.nom} » doit être imprimé en entier sur sa propre ligne`));
    assert.ok(!/autres?\s+—\s+voir|voir le détail dans l'app/i.test(tout), 'A : aucun renvoi « + N autres — voir le détail dans l\'app »');
    assert.ok(tout.includes('DÉTAIL INTÉGRAL (29 jeux)'), 'A : le titre annonce le détail intégral et le nombre de jeux');
    assert.ok(tout.includes('Total ventes grattage'), 'A : total grattage en pied de tableau');
    assert.ok(tout.includes('Caisse conforme'), 'A : écart nul → « Caisse conforme »');
    assert.ok(tout.includes('Version 2/2 · Définitif'), 'A : en-tête « Version 2/2 · Définitif »');
    assert.ok(/Certifiée « Conforme » par Fred/.test(tout), 'A : certification de la caisse avec son auteur');
    assert.ok(tout.includes('Anomalies à traiter par le manager (0)'), 'A : aucune anomalie inventée');
    assert.ok(pdf.bytes.length > 0 && pdf.nomFichier === 'NEXUS-FDJ-Releve-2026-10-10-Q1.pdf', 'A : forme de retour conservée (bytes, nomFichier)');
    console.log('OK — A : 29 jeux (dont 10 sans vente) tous imprimés en entier sur 1 page A4 paysage, aucun renvoi, caisse conforme, Version 2/2.');
  }

  // C. Manquant et excédent : terme exact, écart en valeur absolue.
  for (const [ecart, terme, absolu] of [[-37.5, 'Manquant constaté', '37,50'], [12, 'Excédent constaté', '12,00']]) {
    const { tout } = await produire(scenario({ ecart }));
    unePageA4Paysage(terme);
    assert.ok(tout.includes(terme), `C : écart ${ecart} → « ${terme} »`);
    assert.ok(!tout.includes('Caisse conforme'), `C : écart ${ecart} ne doit pas afficher « Caisse conforme »`);
    assert.ok(tout.includes(absolu), `C : l'écart ${absolu} doit être imprimé`);
    assert.ok(!new RegExp(`[-−]\\s?${absolu}`).test(tout), `C : l'écart est imprimé en valeur absolue (aucun signe moins devant ${absolu})`);
    console.log(`OK — C : écart ${ecart} → « ${terme} », montant ${absolu} en valeur absolue.`);
  }

  // D. Plusieurs régularisations : chaque version listée.
  {
    const { tout } = await produire(scenario({ nbRegul: 5 }));
    unePageA4Paysage('D');
    for (let v = 1; v <= 6; v++) assert.ok(tout.includes(`V${v} — `), `D : la version V${v} doit figurer à l'historique`);
    assert.ok(tout.includes('HISTORIQUE DES VERSIONS (6)'), 'D : l\'historique annonce 6 versions');
    assert.ok(!tout.includes('historique condensé'), 'D : 6 versions tiennent, l\'historique n\'est pas condensé');
    console.log('OK — D : 6 versions toutes listées à l\'historique.');
  }

  // D'. Historique trop long : condensé, mais le nombre réel est dit.
  {
    const { tout } = await produire(scenario({ nbRegul: 20 }));
    unePageA4Paysage('D\'');
    assert.ok(tout.includes('21 versions au total'), 'D\' : le nombre réel de versions est imprimé');
    assert.ok(tout.includes('Initiale : V1 — ') && tout.includes('Dernière : V21 — '), 'D\' : version initiale et dernière imprimées');
    assert.ok(tout.includes('historique intégral dans NEXUS'), 'D\' : renvoi explicite vers l\'historique intégral');
    assert.ok(tout.includes('Version 21/21'), 'D\' : l\'en-tête ne fait pas croire à moins de versions');
    console.log('OK — D\' : 21 versions → historique condensé, nombre réel annoncé, initiale et dernière imprimées.');
  }

  // E. Noms longs : toujours une page, noms entiers.
  {
    const sc = scenario({ prefixe: 'ÉDITION SPÉCIALE NOËL ' });
    const { tout } = await produire(sc);
    unePageA4Paysage('E');
    sc.jeux.forEach(j => assert.ok(tout.includes(j.nom), `E : nom long « ${j.nom} » imprimé en entier`));
    console.log('OK — E : 29 noms longs imprimés en entier, 1 page.');
  }

  // Donnée absente : signalée, jamais inventée.
  {
    const { tout } = await produire(scenario({ finalAbsent: true }));
    unePageA4Paysage('Absente');
    assert.ok(tout.includes('non saisi'), 'Absente : la cellule manquante est marquée « non saisi »');
    assert.ok(/Anomalies à traiter par le manager \([1-9]\d*\)/.test(tout), 'Absente : l\'anomalie est remontée au manager');
    console.log('OK — donnée absente marquée « non saisi » et remontée en anomalie, jamais inventée.');
  }

  // Provisoire : bandeau et en-tête, toujours une page.
  {
    const { tout } = await produire(scenario({ caractere: 'provisoire' }));
    unePageA4Paysage('Provisoire');
    assert.ok(tout.includes('RELEVÉ PROVISOIRE') && tout.includes('· Provisoire ·'), 'Provisoire : bandeau et en-tête');
    console.log('OK — provisoire : 1 page, bandeau et en-tête « Provisoire ».');
  }

  // Sans contexte (lecture du contrôle de caisse impossible) : jamais d'erreur.
  {
    const { tout } = await produire(scenario(), true);
    unePageA4Paysage('Sans contexte');
    assert.ok(tout.includes('certification indisponible') || tout.includes('indisponible (lecture du contrôle de caisse impossible)'), 'Sans contexte : la certification est déclarée indisponible');
    assert.ok(tout.includes('nom de station indisponible'), 'Sans contexte : la station est déclarée indisponible');
    console.log('OK — sans contexte : 1 page, certification et station « indisponibles » au lieu de valeurs inventées.');
  }

  // F. Dépassement : conflit levé, rien de tronqué, aucun PDF produit.
  {
    let erreur = null;
    try { await produire(scenario({ n: 149 })); } catch (e) { erreur = e; }
    assert.ok(erreur, 'F : 149 jeux ne tiennent pas sur une page — le relevé ne doit PAS être généré');
    assert.ok(/ne tient pas sur une page A4 sans masquer de donnée/.test(erreur.message) && /rien n'a été tronqué/.test(erreur.message),
      `F : message de conflit explicite attendu, reçu « ${erreur.message} »`);
    console.log('OK — F : 149 jeux → conflit explicite, aucun relevé tronqué.');
  }

  // F'. Trop d'anomalies pour la colonne de droite : même conflit, jamais une
  // liste d'anomalies coupée (frontière mesurée le 11/10 : ~19 à 21 anomalies
  // d'une ligne selon la longueur de l'historique).
  {
    const sc = scenario();
    sc.versions.forEach(v => { v.stock_final_par_jeu = Object.fromEntries(sc.jeux.map(j => [j.id, null])); });
    let erreur = null;
    try { await produire(sc); } catch (e) { erreur = e; }
    assert.ok(erreur && /rien n'a été tronqué/.test(erreur.message), 'F\' : 29 anomalies ne tiennent pas — conflit explicite attendu, jamais une liste coupée');
    console.log('OK — F\' : 29 anomalies → conflit explicite, aucune anomalie masquée.');
  }

  console.log('\nTous les tests « Relevé de clôture FDJ — A4 paysage, 1 page, détail intégral » passent.');
}

run().catch(e => { console.error('ECHEC:', e); process.exit(1); });
