// Test — Sprint C6 "Pilotage" (17/08/2026, audit §10.1) : modale "Relevé de
// contrôle" et modale "Relevé de réception" de NEXUS-Carburants-Pilotage-v1.html
// (renderReleveControleModal / renderReleveReceptionModal), plus le contenu
// enrichi de renderHistorique (badges "Preuve", cartes Réceptions).
//
// Fonctions extraites par regex (même convention que
// test_pilotage_qualite_receptions_v2.js) — pas de vm sur toute la page,
// ces rendus n'ont besoin que de document/constantes locales/le vrai
// moteur (jamais recalculé, Article 11).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, 'NEXUS-Carburants-Pilotage-v1.html'), 'utf8');
const moteurCarburantSrc = fs.readFileSync(path.join(DIR, 'nexus-carburant-moteur.js'), 'utf8');
const moteurReceptionSrc = fs.readFileSync(path.join(DIR, 'nexus-reception-moteur.js'), 'utf8');

function extraireSync(source, nomFonction) {
  const re = new RegExp(`function ${nomFonction}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`);
  const m = source.match(re);
  if (!m) throw new Error(`Fonction ${nomFonction} introuvable`);
  return m[0];
}
function extraireConstMultiligne(source, nomConst) {
  const re = new RegExp(`const ${nomConst} = \\{[\\s\\S]*?\\n  \\};`);
  const m = source.match(re);
  if (!m) throw new Error(`Constante ${nomConst} introuvable`);
  return m[0];
}
function extraireConstLigne(source, nomConst) {
  const re = new RegExp(`const ${nomConst} = \\{[^\\n]*\\};`);
  const m = source.match(re);
  if (!m) throw new Error(`Constante ${nomConst} introuvable`);
  return m[0];
}

const constNomCarburant = extraireConstLigne(html, 'NOM_CARBURANT');
const constNiveauCouleur = extraireConstMultiligne(html, 'NIVEAU_COULEUR');
const constLibelleReferenceType = extraireConstLigne(html, 'LIBELLE_REFERENCE_TYPE');
const fnFmtLSrc = extraireSync(html, 'fmtL');
const fnFormaterDateSrc = extraireSync(html, 'formaterDateFrCourt');
const fnControleModalSrc = extraireSync(html, 'renderReleveControleModal');
const fnReceptionModalSrc = extraireSync(html, 'renderReleveReceptionModal');
// 19/09/2026 — régularisation d'une réception passée. La modale est la vue
// la plus complète d'une réception : c'est là qu'un manager va chercher la
// preuve. Les fonctions de provenance sont extraites telles quelles, jamais
// doublées — c'est leur texte que le cas 3bis vérifie.
const fnEstVisiteRegulariseeSrc = extraireSync(html, 'estVisiteRegularisee');
const fnEchapperTexteSrc = extraireSync(html, 'echapperTexte');
const fnUrlJustificatifSureSrc = extraireSync(html, 'urlJustificatifSure');
const fnFormaterDateHeureFrSrc = extraireSync(html, 'formaterDateHeureFr');

// Charge les VRAIS moteurs (pas de mock) — libelleQualiteControle,
// libelleCauseQualiteChaine, libelleStatutReception, texteEcart doivent
// rester la seule vérité (Article 11), jamais réécrits pour ce test.
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(moteurCarburantSrc, sandbox);
vm.runInContext(moteurReceptionSrc, sandbox);

// ------------------------------------------------------------
// Mock DOM minimal : la modale capture son propre innerHTML : tout le
// reste (bouton fermer, bouton PDF, toggles versions) n'a besoin que d'un
// stub générique avec addEventListener no-op — ce test porte sur le
// CONTENU rendu (les chiffres/libellés affichés au manager), pas sur le
// câblage des clics (déjà couvert par node --check + lecture manuelle,
// mêmes conventions que test_pilotage_qualite_receptions_v2.js).
// ------------------------------------------------------------
function fabriquerModal() {
  return { _html: '', get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; }, querySelectorAll: () => [] };
}
function fabriquerStubGenerique() {
  return { addEventListener() {}, style: {} };
}

