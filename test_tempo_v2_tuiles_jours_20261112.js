// Tempo V2 — carte « Jours forts et faibles » : tuiles, lecture Tempo, axe gradué. Aucun calcul G5 modifié.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = {};
require('./nexus-vocabulaire.js');
require('./nexus-tempo.js');
const T = window.NexusTempo;
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Tempo-v2-Jours.html'), 'utf8');
const moteur = fs.readFileSync(path.join(__dirname, 'nexus-tempo.js'), 'utf8');

let echecs = 0;
function t(nom, fn) {
  try { fn(); console.log('  ok   ' + nom); }
  catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); }
}
function serie(f, debut, nb) {
  const o = [], d0 = new Date(debut + 'T12:00:00Z');
  for (let i = 0; i < nb; i++) { const d = new Date(d0.getTime() + i * 864e5); o.push({ date: d.toISOString().slice(0, 10), valeur: f(d.getUTCDay(), Math.floor(i / 7)) }); }
  return o;
}
const BORNES = { debut: '2026-09-14', fin: '2026-11-08' };
// Cas CA Boutique : samedi désigné (régulier), vendredi plus forte moyenne mais « Variation habituelle » et très irrégulier.
const FR = [-1900, -700, 1300, 300, -1300, 700, 1900, -300].map(x => 5460 + x);
const SA = [-700, 600, -500, 700, -300, 500, -600, 300].map(x => 5338 + x);
const N = [-900, 500, -300, 800, -600, 300, -700, 900];
const BOUTIQUE = serie((js, w) => ({ 1: 4800 + N[w], 2: 4700 + N[(w + 2) % 8], 3: 4066 + N[(w + 4) % 8] * 0.6, 4: 4800 + N[(w + 6) % 8], 5: FR[w], 6: SA[w], 0: 4750 + N[(w + 1) % 8] })[js], '2026-09-14', 56);
const PLAT = serie((js, w) => 5000 + N[(w + js) % 8] * 0.3, '2026-09-14', 56);

const res = T.joursFortsFaibles(BOUTIQUE, BORNES, []);
const lig = T.lignesJours(res, 'boutique');
const tuile = (lg, cote, role) => lg.tuiles[cote].find(x => x.role === role);

