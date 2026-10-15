#!/usr/bin/env node
// Recette de nexus-lot-reconciler : les 12 scénarios du cahier des charges.
// Chaque scénario vérifie aussi qu'aucune clôture ni suppression injustifiée n'est proposée.
'use strict';

const assert = require('assert');
const R = require('../scripts/reconcilier.js');

const REGISTRE = { canaux: ['github-actions-claude', 'session-claude-habilitee', 'arbitre-chatgpt', 'frederic'], capacites: ['DEPOT_LECTURE', 'DEPOT_ECRITURE_RAIL', 'SUPABASE_PRODUCTION_LECTURE', 'PRODUCTION_FUSION_DEPLOIEMENT'] };

const fm = (o) => `---\n${Object.entries(o).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n`;
const req = (lot, seq, extra = '') => fm({ protocol: 'nexus-handoff/2', kind: 'request', lot_id: lot, seq, author: 'Claude', status: 'AWAITING_DECISION' }) + `# Demande ${seq}\n${extra}`;
const dec = (lot, seq, c) => fm({ protocol: 'nexus-handoff/2', kind: 'decision', lot_id: lot, seq, author: 'ChatGPT', decision: c.DECISION, closes: c.CLOSES }) +
  `# Décision\n\nNEXT_ACTION_CONTRACT\n${Object.entries(c).map(([k, v]) => `${k}: ${v}`).join('\n')}\n`;
const codes = r => r.anomalies.map(a => a.code);

const resultats = [];
function scenario(n, titre, f) {
  try { f(); resultats.push({ n, titre, ok: true }); }
  catch (e) { resultats.push({ n, titre, ok: false, erreur: e.message }); }
}

scenario(1, 'Lot ouvert et réellement inachevé', () => {
  const r = R.analyserLot('LOT-OUVERT-1', {
    'request-1.md': req('LOT-OUVERT-1', 1),
    'decision-1.md': dec('LOT-OUVERT-1', 1, { DECISION: 'APPROVED', CLOSES: 'false', EXECUTANT_NEXT: 'github-actions-claude', CAPACITE_REQUISE: 'DEPOT_ECRITURE_RAIL', ACTION_NEXT: 'écrire le module' }),
  }, { statut: 'DECISION_CONSOMMEE', derniere_decision: 'decision-1.md' }, REGISTRE);
  assert.strictEqual(r.statut_constate_handoff, 'EN_COURS');
  assert.deepStrictEqual(codes(r), []);
  assert.strictEqual(R.proposerNettoyage({ ref: 'LOT-OUVERT-1', type: 'lot', niveau: R.niveauPreuve({ code: true }).niveau }).action, 'AUCUNE');
});

scenario(2, 'Lot terminé avec preuves complètes', () => {
  const n = R.niveauPreuve({ code: true, tests: true, integration: true, environnement: true, criteres: { total: 3, satisfaits: 3 } });
  assert.strictEqual(n.niveau, 'A');
  const p = R.proposerNettoyage({ ref: 'LOT-FINI-1', type: 'issue', niveau: n.niveau, criteresRestants: [] });
  assert.strictEqual(p.action, 'FERMER_ISSUE');
  assert.strictEqual(p.autorite, 'arbitre');
  // Une proposition n'est pas une autorisation.
  assert.strictEqual(R.autoriser({ action: 'FERMER_ISSUE', objet: 'issue#77', environnement: 'github' }, []).autorise, false);
});

scenario(3, 'Lot annoncé terminé mais non testé', () => {
  const n = R.niveauPreuve({ code: true, tests: false, declaration: true, criteres: { total: 2, satisfaits: 2 } });
  assert.strictEqual(n.niveau, 'C');
  assert.strictEqual(R.proposerNettoyage({ ref: 'LOT-ANNONCE', type: 'issue', niveau: n.niveau }).action, 'AUCUNE');
});

scenario(4, 'Deux lots partiellement redondants', () => {
  const props = R.rapprocher([
    { lot: 'CARBURANTS-PERFORMANCE-AUDIT-COMMANDE-20260906', references_pr: [40] },
    { lot: 'CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906', references_pr: [40, 41] },
  ]);
  assert.ok(props.some(p => p.type === 'MEME_FAMILLE'));
  assert.ok(props.some(p => p.type === 'PR_PARTAGEE'));
  assert.ok(props.every(p => /à examiner/.test(p.conclusion)), 'un rapprochement reste une hypothèse');
});

