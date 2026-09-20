const assert = require('assert');
const fs = require('fs');

const manager = fs.readFileSync('NEXUS-Planning-v1.html', 'utf8');
const parametres = fs.readFileSync('NEXUS-Parametres-Station-v1.html', 'utf8');
const employe = fs.readFileSync('NEXUS-Mon-Planning-v1.html', 'utf8');
const paye = fs.readFileSync('NEXUS-Paye-v1.html', 'utf8');
// Retrouvée par son NOM : depuis la récupération de l'historique complet
// (04/09/2026), les numéros de version sont ceux enregistrés par Supabase.
const migration = (() => {
  const d = 'supabase/migrations';
  const f = fs.readdirSync(d).filter(x => x.includes('ajouter_source_planning_officiel') && x.endsWith('.sql')).sort().pop();
  if (!f) throw new Error('migration ajouter_source_planning_officiel introuvable');
  return fs.readFileSync(`${d}/${f}`, 'utf8');
})();

assert.ok(parametres.includes('id="cardPlanningOfficiel"') && parametres.includes('name="planningSource"'));
assert.ok(parametres.includes('planning_google_sheet_url') && parametres.includes('location.hash'));
assert.ok(manager.includes('Modifier dans Paramètres Station') && manager.includes('#cardPlanningOfficiel'));
assert.ok(!manager.includes('id="btnSauverSource"'));
assert.ok(manager.includes('source-google') && manager.includes('planning-nexus-card'));
// Point 1 du mandat du 19/09/2026. Cette assertion exigeait autrefois que
// l'ecran employe affiche « Votre planning est sur Google Sheets » et un
// bouton « Consulter mon planning » : elle encodait le court-circuit, c'est-a-dire
// le defaut. Google Sheets est une source d'ENTREE ; apres import et
// publication, `v_planning_officiel` est la seule version consommable, ici
// comme ailleurs. L'epreuve juge donc le contrat inverse : l'employe lit la
// projection publiee, et le classeur ne subsiste qu'en encart SECONDAIRE.
assert.ok(!employe.includes('Votre planning est sur Google Sheets'), 'Mon Planning court-circuite de nouveau la projection publiee.');
assert.ok(employe.includes("from('v_planning_officiel')"), 'Mon Planning ne lit plus la projection officielle.');
assert.ok(employe.includes('id="sourceEntree"') && employe.includes('Le planning ci-dessus est la version publi'));
// L'encart vit SOUS le planning : son marqueur vient apres dans le document.
assert.ok(employe.indexOf('id="sourceEntree"') > employe.indexOf('id="monPlanning"'));
// Et il n'interrompt rien : aucun `return` entre la detection de la source
// d'entree et la fin de son bloc, sans quoi le chargement serait saute.
const blocSource = employe.slice(employe.indexOf("planning_source === 'google_sheets'"), employe.indexOf("const TACHE_LABEL"));
assert.ok(blocSource.length > 0 && !blocSource.includes('return'), 'Le bloc Google Sheets interrompt de nouveau le chargement du planning.');
assert.ok(paye.includes('RAPPORT.planningOfficiel'));
assert.ok(migration.includes("check (planning_source in ('nexus','google_sheets'))"));
assert.ok(migration.includes('Ne pas confondre avec google_sheet_id'));

console.log('Source officielle du planning : parcours manager, employé et PAYE validés.');
