// A3 / B1-c — le nom porté par le DOCUMENT généré, pas seulement par le code.
//
// pdf-lib vient d'un CDN et la suite ne fait aucun appel réseau : on ne peut
// pas produire d'octets PDF ici. On substitue donc un moteur PDF qui ENREGISTRE
// ce qu'on lui demande d'imprimer, et on fait tourner le VRAI
// construireDossierPdf. Ce qui est vérifié est le contenu du document — la
// valeur réellement portée sur la page de garde — pas une chaîne du source.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

// Moteur PDF d'essai : il note tout ce qui est imprimé. Toute méthode non
// prévue est acceptée et journalisée — on veut capturer le CONTENU du
// document, pas reproduire l'API du moteur réel.
function moteurTemoin(journal) {
  const noter = (...a) => { journal.textes.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); };
  const socle = {
    pageDeGarde(o) { journal.pageDeGarde = o; noter(...Object.values(o).filter(v => typeof v === 'string')); },
    async enregistrer() { return { bytes: new Uint8Array([37, 80, 68, 70]), nomFichier: 'essai.pdf', titre: 'essai' }; },
  };
  // `then` doit rester ABSENT : un proxy qui renvoie une fonction pour `then`
  // fait passer l'objet pour un thenable, `await` l'appelle avec (resolve,
  // reject) et la promesse ne se résout jamais. Le processus sort alors en
  // silence avec le code 0 — symptôme spectaculairement trompeur.
  const passePlat = { get: (c, p) => (p in c ? c[p] : (typeof p === 'symbol' || p === 'then' ? undefined : noter)) };
  const rapport = new Proxy(socle, passePlat);
  return new Proxy({
    async creerRapport() { return rapport; },
    async finaliser() { return new Uint8Array([37, 80, 68, 70]); },
  }, passePlat);
}

async function genererAvec(nomEntreprise, site) {
  const journal = { textes: [] };
  // Chargé dans le MÊME realm que le test (new Function), et non dans un
  // contexte vm : un contexte vm a ses propres intrinsèques, et les fonctions
  // async du module n'y résolvaient jamais leur promesse — le processus
  // sortait en silence avec le code 0. Symptôme trompeur, cause banale.
  const faux = {};
  faux.window = faux;
  faux.NexusPdfMoteur = moteurTemoin(journal);
  new Function('window', 'global', 'document',
    fs.readFileSync(path.join(RACINE, 'nexus-paye-dossier-pdf.js'), 'utf8'))(faux, faux, {});
  // Dossier minimal mais complet : ce test porte sur l'IDENTITÉ imprimée,
  // pas sur les variables de paie — d'où zéro salarié et des compteurs à zéro.
  const dossier = {
    periode: '2026-08-01', genereLe: '2026-09-01T10:00:00Z', statutGlobal: 'pret',
    salaries: [], ecartsNonAttribues: 0,
    synthese: { salaries: 0, prets: 0, aVerifier: 0, donneeManquante: 0, joursTravailles: 0,
      heuresConfirmees: 0, joursCongesPayes: 0, joursMaladieMaternite: 0,
      joursAbsenceNonDeclaree: 0, joursFeriesTravailles: 0, heuresSupplementaires: 0,
      retards: 0, minutesRetard: 0, primes: 0, retenues: 0 },
  };
  const options = { site };
  if (nomEntreprise !== undefined) options.nomEntreprise = nomEntreprise;
  await faux.NexusPayeDossierPdf.construireDossierPdf(dossier, options);
  return journal;
}

// Toutes les graphies, insensibles à la casse : le diagnostic B1 cherchait
// « Vito » et « VITO », et le défaut s'écrivait « ViTO ». Le prochain
// s'écrira « vItO » — le garde-fou normalise donc au lieu d'énumérer.
const NOM_INTERDIT = /v\s*i\s*t\s*o[\s-]*sainte[\s-]*marie/i;

(async () => {
  const testNexus = await genererAvec('NEXUS STATION TEST', 'nexus-station-test');
  verifier('le nom du commerce de recette figure sur le document', () => {
    assert.strictEqual(testNexus.pageDeGarde.nomEntreprise, 'NEXUS STATION TEST');
  });

  const sansNom = await genererAvec(undefined, 'nexus-station-test');
  verifier('sans nom, le document porte l’identifiant du site, jamais un nom propre', () => {
    assert.strictEqual(sansNom.pageDeGarde.nomEntreprise, 'nexus-station-test');
  });

  const sansRien = await genererAvec(undefined, undefined);
  verifier('sans nom ni site, le document porte un libellé neutre', () => {
    assert.strictEqual(sansRien.pageDeGarde.nomEntreprise, 'Commerce non identifié');
  });

  verifier('aucun document généré ne porte le nom de Sainte-Marie', () => {
    for (const [cas, j] of [['nom configuré', testNexus], ['sans nom', sansNom], ['sans rien', sansRien]]) {
      const tout = j.textes.join(' | ');
      assert.ok(!NOM_INTERDIT.test(tout), `cas « ${cas} » : le document porte un nom de commerce étranger`);
      assert.ok(!/Vito Sainte-Marie Usine/i.test(tout), `cas « ${cas} »`);
    }
  });

  verifier('le garde-fou reconnaît toutes les graphies, pas seulement celles déjà vues', () => {
    for (const graphie of ['ViTO Sainte-Marie', 'Vito Sainte-Marie', 'VITO SAINTE-MARIE', 'vItO sainte marie', 'vito-sainte-marie']) {
      assert.ok(NOM_INTERDIT.test(graphie), 'graphie non reconnue : ' + graphie);
    }
  });

  verifier('la génération n’écrit rien et n’appelle aucun réseau', () => {
    // Le contexte d'exécution ne contient ni nexusClient ni fetch : si le
    // module tentait une lecture ou une écriture, il lèverait.
    const src = fs.readFileSync(path.join(RACINE, 'nexus-paye-dossier-pdf.js'), 'utf8');
    assert.ok(!/nexusClient|fetch\(|\.insert\(|\.upsert\(|\.update\(/.test(src),
      'le générateur de document ne doit ni lire ni écrire en base');
  });

  verifier('l’écran Paye résout le nom du commerce au lieu de l’écrire en dur', () => {
    const src = fs.readFileSync(path.join(RACINE, 'NEXUS-Paye-v1.html'), 'utf8');
    assert.ok(/nomEntreprise:await nomDuCommerce\(\)/.test(src), 'le nom doit être résolu à la génération');
    assert.ok(/async function nomDuCommerce\(\)/.test(src));
    assert.ok(/console\.error\('Lecture identité du commerce :'/.test(src), 'panne technique -> error');
    assert.ok(/console\.warn\('Identité du commerce non configurée/.test(src), 'nom absent -> warn');
    const nu = src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert.ok(!NOM_INTERDIT.test(nu), 'plus aucun nom de commerce en dur dans l’écran Paye');
  });

  console.log(`\n${passes} vérifications passées — aucun document ne sort au nom d'un autre commerce.`);
})().catch(e => { console.error(e); process.exit(1); });
