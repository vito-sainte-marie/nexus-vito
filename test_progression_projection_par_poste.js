// Test — projection sécurisée par employé et par poste (14/09/2026,
// arbitrage de Frédéric).
//
// Ce que ce fichier prouve, et ce qu'il ne prouve pas.
//
// IL PROUVE que `construireServicesCaisseDepuisProjection` (nouveau tunnel,
// alimenté par `mes_ecarts_caisse()`) produit EXACTEMENT les mêmes
// `services[]` que `construireServicesCaisse` (ancien tunnel, alimenté par
// les lignes brutes d'`audits_caisse`) — à la seule exception assumée de
// `commentaireValidation`, désormais toujours `null` puisque le commentaire
// manager n'est plus transmis et qu'aucun écran employé ne le lisait. Tout
// le reste du moteur (statutCaisse, serviceEstPropre, séries, badges,
// niveaux) consomme `services[]` : si la forme est identique, la bascule
// des trois écrans ne change aucun affichage.
//
// IL NE PROUVE PAS que la fonction SQL ne rend rien de trop : un test Node
// ne voit pas la base. Les lignes de projection utilisées ici sont écrites
// à la main d'après la signature de la migration 20260914210000. La preuve
// que le réseau ne transporte réellement aucune donnée de collègue est une
// preuve d'exécution, à jouer contre Production sur la gate de ce lot.
//
// nexus-progression.js est un IIFE écrit pour le navigateur — on stub
// `window` avant de le requérir, comme documenté dans le fichier lui-même.

global.window = global;
const path = require('path');
const assert = require('assert');
const DIR = __dirname;
require(path.join(DIR, 'nexus-progression.js'));
const N = global.NexusProgression;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

const MOI = 'emp-vanessa-1';
const COLLEGUE = 'emp-ruddy-2';
const AUTRE = 'emp-sonia-3';

// ------------------------------------------------------------
// Jeu de lignes brutes — la forme réellement mesurée en Production le
// 14/09/2026 : un employé sur piste, un autre en boutique, plus les champs
// que l'employé recevait jusqu'ici sans jamais devoir les voir.
// ------------------------------------------------------------
const BRUTES = [
  {
    id: 'audit-1', site: 'vito-sainte-marie', date: '2026-09-10', quart: 'Quart 1',
    employes_piste: [MOI], employes_boutique: [COLLEGUE],
    ecart_piste: -12.30, ecart_boutique: 480.00, ecart_total: 467.70,
    ecart_piste_valide: -12.30, ecart_boutique_valide: 0,
    ecart_piste_origine: -12.30, ecart_boutique_origine: 480.00,
    cause_code_piste: 'erreur_saisie', cause_code_boutique: 'vol_suspecte',
    valide_le: '2026-09-11T09:00:00Z',
    valide_le_piste: '2026-09-11T09:00:00Z', valide_le_boutique: '2026-09-11T09:05:00Z',
    valide_par: 'mgr-9', valide_par_piste: 'mgr-9', valide_par_boutique: 'mgr-9',
    commentaire_validation: 'Ruddy à revoir, troisième fois ce mois-ci.',
  },
  {
    id: 'audit-2', site: 'vito-sainte-marie', date: '2026-09-12', quart: 'Quart 2',
    employes_piste: [COLLEGUE], employes_boutique: [MOI],
    ecart_piste: 3.00, ecart_boutique: -0.45, ecart_total: 2.55,
    ecart_piste_valide: null, ecart_boutique_valide: null,
    ecart_piste_origine: 3.00, ecart_boutique_origine: -0.45,
    cause_code_piste: null, cause_code_boutique: null,
    valide_le: null, valide_le_piste: null, valide_le_boutique: null,
    valide_par: null, commentaire_validation: null,
  },
  {
    // Ligne où l'employé ne figure nulle part : l'ancien tunnel la recevait
    // et la jetait côté navigateur ; le nouveau ne la reçoit jamais.
    id: 'audit-3', site: 'vito-sainte-marie', date: '2026-09-13', quart: 'Quart 1',
    employes_piste: [AUTRE], employes_boutique: [COLLEGUE],
    ecart_piste: -900.00, ecart_boutique: 0, ecart_total: -900.00,
    ecart_piste_valide: null, ecart_boutique_valide: null,
    ecart_piste_origine: -900.00, ecart_boutique_origine: 0,
    cause_code_piste: null, cause_code_boutique: null,
    valide_le: null, valide_par: null, commentaire_validation: null,
  },
];

