#!/usr/bin/env node
// Un transfert vers un autre site se déclare depuis l'écran — 19/09/2026.
//
// CE QU'ON GARDE. Le planning Google Sheets écrit un code court — « SMU » —
// là où NEXUS connaît un `site_id`. Le dictionnaire qui traduit l'un dans
// l'autre vit dans `station_config.planning_codes_sites`, et c'est lui qui
// décide si une cellule vaut 7 h SUR PLACE ou 7 h en TRANSFERT.
//
// LE DÉFAUT CORRIGÉ. Le menu des cibles était peuplé par
// `from('sites').select(...)`, soumis à la policy `select_sites` :
// `site_id = current_employee_site_id() OR (je_suis_createur() AND ...)`.
// Un manager ordinaire n'y lisait donc QUE sa propre station, et ne pouvait
// désigner aucun autre site — alors que la base, elle, l'accepte déjà :
// `planning_codes_sites_controle()` est `security definer` PRÉCISÉMENT
// « parce que `sites` porte une RLS », et n'exige qu'un `site_id` existant.
// Le blocage était donc entièrement dans l'interface, et le cas métier normal
// — « le planning envoie quelqu'un au site voisin » — obligeait à psql.
//
// CE QU'ELLE NE JUGE PAS. Elle lit du texte : que le trigger existe sur une
// base donnée est une autre question. Elle ne juge pas non plus la RLS, qui
// reste volontairement fermée — ouvrir `sites` divulguerait la liste des
// clients NEXUS à chaque manager.

