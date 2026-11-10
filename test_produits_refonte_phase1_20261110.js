// Produits phase 1 (refonte visuelle, aucun changement métier) : les fonctions métier restent identiques à origin/production,
// la page n'affiche aucun emoji de statut, chaque tendance porte sa période, Jour/Nuit via le gabarit commun, structure mobile.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
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
let REF = null;
try { REF = cp.execSync('git show origin/production:NEXUS-Produits-v1.html', { cwd: __dirname, maxBuffer: 1 << 26 }).toString('utf8'); } catch (e) { REF = null; }

const GARDEES = ['async function construireProduitsLive', 'function calculerStatutSimplifie', 'function calculerRangRayon', 'async function chargerStockGap'];
GARDEES.forEach(sig => {
  t('fonction métier identique à origin/production : ' + sig, () => {
    assert.ok(REF, 'origin/production doit être disponible (git fetch origin production)');
    assert.strictEqual(extraire(PAGE, sig), extraire(REF, sig));
  });
});
t('la garde de fonctions rougit sur une fonction mutée', () => {
  const mute = PAGE.replace('function calculerRangRayon', 'function calculerRangRayon /*mute*/');
  assert.notStrictEqual(extraire(mute, 'function calculerRangRayon'), extraire(PAGE, 'function calculerRangRayon'));
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
  assert.ok(/explicationTendance \? ' ' \+ mentionPaire/.test(PAGE));
  assert.ok(/actionDependTendance \? ' ' \+ mentionPaire/.test(PAGE));
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
t('modules métier interdits non modifiés', () => {
  ['nexus-periodes.js', 'nexus-conseiller.js', 'nexus-vocabulaire.js'].forEach(f => {
    const d = cp.execSync('git diff --name-only origin/production -- ' + f, { cwd: __dirname }).toString().trim();
    assert.strictEqual(d, '');
  });
});
console.log(n + ' vérifications');
