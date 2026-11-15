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
assert.ok(/produit tire/.test(C.conseillerSuivi.moteurs(1)) && /produits tirent/.test(C.conseillerSuivi.moteurs(3)));
assert.ok(/à revoir/.test(C.conseillerSuivi.aRevoir(2)));
assert.strictEqual(C.conseillerAchats.preparer, 'Préparer les achats');
assert.ok(/hors délai/.test(C.conseillerAchats.horsDelai(2)));
assert.ok(/économiser/.test(C.conseillerBilan.economie('12,50 €')));
const textes = JSON.stringify([C.conseillerSuivi.moteurs(2), C.conseillerSuivi.aucun, C.conseillerSuivi.estime, C.conseillerAchats, C.conseillerBilan.estime, C.conseillerBilan.reel]);
assert.ok(!/[—–]/.test(textes), 'pas de tiret long');

// Audit V1 : seule la bannière de la V1 y mène ; aucune entrée de recherche, menu ou accueil.
['nexus-recherche.js', 'nexus-desktop.js', 'NEXUS-App-v1.html', 'NEXUS-Campagne-v2.html', 'NEXUS-Campagne-v2-Ventes.html', 'NEXUS-Campagne-v2-Livraison.html', 'NEXUS-Campagne-v2-Achats.html', 'NEXUS-Campagne-v2-Objectifs.html', 'NEXUS-Documentation-v1.html'].forEach((f) => {
  assert.ok(!/NEXUS-Campagne-v1\.html/.test(lire(f)), f + ' mène à la V1');
});
console.log('OK campagne C6');
