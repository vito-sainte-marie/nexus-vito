#!/usr/bin/env node
// La bascule de source officielle a une date d'effet — 19/09/2026.
//
// CE QUI EST EN JEU. `v_planning_officiel` ne sert une journée que par la
// source applicable À CETTE DATE. Changer la source ne réécrit donc pas le
// passé : les journées antérieures restent servies par la source précédente.
// L'écran, lui, disait seulement « ✓ Google Sheets est le planning officiel »
// APRÈS coup. Le manager apprenait l'existence d'une date d'effet en
// constatant que son mois importé restait invisible.
//
// CE QUE CETTE ÉPREUVE EXIGE.
//   1. L'annonce est faite AVANT confirmation et en permanence, pas après.
//   2. La rétroactivité est possible, mais fermée par défaut, bornée au
//      passé, motivée, et récapitulée en toutes lettres — pas une case à
//      cocher.
//   3. Le message après publication décrit la visibilité RÉELLE, comptée,
//      et se tait plutôt que d'affirmer une visibilité qu'il n'a pas pu
//      vérifier.
//   4. Nexus Planner reste réservé au forfait Professional — mais le refus
//      est DIT avant la redirection.
//
// CE QU'ELLE NE JUGE PAS. Elle lit du texte. Que la base refuse réellement
// une date future ou un motif absent se prouve en transaction, pas ici ; ce
// fichier vérifie seulement que la migration porte ces refus et que l'écran
// ne les contourne pas.

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
// Ces ecrans ecrivent une partie de leurs libelles en echappements unicode
// (`\\u00e9`) A L'INTERIEUR des blocs `<script>` — le fichier en portait
// deja vingt-deux lignes avant ce lot, et le moteur JS les rend comme des
// accents. Une epreuve qui juge le TEXTE AFFICHE doit donc lire ce que le
// navigateur lit : chercher `metier` accentue brut echouerait sur du code
// parfaitement correct. (Verifie par ailleurs : zero echappement hors
// `<script>`, ou il s'afficherait tel quel.)
const lireTexte = f => lire(f).replace(/\\u([0-9a-fA-F]{4})/g,
  (_, h) => String.fromCharCode(parseInt(h, 16)));

const PARAMS = 'NEXUS-Parametres-Station-v1.html';
const PLANNING = 'NEXUS-Planning-v1.html';
const MIGRATION = path.join('supabase', 'migrations',
  '20260919260000_bascule_source_planning_date_effet.sql');
const MIGRATION_PREC = path.join('supabase', 'migrations',
  '20260919280000_source_precedente_a_la_date_d_effet.sql');

// ── 1 · La date d'effet est annoncée AVANT, pas après ─────────────────────

console.log('\n── 1 · Paramètres Station : l\'annonce précède la décision ──');

t('un emplacement permanent porte l\'annonce sous le choix de source', () => {
  const src = lire(PARAMS);
  assert.ok(/id="planningSourceEffet"/.test(src),
    'le bloc d\'annonce de la date d\'effet a disparu du formulaire');
  // Il doit être AVANT le bouton d'enregistrement : une annonce placée après
  // le geste ne serait qu'un compte rendu de plus.
  assert.ok(src.indexOf('id="planningSourceEffet"') < src.indexOf('id="planningSourceEnregistrer"'),
    'l\'annonce est placée après le bouton d\'enregistrement');
});

t('l\'annonce est rendue dès l\'affichage du choix, pas seulement au clic', () => {
  const src = lire(PARAMS);
  const i = src.indexOf('function afficherChoixSourcePlanning');
  assert.ok(i > 0, 'afficherChoixSourcePlanning a disparu');
  const bloc = src.slice(i, src.indexOf('\n  }', i));
  assert.ok(/rendreAnnonceEffet\(\);/.test(bloc),
    'le choix de source s\'affiche sans annoncer la date d\'effet');
});

