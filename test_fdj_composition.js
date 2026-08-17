// Simule la logique de composition de construireRapportPdf() avec des
// données FDJ réalistes (mêmes formes que assemblerDonneesRapportFdj())
// contre le VRAI nexus-pdf-moteur.js (mocké au niveau pdf-lib
// uniquement) pour vérifier qu'aucune primitive n'explose et que tout
// tient sur 1 page.
global.PDFLib = {
  PDFDocument: { create: async () => fakeDoc },
  StandardFonts: { Helvetica: 'Helvetica', HelveticaBold: 'Helvetica-Bold' },
  rgb: (r,g,b) => ({r,g,b}),
};
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/nexus-pdf-moteur.js', 'utf8');
const window = {};
const fn = new Function('window', 'PDFLib', 'navigator', 'document', 'URL', src + '\nreturn window.NexusPdfMoteur;');
const NexusPdfMoteur = fn(window, global.PDFLib, {}, {}, {});

let addPageCount = 0;
const fakeFont = { widthOfTextAtSize: (t, s) => String(t).length * s * 0.5 };
function makeFakePage() {
  addPageCount++;
  return {
    drawText: () => {}, drawRectangle: () => {}, drawLine: () => {}, drawImage: () => {},
  };
}
const fakeImg = { scaleToFit: (w,h) => ({ width: w, height: h * 0.5 }) };
const fakeDoc = {
  addPage: () => makeFakePage(),
  embedPng: async () => fakeImg,
  embedFont: async () => fakeFont,
  setTitle: () => {}, setAuthor: () => {}, setSubject: () => {}, setCreator: () => {}, setProducer: () => {},
  save: async () => new Uint8Array([1,2,3]),
};

// Fonctions FDJ utilitaires (copiées du fichier réel — mêmes noms/signatures)
function fmtEuro(n) { return (n === null || n === undefined || isNaN(n)) ? '—' : `${Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`; }
function fmtPct(n) { return (n === null || n === undefined || isNaN(n)) ? '—' : `${(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`; }
function fmtEvolution(n) { return (n === null || n === undefined || isNaN(n)) ? 'comparaison indisponible' : `${n >= 0 ? '+' : ''}${(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`; }

function choisirReferenceEquipe(topVendeurs) {
  const eligibles = topVendeurs.filter(v => v.caMoyen != null);
  if (!eligibles.length) return { reference: null, autres: topVendeurs.slice(0, 4) };
  const reference = eligibles.reduce((meilleur, v) => (v.caMoyen > meilleur.caMoyen ? v : meilleur), eligibles[0]);
  const autres = topVendeurs.filter(v => v !== reference).slice(0, 3);
  return { reference, autres };
}
function choisirJeuxPrioritaires(enVigilance, topJeux) {
  const idsTop = new Set(topJeux.map(l => l.jeu.id));
  const prioritaires = enVigilance.filter(j => idsTop.has(j.id)).slice(0, 4);
  return prioritaires.length ? prioritaires : enVigilance.slice(0, 4);
}
function construireTexteConseilRapport(donnees) {
  let texte;
  if (donnees.palierMoteur && donnees.topJeux.length) {
    const nomsTop = donnees.topJeux.slice(0, 2).map(l => l.jeu.nom).join(' et ');
    texte = `Le palier ${donnees.palierMoteur} € porte l'essentiel du CA (${nomsTop}). Maintenez leur disponibilité en priorité.`;
  } else {
    texte = 'Pas assez de données sur cette période pour dégager une dynamique de vente claire.';
  }
  return texte;
}

