// Épreuves de la vérification mécanique RULES.json / EXPERIENCE.jsonl.
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validerRules, validerExperience, verifier } = require('./outils/verifier-apprentissage.js');

let passes = 0;
function t(nom, fn) { fn(); passes++; console.log(`  ok — ${nom}`); }

function fichierTemp(contenu) {
  const f = path.join(os.tmpdir(), `nexus-learning-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(f, contenu);
  return f;
}

t('validerRules accepte un registre sain', () => {
  const f = fichierTemp(JSON.stringify({
    schema: 'nexus-rules/1',
    rules: [{ id: 'ENV-001', scope: ['development'], trigger: 't', module: 'all', severity: 'blocking', rule: 'r', source: 's' }],
  }));
  const { erreurs } = validerRules(f);
  fs.unlinkSync(f);
  assert.deepStrictEqual(erreurs, []);
});

t('validerRules refuse un id dupliqué (mutation vert→rouge)', () => {
  const base = { schema: 'nexus-rules/1', rules: [
    { id: 'ENV-001', scope: ['development'], trigger: 't', module: 'all', severity: 'blocking', rule: 'r', source: 's' },
  ] };
  let f = fichierTemp(JSON.stringify(base));
  assert.deepStrictEqual(validerRules(f).erreurs, []);
  fs.unlinkSync(f);

  const casse = JSON.parse(JSON.stringify(base));
  casse.rules.push({ ...base.rules[0] });
  f = fichierTemp(JSON.stringify(casse));
  const { erreurs } = validerRules(f);
  fs.unlinkSync(f);
  assert(erreurs.some(e => e.includes('dupliqué')));
});

t('validerRules refuse un id hors format', () => {
  const f = fichierTemp(JSON.stringify({ schema: 'nexus-rules/1', rules: [
    { id: 'pas-un-id-valide', scope: ['development'], trigger: 't', module: 'all', severity: 'blocking', rule: 'r', source: 's' },
  ] }));
  const { erreurs } = validerRules(f);
  fs.unlinkSync(f);
  assert(erreurs.some(e => e.includes('format PREFIXE-NNN')));
});

t('validerRules refuse un champ manquant', () => {
  const f = fichierTemp(JSON.stringify({ schema: 'nexus-rules/1', rules: [
    { id: 'ENV-001', scope: ['development'], trigger: 't', module: 'all', severity: 'blocking', rule: 'r' },
  ] }));
  const { erreurs } = validerRules(f);
  fs.unlinkSync(f);
  assert(erreurs.some(e => e.includes('source')));
});

t('validerExperience accepte une entrée conforme sans récurrence', () => {
  const f = fichierTemp('{"date":"2026-09-06","type":"x","component":"a","cause":"c1","impact":"i","resolution":"r"}\n');
  const { erreurs, avertissements } = validerExperience(f, new Set());
  fs.unlinkSync(f);
  assert.deepStrictEqual(erreurs, []);
  assert.deepStrictEqual(avertissements, []);
});

t('validerExperience signale un promoted_rule orphelin', () => {
  const f = fichierTemp('{"date":"2026-09-06","type":"x","component":"a","cause":"c1","impact":"i","resolution":"r","promoted_rule":"ZZZ-999"}\n');
  const { erreurs } = validerExperience(f, new Set(['ENV-001']));
  fs.unlinkSync(f);
  assert(erreurs.some(e => e.includes('ZZZ-999')));
});

t('validerExperience détecte une récurrence non promue (GOV-002), silence si promue (mutation)', () => {
  const deuxOccurrencesSansPromotion = [
    '{"date":"2026-09-01","type":"x","component":"carburants","cause":"reliquat_arrondi","impact":"i","resolution":"r"}',
    '{"date":"2026-09-06","type":"x","component":"carburants","cause":"reliquat_arrondi","impact":"i","resolution":"r"}',
  ].join('\n') + '\n';
  let f = fichierTemp(deuxOccurrencesSansPromotion);
  let { avertissements } = validerExperience(f, new Set());
  fs.unlinkSync(f);
  assert(avertissements.some(a => a.includes('récurrence non promue')));

  const avecPromotion = [
    '{"date":"2026-09-01","type":"x","component":"carburants","cause":"reliquat_arrondi","impact":"i","resolution":"r"}',
    '{"date":"2026-09-06","type":"x","component":"carburants","cause":"reliquat_arrondi","impact":"i","resolution":"r","promoted_rule":"CARB-001"}',
  ].join('\n') + '\n';
  f = fichierTemp(avecPromotion);
  ({ avertissements } = validerExperience(f, new Set(['CARB-001'])));
  fs.unlinkSync(f);
  assert(!avertissements.some(a => a.includes('récurrence non promue')));
});

t('validerExperience refuse une date illisible', () => {
  const f = fichierTemp('{"date":"pas-une-date","type":"x","component":"a","cause":"c","impact":"i","resolution":"r"}\n');
  const { erreurs } = validerExperience(f, new Set());
  fs.unlinkSync(f);
  assert(erreurs.some(e => e.includes('illisible')));
});

t('verifier() passe réellement sur le registre canonique du dépôt', () => {
  const { erreurs, nbRegles } = verifier();
  assert.deepStrictEqual(erreurs, [], `RULES.json/EXPERIENCE.jsonl canoniques devraient être sains : ${JSON.stringify(erreurs)}`);
  assert(nbRegles > 0);
});

console.log(`\n${passes} épreuve(s) passée(s) — outils/verifier-apprentissage.js`);
