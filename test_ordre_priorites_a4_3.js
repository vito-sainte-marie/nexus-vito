// A4-3 : ordonnerPriorites est neutre — même ordre affiché que l'ancien code inline.
const fs = require('fs'), path = require('path');
const w = {};
new Function('window', fs.readFileSync(path.join(__dirname, 'nexus-conseiller.js'), 'utf8'))(w);
const C = w.NexusConseiller;
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.error('KO', m); } else console.log('OK', m); };

// Référence : copie littérale de l'ancien code inline.
function ancien(liste, graine) {
  const parRang = {};
  liste.forEach(c => { const r = c.rang != null ? c.rang : 5; (parRang[r] = parRang[r] || []).push(c); });
  const rangs = Object.keys(parRang).map(Number).sort((a, b) => a - b);
  const file = [];
  rangs.forEach(r => {
    const copie = parRang[r].slice(); let a = (graine + r) | 0;
    const rng = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = copie.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [copie[i], copie[j]] = [copie[j], copie[i]]; }
    copie.forEach(c => file.push(c));
  });
  return file;
}
const jeu = [];
[1, 1, 1, 2, 2, 3, 3, 3, 3, null, undefined, 4, 1].forEach((r, i) => jeu.push({ id: 'c' + i, rang: r, moteur: 'm' }));
let neutre = true;
for (let j = 1; j <= 30; j++) {
  const g = C.genererGraineJour('site-x', '2026-11-' + String(j).padStart(2, '0'));
  const a = ancien(jeu, g).map(c => c.id).join(), b = C.ordonnerPriorites(jeu, g).map(c => c.id).join();
  if (a !== b) neutre = false;
}
ok(neutre, 'ordre identique à l\'ancien sur 30 jours avec égalités de rang');
const o = C.ordonnerPriorites(jeu, 42).map(c => c.rang == null ? 5 : c.rang);
ok(o.every((r, i) => i === 0 || o[i - 1] <= r), 'un rang plus urgent ne passe jamais derrière un plus faible');
ok(C.ordonnerPriorites(jeu, 42).map(c => c.id).join() === C.ordonnerPriorites(jeu, 42).map(c => c.id).join(), 'stable pour une même graine');
ok(C.ordonnerPriorites(null, 1).length === 0, 'liste absente tolérée');
const sel = C.fusionnerEtSelectionner([jeu.map(c => Object.assign({}, c, { moteur: c.id < 'c5' ? 'a' : 'b' }))], { n: 3, site: 's', jour: '2026-11-27' });
ok(sel.length === 3, 'fusionnerEtSelectionner renvoie 3');
process.exit(ko ? 1 : 0);
