// Épreuve — 02/11/2026, lot INVENTAIRE-CAISSE-RENFORT-20261102, L1 (fil « Ma caisse », module pur).
// Exigences (decision-4) : refus par défaut ; pilote caissière seulement ; non-pilote et autre rôle inchangés (aucun fil, aucune adresse) ;
// plan fait des seules étapes restantes ; changement de quart = un comptage de l'entrante. SRC_MUTE : source mutée pour la preuve de mutation.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const F = path.resolve(process.env.SRC_MUTE || path.join(__dirname, 'nexus-fil-caisse.js'));
const m = { exports: {} };
new Function('module', 'self', fs.readFileSync(F, 'utf8'))(m, undefined);
const C = m.exports;
let ok = 0;
const cas = (nom, f) => { f(); ok++; console.log('  ✓ ' + nom); };

cas('refus par défaut : ni pilote ni rôle → aucun fil', () => {
  for (const [p, r] of [[undefined, undefined], [false, 'caissiere'], [true, 'pompiste'], [true, undefined], ['true', 'caissiere'], [1, 'caissiere'], [null, null]]) {
    assert.strictEqual(C.autorise(p, r), false);
    assert.strictEqual(C.estActif('?fil=caisse&etape=1', p, r), false);
    assert.strictEqual(C.etapeDe('?fil=caisse&etape=1', p, r), null);
    assert.strictEqual(C.urlEtape(1, [1, 2], p, r), null);
    assert.strictEqual(C.urlApres(1, [1, 2], p, r), null);
    assert.deepStrictEqual(C.planPour({ pilote: p, roleDuJour: r, inscrit: false, comptageFait: false, fermetureDue: true, fermetureFaite: false }), []);
  }
});
cas('pilote caissière : fil actif et étape lue', () => {
  assert.strictEqual(C.estActif('?fil=caisse&etape=2', true, 'caissiere'), true);
  assert.strictEqual(C.etapeDe('?fil=caisse&etape=2', true, 'caissiere'), 2);
  assert.strictEqual(C.etapeDe('?fil=caisse&etape=9', true, 'caissiere'), null);
  assert.strictEqual(C.estActif('?fil=debut-quart&etape=1', true, 'caissiere'), false);
});
cas('plan : seules les étapes restantes', () => {
  const b = { pilote: true, roleDuJour: 'caissiere' };
  assert.deepStrictEqual(C.planPour({ ...b, inscrit: false, comptageFait: false, fermetureDue: true, fermetureFaite: false }), [1, 2, 3]);
  assert.deepStrictEqual(C.planPour({ ...b, inscrit: true, comptageFait: false, fermetureDue: false, fermetureFaite: false }), [2]);
  assert.deepStrictEqual(C.planPour({ ...b, inscrit: true, comptageFait: true, fermetureDue: true, fermetureFaite: true }), []);
});
cas('changement de quart : un comptage de l\'entrante, sinon ouverture', () => {
  assert.strictEqual(C.natureComptage({ quartPrecedentCompte: true }), 'changement');
  assert.strictEqual(C.natureComptage({ quartPrecedentCompte: false }), 'ouverture');
  assert.strictEqual(C.natureComptage({}), 'ouverture');
});
cas('adresses et libellés', () => {
  assert.strictEqual(C.urlEtape(2, [2, 3], true, 'caissiere'), 'NEXUS-Inventaire-v1.html?fil=caisse&etape=2&plan=2.3');
  assert.strictEqual(C.urlApres(3, [2, 3], true, 'caissiere'), 'NEXUS-App-v1.html');
  assert.strictEqual(C.urlEtape(0, [2], true, 'caissiere'), null);
  assert.strictEqual(C.libelleProgression(2, [2, 3]), 'Étape 1 sur 2');
  assert.strictEqual(C.libelleContinuer(3, [2, 3]), 'Terminer ma caisse');
  assert.deepStrictEqual(C.planDe('?plan=3.2'), [1, 2, 3]);
});
cas('vocabulaire des rôles : seul le rôle du jour `caissiere` (shifts.role) ouvre le fil', () => {
  // employees.role dit « caissier » (sans e) : le passer au module ne montrerait jamais le fil, sans erreur visible.
  assert.strictEqual(C.autorise(true, 'caissier'), false);
  assert.strictEqual(C.planPour({ pilote: true, roleDuJour: 'caissier', inscrit: false, comptageFait: false, fermetureDue: true, fermetureFaite: false }).length, 0);
  assert.strictEqual(C.urlEtape(1, [1], true, 'caissier'), null);
  // polyvalent : refusé par défaut, la pilote doit être planifiée en `caissiere` pendant le pilote.
  for (const r of ['polyvalent', 'pompiste', 'renfort', 'manager', 'gerant', 'Caissiere', null, undefined]) assert.strictEqual(C.autorise(true, r), false, String(r));
  assert.strictEqual(C.autorise(true, 'caissiere'), true);
});
cas('aucun accès à pilotesRenfort dans le module', () => assert.ok(!/pilotesRenfort/.test(fs.readFileSync(F, 'utf8').replace(/\/\/.*$/gm, ''))));

