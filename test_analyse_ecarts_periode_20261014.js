// Test — période par défaut de l'« Analyse des écarts » : mois civil courant
// au jour de la station (America/Martinique), accès à l'historique sur choix explicite.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
require('./nexus-ecarts-donnees.js');
const D = globalThis.NexusEcartsDonnees;
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Analyse-Ecarts-v1.html'), 'utf8');
const paye = fs.readFileSync(path.join(__dirname, 'NEXUS-Paye-v1.html'), 'utf8');
let n = 0;
const ok = l => { n++; console.log('OK —', l); };

// Changement de mois
let b = D.bornesDePeriode('mois', '2026-10-14');
assert.deepStrictEqual([b.dateDebut, b.dateFin], ['2026-10-01', '2026-10-14']);
b = D.bornesDePeriode('mois', '2026-11-01');
assert.deepStrictEqual([b.dateDebut, b.dateFin], ['2026-11-01', '2026-11-01']);
b = D.bornesDePeriode('precedent', '2026-03-10');
assert.deepStrictEqual([b.dateDebut, b.dateFin], ['2026-02-01', '2026-02-28']);
b = D.bornesDePeriode('precedent', '2028-03-10');
assert.strictEqual(b.dateFin, '2028-02-29');
ok('changement de mois (dont février bissextile)');

// Passage d'une année à l'autre
b = D.bornesDePeriode('precedent', '2027-01-05');
assert.deepStrictEqual([b.dateDebut, b.dateFin], ['2026-12-01', '2026-12-31']);
b = D.bornesDePeriode('mois', '2027-01-01');
assert.deepStrictEqual([b.dateDebut, b.dateFin], ['2027-01-01', '2027-01-01']);
ok('passage d\'une année à l\'autre');

// Fuseau : 01h UTC le 1er = encore le 30 en Martinique (UTC-4)
assert.strictEqual(D.jourDeLaStation(new Date('2026-11-01T01:00:00Z'), 'America/Martinique'), '2026-10-31');
assert.strictEqual(D.jourDeLaStation(new Date('2026-11-01T05:00:00Z'), 'America/Martinique'), '2026-11-01');
ok('jour de la station en America/Martinique');

// Absence de filtre → mois courant ; historique seulement sur choix explicite
let r = D.resoudrePeriode({}, '2026-10-14', {});
assert.deepStrictEqual([r.mode, r.dateDebut, r.dateFin], ['mois', '2026-10-01', '2026-10-14']);
r = D.resoudrePeriode({ periode: 'tout' }, '2026-10-14', {});
assert.deepStrictEqual([r.mode, r.dateDebut, r.dateFin], ['tout', '', '']);
ok('absence de filtre = mois courant, historique explicite');

// Période personnalisée (dates seules ou mode perso)
r = D.resoudrePeriode({ dateDebut: '2026-08-05', dateFin: '2026-09-10' }, '2026-10-14', {});
assert.deepStrictEqual([r.mode, r.dateDebut, r.dateFin], ['perso', '2026-08-05', '2026-09-10']);
r = D.resoudrePeriode({ periode: 'perso', dateDebut: '2026-09-01', dateFin: '2026-09-30' }, '2026-10-14', {});
assert.strictEqual(r.mode, 'perso');
ok('période personnalisée');

// Libellé : période exacte affichée
assert.ok(/01\/10\/2026 au 14\/10\/2026/.test(D.libellePeriode({ mode: 'mois', dateDebut: '2026-10-01', dateFin: '2026-10-14' })));
assert.ok(/Tout l.historique/.test(D.libellePeriode({ mode: 'tout', dateDebut: '', dateFin: '' })));
ok('libellé de la période');

// Un seul intervalle pour indicateurs et listes : les champs date sont la seule source
assert.ok(/fDateDebut[\s\S]*fDateFin/.test(html));
assert.ok(/synchroniserPeriode\(\);\s*const f = litFiltresDepuisFormulaire\(\)/.test(html));
ok('intervalle unique lu depuis le formulaire');

// Navigation : filtre conservé dans l'URL, dates écrites seulement en perso
assert.ok(/p\.set\('periode', f\.periode\)/.test(html) && /if \(f\.periode === 'perso'\)/.test(html));
ok('période conservée dans l\'URL');

// Libellés financiers
assert.ok(!/Montant retenu/.test(html));
assert.ok(/Manques validés/.test(html) && /Ni dette du salarié, ni retenue sur salaire/.test(html));
ok('libellés financiers clarifiés');

// Paye → Verify : même intervalle que le mois de paye affiché
assert.ok(/NEXUS-Analyse-Ecarts-v1\.html\?periode=perso&amp;date_debut=\$\{MOIS\}&amp;date_fin=\$\{dernierJourMois\(\)\}/.test(paye));
ok('navigation Paye → Analyse des écarts sur le même intervalle');

console.log(`\n${n} vérifications OK`);
