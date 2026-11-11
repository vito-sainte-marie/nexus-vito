// Produits phase 1 (refonte visuelle, aucun changement métier) : les fonctions métier restent identiques à production (empreintes figées),
// la page n'affiche aucun emoji de statut, chaque tendance porte sa période, Jour/Nuit via le gabarit commun, structure mobile.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const PAGE = lire('NEXUS-Produits-v1.html');

function extraire(src, signature) {
  const i = src.indexOf(signature);
  assert.ok(i >= 0, 'fonction introuvable : ' + signature);
  const ouvre = src.indexOf('{', i);
  let prof = 0;
  for (let k = ouvre; k < src.length; k++) {
    if (src[k] === '{') prof++;
    else if (src[k] === '}') { prof--; if (prof === 0) return src.slice(i, k + 1); }
  }
  throw new Error('accolade non fermée : ' + signature);
}
// Empreintes sha256 du texte des quatre fonctions gardées, prises sur `production` (blob 1b37da60).
// construireProduitsLive : après fusion de production (lot 2 PR C, indicateur connuParVentes) ; lot 2 PR D retire le calcul de l'ancien statut par article ; empreinte mise à jour aussi par le lot 1 PR B (tendances : moyennes par jour, fraîcheur 21 j, plancher de volume) et calculerStatutSimplifie (une seule tendance par article, recommandation seulement si la comparaison est fiable) — calculerRangRayon et chargerStockGap restent identiques.
// Aucune dépendance à git : la CI en checkout superficiel les mesure sur la source de la branche.
const EMPREINTES = {
  'async function construireProduitsLive': 'a911d070c80e398155eb69dc90e09b85dbf5ee12343e43b57f06335b0892e9ec',
  'function calculerStatutSimplifie': '4e19b7405af3da68933a0c2abefe110cd8e507b189b492fb165c37f887997e23', // lot 2 PR C : enveloppe de NexusConseiller.statutProduit (règle unique, huit statuts)
  'function calculerRangRayon': '6438804858c5a4a80a5923f43952a506f4704a8058df05a158930ce5182379ed',
  'async function chargerStockGap': '3e8ed64835d600f50bedd8b4cfa8439f809a080cd74b3a77841ec0bdd426bc88' // lot 2 PR C, revue Guardian 6783561611 : la ligne de valeur du stock porte « estimation au PMA, relevé du … » (seule ligne modifiée)
};
const empreinte = txt => crypto.createHash('sha256').update(txt).digest('hex');
Object.keys(EMPREINTES).forEach(sig => {
  t('fonction métier identique à production (empreinte) : ' + sig, () => {
    assert.strictEqual(empreinte(extraire(PAGE, sig)), EMPREINTES[sig]);
  });
});
t('la garde de fonctions rougit sur une fonction mutée', () => {
  const mute = PAGE.replace('function calculerRangRayon', 'function calculerRangRayon /*mute*/');
  assert.notStrictEqual(empreinte(extraire(mute, 'function calculerRangRayon')), EMPREINTES['function calculerRangRayon']);
});

// Aucun emoji dans la page (lot 2 PR D : l'ancien calcul de statut, dernier porteur des trois emojis internes, est retiré).
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B06}\u{2B07}]/u;
t('aucun emoji dans la page', () => {
  const fautives = PAGE.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => EMOJI.test(l));
  assert.deepStrictEqual(fautives.map(f => f[0]), []);
});

