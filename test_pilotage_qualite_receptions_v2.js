// Test — sous-bloc "Qualité des réceptions" de NEXUS-Carburants-Pilotage-v1.html,
// réécrit le 15/08/2026 pour lire le nouveau schéma "visite camion" v2
// (NexusReceptionDonnees.chargerDerniereVisite) au lieu de l'ancien
// chargerDerniereReception (1 réception = 1 carburant), supprimé lors de la
// refonte complète du module Réception Carburant.
//
// Fonctions extraites par regex (même convention que
// test_reception_carburant_role.js) plutôt que vm sur le fichier entier :
// chargerEtRendreQualiteReceptions() n'a de dépendance que sur document,
// NexusReceptionDonnees, NexusReceptionMoteur, SITE_ID, NIVEAU_COULEUR,
// NOM_CARBURANT et fmtL — pas besoin de mocker toute la page Pilotage
// (barres de période, accordéons, graphiques...).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, 'NEXUS-Carburants-Pilotage-v1.html'), 'utf8');
const moteurSrc = fs.readFileSync(path.join(DIR, 'nexus-reception-moteur.js'), 'utf8');

function extraireSync(source, nomFonction) {
  const re = new RegExp(`function ${nomFonction}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`);
  const m = source.match(re);
  if (!m) throw new Error(`Fonction ${nomFonction} introuvable`);
  return m[0];
}
function extraireAsync(source, nomFonction) {
  const re = new RegExp(`async function ${nomFonction}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`);
  const m = source.match(re);
  if (!m) throw new Error(`Fonction ${nomFonction} introuvable`);
  return m[0];
}
function extraireConst(source, nomConst) {
  const re = new RegExp(`const ${nomConst} = \\{[\\s\\S]*?\\n  \\};`);
  const m = source.match(re);
  if (!m) throw new Error(`Constante ${nomConst} introuvable`);
  return m[0];
}

assert.ok(!html.includes('chargerDerniereReception'), 'La page ne doit plus référencer la fonction obsolète chargerDerniereReception (ancien modèle 1 réception = 1 carburant)');
assert.ok(html.includes('chargerDerniereVisite'), 'La page doit consommer NexusReceptionDonnees.chargerDerniereVisite (nouveau modèle "visite camion")');

const fnQualiteSrc = extraireAsync(html, 'chargerEtRendreQualiteReceptions');
const fnDisponibleSrc = extraireSync(html, 'global_NexusReceptionDonnees_disponible');
const fnFmtLSrc = extraireSync(html, 'fmtL');
const constNomCarburant = extraireConst(html, 'NOM_CARBURANT');
const constNiveauCouleur = extraireConst(html, 'NIVEAU_COULEUR');
// 19/09/2026 — provenance d'une réception régularisée : la carte doit dire
// qu'une réception a été reconstruite d'après un relevé manuscrit. Les vraies
// fonctions de la page sont extraites (jamais des doublures : c'est
// précisément leur texte que ce test vérifie).
const fnEstVisiteRegulariseeSrc = extraireSync(html, 'estVisiteRegularisee');
const fnMentionRegularisationSrc = extraireSync(html, 'mentionRegularisation');
const fnFormaterDateHeureFrSrc = extraireSync(html, 'formaterDateHeureFr');

// Charge le vrai moteur (pas un mock) pour libelleStatutReception/texteEcart —
// cette carte ne recalcule jamais rien elle-même (Article 11), donc le test
// doit passer par le même moteur que la page.
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(moteurSrc, sandbox);

// Reproduit le formatage de la page pour comparer des volumes sans
// dépendre d'un espace insécable écrit à la main dans le test.
const fmtLAttendu = new Function(`${fnFmtLSrc}; return fmtL;`)();

function fabriquerZone() {
  return { _html: '', get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; } };
}

