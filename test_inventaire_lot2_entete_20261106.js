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
verifier('retouche 4 : bannière courte (≤ 180 px) dès que la vue bureau est absente, pas seulement sous 640 px', () => {
  const m = html.match(/body:not\(\.nexus-desktop\) \.header>\.am-banniere\{[^}]*height:(\d+)px/);
  assert.ok(m && Number(m[1]) <= 180);
  assert.ok(/body:not\(\.nexus-desktop\) \.header>\.am-banniere::after\{background:linear-gradient\(to right,var\(--bg\) 0%,var\(--bg\) 55%/.test(html));
  assert.ok(!/@media \(max-width:640px\)\{\s*\.header>\.am-banniere/.test(html));
});
verifier('retouches 2e série : bureau pleine largeur, date lisible, état sur une ligne, ligne de clôture résiduelle retirée', () => {
  assert.ok(/body\.nexus-desktop \.desktop-grid>\.indicateurs,body\.nexus-desktop \.desktop-grid>\.conseiller-card\{column-span:all\}/.test(html));
  assert.ok(/\.entete-selecteur \.date-input\{[^}]*min-width:(\d+)px/.test(html) && Number(html.match(/\.entete-selecteur \.date-input\{[^}]*min-width:(\d+)px/)[1]) >= 140);
  assert.ok(Number(html.match(/\.entete-texte\{[^}]*max-width:(\d+)px/)[1]) >= 520);
  assert.ok(html.includes("clotureClasse === 'attente' ? ''"));
});
verifier('mode Jour : textes ≥ 4,5:1 sur leurs fonds (pastilles, eyebrow, menu), mesurés', () => {
  const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const rap = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const tok = n => html.match(new RegExp('--' + n + ':(#[0-9A-Fa-f]{6})'))[1];
  [['j-ok-fg', 'j-ok-bg'], ['j-att-fg', 'j-att-bg'], ['j-bad-fg', 'j-bad-bg']].forEach(([f, b]) => assert.ok(rap(tok(f), tok(b)) >= 4.5, f + ' ' + rap(tok(f), tok(b)).toFixed(2)));
  assert.ok(rap(tok('j-eyebrow'), '#FFFFFF') >= 4.5);
  assert.ok(/:root\[data-theme="jour"\] \.menu-btn\{background:var\(--panel\);border:1px solid var\(--line\)/.test(html));
});

let ko = 0;
cas.forEach(([nom, f]) => { try { f(); console.log('ok  ' + nom); } catch (e) { ko++; console.log('KO  ' + nom + ' — ' + e.message); } });
if (ko) process.exit(1);
