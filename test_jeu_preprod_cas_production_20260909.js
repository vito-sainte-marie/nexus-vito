// Le jeu de répétition reproduit-il les cas Production, sans copier Production ?
//
// Arbitrage de Frédéric Bragance, 09/09/2026 : PREPROD est un état temporaire
// de `nexus-test`, « créé à partir de données de Test structurées pour
// reproduire les cas Production utiles », jamais une copie de la station.
//
// Ce jeu doit donc porter les FORMES et les VOLUMES relevés en lecture seule
// le 08/09 — et rien d'autre. Une donnée réelle qui s'y glisserait ferait de
// nexus-test ce que l'arbitrage interdit explicitement.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const JEU = fs.readFileSync(path.join(__dirname, 'outils', 'jeu-preprod-cas-production.sql'), 'utf8');

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

// Les volumes vivaient ICI, en dur, avec la date de leur mesure en commentaire.
// Le 09/09/2026 l'un d'eux a bougé — 13 services ouverts la veille, 17 le
// lendemain — et rien ne reliait ce nombre à sa date autrement qu'un
// commentaire. Ils vivent désormais dans un fichier daté, lisible par la
// répétition elle-même.
const MESURE = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'docs', 'recettes', 'volumes-production-mesures.json'), 'utf8'));

t('la mesure versionnée est complète et datée', () => {
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(MESURE.mesure_le),
    'une mesure sans date ne peut pas être jugée fraîche ou périmée');
  for (const k of ['missions_divergentes', 'services_divergents', 'services_ouverts'])
    assert.ok(Number.isInteger(MESURE.volumes[k]) && MESURE.volumes[k] > 0,
      `volume ${k} absent ou nul : la répétition sèmerait du vide`);
});

t('les VOLUMES du jeu sont ceux de la mesure versionnée', () => {
  // On COMPTE les occurrences plutôt que d'en chercher une seule : deux volumes
  // valent 17 aujourd'hui, et un simple « le nombre apparaît » serait satisfait
  // par une seule des deux insertions.
  const attendus = Object.values(MESURE.volumes).filter(n => n !== MESURE.volumes.missions_divergentes || true);
  const trouves = [...JEU.matchAll(/generate_series\(1, (\d+)\)/g)].map(m => Number(m[1])).sort((a, b) => a - b);
  const voulus = Object.values(MESURE.volumes).slice().sort((a, b) => a - b);
  assert.deepStrictEqual(trouves, voulus,
    `le jeu sème ${JSON.stringify(trouves)} alors que la mesure du ${MESURE.mesure_le} dit ${JSON.stringify(voulus)}`);
});

t('la VÉRIFICATION FINALE du jeu attend les mêmes nombres', () => {
  // Le jeu refuse de rendre la main s'il n'a pas posé ces volumes. Si ce
  // contrôle et la mesure divergeaient, le jeu se validerait contre un chiffre
  // périmé — exactement le silence que ce fichier existe pour empêcher.
  const v = MESURE.volumes;
  assert.ok(new RegExp(`m <> ${v.missions_divergentes} or d <> ${v.services_divergents} or o <> ${v.services_ouverts}`).test(JEU),
    'le contrôle final du jeu ne porte pas sur les volumes mesurés');
});

t('la divergence est reproduite dans les DEUX SENS', () => {
  // Les deux migrations corrigent en sens contraires : `site := site_id` d'un
  // côté, `site_id := site` de l'autre. Un seul sens laisserait la moitié du
  // comportement non éprouvée.
  const missions = JEU.slice(JEU.indexOf('into public.mission_catalog'), JEU.indexOf('-- 2)'));
  assert.ok(/'nexus-station-test',\s*\n\s*'site-fantome-test'/.test(missions),
    'missions : site = station, site_id = fantôme');
  const services = JEU.slice(JEU.indexOf('-- 2)'), JEU.indexOf('-- 3)'));
  assert.ok(/'site-fantome-test', 'nexus-station-test'/.test(services),
    'services : site = fantôme, site_id = station — le sens INVERSE');
});

t('le jeu est SYNTHÉTIQUE — aucune identité, aucun libellé réel', () => {
  // Les employés sont RÉFÉRENCÉS par requête sur les comptes de recette,
  // jamais nommés ; les libellés sont générés.
  assert.ok(/from public\.employees/.test(JEU), 'les employés doivent être lus, pas écrits en dur');
  assert.ok(/compte_test = true/.test(JEU), 'et pris parmi les comptes de recette');
  assert.ok(!/insert into public\.employees/i.test(JEU), 'aucun employé créé par ce jeu');
  assert.ok(/'Mission de répétition ' \|\| i/.test(JEU), 'les libellés sont générés, pas recopiés');
  // Un UUID en dur serait une identité venue d'ailleurs.
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(JEU),
    'aucun identifiant réel ne doit figurer dans le jeu');
});

t('le jeu REFUSE de se semer hors du mode répétition', () => {
  // Éprouvé sur la vraie base le 09/09 : en TEST_NORMAL il lève, et rien
  // n'est écrit. Semé en recette, il fausserait des verdicts restés verts.
  assert.ok(/mode is distinct from 'PREPROD_REHEARSAL'/.test(JEU));
  assert.ok(/raise exception/.test(JEU.slice(JEU.indexOf('mode is distinct'))),
    'le refus doit LEVER, pas avertir');
  const iGarde = JEU.indexOf('nexus_environnement_mode');
  const iEcriture = JEU.search(/insert into public\./);
  assert.ok(iGarde > 0 && iGarde < iEcriture, 'la garde doit précéder toute écriture');
  assert.ok(/NON LU/.test(JEU), 'un mode illisible doit être nommé, pas assimilé au mode normal');
});

t('l’ORDRE d’application est écrit, parce qu’il est contre-intuitif', () => {
  // L'index d'unicité créé par la migration de reprise rend les 13 services
  // ouverts IMPOSSIBLES après migration. Le jeu se sème avant, jamais après.
  assert.ok(/shifts_un_seul_service_en_cours/.test(JEU),
    'l’index qui rend l’état impossible doit être nommé');
  assert.ok(/ÉTAT D'AVANT LA\n-- RELEASE|état d'avant la release/i.test(JEU),
    'le moment d’application doit être explicite');
  assert.ok(/un échec juste/.test(JEU),
    'l’échec sur une base à jour doit être annoncé comme juste, pas comme un défaut du jeu');
});

t('le jeu n’écrit QUE dans les trois tables concernées', () => {
  const tables = [...JEU.matchAll(/insert into public\.(\w+)/g)].map(m => m[1]);
  assert.deepStrictEqual([...new Set(tables)].sort(), ['mission_catalog', 'shifts', 'sites']);
  assert.ok(!/\b(update|delete from|drop|truncate)\b/i.test(
    JEU.split('\n').filter(l => !/^\s*--/.test(l)).join('\n')),
    'un jeu de données ajoute ; il ne corrige ni ne supprime');
});

console.log(`\n${n}/${n} vérifications passées — les formes de Production, jamais ses données.`);
