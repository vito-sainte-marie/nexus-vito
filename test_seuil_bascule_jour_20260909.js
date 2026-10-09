#!/usr/bin/env node
// Le seuil de bascule doit connaître LE JOUR, et le jour de la STATION.
//
// LE DÉFAUT, corrigé le 09/09/2026. `seuilDeBascule` lisait
// `horaires.quart2.normal` — 12:40 — tous les jours. Or Vito Sainte-Marie a
// deux régimes : du jeudi au samedi, le quart 2 commence à 13:40 et le quart 1
// court jusqu'à 14:15. Un employé prenant son poste un jeudi à 13 h était donc
// enregistré sur le QUART 2 alors qu'il faisait le quart 1 — une heure, trois
// jours par semaine, sur l'écran que toute l'équipe traverse.
//
// Arbitrage de Frédéric Bragance : « le jeudi à 13 h, nous sommes toujours sur
// le quart 1 ».
//
// LA CONVENTION N'EST PAS INVENTÉE ICI. `station_config.horaires` porte
// `normal` et `etendu` depuis toujours, et l'écran Paramètres Station les
// étiquette « Dimanche à Mercredi » et « Jeudi à Samedi » en toutes lettres.
// Seul le code les ignorait.

'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passes = 0;
function t(nom, fn) {
  try { fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { console.error(`  ✗ ${nom}\n    ${e.message}`); process.exitCode = 1; }
}

function charger(source) {
  const ctx = { console, Intl, Date, TypeError, Number, String };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return ctx.NexusStation;
}

const SRC = fs.readFileSync(path.join(__dirname, 'nexus-station.js'), 'utf8');
const S = charger(SRC);

// Horaires RÉELS de la station, relevés en lecture seule sur Production.
const HORAIRES = { quart2: { normal: '12:40', etendu: '13:40' } };
const TZ = 'America/Martinique';
const jour = (iso) => new Date(`${iso}T17:00:00Z`);   // 13 h locales en Martinique

t('jeudi, vendredi et samedi sont en régime étendu', () => {
  for (const d of ['2026-09-10', '2026-09-11', '2026-09-12'])
    assert.strictEqual(S.cleHoraireDuJour(TZ, jour(d)), 'etendu', d);
});

t('dimanche à mercredi sont en régime normal', () => {
  for (const d of ['2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09'])
    assert.strictEqual(S.cleHoraireDuJour(TZ, jour(d)), 'normal', d);
});

t('LE CAS ARBITRÉ : jeudi 13 h, on est encore sur le quart 1', () => {
  const seuil = S.seuilDepuisHoraires(HORAIRES, S.cleHoraireDuJour(TZ, jour('2026-09-10')));
  assert.strictEqual(seuil, 13 * 60 + 40, 'le seuil du jeudi doit être 13h40');
  assert.strictEqual(S.quartDepuisMinutes(13 * 60, seuil), '1',
    'un employé qui prend son poste jeudi à 13 h fait le QUART 1');
});

t('et jeudi 14 h, on est bien passé au quart 2', () => {
  const seuil = S.seuilDepuisHoraires(HORAIRES, S.cleHoraireDuJour(TZ, jour('2026-09-10')));
  assert.strictEqual(S.quartDepuisMinutes(14 * 60, seuil), '2',
    'après 13h40 le quart 2 a commencé — sinon la correction va trop loin');
});

t('dimanche 13 h reste le quart 2 — le régime normal n’est pas touché', () => {
  const seuil = S.seuilDepuisHoraires(HORAIRES, S.cleHoraireDuJour(TZ, jour('2026-09-06')));
  assert.strictEqual(seuil, 12 * 60 + 40);
  assert.strictEqual(S.quartDepuisMinutes(13 * 60, seuil), '2',
    '12h40 tombe dans le chevauchement dimanche–mercredi : celui qui arrive prend le quart 2');
});

t('c’est le jour DE LA STATION qui décide, pas celui de l’appareil', () => {
  // Même instant, deux fuseaux : mercredi 19 h 30 en Martinique, jeudi 1 h 30 à
  // Paris. Si le fuseau ne comptait pas, cette épreuve ne pourrait pas les
  // distinguer — et le régime du jeudi s'appliquerait un mercredi soir.
  const instant = new Date('2026-09-09T23:30:00Z');
  assert.strictEqual(S.cleHoraireDuJour('America/Martinique', instant), 'normal');
  assert.strictEqual(S.cleHoraireDuJour('Europe/Paris', instant), 'etendu');
});

t('sans fuseau, on REFUSE — on ne prend pas le jour de la machine', () => {
  assert.throws(() => S.cleHoraireDuJour('', new Date()), /timezone obligatoire/,
    'un fuseau vide doit être refusé, jamais remplacé par l’horloge locale');
  assert.throws(() => S.cleHoraireDuJour(undefined, new Date()), /timezone obligatoire/);
});

t('un site à horaire uniforme retombe sur « normal » sans erreur', () => {
  const uniforme = { quart2: { normal: '13:00' } };
  assert.strictEqual(S.seuilDepuisHoraires(uniforme, 'etendu'), 13 * 60,
    'un commerce sans régime étendu doit garder son horaire unique');
});

t('une configuration absente rend null, jamais un seuil inventé', () => {
  assert.strictEqual(S.seuilDepuisHoraires(null, 'normal'), null);
  assert.strictEqual(S.seuilDepuisHoraires({}, 'normal'), null);
  assert.strictEqual(S.seuilDepuisHoraires({ quart2: {} }, 'etendu'), null);
});

t('MUTATION : sans les jours étendus, le jeudi retombe sur le quart 2', () => {
  // Sans cette mutation, l'épreuve du cas arbitré passerait aussi sur un code
  // qui ignore le jour, du moment que le seuil vaut 13h40 par hasard.
  const mute = SRC.replace(/const JOURS_ETENDUS = \[[^\]]*\];/, 'const JOURS_ETENDUS = [];');
  assert.notStrictEqual(mute, SRC, 'la mutation n’a rien changé : elle ne prouve rien');
  const M = charger(mute);
  const seuil = M.seuilDepuisHoraires(HORAIRES, M.cleHoraireDuJour(TZ, jour('2026-09-10')));
  assert.strictEqual(M.quartDepuisMinutes(13 * 60, seuil), '2',
    'le code muté devait redonner le défaut du 09/09 ; l’épreuve ne le détecte donc pas');
});

