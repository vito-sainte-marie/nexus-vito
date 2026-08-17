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

const DIR = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';
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
  assert.ok(out.includes('Non comparable'), 'Badge "Non comparable" (SP95) absent');
  assert.ok(out.includes('Aucun contrôle posé pour cette date'), 'GNR sans contrôle -> message explicite attendu, jamais un bloc vide silencieux');
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
