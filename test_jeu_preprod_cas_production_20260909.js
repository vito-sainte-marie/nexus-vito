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

// Volumes MESURÉS en Production le 08/09/2026, en lecture seule. Ils sont ici
// pour que le jeu et la mesure ne puissent pas diverger en silence.
const MESURES = { missionsDivergentes: 89, servicesDivergents: 17, servicesOuverts: 13 };

t('les VOLUMES du jeu sont ceux mesurés en Production', () => {
  for (const [quoi, n] of Object.entries(MESURES)) {
    assert.ok(new RegExp(`generate_series\\(1, ${n}\\)`).test(JEU),
      `volume ${n} absent du jeu (${quoi}) — le jeu et la mesure ont divergé`);
  }
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