// ─────────────────────────────────────────────────────────────────────────
// LE RENFORT — un quart de plein droit, que l'horloge ne peut pas deviner.
//
// Arbitrage de Frédéric Bragance, 09/09/2026. Le planning connaissait trois
// quarts depuis toujours ; l'exécution n'en rendait que deux, et un renfort
// était enregistré « matin » ou « soir ». Sur les deux seuls quarts engagés de
// la station depuis le 04/09, celui qui a validé 64 missions est un renfort :
// l'employé le plus engagé travaillait dans le régime que l'exécution ne
// savait pas nommer.

t('un renfort PLANIFIÉ est un renfort, quelle que soit l’heure', () => {
  for (const minutes of [9 * 60, 12 * 60, 16 * 60]) {
    const r = S.quartDuJour({ planifie: 'renfort', minutesMaintenant: minutes, minutesBascule: 12 * 60 + 40 });
    assert.strictEqual(r.quart, 'renfort', `à ${minutes / 60} h`);
    assert.strictEqual(r.source, 'planning');
  }
});

t('AUCUNE heure ne permet de deviner un renfort — d’où le planning', () => {
  // À 10 h, un pompiste du quart 1 et un renfort travaillent tous les deux.
  // Sans planning, l'horloge ne peut que dire « quart 1 » : c'est exact pour
  // l'un et faux pour l'autre, et c'est précisément pourquoi le planning
  // décide.
  const sansPlanning = S.quartDuJour({ planifie: null, minutesMaintenant: 10 * 60, minutesBascule: 12 * 60 + 40 });
  assert.strictEqual(sansPlanning.quart, 'quart1');
  assert.strictEqual(sansPlanning.source, 'horloge');
});

t('le planning PRIME sur l’horloge, y compris quand ils divergent', () => {
  // 16 h : l'horloge dirait quart 2. Le planning dit quart 1 — un employé qui
  // finit tard reste sur son quart. Sans cette priorité, le planning ne
  // servirait à rien.
  const r = S.quartDuJour({ planifie: 'quart1', minutesMaintenant: 16 * 60, minutesBascule: 12 * 60 + 40 });
  assert.strictEqual(r.quart, 'quart1');
  assert.strictEqual(r.source, 'planning');
});

t('un quart planifié HORS VOCABULAIRE est ignoré, pas propagé', () => {
  // Une valeur inconnue en base ne doit pas traverser jusqu'à shifts.quart.
  const r = S.quartDuJour({ planifie: 'nuit', minutesMaintenant: 10 * 60, minutesBascule: 12 * 60 + 40 });
  assert.strictEqual(r.quart, 'quart1', 'le repli horloge doit reprendre la main');
  assert.strictEqual(r.source, 'horloge');
});

t('sans horloge exploitable NI planning, on ne rend rien', () => {
  assert.strictEqual(S.quartDuJour({ planifie: null, minutesMaintenant: null, minutesBascule: 760 }), null,
    'ne pas savoir n’est pas « quart 1 »');
});

t('la source est TOUJOURS rendue — sans elle on ne peut rien expliquer', () => {
  for (const cas of [{ planifie: 'renfort', minutesMaintenant: 600, minutesBascule: 760 },
                     { planifie: null, minutesMaintenant: 600, minutesBascule: 760 }]) {
    assert.ok(['planning', 'horloge'].includes(S.quartDuJour(cas).source));
  }
});

t('la date du planning est celle de la STATION, pas de l’appareil', () => {
  // 2 h UTC le 10/09 : encore le 9 en Martinique, déjà le 10 à Paris. Lire le
  // planning au mauvais jour donnerait le quart de la veille ou du lendemain.
  const instant = new Date('2026-09-10T02:00:00Z');
  assert.strictEqual(S.dateLocaleStation('America/Martinique', instant), '2026-09-09');
  assert.strictEqual(S.dateLocaleStation('Europe/Paris', instant), '2026-09-10');
  assert.throws(() => S.dateLocaleStation('', instant), /timezone obligatoire/);
});

t('MUTATION : sans la priorité au planning, le renfort disparaît', () => {
  const mute = SRC.replace(
    /if \(typeof planifie === 'string' && QUARTS_PLANIFIABLES\.includes\(planifie\)\) \{/,
    'if (false) {');
  assert.notStrictEqual(mute, SRC, 'la mutation n’a rien changé : elle ne prouve rien');
  const M = charger(mute);
  const r = M.quartDuJour({ planifie: 'renfort', minutesMaintenant: 10 * 60, minutesBascule: 12 * 60 + 40 });
  assert.strictEqual(r.quart, 'quart1',
    'le code muté devait retomber sur l’horloge ; l’épreuve ne détecte donc pas le défaut');
});

console.log(`\n${passes}/18 vérifications passées — le jeudi à 13 h, c’est le quart 1.`);
