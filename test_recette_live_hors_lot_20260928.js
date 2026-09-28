// L'ÉTAPE LIVE RETIRÉE DE LA RECETTE DU CANDIDAT #65 — et ce que ce retrait
// n'a PAS le droit de faire.
//
// Le défaut réparé : `NEXUS-Live-Developpement-v1.html` n'est pas dans l'arbre
// de `rebuild/carburants-65-20260922`. La recette y ouvrait quand même l'écran,
// l'hébergeur répondait 200 en servant la page commerciale, et l'attente
// expirait à 30 000 ms sur un rouge qui n'accusait rien.
//
// Le risque du remède est l'inverse du défaut : un saut muet se lirait comme un
// vert, et le candidat se prévaudrait d'un contrôle d'accès jamais éprouvé. Ces
// épreuves tiennent les deux bouts.
//
//   TÉMOIN        — la déclaration posée : l'abstention est reconnue, et son
//                   motif NOMME les deux preuves perdues (Créateur ET manager).
//   CONTRE-TÉMOIN — la déclaration absente, vide, '0', 'non' : rien ne change,
//                   le rail continue d'éprouver Live.
//   CONTRE-TÉMOIN — la déclaration posée ne doit PAS adoucir le jugement :
//                   `verifierLive` rend les mêmes échecs, drapeau ou pas. Si
//                   quelqu'un « implémente » un jour le retrait en neutralisant
//                   la vérification, cette épreuve rougit.
//   CONTRE-TÉMOIN — un seul workflow au monde a le droit de poser la déclaration.
//                   Le jour où le rail la poserait, il perdrait sa preuve Live
//                   sans que personne ne le voie.

const fs = require('fs');
const path = require('path');
const recette = require('./outils/recette-navigateur-test.js');

const echecs = [];
function verifier(nom, condition, detail) {
  if (!condition) echecs.push(`${nom} — ${detail}`);
}

// ---- TÉMOIN : la déclaration est lue, et elle nomme ce qu'elle coûte --------
verifier('témoin/déclaration reconnue',
  recette.liveHorsLot({ NEXUS_RECETTE_SANS_LIVE: '1' }) === true,
  "NEXUS_RECETTE_SANS_LIVE='1' doit déclarer Live hors du lot");

const motif = recette.MOTIF_LIVE_HORS_LOT;
verifier('témoin/le motif nomme le Créateur',
  /Créateur/.test(motif), 'le motif tait la preuve d’accès ACCORDÉ au Créateur');
verifier('témoin/le motif nomme le manager',
  /manager/.test(motif), 'le motif tait la preuve d’accès REFUSÉ au manager');
verifier('témoin/le motif dit NON ÉPREUVÉ',
  /NON ÉPREUVÉ/.test(motif) && /MANQUANTES/.test(motif),
  'le motif doit déclarer les preuves manquantes, jamais satisfaites');
verifier('témoin/le motif ne blanchit pas l’écran',
  /n'est pas un verdict|ne doit jamais en tenir lieu/.test(motif),
  'une absence d’artefact ne doit pas se lire comme un jugement sur le contrôle d’accès');

// ---- CONTRE-TÉMOIN : rien n'est déclaré, rien ne change ---------------------
for (const valeur of [undefined, '', '0', 'non', 'false', ' ']) {
  verifier('contre-témoin/pas de déclaration',
    recette.liveHorsLot({ NEXUS_RECETTE_SANS_LIVE: valeur }) === false,
    `NEXUS_RECETTE_SANS_LIVE=${JSON.stringify(valeur)} ne doit PAS retirer l’étape Live`);
}
verifier('contre-témoin/environnement vide',
  recette.liveHorsLot({}) === false && recette.liveHorsLot(undefined) === false,
  'sans déclaration, la recette éprouve Live — c’est le cas du rail');

// ---- CONTRE-TÉMOIN : la déclaration n'adoucit aucun jugement ----------------
// Un Créateur REFUSÉ et un manager ADMIS : deux échecs francs. La déclaration
// est un saut d'OBSERVATION, pas une remise de peine. Si elle touchait au
// jugement, elle pourrait un jour verdir un vrai défaut Live sur le rail.
const createurRefuse = { refuse: true, contientTimeline: false, texte: 'Accès refusé', attente: 'rien', boutonAutoriser: false };
const managerAdmis = { refuse: false, contientTimeline: true, texte: 'Timeline visible', attente: 'rien', boutonAutoriser: false };

process.env.NEXUS_RECETTE_SANS_LIVE = '1';
const avecDrapeau = recette.verifierLive(createurRefuse, managerAdmis);
delete process.env.NEXUS_RECETTE_SANS_LIVE;
const sansDrapeau = recette.verifierLive(createurRefuse, managerAdmis);

verifier('contre-témoin/jugement inchangé',
  avecDrapeau.length === sansDrapeau.length && avecDrapeau.length >= 2,
  `verifierLive doit rendre les mêmes échecs avec ou sans déclaration : `
  + `${avecDrapeau.length} vs ${sansDrapeau.length}`);
verifier('contre-témoin/les deux défauts restent dits',
  avecDrapeau.some(e => /Créateur/.test(e)) && avecDrapeau.some(e => /manager/.test(e)),
  'la déclaration ne doit effacer ni le défaut Créateur ni le défaut manager');

// ---- CONTRE-TÉMOIN : un seul workflow a le droit de déclarer ----------------
const dossier = path.join(__dirname, '.github', 'workflows');
const porteurs = fs.readdirSync(dossier)
  .filter(f => /\.ya?ml$/.test(f))
  .filter(f => /NEXUS_RECETTE_SANS_LIVE\s*:/.test(fs.readFileSync(path.join(dossier, f), 'utf8')));

verifier('contre-témoin/déclaration confinée au candidat',
  porteurs.length === 1 && porteurs[0] === 'recette-candidat-65.yml',
  `seul recette-candidat-65.yml peut retirer Live. Porteurs vus : ${porteurs.join(', ') || 'aucun'}`);

// ---------------------------------------------------------------------------
if (echecs.length) {
  console.error('ÉCHEC — retrait de l’étape Live du candidat #65 :');
  for (const e of echecs) console.error('  · ' + e);
  process.exit(1);
}
console.log('OK — l’étape Live est retirée du candidat #65 par déclaration, et le retrait :');
console.log('  · nomme les DEUX preuves perdues au lieu de les taire,');
console.log('  · reste sans effet partout où rien n’est déclaré (le rail),');
console.log('  · n’adoucit aucun jugement de verifierLive,');
console.log('  · ne peut être posé que par le workflow du candidat.');
