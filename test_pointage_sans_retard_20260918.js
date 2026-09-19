#!/usr/bin/env node
// Un retard ne s'affirme pas sans horaire planifié — 18/09/2026.
//
// LE DÉFAUT, constaté à l'écran pendant la recette sur nexus-station-test :
// une arrivée pointée à 10 h 33 s'affichait « Horaire prévu : 17:25 · Retard
// constaté : 1028 min ». Le chiffre n'était pas seulement affiché, il était
// ÉCRIT en base dans `pointages.retard_min`, d'où sept écrans le relisaient.
//
// LA CAUSE : le retard se mesurait contre `shifts.heure_debut`. Or un service
// ouvert d'un clic porte `heure_debut = created_at` — vérifié sur les services
// 9e3fd5dd et 8d267d8e de nexus-station-test, dont les deux colonnes sont
// égales, contre 7d3b0a51-…-0010 qui porte une valeur semée à 10:00:00.
// AUCUNE colonne ne distingue un horaire PLANIFIÉ d'une heure d'ouverture.
// L'ouverture d'un service n'est pas un horaire prévu.
//
// CE QUE CETTE ÉPREUVE JUGE : le rendu réel de renderTimeline, extrait de la
// page et exécuté sur des pointages construits pour piéger l'ancien code —
// y compris une ligne ANCIENNE portant encore retard_min = 1028 en base, que
// l'historique n'a pas réécrite. Si un retard réapparaît, il apparaîtra ici.