t('cas Boutique : jour fort récurrent samedi, plus forte moyenne vendredi, jour faible récurrent mercredi', () => {
  assert.strictEqual(res.etat, 'designe');
  const fort = tuile(lig, 'haut', 'recurrent'), moy = tuile(lig, 'haut', 'moyenne'), faible = tuile(lig, 'bas', 'recurrent');
  assert.strictEqual(fort.titre, 'Jour fort récurrent');
  assert.strictEqual(fort.nom, 'Samedi');
  assert.strictEqual(fort.moyenne.replace(/\s/g, ' '), '5 338 € par jour');
  assert.strictEqual(fort.etiquette, 'Nettement au-dessus');
  assert.ok(/^\+\d[\d ]* €\/jour$/.test(fort.ecart));
  assert.strictEqual(moy.titre, 'Plus forte moyenne');
  assert.strictEqual(moy.nom, 'Vendredi');
  assert.strictEqual(moy.moyenne.replace(/\s/g, ' '), '5 460 € par jour');
  assert.strictEqual(moy.irregulier, 'Activité irrégulière');
  assert.strictEqual(faible.titre, 'Jour faible récurrent');
  assert.strictEqual(faible.nom, 'Mercredi');
  assert.strictEqual(faible.etiquette, 'Nettement en dessous');
  assert.strictEqual(lig.tuiles.bas.length, 1, 'plus faible moyenne absente quand c’est le même jour');
});
t('la lecture Tempo, mot pour mot, et sa ligne de preuve', () => {
  assert.ok(lig.tuiles.lecture.startsWith('Le vendredi réalise le chiffre d’affaires moyen le plus élevé, mais ses résultats varient fortement d’une semaine à l’autre. Le samedi se distingue par une activité supérieure plus régulière. À l’inverse, le mercredi reste le jour le plus bas, clairement sous les autres.'));
  assert.ok(/8 vendredis/.test(lig.tuiles.preuve) && /8 samedis/.test(lig.tuiles.preuve) && /Qualification selon G5/.test(lig.tuiles.preuve));
  assert.ok(!/—/.test(lig.tuiles.lecture));
});
function sansRepetitionLecture(txt) {
  const verbes = txt.match(/\b(réalise|enregistre|affiche|reste|se détache|se distingue|ressort|varient|passe)\b/g) || [];
  assert.strictEqual(new Set(verbes).size, verbes.length, 'verbe répété : ' + verbes.join(', '));
  assert.ok((txt.match(/nettement/g) || []).length <= 1, '« nettement » répété');
  assert.ok((txt.match(/clairement/g) || []).length <= 1, '« clairement » répété');
  const noms = txt.match(/\b(chiffre d’affaires moyen|volume moyen)\b/g) || [];
  assert.ok(noms.length <= 1, 'nom porteur répété : ' + noms.join(', '));
  assert.ok(!/\)\s*\(| · | ; |—/.test(txt), 'séparateur interdit');
}
['piste', 'fdj', 'boutique'].forEach(cle => {
  const fortSeul = serie((js, w) => ({ 1: 4800 + N[w], 2: 4700 + N[(w + 2) % 8], 3: 4600 + N[(w + 4) % 8], 4: 4800 + N[(w + 6) % 8], 5: 4900 + N[(w + 3) % 8], 6: 6400 + SA[w] - 5338, 0: 4750 + N[(w + 1) % 8] })[js], '2026-09-14', 56);
  [BOUTIQUE, fortSeul].forEach((sr, i) => {
    t('lecture Tempo sans répétition : ' + cle + ' série ' + (i + 1), () => {
      const r = T.joursFortsFaibles(sr, BORNES, []);
      if (r.etat !== 'designe') return;
      const l = T.lignesJours(r, cle).tuiles.lecture;
      assert.ok(l.length > 0);
      sansRepetitionLecture(l);
    });
  });
});
t('tuiles : une colonne sur téléphone, deux colonnes dès 640 px (haut sur une ligne, bas sur la suivante)', () => {
  assert.ok(/\.tuiles-jours \.rang\{[^}]*grid-template-columns:1fr/.test(html));
  assert.ok(html.includes('tu.haut.concat(tu.bas)') && html.includes('rang(tous)') && !html.includes('rang(tu.haut)'), 'une seule grille pour haut puis bas');
  assert.ok(/@media \(min-width:640px\)\{\.tuiles-jours \.rang\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(html));
});
t('plus forte moyenne : absente quand c’est le jour récurrent lui-même', () => {
  const fortSeul = serie((js, w) => ({ 1: 4800 + N[w], 2: 4700 + N[(w + 2) % 8], 3: 4600 + N[(w + 4) % 8], 4: 4800 + N[(w + 6) % 8], 5: 4900 + N[(w + 3) % 8], 6: 6400 + SA[w] - 5338, 0: 4750 + N[(w + 1) % 8] })[js], '2026-09-14', 56);
  const r = T.joursFortsFaibles(fortSeul, BORNES, []);
  assert.strictEqual(r.etat, 'designe');
  const l = T.lignesJours(r, 'boutique');
  assert.ok(tuile(l, 'haut', 'recurrent'));
  assert.ok(!tuile(l, 'haut', 'moyenne'));
});
t('« Activité irrégulière » seulement si le CV atteint 1,5 fois celui du jour de référence', () => {
  const clone = (cvJour) => {
    const r = JSON.parse(JSON.stringify(res));
    const ref = r.parJour.find(p => p.jourSemaine === 6), ven = r.parJour.find(p => p.jourSemaine === 5);
    ref.cv = 0.138; ven.cv = cvJour;
    return r;
  };
  assert.strictEqual(T.RATIO_CV_IRREGULIER, 1.5);
  const a = T.tuilesJours(clone(0.223)).haut.moyenne;
  assert.strictEqual(a.irregulier, true, 'rapport 1,6 : affiché');
  const b = T.tuilesJours(clone(0.166)).haut.moyenne;
  assert.strictEqual(b.irregulier, false, 'rapport 1,2 : non affiché');
});
t('aucune tuile hors de l’état « designe »', () => {
  const plat = T.joursFortsFaibles(PLAT, BORNES, []);
  assert.notStrictEqual(plat.etat, 'designe');
  assert.strictEqual(T.tuilesJours(plat), null);
  assert.strictEqual(T.lignesJours(plat, 'boutique').tuiles, null);
  const peu = T.joursFortsFaibles(BOUTIQUE.slice(0, 20), BORNES, []);
  assert.notStrictEqual(peu.etat, 'designe');
  assert.strictEqual(T.tuilesJours(peu), null);
});
t('les deux textes sont distincts : jours qui se ressemblent, données insuffisantes', () => {
  const ress = T.lignesJours(T.joursFortsFaibles(PLAT, BORNES, []), 'boutique');
  const insuf = T.lignesJours(T.joursFortsFaibles(BOUTIQUE.slice(0, 20), BORNES, []), 'boutique');
  assert.strictEqual(ress.constat, 'Aucun jour ne ressort nettement des autres.');
  assert.ok(insuf.constat && insuf.constat !== ress.constat);
  assert.ok(!/Aucun jour ne ressort/.test(insuf.constat));
});
t('le moteur ne porte aucun mot d’affichage dans tuilesJours', () => {
  const corps = moteur.slice(moteur.indexOf('function tuilesJours('), moteur.indexOf('window.NexusTempo = {')).replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/Jour fort|Plus forte|Activité irrégulière|Lecture Tempo|Nettement|réalise|rythme potentiel/.test(corps.slice(0, corps.indexOf('function ', 30) > 0 ? corps.indexOf('function ', 30) : corps.length)), 'mot d’affichage dans le moteur');
});
t('la page charge le lexique avant le moteur et branche les tuiles', () => {
  assert.ok(html.indexOf('nexus-vocabulaire.js') > -1 && html.indexOf('nexus-vocabulaire.js') < html.indexOf('nexus-tempo.js'));
  ['id="tuilesPiste"', 'id="tuilesFdj"', 'id="tuilesBoutique"', 'l.tuiles', 'lecture-tempo'].forEach(s => assert.ok(html.includes(s), 'manque : ' + s));
});
t('aucune couleur de statut sur les tuiles : couleur d’activité seule', () => {
  const css = html.slice(html.indexOf('.tuiles-jours'), html.indexOf('.graphique'));
  assert.ok(/rgba\(var\(--c-rgb\)/.test(css));
  assert.ok(!/--(ok|bad|good|warn|danger|vert|rouge|green|red)|#(0f0|f00|2e7d32|c62828)/i.test(css), 'couleur de statut dans le CSS des tuiles');
});
t('axe gradué : part de zéro, hauteur de graphique fixe, graduations sans vert ni rouge', () => {
  assert.ok(/HAUT = 230/.test(html), 'hauteur fixe 230');
  assert.ok(/for \(let v = 0; v <= sommet/.test(html) || /v = 0;/.test(html), 'l’axe part de 0');
  assert.ok(/etiquetteAxe/.test(html));
  assert.ok(/viewBox="0 0 ' \+ largeur \+ ' ' \+ HAUT/.test(html), 'la hauteur ne dépend pas du nombre de jours lisibles');
  const css = html.slice(html.indexOf('.axe-grille') - 30, html.indexOf('.axe-graduation') + 60);
  assert.ok(!/green|red|#0f0|#f00/i.test(css));
});
t('le graphique reste affiché sauf quand il n’y a aucune donnée', () => {
  const corps = html.slice(html.indexOf('function dessiner'), html.indexOf('function dessiner') + 1200);
  const retours = corps.match(/etat === '([a-z]+)'\) \{[^}]*return/g) || [];
  assert.ok(retours.some(x => /absent/.test(x)));
  assert.ok(!retours.some(x => /ressemblent|insuffisant/.test(x)));
});

console.log(echecs ? echecs + ' échec(s)' : 'tous ok');
process.exit(echecs ? 1 : 0);
