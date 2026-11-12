// Tempo V2 — carte « Mois » : une barre par mois écoulé (moyenne par jour complet), jamais le total, aucune tendance, aucun conseil.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = {};
require('./nexus-vocabulaire.js');
require('./nexus-tempo.js');
const T = window.NexusTempo;
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const html = lire('NEXUS-Tempo-v2-Mois.html');
const hub = lire('NEXUS-Tempo-v2.html');
const moteur = lire('nexus-tempo.js');
const vocab = lire('nexus-vocabulaire.js');

let echecs = 0;
function t(nom, fn) {
  try { fn(); console.log('  ok   ' + nom); }
  catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); }
}
const VERBES = /\b(devez|devriez|faut|faites|faire|essayez|pensez|prévoyez|augmentez|baissez|réduisez|recommand|conseil|agissez|à surveiller|à corriger)\w*/i;
const M = window.NexusVocab.mois;

// Jours complets synthétiques : tous les jours entre deux dates, valeur donnée par une fonction.
function jours(debut, fin, val, sauf) {
  const out = [];
  for (let d = new Date(debut + 'T12:00:00Z'); d <= new Date(fin + 'T12:00:00Z'); d = new Date(d.getTime() + 86400000)) {
    const iso = d.toISOString().slice(0, 10);
    if (sauf && sauf.includes(iso)) continue;
    out.push({ date: iso, valeur: typeof val === 'function' ? val(iso) : val });
  }
  return out;
}
const mois = () => {
  // août complet à 1000, septembre à 2000 avec un jour manquant, octobre à peine renseigné (non retenu), exclu = 1er novembre.
  const js = jours('2026-08-01', '2026-08-31', 1000)
    .concat(jours('2026-09-01', '2026-09-30', 2000, ['2026-09-14']))
    .concat(jours('2026-10-01', '2026-10-03', 3000));
  return T.moisParMois(js, '2026-08-01', '2026-11-01', []);
};

