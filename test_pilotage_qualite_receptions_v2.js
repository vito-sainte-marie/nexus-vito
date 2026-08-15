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

const DIR = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';
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

// Charge le vrai moteur (pas un mock) pour libelleStatutReception/texteEcart —
// cette carte ne recalcule jamais rien elle-même (Article 11), donc le test
// doit passer par le même moteur que la page.
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(moteurSrc, sandbox);

function fabriquerZone() {
  return { _html: '', get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; } };
}

function construireFonction(nexusClientMock, nexusReceptionDonneesMock, zone) {
  const prelude = `
    ${constNomCarburant}
    ${constNiveauCouleur}
    ${fnFmtLSrc}
    ${fnDisponibleSrc}
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

  console.log('\nTous les tests pilotage_qualite_receptions_v2 passent.');
})().catch(e => { console.error(e); process.exit(1); });
