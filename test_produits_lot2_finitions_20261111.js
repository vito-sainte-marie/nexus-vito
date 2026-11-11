// Lot 2 Produits, PR D (finitions) : statut ancien retire, emplacement au clavier, tuile non coupee.
const fs = require('fs'); const assert = require('assert');
const src = fs.readFileSync(__dirname + '/NEXUS-Produits-v1.html', 'utf8');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
ok(!/[\u{1F300}-\u{1FAFF}]/u.test(src), 'aucun emoji ne reste dans la page');
ok(!/À AGIR|OPPORTUNITÉ|À SURVEILLER/.test(src), "ancien statut absent");
ok(!/statut = \{ etat:/.test(src) && !/pct_contrib, statut,/.test(src), "ancien calcul retire");
ok(!/<span class="emplacement-modifier"/.test(src), 'modifier/choisir sont des boutons');
ok(/<button type="button" class="emplacement-zone"/.test(src), 'zones = boutons');
ok(!/<div class="emplacement-zone"/.test(src), 'plus de div cliquable');
ok(/<button type="button" id="emplacementAutreBtn"/.test(src), 'bouton Enregistrer type=button');
ok(/emplacement-zone:focus-visible/.test(src), 'focus visible des zones');
ok(/\.ind-principal \.ind-val\{[^}]*overflow-wrap:anywhere/.test(src), 'tuile principale non coupee');
ok(/button type="button" role="option"/.test(src) || /role="option"[^>]*class="suggestion-item"/.test(src), 'suggestions = boutons');
console.log('OK', n, 'verifications');