// Données réalistes — 15 jeux vendus (teste le "+N autres" du Top jeux),
// 5 employés (teste la logique référence/autres), 13 jeux en vigilance
// (teste le plafonnement stock), 6 candidats décisions (teste max 3).
const jeuxNoms = ['Cash 5 €','Maxi Mots Croisés 5 €','Super 10 ou 200','Black Jack 2 €','Millionnaire 10 €','Goal','Astro','Solitaire','Tarot','Mots Croisés 2 €','Vegas','Poker','Loto Foot','Banco','Illico'];
const topJeux = jeuxNoms.map((nom, i) => ({ jeu: { id: 'j' + i, nom }, ca: 800 - i * 40, tickets: 100 - i * 4 }));
const repartitionPalier = [
  { prix: 1, ca: 129 }, { prix: 2, ca: 726 }, { prix: 3, ca: 351 }, { prix: 5, ca: 2415 }, { prix: 10, ca: 470 },
];
const topVendeurs = [
  { nom: 'Samantha', ca: 2367, quarts: 3, caMoyen: 789 },
  { nom: 'Madeleine', ca: 1148, quarts: 2, caMoyen: null },
  { nom: 'Loane', ca: 576, quarts: 1, caMoyen: null },
  { nom: 'Karim', ca: 2900, quarts: 4, caMoyen: 725 },
  { nom: 'Julie', ca: 300, quarts: 1, caMoyen: null },
];
const enRupture = [{ id: 'r1', nom: 'Mission Patrimoine 15 €' }];
const enVigilance = Array.from({ length: 13 }, (_, i) => ({ id: 'v' + i, nom: 'Jeu vigilance ' + i }));
// intersecter 2 avec topJeux pour tester la logique prioritaires
enVigilance[0].id = 'j0'; enVigilance[1].id = 'j2';
const decisions = [
  { article: 'Rupture Mission Patrimoine', pourquoi: 'Aucun carnet disponible en caisse ni au bureau.', decision: 'Sécuriser Mission Patrimoine 15 €', rang: 1 },
  { article: 'Écarts caisse', pourquoi: 'Deux quarts présentent un écart validé sur la période.', decision: 'Analyser les 2 écarts de caisse', rang: 2 },
  { article: 'Dimanche faible', pourquoi: 'Performance inférieure aux autres jours observés.', decision: 'Booster le dimanche', rang: 3 },
  { article: 'Signal 4', pourquoi: 'Détail 4', decision: 'Décision 4', rang: 4 },
  { article: 'Signal 5', pourquoi: 'Détail 5', decision: 'Décision 5', rang: 5 },
  { article: 'Signal 6', pourquoi: 'Détail 6', decision: 'Décision 6', rang: 6 },
];

const donnees = {
  site: 'vito-sainte-marie', periodeLabel: 'Semaine 32 (2026)', periodeSousLabel: '03/08/2026 → 09/08/2026',
  labelComp: 'Semaine précédente', genereLe: new Date('2026-08-10T10:00:00'),
  donneesProvisoires: true, nbNonControles: 4, totalQuarts: 6,
  ca: 6000, caisseTirages: 509.45, evolCa: null, tauxConformite: 0.333,
  quartsControles: 6, quartsConformes: 2, ecartTotal: 1.10, nbEcartsNonNuls: 2,
  jeuMoteur: topJeux[0].jeu, palierMoteur: 5, meilleurJour: { date: '2026-08-07' }, pireJour: { date: '2026-08-09' },
  labelsCa: ['03/08','04/08','05/08','06/08','07/08','08/08','09/08'], valeursCa: [800,900,700,1100,1400,600,650],
  topJeux, repartitionPalier, topVendeurs, enRupture, enVigilance, activationsPeriode: 12,
  decisions, syntheseCoach: null,
};

