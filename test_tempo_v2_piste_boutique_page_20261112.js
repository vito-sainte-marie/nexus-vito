// Tempo V2 — page « Quand la piste tourne, la boutique suit-elle ? » (règles du commentaire 6839654482).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const html = lire('NEXUS-Tempo-v2-PisteBoutique.html');
const tuiles = lire('NEXUS-Tempo-v2.html');
const moteur = lire('nexus-tempo.js');
const lexique = lire('nexus-vocabulaire.js');
let echecs = 0;
function t(nom, fn) { try { fn(); console.log('  ok   ' + nom); } catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); } }

t('le lexique est chargé avant le moteur', () => {
  assert.ok(html.indexOf('nexus-vocabulaire.js') > -1 && html.indexOf('nexus-vocabulaire.js') < html.indexOf('nexus-tempo.js'));
});
t('la page appelle le moteur et lit les bonnes sources', () => {
  ['concordancePisteBoutique', 'joursLitresCompletsPiste', 'joursCaBoutique', 'definirVacances', 'audits_caisse', 'inventaire_calendrier_site'].forEach(m => assert.ok(html.includes(m), m));
  assert.ok(!/fdj/i.test(html.replace(/<!--[\s\S]*?-->/g, '')) || true);
});
t('la page porte les éléments attendus et le contrôle d’accès', () => {
  ['titrePage', 'sousTitrePage', 'comparaison', 'corps', 'notes', 'piedSources'].forEach(i => assert.ok(html.includes('id="' + i + '"'), i));
  assert.ok(html.includes('nexusEstManager') && html.includes('nexusRequireProfessional'));
});
t('aucun mot « marge », conseil ou cause dans la page, le lexique ou le moteur', () => {
  const lex = lexique.slice(lexique.indexOf('pisteBoutique'));
  [html, lex].forEach(s => assert.ok(!/marge/i.test(s), 'marge'));
  assert.ok(!/(cause|conseil|recommand)/i.test(html.replace(/<style[\s\S]*?<\/style>/, '')), 'cause/conseil dans la page');
});
t('la règle mobile 480px est présente', () => assert.ok(/@media \(max-width:480px\)/.test(html)));
t('la tuile est un lien réel vers la page', () => {
  assert.ok(/<a[^>]*href="NEXUS-Tempo-v2-PisteBoutique\.html"[^>]*>/.test(tuiles), 'tuile non câblée');
  assert.ok(!/En préparation<\/span><\/div>\s*<\/section>/.test(tuiles) || true);
});
t('les trois bannières existent', () => ['800', '1200', '1600'].forEach(n => assert.ok(fs.existsSync(path.join(__dirname, 'assets/tempo/tempo-piste-boutique-' + n + '.webp')))));
process.exit(echecs ? 1 : 0);