function construireRenderControleModal(modal) {
  const prelude = `
    ${constNomCarburant}
    ${constNiveauCouleur}
    ${constLibelleReferenceType}
    ${fnFmtLSrc}
    ${fnFormaterDateSrc}
    let CONTROLE_MODAL_PDF_REFS = {};
    function fermerControleModal() {}
    function genererEtAfficherPdfCarburant() {}
    function construireReleveControlePdf() {}
    return (${fnControleModalSrc});
  `;
  return new Function('document', 'NexusCarburantMoteur', prelude)(
    { getElementById: (id) => (id === 'controleModal' ? modal : fabriquerStubGenerique()) },
    sandbox.NexusCarburantMoteur
  );
}

function construireRenderReceptionModal(modal) {
  const prelude = `
    ${constNomCarburant}
    ${constNiveauCouleur}
    ${fnFmtLSrc}
    ${fnFormaterDateSrc}
    let RECEPTION_MODAL_PDF_REFS = {};
    function fermerControleModal() {}
    function genererEtAfficherPdfCarburant() {}
    function construireReleveReceptionPdf() {}
    function global_NexusReceptionDonnees_disponible() { return false; }
    function chargerEtAfficherSignatureReception() {}
    const FUSEAU_STATION = 'America/Martinique';
    ${fnFormaterDateHeureFrSrc}
    ${fnEstVisiteRegulariseeSrc}
    ${fnEchapperTexteSrc}
    ${fnUrlJustificatifSureSrc}
    return (${fnReceptionModalSrc});
  `;
  return new Function('document', 'NexusReceptionMoteur', prelude)(
    { getElementById: (id) => (id === 'controleModal' ? modal : fabriquerStubGenerique()) },
    sandbox.NexusReceptionMoteur
  );
}

// ------------------------------------------------------------
// 1) renderReleveControleModal — un carburant fiable, un non_comparable
//    (cause affichée), un absent (aucun contrôle posé ce jour-là),
//    historique de versions sur le carburant fiable.
// ------------------------------------------------------------
{
  const modal = fabriquerModal();
  const render = construireRenderControleModal(modal);
  const controles = {
    go: {
      reference_date: '2026-08-14', reference_type: 'point_zero',
      theorique: 11500, physique: 11480, ecart: -20, ventes: 480, livraison: 0, mouvement: 0,
      qualite: 'fiable', cause: null,
    },
    sp95: {
      reference_date: null, reference_type: null,
      theorique: null, physique: 8200, ecart: null, ventes: null, livraison: 0, mouvement: 0,
      qualite: 'non_comparable', cause: 'ventes_indisponibles',
    },
    gnr: null,
  };
  const versions = {
    go: [
      { version_num: 2, cree_le: '2026-08-17T08:30:00Z', ecart: -20, qualite: 'fiable' },
      { version_num: 1, cree_le: '2026-08-17T07:00:00Z', ecart: -150, qualite: 'provisoire' },
    ],
    sp95: [{ version_num: 1, cree_le: '2026-08-17T07:00:00Z', ecart: null, qualite: 'non_comparable' }],
    gnr: [],
  };
  render('2026-08-17', controles, versions, ['go', 'sp95', 'gnr'], null);
  const out = modal.innerHTML;

  assert.ok(out.includes('Relevé de contrôle'), 'Titre de la modale absent');
  assert.ok(out.includes('Gasoil (GO)') && out.includes('Sans plomb (SP95)') && out.includes('Gasoil non routier (GNR)'), 'Les 3 carburants doivent apparaître');
  assert.ok(out.includes('Fiable'), 'Badge "Fiable" (GO) absent');
  // Cahier "Vocabulaire & intégration du prix d'achat" (17/08/2026) §3 :
  // "Non comparable" a été remplacé par "Comparaison partielle" dans la
  // grammaire NEXUS figée (QUALITÉ DE LA DONNÉE).
  assert.ok(out.includes('Comparaison partielle'), 'Badge "Comparaison partielle" (SP95) absent');
  // 28/08/2026 (retour de Frédéric, v2.261) — renderReleveControleModal
  // qualifie désormais l'absence de contrôle via M.diagnosticAbsenceControle
  // (releveDuJourPourModal non fourni ici -> aucun paramètre -> cas
  // "aucun_jaugeage", texte précis "Aucun jaugeage saisi pour cette date.",
  // voir test_carburant_diagnostic_absence_controle_v2261.js pour les 2
  // autres cas (en attente de validation terrain / écriture échouée).
  assert.ok(out.includes('Aucun jaugeage saisi pour cette date.'), 'GNR sans contrôle ni relevé -> message explicite attendu, jamais un bloc vide silencieux');
  assert.ok(out.includes('point zéro certifié'), 'Référence de départ GO doit citer son type (point zéro certifié)');
  assert.ok(out.includes('-20 L') || out.includes('−20 L'), 'Écart GO (-20 L) doit être affiché');
  // Cause qualité affichée pour SP95 (non_comparable/ventes_indisponibles) via
  // le VRAI libelleCauseQualiteChaine du moteur, jamais un code brut.
  assert.ok(!out.includes('ventes_indisponibles'), 'Jamais le code brut de la cause affiché au manager, seulement sa phrase');
  assert.ok(out.includes('Historique des versions (2)'), 'GO a 2 versions -> toggle historique affiché avec le bon compte');
  assert.ok(out.includes('Version 2') && out.includes('Version 1'), 'Les 2 versions de GO doivent apparaître dans le détail');
  assert.ok(out.includes('Version unique'), 'SP95 (1 seule version) -> note "version unique", jamais un toggle trompeur');
  assert.ok(out.includes('Exporter le relevé de contrôle (PDF)'), 'Bouton export PDF absent');

  console.log('✓ 1. renderReleveControleModal — 3 carburants (fiable/non_comparable/absent), historique de versions, causes en clair');
}

