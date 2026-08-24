// Test — Couverture des quarts FDJ dans le rapport de Direction (23/08/2026,
// v2.225, audit "Anti-dégradation temporelle" §6 — "rapport hebdomadaire
// FDJ", dernier chantier de l'audit).
//
// Constat (vérifié directement contre le schéma Supabase) : la vue
// `view_fdj_daily_summary` exclut DÉJÀ les quarts en brouillon/non validés
// de `ca_grattage`/`nb_quarts_controles` (filtre SQL `caisse_comptabilisable`
// = statut_shift='valide' AND statut_caisse<>'provisoire') — le total
// affiché dans le rapport n'a donc jamais été faussé par du provisoire.
// Ce qui manquait, exactement comme demandé par l'audit ("Le rapport
// hebdomadaire... Le Brief peut signaler la couverture, ex. 8/10 quarts
// finalisés, sans pénaliser le score") : la TRANSPARENCE sur cette
// exclusion, nulle part visible avant ce lot.
//
// Ce test couvre les deux endroits où le rapport parle de FDJ :
//  1. `NexusRapportMoteur.construireChapitreSante` — l'axe FDJ du Chapitre
//     Santé (résumé compact, écran ET PDF).
//  2. `NexusRapportDirectionMoteur.construireChapitreFdj` — la section FDJ
//     détaillée du rapport de Direction (paragraphe `lectureNexus`).
// Dans les deux cas : rien n'apparaît quand la couverture est complète
// (Article 5 — ne jamais fabriquer une inquiétude), et la phrase de
// couverture apparaît, quantifiée, uniquement quand des quarts sont
// réellement exclus.

const assert = require('assert');

require(__dirname + '/nexus-rapport-moteur.js');
const S = global.NexusRapportMoteur;
require(__dirname + '/nexus-rapport-direction-moteur.js');
const D = global.NexusRapportDirectionMoteur;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) Chapitre Santé — axe FDJ (construireChapitreSante).
// ------------------------------------------------------------
{
  const chapitreSynthese = { ca: null, evolutionCa: null, marge: null, evolutionMargeTaux: null };

  // Couverture complète (10/10) : aucune phrase ajoutée, confiance 'reel'.
  const complet = S.construireChapitreSante(chapitreSynthese, {
    fdj: { disponible: true, caActuel: 1500, evolution: 0.1, jeuMoteur: { nom: 'Banco' }, nbQuartsControles: 10, nbQuartsTotal: 10 },
  });
  const axeFdjComplet = complet.axes.find(a => a.nom === 'FDJ');
  assert.ok(axeFdjComplet);
  assert.strictEqual(axeFdjComplet.confiance, 'reel');
  assert.ok(!axeFdjComplet.detail.includes('finalisé'), `aucune mention de couverture attendue quand tout est finalisé, obtenu: "${axeFdjComplet.detail}"`);
  ok('Chapitre Santé — couverture complète (10/10) : aucune phrase de couverture ajoutée, confiance "reel"');

  // Couverture incomplète (8/10, 2 non inclus) : phrase quantifiée,
  // confiance 'derive'.
  const incomplet = S.construireChapitreSante(chapitreSynthese, {
    fdj: { disponible: true, caActuel: 1200, evolution: -0.05, jeuMoteur: { nom: 'Banco' }, nbQuartsControles: 8, nbQuartsTotal: 10 },
  });
  const axeFdjIncomplet = incomplet.axes.find(a => a.nom === 'FDJ');
  assert.strictEqual(axeFdjIncomplet.confiance, 'derive');
  assert.ok(axeFdjIncomplet.detail.includes('8/10 quarts finalisés'), `phrase de couverture attendue, obtenu: "${axeFdjIncomplet.detail}"`);
  assert.ok(axeFdjIncomplet.detail.includes('2 non inclus'), `nombre de quarts exclus attendu, obtenu: "${axeFdjIncomplet.detail}"`);
  assert.ok(axeFdjIncomplet.detail.includes('en attente de validation'), 'vocabulaire exact de l\'audit §6 ("non inclus — en attente de validation")');
  ok('Chapitre Santé — couverture incomplète (8/10) : phrase quantifiée "8/10 quarts finalisés, 2 non inclus (en attente de validation)", confiance "derive"');

  // Champs absents (appelant non migré, ex. fdjActuel sans ces 2 champs) —
  // non-régression totale, jamais une exception.
  const sansChamps = S.construireChapitreSante(chapitreSynthese, {
    fdj: { disponible: true, caActuel: 900, evolution: 0.02, jeuMoteur: null },
  });
  const axeFdjSansChamps = sansChamps.axes.find(a => a.nom === 'FDJ');
  assert.ok(!axeFdjSansChamps.detail.includes('finalisé'));
  assert.strictEqual(axeFdjSansChamps.confiance, 'reel');
  ok('Chapitre Santé — nbQuartsControles/nbQuartsTotal absents -> non-régression totale, jamais une exception');
}

