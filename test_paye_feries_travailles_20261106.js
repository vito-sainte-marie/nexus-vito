#!/usr/bin/env node
// NEXUS PAYE — fériés travaillés (Guardian, GO conception du 05/11/2026).
// Un férié constaté (Verify) est retenu d'office, avec son nom ; il ne compte ni dans le statut,
// ni dans « à traiter », ni dans « Décisions ». Le manager peut seulement le retirer. Aucune majoration.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const JF = require('./nexus-jours-feries.js');
require('./nexus-paye-moteur.js');
const M = global.NexusPayeMoteur;
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

const config = { jours_heure_supp: [4, 5, 6], minutes_heure_supp: 60, activites_heure_supp: ['piste', 'boutique'], quart_exclu_heure_supp: 'renfort', retard_max_coherent_min: 180, jours_feries: [] };
const run = (periode, dates, extra) => M.construireRapport(Object.assign({
  periode,
  employees: [{ id: 'e1', nom: 'Angélique', role: 'pompiste', actif: true }, { id: 'e2', nom: 'Hors', role: 'pompiste', actif: true }],
  settings: [{ employee_id: 'e1', inclus_paye: true, mode_presence: 'automatique' }, { employee_id: 'e2', inclus_paye: false, mode_presence: 'automatique' }],
  planning: [], pointages: [], indisponibilites: [], items: [], ecarts: [], config,
  audits: dates.map((d, k) => ({ id: 'a' + k, date: d, quart: 'quart1', employes_piste: ['e1', 'e2'], employes_boutique: [] })),
}, extra || {}));
const f1 = r => r.employes.find(f => f.employee.id === 'e1');
const feries = r => f1(r).items.filter(i => i.typeItem === 'jour_ferie');

let n = 0;
const t = (nom, fn) => { fn(); n += 1; console.log(`  ✓ ${nom}`); };

[['2026-05-01', '2026-05-22', 'Abolition de l’esclavage'], ['2026-07-01', '2026-07-14', 'Fête nationale'], ['2026-11-01', '2026-11-01', 'Toussaint']].forEach(([p, d]) => {
  t(`${d} constaté → férié retenu avec son nom`, () => {
    const r = run(p, [d]);
    const fs_ = feries(r);
    assert.strictEqual(fs_.length, 1);
    assert.strictEqual(fs_[0].statut, 'valide');
    assert.strictEqual(fs_[0].retenuAuto, true);
    assert.strictEqual(fs_[0].nomFerie, JF.joursFeriesMartinique(2026).find(x => x.date === d).nom);
    assert.ok(fs_[0].libelle.startsWith('Jour férié travaillé · '));
    const v = M.variablesComptables(f1(r));
    assert.strictEqual(v.joursFeries.jours, 1);
    assert.deepStrictEqual(v.joursFeries.dates, [d]);
  });
});

t('un férié non constaté ne produit rien', () => {
  const r = run('2026-05-01', ['2026-05-20']);
  assert.strictEqual(feries(r).length, 0);
  assert.strictEqual(M.variablesComptables(f1(r)).joursFeries.jours, 0);
});

t('dimanche de Pâques absent de joursFeries → rien ; lundi de Pâques et lundi de Pentecôte → férié', () => {
  const p = JF.joursFeriesMartinique(2026).map(x => x.date);
  assert.ok(!p.includes('2026-04-05') && p.includes('2026-04-06') && p.includes('2026-05-25'));
  assert.strictEqual(feries(run('2026-04-01', ['2026-04-05'])).length, 0);
  assert.strictEqual(feries(run('2026-04-01', ['2026-04-06']))[0].nomFerie, 'Lundi de Pâques');
  assert.strictEqual(feries(run('2026-05-01', ['2026-05-25']))[0].nomFerie, 'Lundi de Pentecôte');
});

t('un salarié hors paie n’a aucun férié', () => {
  const r = run('2026-05-01', ['2026-05-22']);
  assert.strictEqual(r.employes.find(f => f.employee.id === 'e2').items.filter(i => i.typeItem === 'jour_ferie').length, 0);
});

t('le férié ne change ni statut, ni bloqueur, ni « à traiter »', () => {
  const avec = run('2026-05-01', ['2026-05-22']), sans = run('2026-05-01', ['2026-05-20']);
  assert.strictEqual(f1(avec).statutSalarie, f1(sans).statutSalarie);
  assert.deepStrictEqual((avec.bloqueurs || []).length, (sans.bloqueurs || []).length);
  assert.ok(!f1(avec).items.some(i => i.typeItem === 'jour_ferie' && i.statut === 'a_verifier'));
});

t('aucune majoration : heures identiques à une journée ordinaire', () => {
  const a = M.variablesComptables(f1(run('2026-05-01', ['2026-05-22']))), b = M.variablesComptables(f1(run('2026-05-01', ['2026-05-15'])));
  assert.strictEqual(a.presence.heures, b.presence.heures);
});

t('config.jours_feries s’ajoute sans doublon', () => {
  const r = run('2026-05-01', ['2026-05-22', '2026-05-10'], { config: Object.assign({}, config, { jours_feries: ['2026-05-22', '2026-05-10'] }) });
  assert.deepStrictEqual(feries(r).map(i => i.date).sort(), ['2026-05-10', '2026-05-22']);
});

t('« retirer » (décision exclu) sort le férié des retenus', () => {
  const r0 = run('2026-05-01', ['2026-05-22']);
  const it = feries(r0)[0];
  const r1 = run('2026-05-01', ['2026-05-22'], { items: [{ source_cle: it.sourceCle, id: 'a1', statut: 'exclu', impact_paye: false }] });
  assert.strictEqual(M.variablesComptables(f1(r1)).joursFeries.jours, 0);
});

t('Tempo et Paye partagent le module commun, sans calcul dupliqué', () => {
  assert.ok(/nexus-jours-feries/.test(lire('nexus-tempo.js')) && /nexus-jours-feries/.test(lire('nexus-paye-moteur.js')));
  assert.ok(!/function datePaques/.test(lire('nexus-tempo.js')) && !/function datePaques/.test(lire('nexus-paye-moteur.js')));
  assert.deepStrictEqual((() => { const w = { NexusJoursFeries: JF }; const g = { window: w, NexusJoursFeries: JF, console }; require('vm').runInNewContext(lire('nexus-tempo.js'), g); return (g.window.NexusTempo || g.NexusTempo).joursFeriesMartinique(2026); })(), JF.joursFeriesMartinique(2026));
});

t('la page Paye charge le module et porte Retirer, Journées et Événements', () => {
  const h = lire('NEXUS-Paye-v1.html');
  assert.ok(/<script src="nexus-jours-feries\.js[^"]*"><\/script>/.test(h));
  assert.ok(h.includes('Férié travaillé : ') && h.includes('ferie-retirer') && h.includes('feriesAuto('));
  assert.ok(h.indexOf('<script src="nexus-jours-feries.js') < h.indexOf('<script src="nexus-paye-moteur.js'));
});

console.log(`${n} épreuves : fériés travaillés OK`);
