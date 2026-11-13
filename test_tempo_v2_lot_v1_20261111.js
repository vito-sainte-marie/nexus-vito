// Tempo V2 — lot V1 « visuel » : la page existe, sans donnée, sans lien, sans écriture.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const racine = __dirname;
const lire = f => fs.readFileSync(path.join(racine, f), 'utf8');
let echecs = 0;
function t(nom, fn) {
  try { fn(); console.log('  ok   ' + nom); }
  catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); }
}

const PAGE = 'NEXUS-Tempo-v2.html';
const VIDE = 'Donnée en cours de branchement';

t('la page NEXUS-Tempo-v2.html existe', () => {
  assert.ok(fs.existsSync(path.join(racine, PAGE)));
});

const html = fs.existsSync(path.join(racine, PAGE)) ? lire(PAGE) : '';
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');

t('aucune écriture ni RPC (lecture seule, lot V2 : .from( autorisé)', () => {
  assert.ok(!/\.rpc\s*\(/.test(scripts), '.rpc( trouvé');
  assert.ok(!/\.(insert|update|upsert|delete)\s*\(/.test(scripts), 'écriture trouvée');
});

t('garde de session présente (nexusRequireAuth)', () => {
  assert.ok(/nexusRequireAuth\s*\(/.test(scripts));
});

t('forfait Professional exigé (comme V1)', () => {
  assert.ok(/nexusRequireProfessional\('NEXUS-Tempo-v2\.html'/.test(html));
});

t('thème Jour/Nuit via data-theme', () => {
  assert.ok(/nexus-theme\.js/.test(html));
  assert.ok(/:root\[data-theme="jour"\]/.test(html));
});

t('palette Nuit et Jour de la charte', () => {
  for (const c of ['#07131E', '#0D202E', '#0F2433', '#254354', '#EDF1F5', '#9AA8B6', '#24D8E3', '#29C98A', '#F5A12A', '#5B7A8E',
    '#F4F6F8', '#FFFFFF', '#EEF2F5', '#D5DCE3', '#0F172A', '#475569', '#0B7285', '#047857', '#B45309', '#94A3B8']) {
    assert.ok(html.toUpperCase().includes(c.toUpperCase()), c + ' absent');
  }
});

t('responsive : une colonne sous 768 px, cibles tactiles de 44 px', () => {
  assert.ok(/max-width:\s*767px/.test(html));
  assert.ok(/min-height:\s*44px/.test(html));
});

t('textes de structure imposés', () => {
  for (const s of [
    'NEXUS · Comprendre', 'Le rythme de votre station', 'Période étudiée',
    'Comparabilité faible avec la période précédente', 'En bref',
    'Piste · Litres vendus', 'Boutique · Marge commerciale', 'FDJ · CA des jeux',
    'Pourquoi ces évolutions ne sont pas des conclusions',
    'Durées', 'Calendrier', 'Journée exceptionnelle', 'Prix',
    'Règle de comparabilité en cours de définition',
    'Quarts et équipes', 'Quart 1', 'Quart 2', 'Hypothèse',
    'Comparer les quarts', 'Voir les pompistes',
    'Ce que Tempo a découvert', 'Voir les preuves', 'Analyses',
    'Le quart 1 vend-il plus que le quart 2 ?', 'Comment se situent les pompistes ?',
    'Quels sont mes jours forts et faibles ?', 'Comment évoluent mes mois ?',
    'Les vacances changent-elles mon activité ?', 'Quand la piste tourne, la boutique suit-elle ?',
    'Tempo analyse et explique.', 'Les décisions se prennent dans le Cockpit.',
    'Non qualifié', 'Marge quotidienne non disponible pour cette période', 'Commissions FDJ non renseignées', 'Rattachement des tirages au quart à confirmer',
  ]) assert.ok(html.replace(/<a\s[^>]*>|<\/a>/g, '').includes(s), 'manque : ' + s);
});

t('la pastille de comparabilité est masquée par défaut', () => {
  assert.ok(/id="pillComparabilite"\s+hidden/.test(html));
});

t('chaque carte porte son état vide initial (remplacé après lecture)', () => {
  assert.ok((html.split(VIDE).length - 1) >= 11, 'trop peu d\'états vides');
  for (const id of ['indPiste', 'indBoutique', 'indFdj']) {
    const m = html.match(new RegExp('id="' + id + '"[\\s\\S]*?</article>'));
    assert.ok(m && m[0].includes(VIDE), id + ' sans état vide');
  }
});

t('aucun chiffre en dur dans les valeurs, totaux et évolutions', () => {
  const blocs = [...html.matchAll(/<div class="(?:valeur|total|evol)"[^>]*>([^<]*)<\/div>/g)].map(m => m[1]);
  assert.ok(blocs.length >= 9);
  for (const b of blocs) assert.ok(!/\d/.test(b), 'chiffre dans : ' + b);
  // largeur des barres : toujours 0, jamais une valeur
  assert.ok(!/style="[^"]*width:\s*[1-9]/.test(html));
});

t('aucune mention de données de substitution (exemple, lorem, fictif)', () => {
  assert.ok(!/lorem|exemple|fictif|placeholder/i.test(html.replace(/<style[\s\S]*?<\/style>/, '').replace(/<script[\s\S]*?<\/script>/g, '')));
});

t('un seul lien actif vers une analyse : la page Quarts (lot B)', () => {
  const corps = html.slice(html.indexOf('<body>'));
  const liens = [...corps.matchAll(/<a\s[^>]*href="([^"]*)"/gi)].map(m => m[1]);
  assert.deepStrictEqual(liens, ['NEXUS-Tempo-v2-Quarts.html', 'NEXUS-Tempo-v2-Pompistes.html', 'NEXUS-Tempo-v2-Jours.html', 'NEXUS-Tempo-v2-Mois.html', 'NEXUS-Tempo-v2-Vacances.html', 'NEXUS-Tempo-v2-PisteBoutique.html', 'NEXUS-Cockpit-v2.html']);
});

t('aucun nom d\'employé réel (liste vide de prénoms de pompistes)', () => {
  assert.ok(!/<td|<tr/i.test(html));
});

t('liens vers NEXUS-Tempo-v2 : seulement le menu basculé (lot confiance et menu, 12/11/2026)', () => {
  const cibles = fs.readdirSync(racine).filter(f => /\.(html|js)$/.test(f) && f !== PAGE && f !== 'NEXUS-Tempo-v2-Quarts.html' && f !== 'NEXUS-Tempo-v2-Mois.html' && f !== 'NEXUS-Tempo-v2-Jours.html' && f !== 'NEXUS-Tempo-v2-Vacances.html' && f !== 'NEXUS-Tempo-v2-PisteBoutique.html' && f !== 'NEXUS-Tempo-v2-Pompistes.html' && f !== 'nexus-auth.js' && !/^test_/.test(f));
  const fautifs = cibles.filter(f => /NEXUS-Tempo-v2/.test(lire(f)));
  assert.deepStrictEqual(fautifs, ['NEXUS-App-v1.html', 'NEXUS-Documentation-v1.html', 'NEXUS-Tempo-v1.html', 'nexus-conseiller.js', 'nexus-desktop.js', 'nexus-forfait.js', 'nexus-raccourcis-catalogue.js', 'nexus-recherche.js']);
  // nexus-auth.js ne porte que le classement d'accès (liste des écrans opérationnels), pas un lien.
  const auth = lire('nexus-auth.js').split('\n').filter(l => /NEXUS-Tempo-v2/.test(l));
  assert.deepStrictEqual(auth.map(l => l.trim()), ["'NEXUS-Tempo-v2.html',", "'NEXUS-Tempo-v2-Quarts.html',", "'NEXUS-Tempo-v2-Mois.html',", "'NEXUS-Tempo-v2-Jours.html',", "'NEXUS-Tempo-v2-Vacances.html',", "'NEXUS-Tempo-v2-PisteBoutique.html',", "'NEXUS-Tempo-v2-Pompistes.html',"]);
  for (const f of ['NEXUS-App-v1.html', 'NEXUS-Brief-v1.html', 'NEXUS-Cockpit-v2.html', 'nexus-menu-accueil.js']) {
    assert.ok(fs.existsSync(path.join(racine, f)), f + ' introuvable');
  }
});

t('NEXUS-Tempo-v1.html inchangé (empreinte ; avatar recadré le 12/11/2026, seule la source de l’image change)', () => {
  // outils/build.sh réécrit les épingles ?v= et injecte trois scripts d'environnement : on neutralise les deux avant de comparer.
  const src = fs.readFileSync(path.join(racine, 'NEXUS-Tempo-v1.html'), 'utf8')
    .replace(/<script src="nexus-(?:config|page|bandeau-environnement)\.js[^"]*"><\/script>\n?/g, '')
    .replace(/\?v=[^"']*/g, '?v=');
  const h = crypto.createHash('sha256').update(src).digest('hex');
  assert.strictEqual(h, '8c665900aaff6271ed13fdee790a40e54de82130fc6dfdd9ab1580ce9f90311f');
});

t('carte vide : aucun niveau, sauf « Hypothèse » de la colonne CA FDJ (G4)', () => {
  assert.ok(!/Fait mesuré|Relation observée/.test(html.replace(/<script[\s\S]*?<\/script>/g, '')), 'niveau affiché sur une carte vide');
  const hyp = html.match(/class="niveau hypothese"/g) || [];
  assert.strictEqual(hyp.length, 1);
  const q = html.match(/id="qFdj"[\s\S]*?Rattachement des tirages au quart à confirmer<\/div>/);
  assert.ok(q && /niveau hypothese/.test(q[0]), 'Hypothèse hors de la colonne FDJ');
});

t('bannière de station chargée et utilisée', () => {
  assert.ok(/<script src="nexus-banniere-station\.js(?:\?v=[^"]*)?"/.test(html));
  assert.ok(/NexusBanniereStation\.html\(/.test(scripts));
  assert.ok(/class="entete-texte"/.test(html));
});

t('six sous-titres fixes sous les tuiles Analyses, sans chiffre', () => {
  const sous = ['Litres, boutique et FDJ, jour par jour', 'Litres du quart, face aux habitudes',
    'Par activité, sur les mêmes semaines', 'FDJ, litres et boutique, mois par mois',
    'À jour de semaine égal', 'Relation jour par jour et par quart'];
  let dernier = -1;
  for (const u of sous) {
    const i = html.indexOf('>' + u + '<');
    assert.ok(i > dernier, 'absent ou hors ordre : ' + u);
    dernier = i;
    assert.ok(!/\d/.test(u));
  }
});

t('flèche des analyses : libellé, masquée dès 768 px, geste scrollBy', () => {
  assert.ok(/id="flecheAnalyses"[^>]*aria-label="Voir les analyses suivantes"|aria-label="Voir les analyses suivantes"[^>]*id="flecheAnalyses"/.test(html));
  assert.ok(/\.fleche\{[^}]*display:\s*none/.test(html), 'pas masquée par défaut (bureau)');
  const mob = html.match(/@media \(max-width:\s*767px\)\s*\{[\s\S]*?\n\}/);
  assert.ok(mob && /\.fleche\{[^}]*display:\s*flex/.test(mob[0]), 'pas affichée en mobile');
  assert.ok(/scrollBy\(/.test(scripts));
});

console.log(echecs ? '\n' + echecs + ' échec(s)' : '\nTout est vert');
process.exit(echecs ? 1 : 0);
