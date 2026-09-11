#!/usr/bin/env node
// Soumettre à un rôle sa participation à l'inventaire.
//
// LA MESURE QUI A DÉCIDÉ DE LA FORME. Frédéric Bragance, 09/09/2026 : « je
// souhaite soumettre au renfort sa participation à l'inventaire ». J'ai cherché
// ce qui bloquait le renfort, et n'ai rien trouvé : le rôle est proposé à la
// prise de poste, `shifts.role` le porte, l'écran Inventaire le résout, la
// présence s'écrit, `role_code` n'a aucune contrainte, `zonesPourRole` lui
// ouvre les deux zones, et une règle « renfort · les deux quarts · moment
// pendant » existe déjà en Production.
//
// Et pourtant, relevé en lecture seule le 09/09/2026 : 36 services pris en
// renfort depuis le 18/07, ZÉRO présence en renfort sur une session
// d'inventaire, 56 missions restées non affectées.
//
// Le défaut n'est pas un blocage, c'est une ABSENCE D'INVITATION. Ces épreuves
// portent donc sur ce qu'on propose, et surtout sur ce qu'on NE propose PAS.

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

const SRC = fs.readFileSync(path.join(__dirname, 'nexus-inventaire-moteur.js'), 'utf8');
function charger(source) {
  const ctx = { console, Date, Math, JSON, Set, Map, Array, Object, Number, String, isNaN };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return ctx.NexusInventaireMoteur;
}
const M = charger(SRC);

// Règles calquées sur celles de la station : le renfort visé « les deux
// quarts, moment pendant », plus deux règles caissier et pompiste.
const REGLES = [
  { id: 'r1', nom: 'Sensibles boutique', role_code: 'caissier', role_repli: null,
    quart: 'matin', moment_code: 'debut', ordre_affichage: 10, actif: true },
  { id: 'r2', nom: 'Tournant piste', role_code: 'pompiste', role_repli: 'renfort',
    quart: null, moment_code: 'pendant', ordre_affichage: 20, actif: true },
  { id: 'r3', nom: 'Contrôle renfort', role_code: 'renfort', role_repli: null,
    quart: null, moment_code: 'pendant', ordre_affichage: 30, actif: true },
];
const CTX = { missionRules: REGLES, quart: 'matin', moment: 'pendant' };

t('le renfort absent se voit proposer ce qui l’attend', () => {
  const a = M.reglesQuiAttendent({ ...CTX, rolesPresents: ['caissier'], role: 'renfort' });
  const ids = [...a.map(x => x.regle.id)].sort();
  assert.deepStrictEqual(ids, ['r2', 'r3'],
    'r3 le vise directement, r2 l’appelle en repli — les deux l’attendent');
});

t('la distinction VISÉ / REPLI est conservée, pas aplatie', () => {
  const a = M.reglesQuiAttendent({ ...CTX, rolesPresents: ['caissier'], role: 'renfort' });
  assert.strictEqual(a.find(x => x.regle.id === 'r3').viaRepli, false);
  assert.strictEqual(a.find(x => x.regle.id === 'r2').viaRepli, true,
    'être appelé en renfort d’un pompiste absent n’est pas la même proposition');
});

t('rien n’est proposé à un rôle DÉJÀ PRÉSENT', () => {
  // Ses missions lui sont déjà affectées par le chemin normal ; l’inviter
  // reviendrait à lui proposer ce qu’il a déjà.
  // `deepStrictEqual` compare aussi les prototypes : un tableau né dans le
  // bac à sable `vm` n'est jamais « strictement » égal à un tableau d'ici.
  // On compare donc ce qui a un sens — le contenu.
  assert.strictEqual(
    M.reglesQuiAttendent({ ...CTX, rolesPresents: ['renfort'], role: 'renfort' }).length, 0);
});