function construireFonction(nexusClientMock, nexusReceptionDonneesMock, zone) {
  const prelude = `
    ${constNomCarburant}
    ${constNiveauCouleur}
    ${fnFmtLSrc}
    ${fnDisponibleSrc}
    // Sprint C6 (17/08/2026) : chargerEtRendreQualiteReceptions renseigne
    // désormais DERNIERE_VISITE et redéclenche renderMessages() (lien
    // "Voir le relevé de réception" + messages qualité partagés) — variables
    // module-level réelles de la page, simulées ici en isolation.
    let CONTROLE_CTX = null;
    let DERNIERE_VISITE = null;
    let DERNIERE_LIVRAISON_AFFICHEE = null;
    function renderMessages() {}
    function ouvrirReleveReception() {}
    // CAR-UX-07 (17/08/2026) : chargerEtRendreQualiteReceptions() rappelle
    // rafraichirNoteTerrainLivraison() une fois DERNIERE_VISITE disponible
    // (voir NEXUS-Carburants-Pilotage-v1.html) — stub neutre ici, cette
    // note appartient au bloc "Dernière livraison", pas à "Qualité des
    // réceptions" testé par ce fichier.
    function rafraichirNoteTerrainLivraison() {}
    // Fuseau réel de la station (v2.232) — une régularisation saisie à
    // 14:05 UTC doit s'afficher à l'heure de la station, pas à celle du
    // serveur qui rend la page.
    const FUSEAU_STATION = 'America/Martinique';
    ${fnFormaterDateHeureFrSrc}
    ${fnEstVisiteRegulariseeSrc}
    ${fnMentionRegularisationSrc}
    return (${fnQualiteSrc.replace(/^async function \w+/, 'async function chargerEtRendreQualiteReceptions')});
  `;
  const fn = new Function('document', 'nexusClient', 'NexusReceptionDonnees', 'NexusReceptionMoteur', 'SITE_ID', prelude)(
    { getElementById: (id) => (id === 'qualiteReceptionsZone' ? zone : null) },
    nexusClientMock,
    nexusReceptionDonneesMock,
    sandbox.NexusReceptionMoteur,
    'site-test'
  );
  return fn;
}

