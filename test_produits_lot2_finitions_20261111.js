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
ok(!/\.ind-val\{[^}]*overflow-wrap:anywhere/.test(src) && !/\.ind-principal \.ind-val\{[^}]*overflow-wrap/.test(src), 'plus de overflow-wrap sur .ind-val');
ok(/\.ind-principal \.ind-val\{[^}]*white-space:nowrap/.test(src), 'valeur principale jamais coupee');
ok(/\.ind-principal \.ind-val\{[^}]*font-size:clamp\(22px,[^)]*cqi/.test(src), 'plancher 22px, jamais sous les tuiles secondaires (15px)');
ok(/\.indic-card\{container-type:inline-size/.test(src) && /@container \(min-width:600px\)\{\s*\.ind-principal\{grid-template-columns:repeat\(3,1fr\)/.test(src), 'trois colonnes seulement si la carte est assez large');
ok(!/@media \(min-width:640px\)\{\s*\.ind-principal/.test(src), 'plus de bascule 3 colonnes sur la largeur de la fenetre');
ok(/button type="button" role="option"/.test(src) || /role="option"[^>]*class="suggestion-item"/.test(src), 'suggestions = boutons');
console.log('OK', n, 'verifications');
