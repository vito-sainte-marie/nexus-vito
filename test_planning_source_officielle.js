const assert = require('assert');
const fs = require('fs');

const manager = fs.readFileSync('NEXUS-Planning-v1.html', 'utf8');
const parametres = fs.readFileSync('NEXUS-Parametres-Station-v1.html', 'utf8');
const employe = fs.readFileSync('NEXUS-Mon-Planning-v1.html', 'utf8');
const paye = fs.readFileSync('NEXUS-Paye-v1.html', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260902201000_ajouter_source_planning_officiel.sql', 'utf8');

assert.ok(parametres.includes('id="cardPlanningOfficiel"') && parametres.includes('name="planningSource"'));
assert.ok(parametres.includes('planning_google_sheet_url') && parametres.includes('location.hash'));
assert.ok(manager.includes('Modifier dans Paramètres Station') && manager.includes('#cardPlanningOfficiel'));
assert.ok(!manager.includes('id="btnSauverSource"'));
assert.ok(manager.includes('source-google') && manager.includes('planning-nexus-card'));
assert.ok(employe.includes('Votre planning est sur Google Sheets') && employe.includes('Consulter mon planning'));
assert.ok(paye.includes('RAPPORT.planningOfficiel'));
assert.ok(migration.includes("check (planning_source in ('nexus','google_sheets'))"));
assert.ok(migration.includes('Ne pas confondre avec google_sheet_id'));

console.log('Source officielle du planning : parcours manager, employé et PAYE validés.');