t('l\'annonce nomme le jour métier de la station et le sort des jours antérieurs', () => {
  const src = lireTexte(PARAMS);
  const i = src.indexOf('function rendreAnnonceEffet');
  const bloc = src.slice(i, src.indexOf('function fermerRecapBascule', i));
  assert.ok(/Prendra effet le/.test(bloc), 'l\'annonce ne dit pas quand la bascule prend effet');
  assert.ok(/jour métier de votre station/.test(bloc),
    'l\'annonce ne dit pas que la date est celle de la station');
  assert.ok(/Les jours antérieurs continueront d/.test(bloc),
    'l\'annonce ne dit pas que les jours antérieurs gardent leur source');
  // Et elle doit nommer la source RÉELLEMENT en base, pas celle que les
  // boutons radio viennent d'afficher.
  assert.ok(/libelleSource\(sourceEnBase\)/.test(bloc),
    'l\'annonce nomme la source sélectionnée au lieu de la source enregistrée');
});

t('la source enregistrée est tenue à l\'écart des boutons radio', () => {
  const src = lire(PARAMS);
  assert.ok(/let sourceEnBase = 'nexus';/.test(src),
    'la variable de la source réellement enregistrée a disparu');
  assert.ok(/\n    sourceEnBase = configPlanning\.source;/.test(src),
    'la source enregistrée n\'est pas relue au chargement de la configuration');
  // Après une bascule, c'est `source_du_jour` qui fait foi : une bascule
  // rétroactive posée AVANT une bascule plus récente ne change pas
  // aujourd'hui.
  assert.ok(/sourceEnBase = compte\.source_du_jour \|\| compte\.source \|\| source;/.test(src),
    'la source du jour rendue par la base n\'est pas reprise après bascule');
});