t('la page est protégée : manager et forfait Professionnel', () => {
  ['nexusRequireAuth()', 'nexusEstManager(employee)', "NexusForfait.nexusRequireProfessional('NEXUS-Tempo-v2-Mois.html', employee.site_id)"]
    .forEach(s => assert.ok(html.includes(s), 'manque : ' + s));
  assert.ok(lire('nexus-forfait.js').includes("'NEXUS-Tempo-v2-Mois.html'"));
  assert.ok(lire('nexus-auth.js').includes("'NEXUS-Tempo-v2-Mois.html'"));
});
t('toute lecture est bornée et filtrée par site, sans écriture', () => {
  assert.ok(!/\.(insert|update|upsert|delete|rpc)\(/.test(html), 'écriture ou rpc');
  const lectures = html.match(/\.from\('[a-z_]+'\)/g) || [];
  assert.ok(lectures.length >= 4);
  assert.ok(/\.eq\('site', siteId\)\.gte\('date', T\.DEBUT_MOIS_PISTE\)\.lte\('date', bornes\.fin\)/.test(html));
  assert.ok(/\.eq\('site', siteId\)\.gte\('date', T\.DEBUT_MOIS_FDJ\)\.lte\('date', bornes\.fin\)/.test(html));
});
t('la tuile du hub est ouverte et mène à la page', () => {
  assert.ok(/<a class="tuile croisee disponible" href="NEXUS-Tempo-v2-Mois\.html">/.test(hub));
  assert.ok(!/favorable/i.test(hub));
});
t('une barre par mois écoulé, hauteur = moyenne et jamais le total', () => {
  const b = T.barresMois(mois(), 'piste');
  assert.deepStrictEqual(b.map(x => x.cle), ['2026-08', '2026-09', '2026-10']);
  assert.strictEqual(b[0].hauteur, 1000);
  assert.strictEqual(b[1].hauteur, 2000);
  assert.notStrictEqual(b[0].hauteur, 31000);
});
t('un mois non retenu garde sa place, sans hauteur, avec la mention', () => {
  const b = T.barresMois(mois(), 'piste')[2];
  assert.strictEqual(b.retenu, false);
  assert.strictEqual(b.hauteur, null);
  assert.ok(b.lignes.includes('non retenu'));
});
t('un mois retenu avec un jour manquant porte un marqueur et la mention', () => {
  const b = T.barresMois(mois(), 'piste')[1];
  assert.strictEqual(b.retenu, true);
  assert.strictEqual(b.marqueManquant, true);
  assert.ok(b.lignes.some(l => /^Jour manquant : /.test(l)), b.lignes.join(' | '));
});
t('l’évolution porte le libellé du moteur, sans tendance ni projection', () => {
  const b = T.barresMois(mois(), 'piste')[1];
  assert.ok(b.lignes.some(l => l.startsWith('Par rapport au mois précédent : ')) || b.lignes.includes(M.sansEvolution));
  assert.ok(!/tendance|projection|moyenne mobile|prévision/i.test(html + vocab.slice(vocab.indexOf('NexusVocab.mois'))));
});
t('sans lexique, le moteur ne dessine rien', () => {
  const sauve = window.NexusVocab; delete window.NexusVocab;
  try { assert.deepStrictEqual(T.barresMois(mois(), 'piste'), []); }
  finally { window.NexusVocab = sauve; }
});
t('le moteur ne porte aucune phrase d’affichage du lot', () => {
  const corps = moteur.slice(moteur.indexOf('function barresMois'), moteur.indexOf('function compositionMoisFdj'));
  assert.ok(!/Moyenne :|non retenu'|Jour manquant|Par rapport/.test(corps.replace(/M\.[a-zA-Z]+/g, '')));
});
t('couleurs d’activité seulement, aucune couleur de statut', () => {
  const graphique = html.slice(html.indexOf('function dessiner'), html.indexOf('nexusRequireAuth().then'));
  assert.ok(/var\(--piste\)|--c-rgb/.test(html));
  assert.ok(!/(green|red|#0a0|#0f0|#f00|--ok|--ko|--vert|--rouge|--danger)/i.test(graphique), 'couleur de statut');
});
t('un tableau repliable donne les mêmes valeurs sous chaque graphique', () => {
  ['<details class="valeurs" id="valeursPiste">', '<details class="valeurs" id="valeursFdj">'].forEach(s => assert.ok(html.includes(s), s));
  assert.ok(/<tr data-cle="/.test(html));
  assert.ok(html.includes('b.hauteur') && html.includes('M.nonRetenu'));
});
t('défilement horizontal sur téléphone et libellés courts', () => {
  assert.ok(/\.defilement\{[^}]*overflow-x:auto/.test(html) || /overflow-x:\s*auto/.test(html));
  assert.ok(html.includes('b.court'));
});
t('plus de phrase « mois le plus haut / le plus bas », ni « favorable » ni « saison »', () => {
  const affiche = (html.replace(/<script[\s\S]*?<\/script>/g, '') + vocab.slice(vocab.indexOf('NexusVocab.mois')));
  assert.ok(!/le plus haut|le plus bas|plus haut|plus bas/i.test(affiche));
  assert.ok(!/favorable|saison/i.test(affiche));
});
t('la boutique n’a aucun chiffre mois par mois : une phrase et les périodes d’import', () => {
  assert.ok(html.includes('id="blocBoutique"') && html.includes('id="phraseBoutique"') && html.includes('id="periodesBoutique"'));
  assert.ok(!/<svg[^>]*boutique/i.test(html));
  assert.ok(M.boutique.periodes(['du 1 avril au 30 juin 2026']).includes('Périodes importées'));
});
t('la note sur l’année précédente est exacte', () => {
  assert.strictEqual(M.anneePrecedente, 'Comparaison avec l’année précédente : pas encore possible, il faudra un an de recul (juillet 2027 au plus tôt pour la piste, janvier 2027 pour la FDJ).');
  assert.ok(html.includes('anneePrecedente'));
});
t('lexique chargé avant le moteur, et textes tirés du lexique', () => {
  assert.ok(html.indexOf('nexus-vocabulaire.js') > -1 && html.indexOf('nexus-vocabulaire.js') < html.indexOf('nexus-tempo.js'));
  assert.ok(html.includes('window.NexusVocab.mois') || html.includes('NexusVocab.mois'));
});
t('aucun tiret cadratin affiché, aucun conseil', () => {
  const bloc = vocab.slice(vocab.indexOf('NexusVocab.mois')).replace(/titreOnglet:[^\n]*\n/, '');
  assert.ok(!/—/.test(bloc), 'tiret cadratin dans le lexique');
  assert.ok(!VERBES.test(bloc), 'verbe de conseil');
  const pieces = [M.titre, M.sousTitre, M.nonRetenuLong, M.sansEvolution, M.fiabilite, M.legendeManquant, M.legendeNonRetenu, M.boutique.phrase, M.anneePrecedente, M.moyenne(1200, M.piste), M.evolution('Hausse', 3.2)].join(' ');
  assert.ok(!/ · | ; |—|\)\s*\(/.test(pieces));
  assert.ok(!VERBES.test(pieces));
});

console.log(echecs ? echecs + ' échec(s)' : 'tous ok');
process.exit(echecs ? 1 : 0);
