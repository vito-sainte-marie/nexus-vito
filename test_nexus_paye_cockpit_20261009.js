// NEXUS PAYE — le cockpit mensuel (09/10/2026, mandat Fast Track de Frédéric).
//
// Avant ce lot, l'écran empilait une carte verticale par salarié et par
// élément : quarante blocs pour neuf salariés, et un manager qui défilait
// pour savoir s'il restait une décision à rendre. Le mandat demande un
// cockpit : un bandeau, cinq indicateurs cliquables, un tableau compact et
// un panneau latéral qui s'ouvre sans changer de page.
//
// Ce test exécute le script de l'écran sur un DOM minimal, avec une recette
// qui contient tous les cas de la §9 du mandat : plusieurs salariés, un
// salarié hors paie, des heures hors planning, un congé, un salarié à
// plusieurs anomalies, et un écart de caisse partiellement régularisé
// (−50 € à l'origine, +30 € encaissés, −20 € de solde). Il vérifie la
// STRUCTURE du cockpit et les RÈGLES de lecture — jamais un calcul de paie,
// qui reste la propriété du moteur.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Paye-v1.html'), 'utf8');
const script = html.match(/<body>[\s\S]*?<script>\n([\s\S]*?)\n<\/script><\/body>/);
assert.ok(script, 'script inline de l’écran PAYE introuvable');

const rendu = {};
function element(id) {
  return {
    id, hidden: true, textContent: '', value: '', checked: false, disabled: false,
    dataset: {}, style: {}, classList: { toggle() {}, add() {}, remove() {} },
    set innerHTML(v) { rendu[id] = v; this._h = v; },
    get innerHTML() { return this._h || ''; },
    querySelector: () => element('sous'), querySelectorAll: () => [],
    appendChild() {}, focus() {}, scrollIntoView() {},
    addEventListener() {}, removeEventListener() {},
  };
}
const ctx = {
  console,
  document: {
    getElementById: element, querySelector: () => element('q'), querySelectorAll: () => [],
    createElement: () => element('cree'), body: { appendChild() {} },
    addEventListener() {}, removeEventListener() {},
  },
  navigator: {}, nexusClient: {},
  // `URL` est fourni par le navigateur : sans lui, le garde-fou du lien
  // planning refuserait TOUT lien et le test passerait pour de mauvaises
  // raisons.
  URL,
  nexusRequireAuth: () => ({ then: () => ({ catch: () => {} }) }),
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-paye-moteur.js'), 'utf8'), ctx);
vm.runInContext(script[1], ctx);

// ── Recette : août 2026, cinq salariés et tous les cas de la §9 ──────────
const JOURS_E1 = ['2026-08-03', '2026-08-04', '2026-08-06', '2026-08-07'];
const JOURS_E5 = ['2026-08-10', '2026-08-11', '2026-08-12'];

ctx.__donnees = {
  periode: '2026-08-01',
  employees: [
    { id: 'e1', nom: 'Camille', role: 'pompiste', actif: true },
    { id: 'e2', nom: 'Vanessa Ribe', role: 'caissier', actif: true },
    { id: 'e3', nom: 'Angélique', role: 'renfort', actif: true },
    { id: 'e4', nom: 'Mathieu', role: 'caissier', actif: true },
    { id: 'e5', nom: 'Sofiane', role: 'pompiste', actif: true },
  ],
  settings: [
    { employee_id: 'e1', inclus_paye: true, mode_presence: 'automatique' },
    { employee_id: 'e2', inclus_paye: true, mode_presence: 'automatique' },
    { employee_id: 'e4', inclus_paye: false, mode_presence: 'exclu' },
    { employee_id: 'e5', inclus_paye: true, mode_presence: 'automatique' },
    // e3 (Angélique) : rattachement paie jamais confirmé.
  ],
  planning: [
    ...JOURS_E1.map(date => ({ employee_id: 'e1', date, quart: 'quart1', statut: 'travail_normal', duree_heures: 7, tache: 'piste' })),
    ...JOURS_E5.map(date => ({ employee_id: 'e5', date, quart: 'quart1', statut: 'travail_normal', duree_heures: 7, tache: 'boutique' })),
  ],
  pointages: [
    ...JOURS_E1.map(date => ({ employee_id: 'e1', date, type: 'arrivee', retard_min: date === '2026-08-04' ? 12 : 0 })),
    // Camille a aussi travaillé un jour qui n'était pas à son planning.
    { employee_id: 'e1', date: '2026-08-17', type: 'arrivee', retard_min: 0 },
    // Sofiane manque au 12 : une absence non déclarée s'ajoute à son écart.
    { employee_id: 'e5', date: '2026-08-10', type: 'arrivee', retard_min: 0 },
    { employee_id: 'e5', date: '2026-08-11', type: 'arrivee', retard_min: 0 },
  ],
  indisponibilites: [{
    id: 'i1', employee_id: 'e2', date_debut: '2026-07-21', date_fin: '2027-01-03',
    type: 'indisponible', motif: 'conge_maternite', confirme_le: '2026-07-21T09:00:00Z',
  }],
  // L'exemple exact du mandat : écart initial −50 €, versement réellement
  // encaissé +30 €, solde restant −20 €.
  ecarts: [{
    id: 'ec1', employeeId: 'e5', date: '2026-08-11', activite: 'boutique', quart: 'quart1',
    sourceModule: 'verify', montantRetenu: -20, ecartInitial: -50, ecartFinal: -20,
    statut: 'valide', causeCode: 'erreur_rendu', deepLink: 'NEXUS-Verify-v1.html#ec1',
  }],
  audits: [], items: [], config: { jours_feries: ['2026-08-15'] },
};

vm.runInContext(`
  MOIS = '2026-08-01';
  SITE = 'vito-sainte-marie';
  EMPLOYEE = { id: 'manager-1', role: 'manager' };
  RAPPORT = NexusPayeMoteur.construireRapport(__donnees);
  RAPPORT.periodeEnregistree = null;
  RAPPORT.planningOfficiel = { source: 'google_sheets', url: 'https://docs.google.com/spreadsheets/d/aout2026/edit' };
  render();
`, ctx);

let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}
const ecran = () => rendu.app || '';
const dans = (t, s) => t.includes(s);
const compter = (t, re) => (t.match(re) || []).length;

