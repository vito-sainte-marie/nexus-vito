#!/usr/bin/env node
// Recette du diagnostic standard : les deux incidents réels (10/10 et 15/10)
// doivent être conformes, et chaque mutation d'un défaut connu doit être refusée.
'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { valider } = require('../scripts/valider-diagnostic.js');

// Contexte : celui du dépôt quand on y tourne ; sinon un contexte figé, identique au rail du 15/10.
const FIGE = {
  famille: c => ({ CONDITIONS_NON_PROUVEES: 'OUBLI_DE_FORMAT', CANAL_INCAPABLE: 'CAPACITE_MANQUANTE', STOP_ARBITRE: 'DECISION_HUMAINE' })[c] || 'INCONNU',
  canaux: ['github-actions-claude', 'session-claude-habilitee', 'arbitre-chatgpt', 'frederic'],
  capacites: ['DEPOT_LECTURE', 'DEPOT_ECRITURE_RAIL', 'CANAL_PUBLICATION', 'CI_LECTURE_RUN', 'SUPABASE_TEST_LECTURE', 'SUPABASE_TEST_ECRITURE', 'SUPABASE_PRODUCTION_LECTURE', 'SUPABASE_PRODUCTION_ECRITURE', 'PRODUCTION_FUSION_DEPLOIEMENT'],
};
const lire = n => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8'));
const copie = o => JSON.parse(JSON.stringify(o));
const res = [];
const cas = (n, f) => { try { f(); res.push([true, n]); } catch (e) { res.push([false, n, e.message]); } };
const refuse = (d, motif) => { const r = valider(d, FIGE); assert.strictEqual(r.conforme, false, 'aurait dû être refusé'); assert.ok(r.erreurs.some(m => motif.test(m)), `motif attendu ${motif}, obtenu : ${r.erreurs.join(' | ')}`); };

const i15 = lire('diagnostic-20261015-tour-vide.json');
const i10 = lire('diagnostic-20261010-tour-vide.json');

cas('incident réel du 15/10 conforme', () => assert.deepStrictEqual(valider(i15, FIGE).erreurs, []));
cas('incident réel du 10/10 conforme (cause indéterminée assumée)', () => assert.deepStrictEqual(valider(i10, FIGE).erreurs, []));
cas('fait sans source refusé', () => { const d = copie(i15); delete d.faits[0].source; refuse(d, /sans source/); });
cas('hypothèse déguisée en fait refusée', () => { const d = copie(i15); d.faits[0].enonce = 'Les refus portent probablement sur la base Test.'; refuse(d, /formulé comme une hypothèse/); });
cas('cause démontrée sans fait cité refusée', () => { const d = copie(i15); d.cause_racine.faits = []; refuse(d, /sans fait cité/); });
cas('cause démontrée citant un fait inconnu refusée', () => { const d = copie(i15); d.cause_racine.faits = ['F99']; refuse(d, /fait inconnu/); });
cas('cause indéterminée sans dire ce qui manque refusée', () => { const d = copie(i10); delete d.cause_racine.manque; refuse(d, /ce qui manque/); });
cas('requalification de la famille refusée', () => { const d = copie(i15); d.classification.famille = 'OUBLI_DE_FORMAT'; refuse(d, /ne requalifie pas/); });
cas('urgence hors échelle refusée', () => { const d = copie(i15); d.classification.urgence = 'P0'; refuse(d, /urgence/); });
cas('exécutant hors registre refusé', () => { const d = copie(i15); d.action_suivante.executant = 'Claude'; refuse(d, /absent de CAPACITES-CANAL/); });
cas('action sans preuve attendue refusée', () => { const d = copie(i15); delete d.action_suivante.preuve_attendue; refuse(d, /preuve_attendue/); });
cas('RESOLU sur un run vert seul refusé', () => {
  const d = copie(i15); d.etat = 'RESOLU'; d.experience = 'EXPERIENCE.jsonl#x'; d.regle = 'GOV-009';
  d.faits.push({ id: 'F7', enonce: 'Le run 38700000000 est vert.', source: { type: 'run', ref: '38700000000' }, horodatage: '2026-10-16T00:00:00Z' });
  refuse(d, /workflow vert ne prouve pas/);
});
cas('RESOLU sans règle promue refusé', () => {
  const d = copie(i15); d.etat = 'RESOLU';
  d.faits.push({ id: 'F7', enonce: 'Le scénario 0 rejoué produit un arrêt visible.', source: { type: 'run', ref: '38700000000' }, horodatage: '2026-10-16T00:00:00Z', preuve_attendue_verifiee: true });
  refuse(d, /GOV-002/);
});
cas('RESOLU avec preuve vérifiée et règle promue accepté', () => {
  const d = copie(i15); d.etat = 'RESOLU'; d.experience = 'EXPERIENCE.jsonl#INC-20261015-001'; d.regle = 'GOV-009';
  d.faits.push({ id: 'F7', enonce: 'Le scénario 0 rejoué produit un arrêt visible.', source: { type: 'run', ref: '38700000000' }, horodatage: '2026-10-16T00:00:00Z', preuve_attendue_verifiee: true });
  assert.deepStrictEqual(valider(d, FIGE).erreurs, []);
});

for (const [ok, n, m] of res) console.log(`${ok ? 'OK ' : 'KO '} ${n}${ok ? '' : ' · ' + m}`);
const ko = res.filter(r => !r[0]).length;
console.log(`\n${res.length - ko}/${res.length} cas passent.`);
process.exitCode = ko ? 1 : 0;
