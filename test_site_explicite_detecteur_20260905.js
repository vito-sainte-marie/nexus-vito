// SITE-EXPLICITE — le détecteur est lui-même éprouvé avant d'être cru.
//
// Le premier balayage de la cartographie annonçait 78 écritures sans site sur
// 58 tables. Il en comptait 30 de trop : le motif ne reconnaissait que
// `site:` et manquait la notation abrégée `{ site, … }`. Un plan de
// correction bâti sur ce chiffre aurait visé des fichiers sains.
//
// Exigence posée par le QA Guardian en Phase 1 : tout détecteur produit dans
// ce chantier doit être éprouvé par mutation avant d'être cru. C'est ce que
// fait ce test — il ne vérifie pas que le détecteur trouve, il vérifie qu'il
// ne se trompe ni dans un sens ni dans l'autre.
'use strict';
const assert = require('assert');
const { analyserSource, analyserDepot } = require('./outils/auditer-site-explicite');

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

const sansSite = `
  const { error } = await nexusClient.from('pointages').insert({
    employee_id: employeeCourant.id, type: 'arrivee', heure: '08:00',
  });`;

const siteExplicite = `
  const { error } = await nexusClient.from('pointages').insert({
    employee_id: employeeCourant.id, site: employeeCourant.site_id, heure: '08:00',
  });`;

const siteAbrege = `
  const site = employeeCourant.site_id;
  const { error } = await nexusClient.from('inventaire_quarts').insert({
    site, date: dateISO(), quart: quartActuel,
  });`;

const siteIdExplicite = `
  await nexusClient.from('mission_completions').insert({
    employee_id: id, site_id: employeeCourant.site_id,
  });`;

verifier('une écriture sans site est détectée', () => {
  const t = analyserSource(sansSite);
  assert.strictEqual(t.length, 1, 'la seule écriture fautive doit être vue');
  assert.strictEqual(t[0].table, 'pointages');
  assert.strictEqual(t[0].operation, 'insert');
});

verifier('une écriture avec site explicite n’est PAS signalée', () => {
  // Sans cette épreuve, un détecteur qui signale tout satisferait la
  // précédente et produirait un plan de correction visant des fichiers sains.
  assert.deepStrictEqual(analyserSource(siteExplicite), []);
});

verifier('la notation abrégée `{ site, … }` compte comme un site fourni', () => {
  // LA régression du premier balayage : 30 faux positifs venaient d'ici.
  assert.deepStrictEqual(analyserSource(siteAbrege), [],
    'le raccourci ES6 fournit bien le site — le manquer gonfle le comptage');
});

verifier('`site_id:` est reconnu au même titre que `site:`', () => {
  assert.deepStrictEqual(analyserSource(siteIdExplicite), []);
});

verifier('`upsert` est audité comme `insert`', () => {
  const t = analyserSource("await c.from('inventaire_comptages').upsert({ quart_id: q, quantite: 1 });");
  assert.strictEqual(t.length, 1);
  assert.strictEqual(t[0].operation, 'upsert');
});

verifier('une lecture n’est jamais comptée comme une écriture', () => {
  assert.deepStrictEqual(analyserSource("await c.from('pointages').select('*').eq('id', x);"), []);
});

verifier('la fenêtre ne déborde pas sur l’appel suivant', () => {
  // Un `site:` appartenant à l'écriture SUIVANTE ne doit pas absoudre la
  // précédente — c'est la même classe d'erreur que la fenêtre trop large
  // corrigée dans le test S-5.
  const deux = `
    await c.from('pointages').insert({ employee_id: a, heure: '08:00' });
    await c.from('shifts').insert({ employee_id: a, site: s });`;
  const t = analyserSource(deux);
  assert.strictEqual(t.length, 1, 'seule la première écriture est fautive');
  assert.strictEqual(t[0].table, 'pointages');
});

verifier('plusieurs écritures fautives sont toutes rapportées', () => {
  const t = analyserSource(sansSite + '\n' + sansSite);
  assert.strictEqual(t.length, 2);
  assert.notStrictEqual(t[0].ligne, t[1].ligne, 'chaque occurrence porte sa propre ligne');
});

verifier('le dépôt réel donne le chiffre annoncé', () => {
  // Le chiffre cité dans la cartographie doit rester vérifiable, et bouger
  // le jour où le code bouge — pas rester figé dans un document.
  const t = analyserDepot(__dirname);
  const tables = new Set(t.map(x => x.table));
  assert.strictEqual(t.length, 48, `48 écritures attendues, ${t.length} trouvées — la cartographie doit être remise à jour`);
  assert.strictEqual(tables.size, 37, `37 tables attendues, ${tables.size} trouvées`);
});

console.log(`\n${passes} vérifications passées — le détecteur est éprouvé, pas cru sur parole.`);