'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
let passes = 0;
let echecs = 0;
function t(nom, fn) {
  try { fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { echecs++; process.exitCode = 1; console.error(`  ✗ ${nom}\n    ${e && e.message}`); }
}
const lire = f => fs.readFileSync(path.join(RACINE, f), 'utf8');

const ECRAN = 'NEXUS-Parametres-Station-v1.html';
const MOTEUR = 'nexus-planning-sheets-moteur.js';

// ── 1 · L'écran sait désigner un site que ce compte ne lit pas ────────────

console.log('\n── 1 · Paramètres Station : la cible n\'est plus bornée à la RLS ──');

t('le menu des cibles offre une saisie explicite d\'identifiant', () => {
  const src = lire(ECRAN);
  assert.ok(/const CIBLE_AUTRE_SITE = '__autre_site__';/.test(src),
    'la valeur sentinelle du menu a disparu');
  // L'option doit être ajoutée APRÈS la liste issue de la RLS, sinon elle ne
  // serait qu'un doublon décoratif d'un site déjà proposé.
  const bloc = src.slice(src.indexOf("selSite.innerHTML"), src.indexOf("selEmp.innerHTML"));
  assert.ok(bloc.includes('CIBLE_AUTRE_SITE'),
    'le menu `plgCodeCible` ne propose pas l\'option de saisie explicite');
});

t('le champ de saisie existe dans le formulaire', () => {
  const src = lire(ECRAN);
  assert.ok(/id="plgCodeCibleAutre"/.test(src),
    'le champ d\'identifiant de site n\'est pas dans le formulaire');
});

t('la valeur saisie est bien celle enregistrée', () => {
  const src = lire(ECRAN);
  const i = src.indexOf("document.getElementById('plgCodeAjouter').addEventListener");
  assert.ok(i > 0, 'le bouton « Ajouter » n\'a plus de gestionnaire');
  const bloc = src.slice(i, i + 3000);
  assert.ok(/const saisi = select\.value === CIBLE_AUTRE_SITE;/.test(bloc),
    'le gestionnaire ne distingue pas une cible saisie d\'une cible choisie');
  assert.ok(/saisi \? String\(champAutre\.value \|\| ''\)\.trim\(\)/.test(bloc),
    'la cible saisie n\'est pas lue dans `plgCodeCibleAutre`');
  // La sentinelle ne doit JAMAIS finir dans `planning_codes_sites` : elle y
  // vaudrait un site nommé « __autre_site__ », que la base refuserait sans
  // que personne comprenne pourquoi.
  assert.ok(!/dict\[cle\] = select\.value/.test(bloc),
    'la valeur brute du menu est enregistrée telle quelle');
});

t('une cible invisible est relue par le manager avant enregistrement', () => {
  const src = lire(ECRAN);
  const i = src.indexOf("document.getElementById('plgCodeAjouter').addEventListener");
  const bloc = src.slice(i, i + 3000);
  const j = bloc.indexOf('confirm(');
  assert.ok(j > 0, 'aucune confirmation avant d\'enregistrer un site non lisible');
  assert.ok(/if \(saisi && !confirm\(/.test(bloc),
    'la confirmation ne vise pas spécifiquement la saisie explicite');
  // Elle doit nommer les deux valeurs : un « êtes-vous sûr ? » nu n'apprend
  // rien de ce qui va être écrit.
  const message = bloc.slice(j, bloc.indexOf('\n', bloc.indexOf('))', j)));
  assert.ok(message.includes('${cle}') && message.includes('${cible}'),
    'la confirmation ne nomme pas le code et l\'identifiant du site');
});

t('la sentinelle du menu est vérifiée, pas supposée', () => {
  const src = lire(ECRAN);
  // `sites.site_id` n'a aucune contrainte de forme : la collision est
  // improbable, pas impossible. On exige qu'elle soit constatée.
  assert.ok(/SITES_CONNUS\.some\(s => s\.site_id === CIBLE_AUTRE_SITE\)/.test(src),
    'rien ne détecte un site portant l\'identifiant réservé');
});

// ── 2 · Le texte dit la règle réelle ──────────────────────────────────────

console.log('\n── 2 · Le texte affiché ne dit plus « ailleurs » sans condition ──');

t('un code de site ne signifie plus « travaillé ailleurs » par défaut', () => {
  const src = lire(ECRAN);
  const i = src.indexOf('Codes de site du classeur');
  assert.ok(i > 0, 'la section des codes de site a disparu');
  const bloc = src.slice(i, src.indexOf('id="plgCodes"'));
  assert.ok(!/7 heures travaillees <b[^>]*>ailleurs<\/b>/.test(bloc),
    'le texte affirme encore qu\'un code de site vaut 7 h ailleurs');
  // Les deux cas doivent être nommés : sur place et transfert.
  assert.ok(/sur place/.test(bloc), 'le cas « 7 h sur place » n\'est pas dit');
  assert.ok(/transfert/.test(bloc), 'le cas « transfert » n\'est pas dit');
  assert.ok(/anomalie/.test(bloc), 'le cas « code non déclaré = anomalie » n\'est pas dit');
});

t('le commentaire ne prétend plus que la cible ne se saisit jamais', () => {
  const src = lire(ECRAN);
  assert.ok(!/ne se saisit donc JAMAIS a la\s*\n?\s*main/.test(src),
    'le commentaire doctrinal contredit encore le comportement de l\'écran');
});

// ── 3 · La règle métier du moteur reste intacte ───────────────────────────

console.log('\n── 3 · Le moteur d\'import n\'a pas changé de doctrine ──');

t('un code visant le site importé vaut 7 h sur place, pas un transfert', () => {
  const src = lire(MOTEUR);
  assert.ok(/const horsSite = !siteId \|\| site !== siteId;/.test(src),
    'la distinction « même site » / « autre site » a disparu du moteur');
  assert.ok(/statut: horsSite \? 'transfert_site' : 'travail_normal'/.test(src),
    'le statut ne dépend plus du site visé');
});

t('un code non déclaré reste une anomalie, sans heures déduites', () => {
  const src = lire(MOTEUR);
  assert.ok(/anomalie\('code_site_non_mappe'/.test(src),
    'l\'anomalie « code de site non mappé » a disparu');
  const i = src.indexOf("anomalie('code_site_non_mappe'");
  const avant = src.slice(Math.max(0, i - 400), i);
  assert.ok(!/HEURES_AUTRE_SITE/.test(avant),
    'des heures sont déduites avant de déclarer l\'anomalie');
});

// ── Bilan ─────────────────────────────────────────────────────────────────

console.log(`\n${echecs === 0 ? '✅' : '❌'} ${passes} réussite(s), ${echecs} échec(s)\n`);
