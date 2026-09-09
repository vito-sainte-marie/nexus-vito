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

console.log(`\n${passes}/10 vérifications passées — le jeudi à 13 h, c’est le quart 1.`);