scenario(5, 'Lot remplacé par une PR plus récente', () => {
  const complet = R.evaluerRemplacement({ criteres: ['executant ferme', 'capacite fermee'] }, { id: 'PR #123', niveau: 'A', criteres_couverts: ['executant ferme', 'capacite fermee'] });
  assert.strictEqual(complet.proposition, 'PROPOSER_CLOTURE_PAR_REMPLACEMENT');
  const partiel = R.evaluerRemplacement({ criteres: ['executant ferme', 'accuses de demarrage'] }, { id: 'PR #123', niveau: 'A', criteres_couverts: ['executant ferme'] });
  assert.strictEqual(partiel.proposition, 'GARDER_OUVERT');
  assert.deepStrictEqual(partiel.manque, ['accuses de demarrage']);
  const nonProuve = R.evaluerRemplacement({ criteres: ['x'] }, { id: 'PR #9', niveau: 'B', criteres_couverts: ['x'] });
  assert.strictEqual(nonProuve.proposition, 'GARDER_OUVERT');
});

scenario(6, 'Lot fermé alors que des actions restent à exécuter', () => {
  const r = R.analyserLot('LOT-CLOS-A-TORT', {
    'request-1.md': req('LOT-CLOS-A-TORT', 1),
    'decision-1.md': dec('LOT-CLOS-A-TORT', 1, { DECISION: 'APPROVED_WITH_CONDITIONS', CLOSES: 'true', EXECUTANT_NEXT: 'Claude', CAPACITE_REQUISE: 'écriture Git', ACTION_NEXT: 'rédiger la proposition' }),
  }, { statut: 'DECISION_CONSOMMEE', derniere_decision: 'decision-1.md' }, REGISTRE);
  assert.ok(codes(r).includes('H06_CLOTURE_AVEC_ACTION'));
  assert.ok(codes(r).includes('H04_EXECUTANT_HORS_REGISTRE'));
  assert.ok(codes(r).includes('H05_CAPACITE_HORS_REGISTRE'));
  assert.strictEqual(r.statut_constate_handoff, 'EN_COURS', 'une clôture qui masque une action reste en cours');
});

scenario(7, 'Canal permanent volontairement ouvert', () => {
  const p = R.proposerNettoyage({ ref: 'issue#28', type: 'issue', niveau: 'A', criteresRestants: [] });
  assert.strictEqual(p.action, 'AUCUNE');
});

scenario(8, 'Migration présente sur Test mais absente de Production', () => {
  const d = R.comparerMigrations(['20261001', '20261013140000'], ['20261001']);
  assert.deepStrictEqual(d.seulement_test, ['20261013140000']);
  assert.deepStrictEqual(d.seulement_production, []);
  assert.strictEqual(R.autoriser({ action: 'MODIFIER_MIGRATION', objet: '20261013140000', environnement: 'production' }, [{ action: 'MODIFIER_MIGRATION', objet: '20261013140000', environnement: 'production', par: 'arbitre' }]).autorise, false, 'une migration relève de Frédéric, pas de l\'arbitre');
});

scenario(9, 'Demande Handoff consommée mais encore signalée en attente', () => {
  const r = R.analyserLot('LOT-DESYNC', {
    'request-1.md': req('LOT-DESYNC', 1),
    'decision-1.md': dec('LOT-DESYNC', 1, { DECISION: 'APPROVED', CLOSES: 'false', EXECUTANT_NEXT: 'github-actions-claude', CAPACITE_REQUISE: 'DEPOT_ECRITURE_RAIL', ACTION_NEXT: 'continuer' }),
    'request-2.md': req('LOT-DESYNC', 2),
  }, { statut: 'DECISION_CONSOMMEE', derniere_decision: 'decision-1.md' }, REGISTRE);
  assert.ok(codes(r).includes('H10_CONSOMMEE_MAIS_DEMANDE_EN_VOL'));
  assert.strictEqual(r.statut_constate_handoff, 'ATTENTE_DECISION');
});

scenario(10, 'Lot inconnu faute d\'accès à une source', () => {
  const n = R.niveauPreuve({ sourceAccessible: false, code: true, tests: true });
  assert.strictEqual(n.niveau, 'D');
  assert.strictEqual(R.proposerNettoyage({ ref: 'LOT-X', type: 'lot', niveau: n.niveau }).action, 'AUCUNE');
});

scenario(11, 'Modification concurrente entre audit et nettoyage', () => {
  const v = R.verifierAvantEcriture({ tete: 'abc', etat: 'open', dependances: [] }, { tete: 'def', etat: 'open', dependances: [] });
  assert.strictEqual(v.poursuivre, false);
  assert.ok(/suspendre/.test(v.motif));
  assert.strictEqual(R.verifierAvantEcriture({ tete: 'abc', etat: 'open', dependances: [] }, { tete: 'abc', etat: 'open', dependances: [] }).poursuivre, true);
});

