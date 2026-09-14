#!/usr/bin/env node
// NEXUS — inventaire des écritures sur les tables dont la colonne `site` a
// pour valeur par défaut `'vito-sainte-marie'` (04/09/2026).
//
// 58 colonnes, sur 56 tables, portent en base ce DEFAULT — l'identifiant du
// site de production. Tout INSERT qui omet la colonne y atterrit donc. La RLS
// l'intercepte aujourd'hui (vérifié : l'écriture est refusée, elle n'est pas
// silencieusement déviée), mais le jour où une politique est assouplie, le
// défaut reprend la main sans que rien ne le signale.
//
// Ce script sert à préparer le retrait de ces défauts : il repère les
// écritures applicatives et distingue celles qui nomment explicitement le
// site de celles qui ne le nomment pas dans leur voisinage immédiat.
//
// C'est une HEURISTIQUE, pas une preuve : le site peut être porté par une
// variable construite plus haut. Chaque écriture signalée est à relire à la
// main — c'est l'objet du plan
// `docs/plans/2026-09-04-defauts-site-production.md`.
//
//   node outils/inventorier-ecritures-site.mjs
import fs from 'node:fs';
const TABLES = `carburant_releves coach_daily_recommendations coach_recommendation_events coach_rules
controles_stock employee_contraintes employee_indisponibilites employees fdj_alertes fdj_audit_log
fdj_booklets fdj_cash_controls fdj_corrections fdj_discrepancies fdj_games fdj_imported_history
fdj_locations fdj_recall_alerts fdj_releves_cloture fdj_reports fdj_shift_counts fdj_shifts
fdj_stock_movements fdj_stock_reference_lignes fdj_stock_references inventaire_alertes
inventaire_audit_log inventaire_categories inventaire_comptages inventaire_corrections
inventaire_lots inventaire_modes_controle inventaire_mouvements inventaire_plan_items
inventaire_plans_comptage inventaire_quarts inventaire_rapprochements inventaire_regles_produit
inventaire_seuils inventaire_ventes_import inventaire_zone_produit inventaire_zones
marge_exceptions mission_assignments mission_catalog mission_completions mission_progress
planning_regles_effectif planning_shifts pointages products produits_appel shifts stock_releves
stock_sante_historique`.split(/\s+/).filter(Boolean);

const fichiers = fs.readdirSync('.').filter(f =>
  (f.endsWith('.js') || f.endsWith('.html')) && !f.startsWith('test_'));

const resultats = [];
for (const f of fichiers) {
  const src = fs.readFileSync(f, 'utf8');
  for (const t of TABLES) {
    const re = new RegExp(`\\.from\\(['"\`]${t}['"\`]\\)([\\s\\S]{0,400}?)\\.(insert|upsert)\\(`, 'g');
    let m;
    while ((m = re.exec(src))) {
      const suite = src.slice(m.index, m.index + 900);
      const porteSite = /\bsite(_id)?\s*:/.test(suite) || /\bsite(_id)?\b\s*,/.test(suite);
      resultats.push({ fichier: f, table: t, operation: m[2], porteSite,
        ligne: src.slice(0, m.index).split('\n').length });
    }
  }
}
const sans = resultats.filter(r => !r.porteSite);
console.log(`${resultats.length} écritures repérées sur ${new Set(resultats.map(r=>r.table)).size} tables à défaut 'vito-sainte-marie'.`);
console.log(`${resultats.length - sans.length} portent explicitement le site ; ${sans.length} ne le portent PAS dans les 900 caractères suivants :\n`);
for (const r of sans) console.log(`  ${r.fichier}:${r.ligne}  ${r.table}.${r.operation}()`);