'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passes = 0;
let total = 0;
function t(nom, fn) {
  total++;
  try { fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { console.error(`  ✗ ${nom}\n    ${e.message}`); process.exitCode = 1; }
}

const RACINE = __dirname;
const POINTAGE = fs.readFileSync(path.join(RACINE, 'NEXUS-Pointage-v1.html'), 'utf8');

// Les commentaires de cette page RACONTENT le défaut corrigé : ils citent
// « Retard constaté » et « Horaire prévu » pour expliquer ce qui a disparu.
// Une épreuve qui grep le fichier entier échouerait sur sa propre
// documentation. On ne juge donc que le code.
const sansCommentaires = src => src
  .split('\n')
  .filter(l => !l.trim().startsWith('//'))
  .join('\n');
const CODE = sansCommentaires(POINTAGE);

// ── Le rendu réel de l'historique ─────────────────────────────────────────

const srcLabels = POINTAGE.match(/const LABELS_TYPES = \{[\s\S]*?\n  \};/);
assert.ok(srcLabels, 'LABELS_TYPES introuvable — l\'épreuve ne juge plus rien');
const srcTimeline = POINTAGE.match(/function renderTimeline\([\s\S]*?\n  \}/);
assert.ok(srcTimeline, 'renderTimeline introuvable — l\'épreuve ne juge plus rien');
assert.ok(/liste\.innerHTML = lignesFaites\.join/.test(srcTimeline[0]),
  'renderTimeline extraite trop court : le rendu jugé n\'est pas celui de la page');

/** Rejoue renderTimeline hors navigateur et rend le HTML qu'elle écrit. */
function rendu(pointages, { prochainType = null, serviceCourantId = null } = {}) {
  const liste = { innerHTML: '', querySelectorAll: () => [] };
  const document = { getElementById: id => (id === 'timelineJour' ? liste : null) };
  const fn = new Function('document', `${srcLabels[0]}\n${srcTimeline[0]}\nreturn renderTimeline;`)(document);
  fn(pointages, prochainType, { id: 'emp-1' }, 'site-1', serviceCourantId);
  return liste.innerHTML;
}

// Une ligne ANCIENNE, telle qu'elle dort en base : le retard y est encore
// écrit, et l'heure d'ouverture du service y est encore capturée.
const ANCIENNE_ARRIVEE = {
  id: 'p-ancienne', type: 'arrivee', heure: '10:33:00', service_id: 'svc-A',
  retard_min: 1028, heure_debut_quart: '17:25:00', photo_url: null,
  photo_echec_technique: true, anomalie_signalee: null,
};

t('G1 · une arrivée n\'affiche que son heure enregistrée, jamais un retard', () => {
  const html = rendu([ANCIENNE_ARRIVEE]);
  assert.ok(html.includes('10:33'), 'l\'heure réellement enregistrée a disparu de l\'écran');
  assert.ok(!/[Rr]etard/.test(html), 'l\'écran affirme de nouveau un retard');
  assert.ok(!/[Hh]oraire pr[ée]vu/.test(html), 'l\'écran oppose de nouveau un « horaire prévu » à l\'employée');
  assert.ok(!html.includes('1028'), 'le retard écrit en base est de nouveau affiché');
  assert.ok(!html.includes('17:25'), 'l\'heure d\'ouverture du service est de nouveau présentée comme un horaire');
});

t('G1b · le retard en base ne teinte plus la ligne (pastille, ambre)', () => {
  const html = rendu([ANCIENNE_ARRIVEE]);
  assert.ok(!/timeline-dot[^"]*retard/.test(html), 'la pastille est de nouveau colorée par un retard');
  assert.ok(!/timeline-sub[^"]*retard/.test(html), 'une sous-ligne est de nouveau classée « retard »');
  assert.ok(!/\.retard\b/.test(sansCommentaires(POINTAGE.match(/<style>[\s\S]*?<\/style>/)[0])),
    'les règles CSS du retard sont revenues : elles n\'ont plus rien à habiller');
});

t('G2 · « Contester ce pointage » survit, porté par le TYPE et non par un retard', () => {
  // Le cas qu'un retard calculé de travers rendait muet : une arrivée que
  // rien ne signale. Elle doit rester contestable.
  const html = rendu([{ id: 'p-1', type: 'arrivee', heure: '08:00:00', service_id: 'svc-A' }]);
  assert.ok(html.includes('Contester ce pointage'),
    'une arrivée sans retard n\'est plus contestable : l\'affordance est partie avec le retard');
  assert.ok(html.includes('data-pointage-id="p-1"'), 'le formulaire de contestation ne cible plus le pointage');
});

t('G2b · seule l\'arrivée est contestable, et une contestation déjà faite se voit', () => {
  const depart = rendu([{ id: 'p-2', type: 'depart', heure: '18:00:00', service_id: 'svc-A' }]);
  assert.ok(!depart.includes('Contester ce pointage'),
    'le départ devient contestable : la portée de l\'affordance a glissé');
  const conteste = rendu([{ id: 'p-3', type: 'arrivee', heure: '08:00:00', service_id: 'svc-A', anomalie_signalee: 'embouteillage' }]);
  assert.ok(conteste.includes('Pointage contesté'), 'une contestation déjà envoyée n\'est plus visible');
  assert.ok(!conteste.includes('Contester ce pointage'), 'l\'écran propose de contester un pointage déjà contesté');
});

// ── Le titre et la séparation des services ────────────────────────────────

t('G3 · l\'écran s\'appelle « Historique du jour », puisqu\'il montre la journée', () => {
  const titres = CODE.match(/📋 Historique du [a-zé]+/g) || [];
  assert.strictEqual(titres.length, 2, `2 titres attendus, ${titres.length} trouvé(s)`);
  for (const titre of titres) {
    assert.strictEqual(titre, '📋 Historique du jour',
      'le titre annonce un service alors que la liste présente toute la journée');
  }
});

t('G3b · plusieurs services dans la journée sont séparés et numérotés', () => {
  const html = rendu([
    { id: 'a', type: 'arrivee', heure: '08:00:00', service_id: 'svc-A' },
    { id: 'b', type: 'depart', heure: '12:00:00', service_id: 'svc-A' },
    { id: 'c', type: 'arrivee', heure: '17:00:00', service_id: 'svc-B' },
  ], { serviceCourantId: 'svc-B' });
  assert.ok(html.includes('Service 1'), 'le premier service n\'est pas nommé');
  assert.ok(html.includes('Service 2'), 'le second service n\'est pas séparé du premier');
  assert.ok(/Service 2 · en cours/.test(html), 'le service en cours n\'est pas distingué des services clos');
  assert.ok(!/Service 1 · en cours/.test(html), 'un service clos est présenté comme en cours');
  assert.ok(html.indexOf('Service 1') < html.indexOf('Service 2'),
    'les services ne sont pas dans l\'ordre de la journée');
});

t('G3c · un service unique n\'est pas affublé d\'un intertitre inutile', () => {
  const html = rendu([
    { id: 'a', type: 'arrivee', heure: '08:00:00', service_id: 'svc-A' },
    { id: 'b', type: 'depart', heure: '18:00:00', service_id: 'svc-A' },
  ], { serviceCourantId: 'svc-A' });
  assert.ok(!html.includes('Service 1'), 'un intertitre sépare une liste qui n\'a rien à séparer');
});

t('G3d · les pointages antérieurs aux services ne sont rattachés à aucun', () => {
  // Écrits avant le 11/09/2026 : service_id est null. Les coller au service
  // voisin inventerait un rattachement que la base ne porte pas.
  const html = rendu([
    { id: 'vieux', type: 'arrivee', heure: '07:00:00' },
    { id: 'a', type: 'arrivee', heure: '08:00:00', service_id: 'svc-A' },
  ], { serviceCourantId: 'svc-A' });
  assert.ok(html.includes('Pointages sans service rattaché'),
    'une ligne sans service est absorbée par le service voisin');
  assert.ok(html.indexOf('Pointages sans service rattaché') < html.indexOf('Service 1'),
    'les lignes sans service ne sont plus à leur place dans la journée');

  // 18/09/2026, campagne de mutation : le cas ci-dessus ne mordait pas seul.
  // Rattacher une ligne orpheline au groupe PRÉCÉDENT ne change rien quand
  // elle ouvre la journée — il n'y a pas de groupe précédent. La mutation ne
  // diverge que pour un orphelin qui SUIT un service ; c'est ce cas-ci.
  const apres = rendu([
    { id: 'a', type: 'arrivee', heure: '08:00:00', service_id: 'svc-A' },
    { id: 'orphelin', type: 'depart', heure: '12:00:00' },
  ], { serviceCourantId: 'svc-A' });
  assert.ok(apres.includes('Pointages sans service rattaché'),
    'un pointage sans service qui suit un service est absorbé par lui');
  assert.ok(apres.indexOf('Service 1') < apres.indexOf('Pointages sans service rattaché'),
    'l’ordre de la journée n’est plus respecté');
});

// ── Ce qui est écrit en base, et ce qui est dit à l'écran ─────────────────

const corpsEnregistrer = POINTAGE.match(/async function enregistrerPointage\([\s\S]*?\n  \}\n/);
assert.ok(corpsEnregistrer, 'enregistrerPointage introuvable — l\'épreuve ne juge plus rien');
const ECRITURE = sansCommentaires(corpsEnregistrer[0]);

t('G4 · la confirmation d\'un pointage reçu n\'a qu\'une forme, sans retard', () => {
  // enregistrerPointage porte quatre bannières : l'attente, le doublon, le
  // refus serveur, l'envoi différé — et la confirmation. Seule la dernière
  // annonçait « Horaire prévu : … · Retard constaté : X min », et elle est
  // la seule jugée ici ; les autres sont jugées sur le retard, pas sur leur
  // nombre.
  const messages = ECRITURE.split('\n').filter(l => /banner\.(textContent|innerHTML)\s*=/.test(l));
  assert.ok(messages.length >= 1, 'plus aucune bannière : l\'employée ne lit plus rien');
  for (const m of messages) {
    assert.ok(!/[Rr]etard|[Hh]oraire pr[ée]vu/.test(m),
      `une bannière affirme de nouveau un retard : ${m.trim().slice(0, 80)}`);
  }
  const confirmations = messages.filter(m => /\$\{notePhoto\}/.test(m));
  assert.strictEqual(confirmations.length, 1,
    `la confirmation a de nouveau ${confirmations.length} formes : la seconde annonçait le retard`);
  assert.ok(/enregistré\$\{type === 'depart' \? '' : 'e'\} à \$\{heure\.slice\(0, 5\)\}/.test(confirmations[0]),
    'la confirmation n\'annonce plus l\'heure enregistrée, et rien qu\'elle');
});

t('G4c · plus aucun chemin ne pose la classe « retard »', () => {
  assert.ok(!/classList\.(add|toggle)\('retard'\)/.test(CODE),
    'un chemin colore de nouveau une ligne en retard');
  assert.ok(!/classList\.remove\('retard'\)/.test(CODE),
    'un retrait défensif subsiste pour une classe que plus rien ne pose : il ment sur l\'état du code');
});

t('G4b · aucun retard n\'est plus CALCULÉ avant l\'écriture', () => {
  assert.ok(!/DATE_OFFICIALISATION_RETARDS/.test(CODE),
    'la bascule de date du retard est revenue : le calcul avec elle');
  assert.ok(!/retardMin\s*=\s*[^0]/.test(ECRITURE),
    'un retard est de nouveau calculé avant l\'écriture en base');
  assert.ok(!/heure_debut[^_]/.test(ECRITURE.slice(ECRITURE.indexOf('const ligne = {'))),
    'l\'heure d\'ouverture du service est de nouveau lue au moment d\'écrire');
});

t('G5 · la vue manager montre l\'heure enregistrée, pas un jugement', () => {
  const corps = POINTAGE.match(/async function afficherEquipeManager\([\s\S]*?\n  \}\n/);
  assert.ok(corps, 'afficherEquipeManager introuvable — l\'épreuve ne juge plus rien');
  const vue = sansCommentaires(corps[0]);
  assert.ok(!/retard_min/.test(vue),
    'le manager relit retard_min : le chiffre de l\'ancien calcul revient par cet écran');
  assert.ok(!/Arriv[ée] à l'heure|min de retard/.test(vue),
    'le manager lit de nouveau un verdict de ponctualité qu\'aucun horaire n\'établit');
  assert.ok(/statutTxt = `Arrivé à \$\{/.test(vue),
    'le manager ne voit plus l\'heure d\'arrivée enregistrée');
});

// ── « comme vous l'avez demandé » : un clic, et rien d'autre ───────────────

t('G6 · « choix_employe » ne naît que du clic explicite « Enregistrer sans photo »', () => {
  const origines = (CODE.match(/fermer\('sans-photo'\)/g) || []);
  assert.strictEqual(origines.length, 1,
    `'sans-photo' a ${origines.length} origines : le choix explicite n'est plus la seule`);
  const ligne = CODE.split('\n').find(l => l.includes("fermer('sans-photo')"));
  assert.ok(/\[data-sans-photo\][\s\S]*addEventListener\('click'/.test(ligne),
    'la seule origine de « sans-photo » n\'est plus un clic sur le bouton dédié');

  const motifs = (CODE.match(/'choix_employe'/g) || []);
  assert.strictEqual(motifs.length, 2,
    `'choix_employe' apparaît ${motifs.length} fois : un producteur ou un lecteur de plus`);
  const appel = CODE.split('\n').find(l => /finaliserPointage\(.*'choix_employe'\)/.test(l));
  assert.ok(appel, 'le clic « sans photo » ne produit plus le motif « choix_employe »');
});

t('G6b · un refus de caméra n\'établit, à lui seul, aucun choix', () => {
  const camera = POINTAGE.match(/function ouvrirCameraPointage\([\s\S]*?\n  \}\n/);
  assert.ok(camera, 'ouvrirCameraPointage introuvable — l\'épreuve ne juge plus rien');
  const src = sansCommentaires(camera[0]);
  // Le refus est reconnu (NotAllowedError) et n'appelle qu'afficherRepli,
  // qui AFFICHE les trois boutons et n'en choisit aucun : la promesse reste
  // en attente. Si ce chemin résolvait quoi que ce soit, il trancherait à la
  // place de l'employée.
  const bloc = src.match(/NotAllowedError[\s\S]*?\n        \}/);
  assert.ok(bloc, 'le refus de caméra n\'est plus distingué des autres pannes');
  assert.ok(!/fermer\(/.test(bloc[0]),
    'le refus de caméra tranche désormais tout seul : « comme vous l\'avez demandé » sans demande');

  const repli = src.match(/function afficherRepli\([\s\S]*?\n      \}/);
  assert.ok(repli, 'afficherRepli introuvable — l\'épreuve ne juge plus rien');
  assert.ok(/data-sans-photo/.test(repli[0]),
    'l\'écran de repli ne propose plus « Enregistrer sans photo » : le choix explicite est impossible');
  // afficherRepli CÂBLE des choix, elle n'en fait aucun : chacun de ses
  // appels à fermer() doit être le corps d'un écouteur de clic. Un seul
  // appel direct trancherait pour l'employée au moment même où l'écran
  // prétend lui demander.
  for (const appel of repli[0].split('\n').filter(l => /fermer\(/.test(l))) {
    assert.ok(/addEventListener\('click', \(\) => fermer\(/.test(appel),
      `afficherRepli résout la promesse hors d'un clic — l'écran de repli choisit à la place de l'employée : ${appel.trim().slice(0, 70)}`);
  }
});

t('G6c · la file hors ligne n\'invente aucun motif de photo', () => {
  const file = CODE.match(/fileAjouter\([\s\S]{0,400}/);
  assert.ok(file, 'la file hors ligne a disparu');
  assert.ok(!/'choix_employe'/.test(CODE.slice(CODE.indexOf('function fileRejouer'))),
    'le rejeu hors ligne produit « choix_employe » : un choix que personne n\'a fait');
});

console.log(`\n${passes}/${total} vérifications passées — l'écran montre l'heure enregistrée, la journée est séparée par service, et « comme vous l'avez demandé » suppose une demande.`);
