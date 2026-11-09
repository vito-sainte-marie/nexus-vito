// Petite PR (Guardian 6727381702, 08/11/2026) : ligne « Moyenne vendue » mise en évidence ; valeur d'Autonomie en police sans-serif calculée.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
function garde(nom, src, regle, litteral, remplacement) {
  t(nom, () => {
    assert.ok(regle(src), 'la garde doit passer sur la source');
    assert.ok(src.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
    assert.ok(!regle(src.replace(litteral, remplacement)), 'la garde doit rougir sur la source mutée');
  });
}
const H = fs.readFileSync(path.join(__dirname, 'NEXUS-Carburants-Pilotage-v1.html'), 'utf8');
const B = '.carb-ventes-ligne.carb-ventes-moyenne';
const bande = c => new RegExp('\\' + B.replace(/\./g, '.').replace(/^\./, '.') + '\\{[^}]*--teinte-moyenne:8%;[^}]*border-left:2px solid var\\(--carb-couleur[^}]*border-radius:10px;[^}]*linear-gradient\\(90deg, color-mix\\(in srgb, var\\(--carb-couleur, var\\(--cyan\\)\\) var\\(--teinte-moyenne\\)').test(c);
const jour = c => /:root\[data-theme="jour"\] \.carb-ventes-ligne\.carb-ventes-moyenne\{--teinte-moyenne:10%;\}/.test(c);
const valeur = c => /\.carb-ventes-ligne\.carb-ventes-moyenne \.val\{font-size:15px; font-weight:700;/.test(c);
const survol = c => /@media \(hover:hover\) and \(min-width:821px\)\{[^@]*carb-ventes-moyenne:hover::after\{opacity:1;\}/.test(c);
const reduit = c => /@media \(prefers-reduced-motion:reduce\)\{[^@]*carb-ventes-moyenne::after\{transition:none; display:none;\}/.test(c);
const sansAutonomie = c => /\.carb-bloc-autonomie \.carb-autonomie-bloc \.val,\.carb-bloc-autonomie \.carb-autonomie-bloc \.val \*\{font-family:var\(--sans\);\}/.test(c);
const marque = c => /<div class="carb-ventes-ligne carb-ventes-moyenne"><span>Moyenne vendue<\/span><span class="val">\$\{moyTxt\}<\/span><\/div>/.test(c);
const noteHors = c => { const i = c.indexOf('carb-ventes-moyenne"><span>Moyenne vendue'); const j = c.indexOf('</div>', i); return /^\s*\$\{couv\}/.test(c.slice(j + 6)) && /const couv = [^;]*carb-ventes-couverture/.test(c.slice(0, i)); };

t('bande Moyenne vendue : teinte 8 %, filet gauche 2 px, rayon 10, dégradé horizontal', () => { assert.ok(bande(H)); });
t('thème Jour : teinte 10 %', () => { assert.ok(jour(H)); });
t('valeur : 15 px gras', () => { assert.ok(valeur(H)); });
t('survol : reflet limité au bureau avec souris', () => { assert.ok(survol(H)); });
t('mouvement réduit : plus de reflet ni de transition', () => { assert.ok(reduit(H)); });
t('aucune animation permanente sur la bande', () => { assert.ok(!/carb-ventes-moyenne[^{]*\{[^}]*animation:/.test(H)); });
t('Autonomie : sans-serif imposé aussi aux descendants', () => { assert.ok(sansAutonomie(H)); });
t('balisage : la ligne porte la classe, la note de couverture reste dessous, hors bande', () => { assert.ok(marque(H)); assert.ok(noteHors(H)); });

garde('teinte Nuit 8 %', H, bande, '--teinte-moyenne:8%; position:relative', '--teinte-moyenne:3%; position:relative');
garde('filet gauche 2 px', H, bande, 'border-left:2px solid var(--carb-couleur, var(--cyan)); border-radius:10px', 'border-left:0; border-radius:10px');
garde('rayon 10 px', H, bande, 'border-radius:10px;\n', 'border-radius:0;\n');
garde('teinte Jour 10 %', H, jour, '--teinte-moyenne:10%;}', '--teinte-moyenne:2%;}');
garde('valeur 15 px gras', H, valeur, '.val{font-size:15px; font-weight:700;', '.val{font-size:13px; font-weight:400;');
garde('survol réservé au bureau avec souris', H, survol, 'carb-ventes-moyenne:hover::after{opacity:1;}', 'carb-ventes-moyenne:hover::after{opacity:0;}');
garde('mouvement réduit coupe le reflet', H, reduit, 'carb-ventes-moyenne::after{transition:none; display:none;}', 'carb-ventes-moyenne::after{transition:opacity .25s;}');
garde('Autonomie sans-serif sur les descendants', H, sansAutonomie, '.carb-autonomie-bloc .val *{font-family:var(--sans);}', '.carb-autonomie-bloc .val *{font-family:var(--mono);}');
garde('classe de la bande sur la ligne', H, marque, 'class="carb-ventes-ligne carb-ventes-moyenne"', 'class="carb-ventes-ligne"');
console.log(n + ' épreuves OK');
