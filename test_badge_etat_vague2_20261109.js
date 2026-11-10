// Lot 3 des emojis, vague 2 (Guardian 6752527767) : Cockpit, Centre, Missions passent par NexusBadgeEtat ;
// Accueil n'affiche aucun emoji d'état (rien à convertir). Présentation seulement.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
function garde(nom, src, regle, litteral, remplacement) {
  t(nom, () => {
    assert.ok(regle(src), 'la garde doit passer sur la source');
    assert.ok(src.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
    assert.ok(!regle(src.replace(litteral, remplacement)), 'la garde doit rougir sur la source mutée');
  });
}
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
global.NexusEtatsConseiller = require('./nexus-etats-conseiller.js');
const B = require('./nexus-badge-etat.js');
const PAGES = { cockpit: 'NEXUS-Cockpit-v2.html', centre: 'NEXUS-Centre-Intelligence-v1.html', missions: 'NEXUS-Missions-v1.html' };
const S = {}; Object.keys(PAGES).forEach(k => { S[k] = lire(PAGES[k]); });
const CP = lire('nexus-badge-etat.js');

const chargeComposant = c => /<script src="nexus-badge-etat\.js(?:\?[^"]*)?"><\/script>/.test(c);
Object.keys(PAGES).forEach(k => {
  t(k + ' : charge le composant, étiquette ?v= acceptée', () => {
    assert.ok(chargeComposant(S[k]));
    assert.ok(chargeComposant(S[k].replace('nexus-badge-etat.js"', 'nexus-badge-etat.js?v=abc123"')));
    const m = /src="nexus-badge-etat\.js/.exec(S[k]), e = /src="nexus-etats-conseiller\.js/.exec(S[k]);
    assert.ok(m && e && e.index < m.index, 'composant après les clés');
  });
  garde(k + ' : le composant est chargé', S[k], chargeComposant, 'src="nexus-badge-etat.js', 'src="nexus-badge-etat-x.js');
});

