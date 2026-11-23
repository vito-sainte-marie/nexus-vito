'use strict';
// Lot B : « Annuler une tournée » (Relevé employé, Suivi des contrôles, migration).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const D = __dirname;
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
const rel = fs.readFileSync(path.join(D, 'NEXUS-Dates-Courtes-Releve-v1.html'), 'utf8');
const suivi = fs.readFileSync(path.join(D, 'NEXUS-Dates-Courtes-v1.html'), 'utf8');
const mig = fs.readFileSync(path.join(D, 'supabase/migrations/20261124100000_dates_courtes_lot_b_annuler_tournee.sql'), 'utf8');
const scripts = p => [...p.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
const jsRel = scripts(rel), jsSuivi = scripts(suivi);

t('les deux scripts sont syntaxiquement valides', () => { new Function(jsRel); new Function(jsSuivi); });
t('Relevé : lien secondaire « Annuler la tournée » dans une zone à part, après « Terminer »', () => {
  const i = rel.indexOf('data-act="terminer"'), j = rel.indexOf('data-act="annuler"');
  assert.ok(i > 0 && j > i);
  assert.ok(rel.includes('class="rang zone-annul"') && /\.zone-annul\{margin-top:28px\}/.test(rel));
});
t('Relevé : écran de confirmation dans la page, sans confirm()', () => {
  assert.ok(!/\bconfirm\s*\(/.test(jsRel));
  ['Annuler cette tournée ?', 'Cette action est irréversible.', 'Annuler définitivement', 'Revenir à la tournée'].forEach(s => assert.ok(jsRel.includes(s), s));
});
t('Relevé : bouton inactif tant que le motif fait moins de 3 caractères, « Revenir » a le focus', () => {
  assert.ok(/id="btnAnnulOk" data-act="annuler-ok" disabled/.test(jsRel));
  assert.ok(/bt\.disabled=ch\.value\.trim\(\)\.length<3/.test(jsRel));
  assert.ok(/rb\.focus\(\)/.test(jsRel));
});
t('Relevé : jamais mise en file hors ligne, message de connexion', () => {
  const f = jsRel.slice(jsRel.indexOf('function annulerTournee'), jsRel.indexOf('/* ---------- Terminer'));
  assert.ok(!/empiler\(/.test(f));
  assert.ok(f.includes('Connexion nécessaire pour annuler une tournée'));
  assert.ok(f.includes("rpc('dates_courtes_annuler_tournee'") && f.includes('p_cle_idempotence'));
  assert.ok(f.includes("'Tournée annulée'"));
});
t('Relevé : ANNULEE connue, affichée en lecture seule avec auteur, heure, motif', () => {
  assert.ok(/ANNULEE/.test(jsRel) && /Annulée'\+\(t\.annulee_par_nom\?' par '/.test(jsRel) && /t\.annulee_a\?' à '/.test(jsRel) && /motif_annulation/.test(jsRel));
});
t('Suivi : ANNULEE en dernier rang, badge écrit, aucun emoji d\'état', () => {
  assert.ok(/ANNULEE:\{niv:'information', lib:'Annulée', rang:5\}/.test(jsSuivi));
  assert.ok(!/[\u{1F300}-\u{1FAFF}✅❌]/u.test(jsSuivi.slice(jsSuivi.indexOf('blocAnnulation'), jsSuivi.indexOf('async function annulerTourneeSv') + 1500)));
});
t('Suivi : lien secondaire, confirmation, motif obligatoire, pas de confirm()', () => {
  assert.ok(!/\bconfirm\s*\(/.test(jsSuivi.replace(/confirmer|Confirmer|data-confirmer|sv-conf/g, '')));
  ['data-annul-tournee', 'data-annul-ok', 'data-annul-retour', 'Annuler cette tournée ?', 'Annuler définitivement', 'Revenir à la tournée'].forEach(s => assert.ok(jsSuivi.includes(s), s));
  assert.ok(/'Tournée annulée · '/.test(jsSuivi));
});
t('Suivi : une tournée à certifier annulée sort du compteur, historique « Annulée par »', () => {
  assert.ok(/SV\.total = Math\.max\(0, SV\.total - 1\)/.test(jsSuivi));
  assert.ok(/case 'annulee'/.test(jsSuivi));
});
t('Suivi : lien d\'annulation réservé aux tournées annulables (ni certifiée, ni annulée)', () => {
  const i = jsSuivi.indexOf('data-annul-tournee');
  const ctx = jsSuivi.slice(Math.max(0, i - 700), i);
  assert.ok(/CERTIFIEE|ANNULEE/.test(ctx), 'condition d\'état avant le lien');
});
t('Migration : colonnes, état, fonction, droits', () => {
  ['annulee_le', 'annulee_par', 'motif_annulation', "'ANNULEE'", 'dates_courtes_annuler_tournee(uuid, text, text)'].forEach(s => assert.ok(mig.replace(/\s+/g, ' ').includes(s.replace(/\s+/g, ' ')) || mig.includes(s.replace(', ', ',')), s));
  assert.ok(/security definer set search_path = public, pg_temp/.test(mig));
  assert.ok(/grant execute on function dates_courtes_annuler_tournee\(uuid, ?text, ?text\) to authenticated/.test(mig));
  assert.ok(/revoke all on function dates_courtes_annuler_tournee\(uuid, ?text, ?text\) from public, anon, authenticated, service_role/.test(mig));
});
t('Migration : tous les codes d\'erreur attendus', () => {
  ['non_authentifie', 'compte_inactif', 'droit_refuse', 'cle_idempotence_requise', 'motif_invalide', 'introuvable', 'tournee_certifiee', 'tournee_interdite', 'etat_incompatible', 'demarque_active'].forEach(c => assert.ok(mig.includes(c + ' :'), c));
  assert.ok(mig.includes("'statut', 'deja_annulee'"), 'idempotence : statut deja_annulee');
});
t('Migration : aucune suppression de données, pas de touche au mécanisme de qualification', () => {
  assert.ok(!/\bdelete\s+from\s+dates_courtes/i.test(mig));
  assert.ok(!/qualification-ordre-migration-code|MIGRATIONS_REELLES/.test(mig));
});
console.log(n + ' tests OK');
