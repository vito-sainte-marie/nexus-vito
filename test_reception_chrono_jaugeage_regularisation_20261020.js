// Test — chronologie d'une régularisation de réception carburant
// (NEXUS-Carburant-Reception-v1.html, chronoJaugeageRegularisation).
//
// Défaut du 19/10/2026 : la règle imposait livraison ≤ jaugeage avant, alors
// que sur le terrain le jaugeage initial PRÉCÈDE le dépotage. Cas réel bloqué :
// jaugeage avant 19/10 à 12:22, livraison du BL à 13:56.
// Ordre voulu : jaugeage avant ≤ livraison ≤ jaugeage après ≤ maintenant.
//
// La fonction est extraite du code livré (jamais recopiée) et exécutée avec
// l'état qu'elle lit : mode, heures saisies, livraison.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Carburant-Reception-v1.html'), 'utf8');
const m = html.match(/function chronoJaugeageRegularisation\([^)]*\) \{[\s\S]*?\n  \}/);
assert.ok(m, 'chronoJaugeageRegularisation introuvable');

function regle({ regul = true, avant = '', apres = '', livraison = '' }, phase) {
  const sb = { Date, isNaN };
  vm.createContext(sb);
  vm.runInContext(`
    var modeRegul = ${JSON.stringify(regul)};
    var jaugeageLe = ${JSON.stringify({ avant, apres })};
    var visite = { heure_debut: ${JSON.stringify(livraison)} };
    function estRegularisation() { return modeRegul; }
    ${m[0]}
    this.r = chronoJaugeageRegularisation(${JSON.stringify(phase)});
  `, sb);
  return sb.r;
}
const ok = (c, p, msg) => assert.strictEqual(regle(c, p).ok, true, msg);
const refus = (c, p, motif, msg) => {
  const r = regle(c, p);
  assert.strictEqual(r.ok, false, msg);
  assert.ok(motif.test(r.message), `${msg} — message obtenu : « ${r.message} »`);
};

// 1. Cas réel du 19/10 : avant 12:22, livraison 13:56.
ok({ avant: '2026-10-19T12:22', livraison: '2026-10-19T13:56' }, 'avant',
  'Cas réel : jaugeage avant 12:22 pour une livraison à 13:56 doit passer');

// 2. Ordre complet, y compris le jaugeage final.
const base = { avant: '2026-10-19T12:22', livraison: '2026-10-19T13:56', apres: '2026-10-19T15:10' };
ok(base, 'avant', 'Chaîne complète : avant valide');
ok(base, 'apres', 'Chaîne complète : après valide');

// 3. Égalités admises (minute du datetime-local).
ok({ avant: '2026-10-19T13:56', livraison: '2026-10-19T13:56' }, 'avant', 'avant = livraison admis');
ok({ avant: '2026-10-19T12:00', livraison: '2026-10-19T13:56', apres: '2026-10-19T13:56' }, 'apres', 'après = livraison admis');
ok({ avant: '2026-10-19T13:56', livraison: '2026-10-19T13:56', apres: '2026-10-19T13:56' }, 'apres', 'trois heures égales admises');

// 4. Violations.
refus({ avant: '2026-10-19T13:57', livraison: '2026-10-19T13:56' }, 'avant', /postérieur à la livraison/,
  'Jaugeage avant une minute après la livraison : refusé');
refus({ avant: '2026-10-19T14:30', livraison: '2026-10-19T13:56' }, 'avant', /postérieur à la livraison/,
  'Jaugeage avant après la livraison : refusé');
refus({ avant: '2026-10-19T12:22', livraison: '2026-10-19T13:56', apres: '2026-10-19T13:55' }, 'apres', /antérieur à la livraison/,
  'Jaugeage après avant la livraison : refusé');
refus({ avant: '2026-10-19T14:00', livraison: '2026-10-19T13:56', apres: '2026-10-19T13:30' }, 'apres', /antérieur à la livraison/,
  'Jaugeage après avant la livraison : refusé même si avant est incohérent');
refus({ avant: '2026-10-19T12:22', livraison: '2026-10-19T13:56', apres: '2026-10-19T12:00' }, 'apres', /antérieur à la livraison/,
  'Jaugeage après avant le jaugeage avant : refusé');

// 5. Avant revisité après un jaugeage final déjà saisi : il ne peut pas le dépasser.
refus({ avant: '2026-10-19T15:30', livraison: '2026-10-19T15:40', apres: '2026-10-19T15:10' }, 'avant', /postérieur au jaugeage final|antérieur à la livraison/,
  'Un jaugeage avant postérieur au jaugeage final est refusé');

// 6. Futur, vide, illisible.
const demain = new Date(Date.now() + 36 * 3600e3);
const pad = n => String(n).padStart(2, '0');
const dtl = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
refus({ avant: dtl(demain), livraison: '2026-10-19T13:56' }, 'avant', /futur/, 'Un jaugeage avant daté du futur est refusé');
refus({ avant: '2026-10-19T12:22', livraison: '2026-10-19T13:56', apres: dtl(demain) }, 'apres', /futur/, 'Un jaugeage après daté du futur est refusé');
refus({ livraison: '2026-10-19T13:56' }, 'avant', /Indiquez l'heure/, 'Heure absente : refusée');
refus({ avant: 'n’importe quoi', livraison: '2026-10-19T13:56' }, 'avant', /pas lisible/, 'Heure illisible : refusée');

// 7. Sans livraison saisie, seul le reste de la chaîne est jugé.
ok({ avant: '2026-10-19T12:22' }, 'avant', 'Sans livraison, le jaugeage avant passé reste admis');

// 8. Temps réel : aucune règle d'heure saisie.
ok({ regul: false }, 'avant', 'Hors régularisation, aucune contrainte');
ok({ regul: false }, 'apres', 'Hors régularisation, aucune contrainte');

console.log('Tous les tests chrono_jaugeage_regularisation passent.');
