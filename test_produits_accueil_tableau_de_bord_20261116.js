// Accueil Produits : tableau de bord commercial. Exécution réelle de la page (banc du test Scanner) :
// valeurs des quatre cartes, cartes de vigilance et filtres ouverts, Conseiller, chevron d'actualisation.
const assert = require('assert'), fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'test_scanner_tarifaire_presentation_20261116.js'), 'utf8').split('(async () => {')[0];
const { executer, jeu } = new Function('require', '__dirname', src + '; return { executer, jeu };')(require, __dirname);

function banc(ctx) {
  const els = {}, ecouteurs = {}, sorties = { filtres: [], vues: [] };
  const el = id => els[id] || (els[id] = { id, innerHTML: '', textContent: '', value: '', dispatchEvent(e) { sorties.filtres.push([id, this.value]); }, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} });
  const z = el('syntheseAccueil');
  z.querySelectorAll = sel => {
    const attr = sel.includes('data-vig') ? 'data-vig' : sel.includes('data-vue') ? 'data-vue' : null;
    if (!attr) return [];
    return [...z.innerHTML.matchAll(new RegExp(attr + '="([^"]+)"', 'g'))].map(m => ({ dataset: { [attr === 'data-vig' ? 'vig' : 'vue']: m[1] }, addEventListener: (_, f) => { (ecouteurs[attr + m[1]] = ecouteurs[attr + m[1]] || []).push(f); } }));
  };
  // La vue « Mes produits » lit ses filtres (#fRayon, #fTva…) dans le corps de la vue : le banc les sert.
  el('vueCorps').querySelector = s => el(String(s).replace(/^#/, ''));
  el('conseillerAccueil');
  const dc = ctx.document;
  dc.getElementById = id => el(id);
  return { els, sorties, clic: (attr, id) => (ecouteurs[attr + id] || []).forEach(f => f()), z };
}

(async () => {
  const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Produits-v1.html'), 'utf8');
  const r = await executer(html, jeu('nexus-station-test'));
  const b = banc(r.ctx);
  r.ctx.NexusAccueilTableau.afficher();
  const c = b.z.innerHTML;
  assert.ok(c.length > 300, 'accueil vide : ' + r.errs.join(' | ').slice(0, 300));
  assert.ok(!/Dernière période importée/.test(c), 'ancien bloc supprimé');
  assert.ok(!/sa-compteur/.test(c), 'anciens compteurs supprimés');
  assert.ok(!/sorties non commerciales/i.test(c), 'pas de ligne sorties non commerciales');
  for (const t of ['CA commercial HT', 'Marge générée HT', 'Références vendues', 'CA moyen par jour', 'estimée au PMP Decenium HT']) assert.ok(c.includes(t), t);
  assert.strictEqual((c.match(/class="sc-ind /g) || []).length, 4, 'quatre cartes de performance');
  assert.ok(/du 05\/10\/2026 au 09\/11\/2026, 36 jours/.test(c), 'période en clair : ' + (c.match(/Période : [^<]*/) || [''])[0]);
  const I = r.ctx.NexusAccueilTableau.indicateursAccueil();
  assert.strictEqual(I.jours, 36);
  assert.ok(Math.abs(I.parJour - I.ca / 36) < 1e-9, 'CA moyen par jour = CA / jours');
  assert.ok(I.refs > 0 && c.includes('>' + I.refs + '<'), 'références vendues affichées : ' + I.refs);
  // Actualisation : dates permanentes, rapprochement derrière un chevron.
  assert.ok(/Dernières ventes : /.test(c) && /Dernier relevé de stock théorique : /.test(c));
  const d = c.slice(c.indexOf('<details class="sa-details"'));
  assert.ok(/<summary>Sources et limites<\/summary>/.test(d), 'chevron renommé (A5)');
  assert.ok(/<h2 class="sa-titre">Dernière actualisation<\/h2>/.test(c), 'titre visible (A5)');
  assert.ok(!/<details class="sa-details"[^>]* open/.test(c), 'fermé par défaut (A5)');
  assert.ok(/CA analytique .* \+ opérations de caisse .* = CA importé/.test(d), 'rapprochement dans le chevron');
  assert.ok(!/em dash|—/.test(c), 'pas de tiret cadratin');
  console.log('OK  quatre cartes, période, actualisation');

  // Cartes de vigilance : chacune cliquable, seulement si compte > 0.
  const L = r.ctx.NexusAccueilTableau.pointsVigilance(I);
  const ids = L.map(x => x.id);
  for (const x of L) assert.ok(x.n > 0 && c.includes(`data-vig="${x.id}"`), 'carte ' + x.id);
  assert.ok(!/data-vig="tva"/.test(c) || ids.includes('tva'));
  const zero = r.ctx.NexusAccueilTableau.pointsVigilance({ dormants: [], nbIdent: 0, R: { perte: { non_justifiees: 0 } }, nbTva: 0 });
  assert.deepStrictEqual(Array.from(zero), [], 'aucune carte à zéro');
  const tous = r.ctx.NexusAccueilTableau.pointsVigilance({ dormants: [1, 2], nbIdent: 8, R: { perte: { non_justifiees: 3 } }, nbTva: 1 });
  assert.deepStrictEqual(Array.from(tous, x => x.id), ['dormants', 'identifier', 'pertes', 'tva']);
  console.log('OK  cartes de vigilance affichées selon le compte');

  // Filtres ouverts par chaque carte.
  const forcer = id => { b.sorties.filtres.length = 0; b.clic('data-vig', id); };
  const mod = html.slice(html.indexOf('const actions = {'), html.indexOf('const cc = document.getElementById'));
  assert.ok(/identifier: \(\) => versProduitsF\('fNature', 'a_identifier'\)/.test(mod), 'filtre nature a_identifier');
  assert.ok(/tva: \(\) => versProduitsF\('fTva', 'incoherente'\)/.test(mod), 'filtre tva incoherente');
  assert.ok(/dormants: \(\) => ouvrirVue\('dormants'\)/.test(mod), 'vue dormants');
  assert.ok(/SCANNER_CARTE_FORCEE = 'pertes'; ouvrirVue\('scanner'\)/.test(mod), 'carte pertes du Scanner');
  if (ids.includes('identifier')) { forcer('identifier'); assert.ok(b.sorties.filtres.some(f => f[0] === 'fNature' && f[1] === 'a_identifier'), 'nature a_identifier : ' + JSON.stringify(b.sorties.filtres)); }
  if (ids.includes('tva')) { forcer('tva'); assert.ok(b.sorties.filtres.some(f => f[0] === 'fTva' && f[1] === 'incoherente')); }
  if (ids.includes('dormants')) {
    forcer('dormants');
    const attendu = Array.from(r.ctx.PRODUCTS).filter(x => r.ctx.calculerStatutSimplifie(x).cle === 'dormant').length;
    assert.strictEqual(I.dormants.length, attendu, 'dormants = calculerStatutSimplifie');
    assert.ok(new RegExp(attendu + ' produits? dormants?').test(b.els.vueCorps.innerHTML), 'liste dormants : ' + b.els.vueCorps.innerHTML.slice(0, 200));
  }
  if (ids.includes('pertes')) {
    forcer('pertes');
    // Changement attendu (fiche v2, matrice, ligne « Ventes à perte ») : la carte T1 « pertes » devient la carte T2 « marge_negative » (alerte A3).
    // La vue T2 est asynchrone : l'ouverture se prouve par la route (assertée plus haut) et par un corps non vide ; le rendu est prouvé par les épreuves de page.
    assert.ok(b.els.vueCorps.innerHTML.length > 0, 'Scanner T2 ouvert');
  }
  console.log('OK  filtres et vues ouverts par chaque carte');

  // Conseiller : synthèse sur résultats calculés.
  const T = r.ctx.NexusAccueilTableau.texteConseillerAccueil;
  assert.ok(/point/.test(b.els.conseillerAccueil.textContent) && !/Recherchez un produit/.test(b.els.conseillerAccueil.textContent), 'Conseiller : ' + b.els.conseillerAccueil.textContent);
  assert.strictEqual(T({}, []), 'Aucun point de vigilance sur cette période.');
  const A = { pertes: [{ article: 'HARIBO', perte: { justifiee: false, montant: 20.02 } }, { article: 'Mars', perte: { justifiee: false, montant: 2.85 } }], suspects: [] };
  const t = T({ A }, [{ id: 'pertes', titre: 'Ventes à perte non justifiées' }, { id: 'dormants', titre: 'Produits dormants' }]);
  assert.ok(/^Deux points de vigilance/.test(t) && /HARIBO/.test(t) && /Commencez par/.test(t), t);
  assert.ok(!/urgent|tendance|hausse de/i.test(t), 'pas de tendance ni d\'urgence inventée');
  const ts = T({ A: { pertes: [], suspects: [{ article: 'Menthe' }] } }, [{ id: 'dormants', titre: 'Produits dormants' }]);
  assert.ok(/Menthe/.test(ts) && /Scanner tarifaire/.test(ts), ts);
  console.log('OK  Conseiller de l\'accueil');
  // Corrections de recette 16/11 (Guardian 6917134124).
  const htmlC = fs.readFileSync(path.join(__dirname, 'NEXUS-Produits-v1.html'), 'utf8');
  assert.ok(/e\.aIdentifier\)/.test(html) && /f\.nature === 'a_identifier'/.test(html), 'À identifier : même critère que le compteur');
  assert.ok(!/<p id="conseillerAccueil">/.test(htmlC.slice(0, htmlC.indexOf('function afficherSyntheseAccueil'))), 'plus de Conseiller statique sous la synthèse');
  assert.ok(!/Recherchez un produit ci-dessus/.test(htmlC), 'ancienne phrase générique retirée');
  const zh = b.z.innerHTML;
  const ip = zh.indexOf('Performance commerciale'), ic = zh.indexOf('id="conseillerAccueil"'), iv = zh.indexOf('Points de vigilance'), ia = zh.indexOf('Dernière actualisation');
  assert.ok(ip > -1 && ip < ic && ic < ia, 'canevas B puis C : Conseiller après Performance commerciale, avant la dernière actualisation');
  assert.ok(iv === -1 || ic < iv, 'Conseiller avant les points de vigilance');
  assert.ok(zh.indexOf('id="conseillerAccueil"') < zh.indexOf('data-vue='), 'Conseiller avant les cartes de navigation');
  assert.ok(/\.synthese-accueil \.sc-ind-val\{[^}]*white-space:nowrap/.test(html), 'montants insécables');
  assert.ok(!/<span class="t-sous">\$\{esc\(c\.sous\)\}/.test(html), 'nombre non répété dans les points de vigilance');
  console.log('OK  corrections de recette 16/11');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

// A8 : libellé « TVA à vérifier (catalogue) » et (i), sans chiffre codé en dur.
(function () {
  const src = require('fs').readFileSync(require('path').join(__dirname, 'NEXUS-Produits-v1.html'), 'utf8');
  const assert = require('assert');
  assert.ok(src.includes("titre: 'TVA à vérifier (catalogue)'"), 'A8 carte');
  assert.ok(src.includes('TVA à vérifier (catalogue) · <button'), 'A8 ligne À compléter');
  const info = src.match(/titre: 'TVA à vérifier \(catalogue\)'[^\n]*?info: '((?:[^'\\]|\\.)*)'/);
  assert.ok(info, 'A8 (i) présent');
  const t = info[1];
  assert.ok(/confirmations/.test(t), 'A8 (i) mentionne les confirmations déjà déduites');
  assert.ok(!/\d/.test(t), 'A8 (i) sans aucun chiffre');
  assert.ok(t.length <= 80, 'A8 (i) 80 caractères au plus (' + t.length + ')');
  assert.ok(!/pilote/i.test(t), 'A8 (i) parle à un manager de station : pas de « pilote »');
  console.log('OK  A8 libellé et (i) TVA catalogue');
})();
