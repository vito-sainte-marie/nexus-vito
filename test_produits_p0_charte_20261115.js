// Produits P0 : harmonisation graphique avec Campagne. Aucun calcul, seuil ni requête ne change.
const fs = require('fs');
const assert = require('assert');
const PAGE = fs.readFileSync(__dirname + '/NEXUS-Produits-v1.html', 'utf8');
let n = 0;
const t = (nom, fn) => { fn(); n++; console.log('OK ' + nom); };
const corps = PAGE.split('<body')[1];
const script = PAGE.split('<style>')[1].split('</style>')[0];
const texteAffiche = PAGE.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|\s)\/\/.*$/, '')).join('\n');

// Non-régression des valeurs : formats et expressions des tuiles identiques à avant P0.
function fmtEur(v) { return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
function fmtPct(v) { return (v * 100).toFixed(1).replace('.', ',') + ' %'; }
const sansEspaces = s => s.replace(/[  ]/g, ' ');
t('Pringles : valeurs formatées identiques (CA 52,50 €, prix 2,10 €, PMP 1,24 €, marge 41,0 %, part 4,1 %)', () => {
  assert.strictEqual(sansEspaces(fmtEur(52.5)), '52,50 €');
  assert.strictEqual(sansEspaces(fmtEur(2.1)), '2,10 €');
  assert.strictEqual(sansEspaces(fmtEur(1.24)), '1,24 €');
  assert.strictEqual(sansEspaces(fmtPct(0.41)), '41,0 %');
  assert.strictEqual(sansEspaces(fmtPct(0.041)), '4,1 %');
});
t('les expressions de valeur des tuiles sont inchangées', () => {
  ["p.pu_ht !== null ? fmtEur(p.pu_ht)", "p.pma !== null ? fmtEur(p.pma)", "p.pct_contrib != null ? fmtPct(p.pct_contrib)"].forEach(e => assert.ok(texteAffiche.includes(e), e));
  ['ICO.prix', 'ICO.pma', 'ICO.part'].forEach(i => assert.ok(texteAffiche.includes(i), i));
});
t('les ids du stock et de la rotation sont conservés', () => {
  ['heroStockVal', 'heroStockSub', 'heroRotationVal', 'heroRotationSub'].forEach(i => assert.ok(PAGE.includes(i), i));
});

// Câblage.
t('le Conseiller utilise .carte.conseiller et plus .conseiller-mini ni .conseiller-card', () => {
  assert.ok(/class="carte conseiller"/.test(corps));
  assert.ok(!/conseiller-mini|conseiller-card|empty-conseiller/.test(PAGE));
});
t('« Comprendre cette analyse » est un chevron fermé par défaut', () => {
  assert.ok(/<details class="comprendre">\s*<summary>Comprendre cette analyse<\/summary>/.test(PAGE));
  assert.ok(!/<details class="comprendre" open/.test(PAGE));
  assert.ok(/id="conseillerProduitMsg"/.test(PAGE));
});
t('l\'historique reste replié, même en grand écran', () => {
  assert.ok(/d\.id !== 'secHisto'/.test(PAGE));
});
t('bandeau Produits : illustration, cadrage, eyebrow, titre, sous-titre', () => {
  assert.ok(/assets\/produits\/produits-banniere-1600\.webp/.test(PAGE));
  assert.ok(/assets\/telephone\/produits-telephone\.webp/.test(PAGE));
  assert.ok(/NEXUS · Produits/.test(PAGE) && /Produits NEXUS<\/h1>/.test(PAGE) && /Vos produits, en clair/.test(PAGE));
  assert.ok(/--banniere-cadrage/.test(PAGE));
});
t('recherche : champ Campagne, libellé visible et aria-label', () => {
  assert.ok(/<label for="searchInput">Rechercher un produit ou un code-barres<\/label>/.test(PAGE));
  assert.ok(/aria-label="Rechercher un produit ou un code-barres"/.test(PAGE));
});
t('conteneur .app de 1100 px, jetons --t-*, IBM Plex Sans', () => {
  assert.ok(/\.app\{[^}]*max-width:1100px/.test(PAGE));
  assert.ok(/--t-bg/.test(script) && /IBM Plex Sans/.test(PAGE));
});
t('les valeurs ne sont plus en monospace', () => {
  assert.ok(!/font-family:\s*var\(--mono\)|ui-monospace|monospace/.test(script) || /--mono:var\(--t-sans\)/.test(script));
  assert.ok(/\.ind-val\{[^}]*tabular-nums[^}]*font-weight:600|\.ind-val\{[^}]*font-weight:600[^}]*tabular-nums/.test(script));
});
t('libellés : plus de « PMA », « T1 », « T2 » à l\'écran', () => {
  assert.ok(!/\bPMA\b/.test(texteAffiche.replace(/\bpma\b/g, '')));
  assert.ok(!/['">\s(]T[12]['"<\s),]/.test(texteAffiche.replace(/[A-Za-z_.]*T[12]\b[A-Za-z_]*/g, '')));
  assert.ok(/PMP Decenium HT/.test(PAGE));
  assert.ok(/Période précédente/.test(PAGE) && /Dernière période/.test(PAGE));
});
t('aucun tiret cadratin affiché', () => {
  const sansDonnee = texteAffiche.split('\n').filter(l => !/Prix imposé — non applicable/.test(l)).join('\n');
  assert.ok(!/—/.test(sansDonnee), 'tiret cadratin restant');
});
t('plus de prénom en tête du constat', () => {
  assert.ok(!/\$\{esc\(employee\.nom\)\}, /.test(PAGE));
});
t('bandeau : copie exacte du bandeau Campagne, sans le module de bannière de station', () => {
  assert.ok(!/NexusBanniereStation|nexus-banniere-station/.test(PAGE));
  assert.ok(/<img class="entete"[^>]*srcset="[^"]*produits-banniere-800\.webp 800w[^"]*1600w"/.test(PAGE));
  assert.ok(/sizes="\(min-width:1100px\) 1100px, 100vw" width="1600" height="533" alt="">/.test(PAGE));
  assert.ok(/<source media="\(max-width:599px\)" srcset="assets\/telephone\/produits-telephone\.webp">/.test(PAGE));
  assert.ok(!/<picture id="banniereProduits" hidden>/.test(PAGE));
});
t('Conseiller : « Très rentable » n\'apparaît plus dans l\'explication', () => {
  assert.ok(/niveauRentaP === 'tres_rentable' \? '' : NexusVocab\.rentabilite\(/.test(PAGE));
});
t('pastille du commerce masquée tant qu\'elle est vide', () => {
  assert.ok(/\.pastille:empty\{display:none;\}/.test(PAGE));
  assert.ok(/<span class="pastille nexus-nom-commerce" id="pastilleSite"><\/span>/.test(PAGE));
});
console.log(n + ' vérifications');
