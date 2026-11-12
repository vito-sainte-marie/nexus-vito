// Tempo V2 — synthèse « En bref » : période, trois phrases au plus, note de prudence à part, jamais de consigne.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = {};
require('./nexus-tempo.js');
const T = window.NexusTempo;
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Tempo-v2.html'), 'utf8');

let echecs = 0;
function t(nom, fn) {
  try { fn(); console.log('  ok   ' + nom); }
  catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); }
}
const trois = (p, b, f) => [{ nom: 'Piste', evol: p }, { nom: 'Boutique', evol: b }, { nom: 'FDJ', evol: f }];
const PER = { debut: '2026-09-17', fin: '2026-11-11' };
const IMP = { debut: '2026-10-05', fin: '2026-11-09' };
const VERBES = /\b(devez|devriez|faut|faites|faire|essayez|pensez|prévoyez|augmentez|baissez|réduisez|recommand|conseil|agissez|à surveiller|à corriger)\w*/i;
const phrases = txt => txt.split(/(?<=[.!?])\s+(?=[A-ZÀÉÈÊ])/).filter(Boolean);

t('l\'exemple actuel se rend mot pour mot', () => {
  const r = T.syntheseEnBref({ periode: PER, importBoutique: IMP, faible: true,
    activites: trois('+1,0 % · Variation habituelle', 'Marge en baisse', '+3,2 % · Hausse confirmée'),
    decouverte: { activite: 'Boutique', type: 'decrochage', titre: 'Chiffre d’affaires en hausse, marge en baisse', detail: 'Marge par jour : 100 € contre 150 €' } });
  assert.strictEqual(r.periode, 'Du 17 septembre au 11 novembre 2026.');
  assert.strictEqual(r.texte, 'Les litres de la Piste restent stables (+1,0 %), tandis que la marge de la Boutique recule (import du 5 octobre au 9 novembre 2026) et le chiffre d’affaires de la FDJ progresse (+3,2 %). Côté Boutique, la première découverte retenue est un découplage : chiffre d’affaires en hausse, marge en baisse (Marge par jour : 100 € contre 150 €).');
  assert.strictEqual(r.note, 'La comparaison avec la période précédente reste fragile. Ces évolutions sont à interpréter avec prudence.');
});
t('marge boutique en recul, ventes en hausse : Piste stable d\'abord, « tandis que », puis détail boutique', () => {
  const r = T.syntheseEnBref({ periode: PER, importBoutique: IMP, faible: false,
    activites: trois('+0,5 % · Variation habituelle', 'Marge en baisse', '+0,2 % · Variation habituelle'),
    decouverte: { activite: 'Boutique', type: 'decrochage', titre: 'Plus de chiffre d’affaires, marge en baisse', detail: 'Marge par jour : 90 € contre 120 €' } });
  const p = phrases(r.texte);
  assert.ok(p[0].startsWith('Les litres de la Piste restent stables'));
  assert.ok(p[0].indexOf('tandis que la marge de la Boutique recule') > p[0].indexOf('Piste'));
  assert.ok(/^Côté Boutique/.test(p[1]) && p[1].includes('Marge par jour : 90 € contre 120 €'));
  assert.strictEqual(r.note, '');
});
t('une réserve propre à une activité reste attachée à cette activité', () => {
  const r = T.syntheseEnBref({ periode: PER, faible: false,
    activites: [{ nom: 'Piste', evol: '+1,0 % · Variation habituelle' }, { nom: 'Boutique', evol: 'Marge stable' }, { nom: 'FDJ', evol: '−4,0 % · Baisse confirmée', reserve: 'quart incomplet' }] });
  assert.ok(r.texte.includes('recule (−4,0 %) (quart incomplet)') || r.texte.includes('(−4,0 %) (quart incomplet)'));
  assert.ok(!/Piste[^,]*\(quart incomplet\)/.test(r.texte));
});
t('la période d\'import de la Boutique est toujours citée', () => {
  const r = T.syntheseEnBref({ periode: PER, importBoutique: IMP, faible: false, activites: trois('Variation habituelle', 'Marge stable', 'Variation habituelle') });
  assert.ok(r.texte.includes('import du 5 octobre au 9 novembre 2026'));
});
t('aucun verbe d\'action ni recommandation', () => {
  const r = T.syntheseEnBref({ periode: PER, importBoutique: IMP, faible: true, activites: trois('Baisse confirmée', 'Marge en hausse', 'Tendance non déterminée'),
    decouverte: { activite: 'Piste', type: 'masquee', titre: 'Gazole en baisse de 40 L par jour', detail: 'Variation habituelle' } });
  assert.ok(!VERBES.test(r.periode + ' ' + r.texte + ' ' + r.note));
  assert.ok(!/\bton\b|\btes\b/i.test(r.texte + r.note));
});
t('trois phrases au plus, note exclue', () => {
  const r = T.syntheseEnBref({ periode: PER, importBoutique: IMP, faible: true, activites: trois('+3,0 % · Hausse confirmée', 'Marge en baisse', 'Variation habituelle'),
    decouverte: { activite: 'Boutique', type: 'masquee', titre: 'Une catégorie masque l’évolution de la marge', detail: 'x' }, decouverte2: { titre: 'Le gazole recule le mardi' } });
  assert.ok(phrases(r.texte).length <= 3, r.texte);
});
t('la page câble la période, l\'import, la découverte structurée et la note', () => {
  for (const m of ['id="enBrefTexte"', 'id="enBrefPeriode"', 'id="enBrefNote"', 'window.NexusTempo.syntheseEnBref(', 'enBrefEtat.faible = comp.faible',
    'enBrefEtat.importBoutique = { debut: mi.debut, fin: mi.fin }', 'enBrefEtat.periode = { debut: bornes.debut, fin: bornes.fin }', 'if (slot === 0) { enBrefEtat.decouverte = {'])
    assert.ok(html.includes(m), m);
});
if (echecs) { console.log(echecs + ' échec(s)'); process.exit(1); }