verifier('le cockpit se rend', ecran().length > 3000);

// ── §3 — bandeau, indicateurs, tableau ──────────────────────────────────
verifier('le bandeau porte le mois et sa navigation',
  dans(ecran(), 'id="prev"') && dans(ecran(), 'id="next"') && dans(ecran(), 'août 2026'));
verifier('le bandeau porte l’état du dossier',
  /en préparation|en vérification|prêt pour comptabilité|transmis/.test(ecran()));
verifier('le bandeau porte les trois actions principales',
  dans(ecran(), 'Nouvelle saisie') && dans(ecran(), 'Vérifications') && dans(ecran(), 'Transmettre à la comptable'));
verifier('les cinq indicateurs sont sur une seule ligne',
  dans(ecran(), 'class="kpirow"') && compter(ecran(), /data-kpi="/g) === 5);
verifier('… et chacun est un bouton, donc cliquable au clavier comme à la souris',
  compter(ecran(), /<button type="button" class="kpi/g) === 5);
['Salariés concernés', 'Heures confirmées', 'Éléments nécessitant une décision',
  'Salariés prêts', 'Écarts de caisse et régularisations'].forEach(k => {
  verifier(`l’indicateur « ${k} » est présent`, dans(ecran(), `<span>${k}</span>`));
});
verifier('les écarts de caisse sont tenus à l’écart des éléments de rémunération',
  dans(ecran(), 'Informations de contrôle, séparées des éléments de rémunération'));

const COLONNES = ['Salarié', 'Affectation', 'Heures', 'Absences', 'Éléments à vérifier', 'Statut'];
verifier('le tableau compact remplace les cartes', dans(ecran(), 'class="tablescroll"') && dans(ecran(), 'table class="sal"'));
COLONNES.forEach(c => verifier(`la colonne « ${c} » existe`, dans(ecran(), `>${c}<`) || dans(ecran(), `${c}</button>`)));
verifier('quatre colonnes sont triables', compter(ecran(), /data-tri="/g) === 4);
verifier('la recherche est instantanée', dans(ecran(), 'id="recherche"') && dans(ecran(), 'type="search"'));
verifier('les quatre filtres sont offerts', compter(ecran(), /class="filtre"|class="filtre /g) === 4);
verifier('le tableau défile indépendamment', dans(html, '.tablescroll{overflow:auto'));
verifier('cinq salariés, un par ligne', compter(ecran(), /<tr data-employee/g) === 5);
verifier('chaque ligne porte ses six cellules', compter(ecran(), /<td [^>]*data-col="/g) === 30);
verifier('le salarié hors paie reste visible, en retrait',
  dans(ecran(), 'horspaie') && dans(ecran(), 'Mathieu'));

// ── §4 — panneau latéral ────────────────────────────────────────────────
verifier('le panneau latéral a trois onglets', dans(ecran(), 'role="tablist"') && compter(ecran(), /data-onglet="/g) >= 3);
verifier('les trois volets sont nommés',
  dans(ecran(), 'id="ficheSection"') && dans(ecran(), 'id="reviewSection"') && dans(ecran(), 'id="accountantSection"'));
['Synthèse mensuelle', 'Heures retenues', 'Planning officiel et affectations',
  'Anomalies à résoudre'].forEach(b => verifier(`la fiche ouvre « ${b} »`, dans(ecran(), b)));
verifier('la source officielle du planning est atteignable depuis la fiche',
  dans(ecran(), 'docs.google.com/spreadsheets/d/aout2026'));
verifier('les décisions, sources et justificatifs sont historisés',
  dans(ecran(), 'Historique des décisions, sources et justificatifs'));

// ── Une anomalie n’offre que les actions qui la concernent ──────────────
// Une présence hors planning se confirme, se corrige ou ne se retient pas.
vm.runInContext(`SELECTION = 'e1'; ONGLET = 'fiche'; render();`, ctx);
verifier('une anomalie d’heures offre Confirmer, Ne pas retenir et Corriger',
  dans(ecran(), '>Confirmer<') && dans(ecran(), '>Ne pas retenir<')
  && dans(ecran(), 'Corriger les heures retenues'));
// Un écart de caisse, lui, ne se « confirme » jamais en retenue : le
// vocabulaire reste celui de la doctrine PAYE — on transmet un montant
// saisi, ou l'on déclare l'écart sans impact paie.
vm.runInContext(`SELECTION = 'e5'; ONGLET = 'fiche'; render();`, ctx);
verifier('un écart offre Sans impact paie, Transmettre à la comptable et sa source',
  dans(ecran(), '>Sans impact paie<') && dans(ecran(), '>Transmettre à la comptable<')
  && dans(ecran(), 'Voir le contrôle Verify ↗'));
// L'écart se lit depuis la fiche du salarié ET depuis la liste du mois :
// deux chemins de lecture, une seule décision. Ce qui est interdit, c'est
// deux boutons pour la même décision DANS LE MÊME volet.
const volets = ecran().split('id="reviewSection"');
verifier('chaque volet n’offre qu’une paire d’actions par élément',
  volets.length === 2
  && compter(volets[0], /validate" data-emp="e5" data-key="ecart:ec1"/g) === 1
  && compter(volets[0], /exclude" data-emp="e5" data-key="ecart:ec1"/g) === 1
  && compter(volets[1], /validate" data-emp="e5" data-key="ecart:ec1"/g) === 1
  && compter(volets[1], /exclude" data-emp="e5" data-key="ecart:ec1"/g) === 1);

// ── §5 — l’écart initial reste, le versement s’affiche, le solde se lit ─
const t = vm.runInContext('totauxEcarts()', ctx);
verifier('l’écart initial de la période est conservé', t.initial === -5000);
verifier('le versement encaissé est présenté comme une régularisation', t.versements === 3000);
verifier('le solde restant est le final validé', t.solde === -2000);
verifier('aucune retenue sur salaire n’est générée automatiquement', t.retenu === 0);
verifier('… et le moteur ne retient rien non plus',
  vm.runInContext("NexusPayeMoteur.variablesComptables(RAPPORT.employes.find(f=>f.employee.id==='e5')).financier.retenueEcartCentimes", ctx) === 0);
verifier('l’écart se lit en quatre cases',
  dans(ecran(), '<span>Initial</span>') && dans(ecran(), '<span>Régularisations encaissées</span>')
  && dans(ecran(), '<span>Final validé</span>') && dans(ecran(), '<span>Impact paie</span>'));
verifier('… avec les montants du mandat', dans(ecran(), '-50.00 €') && dans(ecran(), '+30.00 €') && dans(ecran(), '-20.00 €'));
verifier('un écart sans historique de régularisation n’invente pas de versement',
  vm.runInContext("versementCentimes({ecartInitialCentimes:null,ecartFinalCentimes:-2000})", ctx) === null
  && vm.runInContext("versementCentimes({ecartInitialCentimes:-2000,ecartFinalCentimes:-2000})", ctx) === null);
verifier('la règle est écrite à l’écran, pas seulement dans le code',
  dans(ecran(), 'ne devient jamais automatiquement une dette'));

// ── Recherche, filtres et tri : la lecture du tableau ───────────────────
const ids = () => vm.runInContext('fichesAffichees().map(f=>f.employee.id)', ctx);
verifier('les cinq salariés sont listés par défaut', ids().length === 5);
verifier('le hors paie est lu en dernier, sans bloquer les autres', ids()[4] === 'e4');
vm.runInContext("RECHERCHE = 'sofi';", ctx);
verifier('la recherche trouve un salarié sans accent ni casse', ids().join() === 'e5');
vm.runInContext("RECHERCHE = ''; FILTRE = 'hors_paie';", ctx);
verifier('le filtre « hors paie » ne montre que les hors paie', ids().join() === 'e4');
vm.runInContext("FILTRE = 'a_verifier';", ctx);
verifier('le filtre « à vérifier » ne montre que ce qui reste à décider',
  ids().length > 0 && ids().every(id => id !== 'e4'));
vm.runInContext("FILTRE = 'prets';", ctx);
const prets = ids();
verifier('le filtre « prêts » ne montre que les salariés prêts',
  prets.every(id => vm.runInContext(`NexusPayeMoteur.statutSalarie(RAPPORT.employes.find(f=>f.employee.id==='${id}'))`, ctx) === 'pret'));
vm.runInContext("FILTRE = 'tous'; TRI = {cle:'heures', sens:-1}; render();", ctx);
const heures = vm.runInContext('fichesAffichees().filter(f=>f.reglage.inclus).map(f=>Number(f.heuresConfirmees||0))', ctx);
verifier('le tri par heures ordonne vraiment', heures.every((h, i) => i === 0 || heures[i - 1] >= h));
verifier('… et le tri le dit à l’écran', /data-tri="heures"[^>]*>Heures ↓</.test(ecran()));

// ── §6 — espace dossier comptable ───────────────────────────────────────
vm.runInContext("FILTRE='tous'; TRI={cle:'nom',sens:1}; ONGLET='dossier'; render();", ctx);
['Salariés prêts', 'Salariés encore bloqués', 'Dont données manquantes',
  'Éléments transmis', 'Éléments non retenus', 'Éléments avec justificatif',
  'Générer le dossier comptable', 'Export CSV (technique)'].forEach(l =>
  verifier(`le dossier comptable annonce « ${l} »`, dans(ecran(), l)));
verifier('le dossier dit qui bloque, et permet d’y aller', dans(ecran(), 'class="lien-salarie"'));
verifier('l’export sépare paie, contrôle et informations sans impact',
  dans(ecran(), 'Écarts de caisse et régularisations présentés à part, comme informations de contrôle'));
// L'historique de préparation vient de la période enregistrée, jamais d'une
// date recalculée à l'affichage.
vm.runInContext(`
  RAPPORT.periodeEnregistree = { statut: 'verifie', verifie_le: '2026-09-01T08:00:00Z', transmis_le: null, updated_at: '2026-09-01T08:00:00Z' };
  render();
`, ctx);
verifier('l’historique de préparation est daté', dans(ecran(), 'Mois validé le 01/09/2026'));
verifier('… et l’état du dossier suit la période enregistrée', dans(ecran(), 'prêt pour comptabilité'));
vm.runInContext("RAPPORT.periodeEnregistree = null; render();", ctx);

// ── Un rattachement jamais confirmé bloque le mois : la fiche le dit ────
// Production affiche ces deux alertes. Une refonte de présentation n'a pas
// le droit de les perdre en route : elles portent la seule action qui
// débloque le dossier.
vm.runInContext("SELECTION = 'e3'; ONGLET = 'fiche'; render();", ctx);
const fiche = () => (rendu.panelInner || '') + ecran();
verifier('un rattachement à la paie jamais confirmé est signalé dans sa fiche',
  dans(fiche(), 'Rattachement à la paie jamais confirmé'));
verifier('… et la fiche porte de quoi le configurer', dans(fiche(), 'btn configure'));

vm.runInContext(`
  REGLAGE_E4 = RAPPORT.employes.find(f => f.employee.id === 'e4').reglage;
  REGLAGE_E4.confirme = false;
  SELECTION = 'e4'; render();
`, ctx);
verifier('le hors-paie non confirmé a bien été mis en place pour l’épreuve',
  vm.runInContext("REGLAGE_E4.confirme", ctx) === false);
verifier('un hors paie déduit du rôle et jamais confirmé est signalé lui aussi',
  dans(fiche(), 'Hors paie proposé d’après le rôle, jamais confirmé'));
vm.runInContext("REGLAGE_E4.confirme = true; SELECTION = 'e5'; render();", ctx);
verifier('un rattachement confirmé n’affiche aucune de ces alertes',
  !dans(fiche(), 'jamais confirmé'));

// ── §7 — densité, pédagogie, accessibilité ──────────────────────────────
verifier('les notions métier portent une info-bulle', compter(ecran(), /data-info="/g) >= 3);
verifier('les deux notions nouvelles sont expliquées',
  dans(html, "regularisation:['Écarts et régularisations'") && dans(html, "heuresRetenues:['Heures retenues'"));
verifier('les lignes du tableau sont atteignables au clavier', dans(ecran(), 'tabindex="0"') && dans(ecran(), 'aria-label="Ouvrir la fiche de'));
verifier('les filtres annoncent leur état aux lecteurs d’écran', dans(ecran(), 'aria-pressed='));
verifier('le cockpit tient dans une page, sans gabarit téléphone',
  dans(html, '<body><div class="cockpit">') && !dans(html, '<div class="phone">'));
verifier('la densité s’adapte aux petits écrans',
  dans(html, '@media(max-width:1180px)') && dans(html, '@media(max-width:820px)'));
verifier('aucune boîte de dialogue native ne revient par la refonte',
  !/\b(prompt|alert|confirm)\s*\(/.test(html));

// ── §9 — mois, station, export comptable, permissions ───────────────────
// Le mandat demande de rejouer la recette en changeant de mois et de
// station, et de contrôler que les données ne traversent pas la frontière
// d'un site. Ces quatre points étaient les derniers non couverts.
// Le libellé vient de `toLocaleDateString` : il est en bas de casse dans
// le balisage, et c'est la feuille de style qui lui met sa majuscule.
const minuscule = () => ecran().toLowerCase();
verifier('le bandeau nomme le mois courant', dans(minuscule(), 'ao\u00fbt 2026'));
vm.runInContext("MOIS = '2026-09-01'; render();", ctx);
verifier('changer de mois change ce qui est affiché',
  dans(minuscule(), 'septembre 2026') && !dans(minuscule(), 'ao\u00fbt 2026'));
verifier('… et les deux flèches de navigation restent là',
  dans(ecran(), 'id="prev"') && dans(ecran(), 'id="next"'));
vm.runInContext("MOIS = '2026-08-01'; render();", ctx);

verifier('le bandeau nomme la station', dans(ecran(), 'vito-sainte-marie'));
vm.runInContext("SITE = 'autre-station'; render();", ctx);
verifier('changer de station change ce qui est affiché',
  dans(ecran(), 'autre-station') && !dans(ecran(), 'vito-sainte-marie'));
vm.runInContext("SITE = 'vito-sainte-marie'; render();", ctx);

// L'export comptable : le moteur reste seul propriétaire des lignes, et la
// §6 exige que l'écart de caisse y soit lisible comme information de
// contrôle — avec son initial et son final — et non comme une retenue.
const lignes = vm.runInContext("NexusPayeMoteur.lignesExport(RAPPORT)", ctx);
verifier('l’export comptable produit des lignes', Array.isArray(lignes) && lignes.length > 0);
verifier('un écart encore à arbitrer ne part pas chez la comptable',
  !lignes.some(l => l.type === 'ecart_caisse'));

// Une fois l'écart arbitré, il doit partir — mais comme information de
// contrôle, avec son initial et son final, jamais comme une retenue.
const avantArbitrage = lignes.length;
vm.runInContext(`
  ITEM_ARBITRE = RAPPORT.employes.find(f => f.employee.id === 'e5')
    .items.find(i => i.typeItem === 'ecart_caisse');
  ITEM_ARBITRE.statut = 'information';
`, ctx);
// La mutation a-t-elle mordu ? On le demande avant de lire son résultat.
verifier('l’écart a bien été arbitré dans le rapport',
  vm.runInContext("ITEM_ARBITRE.statut", ctx) === 'information');
const apresArbitrage = vm.runInContext("NexusPayeMoteur.lignesExport(RAPPORT)", ctx);
verifier('… et l’export en compte une ligne de plus', apresArbitrage.length === avantArbitrage + 1);
const ligneEcart = apresArbitrage.find(l => l.type === 'ecart_caisse');
verifier('l’écart exporté conserve son montant d’origine', !!ligneEcart && ligneEcart.ecart_initial === '-50.00');
verifier('… et son solde restant', !!ligneEcart && ligneEcart.ecart_final === '-20.00');
verifier('… et il reste une information de contrôle, jamais une retenue',
  !!ligneEcart && ligneEcart.impact_paye === 'information' && ligneEcart.montant_euros === '');
vm.runInContext("ITEM_ARBITRE.statut = 'a_verifier'; render();", ctx);

verifier('le fichier exporté nomme sa station et son mois, jamais une autre',
  dans(html, '`NEXUS-Paye-${SITE}-${MOIS.slice(0,7)}.csv`'));

// Permissions et isolation : la refonte ne touche ni la porte d'entrée ni
// le périmètre des écritures. On le vérifie sur le fichier réel, parce
// qu'une refonte de présentation peut très bien les perdre en chemin.
verifier('l’écran reste réservé aux managers et gérants',
  dans(html, "['manager','gerant'].includes(employee.role)")
  && dans(html, 'NEXUS PAYE est réservé aux managers et gérants.'));
verifier('le site lu est celui de la session, jamais un site choisi à l’écran',
  dans(html, 'SITE=employee.site_id') && !/SITE\s*=\s*document\./.test(html));
verifier('toute écriture porte le site de la session',
  compter(html, /siteId:\s*SITE/g) >= 4);

// ── Garde-fou : tout ce que bind() déréférence doit exister ─────────────
// Un `getElementById(...).onclick` sans garde sur un identifiant absent
// casse TOUT l'écran après le rendu. Le détecteur est calibré sur le
// fichier réel : seul `app` vit hors du rendu, c'est son hôte.
const attendus = [...new Set((html.match(/getElementById\('([A-Za-z0-9_]+)'\)/g) || [])
  .map(m => m.match(/'([A-Za-z0-9_]+)'/)[1]))].filter(id => id !== 'app');
vm.runInContext("ONGLET='fiche'; render();", ctx);
const complet = ecran() + rendu.panelInner + (rendu.tbody || '');
const manquants = attendus.filter(id => !complet.includes(`id="${id}"`));
verifier(`les ${attendus.length} identifiants pilotés par bind() sont tous rendus : ${manquants.join(', ') || 'aucun manquant'}`,
  manquants.length === 0);

verifier('le rendu ne contient ni « undefined » ni « NaN »',
  !dans(ecran(), 'undefined') && !dans(ecran(), 'NaN'));

console.log(`\nNEXUS PAYE — cockpit mensuel : ${ok}/${ok} vérifications passent.`);