(async function main() {
  // ------------------------------------------------------------
  // 1) Aucune visite enregistrée — message neutre, pas d'exception.
  // ------------------------------------------------------------
  {
    const zone = fabriquerZone();
    const fn = construireFonction({}, { chargerDerniereVisite: async () => null }, zone);
    await fn();
    assert.ok(zone.innerHTML.includes('Aucune réception saisie'), 'Message vide attendu quand aucune visite n\'existe');
  }
  console.log('✓ 1. Aucune visite — message neutre, aucune exception');

  // ------------------------------------------------------------
  // 2) Visite multi-carburant (SP95 cohérent, GO à rapprocher), avec un
  //    compartiment non réceptionné — reproduit le scénario réel du test
  //    test_reception_visite_render.js (même fixture conceptuelle).
  // ------------------------------------------------------------
  {
    const visiteFixture = {
      date_visite: '2026-08-15',
      transporteur: 'TRANSHYDRO SARL',
      statut: 'terminee_avec_derogation',
      lignes: [
        { carburant: 'sp95', quantite_bl_l: 17000, quantite_compartiments_l: 17000, quantite_mesuree_l: 16995, delta_l: -5, delta_ratio: -0.0003, statut: 'coherente' },
        { carburant: 'go', quantite_bl_l: 15000, quantite_compartiments_l: 14000, quantite_mesuree_l: 13980, delta_l: -1020, delta_ratio: -0.068, statut: 'a_rapprocher' },
      ],
      compartiments: [
        { numero: 1, carburant: 'sp95', statut: 'receptionne' },
        { numero: 2, carburant: 'go', statut: 'receptionne' },
        { numero: 3, carburant: 'go', statut: 'non_receptionne', motif_non_receptionne: 'compartiment_non_livre' },
      ],
      mesures: [
        { cuve_id: 'unique', carburant: 'sp95', jaugeage_avant_l: 8000, jaugeage_apres_l: 24995, delta_mesure_l: 16995 },
        { cuve_id: 'cuve1', carburant: 'go', jaugeage_avant_l: 8000, jaugeage_apres_l: 21980, delta_mesure_l: 13980 },
      ],
    };
    const zone = fabriquerZone();
    const fn = construireFonction({}, { chargerDerniereVisite: async () => visiteFixture }, zone);
    await fn();
    const c = zone.innerHTML;
    assert.ok(c.includes('15/08/2026'), 'Date de la visite absente');
    assert.ok(c.includes('TRANSHYDRO SARL'), 'Transporteur absent');
    assert.ok(c.includes('dérogation manager tracée'), 'Mention de la dérogation manager absente (visite terminee_avec_derogation)');
    // Deux cartes carburant distinctes, jamais fusionnées.
    assert.ok(c.includes('Sans plomb (SP95)'), 'Carte SP95 absente');
    assert.ok(c.includes('Gasoil (GO)'), 'Carte GO absente');
    assert.ok(c.includes('Cohérente'), 'Statut "Cohérente" (SP95) absent');
    assert.ok(c.includes('À rapprocher'), 'Statut "À rapprocher" (GO) absent');
    assert.ok(c.includes(`${(17000).toLocaleString('fr-FR')} L`), 'Quantité BL SP95 absente');
    assert.ok(c.includes('Cuve unique') && c.includes('Cuve cuve1'), 'Détail des cuves de jaugeage absent (une ligne par cuve mesurée)');
    assert.ok(c.includes('Compartiments non réceptionnés'), 'Note "compartiments non réceptionnés" absente');
    assert.ok(c.includes('>1<') || c.includes('1 (dérogation'), 'Le compte de compartiments non réceptionnés doit être 1');
  }
  console.log('✓ 2. Visite multi-carburant — une carte par carburant, dérogation et compartiment non réceptionné signalés');

  // ------------------------------------------------------------
  // 3) Réception régularisée d'après un relevé terrain manuscrit
  //    (mandat du 19/09/2026, test obligatoire n°6 "provenance visible").
  //    Le cas réel : la livraison du 18/09 a bien eu lieu et a bien été
  //    jaugée, mais sur papier — la saisie NEXUS est faite le 19/09. Les
  //    CHIFFRES doivent être présentés exactement comme ceux d'une
  //    réception normale (aucun traitement de faveur, Performance s'en
  //    sert telle quelle) ; c'est le RÉCIT qui doit changer : sans
  //    mention, un manager croirait que les jaugeages ont été relevés
  //    dans NEXUS le jour même.
  // ------------------------------------------------------------
  {
    const visiteRegularisee = {
      date_visite: '2026-09-18',
      transporteur: 'TRANSHYDRO SARL',
      statut: 'terminee',
      mode_saisie: 'regularisation',
      regularisation_le: '2026-09-19T14:05:00.000Z',
      regularisation_par_nom: 'Manager Test',
      regularisation_motif: 'Saisie NEXUS impossible au moment du dépotage.',
      controle_terrain_par: 'Pompiste Test',
      created_at: '2026-09-19T14:05:02.000Z',
      lignes: [
        { carburant: 'go', quantite_bl_l: 16000, quantite_compartiments_l: 16000, quantite_mesuree_l: 15940, delta_l: -60, delta_ratio: -0.00375, statut: 'coherente' },
      ],
      compartiments: [{ numero: 1, carburant: 'go', statut: 'receptionne' }],
      mesures: [
        { cuve_id: 'cuve1', carburant: 'go', jaugeage_avant_l: 4000, jaugeage_apres_l: 19940, delta_mesure_l: 15940, source: 'releve_manuscrit' },
      ],
    };
    const zone = fabriquerZone();
    const fn = construireFonction({}, { chargerDerniereVisite: async () => visiteRegularisee }, zone);
    await fn();
    const c = zone.innerHTML;
    assert.ok(c.includes('18/09/2026'), 'La date affichée doit rester celle de la livraison réelle (18/09), pas celle de la saisie');
    assert.ok(/régularisée/.test(c), 'La carte doit dire que cette réception a été régularisée');
    assert.ok(c.includes('relevé terrain manuscrit'), 'La provenance "relevé terrain manuscrit" doit être visible');
    assert.ok(c.includes('19/09'), 'La date de régularisation (19/09) doit être visible à côté de la date de livraison');
    assert.ok(c.includes('relevé manuscrit') && c.includes('Cuve cuve1'), 'Chaque mesure issue du papier doit porter sa provenance');
    // Les chiffres restent ceux d'une réception normale, au litre près.
    assert.ok(c.includes(fmtLAttendu(16000)), 'Le BL doit rester affiché tel quel');
    assert.ok(c.includes(fmtLAttendu(15940)), 'La quantité mesurée doit être affichée telle quelle');
    // Aucune invention : ce que le document ne dit pas reste vide.
    assert.ok(!/undefined|NaN|null/.test(c), 'Aucune valeur fabriquée ne doit apparaître dans la carte');
  }
  console.log('✓ 3. Réception régularisée — provenance visible, chiffres inchangés, date réelle conservée');

  // ------------------------------------------------------------
  // 4) Réception normale : aucune mention de régularisation ne doit
  //    apparaître (une trace de provenance ne s'invite pas là où il n'y a
  //    rien à signaler).
  // ------------------------------------------------------------
  {
    const visiteNormale = {
      date_visite: '2026-09-19', transporteur: 'TRANSHYDRO SARL', statut: 'terminee', mode_saisie: 'temps_reel',
      lignes: [{ carburant: 'go', quantite_bl_l: 16000, quantite_compartiments_l: 16000, quantite_mesuree_l: 15990, delta_l: -10, delta_ratio: -0.000625, statut: 'coherente' }],
      compartiments: [], mesures: [{ cuve_id: 'cuve1', carburant: 'go', jaugeage_avant_l: 4000, jaugeage_apres_l: 19990, delta_mesure_l: 15990, source: 'saisie_nexus' }],
    };
    const zone = fabriquerZone();
    const fn = construireFonction({}, { chargerDerniereVisite: async () => visiteNormale }, zone);
    await fn();
    const c = zone.innerHTML;
    assert.ok(!/régularis/i.test(c), 'Une réception temps réel ne doit porter aucune mention de régularisation');
    assert.ok(!/manuscrit/i.test(c), 'Une réception temps réel ne doit porter aucune mention de relevé manuscrit');
  }
  console.log('✓ 4. Réception temps réel — aucune mention de provenance parasite');

  console.log('\nTous les tests pilotage_qualite_receptions_v2 passent.');
})().catch(e => { console.error(e); process.exit(1); });
