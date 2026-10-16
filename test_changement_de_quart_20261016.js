// Changement de quart et continuité du service (16/10/2026, option A).
//
// Contrat gardé ici (sans réseau ; la preuve de comportement en base est
// faite par outils/verifier-changement-de-quart.sql, sous begin … rollback) :
//  - choisir une fonction n'écrit rien ; seule la confirmation volontaire
//    clôture ;
//  - l'avertissement n'apparaît que si le SERVEUR signale un quart ouvert,
//    et dit que la clôture est définitive ;
//  - annuler n'écrit rien ;
//  - le motif est facultatif, jamais imposé, et transmis tel que déclaré ;
//  - un échec laisse le bouton réutilisable et ne simule aucun succès ;
//  - la fonction SQL est atomique, SECURITY INVOKER, fermée à anon, et
//    n'invente jamais d'heure de fin.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const page = fs.readFileSync(path.join(RACINE, 'NEXUS-Prise-De-Poste-v1.html'), 'utf8');
const sql = fs.readFileSync(path.join(RACINE, 'supabase', 'migrations',
  '20261016090000_changement_de_quart_atomique.sql'), 'utf8');

function corps(source, debut) {
  const i = source.indexOf(debut);
  assert.ok(i !== -1, `${debut} introuvable`);
  let profondeur = 0, commence = false;
  for (let k = source.indexOf('{', i); k < source.length; k++) {
    if (source[k] === '{') { profondeur++; commence = true; }
    else if (source[k] === '}') { profondeur--; }
    if (commence && profondeur === 0) return source.slice(i, k + 1);
  }
  throw new Error(`${debut} non refermée`);
}
function fonctionSql(nom) {
  const i = sql.indexOf(`function public.${nom}(`);
  assert.ok(i !== -1, `${nom} introuvable`);
  return sql.slice(i, sql.indexOf('$$;', sql.indexOf('as $$', i)));
}

const T_APPEL = corps(page, 'async function appelerChangementDeQart(');
const T_CONFIRMATION = corps(page, 'function renderConfirmationChangement(');
const T_TERMINER = corps(page, 'async function terminerPriseDePoste(');
const T_CONFIRMER = corps(page, 'async function confirmerPriseDePoste()');
const T_AVANT = fonctionSql('nexus_shifts_avant_insertion');
const T_CHANGER = fonctionSql('nexus_changer_de_quart');

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

console.log('— Écran : aucune écriture avant confirmation —');

