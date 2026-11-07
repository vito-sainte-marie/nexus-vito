// Contrôle inventaire — Manager, lot 4 (iPhone et clair, 06/11/2026). Présentation seulement :
// pictogrammes du kit, 4e tuile Decenium, lignes de catégorie, onglets et barre basse iPhone.
const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync(__dirname + '/NEXUS-Inventaire-Manager-v1.html', 'utf8');
const pil = fs.readFileSync(__dirname + '/nexus-composants-pilotage.js', 'utf8');
const NCP = require('./nexus-composants-pilotage.js');
let n = 0;
function t(nom, f) { f(); n++; console.log('  ok - ' + nom); }

t('les 8 pictogrammes du kit sont présents, en currentColor', () => {
  ['cigarettes', 'gaz', 'glacons', 'stock', 'comptage', 'anomalies', 'recomptage', 'decenium'].forEach(k =>
    assert(new RegExp('\\b' + k + ': \'<').test(html), 'pictogramme ' + k));
  assert(/stroke="currentColor" stroke-width="3"/.test(html));
});
t('la tuile échappe le libellé mais laisse passer le pictogramme', () => {
  const h = NCP.tuile({ valeur: 1, libelle: '<b>x</b>', icone: '<svg class="np-tuile-ico"></svg>', cible: 'c' });
  assert(h.includes('<svg class="np-tuile-ico"></svg>&lt;b&gt;x&lt;/b&gt;'));
});
t('4e tuile Decenium alimentée par l\'état réel (import + snapshot)', () => {
  assert(html.includes("libelle: 'Decenium'") && html.includes("cible: 'photoDeceniumCard'"));
  assert(html.includes('importFait: ctx.importDeceniumFait, snapshotActif: ctx.snapshotActif'));
  assert(/id="photoDeceniumCard"/.test(html));
  assert(/body\.nexus-desktop \.indicateurs\{grid-template-columns:repeat\(4/.test(html));
});
t('ligne de catégorie : pourcentage, pastille À compléter/Terminé, chevron', () => {
  assert(html.includes("pill('À compléter', 'todo')") && html.includes("pill('Terminé', 'ok')"));
  assert(html.includes('${c.comptes} / ${c.total} · ${pct} %'));
});
t('aucun chiffre de la maquette (106/111) ni bloc « Progression du comptage »', () => {
  assert(!/106\s*\/\s*111/.test(html) && !html.includes('Progression du comptage'));
});
t('le Conseiller garde son avatar', () => {
  assert(html.includes('<img class="conseiller-avatar" src="nexus-avatar.png"'));
});
t('fiche : « (périmètre antérieur) » si valeur_attendue vide', () => {
  assert(html.includes("' (périmètre antérieur)'"));
});
t('iPhone : onglets Comptages/Décisions et barre basse, cibles >= 44 px', () => {
  assert(html.includes('data-onglet="comptages"') && html.includes('data-onglet="decisions"'));
  assert(html.includes('data-aller="photoDeceniumCard"') && html.includes('Voir les manquants'));
  assert(/\.inv-onglet\{[^}]*min-height:44px/.test(html) && /\.inv-barre-btn\{[^}]*min-height:44px/.test(html));
});
t('la règle column-span du lot 2 est inchangée', () => {
  assert(html.includes('body.nexus-desktop .desktop-grid>.indicateurs,body.nexus-desktop .desktop-grid>.conseiller-card{column-span:all}'));
});
t('aucune couleur hexadécimale ajoutée hors :root', () => {
  const css = html.split(/<style[^>]*>/).slice(1).map(x => x.split('</style>')[0]).join('\n');
  const horsRoot = css.replace(/:root[^{]*\{[^}]*\}/g, '');
  const ajout = ['.inv-onglet', '.inv-barre', '.inv-titre-icone', '.np-tuile-ico'].every(k => !new RegExp(k.replace('.', '\\.') + '[^}]*#[0-9a-fA-F]{3,6}').test(horsRoot));
  assert(ajout);
});
console.log(n + ' vérifications passées');
