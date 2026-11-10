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
// construireProduitsLive : empreinte mise à jour par le lot 1 PR B (tendances : moyennes par jour, fraîcheur 21 j, plancher de volume) et calculerStatutSimplifie (une seule tendance par article, recommandation seulement si la comparaison est fiable) — calculerRangRayon et chargerStockGap restent identiques.
// Aucune dépendance à git : la CI en checkout superficiel les mesure sur la source de la branche.
const EMPREINTES = {
  'async function construireProduitsLive': '95667337c3f079c4af41056c555cc776bf0df90d724121e59a7c1e4d21cd9f26',
  'function calculerStatutSimplifie': '4c266d296712f0aa725f0a09ed5826170939875af78946a5fc6e2cf4110c9458', // lot 1 PR B sur production après PR A : tendance unique + esc() de la PR A conservé
  'function calculerRangRayon': '6438804858c5a4a80a5923f43952a506f4704a8058df05a158930ce5182379ed',
  'async function chargerStockGap': 'e59c35cbce7871eec1f18724af1e56b6c1985a7f8fad062281daa183146a7c5b'
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

// Aucun emoji de statut dans le rendu : seuls les trois libellés internes de calculerStatutSimplifie restent.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B06}\u{2B07}]/u;
t('aucun emoji de statut hors des trois libellés internes', () => {
  const lignes = PAGE.split('\n');
  const fautives = lignes.map((l, i) => [i + 1, l]).filter(([, l]) => EMOJI.test(l));
  const internes = fautives.filter(([, l]) => /etat:\s*'(🔥 À AGIR|📈 OPPORTUNITÉ|🟡 À SURVEILLER)'/u.test(l));
  assert.strictEqual(internes.length, 3, 'les trois emojis internes doivent rester');
  assert.deepStrictEqual(fautives.filter(f => !internes.includes(f)).map(f => f[0]), []);
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
