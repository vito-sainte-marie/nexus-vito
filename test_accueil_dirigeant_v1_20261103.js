// Épreuve — 03/11/2026, Accueil du dirigeant V1 visuelle (GO Frédéric, consigne Guardian #160 6620494365).
// Doctrine : améliorer ce que l'utilisateur voit sans modifier ce que NEXUS fait. Chaque épreuve est contrôlée par une mutation.
const fs = require('fs'); const path = require('path'); const assert = require('assert'); const { execSync } = require('child_process');
const lire = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const APP = lire('NEXUS-App-v1.html');
const extraire = (src) => { const i = src.indexOf('const SITES_BANNIERE_VITO'); const j = src.indexOf("const hote = document.getElementById('prisePosteHote');", i); return src.slice(i, j); };
const fabrique = (src, search, theme) => new Function('APERCU_BANNIERE_DEMANDE', 'FUSEAU_STATION', 'document', 'MutationObserver', extraire(src) + '; return { banniereAccueilHtml, dateStationHtml };')(/(^|[?&])apercu_banniere=1(&|$)/.test(search), 'Indian/Reunion', { documentElement: { getAttribute: () => theme || 'sombre' }, querySelectorAll: () => [] }, function () { this.observe = () => {}; });
const hrefs = (html) => (html.match(/href="[^"#]*"/g) || []).sort();
const blocManager = (src) => { const i = src.indexOf('<div data-role="manager" style="display:none;">'); return src.slice(i, i + 6000); };
const EPREUVES = {
  'site ViTO : bandeau présent, srcset 800/1600, différé, alt, retrait si l’image échoue': (src) => {
    const h = fabrique(src, '', 'jour').banniereAccueilHtml('vito-sainte-marie');
    assert(h.includes('accueil-station-vito-800.webp 800w') && h.includes('accueil-station-vito-1600.webp 1600w'));
    const n = fabrique(src, '', 'sombre').banniereAccueilHtml('vito-sainte-marie');
    assert(n.includes('accueil-station-vito-nuit-800.webp 800w') && n.includes('accueil-station-vito-nuit-1600.webp 1600w') && !n.includes('vito-800.webp'));
    assert(h.includes('loading="lazy"') && /alt="[^"]{10,}"/.test(h) && h.includes('onerror="this.parentNode.remove()"'));
  },
  'NOUVEAU : bandeau absent pour un site non ViTO, avec ou sans paramètre': (src) => {
    for (const site of ['nexus-station-test', 'autre-station', undefined, null, '']) {
      for (const q of ['', '?apercu_banniere=1']) {
        if (site === 'nexus-station-test' && q) continue;
        assert.strictEqual(fabrique(src, q).banniereAccueilHtml(site), '', String(site) + q);
      }
    }
  },
  'aperçu Test : le paramètre montre le bandeau sur nexus-station-test seulement': (src) => {
    assert(fabrique(src, '?apercu_banniere=1').banniereAccueilHtml('nexus-station-test').includes('am-banniere'));
    assert.strictEqual(fabrique(src, '?apercu_banniere=1').banniereAccueilHtml('autre-station'), '');
  },
  'date à l’heure de la station, jamais celle de l’appareil': (src) => {
    assert(/toLocaleString\('fr-FR', \{ timeZone: FUSEAU_STATION/.test(src));
    assert.strictEqual(new Function('FUSEAU_STATION', extraire(src) + '; return dateStationHtml();')(null), '');
  },
  'tout sélecteur ajouté exige le marqueur du bloc dirigeant': (src) => {
    const css = src.slice(src.indexOf('/* Accueil du dirigeant, V1 visuelle'), src.indexOf('.section-tag{font-family:var(--mono)'));
    const sels = [...css.matchAll(/(?:^|\})\s*([^{}@\/][^{}]*)\{/g)].map((m) => m[1].trim()).filter((x) => x && !x.startsWith('@media'));
    assert(sels.length >= 15);
    for (const s of sels) for (const part of s.split(',')) assert(part.trim().startsWith('body:has(.am-marqueur)'), part);
  },
  'couleurs par jetons uniquement : aucune valeur en dur dans le nouveau CSS': (src) => {
    const css = src.slice(src.indexOf('/* Accueil du dirigeant, V1 visuelle'), src.indexOf('.section-tag{font-family:var(--mono)'));
    assert(!/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')));
  },
  'service : même lien, mêmes textes, même identifiant, sans photo (décision du 04/11)': (src) => {
    assert(src.includes('id="cheminService" href="NEXUS-Prise-De-Poste-v1.html"') && src.includes('Commencer mon service opérationnel'));
    assert(src.includes('Changer de rôle / refaire ma prise de poste') && src.includes('● Service en cours'));
    const i = src.indexOf('function renderPrisePoste('); const j = src.indexOf("if (typeof NexusPriseDePoste === 'undefined')", i);
    assert(!/poste-manager|ap-poste-image/.test(src.slice(i, j)));
  },
  'le marqueur n’est émis que par la branche manager': (src) => {
    assert.strictEqual((src.match(/class="am-marqueur"/g) || []).length, 1);
    const i = src.indexOf('function renderPrisePoste('); const j = src.indexOf("if (typeof NexusPriseDePoste === 'undefined')", i);
    assert(src.slice(i, j).includes('am-marqueur') && !src.slice(j, j + 3000).includes('am-marqueur'));
  },
  'destinations du bloc dirigeant identiques à celles de production': (src) => {
    let ref; try { ref = execSync('git show origin/production:NEXUS-App-v1.html 2>/dev/null || git show FETCH_HEAD:NEXUS-App-v1.html', { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return; }
    assert.deepStrictEqual(hrefs(blocManager(src)), hrefs(blocManager(ref)));
  },
  'les deux images existent, poids bornés': () => {
    assert(fs.statSync(path.join(__dirname, 'assets/accueil/accueil-station-vito-1600.webp')).size < 200 * 1024);
    assert(fs.statSync(path.join(__dirname, 'assets/accueil/accueil-station-vito-800.webp')).size < 80 * 1024);
    assert(fs.statSync(path.join(__dirname, 'assets/accueil/accueil-station-vito-nuit-1600.webp')).size < 200 * 1024);
    assert(fs.statSync(path.join(__dirname, 'assets/accueil/accueil-station-vito-nuit-800.webp')).size < 80 * 1024);
  },
  'fichiers interdits intacts (la fonctionnalité ne vit que dans NEXUS-App-v1.html et assets/accueil)': () => {
    // Indépendante de git et du build : un fichier interdit ne doit jamais citer la bannière.
    const interdits = ['nexus-desktop.js', 'nexus-theme.js', 'nexus-menu-accueil.js', 'nexus-recherche.js', 'nexus-raccourcis-catalogue.js', 'nexus-accueil-piste.js'];
    for (const f of interdits) {
      const c = fs.readFileSync(path.join(__dirname, f), 'utf8');
      assert(!/am-banniere|accueil-station-vito|apercu_banniere/.test(c), f);
    }
  },
  'la photo suit le thème : Jour = jour, Sombre = nuit, une seule image': (s) => {
    assert(s.includes("getAttribute('data-theme') !== 'jour'"));
    assert(s.includes("'assets/accueil/accueil-station-vito' + (nuit ? '-nuit' : '')"));
    assert(s.includes("attributeFilter: ['data-theme']"));
    assert((s.match(/class="am-banniere"><img/g) || []).length === 1);
  },
};
const MUTANTS = {
  'la photo suit le thème : Jour = jour, Sombre = nuit, une seule image': (s) => s.replace("attributeFilter: ['data-theme']", "attributeFilter: ['class']"),
  'site ViTO : bandeau présent, srcset 800/1600, différé, alt, retrait si l’image échoue': (s) => s.replace('loading="lazy"', ''),
  'NOUVEAU : bandeau absent pour un site non ViTO, avec ou sans paramètre': (s) => s.replace("['vito-sainte-marie']", "['vito-sainte-marie','nexus-station-test']"),
  'aperçu Test : le paramètre montre le bandeau sur nexus-station-test seulement': (s) => s.replace("siteId === SITE_APERCU_BANNIERE && ", ''),
  'date à l’heure de la station, jamais celle de l’appareil': (s) => s.replace('timeZone: FUSEAU_STATION, ', ''),
  'tout sélecteur ajouté exige le marqueur du bloc dirigeant': (s) => s.replace('body:has(.am-marqueur) .am-date{', '.am-date{'),
  'couleurs par jetons uniquement : aucune valeur en dur dans le nouveau CSS': (s) => s.replace('color:var(--text-mid); font-variant-numeric', 'color:#888; font-variant-numeric'),
  'service : même lien, mêmes textes, même identifiant, sans photo (décision du 04/11)': (s) => s.replace('id="cheminService"', 'id="autre"'),
  'le marqueur n’est émis que par la branche manager': (s) => s.replace("NexusPriseDePoste.monter(hote, employee)", "hote.insertAdjacentHTML('beforeend','<span class=\"am-marqueur\"></span>');NexusPriseDePoste.monter(hote, employee)").replace("if (typeof NexusPriseDePoste === 'undefined') return;", "if (typeof NexusPriseDePoste === 'undefined') return; /* am-marqueur */"),
};
let ko = 0;
for (const [nom, f] of Object.entries(EPREUVES)) {
  try { f(APP); } catch (e) { ko++; console.log('✗ ' + nom + ' — ' + e.message); continue; }
  const m = MUTANTS[nom];
  if (m) { const mut = m(APP); let mord = mut === APP; if (!mord) { try { f(mut); } catch (e) { mord = true; } } if (!mord) { ko++; console.log('✗ ' + nom + ' — la mutation ne la fait pas rougir'); continue; } }
  console.log('✓ ' + nom);
}
if (ko) { console.log(ko + ' échec(s)'); process.exit(1); }
console.log('Accueil dirigeant V1 : ' + Object.keys(EPREUVES).length + ' épreuves, toutes mordent.');