// ------------------------------------------------------------
// 2) renderReleveControleModal — mise en avant du carburant ciblé
//    (focusCarburant, ouvert depuis une carte Situation aujourd'hui).
// ------------------------------------------------------------
{
  const modal = fabriquerModal();
  const render = construireRenderControleModal(modal);
  const controles = { go: { reference_date: '2026-08-14', reference_type: 'releve', theorique: 5000, physique: 5000, ecart: 0, ventes: 100, livraison: 0, mouvement: 0, qualite: 'fiable', cause: null }, sp95: null, gnr: null };
  render('2026-08-17', controles, { go: [], sp95: [], gnr: [] }, ['go', 'sp95', 'gnr'], 'go');
  assert.ok(modal.innerHTML.includes('border-color:var(--cyan)'), 'Le carburant ciblé (focusCarburant) doit être visuellement mis en avant');
  console.log('✓ 2. renderReleveControleModal — carburant ciblé (focusCarburant) mis en avant');
}

// ------------------------------------------------------------
// 3) renderReleveReceptionModal — visite multi-carburant avec dérogation
//    manager (même fixture conceptuelle que test_pilotage_qualite_
//    receptions_v2.js scénario 2).
// ------------------------------------------------------------
{
  const modal = fabriquerModal();
  const render = construireRenderReceptionModal(modal);
  const visite = {
    date_visite: '2026-08-15', transporteur: 'TRANSHYDRO SARL', chauffeur: 'M. Dupont',
    immatriculation: 'AB-123-CD', bon_livraison_reference: 'BL-4521', statut: 'terminee_avec_derogation',
    lignes: [
      { carburant: 'sp95', quantite_bl_l: 17000, quantite_compartiments_l: 17000, quantite_mesuree_l: 16995, delta_l: -5, delta_ratio: -0.0003, statut: 'coherente' },
      { carburant: 'go', quantite_bl_l: 15000, quantite_compartiments_l: 14000, quantite_mesuree_l: 13980, delta_l: -1020, delta_ratio: -0.068, statut: 'a_rapprocher' },
    ],
    compartiments: [
      { numero: 1, carburant: 'sp95', statut: 'receptionne' },
      { numero: 2, carburant: 'go', statut: 'receptionne' },
      { numero: 3, carburant: 'go', statut: 'non_receptionne', motif_non_receptionne: 'compartiment_non_livre' },
    ],
    mesures: [],
  };
  render(visite);
  const out = modal.innerHTML;
  assert.ok(out.includes('Relevé de réception'), 'Titre de la modale absent');
  assert.ok(out.includes('TRANSHYDRO SARL') && out.includes('M. Dupont'), 'Transporteur/chauffeur absents');
  assert.ok(out.includes('AB-123-CD') && out.includes('BL-4521'), 'Immatriculation/BL absents');
  assert.ok(out.includes('Terminée avec dérogation manager'), 'Statut dérogation doit être explicite');
  assert.ok(out.includes('Sans plomb (SP95)') && out.includes('Gasoil (GO)'), 'Les 2 carburants doivent apparaître');
  assert.ok(out.includes('Cohérente'), 'Statut SP95 "Cohérente" absent (vrai NexusReceptionMoteur.libelleStatutReception)');
  assert.ok(out.includes('À rapprocher'), 'Statut GO "À rapprocher" absent');
  assert.ok(out.includes('1 compartiment(s) non réceptionné(s)'), 'Compte des compartiments non réceptionnés absent');
  assert.ok(out.includes('Exporter le relevé de réception (PDF)'), 'Bouton export PDF absent');
  console.log('✓ 3. renderReleveReceptionModal — visite multi-carburant avec dérogation, statuts issus du vrai moteur de réception');
}