// ── Périmètre du comptage d'entrée (condition 2) : cigarettes, CBD, produits du jour ──
const P = (nom) => ({ id: nom, inventaire_categories: { nom } });
const LISTE = ['Cigarettes', 'CBD', 'Journaux', 'Pains / Sandwichs', 'Viennoiserie', 'Gaz', 'Huiles', 'Jaugeage Carburant', 'Glaçons'].map(P);
cas('pilote caissière : seules les familles de la caisse restent', () => {
  const r = C.restreindre(LISTE, true, 'caissiere');
  assert.deepStrictEqual(r.map((x) => x.id), ['Cigarettes', 'CBD', 'Journaux', 'Pains / Sandwichs', 'Viennoiserie']);
});
cas('non-pilote, pompiste, polyvalent, renfort, manager : la liste revient inchangée (même référence)', () => {
  for (const [p, r] of [[false, 'caissiere'], [undefined, 'caissiere'], [true, 'pompiste'], [true, 'polyvalent'], [true, 'renfort'], [true, 'manager'], [true, 'caissier']]) assert.strictEqual(C.restreindre(LISTE, p, r), LISTE);
});
cas('liste non tableau : renvoyée telle quelle, sans exception', () => {
  assert.strictEqual(C.restreindre(null, true, 'caissiere'), null);
  assert.strictEqual(C.restreindre(undefined, true, 'caissiere'), undefined);
});
cas('aucune nouvelle catégorie : la casse ne compte pas, une catégorie inconnue est écartée', () => {
  assert.strictEqual(C.estProduitCaisse(P('CIGARETTES')), true);
  assert.strictEqual(C.estProduitCaisse(P('Boissons chaudes')), false);
  assert.strictEqual(C.estProduitCaisse({}), false);
  assert.strictEqual(C.estProduitCaisse(null), false);
});