// ------------------------------------------------------------
// 2) Section FDJ détaillée (construireChapitreFdj).
// ------------------------------------------------------------
{
  const complet = D.construireChapitreFdj({ disponible: true, caActuel: 1500, evolution: 0.1, jeuMoteur: { nom: 'Banco' }, jeuxTop5: [], nbQuartsControles: 14, nbQuartsTotal: 14 });
  assert.strictEqual(complet.couvertureIncertaine, false);
  assert.ok(!complet.lectureNexus.includes('non inclus'), `aucune mention attendue, obtenu: "${complet.lectureNexus}"`);
  ok('construireChapitreFdj — couverture complète (14/14) : couvertureIncertaine=false, lectureNexus inchangée');

  const incomplet = D.construireChapitreFdj({ disponible: true, caActuel: 1200, evolution: -0.05, jeuMoteur: { nom: 'Banco' }, jeuxTop5: [], nbQuartsControles: 11, nbQuartsTotal: 14 });
  assert.strictEqual(incomplet.couvertureIncertaine, true);
  assert.ok(incomplet.lectureNexus.includes('11/14 quarts finalisés'), `phrase attendue, obtenu: "${incomplet.lectureNexus}"`);
  assert.ok(incomplet.lectureNexus.includes('3 quarts non inclus'), `nombre exact attendu, obtenu: "${incomplet.lectureNexus}"`);
  assert.ok(incomplet.lectureNexus.includes('en attente de validation manager'));
  assert.ok(incomplet.lectureNexus.includes('portée par Banco'), 'la phrase de lecture existante (jeu moteur) reste présente, la couverture s\'ajoute sans l\'écraser');
  ok('construireChapitreFdj — couverture incomplète (11/14) : couvertureIncertaine=true, phrase de couverture ajoutée à la suite de lectureNexus, jamais en remplacement');

  // Un seul quart non inclus -> accord singulier correct ("1 quart non
  // inclus", jamais "1 quarts").
  const unSeul = D.construireChapitreFdj({ disponible: true, caActuel: 500, evolution: null, jeuMoteur: null, jeuxTop5: [], nbQuartsControles: 13, nbQuartsTotal: 14 });
  assert.ok(unSeul.lectureNexus.includes('1 quart non inclus'), `accord singulier attendu, obtenu: "${unSeul.lectureNexus}"`);
  assert.ok(!unSeul.lectureNexus.includes('1 quarts'), 'jamais "1 quarts" (accord pluriel fautif)');
  ok('construireChapitreFdj — accord singulier correct pour un seul quart non inclus');

  // Secteur non disponible -> non-régression totale (comportement
  // historique inchangé).
  const indispo = D.construireChapitreFdj({ disponible: false, raison: 'Aucun quart FDJ contrôlé sur cette période.' });
  assert.strictEqual(indispo.disponible, false);
  assert.strictEqual(indispo.raison, 'Aucun quart FDJ contrôlé sur cette période.');
  ok('construireChapitreFdj — secteur indisponible : comportement historique inchangé');
}

console.log(`\n${n}/${n} tests passés — Couverture des quarts FDJ, rapport de Direction (v2.225).`);