// Lignes telles que `mes_ecarts_caisse()` les rend à MOI : une par poste
// réellement tenu, rien d'autre. Écrites à la main d'après la signature de
// la migration — pas dérivées des lignes brutes ci-dessus, pour que le test
// échoue si la correspondance champ à champ dérive.
const PROJECTION = [
  {
    audit_id: 'audit-1', site: 'vito-sainte-marie', date: '2026-09-10', quart: 'Quart 1',
    poste: 'piste',
    ecart: -12.30, ecart_valide: -12.30, ecart_origine: -12.30,
    cause_code: 'erreur_saisie', valide_le: '2026-09-11T09:00:00Z',
    poste_partage: false, nb_detenteurs: 1,
  },
  {
    audit_id: 'audit-2', site: 'vito-sainte-marie', date: '2026-09-12', quart: 'Quart 2',
    poste: 'boutique',
    ecart: -0.45, ecart_valide: null, ecart_origine: -0.45,
    cause_code: null, valide_le: null,
    poste_partage: false, nb_detenteurs: 1,
  },
];

// ------------------------------------------------------------
// 1) Équivalence stricte des deux tunnels.
// ------------------------------------------------------------
{
  const ancien = N.construireServicesCaisse(BRUTES, MOI);
  const nouveau = N.construireServicesCaisseDepuisProjection(PROJECTION);

  assert.strictEqual(ancien.length, 2, 'l\'ancien tunnel retient les deux services de l\'employé');
  assert.strictEqual(nouveau.length, ancien.length, 'le nouveau tunnel produit le même nombre de services');

  // `commentaireValidation` est la seule divergence voulue : on la neutralise
  // des deux côtés pour comparer le reste au champ près.
  const sansCommentaire = s => Object.assign({}, s, { commentaireValidation: null });
  assert.deepStrictEqual(
    nouveau.map(sansCommentaire),
    ancien.map(sansCommentaire),
    'services[] identique champ à champ entre lignes brutes et projection'
  );

  // Et la divergence est bien celle-là, dans ce sens-là.
  assert.strictEqual(ancien[1].commentaireValidation, 'Ruddy à revoir, troisième fois ce mois-ci.',
    'l\'ancien tunnel transportait bien le commentaire manager');
  assert.ok(nouveau.every(s => s.commentaireValidation === null),
    'le nouveau tunnel ne transporte jamais de commentaire manager');

  ok('Équivalence — le tunnel projection produit les mêmes services[] que le tunnel brut');
}

// ------------------------------------------------------------
// 2) Aucune donnée de collègue dans la source du nouveau tunnel.
// ------------------------------------------------------------
{
  const texte = JSON.stringify(PROJECTION);
  [COLLEGUE, AUTRE, 'mgr-9'].forEach(uuid => {
    assert.ok(!texte.includes(uuid), `aucun identifiant de collègue (${uuid}) dans les lignes de projection`);
  });
  assert.ok(!texte.includes('ecart_total'), 'aucun écart de quart dans les lignes de projection');
  assert.ok(!texte.includes('valide_par'), 'aucune identité de validateur dans les lignes de projection');
  assert.ok(!texte.includes('commentaire'), 'aucun commentaire manager dans les lignes de projection');
  // L'écart du poste NON tenu ne doit apparaître nulle part : 480.00 est
  // l'écart boutique du quart 1, tenu par le collègue.
  assert.ok(!texte.includes('480'), 'aucun écart du poste non tenu dans les lignes de projection');

  // La même vérification sur ce que le tunnel brut transportait, pour que le
  // test dise ce qui était réellement exposé avant.
  const texteBrut = JSON.stringify(BRUTES);
  assert.ok(texteBrut.includes(COLLEGUE) && texteBrut.includes('valide_par') && texteBrut.includes('480'),
    'référence : les lignes brutes contenaient bien collègues, validateur et écart du poste non tenu');

  ok('Étanchéité — la source du nouveau tunnel ne contient ni collègue, ni validateur, ni commentaire, ni écart non tenu');
}

