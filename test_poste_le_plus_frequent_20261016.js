// Poste le plus fréquent (lot B, 16/10/2026).
//
// Contrat gardé ici (sans réseau ; le comportement en base est prouvé par
// outils/epreuve-poste-le-plus-frequent-20261016/epreuve-test.sql, sous rollback) :
//  - la fonction SQL est une LECTURE : STABLE, SECURITY INVOKER, fermée à
//    anon, sans aucun INSERT/UPDATE/DELETE ;
//  - elle ne compte que les prises de poste confirmées (employe/manager),
//    sur 90 jours, hors fantôme de test, avec la liste blanche des postes,
//    seuil de 5, jamais de durée ni de proximité horaire ;
//  - l'écran n'affiche le badge que pour un poste dominant, sans
//    présélection, et un échec de lecture n'empêche rien ;
//  - rolesDisponibles() ne dépend pas du poste le plus fréquent.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const page = fs.readFileSync(path.join(RACINE, 'NEXUS-Prise-De-Poste-v1.html'), 'utf8');
const sql = fs.readFileSync(path.join(RACINE, 'supabase', 'migrations',
  '20261016120000_poste_le_plus_frequent.sql'), 'utf8');

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
const debutFn = sql.indexOf('create or replace function public.poste_le_plus_frequent(');
assert.ok(debutFn !== -1, 'fonction introuvable');
const FN = sql.slice(debutFn, sql.indexOf('$$;', sql.indexOf('as $$', debutFn)));
const SANS_COMMENTAIRE = FN.replace(/--[^\n]*/g, '');

let passes = 0;
function verifier(nom, cond) { assert.ok(cond, nom); passes++; console.log('OK — ' + nom); }

// ── Fonction SQL ──────────────────────────────────────────────────────────
verifier('fonction stable et SECURITY INVOKER', /\bstable\b/.test(FN) && /security invoker/.test(FN) && !/security definer/i.test(FN));
verifier('search_path figé', /set search_path = public/.test(FN));
verifier('lecture seule : aucune écriture',
  !/\b(insert\s+into|update\s+public|delete\s+from|truncate|create\s+temp)/i.test(SANS_COMMENTAIRE));
verifier('refuse sans authentification (42501)', /auth\.uid\(\)/.test(FN) && /v_appelant is null[\s\S]{0,120}42501/.test(FN));
verifier('fiche non accessible : 42501, pas de calcul partiel', /fiche non accessible' using errcode = '42501'/.test(FN));
verifier('manager et gérant : non applicable', /v_role in \('manager', 'gerant'\)[\s\S]{0,120}non_applicable/.test(FN));
verifier('fenêtre de 90 jours glissants', /now\(\) - interval '90 days'/.test(FN));
verifier('seuil de 5 prises éligibles', /v_total < 5/.test(FN));
verifier('statuts retenus : en_cours, clos_sans_pointage, termine uniquement',
  /s\.statut in \('en_cours', 'clos_sans_pointage', 'termine'\)/.test(FN) && !/legacy/.test(SANS_COMMENTAIRE));
verifier('confirmation exigée, auto exclu', /s\.confirmed_by in \('employe', 'manager'\)/.test(FN));
verifier('liste blanche des postes', /s\.role in \('pompiste', 'caissiere', 'renfort'\)/.test(FN));
verifier('site fantôme exclu', /site-fantome-test/.test(FN));
verifier('prises distinctes par (heure_debut, role), sans proximité horaire',
  /select distinct s\.heure_debut, s\.role/.test(FN) && !/interval '\d+ (minutes?|hours?)'/.test(FN));
verifier('on compte des quarts, jamais des durées',
  !/heure_fin|duree|extract\s*\(\s*epoch/i.test(SANS_COMMENTAIRE));
verifier('quatre états', ['dominant', 'aucune_dominante', 'historique_insuffisant', 'non_applicable'].every(e => FN.includes(`'${e}'`)));
verifier('droits : public et anon révoqués, authenticated accordé',
  /revoke all on function public\.poste_le_plus_frequent\(uuid\) from public;/.test(sql)
  && /revoke all on function public\.poste_le_plus_frequent\(uuid\) from anon;/.test(sql)
  && /grant execute on function public\.poste_le_plus_frequent\(uuid\) to authenticated;/.test(sql));
verifier('bloc de contrôle fail-closed', /do \$ctrl\$[\s\S]*has_function_privilege\('anon'/.test(sql));
verifier('une migration additive : aucune table, colonne ni politique touchée',
  !/\b(alter\s+table|create\s+table|create\s+policy|drop\s+policy|create\s+trigger)/i.test(sql.replace(/--[^\n]*/g, '')));

// ── Écran ─────────────────────────────────────────────────────────────────
const T_CHARGER = corps(page, 'async function chargerPosteFrequent(');
const T_NOTE = corps(page, 'function noteFrequence(');
const T_RENDER = corps(page, 'function renderChoixRole(');
const T_ROLES = corps(page, 'function rolesDisponibles(');

verifier('l\'écran appelle la fonction en lecture', /nexusClient\.rpc\('poste_le_plus_frequent'\)/.test(T_CHARGER));
verifier('un échec de lecture rend null : aucun badge, écran utilisable',
  /catch \(e\) \{\s*return null;/.test(T_CHARGER) && /if \(error \|\|/.test(T_CHARGER));
verifier('badge « Poste le plus fréquent — n sur N » pour le seul poste dominant',
  /pf && r\.value === pf\.poste/.test(T_RENDER) && /Poste le plus fréquent — \$\{pf\.retenus\} sur \$\{pf\.eligibles\}/.test(T_RENDER)
  && /posteFrequent\.etat === 'dominant'/.test(T_RENDER));
verifier('« Aucune dominante » et « Historique insuffisant » affichés',
  /Aucune dominante/.test(T_NOTE) && /Historique insuffisant/.test(T_NOTE));
verifier('managers (non_applicable) : rien d\'affiché', !/non_applicable/.test(T_NOTE) && /return '';\s*\}$/.test(T_NOTE));
verifier('aucune présélection : le rôle part de rien et vient du seul clic',
  /let roleChoisi = null;/.test(page) && (T_RENDER.match(/roleChoisi\s*=/g) || []).length === 1);
verifier('rolesDisponibles() ne dépend pas du poste fréquent', !/posteFrequent|poste_le_plus_frequent/.test(T_ROLES));
verifier('l\'ancien badge « Rôle habituel » a disparu', !/Rôle habituel/.test(page));

console.log(`\n${passes} vérifications OK`);