// La période accompagne chaque tendance.
t('la mention de période est construite depuis pairDates', () => {
  assert.ok(/pairDates/.test(PAGE));
  assert.ok(/const mentionPaire = `<span class="periode-tendance">Comparaison : /.test(PAGE));
});
t('l\'avertissement de paire non courante est conservé', () => {
  assert.ok(/const avertPaire = \(p\.pairDisponible && !p\.pairEstPeriodeAffichee\)/.test(PAGE));
});
t('Explication et Décision portent la période quand elles dépendent de la paire', () => {
  // Une seule ligne de comparaison et un seul avertissement, au pied de la carte (Guardian 6777838697).
  assert.ok(/id="conseillerPaire"/.test(PAGE));
  assert.ok(/\(explicationTendance \|\| actionDependTendance\) \? mentionPaire \+ avertPaire/.test(PAGE));
  assert.ok(!/class="hero-action/.test(PAGE) && !/Action recommandée/.test(PAGE));
  assert.strictEqual((PAGE.match(/\$\{mentionPaire\}|\+ mentionPaire/g) || []).length, 1);
  // Format français et pied de page sans période périmée.
  assert.ok(/replace\('\.', ','\) \+ '\\u00a0%'/.test(PAGE));
  assert.ok(!/Données réelles S1 2026/.test(PAGE));
  assert.ok(/francisationAffichage\(\['heroRotationVal'/.test(PAGE));
});
t('aucune tuile « Évolution T1 → T2 » parmi les indicateurs', () => {
  assert.ok(!/class="kl">Évolution T1/.test(PAGE));
});

// Charte : gabarit commun, thème Jour, badges communs, icônes du kit.
t('bannière commune et thème Jour chargés', () => {
  assert.ok(/nexus-banniere-station\.js/.test(PAGE));
  assert.ok(/nexus-theme\.js/.test(PAGE));
  assert.ok(/nexus-badge-etat\.js/.test(PAGE));
  assert.ok(/id="heroProduits"/.test(PAGE));
});
t('nexus-theme.js est chargé avant le premier script inline', () => {
  assert.ok(PAGE.indexOf('nexus-theme.js') < PAGE.indexOf('<script>'));
});
t('le mode Jour est réglé par le thème commun, sans couleur figée dans la page', () => {
  assert.ok(/var\(--/.test(PAGE));
});
t('le badge « À vérifier » remplace « Suggéré » via le composant commun', () => {
  assert.ok(/NexusBadgeEtat\.gravite\('a-verifier'/.test(PAGE));
});

// Accessibilité de la recherche.
t('recherche : combobox, listbox et cibles tactiles de 44 px', () => {
  assert.ok(/id="searchInput" role="combobox"/.test(PAGE));
  assert.ok(/id="suggestions" role="listbox"/.test(PAGE));
  assert.ok(/\.search-box input\{min-height:44px;\}/.test(PAGE));
  assert.ok(/placeholder="Rechercher un produit \(nom\)"/.test(PAGE));
});
t('aucun bouton code-barres dans la zone de recherche', () => {
  const corps = PAGE.split('<body')[1];
  const zone = corps.slice(corps.indexOf('id="searchInput"') - 400, corps.indexOf('id="suggestions"') + 200);
  assert.ok(!/barre|scan|camera|caméra/i.test(zone));
});

// Structure à 375 px : identité, Conseiller, indicateurs, sections.
t('structure : identité, Conseiller, indicateurs puis sections', () => {
  const corps = PAGE.split('<body')[1];
  const ordre = ['id="resultSection"', 'conseillerProduitMsg', 'heroStockVal', 'Informations complémentaires'].map(s => corps.indexOf(s));
  ordre.forEach(i => assert.ok(i > 0));
  assert.deepStrictEqual(ordre.slice().sort((a, b) => a - b), ordre);
});
t('les identifiants des commandes existantes sont conservés', () => {
  ['photoCardZone','photoTerrainZone','gapStockStatus','gapRotationStatus','gapEmplacementStatus','emplacementPickerZone','btnPrendrePhotoTerrain','inputPhotoTerrain','btnRechercherPhoto','btnModifierEmplacement','emplacementAutreInput','emplacementAutreBtn'].forEach(id => {
    assert.ok(PAGE.indexOf(id) >= 0, 'identifiant perdu : ' + id);
  });
});
t('pas de défilement horizontal prévu (aucune largeur fixe supérieure à 375 px)', () => {
  assert.ok(!/[^-\w]width:\s*(3[89]\d|[4-9]\d\d)px/.test(PAGE.split('<style>')[1].split('</style>')[0].replace(/max-width:[^;}]*/g, '').replace(/min-width:[^;}]*/g, '')));
});

// Aperçu de recette : en mémoire, site de test uniquement.
t('l\'aperçu n\'écrit rien et vise le site de test', () => {
  assert.ok(/apercu_produit/.test(PAGE));
  assert.ok(/nexus-station-test/.test(PAGE));
  const ap = extraire(PAGE, 'function clientApercu');
  assert.ok(!/\.(insert|update|upsert|delete)\(/.test(ap.replace(/insert:|update:|upsert:|delete:/g, '')));
});
console.log(n + ' vérifications');