scenario(12, 'Tentative de nettoyage non autorisée', () => {
  const sansAuto = R.autoriser({ action: 'SUPPRIMER_BRANCHE', objet: 'claude/issue-28-x', environnement: 'github' }, []);
  assert.strictEqual(sansAuto.autorise, false);
  const mauvaisObjet = R.autoriser({ action: 'SUPPRIMER_BRANCHE', objet: 'claude/issue-28-x', environnement: 'github' }, [{ action: 'FERMER_ISSUE', objet: 'claude/issue-28-x', environnement: 'github', par: 'arbitre' }]);
  assert.strictEqual(mauvaisObjet.autorise, false, 'une autorisation de fermer une issue ne permet pas de supprimer la branche');
  const bon = R.autoriser({ action: 'SUPPRIMER_BRANCHE', objet: 'claude/issue-28-x', environnement: 'github' }, [{ action: 'SUPPRIMER_BRANCHE', objet: 'claude/issue-28-x', environnement: 'github', par: 'frederic', date: '2026-10-15' }]);
  assert.strictEqual(bon.autorise, true);
  assert.strictEqual(R.autoriser({ action: 'EFFACER_HISTORIQUE', objet: 'x', environnement: 'github' }, [{ action: 'EFFACER_HISTORIQUE', objet: 'x', environnement: 'github', par: 'frederic' }]).autorise, false, 'action interdite en permanence');
});

// Contrôle transversal : la section de preuve d'une décision à conditions.
scenario('12b', 'Contrôle complémentaire : demande sans section de preuve après une décision à conditions', () => {
  const r = R.analyserLot('LOT-PREUVE', {
    'request-1.md': req('LOT-PREUVE', 1),
    'decision-1.md': dec('LOT-PREUVE', 1, { DECISION: 'APPROVED_WITH_CONDITIONS', CLOSES: 'false', EXECUTANT_NEXT: 'github-actions-claude', CAPACITE_REQUISE: 'DEPOT_ECRITURE_RAIL', ACTION_NEXT: 'faire' }),
    'request-2.md': req('LOT-PREUVE', 2, '## Ce qui a été fait\n'),
  }, { statut: 'ATTENTE_DECISION', derniere_decision: 'decision-1.md' }, REGISTRE);
  assert.ok(codes(r).includes('H12_CONDITIONS_SANS_SECTION_DE_PREUVE'));
});

scenario('12c', 'Contrôle complémentaire : lot en exécution Handoff jamais proposé au nettoyage', () => {
  const p = R.proposerNettoyage({ ref: 'LOT-ACTIF', type: 'lot', niveau: 'A', criteresRestants: [], actif: true });
  assert.strictEqual(p.action, 'AUCUNE');
});

scenario('12d', 'Contrôle complémentaire : décisions appariées par in_reply_to, pas par numéro', () => {
  const d = dec('LOT-NUM', 2, { DECISION: 'APPROVED', CLOSES: 'true', EXECUTANT_NEXT: 'aucun', CAPACITE_REQUISE: 'AUCUNE', ACTION_NEXT: 'Matérialiser cette décision de clôture avec outils/handoff.js decision --auteur ChatGPT.' })
    .replace('closes: true', 'closes: true\nin_reply_to: request-3.md');
  const r = R.analyserLot('LOT-NUM', { 'request-1.md': req('LOT-NUM', 1), 'request-2.md': req('LOT-NUM', 2), 'request-3.md': req('LOT-NUM', 3),
    'decision-1.md': dec('LOT-NUM', 1, { DECISION: 'APPROVED', CLOSES: 'false', EXECUTANT_NEXT: 'github-actions-claude', CAPACITE_REQUISE: 'DEPOT_ECRITURE_RAIL', ACTION_NEXT: 'continuer' }),
    'decision-2.md': d }, { statut: 'DECISION_CONSOMMEE', derniere_decision: 'decision-2.md' }, REGISTRE);
  assert.ok(!codes(r).includes('H10_CONSOMMEE_MAIS_DEMANDE_EN_VOL'), 'request-3 est arbitrée par decision-2');
  assert.strictEqual(r.statut_constate_handoff, 'CLOS_DECLARE');
  assert.ok(!codes(r).includes('H06_CLOTURE_AVEC_ACTION'), 'une action de matérialisation n\'est pas une action restante');
});

const ko = resultats.filter(r => !r.ok);
for (const r of resultats) console.log(`${r.ok ? 'OK ' : 'KO '} ${String(r.n).padStart(3)} · ${r.titre}${r.ok ? '' : ` · ${r.erreur}`}`);
console.log(`\n${resultats.length - ko.length}/${resultats.length} scénarios passent.`);
process.exitCode = ko.length ? 1 : 0;
