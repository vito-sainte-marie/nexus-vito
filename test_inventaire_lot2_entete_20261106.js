// Contrôle inventaire — lot 2 (06/11/2026) : en-tête et indicateurs. Présentation seulement.
const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync(__dirname + '/NEXUS-Inventaire-Manager-v1.html', 'utf8');
const premium = fs.readFileSync(__dirname + '/nexus-inventaire-manager-premium-v2.js', 'utf8');
const cas = [];
const verifier = (nom, f) => cas.push([nom, f]);

verifier('l\'horloge à la seconde est retirée', () => {
  assert.ok(!/heureLive|dateLive|demarrerHorloge|heureLocale/.test(html));
});
verifier('les pastilles décoratives sont retirées', () => {
  assert.ok(!/ajouterMetaEntete|Pilotage terrain|Inventaire V2|Vue manager/.test(premium));
});
verifier('le « Le saviez-vous ? » orange est retiré, le lien Paramètres reste', () => {
  assert.ok(!/tipParametresInventaire|btnFermerTip|tip-banniere/.test(html));
  assert.ok(html.includes('NEXUS-Parametres-Inventaire-v1.html'));
});
verifier('plus de double affichage Brief / Progression', () => {
  assert.ok(!/renderBriefInventaire|renderSyntheseQuart|synthese-titre">Brief/.test(html));
  assert.ok(html.includes('renderIndicateurs('));
});
verifier('en-tête : titre, sélecteur jour/quart, état, actions', () => {
  ['id="titre"', 'id="btnJourPrec"', 'id="selDate"', 'id="btnJourSuiv"', 'data-quart="matin"', 'data-quart="soir"',
   'id="enteteEtat"', 'NEXUS-Stock-Localise-v1.html', 'id="btnVoirManquants"'].forEach(x => assert.ok(html.includes(x), x));
});
verifier('trois tuiles cliquables avec info et cible', () => {
  ["info: 'comptes'", "info: 'manquants'", "info: 'anomalies'", "cible: 'sectionAControler'", 'id="sectionAControler"']
    .forEach(x => assert.ok(html.includes(x), x));
});
verifier('la logique de clôture et ses textes sont inchangés', () => {
  ["Clôture possible", "Le comptage de clôture n'a pas encore commencé.",
   "Clôture impossible tant que l'inventaire d'ouverture n'est pas terminé.",
   'Clôture impossible tant que les comptages manquants ne sont pas terminés', 'Clôture en retard — '
  ].forEach(x => assert.ok(html.includes(x), x));
});
verifier('les garde-fous existants sont intacts (Rouvrir la clôture, jamais « pas encore commencé » au passé)', () => {
  ['btnRouvrirCloture', 'motifRouverture', 'btnConfirmerRouverture', 'btnAnnulerRouverture'].forEach(x => assert.ok(html.includes(x), x));
});
verifier('la bannière est derrière le texte et les cibles tactiles font 44 px', () => {
  assert.ok(/\.header>\.am-banniere\{position:absolute;inset:0/.test(html));
  assert.ok(/\.btn-jour\{min-width:44px;min-height:44px/.test(html));
});
verifier('Conseiller : une ligne et « Pourquoi ? »', () => {
  assert.ok(html.includes('btnPourquoi') && html.includes('Pourquoi ?'));
});

let ko = 0;
cas.forEach(([nom, f]) => { try { f(); console.log('ok  ' + nom); } catch (e) { ko++; console.log('KO  ' + nom + ' — ' + e.message); } });
if (ko) process.exit(1);
