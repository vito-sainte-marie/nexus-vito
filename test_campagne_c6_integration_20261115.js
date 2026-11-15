// C6 : intégration (icône officielle, recherche, documentation, lexique du Conseiller, audit V1).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const lire = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

// Icône : trois tailles présentes, source carrée absente.
['48', '96', '144'].forEach((t) => {
  const f = path.join(__dirname, 'assets/icones/campagne/premium/campagne-opportunites-achat-' + t + '.webp');
  assert.ok(fs.existsSync(f) && fs.statSync(f).size > 0, 'icône ' + t);
});
assert.ok(!fs.existsSync(path.join(__dirname, 'assets/icones/campagne/premium/source-carre.png')));
const voc = lire('nexus-vocabulaire.js');
assert.ok(/cle: 'opportunites-achat', dispo: true, picto: 'opportunites-achat'/.test(voc));

// Recherche : les trois pages sont joignables, réservées au manager.
const rech = lire('nexus-recherche.js');
['Ventes', 'Livraison', 'Achats'].forEach((n) => {
  const m = rech.match(new RegExp("href: 'NEXUS-Campagne-v2-" + n + "\\.html', role: 'manager', forfait: 'professional'"));
  assert.ok(m, 'recherche ' + n);
});

// Documentation : plus de « jamais par produit », les trois pages décrites.
const doc = lire('NEXUS-Documentation-v1.html');
assert.ok(!/jamais par produit/.test(doc));
assert.ok(/Suivi des ventes/.test(doc) && /Livraison/.test(doc) && /Opportunités d'achat/.test(doc));

// Lexique du Conseiller.
const sandbox = { window: {}, NexusVocab: undefined };
new Function('window', 'self', voc + '\n;window.__V = (typeof NexusVocab !== "undefined" ? NexusVocab : window.NexusVocab);')(sandbox.window, sandbox.window);
const C = sandbox.window.__V.campagne;
assert.ok(/tient le rythme/.test(C.conseillerSuivi.moteurs(1)) && /tiennent le rythme/.test(C.conseillerSuivi.moteurs(3)));
assert.ok(/à revoir/.test(C.conseillerSuivi.aRevoir(2)));
assert.strictEqual(C.conseillerAchats.preparer, 'Préparer les achats');
assert.ok(/hors délai/.test(C.conseillerAchats.horsDelai(2)));
assert.ok(/économie de/.test(C.conseillerBilan.economie('12,50 €')));
const textes = JSON.stringify([C.conseillerSuivi.moteurs(2), C.conseillerSuivi.aucun, C.conseillerSuivi.estime, C.conseillerAchats.horsDelai(1, '3 nov.'), C.conseillerAchats.horsDelai(2, null), C.conseillerSuivi.aRevoir(1), C.conseillerSuivi.aRevoir(3), C.conseillerSuivi.moteurs(1), C.conseillerBilan.economie('1,00 €'), C.conseillerBilan.estime, C.conseillerBilan.reel]);
assert.ok(!/[—–]/.test(textes), 'pas de tiret long');
assert.ok(!/vos ventes/i.test(voc.slice(voc.indexOf('conseillerSuivi'))), 'vos ventes');

// Phrases du Conseiller : une phrase par cas, aucune sans donnée.
const { phrasesConseiller } = require('./nexus-campagne-conseil.js');
const fmt = { eur: (v) => v + ' €', date: (d) => d };
const ligne = (statut, extra) => Object.assign({ article: 'A', statut }, extra || {});
assert.deepStrictEqual(phrasesConseiller({ V: C, fmt }), []);
assert.deepStrictEqual(phrasesConseiller({ suivi: { vide: true, lignes: [] }, V: C, fmt }), []);
let r = phrasesConseiller({ suivi: { vide: false, lignes: [ligne('moteur'), ligne('moteur'), ligne('a_revoir')] }, V: C, fmt });
assert.strictEqual(r.length, 2); assert.ok(/tiennent le rythme/.test(r[0]) && /à revoir/.test(r[1]));
r = phrasesConseiller({ suivi: { vide: false, lignes: [ligne('non_mesurable')] }, V: C, fmt });
assert.deepStrictEqual(r, [C.conseillerSuivi.aucun]);
r = phrasesConseiller({ suivi: { vide: false, lignes: [ligne('moteur', { marge_estimee: true })] }, V: C, fmt });
assert.strictEqual(r.length, 2); assert.strictEqual(r[1], C.conseillerSuivi.estime);
assert.deepStrictEqual(phrasesConseiller({ achats: { ctx: { reco: [{ b: { hors_delai: false } }], lim: { date: '2026-11-20' } } }, V: C, fmt }), []);
r = phrasesConseiller({ achats: { ctx: { reco: [{ b: { hors_delai: true } }, { b: { hors_delai: true } }], lim: { date: '2026-11-20' } } }, V: C, fmt });
assert.strictEqual(r.length, 1); assert.ok(/2 achats sont hors délai/.test(r[0]) && /2026-11-20/.test(r[0]));
assert.deepStrictEqual(phrasesConseiller({ bilan: { articles: [], totaux: { economie_achat_stock_restant: 5 } }, V: C, fmt }), []);
assert.deepStrictEqual(phrasesConseiller({ bilan: { articles: [{ estimee: false }], totaux: { economie_achat_stock_restant: null } }, V: C, fmt }), []);
assert.deepStrictEqual(phrasesConseiller({ bilan: { articles: [{ estimee: false }], totaux: { economie_achat_stock_restant: 0 } }, V: C, fmt }), []);
r = phrasesConseiller({ bilan: { articles: [{ estimee: true }], totaux: { economie_achat_stock_restant: 12.5 } }, V: C, fmt });
assert.strictEqual(r.length, 2); assert.ok(/12.5 €/.test(r[0])); assert.strictEqual(r[1], C.conseillerBilan.estime);
r = phrasesConseiller({ bilan: { articles: [{ estimee: false }], totaux: { economie_achat_stock_restant: 12.5 } }, V: C, fmt });
assert.strictEqual(r[1], C.conseillerBilan.reel);
assert.ok(!/[—–]/.test(JSON.stringify(r)));
// Câblage : la page Campagne charge le module et appelle les mêmes moteurs.
const hub = lire('NEXUS-Campagne-v2.html');
assert.ok(/nexus-campagne-conseil\.js/.test(hub) && /phrasesConseiller/.test(hub) && /CV\.suivre\(/.test(hub) && /etatAchats\(/.test(hub));

// Audit V1 : seule la bannière de la V1 y mène ; aucune entrée de recherche, menu ou accueil.
['nexus-recherche.js', 'nexus-desktop.js', 'NEXUS-App-v1.html', 'NEXUS-Campagne-v2.html', 'NEXUS-Campagne-v2-Ventes.html', 'NEXUS-Campagne-v2-Livraison.html', 'NEXUS-Campagne-v2-Achats.html', 'NEXUS-Campagne-v2-Objectifs.html', 'NEXUS-Documentation-v1.html'].forEach((f) => {
  assert.ok(!/NEXUS-Campagne-v1\.html/.test(lire(f)), f + ' mène à la V1');
});
console.log('OK campagne C6');
