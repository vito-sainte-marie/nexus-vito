// Poste le plus fréquent (lot B, 16/10/2026).
//
// Contrat gardé ici (sans réseau ; le comportement en base est prouvé par
// outils/epreuve-poste-le-plus-frequent-20261016/epreuve-test.sql, sous rollback) :
//  - la fonction SQL est une LECTURE : STABLE, SECURITY INVOKER, fermée à
//    anon, sans aucun INSERT/UPDATE/DELETE ;
//  - elle ne compte que les prises de poste confirmées (employe/manager),
//    sur 90 jours, hors fantôme de test, avec la liste blanche des postes,
//    seuil de 5, jamais de durée ni de proximité horaire ;
//  - lot C (16/10/2026) : la migration 20261016150000 remplace la fonction ;
//    de 1 à 4 prises, état `dernier_poste` (le dernier poste pris, mêmes
//    filtres) ; 0 prise, `historique_insuffisant` ; 5 et plus inchangé ;
//  - l'écran affiche un badge sous le seul rôle concerné (« Poste le plus
//    fréquent, n sur N » ou « Dernier poste »), rien d'autre, sans
//    présélection ni tiret cadratin, et un échec de lecture n'empêche rien ;
//  - rolesDisponibles() ne dépend pas du poste le plus fréquent.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const page = fs.readFileSync(path.join(RACINE, 'NEXUS-Prise-De-Poste-v1.html'), 'utf8');
const sql = fs.readFileSync(path.join(RACINE, 'supabase', 'migrations',
  '20261016150000_poste_dernier_sous_seuil.sql'), 'utf8');

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
verifier('cinq états', ['dominant', 'aucune_dominante', 'dernier_poste', 'historique_insuffisant', 'non_applicable'].every(e => FN.includes(`'${e}'`)));
verifier('aucune prise : historique insuffisant ; 1 à 4 : dernier poste',
  /if v_total = 0 then\s*return query select null::text, 0, 0, 'historique_insuffisant'/.test(FN)
  && /elsif v_total < 5 then[\s\S]*?'dernier_poste'/.test(FN));
const DERNIER = FN.slice(FN.indexOf('elsif v_total < 5'), FN.indexOf("'dernier_poste'"));
verifier('le dernier poste applique les mêmes filtres que le comptage',
  ["interval '90 days'", 'site-fantome-test', "s.statut in ('en_cours', 'clos_sans_pointage', 'termine')",
   "s.confirmed_by in ('employe', 'manager')", "s.role in ('pompiste', 'caissiere', 'renfort')"].every(f => DERNIER.includes(f))
  && /order by s\.heure_debut desc/.test(DERNIER));
verifier('contrôle de fin : la définition installée connaît dernier_poste', /v_def !~ 'dernier_poste'/.test(sql));
verifier('droits : public et anon révoqués, authenticated accordé',
  /revoke all on function public\.poste_le_plus_frequent\(uuid\) from public;/.test(sql)
  && /revoke all on function public\.poste_le_plus_frequent\(uuid\) from anon;/.test(sql)
  && /grant execute on function public\.poste_le_plus_frequent\(uuid\) to authenticated;/.test(sql));
verifier('bloc de contrôle fail-closed', /do \$ctrl\$[\s\S]*has_function_privilege\('anon'/.test(sql));
verifier('une migration additive : aucune table, colonne ni politique touchée',
  !/\b(alter\s+table|create\s+table|create\s+policy|drop\s+policy|create\s+trigger)/i.test(sql.replace(/--[^\n]*/g, '')));

// ── Écran ─────────────────────────────────────────────────────────────────
const T_CHARGER = corps(page, 'async function chargerPosteFrequent(');
const T_LIB = corps(page, 'function libelleFrequence(');
const T_RENDER = corps(page, 'function renderChoixRole(');
const T_ROLES = corps(page, 'function rolesDisponibles(');

verifier('l\'écran appelle la fonction en lecture', /nexusClient\.rpc\('poste_le_plus_frequent'\)/.test(T_CHARGER));
verifier('un échec de lecture rend null : aucun badge, écran utilisable',
  /catch \(e\) \{\s*return null;/.test(T_CHARGER) && /if \(error \|\|/.test(T_CHARGER));
verifier('dominant : « Poste le plus fréquent, n sur N »',
  /pf\.etat === 'dominant'\) return `Poste le plus fréquent, \$\{pf\.retenus\} sur \$\{pf\.eligibles\}`/.test(T_LIB));
verifier('1 à 4 prises : « Dernier poste »', /pf\.etat === 'dernier_poste'\) return 'Dernier poste'/.test(T_LIB));
verifier('égalité, aucun historique, manager, état inconnu : rien',
  !/aucune_dominante|historique_insuffisant|non_applicable/.test(T_LIB) && /return '';\s*\}$/.test(T_LIB)
  && !/Aucune dominante|Historique insuffisant/.test(page));
verifier('le badge se pose sous le seul rôle concerné',
  /const badge = libelleFrequence\(posteFrequent\)/.test(T_RENDER) && /badge && r\.value === posteFrequent\.poste/.test(T_RENDER));
verifier('aucun tiret cadratin dans le badge', !/—/.test(T_LIB) && !/role-suggestion">[^<]*—/.test(page));
verifier('aucune présélection : le rôle part de rien et vient du seul clic',
  /let roleChoisi = null;/.test(page) && (T_RENDER.match(/roleChoisi\s*=/g) || []).length === 1);
verifier('rolesDisponibles() ne dépend pas du poste fréquent', !/posteFrequent|poste_le_plus_frequent/.test(T_ROLES));
verifier('l\'ancien badge « Rôle habituel » a disparu', !/Rôle habituel/.test(page));

console.log(`\n${passes} vérifications OK`);