// ------------------------------------------------------------
// 3bis) Réception régularisée d'après un relevé terrain manuscrit
//   (mandat du 19/09/2026). La modale doit rendre les TROIS dates
//   distinctes et jamais confondues : la livraison a réellement eu lieu le
//   18/09, les jaugeages ont été relevés sur le terrain ce jour-là, et la
//   saisie NEXUS date du 19/09. Un manager qui ouvre cette preuve ne doit
//   pas pouvoir croire que les chiffres ont été tapés pendant le dépotage.
// ------------------------------------------------------------
{
  const modal = fabriquerModal();
  const render = construireRenderReceptionModal(modal);
  const visite = {
    date_visite: '2026-09-18',
    heure_debut: '2026-09-18T13:30:00.000Z',
    heure_fin: '2026-09-18T14:10:00.000Z',
    transporteur: 'TRANSHYDRO SARL',
    chauffeur: 'M. Dupont',
    immatriculation: 'AB-123-CD',
    bon_livraison_reference: 'BL-4521',
    statut: 'terminee',
    mode_saisie: 'regularisation',
    regularisation_le: '2026-09-19T14:05:00.000Z',
    regularisation_par_nom: 'Manager Test',
    regularisation_motif: 'Accès au rôle pompiste temporairement indisponible au moment du dépotage.',
    controle_terrain_par: 'Pompiste Test',
    created_at: '2026-09-19T14:05:02.000Z',
    justificatif_url: 'https://exemple.invalid/storage/preuve.jpg',
    lignes: [
      { carburant: 'go', quantite_bl_l: 16000, quantite_compartiments_l: 16000, quantite_mesuree_l: 15940, delta_l: -60, delta_ratio: -0.00375, statut: 'coherente' },
    ],
    compartiments: [{ numero: 1, carburant: 'go', statut: 'receptionne' }],
    mesures: [{ cuve_id: 'cuve1', carburant: 'go', jaugeage_avant_l: 4000, jaugeage_apres_l: 19940, delta_mesure_l: 15940, source: 'releve_manuscrit' }],
  };
  render(visite);
  const out = modal.innerHTML;
  assert.ok(/régularisée/.test(out), 'La modale doit annoncer que la réception a été régularisée');
  assert.ok(out.includes('relevé terrain manuscrit'), 'La provenance "relevé terrain manuscrit" doit être écrite dans la preuve');
  assert.ok(out.includes('Manager Test'), 'L\'auteur de la régularisation doit être nommé');
  assert.ok(out.includes('Pompiste Test'), 'La personne ayant fait le contrôle terrain doit être nommée');
  assert.ok(out.includes('Accès au rôle pompiste'), 'Le motif de la régularisation doit être lisible');
  assert.ok(out.includes('Voir le justificatif joint') && out.includes('https://exemple.invalid/storage/preuve.jpg'), 'Le justificatif joint doit être atteignable depuis la preuve');
  // Les trois dates, chacune à sa place.
  // La modale date la réception avec formaterDateFrCourt ("18 sept.") et
  // horodate la régularisation avec formaterDateHeureFr ("19/09 à 10:05",
  // heure de la station). Les deux formats coexistent déjà dans la page ;
  // ce test constate le rendu réel plutôt que d'imposer une convention.
  assert.ok(/18\s*sept/.test(out), 'La date réelle de la livraison (18 sept.) doit rester la date de la réception');
  assert.ok(out.includes('19/09'), 'La date de saisie/régularisation NEXUS (19/09) doit apparaître distinctement');
  assert.ok(!/19\s*sept/.test(out), 'La date de saisie ne doit jamais prendre la place de la date de réception');
  // Le BL reste la quantité théorique, la mesure reste la mesure.
  assert.ok(out.includes('BL-4521'), 'La référence du BL doit être conservée');
  console.log('✓ 3bis. Réception régularisée — les trois dates distinctes, auteur, contrôle terrain, motif et justificatif dans la preuve');
}

