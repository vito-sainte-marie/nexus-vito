// Refonte visuelle Carburants Performance (Guardian 6723914835, 08/11/2026) : presentation seulement.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
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
  // Valeurs figées (CI sans origin/production) : décomptes du fichier de données à la base de cette PR.
  const nb = re => (D.match(re) || []).length;
  assert.strictEqual(nb(/\.from\(/g), 49);
  assert.strictEqual(nb(/\.insert\(/g), 6);
  assert.strictEqual(nb(/\.update\(/g), 3);
  assert.strictEqual(nb(/\.upsert\(/g), 4);
  ['function syntheseVentesCarburant', 'function htmlBlocVentes'].forEach(e => {
    const c = bloc(H, e);
    assert.ok(c.length > 50, e);
    assert.ok(!/\.(insert|update|upsert|delete|rpc|from)\(/.test(c), 'aucun appel base dans ' + e);
  });
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
t('grille d\'analyse deux colonnes, repliée en une sous 700 px de conteneur', () => {
  assert.ok(/\.grille-analyse\{display:grid; grid-template-columns:1fr 1fr/.test(H));
  assert.ok(/@container \(max-width:699px\)\{\.grille-analyse\{grid-template-columns:1fr/.test(H));
  assert.ok(/\.periode-btn\{min-height:44px/.test(H));
});
t('pas d\'em dash dans le texte affiché des nouveaux blocs', () => {
  const entete = H.slice(H.indexOf('<header class="header hero"'), H.indexOf('</header>', H.indexOf('<header class="header hero"')));
  const corps = [entete, bloc(H, 'function syntheseVentesCarburant'), bloc(H, 'function htmlBlocVentes')].join('\n')
    .split('\n').filter(l => !/^\s*(\/\/|\/\*|\*)/.test(l));
  assert.ok(!corps.some(l => /—/.test(l.replace(/'—'|"—"|`—`/g, ''))), corps.filter(l => /—/.test(l))[0]);
});

// ---- Réponse à Guardian 6724544198 / 6724526676 ----
t('grille de cartes : colonnes auto-adaptées, une seule colonne en largeur étroite, pas de 3e colonne vide', () => {
  assert.ok(/\.situation-grid\{[^}]*grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,260px\),1fr\)\)/.test(H));
  assert.ok(!/\.situation-grid\{[^}]*repeat\(3,1fr\)/.test(H));
});
t('bouton ⓘ Infos : 11 px minimum, forme de pastille, cible de 44 px', () => {
  assert.ok(/\.carb-info-btn\{[^}]*border-radius:999px[^}]*font:600 11px/.test(H));
  assert.ok(/\.carb-info-btn\{min-height:44px/.test(H));
});
t('Lecture NEXUS : « Rien à signaler » ; badge coloré par le niveau présent, neutre si seulement En attente', () => {
  assert.ok(H.includes('>Rien à signaler</div>') && !H.includes('>Rien</div>'));
  assert.ok(/classeBadgeSignalements = niveauxLignes\.includes\('alerte'\) \? 'niv-rouge' : \(niveauxLignes\.includes\('attention'\) \? 'niv-orange' : ''\)/.test(H));
  assert.ok(/class="lecture-nexus-badge-signalements \$\{classeBadgeSignalements\}"/.test(H));
});
t('badges de statut des cartes : aucun « … » ni « ? » affiché, badge vide masqué', () => {
  assert.ok(/ICONE_NIVEAU = \{ ok: '✓', attention: '!', alerte: '✕', attente: '' \}/.test(H));
  assert.ok(!/ICONE_NIVEAU\[[^\]]*\] \|\| '\?'/.test(H));
  assert.ok(/\.carb-fiab-badge:empty\{display:none;\}/.test(H));
});
t('en-tête : cadre fourni par le gabarit commun (.header)', () => {
  assert.ok(/<header class="header hero" id="heroCarburants">/.test(H));
});
t('pastille du site : nom du commerce par le mécanisme existant, plus d\'identifiant technique', () => {
  assert.ok(/<span class="pastille nexus-nom-commerce" id="pastilleSite"><\/span>/.test(H));
  assert.ok(!/pastilleSite'\)[^\n]*textContent\s*=\s*SITE_ID/.test(H));
});
t('les ⓘ d\'écart et d\'estimation sont des boutons natifs', () => {
  assert.ok(/<button type="button" class="ecart-caveat"[^>]*data-ecart-diag=/.test(H));
  assert.ok(/<button type="button" class="ecart-caveat"[^>]*data-estimation-info=/.test(H));
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
garde('grille : auto-fit retiré', H, h => /\.situation-grid\{[^}]*repeat\(auto-fit/.test(h), 'repeat(auto-fit,minmax(min(100%,260px),1fr))', 'repeat(3,1fr)');
garde('ⓘ Infos : police 11 px', H, h => /\.carb-info-btn\{[^}]*font:600 11px/.test(h), 'font:600 11px/1.25', 'font:600 9.5px/1.25');
garde('Rien à signaler', H, h => h.includes('>Rien à signaler</div>'), '>Rien à signaler</div>', '>Rien</div>');
garde('badge : niveau rouge selon alerte', H, h => /includes\('alerte'\) \? 'niv-rouge'/.test(h), "includes('alerte') ? 'niv-rouge'", "includes('ok') ? 'niv-rouge'");
garde('badge « … » masqué', H, h => /attente: '' \}/.test(h), "attente: '' }", "attente: '…' }");
garde('nom du commerce sur la pastille', H, h => /class="pastille nexus-nom-commerce" id="pastilleSite"/.test(h), 'class="pastille nexus-nom-commerce" id="pastilleSite"', 'class="pastille" id="pastilleSite"');

console.log(n + ' épreuves OK');