// Plus de pastille d'état écrite à la main avec la chaîne produite
const sansEtatBrut = c => !/<span class="plan-etat">\$\{p\.etat\}<\/span>/.test(c);
['centre', 'missions'].forEach(k => {
  t(k + ' : la carte passe par le composant', () => { assert.ok(sansEtatBrut(S[k])); assert.ok(/\$\{NexusBadgeEtat\.rendu\(p\.etat\)\}/.test(S[k])); });
  garde(k + ' : garde rendu composant', S[k], c => /\$\{NexusBadgeEtat\.rendu\(p\.etat\)\}/.test(c), '${NexusBadgeEtat.rendu(p.etat)}', '<span class="plan-etat">${p.etat}</span>');
});
t('cockpit : carte via le composant, texte urgence · nature conservé', () => {
  assert.ok(/NexusBadgeEtat\.rendu\(p\.etat\)/.test(S.cockpit));
  assert.ok(/p\.urgence\.toUpperCase\(\)\} · \$\{p\.nature\}/.test(S.cockpit));
  assert.ok(sansEtatBrut(S.cockpit) && !/\? `\$\{p\.urgence[^`]*`\s*:\s*p\.etat\}/.test(S.cockpit));
});
garde('cockpit : garde rendu composant', S.cockpit, c => /: NexusBadgeEtat\.rendu\(p\.etat\)\}/.test(c), ': NexusBadgeEtat.rendu(p.etat)}', ': p.etat}');

// Centre : onglets et compteurs sans emoji, valeurs de filtre inchangées
const EMO = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
t('centre : les valeurs de filtre restent les clés du lot 2', () => {
  assert.ok(/FILTRES = \['Toutes', '🔥 À AGIR', '📈 OPPORTUNITÉ', '🟡 À SURVEILLER'\]/.test(S.centre));
  assert.ok(/NexusEtatsConseiller\.filtre\(p\.etat, filtreActif\)/.test(S.centre));
});
t('centre : libellés d\'onglet et de compteur rendus par le composant, sans emoji', () => {
  ['🔥 À AGIR', '📈 OPPORTUNITÉ', '🟡 À SURVEILLER'].forEach(v => assert.ok(!EMO.test(B.libelle(v)), v));
  assert.deepStrictEqual(['🔥 À AGIR', '📈 OPPORTUNITÉ', '🟡 À SURVEILLER'].map(v => B.libelle(v)), ['À agir', 'Opportunités', 'À surveiller']);
  assert.ok(/t\.textContent = f === 'Toutes' \? f : NexusBadgeEtat\.libelle\(f\);/.test(S.centre));
  assert.ok(!/<span class="stat-label">(?:🔥 À agir|📈 Opportunités|🟡 À surveiller)/.test(S.centre));
});
garde('centre : onglet via le composant', S.centre, c => /t\.textContent = f === 'Toutes' \? f : NexusBadgeEtat\.libelle\(f\);/.test(c), "NexusBadgeEtat.libelle(f);", 'f;');
garde('centre : compteur À agir via le composant', S.centre, c => /stat-label">\$\{NexusBadgeEtat\.libelle\('🔥 À AGIR'\)\}/.test(c), "stat-label\">${NexusBadgeEtat.libelle('🔥 À AGIR')}", 'stat-label">🔥 À agir');
garde('centre : compteur Opportunités via le composant', S.centre, c => /stat-label">\$\{NexusBadgeEtat\.libelle\('📈 OPPORTUNITÉ'\)\}/.test(c), "stat-label\">${NexusBadgeEtat.libelle('📈 OPPORTUNITÉ')}", 'stat-label">📈 Opportunités');
garde('centre : compteur À surveiller via le composant', S.centre, c => /stat-label">\$\{NexusBadgeEtat\.libelle\('🟡 À SURVEILLER'\)\}/.test(c), "stat-label\">${NexusBadgeEtat.libelle('🟡 À SURVEILLER')}", 'stat-label">🟡 À surveiller');
t('centre : la carte 🧼 Advisor (hygiène, autre moteur) est laissée telle quelle', () => { assert.ok(/🧼/.test(S.centre)); });

// Comptes identiques sur un jeu figé : le libellé ne change aucune logique de comptage
t('centre : mêmes comptes et mêmes filtres sur un jeu figé', () => {
  const E = global.NexusEtatsConseiller;
  const jeu = ['🔥 À AGIR', '🔥 À AGIR', '📈 OPPORTUNITÉ', '🟡 À SURVEILLER', '📦 À SURVEILLER', '🗓️ TEMPO', 'INCONNU'].map(etat => ({ etat }));
  const cnt = k => jeu.filter(p => E.est(p.etat, k)).length;
  assert.deepStrictEqual([cnt('agir'), cnt('opportunite'), cnt('surveiller')], [2, 1, 1]);
  ['🔥 À AGIR', '📈 OPPORTUNITÉ', '🟡 À SURVEILLER'].forEach((f, i) => assert.strictEqual(jeu.filter(p => E.filtre(p.etat, f)).length, [2, 1, 1][i]));
  assert.deepStrictEqual(jeu.map(p => E.rang(p.etat)), [0, 0, 2, 2, 2, 2, 2]);
});
t('valeur inconnue : rendu neutre sans emoji, même compte qu\'avant', () => {
  const h = B.rendu('INCONNU'); assert.ok(/data-axe="neutre"/.test(h));
  assert.strictEqual(B.libelle('🗓️ TEMPO'), 'TEMPO');
});
t('missions : états carburant À agir / À décider rendus par le composant', () => {
  assert.ok(/data-etat="agir"/.test(B.rendu('🔥 À AGIR')) && /data-etat="decider"/.test(B.rendu('🔴 À DÉCIDER')));
  assert.ok(/etat: r\.mode === 'CAMION_COMPLET' \? "🔥 À AGIR" : "🔴 À DÉCIDER"/.test(S.missions), 'valeur écrite inchangée');
  [B.rendu('🔥 À AGIR'), B.rendu('🔴 À DÉCIDER')].forEach(h => assert.ok(!EMO.test(h)));
});
t('Accueil : aucun emoji d\'état dans les compteurs, rien à convertir', () => {
  const A = lire('NEXUS-App-v1.html');
  const bloc = A.split('\n').slice(2145, 2160).join('\n').replace(/\/\/.*$/gm, '');
  assert.ok(/NexusEtatsConseiller\.est\(/.test(bloc) && !EMO.test(bloc));
});
console.log(n + ' épreuves OK');

// Guardian 6752793399 : la couleur d'une carte vient du composant (clé), jamais d'un rouge ou d'un vert local.
{
  const assertL = require('assert');
  const fsL = require('fs');
  const lireL = f => fsL.readFileSync(require('path').join(__dirname, f), 'utf8');
  const BADGE = require('./nexus-badge-etat.js');
  const ETATS = require('./nexus-etats-conseiller.js');
  global.NexusEtatsConseiller = ETATS;
  const PAGES4 = ['NEXUS-Brief-v1.html', 'NEXUS-Cockpit-v2.html', 'NEXUS-Centre-Intelligence-v1.html', 'NEXUS-Missions-v1.html'];
  PAGES4.forEach(p => {
    const H = lireL(p);
    console.log('OK ' + p + ' : aucune bordure locale rouge ou verte sur une carte d\'état');
    assertL.ok(!/\.(?:plan|decision)-card\.etat-[a-z]+\s*\{/.test(H), p + ' : règle locale de bordure par état');
    assertL.ok(/classeCarte\(/.test(H) || /nbe-carte-/.test(H), p + ' : couleur de bordure du composant absente');
  });
  const ok = (e, c) => assertL.strictEqual(BADGE.classeCarte(e), c);
  ok('🔴 CRITIQUE', 'nbe-carte-critique'); console.log('OK une carte critique reste rouge');
  ok('🟡 À VÉRIFIER', 'nbe-carte-verifier');
  ok('🔥 À AGIR', 'nbe-carte-agir');
  ok('📈 OPPORTUNITÉ', 'nbe-carte-neutre'); ok('🟡 À SURVEILLER', 'nbe-carte-neutre'); ok('💡 RECOMMANDATION', 'nbe-carte-neutre');
  console.log('OK opportunité, à surveiller et recommandation : bordure neutre');
  const CSSB = BADGE._CSS;
  assertL.ok(/nbe-carte-critique[^}]*var\(--nbe-critique\)/.test(CSSB) && /nbe-carte-agir[^}]*var\(--nbe-accent\)/.test(CSSB) && /nbe-carte-neutre[^}]*var\(--nbe-line\)/.test(CSSB));
  const mut = CSSB.replace('.nbe-carte-neutre.nbe-carte-neutre{border-left-color:var(--nbe-line)}', '.nbe-carte-neutre.nbe-carte-neutre{border-left-color:#34D399}');
  assertL.ok(!/nbe-carte-neutre[^}]*var\(--nbe-line\)/.test(mut)); console.log('OK mutation : une bordure neutre verte rougit la garde');
  const C = lireL('NEXUS-Centre-Intelligence-v1.html');
  assertL.ok(!/stat-value" style="color:#(?:F0575A|34D399|F5A623)/.test(C)); console.log('OK Centre : compteurs sans rouge ni vert');
  assertL.strictEqual(BADGE.classeCompteur('🔥 À AGIR'), 'nbe-compteur-agir');
  assertL.strictEqual(BADGE.classeCompteur('📈 OPPORTUNITÉ'), 'nbe-compteur-neutre');
  console.log('OK compteurs : à agir en accent, le reste neutre');
}

// Guardian 6755267511 : pictogrammes du kit premium (critique = octogone, à vérifier = triangle).
{
  const a = require('assert');
  const B = require('./nexus-badge-etat.js');
  const oct = 'M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3zM12 7.5v5m0 3.5v.2';
  const tri = 'M12 3 2.8 20h18.4L12 3zM12 9v4m0 3.5v.2';
  const regle = (c, t) => c.indexOf('data-etat="critique"') >= 0 && c.indexOf(oct) >= 0 && t.indexOf('data-etat="a-verifier"') >= 0 && t.indexOf(tri) >= 0 && c.indexOf(tri) < 0 && t.indexOf(oct) < 0;
  const C = B.gravite('critique'), T = B.gravite('a-verifier');
  a.ok(regle(C, T)); console.log('OK critique = octogone, à vérifier = triangle');
  a.ok(/viewBox="0 0 24 24"[^>]*stroke-width="1.8"/.test(C)); console.log('OK viewBox 24, trait 1,8');
  a.ok(!regle(C.replace(oct, tri), T)); console.log('OK mutation : triangle sur critique rougit la garde');
  a.ok(!regle(C, T.replace(tri, oct))); console.log('OK mutation : octogone sur à vérifier rougit la garde');
}