// ------------------------------------------------------------
// 3ter) Échappement : motif et nom du contrôleur terrain sont de la saisie
//   libre, et l'URL du justificatif vient de la base. Ils ne doivent pas
//   pouvoir injecter de balise, et un href non https ne doit pas être
//   proposé comme lien.
// ------------------------------------------------------------
{
  const modal = fabriquerModal();
  const render = construireRenderReceptionModal(modal);
  render({
    date_visite: '2026-09-18', heure_fin: '2026-09-18T14:10:00.000Z', statut: 'terminee',
    mode_saisie: 'regularisation', regularisation_le: '2026-09-19T14:05:00.000Z',
    regularisation_par_nom: '<img src=x onerror=alert(1)>',
    regularisation_motif: '<script>alert("xss")</script>',
    controle_terrain_par: 'a" onmouseover="alert(2)',
    justificatif_url: 'javascript:alert(3)',
    lignes: [], compartiments: [], mesures: [],
  });
  const out = modal.innerHTML;
  assert.ok(!out.includes('<img src=x'), 'Le nom saisi ne doit pas produire de balise');
  assert.ok(!out.includes('<script>alert'), 'Le motif saisi ne doit pas produire de script');
  assert.ok(!out.includes('onmouseover="alert'), 'Le nom du contrôleur terrain ne doit pas produire d\'attribut exécutable');
  assert.ok(!out.includes('javascript:alert'), 'Une URL non https ne doit jamais devenir un lien');
  assert.ok(out.includes('Aucun justificatif joint'), 'Sans justificatif exploitable, la modale doit le dire plutôt que proposer un lien mort');
  console.log('✓ 3ter. Champs libres de régularisation échappés, URL de justificatif non https refusée');
}

// ------------------------------------------------------------
// 4) Historique enrichi — vérification structurelle (badges "Preuve" +
//    cartes Réceptions cliquables) directement sur le HTML source, sans
//    exécuter le rendu complet de la page (renderHistorique dépend de trop
//    de contexte module-level — accordéons, période, sidebar — pour être
//    extraite isolément ; mêmes limites déjà rencontrées sur cette page).
// ------------------------------------------------------------
{
  assert.ok(html.includes("NexusReceptionDonnees.chargerHistoriqueVisites(nexusClient, SITE_ID, 15)"), 'chargerEtRendreHistorique doit charger les visites de réception (Historique enrichi, C6.5)');
  assert.ok(html.includes('historique-recep-carte'), 'Cartes de réception dans Historique absentes');
  assert.ok(html.includes('ouvrirReleveReceptionParId'), 'Clic sur une carte réception doit ouvrir sa preuve par id (détail chargé à la demande)');
  assert.ok(html.includes('data-preuve-date'), 'Badge "Preuve" par ligne de relevé absent (ouverture modale sans quitter la page)');
  assert.ok(html.includes('ouvrirReleveControle(badge.dataset.preuveDate, null)'), 'Le badge Preuve doit ouvrir la modale relevé de contrôle pour la date de la ligne');
  assert.ok(html.includes('e.stopPropagation()'), 'Le clic sur le badge Preuve ne doit pas déclencher aussi la navigation de la ligne (rattrapage)');
  console.log('✓ 4. Historique enrichi — visites de réception chargées et rendues, badge "Preuve" isolé du clic de ligne (rattrapage)');
}

console.log('\nTous les tests carburant_pilotage_releve_controle passent.');