// ------------------------------------------------------------
// 3) Poste partagé — l'écart sort du cumul personnel (arbitrage 14/09/2026).
// ------------------------------------------------------------
{
  const partage = [{
    audit_id: 'audit-4', site: 'vito-sainte-marie', date: '2026-09-09', quart: 'Quart 2',
    poste: 'piste', ecart: -40.00, ecart_valide: null, ecart_origine: -40.00,
    cause_code: null, valide_le: null,
    poste_partage: true, nb_detenteurs: 2,
  }];
  const services = N.construireServicesCaisseDepuisProjection(partage);
  assert.strictEqual(services.length, 1);
  assert.strictEqual(services[0].surPiste, true, 'l\'employé a bien tenu ce poste');
  assert.strictEqual(services[0].soloPiste, false, 'un poste tenu par plusieurs personnes n\'est pas solo');
  assert.strictEqual(services[0].ecartPiste, -40, 'l\'écart du poste partagé reste visible');

  // `attribuable` est ce qui fait entrer ou non un écart dans le cumul
  // personnel : sans comptage de passation, il doit rester faux.
  const ligne = N.ligneActiviteCaisse(services[0], 'piste');
  assert.strictEqual(ligne.attribuable, false,
    'sans comptage de passation, l\'écart d\'un poste partagé n\'est pas attribuable individuellement');

  // Le binôme normal piste + boutique, lui, reste attribuable : ce n'est pas
  // un poste partagé (arbitrage du 14/09/2026).
  const solo = N.construireServicesCaisseDepuisProjection([PROJECTION[0]]);
  assert.strictEqual(N.ligneActiviteCaisse(solo[0], 'piste').attribuable, true,
    'un poste tenu par une seule personne reste attribuable, même si un collègue tenait l\'autre poste');

  ok('Poste partagé — hors cumul personnel ; le binôme piste + boutique reste, lui, attribuable');
}

// ------------------------------------------------------------
// 4) Absence d'audit — état vide explicite, jamais un zéro simulé.
// ------------------------------------------------------------
{
  assert.deepStrictEqual(N.construireServicesCaisseDepuisProjection([]), [],
    'aucun audit associé -> aucun service, pas un service à zéro');
  assert.deepStrictEqual(N.construireServicesCaisseDepuisProjection(null), [],
    'réponse absente -> aucun service (et pas une exception)');

  // Le cas Vanessa du 14/09/2026 : employée réelle, zéro ligne d'audit.
  // C'est à l'écran de dire « aucun contrôle enregistré », pas au moteur de
  // fabriquer un cumul de 0,00 €.
  const services = N.construireServicesCaisseDepuisProjection([]);
  assert.strictEqual(services.length, 0);
  assert.strictEqual(N.statutCaisse(services).statut, 'Données insuffisantes',
    'sans aucun service, le statut caisse est "Données insuffisantes", pas "conforme"');

  ok('État vide — zéro ligne produit un état vide explicite, jamais un résultat nul simulé');
}

// ------------------------------------------------------------
// 5) Deux postes sur le même quart — regroupés en un seul service.
// ------------------------------------------------------------
{
  // Cas absent de Production au 14/09/2026 (zéro ligne mesurée), mais le
  // regroupement doit le supporter sans se réécrire.
  const lesDeux = [
    { audit_id: 'audit-5', date: '2026-09-08', quart: 'Quart 1', poste: 'piste',
      ecart: -5.00, ecart_valide: null, ecart_origine: -5.00, cause_code: null,
      valide_le: null, poste_partage: false, nb_detenteurs: 1 },
    { audit_id: 'audit-5', date: '2026-09-08', quart: 'Quart 1', poste: 'boutique',
      ecart: 1.00, ecart_valide: null, ecart_origine: 1.00, cause_code: null,
      valide_le: '2026-09-09T08:00:00Z', poste_partage: false, nb_detenteurs: 1 },
  ];
  const services = N.construireServicesCaisseDepuisProjection(lesDeux);
  assert.strictEqual(services.length, 1, 'deux postes du même quart -> un seul service');
  assert.strictEqual(services[0].surPiste, true);
  assert.strictEqual(services[0].surBoutique, true);
  assert.strictEqual(services[0].ecartPiste, -5);
  assert.strictEqual(services[0].ecartBoutique, 1);
  assert.strictEqual(services[0].valideLe, '2026-09-09T08:00:00Z',
    'la date de validation connue est conservée, quel que soit le poste qui la porte');

  ok('Regroupement — deux postes du même quart forment un service unique');
}

// ------------------------------------------------------------
// 6) Ordre — plus récent d'abord, comme l'ancien tunnel.
// ------------------------------------------------------------
{
  const services = N.construireServicesCaisseDepuisProjection(PROJECTION);
  assert.deepStrictEqual(services.map(s => s.date), ['2026-09-12', '2026-09-10'],
    'services triés du plus récent au plus ancien');
  ok('Ordre — plus récent d\'abord, identique à l\'ancien tunnel');
}

console.log(`\n${n} tests passés.`);
