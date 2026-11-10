// Produits lot 1, PR A : échappement selon le contexte + date de la photo dans le fuseau de la station.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Badge = require('./nexus-badge-etat.js');
const Sec = require('./nexus-produits-securite.js');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
const PAGE = fs.readFileSync(path.join(__dirname, 'NEXUS-Produits-v1.html'), 'utf8');
const esc = Badge.esc;

// Jeu piégé en mémoire
const PIEGE = {
  article: '<img src=x onerror=alert(1)>Coca',
  marque: '" onmouseover="alert(2)',
  vignette: 'javascript:alert(3)',
  emplacement: '<script>alert(4)</script>Rayon'
};
// Rendu minimal identique aux gabarits de la page (texte + attribut entre guillemets doubles + image)
function carte(p) {
  const img = Sec.urlImageSure(p.vignette) ? `<img src="${esc(Sec.urlImageSure(p.vignette))}" alt="${esc(p.article)}">` : '';
  return `${img}<div class="pc-nom">${esc(p.article)}</div><div class="pc-marque" title="${esc(p.marque)}">${esc(p.emplacement)}</div>`;
}
t('le jeu piégé s\'affiche en texte : aucune balise ni attribut d\'événement créé', () => {
  const h = carte(PIEGE);
  assert.ok(!/<img/i.test(h) && !/<script/i.test(h), h);
  assert.ok(!/"\s*onmouseover=/i.test(h), h);
  assert.ok(h.includes('&lt;img src=x onerror=alert(1)&gt;Coca'));
  assert.ok(h.includes('&quot; onmouseover=&quot;alert(2)'));
});
t('esc : null et undefined donnent une chaîne vide', () => {
  assert.strictEqual(esc(null), ''); assert.strictEqual(esc(undefined), ''); assert.strictEqual(esc(0), '0');
});
t('urlImageSure : https seulement', () => {
  assert.strictEqual(Sec.urlImageSure('javascript:alert(1)'), '');
  assert.strictEqual(Sec.urlImageSure('http://x.org/a.png'), '');
  assert.strictEqual(Sec.urlImageSure('data:text/html;base64,AAAA'), '');
  assert.strictEqual(Sec.urlImageSure(null), '');
  assert.strictEqual(Sec.urlImageSure('https://images.openfoodfacts.org/a.jpg'), 'https://images.openfoodfacts.org/a.jpg');
});
t('urlImageSure : photo NEXUS limitée à l\'hôte du stockage Supabase', () => {
  assert.strictEqual(Sec.urlImageSure('https://evil.example/a.png', 'abc.supabase.co'), '');
  assert.ok(Sec.urlImageSure('https://abc.supabase.co/storage/v1/object/sign/x?token=1', 'abc.supabase.co'));
});
t('urlImageSure : une valeur interne fixe explicitement autorisée passe, pas une autre', () => {
  assert.strictEqual(Sec.urlImageSure('data:image/svg+xml;utf8,a', null, ['data:image/svg+xml;utf8,a']), 'data:image/svg+xml;utf8,a');
  assert.strictEqual(Sec.urlImageSure('data:image/svg+xml;utf8,b', null, ['data:image/svg+xml;utf8,a']), '');
});

// Date de la photo
t('photo à 20 h 30 en Martinique : même jour, pas le lendemain UTC', () => {
  const instant = new Date('2026-11-11T00:30:00Z'); // 20:30 le 10/11 en Martinique (UTC-4)
  const r = Sec.dateHeureDansFuseau(instant, 'America/Martinique');
  assert.deepStrictEqual(r, { date: '2026-11-10', heure: '20:30' });
  assert.strictEqual(instant.toISOString().slice(0, 10), '2026-11-11'); // l'ancien calcul se trompait
});
t('fuseau absent ou invalide : repli America/Martinique', () => {
  const instant = new Date('2026-11-11T00:30:00Z');
  assert.deepStrictEqual(Sec.dateHeureDansFuseau(instant, null), { date: '2026-11-10', heure: '20:30' });
  assert.deepStrictEqual(Sec.dateHeureDansFuseau(instant, 'Pas/Un_Fuseau'), { date: '2026-11-10', heure: '20:30' });
});
t('minuit : 00:xx et non 24:xx', () => {
  assert.strictEqual(Sec.dateHeureDansFuseau(new Date('2026-11-11T04:05:00Z'), 'America/Martinique').heure, '00:05');
});

// Câblage de la page
t('la page n\'utilise plus toISOString ni toTimeString pour la photo du rayon', () => {
  const i = PAGE.indexOf('async function envoyerPhotoTerrainManager');
  assert.ok(i > 0);
  const corps = PAGE.slice(i, i + 3500);
  assert.ok(!/toISOString\(\)\.slice\(0, 10\)/.test(corps) && !/toTimeString/.test(corps));
  assert.ok(/dateHeureStation\(\)/.test(corps));
});
t('la page réutilise esc du badge et charge le module', () => {
  assert.ok(/const esc = window\.NexusBadgeEtat\.esc;/.test(PAGE));
  assert.ok(!/function esc\(/.test(PAGE));
  assert.ok(PAGE.indexOf('nexus-badge-etat.js') < PAGE.indexOf('nexus-produits-securite.js'));
});
t('aucune insertion HTML brute des champs piégeables', () => {
  [/\$\{c\.nom\}/, /\$\{candidat\.nom\}/, /\$\{candidat\.marque\}/, /\$\{c\.marque\}/, /src="\$\{c\.vignette\}"/, /src="\$\{r\.photo_url\}"/,
   /\$\{nomEmp\}/, /\$\{data\.emplacement\}/, /\$\{employee\.nom\}/].forEach(re => {
    assert.ok(!re.test(PAGE), 'insertion brute : ' + re);
  });
});
console.log(n + ' tests OK');
