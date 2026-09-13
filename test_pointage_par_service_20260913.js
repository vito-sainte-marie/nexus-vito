/*
 * Ce qui est « déjà pointé » se compte par service, pas par journée.
 * ============================================================================
 * LE DÉFAUT, relevé par Frédéric le 13/09/2026. Départ pointé à 12:32, reprise
 * d'un poste à 12:48. Mesuré en base :
 *
 *     pointages du jour : arrivee 12:27:58 · depart 12:32:05
 *     services du jour  : termine 12:27:48 → 12:32:05 | en_cours 12:48:23
 *
 * L'écran annonçait « début de pause » comme prochaine étape et éteignait TOUS
 * les boutons : le nouveau service héritait des pointages du précédent.
 *
 * La base n'a jamais interdit ce cas — `pointages_un_par_service_et_type`
 * porte sur (service_id, employee_id, type). C'est l'écran qui datait d'avant
 * `service_id`.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const SOURCE = fs.readFileSync(path.join(__dirname, 'NEXUS-Pointage-v1.html'), 'utf8');
let reussites = 0, echecs = 0;
function verifier(nom, condition, detail) {
  if (condition) { reussites++; console.log(`  ✓ ${nom}`); }
  else { echecs++; console.log(`  ✗ ${nom}${detail ? '\n      ' + detail : ''}`); }
}

// La règle de disponibilité, extraite telle quelle de l'écran.
const bloc = SOURCE.match(/function pointageDisponible\(type, dejaFait\) \{[\s\S]*?\n  \}/);
const pointageDisponible = new Function(`${bloc[0]}; return pointageDisponible;`)();
const ORDRE = ['arrivee', 'pause_debut', 'pause_fin', 'depart'];
const prochain = dejaFait => ORDRE.find(t => pointageDisponible(t, dejaFait));

console.log('\n── 1 · Le scénario exact du 13/09 ──');
// Service 1 : arrivée puis départ. Service 2 : rien encore.
const service1 = { arrivee: { heure: '12:27:58' }, depart: { heure: '12:32:05' } };
const service2 = {};
verifier('service 1 terminé : plus rien à pointer', prochain(service1) === undefined);
verifier('service 2 neuf : la prochaine étape est l’arrivée', prochain(service2) === 'arrivee');
verifier('service 2 neuf : l’arrivée est DISPONIBLE',
  pointageDisponible('arrivee', service2) === true);
verifier('l’ancien calcul aurait annoncé « début de pause »',
  ORDRE.find(t => !service1[t]) === 'pause_debut');
verifier('… et cette étape est justement indisponible',
  pointageDisponible('pause_debut', service1) === false,
  'l’écran annonçait une étape que ses propres boutons refusaient');

console.log('\n── 2 · « prochaine étape » ne ment plus jamais ──');
const cas = [
  ['journée neuve', {}, 'arrivee'],
  ['arrivée pointée', { arrivee: {} }, 'pause_debut'],
  ['pause commencée', { arrivee: {}, pause_debut: {} }, 'pause_fin'],
  ['pause terminée', { arrivee: {}, pause_debut: {}, pause_fin: {} }, 'depart'],
  ['journée bouclée sans pause', { arrivee: {}, depart: {} }, undefined],
  ['journée bouclée avec pause', { arrivee: {}, pause_debut: {}, pause_fin: {}, depart: {} }, undefined],
];
cas.forEach(([nom, etat, attendu]) => {
  const obtenu = prochain(etat);
  verifier(`${nom} → ${attendu === undefined ? 'plus rien' : attendu}`, obtenu === attendu,
    `obtenu ${obtenu === undefined ? 'plus rien' : obtenu}`);
});
verifier('toute étape annoncée est toujours disponible',
  cas.every(([, etat]) => { const p = prochain(etat); return p === undefined || pointageDisponible(p, etat); }));

console.log('\n── 3 · La source lit bien le service, plus la journée ──');
verifier('service_id est chargé avec les pointages',
  /select\('id, type, heure, retard_min, photo_url, photo_echec_technique, heure_debut_quart, anomalie_signalee, service_id'\)/.test(SOURCE));
verifier('dejaFait est filtré sur le service courant',
  /\.filter\(p => serviceCourant && p\.service_id === serviceCourant\.id\)/.test(SOURCE));
verifier('prochainType vient de la disponibilité, plus de ORDRE_TYPES.find(!dejaFait)',
  /const prochainType = ORDRE_TYPES\.find\(t => pointageDisponible\(t, dejaFait\)\);/.test(SOURCE));
verifier('l’ancien calcul séquentiel a disparu du code vivant',
  !/^\s*const prochainType = ORDRE_TYPES\.find\(t => !dejaFait\[t\]\);/m.test(SOURCE),
  'il n’en reste qu’une trace en commentaire, qui documente le défaut');
verifier('l’historique reste celui de la JOURNÉE',
  /renderTimeline\(pointagesJour \|\| \[\], prochainType, employee, siteId\)/.test(SOURCE));

console.log('\n── 4 · Un pointage sans service ne compte pour aucun service ──');
verifier('les pointages historiques à service_id nul sont exclus',
  /p\.service_id === serviceCourant\.id/.test(SOURCE),
  'une égalité stricte : null n’égale aucun identifiant');

console.log(`\n${echecs === 0 ? '✓' : '✗'} ${reussites} réussite(s), ${echecs} échec(s)\n`);
process.exit(echecs === 0 ? 0 : 1);