async function run() {
  const { COULEUR, ZONES_1P, MM: MM1P } = NexusPdfMoteur;
  const c = await NexusPdfMoteur.creerRapportUnePage({ titre: 'test', sujet: 'test' });

  const zEntete = c.allouerZone(ZONES_1P.entete);
  c.entete(zEntete, { app: 'NEXUS FDJ · PILOTAGE', ligne1: `Rapport ${donnees.periodeLabel}`, ligne2: `${donnees.periodeSousLabel} · ${donnees.site} · données provisoires` });

  const zKpi = c.allouerZone(ZONES_1P.kpi);
  const ecartSigne = donnees.ecartTotal > 0 ? '+' : '';
  c.ligneKpi(zKpi, [
    { label: 'CA FDJ', valeur: fmtEuro(donnees.ca + donnees.caisseTirages) },
    { label: 'Évolution', valeur: donnees.evolCa === null ? 'Comparaison indisponible' : fmtEvolution(donnees.evolCa) },
    { label: 'Quarts conformes', valeur: `${donnees.quartsConformes}/${donnees.quartsControles} · ${fmtPct(donnees.tauxConformite)}` },
    { label: 'Écart caisse', valeur: `${ecartSigne}${fmtEuro(donnees.ecartTotal)}` },
  ]);

  const zSynthese = c.allouerZone(ZONES_1P.synthese);
  c.listePoints(zSynthese, {
    points: [
      { label: 'Jeu moteur', valeur: `${donnees.jeuMoteur.nom} — ${fmtEuro(donnees.topJeux[0].ca)}` },
      { label: 'Palier moteur', valeur: `${donnees.palierMoteur} € — ${fmtEuro(Math.max(...donnees.repartitionPalier.map(p => p.ca), 0))}` },
      { label: 'Jour le plus fort', valeur: '7 août' },
      { label: 'Jour à booster', valeur: '9 août' },
      { label: 'Point de vigilance', valeur: `${donnees.enRupture[0].nom} en rupture` },
    ], max: 5,
  });

  const zGraph = c.allouerZone(ZONES_1P.graphique);
  await c.graphique(zGraph, 'data:image/png;base64,xx', { legende: 'CA grattage — évolution quotidienne' });

  const zVentes = c.allouerZone(ZONES_1P.ventes);
  const colsVentes = c.diviserColonnes(zVentes);
  c.tableauCompact(colsVentes.gauche, {
    titre: 'TOP JEUX', max: 5, texteRenvoi: 'voir FDJ Pilotage',
    colonnes: [{ label: 'Jeu', cle: 'nom', largeur: 0.68 }, { label: 'CA', cle: 'ca', largeur: 0.32, align: 'droite' }],
    lignes: donnees.topJeux.map(l => ({ nom: l.jeu.nom, ca: fmtEuro(l.ca) })),
  });
  const maxPalier = Math.max(...donnees.repartitionPalier.map(p => p.ca), 1);
  c.barresHorizontales(colsVentes.droite, {
    titre: 'RÉPARTITION PAR PALIER', max: 6,
    items: donnees.repartitionPalier.map(p => ({ label: `${p.prix} €`, valeur: fmtEuro(p.ca), part: p.ca / maxPalier })),
  });

  const zEquipeStock = c.allouerZone(ZONES_1P.equipe);
  const colsEquipeStock = c.diviserColonnes(zEquipeStock);
  const { reference, autres } = choisirReferenceEquipe(donnees.topVendeurs);
  console.log('reference choisie:', reference && reference.nom, '(attendu: Samantha, 789 > Karim 725)');
  if (!reference || reference.nom !== 'Samantha') { console.error('FAIL: mauvaise référence équipe'); process.exit(1); }
  c.listeEquipe(colsEquipeStock.gauche, {
    titre: 'ÉQUIPE',
    reference: { nom: reference.nom, valeurParUnite: `${fmtEuro(reference.caMoyen)}/quart`, quantite: `${reference.quarts} quarts` },
    autres: autres.map(v => ({ nom: v.nom, detail: `${v.quarts} quart(s) · ${fmtEuro(v.ca)}` })),
    texteInsuffisant: 'Données insuffisantes pour comparaison fiable.',
  });
  const jeuxPrioritaires = choisirJeuxPrioritaires(donnees.enVigilance, donnees.topJeux);
  console.log('jeux prioritaires (attendu 2, intersection avec topJeux):', jeuxPrioritaires.map(j => j.id));
  if (jeuxPrioritaires.length !== 2) { console.error('FAIL: prioritaires attendus = 2'); process.exit(1); }
  c.stockCondense(colsEquipeStock.droite, {
    titre: 'STOCK & ACTIVATIONS', ruptures: donnees.enRupture, nbSurveillance: donnees.enVigilance.length,
    prioritaires: jeuxPrioritaires, texteRenvoi: 'Liste complète dans FDJ Pilotage.',
  });

  const zBas = c.allouerZone(ZONES_1P.decisions);
  const [zConseil, zDec] = c.diviserLignes(zBas, [16 * MM1P, 34 * MM1P]);
  const texteConseil = construireTexteConseilRapport(donnees);
  console.log('texte conseil (', texteConseil.length, 'car.):', texteConseil);
  c.conseil(zConseil, { texte: texteConseil, max: 250 });
  c.decisions(zDec, {
    max: 3,
    items: donnees.decisions.map(dec => ({
      urgence: dec.rang <= 1 ? 'critique' : (dec.rang === 2 ? 'important' : 'observation'),
      titre: dec.decision || dec.article, detail: dec.pourquoi,
    })),
  });
  console.log('decisions fournies:', donnees.decisions.length, '(le moteur doit n\'en dessiner que 3)');

  const zPied = c.allouerZone(ZONES_1P.piedDePage);
  c.piedDePage(zPied, `${donnees.nbNonControles} quarts sur ${donnees.totalQuarts} pas encore contrôlés — chiffres provisoires.`, 'Généré le 10/08/2026 à 10:00');

  const bytes = await NexusPdfMoteur.finaliser(c);
  console.log('bytes:', bytes.length, '| pages créées:', addPageCount, '| y final:', c.y.toFixed(2));
  if (addPageCount !== 1) { console.error('FAIL: plus d\'une page'); process.exit(1); }
  console.log('TOUS LES TESTS PASSENT');
}
run().catch(e => { console.error('ECHEC:', e); process.exit(1); });
