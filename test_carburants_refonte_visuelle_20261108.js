// Refonte visuelle Carburants Performance (Guardian 6723914835, 08/11/2026) : presentation seulement.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
function garde(nom, src, regle, litteral, remplacement) {
  t(nom, () => {
    assert.ok(regle(src), 'la garde doit passer sur la source');
    assert.ok(src.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
    assert.ok(!regle(src.replace(litteral, remplacement)), 'la garde doit rougir sur la source mutée');
  });
}
const H = lire('NEXUS-Carburants-Pilotage-v1.html');
const D = lire('nexus-carburant-donnees.js');
const bloc = (src, entete) => {
  const i = src.indexOf(entete); if (i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(j + 1, k); } }
  return '';
};

const IDS = ['situationZone','lectureNexusZone','commandeCarburantZone','rattrapageZone','releveStatutJour','btnSimulateurCommandeToggle','btnPointZeroToggle','simulateurCommandePanel','pointZeroPanel','periodeBar','libreBar','btnLibreValider','periodeLabel','sousTitre','badgeRegimeGestion','jaugeLegende','stockZone','bodyQualiteReceptions','qualiteReceptionsZone'];
t('tous les ids existants du DOM sont conservés', () => {
  IDS.forEach(id => assert.ok(H.includes('id="' + id + '"'), id));
  ['livraison','stock','ventes','repartition','moteur','analyse','economie','historique'].forEach(a => assert.ok(H.includes('data-accordion="' + a + '"'), a));
});
t('le bouton Relevé du jour garde le même lien', () => {
  assert.ok(/<a class="btn-cta" href="NEXUS-Carburants-v1\.html">Relevé du jour<\/a>/.test(H));
  assert.ok(H.includes('id="btnCorrigerReleve"'));
});
t('en-tête : fil, titre, sous-titre, pastilles site/date/statut, ⓘ de page', () => {
  assert.ok(H.includes('<h1 class="title">Carburants Performance</h1>'));
  assert.ok(H.includes('État des cuves, contrôle du jour et ventes'));
  ['pastilleSite','pastilleDate','releveStatutJour'].forEach(i => assert.ok(H.includes('id="' + i + '"'), i));
  assert.ok(/<button type="button" class="info-btn" id="btnInfoPage" aria-label="[^"]+"/.test(H));
  assert.ok(H.includes("La couleur du carburant identifie le produit, pas un niveau d'alerte."));
});
t('bannière : illustration jaugeage en srcset, thème et script chargés', () => {
  assert.ok(H.includes('nexus-theme.js') && H.includes('nexus-banniere-station.js'));
  assert.ok(/\$\{b\}-800\.webp 800w, \$\{b\}-1200\.webp 1200w, \$\{b\}-1600\.webp 1600w/.test(H));
  assert.ok(H.includes('siteAvecBanniere(SITE_ID'));
  ['jaugeage-800.webp','jaugeage-1200.webp','jaugeage-1600.webp'].forEach(f => assert.ok(fs.existsSync(path.join(__dirname, 'assets/pompiste', f)), f));
});
t('navigation rapide : six ancres, cibles présentes, sticky sous 820 px, scroll-margin-top', () => {
  ['situation','lecture','commande','livraisons','ventes','historique'].forEach(a => {
    assert.ok(H.includes('href="#sec-' + a + '"'), a);
    assert.ok(H.includes('id="sec-' + a + '"'), a);
  });
  assert.ok(/@media \(max-width:820px\)\{\.quick-nav\{position:sticky/.test(H));
  assert.ok(/\.sec\{scroll-margin-top:\d+px/.test(H));
});
t('thème Jour défini sur la page, gris secondaires et vert Jour', () => {
  assert.ok(/:root\[data-theme="jour"\]\{[^}]*--text-dim:#5F6B78[^}]*--green:#0B7A54/.test(H));
  assert.ok(H.includes('--text-dim:#808C9B'));
});
t('aucune taille de police sous 11 px', () => {
  const bas = [...H.matchAll(/font-size:\s*([0-9.]+)px/g)].filter(m => parseFloat(m[1]) < 11);
  assert.strictEqual(bas.length, 0, bas.map(m => m[0]).join(','));
});
t('chaque ⓘ est un <button> avec aria-label, cible 44 px, focus visible', () => {
  assert.ok(!/<span class="ecart-caveat"/.test(H));
  const bs = H.match(/<button type="button" class="ecart-caveat"[^>]*>/g) || [];
  assert.strictEqual(bs.length, 2);
  bs.forEach(b => assert.ok(/aria-label="[^"]+"/.test(b), b));
  assert.ok(/\.ecart-caveat\{[^}]*min-width:44px; min-height:44px/.test(H));
  assert.ok(/\.info-btn\{[^}]*width:44px; height:44px/.test(H));
  assert.ok(/\.ecart-caveat:focus-visible/.test(H));
});
t('carte carburant : clavier (tabindex, Entrée) et quatre blocs dans l\'ordre', () => {
  assert.ok(/data-releve-controle="\$\{cle\}" tabindex="0"/.test(H));
  assert.ok(/e\.key === 'Enter' && e\.target === carte/.test(H));
  const i = ['carb-bloc-niveau','carb-bloc-ventes','carb-bloc-controle','carb-bloc-autonomie','carb-pills'].map(c => H.indexOf('class="' + (c === 'carb-pills' ? c : 'carb-bloc ' + c)));
  i.forEach(x => assert.ok(x > 0)); assert.deepStrictEqual([...i].sort((a, b) => a - b), i);
  assert.ok(H.includes('Estimation par quart, distincte de la moyenne vendue'));
  assert.ok(H.includes('Situation stock : ') && H.includes('Rapprochement : '));
});
t('bloc Ventes : textes de couverture, jamais 0 L sans relevé', () => {
  assert.ok(H.includes('Pas de relevé hier') && H.includes('Pas de relevé sur 7 jours'));
  assert.ok(H.includes('1 quart sur 2 renseigné'));
  assert.ok(H.includes('7 derniers jours · '));
  assert.ok(/v\.moyenne == null \? 'Pas de relevé sur 7 jours'/.test(H));
});
t('la moyenne affichée est strictement la valeur de chargerConsommationJournaliereMoyenne', () => {
  assert.ok(/consoMoyenne\s*[,}]/.test(H) || /consoMoyenne,/.test(H));
  assert.ok(/const moyenne = ctx && ctx\.consoMoyenne \? ctx\.consoMoyenne\[cle\] : null;/.test(H));
  assert.ok(/fmtL\(v\.moyenne\)/.test(H));
  const corps = bloc(H, 'function syntheseVentesCarburant');
  assert.ok(!/moyenne\s*=\s*[^;]*\/\s*/.test(corps.replace(/ctx\.consoMoyenne\[cle\]/, '')), 'la moyenne n\'est pas recalculée');
});
t('aucune requête ni écriture ajoutée : un seul callback, mêmes filtres site', () => {
  const f = bloc(D, 'async function chargerConsommationJournaliereMoyenne');
  assert.ok(/surLignes/.test(D));
  assert.ok(/\.eq\('site', siteId\)/.test(D));
  assert.strictEqual((D.match(/\.from\(/g) || []).length, (execSync('git show origin/production:nexus-carburant-donnees.js', { cwd: __dirname }).toString().match(/\.from\(/g) || []).length);
  const diff = execSync('git diff origin/production -- NEXUS-Carburants-Pilotage-v1.html nexus-carburant-donnees.js', { cwd: __dirname, maxBuffer: 1 << 28 }).toString();
  const ajout = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'));
  assert.ok(!ajout.some(l => /\.(insert|update|upsert|delete|rpc)\(/.test(l)), 'aucun appel d\'écriture ajouté');
  assert.ok(!ajout.some(l => /\.from\(/.test(l)), 'aucune nouvelle requête');
});
t('Lecture NEXUS en trois colonnes par niveau existant', () => {
  assert.ok(/niveaux: \['alerte', 'attention'\]/.test(H) && /niveaux: \['attente'\]/.test(H) && /niveaux: \['ok'\]/.test(H));
  ['À contrôler','En attente','Sans anomalie'].forEach(x => assert.ok(H.includes(x), x));
  assert.ok(H.includes('id="btnLectureNexusDetail"') && H.includes('bodyLectureNexusDetail'));
  assert.ok(/\.lecture-nexus-colonnes\{[^}]*repeat\(3,1fr\)/.test(H));
});
t('À traiter : puces de dates, autre date, mêmes fonction et alerte', () => {
  assert.ok(H.includes('Choisir une autre date') && H.includes('id="rattrapageDateManuelle"') && H.includes('id="btnRattrapageOuvrir"'));
  assert.ok(H.includes('Choisissez une date.'));
  assert.ok(/chargerJoursSansReleve\(nexusClient, SITE_ID, todayISO\(\)\)/.test(H));
});
t('simulateur : lien discret, id et panneau conservés ; point zéro à côté de la commande', () => {
  assert.ok(/<button type="button" class="lien-discret" id="btnSimulateurCommandeToggle">Rejouer la recommandation pour une autre date<\/button>/.test(H));
  assert.ok(H.indexOf('id="btnPointZeroToggle"') < H.indexOf('id="sec-livraisons"') && H.indexOf('id="commandeCarburantZone"') < H.indexOf('id="btnPointZeroToggle"'));
});
t('grille d\'analyse deux colonnes, repliée en une sous 820 px', () => {
  assert.ok(/\.grille-analyse\{display:grid; grid-template-columns:1fr 1fr/.test(H));
  assert.ok(/@media \(max-width:820px\)\{\.grille-analyse\{grid-template-columns:1fr/.test(H));
  assert.ok(/\.periode-btn\{min-height:44px/.test(H));
});
t('pas d\'em dash dans le texte affiché ajouté', () => {
  const diff = execSync('git diff origin/production -- NEXUS-Carburants-Pilotage-v1.html', { cwd: __dirname, maxBuffer: 1 << 28 }).toString();
  const ajout = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).filter(l => !/^\+\s*(\/\/|\/\*|\*)/.test(l));
  const retrait = diff.split('\n').filter(l => l.startsWith('-') && !l.startsWith('---'));
  const nb = ls => ls.reduce((a, l) => a + (l.match(/—/g) || []).length, 0);
  assert.ok(nb(ajout) <= nb(retrait), 'tirets longs ajoutés : ' + nb(ajout) + ' pour ' + nb(retrait) + ' retirés');
});
t('aucune migration dans le diff', () => {
  const noms = execSync('git diff --name-only origin/production', { cwd: __dirname }).toString();
  assert.ok(!/migrations?\//.test(noms), noms);
});

garde('mutée : ⓘ redevenu span', H, h => !/<span class="ecart-caveat"/.test(h), '<button type="button" class="ecart-caveat" aria-label="Diagnostic de l\'écart"', '<span class="ecart-caveat"');
garde('mutée : id du simulateur perdu', H, h => h.includes('id="btnSimulateurCommandeToggle"'), 'id="btnSimulateurCommandeToggle"', 'id="x"');
garde('mutée : id situationZone perdu', H, h => h.includes('id="situationZone"'), 'id="situationZone"', 'id="x"');
garde('mutée : moyenne recalculée', H, h => /const moyenne = ctx && ctx\.consoMoyenne \? ctx\.consoMoyenne\[cle\] : null;/.test(h), 'ctx.consoMoyenne ? ctx.consoMoyenne[cle] : null', '0');
garde('mutée : 0 L sans relevé', H, h => /v\.moyenne == null \? 'Pas de relevé sur 7 jours'/.test(h), "v.moyenne == null ? 'Pas de relevé sur 7 jours'", "v.moyenne == null ? '0 L/jour'");
garde('mutée : carte sans tabindex', H, h => /data-releve-controle="\$\{cle\}" tabindex="0"/.test(h), ' tabindex="0">\n', '>\n');
garde('mutée : police sous 11 px', H, h => ![...h.matchAll(/font-size:\s*([0-9.]+)px/g)].some(m => parseFloat(m[1]) < 11), '.carb-litres{font-family:var(--mono); font-size:13px', '.carb-litres{font-family:var(--mono); font-size:9px');
garde('mutée : filtre site retiré', D, d => { const i = d.indexOf('async function chargerConsommationJournaliereMoyenne'); return /\.eq\('site', siteId\)\.gte\('date', debutISO\)/.test(d.slice(i, i + 1500)); }, ".eq('site', siteId).gte('date', debutISO)", ".gte('date', debutISO)");
garde('mutée : navigation sans sticky', H, h => /@media \(max-width:820px\)\{\.quick-nav\{position:sticky/.test(h), '.quick-nav{position:sticky', '.quick-nav{position:static');
garde('mutée : colonne Lecture NEXUS', H, h => /niveaux: \['ok'\]/.test(h), "niveaux: ['ok']", "niveaux: []");
garde('mutée : message page ⓘ', H, h => h.includes('identifie le produit, pas un niveau'), 'identifie le produit, pas un niveau', 'identifie');
console.log(n + ' épreuves OK');
