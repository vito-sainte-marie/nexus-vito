// P1-B : la page Produits porte les tuiles, l'observation, les blocs repliables, les trois etats de TVA,
// les declarations d'un responsable et la synthese d'accueil. Test statique de la page.
const assert = require('assert');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/NEXUS-Produits-v1.html', 'utf8');
const sansCommentaires = html.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
let n = 0;
function ok(c, m) { assert.ok(c, m); n++; }

['CA HT', 'Marge générée HT', 'Taux de marque', 'Unités vendues', 'Marge unitaire', 'Ventes par jour'].forEach(t => ok(html.includes(t), 'tuile ' + t));
ok(html.includes('estimée au PMP du'), 'marge estimee au PMP du');
ok(html.includes('obs.libelle') && fs.readFileSync(__dirname + '/nexus-produits-mesure.js', 'utf8').includes('Ventes quotidiennes plus élevées sur la dernière période'), 'observation');
ok(html.includes('observation, pas une tendance confirmée'), 'mention observation');
ok(html.includes('seuil de 50 €') || html.includes('SEUIL_VOLUME_CA_EUR'), 'seuil');
ok(!/Augmenter les commandes|Commander davantage/i.test(sansCommentaires), 'aucune recommandation de commande');
['secPerf', 'secStock', 'secPhoto', 'secFiab'].forEach(id => ok(html.includes('id="' + id + '"'), 'bloc ' + id));
ok(/id="secFiab"(?![^>]*\sopen)/.test(html), 'Fiabilité et sources repliée par défaut');
ok(html.includes('d.id !== \'secFiab\''), 'secFiab non ouvert en grand ecran');
['Performance commerciale', 'Stock et implantation', 'Photo du rayon', 'Fiabilité et sources'].forEach(t => ok(html.includes(t), t));
ok(html.includes('Confirmer ou corriger'), 'bouton emplacement');
ok(html.includes('Confirmer la TVA'), 'bouton TVA');
ok(html.includes('Justifier ce déstockage'), 'bouton justification');
ok(html.includes('TTC à vérifier') && html.includes('TVA importée'), 'etat TVA incoherente');
ok(html.includes('TVA importée de Decenium, non confirmée') || html.includes('non confirmée'), 'etat importee');
ok(html.includes('syntheseAccueil') && html.includes('afficherSyntheseAccueil();'), 'synthese accueil appelee');
ok(html.includes('CA analytique') && html.includes('opérations de caisse') && html.includes('CA importé'), 'reconciliation');
['produits_nature_reference', 'produits_justifications_marge', 'produits_tva_confirmations'].forEach(t => ok(html.includes(t), t));
ok(!/declare_par\s*:|valide_par\s*:|confirme_par\s*:/.test(sansCommentaires), 'aucune colonne auteur envoyee');
ok(!/\bprompt\(/.test(sansCommentaires), 'pas de prompt()');
ok(html.includes('Accueil Produits'), 'retour accueil');
ok(!/\.from\('products'\)\.(update|insert|upsert|delete)/.test(sansCommentaires), 'products jamais modifie');
console.log('test_produits_p1b_page : ' + n + ' assertions OK');