t('une mission DÉJÀ PRISE n’est jamais proposée', () => {
  // Le pompiste est là : r2 lui revient, elle n’attend plus personne.
  const a = M.reglesQuiAttendent({ ...CTX, rolesPresents: ['pompiste'], role: 'renfort' });
  assert.deepStrictEqual([...a.map(x => x.regle.id)], ['r3'],
    'proposer une mission déjà affectée serait pire que se taire');
});

t('on ne propose pas les missions d’un AUTRE rôle', () => {
  const a = M.reglesQuiAttendent({ ...CTX, quart: 'matin', moment: 'debut',
                                   rolesPresents: [], role: 'renfort' });
  assert.strictEqual(a.length, 0,
    'r1 vise le caissier et ne nomme pas le renfort en repli');
});

t('sans rôle nommé, on ne propose RIEN — jamais un défaut', () => {
  for (const role of [null, undefined, '', '   '])
    assert.strictEqual(M.reglesQuiAttendent({ ...CTX, rolesPresents: [], role }).length, 0);
});

t('la proposition ne montre QU’UNE mission, et dit combien attendent', () => {
  const attendues = M.reglesQuiAttendent({ ...CTX, rolesPresents: ['caissier'], role: 'renfort' });
  const p = M.propositionParticipation({ attendues, role: 'renfort' });
  assert.strictEqual(p.nombreEnAttente, 2, 'le nombre derrière doit être dit');
  assert.strictEqual(p.mission.id, 'r3',
    'la mission qui VISE le renfort passe avant celle qui l’appelle en repli');
  assert.strictEqual(p.viaRepli, false);
});

t('à défaut de mission visée, le repli est proposé — et annoncé comme tel', () => {
  const attendues = M.reglesQuiAttendent({ ...CTX, rolesPresents: ['caissier'], role: 'renfort' })
    .filter(a => a.viaRepli);
  const p = M.propositionParticipation({ attendues, role: 'renfort' });
  assert.strictEqual(p.mission.id, 'r2');
  assert.strictEqual(p.viaRepli, true, 'l’employé a le droit de savoir qu’il vient en soutien');
});

t('rien à proposer rend NULL, pas un écran vide', () => {
  // « 0 mission en attente » ajoute du bruit à un outil qu'on reproche déjà
  // d'en faire trop.
  assert.strictEqual(M.propositionParticipation({ attendues: [], role: 'renfort' }), null);
  assert.strictEqual(M.propositionParticipation({ attendues: null, role: 'renfort' }), null);
});

t('un rôle DÉJÀ PRÉSENT ne reçoit rien — et aucun garde spécial n’y veille', () => {
  // J'avais écrit `if (presents.has(cible)) return []`. La mutation qui le
  // retire n'a RIEN cassé : quand le rôle est là, ses règles sont `affectee`
  // et le filtre « non affectée » les écarte déjà. Le raccourci est donc
  // supprimé, et cette épreuve garde le COMPORTEMENT, qui lui est réel.
  assert.ok(!/presents\.has\(cible\)/.test(SRC),
    'le raccourci mort est revenu : aucune mutation ne peut le mettre en défaut');
  assert.strictEqual(
    M.reglesQuiAttendent({ ...CTX, rolesPresents: ['renfort'], role: 'renfort' }).length, 0);
});

t('MUTATION : sans le filtre « non affectée », on propose du déjà pris', () => {
  const mute = SRC.replace(".filter(r => r.statut === 'non_affectee')", '');
  assert.notStrictEqual(mute, SRC, 'la mutation n’a rien changé');
  const Mm = charger(mute);
  const a = Mm.reglesQuiAttendent({ ...CTX, rolesPresents: ['pompiste'], role: 'renfort' });
  assert.ok(a.some(x => x.regle.id === 'r2'),
    'le code muté devait proposer r2, pourtant affectée au pompiste présent');
});

console.log(`\n${passes}/11 vérifications passées — on invite, on ne redistribue pas.`);
