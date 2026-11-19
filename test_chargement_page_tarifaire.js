// Chargement réel de l'écran Scanner tarifaire : on exécute les scripts dans l'ordre où la page (et le banc) les déclarent,
// dans un contexte SANS require ni module, comme un navigateur. Les épreuves Node ordinaires chargent le module des anomalies
// toutes seules (require de repli) et ne voient donc pas qu'une page l'oublie : c'est ce qui a laissé passer B1.
// Données entièrement fictives.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let n = 0;
const ok = (nom, f) => { try { f(); n++; } catch (e) { console.error('ÉCHEC : ' + nom); throw e; } };

const PAGES = [
  ['NEXUS-Produits-v1.html', path.join(__dirname, 'NEXUS-Produits-v1.html')],
  ['banc.html', path.join(__dirname, 'outils', 'recette', 'ecran_scanner', 'banc.html')],
];
const scriptsTarif = (fichier) => {
  const html = fs.readFileSync(fichier, 'utf8');
  const out = []; const re = /<script\s+src="([^"]+)"/g; let m;
  while ((m = re.exec(html))) out.push(m[1].split('?')[0]);
  return out;
};
const dossierDe = (fichier) => (/banc\.html$/.test(fichier) ? path.resolve(path.dirname(fichier), '../../../') : path.dirname(fichier)); // le banc déclare <base href="../../../">
// Résolution comme le navigateur : relatif au fichier HTML. Le banc charge les vrais modules par chemin relatif.
const charger = (fichier) => {
  const ctx = vm.createContext({ console });
  ctx.window = ctx; ctx.globalThis = ctx;
  const liste = scriptsTarif(fichier);
  liste.filter(s => /(nexus-vocabulaire-tarif|nexus-marge|nexus-produits-mesure|nexus-badge-etat|nexus-composants-pilotage|nexus-anomalies-tarifaires|nexus-politique-tarifaire)/.test(s)).forEach(s => {
    const p = path.resolve(dossierDe(fichier), s);
    vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: p });
  });
  return { ctx, liste };
};

PAGES.forEach(([nom, fichier]) => {
  ok(nom + ' : le script des anomalies est déclaré avant le moteur', () => {
    const l = scriptsTarif(fichier).map(s => path.basename(s));
    const ia = l.indexOf('nexus-anomalies-tarifaires.js'), im = l.indexOf('nexus-politique-tarifaire.js');
    assert.ok(ia >= 0, 'nexus-anomalies-tarifaires.js n\'est pas chargé');
    assert.ok(im >= 0 && ia < im, 'il doit précéder nexus-politique-tarifaire.js');
  });
  ok(nom + ' : chargé comme un navigateur, NexusAnomaliesTarifaires existe', () => {
    const { ctx } = charger(fichier);
    assert.ok(ctx.NexusAnomaliesTarifaires, 'NexusAnomaliesTarifaires absent : aucune anomalie ne serait affichée, sans erreur');
    assert.ok(ctx.NexusPolitiqueTarifaire && ctx.NexusPolitiqueTarifaireEcran);
  });
  ok(nom + ' : rendu, historique non vide et bouton « Marquer comme vérifié » pour le gérant', () => {
    const { ctx } = charger(fichier);
    const T = ctx.NexusPolitiqueTarifaire, E = ctx.NexusPolitiqueTarifaireEcran;
    const periode = { debut: '2030-03-01', fin: '2030-03-30' };
    const lignes = [{ article: 'Produit Fictif', categorie: 'Rayon Alpha', quantite: 10, prix_vente: 1, prix_achat: 2, tva: 20, code_barres: '' }];
    const a = T.analyser(lignes, [], E.construireContexteTarif({ site: 'site-fictif-1', registres: { familles: [], rattachements: [], seuils: [] }, periode }));
    assert.ok(a.lignes[0].anomalies && a.lignes[0].anomalies.length > 0, 'aucune anomalie détectée sur une marge négative');
    a.lignes[0].anomalies.forEach(x => { x.identiteDonnees = Object.assign({}, x.identiteDonnees, { fichierHash: 'h-fictif' }); });
    const html = E.htmlPage({ analyse: a, role: 'gerant', filtres: {}, incoherences: [], verifications: [], historiqueDispo: true, ouverte: a.lignes[0].article });
    // Depuis L1, les contrôles en attente ne figurent plus dans l'historique : il ne liste que les vérifications enregistrées.
    const x0 = a.lignes[0].anomalies[0]; x0.cycle = 'verifiee';
    const hv = E.htmlPage({ analyse: a, role: 'gerant', filtres: {}, incoherences: [], verifications: [{ code: x0.code, cle: x0.cle, verifie_le: '2030-03-05T10:00:00Z', auteur: 'Alex Test', commentaire: 'vu', identiteDonnees: x0.identiteDonnees, reevaluation: null }], historiqueDispo: true, ouverte: a.lignes[0].article });
    assert.ok(/data-historique="1"/.test(hv) && /pt-histo-li/.test(hv), 'historique vide');
    assert.ok(/data-verifier=/.test(html), 'pas de bouton Marquer comme vérifié');
  });
});

console.log('test_chargement_page_tarifaire : ' + n + ' épreuves OK');