// ── Câblage de la page (épreuve statique) ──
const HTML = fs.readFileSync(path.join(__dirname, process.env.PAGE_MUTE || 'NEXUS-Inventaire-v1.html'), 'utf8');
cas('page : le module est chargé et le fil n\'est activé que par etapeDe(pilote, rôle du jour)', () => {
  assert.ok(/<script src="nexus-fil-caisse\.js/.test(HTML));
  assert.ok(/NexusFilCaisse\.etapeDe\(location\.search, piloteCaisseCourant, roleDuJour\) === 2/.test(HTML));
});
cas('page : le rôle passé au module est roleDuJour, jamais la fiche employé', () => {
  const appels = HTML.match(/NexusFilCaisse\.(?:etapeDe|restreindre|autorise)\([^)]*\)/g) || [];
  assert.ok(appels.length >= 2);
  for (const a of appels) { assert.ok(/roleDuJour/.test(a), a); assert.ok(!/employeeCourant\.role|employee\.role/.test(a), a); }
});
cas('page : le fil caisse n\'allume pas enFil() (le flux de catégories reste celui d\'avant)', () => {
  const bloc = HTML.slice(HTML.indexOf('function filCaisseActiver'), HTML.indexOf('const filFermeture'));
  assert.ok(!/filEtape\s*=|enFil\s*=/.test(bloc));
  assert.ok(/const enFil = \(\) => filEtape != null;/.test(HTML));
});
cas('page : restreindreAuPlanQuart ne filtre par la caisse que si le fil est en cours, et le plan du quart ne s\'y applique pas', () => {
  const i = HTML.indexOf('function restreindreAuPlanQuart');
  const f = HTML.slice(i, HTML.indexOf('\n  }', i));
  assert.ok(/if \(filCaisseEnCours\) return window\.NexusFilCaisse\.restreindre\(liste, piloteCaisseCourant, roleDuJour\);/.test(f));
  assert.ok(f.indexOf('filCaisseEnCours') < f.indexOf('planQuartActif'));
});
cas('module : le message de liste vide est exposé', () => {
  assert.ok(/Aucun produit caisse à compter, prévenez votre responsable/.test(C.MESSAGE_AUCUN_PRODUIT));
});
cas('restreindre : catégorie renommée ou site sans ces familles → liste vide', () => {
  assert.deepStrictEqual(C.restreindre([P('Boissons'), P('Gaz')], true, 'caissiere'), []);
  assert.deepStrictEqual(C.restreindre([], true, 'caissiere'), []);
});
cas('page : liste caisse vide → message, aucune écriture, avant tout chargement de stock', () => {
  const i = HTML.indexOf('filCaisseEnCours && produitsZone.length === 0');
  assert.ok(i > 0);
  const bloc = HTML.slice(i, HTML.indexOf('return;', i) + 7);
  assert.ok(/MESSAGE_AUCUN_PRODUIT/.test(bloc) && /filCaisseTerminer/.test(bloc));
  assert.ok(!/\.(insert|upsert|update|delete|rpc)\(|from\('/.test(bloc));
  assert.ok(i < HTML.indexOf('chargerDerniersStocks(ids)', i));
});
cas('page : la référence d\'écart aveugle couvre tout le périmètre caisse', () => {
  assert.ok(/produitsPlanIds\.has\(produitId\) \|\| filCaisseEnCours/.test(HTML));
});
cas('page : aucune écriture ni droit nouveau dans le bloc du fil caisse', () => {
  const bloc = HTML.slice(HTML.indexOf('function filCaisseActiver'), HTML.indexOf('const filFermeture'));
  assert.ok(!/\.(insert|upsert|update|delete|rpc)\(/.test(bloc));
  assert.ok(!/inventaire_quart_employes|from\('/.test(bloc));
});
cas('page : bouton final « Terminer ma caisse » tant que l\'étape 3 n\'est pas câblée', () => {
  assert.ok(!/NexusFilCaisse\.libelleContinuer\(/.test(HTML));
  assert.strictEqual((HTML.match(/NexusFilCaisse\.LIBELLE_TERMINER/g) || []).length, 2);
});
cas('page : titre de catégorie sans « Étape » dans le fil caisse (une seule numérotation)', () => {
  const i = HTML.indexOf('function libelleEtapeParcours');
  const bloc = HTML.slice(i, HTML.indexOf('const cible', i));
  assert.ok(/enFil\(\) \|\| filCaisseEnCours\) \? ''/.test(bloc));
  assert.ok(/catégories`/.test(bloc));
});
cas('page : en fil caisse, « Précédent » et « Retour » sont masqués (sortie par la barre seule)', () => {
  assert.ok(/body[^\n]*classList\.add\('fil-actif', 'fil-caisse'\)/.test(HTML) || /classList\.add\('fil-actif', 'fil-caisse'\)/.test(HTML));
  assert.ok(/\.fil-caisse \.nexus-retour-btn, \.fil-caisse #btnAnnulerOuverture \{ display: none !important; \}/.test(HTML));
});
cas('page : étiquette cigarettes courte, sans « bureau géré par le manager »', () => {
  assert.ok(!/bureau géré par le manager/.test(HTML));
  assert.strictEqual((HTML.match(/📍 Caisse uniquement</g) || []).length, 3);
});
console.log(`\n${ok} contrôles OK`);