t('le jour métier vient de la base, jamais de l\'horloge du navigateur', () => {
  const src = lire(PARAMS);
  const i = src.indexOf('async function chargerJourStation');
  assert.ok(i > 0, 'chargerJourStation a disparu');
  const bloc = src.slice(i, src.indexOf('function estRetroactive', i));
  assert.ok(/rpc\('planning_jour_de_ma_station', \{ p_site: employee\.site_id \}\)/.test(bloc),
    'le jour métier n\'est plus demandé à la base');
  assert.ok(!/new Date\(/.test(bloc),
    'un repli sur l\'horloge du navigateur a été réintroduit');
  // Fuseau manquant : la base lève 22004 et l'écran doit le DIRE, pas
  // inventer une date.
  assert.ok(/'22004'/.test(bloc), 'le fuseau manquant n\'est plus distingué des autres pannes');
  assert.ok(/jourStation = null;/.test(bloc),
    'une panne laisse un jour métier supposé au lieu de rien');
});

t('sans jour métier, la rétroactivité est fermée et dite indisponible', () => {
  const src = lireTexte(PARAMS);
  const i = src.indexOf('function rendreAnnonceEffet');
  const bloc = src.slice(i, src.indexOf('function fermerRecapBascule', i));
  assert.ok(/if \(!jourStation\) \{[\s\S]*?geste\.disabled = true;/.test(bloc),
    'le geste de rétroactivité reste offert sans jour métier connu');
  assert.ok(/el\.textContent = jourStationRefus;/.test(bloc),
    'la raison de l\'indisponibilité n\'est pas affichée');
});

// ── 2 · La rétroactivité est un geste explicite, pas une case ─────────────

console.log('\n── 2 · La rétroactivité se demande, se borne, se motive, se relit ──');

t('elle est fermée par défaut et s\'ouvre par un geste nommé', () => {
  const src = lire(PARAMS);
  assert.ok(/id="planningRetroChamps" hidden/.test(src),
    'les champs de rétroactivité sont ouverts d\'emblée');
  const i = src.indexOf('id="planningRetroOuvrir"');
  assert.ok(i > 0, 'le geste d\'ouverture a disparu');
  const ligne = src.slice(src.lastIndexOf('<', i), src.indexOf('\n', i));
  assert.ok(/date antérieure/.test(ligne),
    'le geste ne dit pas ce qu\'il va permettre');
  assert.ok(/aria-expanded/.test(ligne) && /aria-controls/.test(ligne),
    'le geste n\'annonce pas son état au lecteur d\'écran');
});

t('ce n\'est pas une case à cocher', () => {
  const src = lire(PARAMS);
  const i = src.indexOf('<div class="planning-source-retro">');
  const bloc = src.slice(i, src.indexOf('id="planningSourceEnregistrer"'));
  assert.ok(!/type="checkbox"/.test(bloc),
    'la rétroactivité est redevenue une simple case à cocher');
});

t('la date est bornée au passé — dans le champ ET dans le code', () => {
  const src = lire(PARAMS);
  assert.ok(/champDate\.max = jourStation;/.test(src),
    'le sélecteur de date n\'est plus borné au jour métier de la station');
  // `max` ne borne pas une saisie au clavier. Sans ce garde, une date future
  // retombait silencieusement sur le jour de la station : le manager aurait
  // cru programmer une bascule que personne n'aurait enregistrée.
  assert.ok(/function dateEffetFuture\(\) \{\s*\n\s*return !!\(basculeRetroDate && jourStation && basculeRetroDate > jourStation\);/.test(src),
    'rien ne détecte une date d\'effet future saisie au clavier');
  const i = src.indexOf('async function enregistrerSourcePlanning');
  const bloc = src.slice(i, src.indexOf("rpc('basculer_source_planning'", i));
  assert.ok(/if \(dateEffetFuture\(\)\) \{/.test(bloc),
    'une date future part quand même vers la base, ou pire, en repli silencieux');
});

t('un motif est exigé avant tout envoi lorsque la date est antérieure', () => {
  const src = lire(PARAMS);
  const i = src.indexOf('async function enregistrerSourcePlanning');
  const bloc = src.slice(i, src.indexOf("rpc('basculer_source_planning'", i));
  assert.ok(/if \(retro && !motif\) \{/.test(bloc),
    'une bascule rétroactive peut partir sans motif');
  // L'exigence doit aussi se VOIR dans l'étiquette du champ.
  assert.ok(/exigence\.textContent = estRetroactive\(\) \? '\(obligatoire\)' : '\(facultatif\)';/.test(src),
    'l\'étiquette du motif ne signale pas que le motif devient obligatoire');
});

t('le récapitulatif nomme les cinq éléments exigés', () => {
  const src = lire(PARAMS);
  for (const id of ['pscAncienne', 'pscNouvelle', 'pscEffet', 'pscRetro', 'pscMotif']) {
    assert.ok(src.includes(`id="${id}"`), `le récapitulatif ne porte plus ${id}`);
    assert.ok(new RegExp(`getElementById\\('${id}'\\)\\.textContent =`).test(src),
      `${id} n'est jamais renseigné`);
  }
  assert.ok(/id="planningSourceRecap" hidden/.test(src),
    'le récapitulatif est visible avant même qu\'une bascule soit demandée');
});

t('le récapitulatif attend un SECOND geste et ne ment jamais', () => {
  const src = lire(PARAMS);
  assert.ok(/if \(retro && !confirmee\) \{[\s\S]{0,400}afficherRecapBascule\(source, motif\);/.test(src),
    'une bascule rétroactive s\'enregistre sans relecture');
  assert.ok(/getElementById\('pscConfirmer'\)\.addEventListener\('click', \(\) => enregistrerSourcePlanning\(true\)\);/.test(src),
    'le bouton de confirmation n\'enclenche pas l\'enregistrement');
  // Changer de source ou de date APRÈS l'affichage rendrait le récapitulatif
  // mensonger : il doit se refermer.
  const handler = (depart) => {
    const i = src.indexOf(depart);
    assert.ok(i > 0, `handler introuvable : ${depart}`);
    const fin = src.indexOf('});', i);
    return src.slice(i, fin > 0 ? fin : i + 600);
  };
  const radio = handler("querySelectorAll('input[name=\"planningSource\"]')");
  assert.ok(/fermerRecapBascule\(\);/.test(radio),
    'changer de source laisse en place un récapitulatif devenu faux');
  const date = handler("getElementById('planningRetroDate').addEventListener");
  assert.ok(/fermerRecapBascule\(\);/.test(date),
    'changer de date laisse en place un récapitulatif devenu faux');
});

t('le récapitulatif dit que rétroagir ne publie rien', () => {
  const src = lireTexte(PARAMS);
  const i = src.indexOf('function afficherRecapBascule');
  const bloc = src.slice(i, src.indexOf('async function enregistrerSourcePlanning', i));
  assert.ok(/ne publie rien/.test(bloc),
    'le récapitulatif laisse croire qu\'une bascule rétroactive rend le passé visible');
  assert.ok(/importées et publiées/.test(bloc),
    'le récapitulatif ne rappelle pas la condition réelle de visibilité');
});

t('la date choisie est transmise à la base, et seulement quand elle est choisie', () => {
  const src = lire(PARAMS);
  assert.ok(/p_date_effet: retro \? basculeRetroDate : null,/.test(src),
    'la date d\'effet n\'est pas transmise, ou est transmise même sans choix');
});

// ── 3 · La migration porte les refus ──────────────────────────────────────

console.log('\n── 3 · La base refuse elle-même le futur et le motif absent ──');

t('la surcharge est évitée par un drop explicite', () => {
  const sql = lire(MIGRATION);
  const drop = sql.indexOf('drop function if exists public.basculer_source_planning(text, text, text);');
  const creation = sql.indexOf('create function public.basculer_source_planning(');
  assert.ok(drop > 0, 'l\'ancienne signature à trois arguments n\'est pas supprimée');
  assert.ok(creation > drop,
    'la nouvelle signature est créée avant la suppression : deux fonctions coexisteraient');
  // `create function` et non `create or replace` : si le drop n'avait pas eu
  // lieu, la migration échouerait bruyamment au lieu de laisser deux
  // surcharges vivre côte à côte.
  assert.ok(!/create or replace function public\.basculer_source_planning/.test(sql),
    'la création est idempotente : une surcharge survivante passerait inaperçue');
});

t('une date d\'effet future est refusée par la base', () => {
  const sql = lire(MIGRATION);
  const i = sql.indexOf('planning_source_periodes_normalise');
  const bloc = sql.slice(i, sql.indexOf('revoke all on function public.planning_source_periodes_normalise', i));
  assert.ok(/23514/.test(bloc), 'aucun refus contraint dans le garde-fou');
  assert.ok(/planning_jour_station/.test(bloc),
    'le futur est jugé à l\'horloge du serveur, pas au jour métier de la station');
});

t('une date antérieure sans motif est refusée par la base', () => {
  const sql = lire(MIGRATION);
  const i = sql.indexOf('planning_source_periodes_normalise');
  const bloc = sql.slice(i, sql.indexOf('revoke all on function public.planning_source_periodes_normalise', i));
  // Un motif d'espaces n'est pas un motif.
  assert.ok(/btrim\(/.test(bloc), 'un motif fait d\'espaces passerait pour un motif');
  assert.ok((bloc.match(/23514/g) || []).length >= 2,
    'le motif obligatoire n\'a pas son propre refus');
});

t('la fonction élargie reste fermée à public et anon', () => {
  const sql = lire(MIGRATION);
  assert.ok(/revoke all on function public\.basculer_source_planning\(text, text, text, date\) from public;/.test(sql),
    'revoke sur public manquant');
  assert.ok(/revoke all on function public\.basculer_source_planning\(text, text, text, date\) from anon;/.test(sql),
    'revoke sur anon manquant — un revoke sur public ne ferme pas anon');
  assert.ok(/grant execute on function public\.basculer_source_planning\(text, text, text, date\) to authenticated;/.test(sql),
    'le manager ne peut plus appeler la bascule');
});

// ── 4 · Après publication, le message décrit la visibilité réelle ─────────

console.log('\n── 4 · Nexus Planner : publier n\'est pas rendre visible ──');

t('l\'affirmation globale de visibilité a disparu', () => {
  const src = lireTexte(PLANNING);
  assert.ok(!/Mois publié — visible par l’équipe/.test(src),
    'le message annonce encore une visibilité qu\'il n\'a pas vérifiée');
});

t('deux comptages distincts mesurent le publié et le servi', () => {
  const src = lire(PLANNING);
  const i = src.indexOf('let publieesMois = null;');
  assert.ok(i > 0, 'le comptage des affectations publiées a disparu');
  const bloc = src.slice(i, src.indexOf('if (erreurPublication) {', i));
  assert.ok(/from\('planning_shifts'\)/.test(bloc), 'le publié n\'est plus compté');
  assert.ok(/from\('v_planning_officiel'\)/.test(bloc),
    'le servi n\'est plus compté sur la vue officielle');
  assert.ok((bloc.match(/count: 'exact', head: true/g) || []).length === 2,
    'les deux comptages ne sont pas des comptages exacts');
  // Mêmes bornes des deux côtés, sinon la différence ne veut rien dire.
  assert.ok((bloc.match(/\.eq\('publie', true\)/g) || []).length === 2,
    'les deux comptages ne portent pas tous deux sur le publié');
  assert.ok((bloc.match(/\.gte\('date', debut\)\.lt\('date', fin\)/g) || []).length === 2,
    'les deux comptages ne portent pas sur le même mois');
});

t('le message chiffre le publié, le visible et l\'écart', () => {
  const src = lireTexte(PLANNING);
  const i = src.indexOf('let publieesMois = null;');
  const bloc = src.slice(i, i + 4000);
  assert.ok(/const horsPeriode = Math\.max\(0, publieesMois - serviesMois\);/.test(bloc),
    'l\'écart entre publié et servi n\'est pas calculé');
  assert.ok(/\$\{publieesMois\} affectation\(s\) publiée\(s\)/.test(bloc),
    'le nombre d\'affectations publiées n\'est pas annoncé');
  assert.ok(/\$\{serviesMois\} visible\(s\) par l’équipe/.test(bloc),
    'le nombre d\'affectations réellement visibles n\'est pas annoncé');
  assert.ok(/if \(horsPeriode\) \{/.test(bloc),
    'les affectations hors période d\'application ne sont pas signalées');
  assert.ok(/date à partir de laquelle Google Sheets est la source officielle/.test(bloc),
    'la raison de l\'invisibilité — la date d\'effet — n\'est pas expliquée');
});

t('un comptage impossible ne devient jamais une affirmation de visibilité', () => {
  const src = lireTexte(PLANNING);
  const i = src.indexOf('let publieesMois = null;');
  const bloc = src.slice(i, i + 4000);
  assert.ok(/\} else if \(publieesMois === null\) \{/.test(bloc),
    'l\'échec du comptage n\'a pas de branche propre');
  const j = bloc.indexOf('publieesMois === null');
  const branche = bloc.slice(j, bloc.indexOf('} else {', j));
  assert.ok(/n’a pas pu vérifier/.test(branche),
    'NEXUS prétend savoir ce que l\'équipe voit alors qu\'il n\'a pas pu le mesurer');
  assert.ok(!/visible par l’équipe\.<\/div>/.test(branche),
    'la branche d\'échec affirme quand même une visibilité');
});

// ── 5 · Le refus de forfait est dit, pas subi ─────────────────────────────

console.log('\n── 5 · Le refus Professional s\'affiche avant la redirection ──');

t('la doctrine commerciale est inchangée : Essential n\'entre pas', () => {
  const src = lire(PLANNING);
  assert.ok(/NexusForfait\.estProfessional\(forfaitSite\)/.test(src),
    'la vérification du forfait a disparu de Nexus Planner');
  assert.ok(/window\.location\.href = retour;/.test(src),
    'la redirection vers l\'accueil a disparu');
  assert.ok(/forfait_requis/.test(src),
    'l\'accueil ne sera plus prévenu de rappeler la raison du renvoi');
});

t('une panne réseau ne bloque pas un manager légitime', () => {
  const src = lire(PLANNING);
  // `chargerForfait` rend `null` sur erreur : la doctrine de nexus-forfait.js
  // est de laisser passer plutôt que de fermer un écran par accident.
  assert.ok(/forfaitSite !== null && !NexusForfait\.estProfessional\(forfaitSite\)/.test(src),
    'un forfait indéterminé ferme désormais l\'écran');
});

t('le manager lit la raison avant que l\'écran ne disparaisse', () => {
  const src = lire(PLANNING);
  const i = src.indexOf('forfaitSite !== null');
  const bloc = src.slice(i, src.indexOf('setTimeout(() => { window.location.href = retour; }', i) + 200);
  assert.ok(/offre NEXUS Professional/.test(bloc), 'le refus ne nomme pas l\'offre requise');
  assert.ok(/echapperTexte\(libelleForfait\)/.test(bloc),
    'le forfait réel de la station n\'est pas nommé au manager');
  assert.ok(/y aller maintenant/.test(bloc),
    'le manager doit subir l\'attente sans pouvoir partir lui-même');
  assert.ok(/setTimeout\(\(\) => \{ window\.location\.href = retour; \}, \d{4,}\)/.test(bloc),
    'la redirection est immédiate : le message ne serait pas lu');
});

t('la redirection muette n\'est plus utilisée par cet écran', () => {
  const src = lire(PLANNING);
  assert.ok(!/nexusRequireProfessional\(/.test(src),
    'l\'écran retombe sur la redirection silencieuse');
});

// ── 6 · Le vocabulaire commercial affiché est celui des forfaits réels ────

console.log('\n── 6 · « Premium » n\'existe pas dans la grille NEXUS ──');

t('l\'en-tête et le pied de page annoncent Professional', () => {
  const src = lire(PLANNING);
  assert.ok(/<span class="badge-premium">Professional<\/span>/.test(src),
    'l\'en-tête annonce encore un forfait inexistant');
  assert.ok(/Nexus Planner v1 · Professional/.test(src),
    'le pied de page annonce encore un forfait inexistant');
  assert.ok(!/>Premium</.test(src), 'un libellé « Premium » subsiste à l\'écran');
});

t('le nom de la station n\'est plus codé en dur', () => {
  const src = lire(PLANNING);
  assert.ok(/id="footerStation"/.test(src), 'le pied de page ne porte plus le nom de la station');
  assert.ok(/nom_entreprise/.test(src),
    'le nom affiché ne vient pas de `sites.nom_entreprise`');
});

// ── 7 · La source précédente est celle de la date d'effet ────────────────

// Constaté en recette : une bascule au 12/09 s'est confirmée sous le libellé
// « Google Sheets (auparavant Google Sheets) » alors que la trace inscrite
// portait `source_precedente = 'nexus'`. La fonction nommait la source
// d'AUJOURD'HUI ; son trigger inscrivait celle de la DATE D'EFFET.

console.log('\n── 7 · Ce qui est annoncé est ce qui est inscrit ──');

t('la source précédente est projetée à la date d\'effet, pas lue au jour courant', () => {
  const sql = lire(MIGRATION_PREC);
  assert.ok(/v_precedente\s*:=\s*public\.source_planning_applicable\(p_site,\s*v_effet\);/.test(sql),
    'la source précédente ne vient pas de la projection à la date d\'effet');
  // Le défaut d'origine, mot pour mot : c'est cette lecture-là qui nommait
  // la source précédente. Elle ne doit plus alimenter que l'existence.
  assert.ok(!/select c\.planning_source into v_precedente/.test(sql),
    '`station_config.planning_source` nomme de nouveau la source précédente');
});

t('le calcul précède l\'insertion, sinon il se lirait lui-même', () => {
  const sql = lire(MIGRATION_PREC);
  const calcul = sql.indexOf('v_precedente := public.source_planning_applicable(');
  const insert = sql.indexOf('insert into public.planning_source_periodes');
  assert.ok(calcul > 0 && insert > 0, 'calcul ou insertion introuvable');
  assert.ok(calcul < insert,
    'la source précédente est calculée après l\'insertion : elle se nommerait elle-même');
  // Et après le calcul de la date d'effet, qu'elle projette.
  assert.ok(sql.indexOf('v_effet := coalesce(p_date_effet, v_jour);') < calcul,
    'la projection est calculée avant de connaître la date d\'effet');
});

t('« inchangée » se juge à la date d\'effet, pas sur le réglage du jour', () => {
  const sql = lire(MIGRATION_PREC);
  assert.ok(/'inchangee',\s*p_source is not distinct from v_precedente/.test(sql),
    'le drapeau compare encore la source du jour avant et après : une bascule '
    + 'rétroactive requalifiant des journées serait dite sans effet');
});

t('la correction ne crée pas de surcharge et ne rouvre aucun droit', () => {
  const sql = lire(MIGRATION_PREC);
  // Signature identique : `create or replace` est ici le geste juste, et un
  // `drop` ferait perdre les droits entre les deux ordres.
  assert.ok(/create or replace function public\.basculer_source_planning\(/.test(sql),
    'la fonction est recréée au lieu d\'être remplacée');
  assert.ok(!/drop function/.test(sql), 'un drop rouvrirait une fenêtre sans droits');
  assert.ok(/revoke all on function public\.basculer_source_planning\(text, text, text, date\) from anon;/.test(sql),
    'revoke sur anon manquant — un revoke sur public ne ferme pas anon');
  assert.ok(!/to anon;/.test(sql), 'un grant à anon a été introduit');
});

t('le récapitulatif ne nomme plus la source du jour comme ancienne source', () => {
  const src = lire(PARAMS);
  const i = src.indexOf('async function afficherRecapBascule');
  assert.ok(i > 0, 'afficherRecapBascule n\'interroge plus la base');
  const bloc = src.slice(i, src.indexOf('planningSourceRecap\').hidden = false;', i));
  assert.ok(!/pscAncienne'\)\.textContent = libelleSource\(sourceEnBase\)/.test(bloc),
    'le récapitulatif annonce de nouveau la source d\'aujourd\'hui');
  assert.ok(/sourceApplicableA\(basculeRetroDate\)/.test(bloc),
    'l\'ancienne source n\'est pas projetée à la date d\'effet choisie');
});

t('l\'écran demande la projection à la base au lieu de la recalculer', () => {
  const src = lire(PARAMS);
  assert.ok(/rpc\('source_planning_applicable'/.test(src),
    'l\'écran ne consulte pas l\'autorité de projection');
  // L'historique affiché est tronqué à douze lignes : le déduire donnerait
  // une réponse fausse sans le dire.
  const i = src.indexOf('async function sourceApplicableA');
  assert.ok(i > 0, 'la lecture de projection a disparu');
  const bloc = src.slice(i, src.indexOf('\n  }', i));
  assert.ok(/return null;/.test(bloc),
    'une lecture impossible rend une valeur : le récapitulatif nommerait une source inventée');
});

t('une projection illisible se dit, elle ne se devine pas', () => {
  const src = lireTexte(PARAMS);
  assert.ok(/Indisponible — lecture impossible pour le moment/.test(src),
    'aucune mention honnête quand la source précédente n\'a pas pu être lue');
});

t('le récapitulatif est attendu avant que la main soit rendue', () => {
  const src = lire(PARAMS);
  assert.ok(/await afficherRecapBascule\(source, motif\);/.test(src),
    'le récapitulatif n\'est pas attendu : il s\'afficherait après le retour');
});

// ── Bilan ─────────────────────────────────────────────────────────────────

console.log(`\n${echecs === 0 ? '✅' : '❌'} ${passes} réussite(s), ${echecs} échec(s)\n`);
