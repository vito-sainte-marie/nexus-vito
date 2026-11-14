'use strict';
// Campagne V2 : derniers ajustements de la page principale (présentation et ergonomie seulement).
const assert = require('assert'), fs = require('fs'), path = require('path');
const page = fs.readFileSync(path.join(__dirname, 'NEXUS-Campagne-v2.html'), 'utf8');
const voc = fs.readFileSync(path.join(__dirname, 'nexus-vocabulaire.js'), 'utf8');
let ko = 0;
const t = (n, f) => { try { f(); console.log('ok   ' + n); } catch (e) { ko++; console.log('FAIL ' + n + ' : ' + e.message); } };
const fn = (a, b) => { const i = page.indexOf(a), j = page.indexOf(b, i + 1); assert(i >= 0 && j > i, a); return page.slice(i, j); };

t('ordre : conseiller, en cours, six cartes, dernier bilan, historique', () => {
  const ids = ['id="conseiller"', 'id="enCours"', 'id="tuiles"', 'id="derniere"', 'id="historique"'].map(k => page.indexOf(k));
  ids.forEach(i => assert(i > 0));
  assert.deepStrictEqual(ids.slice().sort((a, b) => a - b), ids, 'ordre des sections');
});
t('promotion en cours : aucun résultat commercial, compensation « à mesurer » tant que la mesure n\'est pas faite', () => {
  const c = fn('function carteResume', 'function bilanPanier');
  assert(!/evolution|moyPendant|bilan commercial.*%/i.test(c), 'résultat commercial dans la carte en cours');
  assert(/mesureEntamee\(i\)/.test(c) && /E\.aMesurer/.test(c));
  assert(!/data-consulter/.test(c), 'Consulter sur la carte en cours');
});
t('dernier bilan : quatre tuiles, pas de doublon avec l\'historique, une seule phrase « À retenir »', () => {
  const b = fn('function bilanVisuel', 'function conclusionBilan');
  assert(/data-bilan-detail/.test(b) && /data-modifier/.test(b) && !/data-consulter/.test(b));
  assert(/terminees\.filter\(i => i\.campagneId !== BILAN_COURANT\)/.test(page), 'historique sans la campagne en vedette');
  assert(page.includes('V.historiqueAucune') && /historiqueAucune: *'Aucune autre campagne terminée pour l.instant\./.test(voc));
  assert(!/ont légèrement progressé/.test(page + voc));
  assert(/phraseRetenir/.test(b));
});
t('chiffres du bilan sans monospace', () => {
  assert(/\.b-val\{[^}]*var\(--t-sans\)/.test(page) && /\.b-barre-val\{[^}]*var\(--t-sans\)/.test(page));
  assert(!/\.b-(val|barre-val)\{[^}]*mono/.test(page));
});
t('interactions Tempo réservées aux cartes disponibles', () => {
  assert(/\.tuile\.disponible:hover/.test(page) && /\.tuile\.disponible:focus-visible/.test(page) && /\.tuile\.disponible:active/.test(page));
  assert(!/(^|\n)\.tuile:hover|button\.tuile/.test(page));
  assert(/aria-disabled="true"/.test(page) && /\.tuile\.prioritaire/.test(page));
});
t('calcul, seuil et règles de comparaison non touchés', () => {
  assert(!/nbJoursAvantPanier *=|seuil *=|MIN_JOURS *=/.test(fn('function bilanVisuel', 'function conclusionBilan')));
});
t('tuiles du bilan : valeur, unité, évolution seulement', () => {
  const f = fn('function tuileIndicateur', 'function graphiqueBilan');
  assert(!/vsAvant|fenetre|moyAvant/.test(f), 'répétition de la fenêtre ou de la valeur avant dans la tuile');
  assert(/fmtPct\(g\.evolution\)/.test(f));
  assert(/B\.fenetre\(/.test(fn('function detailBilan', 'function bilanVisuel')), 'fenêtre dans le bilan complet');
});
t('en-tête du bilan : une ligne, objectif dans le bilan complet', () => {
  const b = fn('function bilanVisuel', 'function carteBilan');
  assert(/fmtPeriodeCourte\(i\)/.test(b) && !/objectifSpan/.test(b.split("'<div class=\"b-tuiles\">'")[0]));
  assert(/ligne\(B\.objectif,/.test(fn('function detailBilan', 'function bilanVisuel')));
});
t('rentabilité : icône officielle premium, texte court', () => {
  const r = fn('function tuileRenta', 'function phraseRetenir');
  assert(/ico\('rentabilite-'/.test(r) && !/simple\//.test(r) && /rentaManqueCourt/.test(r));
  assert(/rentaManqueCourt: 'Données de marge à compléter'/.test(voc));
  assert(/B\.rentaManque\b/.test(fn('function detailBilan', 'function bilanVisuel')));
});
t('conseiller : titre 18 px semi-gras, sans « Dernier bilan : »', () => {
  assert(/\.conseiller-sous\{[^}]*font-size:18px[^}]*font-weight:600/.test(page));
  assert(!/conseillerDernierBilan/.test(page));
});
t('en cours : un seul libellé, vignette mobile 64 px', () => {
  assert(!/ec-surtitre">/.test(fn('function carteResume', 'function bilanPanier')));
  assert(/@media \(max-width:767px\)\{[^\n]*\.ec-vignette\{width:64px; height:64px;/.test(page));
});
console.log(ko ? ko + ' échec(s)' : 'tout est vert'); process.exit(ko ? 1 : 0);
