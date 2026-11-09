// Lot 1 des emojis — affichage seulement (GO Frédéric 09/11).
// Point 1 : libelleEcartRestant suit le statut, jamais le signe seul ; l'excédent n'est jamais vert.
// Point 2 : Mon évolution sans 📈📉➡️.
// Point 3 : Rappels sans 🟢🟡, titre non coloré, repère carré + nom du carburant.
// Chaque garde est mutée : elle passe sur la source, rougit sur la source abîmée.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

require('./nexus-ecarts-moteur.js');
const E = globalThis.NexusEcartsMoteur;
let n = 0;
function ok(m) { n++; console.log('OK — ' + m); }
function garde(nom, src, regle, litteral, remplacement) {
  assert.ok(regle(src), nom + ' : la garde doit passer sur la source');
  assert.ok(src.includes(litteral), nom + ' : littéral de mutation introuvable : ' + litteral);
  assert.ok(!regle(src.split(litteral).join(remplacement)), nom + ' : la garde doit rougir sur la source mutée');
  ok(nom + ' (garde mutée)');
}

// ---- Point 1 : le moteur, en isolation
const cas = [
  ['excédent à vérifier', 5, 'a_verifier', 'Excédent à vérifier', 'amber'],
  ['excédent clôturé sans cause', 5, 'cloture_non_explique', 'Excédent non expliqué', 'amber'],
  ['manque à vérifier', -5, 'a_verifier', 'Manque à vérifier', 'red'],
  ['manque clôturé sans cause', -5, 'cloture_non_explique', 'Manque non expliqué', 'red'],
  ['statut absent, excédent', 5, undefined, 'Excédent non expliqué', 'amber'],
  ['statut absent, manque', -5, null, 'Manque non expliqué', 'red'],
];
for (const [nom, ecart, statut, texte, classe] of cas) {
  const l = E.libelleEcartRestant(ecart, statut);
  assert.strictEqual(l.texte, texte, nom);
  assert.strictEqual(l.classe, classe, nom);
  assert.strictEqual(l.emoji, '', nom + ' : aucun emoji');
  assert.ok(!/green|🟢|#34D399/i.test(JSON.stringify(l)) || ecart < 0, nom + ' : jamais vert');
  if (ecart > 0) assert.ok(!/green|🟢/.test(JSON.stringify(l)), nom + ' : un excédent n\'est jamais vert');
}
assert.strictEqual(E.libelleEcartRestant(null, 'a_verifier'), null);
ok('libelleEcartRestant : 6 cas (excédent/manque × à vérifier/clôturé/statut absent), jamais vert, null si pas d\'écart');

const moteur = lire('nexus-ecarts-moteur.js');
const corps = moteur.slice(moteur.indexOf('function libelleEcartRestant'), moteur.indexOf('}\n', moteur.indexOf('function libelleEcartRestant') + 200));
garde('moteur : « à vérifier » suit le statut', corps, s => /statut === 'a_verifier'/.test(s) && /Excédent à vérifier/.test(s), "statut === 'a_verifier'", "statut === 'zzz'");
garde('moteur : excédent orange', corps, s => /classe: 'amber'/.test(s) && !/classe: 'green'/.test(s), "classe: 'amber'", "classe: 'green'");

// ---- Verify et FDJ passent le statut au moteur, plus de copie locale
const verify = lire('NEXUS-Verify-v1.html');
garde('Verify transmet le statut au moteur', verify,
  s => /libelleEcartRestant\(ecartValide, statutEcart\)/.test(s) && /deriverStatutEcart\(/.test(s),
  'libelleEcartRestant(ecartValide, statutEcart)', 'libelleEcartRestant(ecartValide)');
const fdj = lire('NEXUS-FDJ-Manager-v1.html');
garde('FDJ transmet le statut au moteur', fdj,
  s => /NexusEcartsMoteur\.libelleEcartRestant\(ecart, statutEcart\)/.test(s),
  'libelleEcartRestant(ecart, statutEcart)', 'libelleEcartRestant(ecart)');
assert.ok(!/🟢|🔴/.test(fdj.slice(fdj.indexOf('function renderBlocMotifRestant'), fdj.indexOf('function renderBlocMotifRestant') + 1200)), 'FDJ : plus de pastille emoji dans renderBlocMotifRestant');
ok('FDJ : la copie locale du badge emoji a disparu');

// ---- Point 2
const prog = lire('NEXUS-Progression-v1.html');
const bloc2 = prog.slice(prog.indexOf('TENDANCE_LABEL'), prog.indexOf('};', prog.indexOf('TENDANCE_LABEL')) + 2);
garde('Progression : libellés écrits', bloc2,
  s => s.includes('Tes écarts diminuent') && s.includes('Tes écarts augmentent') && s.includes('Tes écarts sont stables') && !/[📈📉➡]/u.test(s),
  'Tes écarts augmentent', '📈 Tes écarts augmentent');
assert.ok(!/📈 Tes|📉 Tes|➡️ Tes/u.test(prog), 'Progression : aucun emoji devant les libellés');
ok('Progression : « diminuent / augmentent / stables », sans emoji');

// ---- Point 3
const rap = lire('NEXUS-Parametres-Rappels-v1.html');
const l = rap.split('\n');
const lignes = l.filter(x => /fuel-block-title"[^>]*>.*(Sans Plomb|Gasoil)/.test(x) || /r\.q(SP|GO) > 0/.test(x));
assert.strictEqual(lignes.length, 4, 'Rappels : 4 lignes carburant attendues (2 titres, 2 recommandations)');
for (const x of lignes) assert.ok(!/🟢|🟡/u.test(x), 'Rappels : plus de pastille emoji : ' + x.trim());
garde('Rappels : repère carré devant Sans Plomb et Gasoil', lignes.join('\n'),
  s => (s.match(/class="fuel-marker/g) || []).length === 4 && /Sans Plomb/.test(s) && /Gasoil/.test(s),
  'class="fuel-marker', 'class="marqueur');
const css = rap.slice(rap.indexOf('.fuel-block-title'), rap.indexOf('.fuel-block-title') + 400);
garde('Rappels : titre non coloré vert/ambre', rap,
  s => !/\.fuel-block\.(sp|go) \.fuel-block-title\s*\{[^}]*color:\s*var\(--(green|amber)\)/.test(s),
  '.fuel-block-title{color:var(--text);}', '.fuel-block.sp .fuel-block-title{color:var(--green);}.fuel-block-title{color:var(--text);}');
garde('Rappels : repère carré, forme distincte du rond', rap,
  s => /\.fuel-marker\{[^}]*border-radius:2px/.test(s), 'border-radius:2px', 'border-radius:50%');
void css;

console.log('\nTous les tests du lot 1 emojis (affichage) passent : ' + n);
