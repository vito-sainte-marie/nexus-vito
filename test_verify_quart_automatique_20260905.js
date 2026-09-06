// Verify — le quart proposé vient du contrat C2, plus du premier `<option>`.
//
// Verify n'avait AUCUNE détermination de quart. Le `<select>` listait
// « Quart 1 » en premier, le navigateur le sélectionnait par simple position
// dans le DOM, et l'écran proposait donc Q1 à 21h. Le manager devait corriger
// à la main ; s'il oubliait, l'audit partait dans le mauvais quart — et
// `|| '1'` au moment de l'enregistrement transformait même une absence de
// choix en Quart 1.
//
// La règle est celle de C2, partout ailleurs : heure locale de la STATION,
// seuil CONFIGURÉ du site. Aucune logique propre à Verify.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const ECRAN = fs.readFileSync(path.join(RACINE, 'NEXUS-Verify-v1.html'), 'utf8');
const sansCommentaires = t => t.split('\n')
  .filter(l => !/^\s*(\/\/|\*|<!--|-->)/.test(l)).join('\n');
const CODE = sansCommentaires(ECRAN);

function corpsDe(nom) {
  const i = CODE.indexOf(`function ${nom}(`);
  assert.ok(i !== -1, `${nom} introuvable`);
  const j = CODE.indexOf('\n    }', i);
  return CODE.slice(i, j === -1 ? CODE.length : j);
}

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

verifier('le sélecteur n’a plus de quart plausible en première position', () => {
  const i = CODE.indexOf('<select id="v_quart">');
  assert.ok(i !== -1, 'sélecteur introuvable');
  const bloc = CODE.slice(i, CODE.indexOf('</select>', i));
  const premiere = /<option value="([^"]*)"/.exec(bloc);
  assert.strictEqual(premiere[1], '',
    'la première option est celle que le navigateur choisit seul : elle ne doit désigner aucun quart');
});

verifier('le quart vient des primitives partagées, pas d’une règle locale', () => {
  const corps = corpsDe('quartDuMomentVerify');
  assert.ok(/NexusStation\.quartDepuisMinutes\(/.test(corps), 'la décision du quart appartient à la primitive');
  assert.ok(/NexusStation\.minutesLocalesStation\(FUSEAU_STATION/.test(corps),
    'l’heure comparée est celle de la STATION, jamais celle de l’appareil');
  assert.ok(/NexusStation\.minutesDepuisMinuit\(/.test(corps), 'le seuil passe par la primitive');
  assert.ok(!/getHours\(\)|getMinutes\(\)/.test(corps),
    'lire l’horloge de l’appareil rétablirait le défaut que C2 a corrigé partout ailleurs');
});

verifier('le seuil est celui configuré pour le site', () => {
  const corps = corpsDe('quartDuMomentVerify');
  assert.ok(/from\('station_config'\)\.select\('horaires'\)/.test(corps), 'le seuil est lu en configuration');
  assert.ok(/\.eq\('site', SITE_ACTUEL\)/.test(corps), 'le seuil est celui de CE site');
  assert.ok(/horaires\.quart2 && data\.horaires\.quart2\.normal/.test(corps),
    'même source de seuil que les autres écrans');
  assert.ok(!/'12:40'|'13:00'/.test(corps), 'aucun seuil en dur');
});

verifier('sans fuseau ou sans seuil, Verify refuse au lieu de proposer', () => {
  const corps = corpsDe('quartDuMomentVerify');
  assert.ok(/if \(bascule === null\)[\s\S]{0,220}?return null;/.test(corps), 'seuil absent → refus');
  assert.ok(/if \(!FUSEAU_STATION\)[\s\S]{0,220}?return null;/.test(corps), 'fuseau absent → refus');
  // Sémantique A4-bis : une configuration manquante est une incohérence
  // métier, pas une panne technique.
  assert.ok(/console\.warn\('Quart Verify : aucun horaire/.test(CODE), 'seuil manquant = warn');
  assert.ok(/console\.warn\('Quart Verify : fuseau/.test(CODE), 'fuseau manquant = warn');
});

verifier('aucun quart n’est écrit en dur dans le formulaire', () => {
  assert.ok(!/getElementById\('v_quart'\)\.value = '1'/.test(CODE),
    'la réinitialisation ne doit pas réintroduire Quart 1 après chaque enregistrement');
  assert.ok(/getElementById\('v_quart'\)\.value = QUART_DU_MOMENT \|\| ''/.test(CODE),
    'le formulaire repart du quart déterminé, ou de rien');
});

verifier('l’enregistrement refuse un quart indéterminé', () => {
  assert.ok(!/getElementById\('v_quart'\)\.value\.trim\(\) \|\| '1'/.test(CODE),
    'le repli sur Quart 1 écrivait l’audit dans le mauvais quart au moment même de l’écriture');
  assert.ok(/if \(!quart\) \{ alert\(/.test(CODE),
    'sans quart déterminé, l’enregistrement doit être refusé et dit');
});

verifier('la date de départ est celle de la station', () => {
  // Sinon le quart viendrait de la station et la date de l'appareil : à 21:00
  // en Martinique, un téléphone réglé sur Paris est déjà au lendemain.
  assert.ok(!/getElementById\('v_date'\)\.valueAsDate = new Date\(\)/.test(CODE),
    'la date ne vient plus de l’horloge de l’appareil');
  const corps = corpsDe('dateDuJourStation');
  assert.ok(/timeZone: FUSEAU_STATION/.test(corps), 'la date se calcule dans le fuseau de la station');
  assert.ok(/if \(!FUSEAU_STATION\) return '';/.test(corps), 'sans fuseau, aucune date n’est inventée');
});

verifier('un seul endroit pose le contexte de départ', () => {
  // Le premier chargement et la réinitialisation après enregistrement doivent
  // être le même geste : sinon l'un des deux rattrape un défaut que l'autre
  // réintroduit, ce qui est exactement ce qui s'est produit ici.
  const appels = (CODE.match(/appliquerContexteDuMoment\(\)/g) || []).length;
  assert.ok(appels >= 3, 'la définition et ses deux appels — chargement et réinitialisation');
  const corps = corpsDe('appliquerContexteDuMoment');
  assert.ok(/dateDuJourStation\(\)/.test(corps) && /QUART_DU_MOMENT/.test(corps),
    'le contexte pose ensemble la date et le quart de la station');
});

verifier('la détermination a lieu après la résolution du fuseau', () => {
  const fuseau = CODE.indexOf('FUSEAU_STATION = fuseauVerify.timezone');
  const quart = CODE.indexOf('QUART_DU_MOMENT = await quartDuMomentVerify()');
  assert.ok(fuseau !== -1 && quart !== -1);
  assert.ok(fuseau < quart,
    'déterminer le quart avant de connaître le fuseau le rendrait systématiquement nul');
});

console.log(`\n${passes} vérifications passées — Verify ne propose plus un quart par position dans le DOM.`);