verifier('la page n\'écrit plus dans shifts directement', () => {
  assert.ok(!/from\('shifts'\)\s*\.insert/.test(page), 'insert direct dans shifts');
  assert.ok(!/from\('shifts'\)\s*\.update/.test(page), 'update direct dans shifts');
});
verifier('le premier appel part avec p_cloture_confirmee = false', () => {
  assert.ok(/appelerChangementDeQart\(false,\s*null\)/.test(T_CONFIRMER));
  assert.ok(/p_cloture_confirmee:\s*!!confirmee/.test(T_APPEL));
});
verifier('l\'avertissement n\'est affiché que sur la réponse confirmation_requise du serveur', () => {
  assert.ok(/code\s*===\s*'confirmation_requise'/.test(T_CONFIRMER));
  assert.ok(/renderConfirmationChangement\(reponse\.data\.quart_ouvert\)/.test(T_CONFIRMER));
  assert.ok(!/renderConfirmationChangement/.test(T_TERMINER));
});
verifier('l\'avertissement dit : définitif, non rouvrable, même opération, échec = quart conservé, missions conservées', () => {
  assert.ok(/clôturé définitivement/.test(T_CONFIRMATION));
  assert.ok(/ne pourrez pas le rouvrir/.test(T_CONFIRMATION));
  assert.ok(/même opération/.test(T_CONFIRMATION));
  assert.ok(/reste ouvert/.test(T_CONFIRMATION));
  assert.ok(/missions et justificatifs/.test(T_CONFIRMATION));
});
verifier('seul le bouton de confirmation renvoie p_cloture_confirmee = true', () => {
  const vrais = page.match(/appelerChangementDeQart\(true/g) || [];
  assert.strictEqual(vrais.length, 1, 'un seul appel confirmé attendu');
  assert.ok(/btnConfirmerChangement'\)\.addEventListener\('click'/.test(T_CONFIRMATION));
  assert.ok(/appelerChangementDeQart\(true,\s*motif\)/.test(T_CONFIRMATION));
});
verifier('annuler n\'écrit rien et revient au résumé', () => {
  const m = T_CONFIRMATION.match(/btnAnnulerChangement'\)\.addEventListener\('click',\s*\(\)\s*=>\s*([^)]*\)?)\)/);
  assert.ok(m, 'gestionnaire Annuler introuvable');
  assert.ok(/renderResume\(\)/.test(m[1]));
  assert.ok(!/rpc\(|appelerChangementDeQart/.test(m[1]));
});
verifier('choisir une fonction n\'appelle pas la base', () => {
  const choix = page.indexOf('roleChoisi =');
  assert.ok(choix !== -1);
  assert.ok(!/appelerChangementDeQart|\.rpc\(/.test(corps(page, 'function renderResume(')));
});

console.log('— Écran : motif facultatif, jamais imposé —');

verifier('« Aucun motif » est le choix par défaut et part en null', () => {
  assert.ok(/<option value="">Aucun motif<\/option>/.test(T_CONFIRMATION));
  assert.ok(/let motif = null;/.test(T_CONFIRMATION));
  assert.ok(/p_motif:\s*motif \|\| null/.test(T_APPEL));
});
verifier('« Relève absente ou en retard » et « Autre motif justifié » sont proposés, limités à 200 caractères', () => {
  assert.ok(/MOTIF_RELEVE = 'Relève absente ou en retard'/.test(page));
  assert.ok(/Autre motif justifié/.test(T_CONFIRMATION));
  assert.ok(/maxlength="200"/.test(T_CONFIRMATION));
});
verifier('le bouton de confirmation ne dépend d\'aucun motif', () => {
  assert.ok(!/disabled\s*=\s*!?\s*sel\.value|if \(!motif\)|motif obligatoire/i.test(T_CONFIRMATION));
});

console.log('— Écran : échec, FDJ et fonctions du lot A —');

verifier('une erreur n\'ouvre pas le FDJ, ne simule aucun succès et réactive le bouton', () => {
  const echec = T_TERMINER.slice(0, T_TERMINER.indexOf('ouvrirQuartFdjDepuisPriseDePoste'));
  assert.ok(/error \|\| !data \|\| data\.ok !== true/.test(echec));
  assert.ok(/reactiver\(\)/.test(echec) && /return;/.test(echec));
  assert.ok(/Votre quart en cours n\\'a pas été modifié/.test(echec));
  assert.ok(!/renderFinal/.test(echec));
});
verifier('le quart FDJ est ouvert depuis l\'identifiant renvoyé par la fonction', () => {
  assert.ok(/ouvrirQuartFdjDepuisPriseDePoste\(data\.prise_de_poste_id\)/.test(T_TERMINER));
});
verifier('rolesDisponibles() du lot A est inchangée', () => {
  const t = corps(page, 'function rolesDisponibles(');
  assert.ok(/manager/i.test(t));
  assert.ok(!/nexus_changer_de_quart|confirmation_requise/.test(t));
});

console.log('— Base : atomicité, droits, audit, pas de durée inventée —');

verifier('une seule fonction SQL fait la clôture et l\'ouverture (aucun UPDATE de shifts dans la RPC)', () => {
  assert.ok(/insert into public\.shifts/.test(T_CHANGER));
  assert.ok(!/update public\.shifts/.test(T_CHANGER));
  assert.ok(!/\bcommit\b/i.test(T_CHANGER));
});
verifier('la fonction est SECURITY INVOKER (RLS de l\'employé), fermée à anon, ouverte à authenticated', () => {
  assert.ok(/security invoker/.test(T_CHANGER));
  assert.ok(!/security definer/i.test(sql.replace(/prosecdef/g, '').replace(/SECURITY DEFINER —/g, '')));
  assert.ok(/revoke all on function public\.nexus_changer_de_quart\(text, text, text, boolean\) from anon;/.test(sql));
  assert.ok(/grant execute on function public\.nexus_changer_de_quart\(text, text, text, boolean\) to authenticated;/.test(sql));
});
verifier('l\'employé est lu dans la session (auth.uid()), jamais dans un paramètre', () => {
  assert.ok(/v_uid\s+uuid := auth\.uid\(\)/.test(T_CHANGER));
  assert.ok(!/p_employee|p_employe_id/.test(T_CHANGER));
});
verifier('sans confirmation, un quart ouvert ne produit aucune écriture', () => {
  const avantInsert = T_CHANGER.slice(0, T_CHANGER.indexOf('insert into public.shifts'));
  assert.ok(/'confirmation_requise'/.test(avantInsert));
  assert.ok(/v_a_clore and not coalesce\(p_cloture_confirmee, false\)[\s\S]*?return jsonb_build_object/.test(avantInsert));
  assert.ok(!/insert |update |delete /i.test(avantInsert));
});
verifier('les variables de transaction sont locales (set_config … true) et remises à zéro', () => {
  const posees = T_CHANGER.match(/set_config\('nexus\.changement_quart_(?:employe|motif)',[^;]*?,\s*true\)/g) || [];
  assert.ok(posees.length >= 4, 'posées puis remises à zéro dans la fonction');
  assert.ok(!/set_config\([^)]*,\s*false\)/.test(sql), 'set_config non local interdit');
  assert.ok(/set_config\('nexus\.changement_quart_employe', '', true\)/.test(T_AVANT));
  assert.ok(/set_config\('nexus\.changement_quart_motif', '', true\)/.test(T_AVANT));
});
verifier('le déclencheur ne croit la variable que si elle désigne l\'employé qui s\'insère', () => {
  assert.ok(/current_setting\('nexus\.changement_quart_employe', true\)[\s\S]{0,40}=\s*NEW\.employee_id::text/.test(T_AVANT));
});
verifier('audit à trois dimensions : auteur, mécanisme, motif déclaré', () => {
  assert.ok(/v_source := 'employe'/.test(T_AVANT));
  assert.ok(/v_par\s+:= NEW\.employee_id/.test(T_AVANT));
  assert.ok(/cloture_par\s+= v_par/.test(T_AVANT));
  assert.ok(/cloture_source = v_source/.test(T_AVANT));
  assert.ok(/nullif\(btrim\(coalesce\(current_setting\('nexus\.changement_quart_motif'/.test(T_AVANT));
});
verifier('le motif n\'est jamais mélangé au texte système quand l\'employé a clôturé', () => {
  const marches = T_AVANT.match(/if not v_declare then\s+v_motif :=/g) || [];
  assert.strictEqual(marches.length, 3, 'chaque texte système est gardé par « if not v_declare »');
});
verifier('sans variable, le comportement P-1 est conservé (source prise_de_poste_suivante, auteur nul)', () => {
  assert.ok(/v_source := 'prise_de_poste_suivante'/.test(T_AVANT));
  assert.ok(/v_par\s+:= null/.test(T_AVANT));
});
verifier('aucune durée travaillée ni heure supplémentaire : heure_fin NULL sauf départ pointé lu', () => {
  assert.ok(/heure_fin\s+= null/.test(T_AVANT));
  assert.ok(/heure_fin\s+= v_fin/.test(T_AVANT));
  assert.ok(!/heure_fin\s+= NEW\.heure_debut/.test(T_AVANT));
  assert.ok(!/heure_fin\s+= now\(\)/.test(T_AVANT));
  assert.ok(!/heures_sup|overtime|duree_travaill/i.test(sql.replace(/^--.*$/gm, '')));
});
verifier('la migration n\'écrit aucune ligne hors de la fonction', () => {
  const hors = sql.replace(/^--.*$/gm, '').replace(/\$\$[\s\S]*?\$\$/g, '').replace(/\$ctrl\$[\s\S]*?\$ctrl\$/g, '');
  assert.ok(!/\b(insert into|update|delete from|truncate)\b/i.test(hors));
});
verifier('la migration refuse de s\'installer sans les contrôles de fin (fail-closed)', () => {
  assert.ok(/do \$ctrl\$/.test(sql));
  assert.ok(/raise exception 'Changement de quart interrompu/.test(sql));
});

console.log(`\n${passes} vérifications passées.`);
