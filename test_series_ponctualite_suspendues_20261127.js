// Séries de ponctualité suspendues (27/11/2026) : aucune série tirée du
// pointage n'est affichée ni attribuée ; la mention « sans l'Équipe » est
// visible au premier niveau du Brief ; plus de tiret cadratin dans le Radar.
const fs = require('fs');
const assert = require('assert');
global.window = global;
const N = require('./nexus-progression.js');
const api = N.calculerBadges ? N : (global.NexusProgression || N);
const badges = api.calculerBadges({ seriesCaisse: { record: 40 }, seriePonctualite: { record: 99 }, nbMissionsCompletees: 200 });
const liste = Array.isArray(badges) ? badges : Object.values(badges || {});
const txt = JSON.stringify(liste);
assert(!/ponctualite-/.test(txt), 'badge ponctualite-* attribué');
assert(!/sans retard/i.test(txt), 'libellé « sans retard » présent');
assert(/caisse-7/.test(txt), 'les badges Caisse doivent rester');
for (const f of ['NEXUS-Progression-v1.html', 'NEXUS-Apprentissage-v1.html']) {
  assert(!/N\.calculerSeriePonctualite\(/.test(fs.readFileSync(f, 'utf8')), f + ' appelle encore la série');
}
const brief = fs.readFileSync('NEXUS-Brief-v1.html', 'utf8');
assert(/brief-indice-note[^`]*sans l\\'Équipe/.test(brief), 'mention premier niveau absente du Brief');
const radar = fs.readFileSync('NEXUS-Radar-Manager-v1.html', 'utf8');
assert(!/non noté —/.test(radar), 'tiret cadratin dans le Radar');
console.log('ok');
