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

verifier('retouche 1 : tuiles et Conseiller arrivent avant l\'état de confiance', () => {
  const t = html.slice(html.indexOf("document.getElementById('content').innerHTML = `"));
  const iT = t.indexOf('renderIndicateurs(synthese'), iC = t.indexOf('id="conseillerCard"'), iE = t.indexOf('renderEtatConfiance(');
  assert.ok(iT > 0 && iT < iC && iC < iE, [iT, iC, iE].join(','));
  assert.ok(t.indexOf('renderSelecteurPeriode()') > iC && t.indexOf('renderCouverturePhysique(') > iC);
});
verifier('retouche 2 : la bannière porte le texte de clôture, orange si incomplet ; la carte État du quart est retirée', () => {
  assert.ok(!html.includes('etat-quart-card') && !html.includes('renderEtatQuartCard'));
  assert.ok(/etat && etat\.texte \? etat\.texte/.test(html));
  assert.ok(/synthese && synthese\.manquants > 0 \? 'todo' : 'ok'/.test(html));
  assert.ok(html.indexOf('id="enteteEtat"') < html.indexOf('id="enteteSelecteur"'));
});
verifier('retouche 3 : Matin | Soir en segment, sur une ligne au bureau, pleine largeur sous la date en mobile', () => {
  assert.ok(/<div class="segment-quart"[^>]*>\s*<div class="quart-pill" data-quart="matin">Matin<\/div>\s*<div class="quart-pill" data-quart="soir">Soir<\/div>/.test(html));
  assert.ok(/\.entete-selecteur\{[^}]*flex-wrap:nowrap/.test(html));
  assert.ok(/\.segment-quart\{flex:1 0 100%/.test(html));
});
verifier('retouche 4 : bannière mobile ≤ 180 px avec voile, jetons seulement', () => {
  const m = html.match(/@media \(max-width:640px\)\{\s*\.header>\.am-banniere\{[^}]*height:(\d+)px/);
  assert.ok(m && Number(m[1]) <= 180);
  assert.ok(/\.header>\.am-banniere::after\{background:linear-gradient\(to right,var\(--bg\) 0%,var\(--bg\) 55%/.test(html));
});

let ko = 0;
cas.forEach(([nom, f]) => { try { f(); console.log('ok  ' + nom); } catch (e) { ko++; console.log('KO  ' + nom + ' — ' + e.message); } });
if (ko) process.exit(1);
