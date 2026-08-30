// Test — Chantier "réglages fantômes" (30/08/2026)
//
// Demande explicite de Frédéric ("vas y") sur les 5 réglages enregistrés
// depuis le Sprint 5 (inventaire_regles_produit / inventaire_categories)
// mais jamais consommés par aucun moteur : controle_aleatoire,
// validation_manager_requise, comptage_masque, photo_obligatoire,
// reapprovisionnable. Citation exacte du mandat : "Pour chacun, soit on le
// branche réellement à un moteur, soit on le retire de l'UI. Je ne veux
// plus de réglage visible qui donne l'impression d'agir alors qu'il ne
// produit aucun effet."
//
// Audit préalable (Article 5, sur données réelles Supabase, projet
// uzhjpqpctpvxytxpxoqz) :
//   - inventaire_regles_produit (61 lignes) : 100% à la valeur par défaut
//     sur les 5 champs, aucune configuration produit réelle jamais faite.
//   - inventaire_categories (23 lignes) : controle_aleatoire=true sur 3
//     catégories (choix délibéré) ; comptage_masque=true sur 10/11
//     catégories signalées (quasi-universel, valeur de seed historique, pas
//     une différenciation réelle) ; validation_manager_requise/
//     photo_obligatoire jamais à true nulle part.
//   - estMasquePourProduit (NEXUS-Inventaire-v1.html, Sprint 1/INV2-01)
//     masque déjà TOUT produit du plan du jour, plus le mécanisme séparé et
//     vivant inventaire_modes_controle ("Mode de comptage à l'aveugle") —
//     comptage_masque est donc architecturalement redondant, pas juste
//     non branché.
//   - Aucune fonctionnalité de capture photo n'existe nulle part dans
//     l'app ("Photo Decenium" est un instantané de rapprochement de
//     données, pas une image — voir nexus-inventaire-snapshot-moteur.js).
//
// Décisions (5), chacune vérifiée ici :
//   1. controle_aleatoire   -> BRANCHÉ : construirePlanComptage restreint le
//      tirage des surprises aux produits opt-in s'il en existe au moins un.
//   2. reapprovisionnable   -> BRANCHÉ : actionsMouvementPourProfil exclut
//      livraison/reassort quand explicitement false.
//   3. validation_manager_requise -> RETIRÉ de l'UI (aucun moteur cible
//      réaliste identifié — aucun écran de validation manager au comptage
//      n'existe ni n'est demandé).
//   4. comptage_masque      -> RETIRÉ de l'UI (redondant avec
//      estMasquePourProduit + inventaire_modes_controle, qui restent
//      inchangés et pleinement fonctionnels).
//   5. photo_obligatoire    -> RETIRÉ de l'UI (aucune fonctionnalité photo
//      n'existe dans l'app).
//
// Les 3 champs retirés de l'UI restent des colonnes réelles en base,
// intactes, et le code de construction/sauvegarde/duplication des règles
// continue de les faire transiter tels quels (Article 5 — jamais une valeur
// existante altérée ou perdue faute de contrôle visible ; seul le contrôle
// d'édition disparaît, pas la donnée).
//
// Discipline habituelle : assertions sur le texte source réel et sur le
// comportement du moteur pur, jamais une réécriture à la main de la
// logique testée.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';

global.window = global;
require(path.join(ROOT, 'nexus-inventaire-moteur.js'));
const M = global.NexusInventaireMoteur;

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

function lireSource(fichier) { return fs.readFileSync(path.join(ROOT, fichier), 'utf8'); }

// ------------------------------------------------------------
// MOTEUR — actionsMouvementPourProfil(profil, reapprovisionnable)
// ------------------------------------------------------------

testSync('actionsMouvementPourProfil — reapprovisionnable=false retire livraison ET reassort (profil continu)', () => {
  const actions = M.actionsMouvementPourProfil('continu', false);
  const valeurs = actions.map(a => a.value);
  assert.ok(!valeurs.includes('livraison'), 'livraison ne doit plus apparaître');
  assert.ok(!valeurs.includes('reassort'), 'reassort ne doit plus apparaître');
  assert.ok(valeurs.includes('casse') && valeurs.includes('retour') && valeurs.includes('transfert'), 'les autres types doivent rester');
});

testSync('actionsMouvementPourProfil — reapprovisionnable=true laisse la liste intacte', () => {
  const avecTrue = M.actionsMouvementPourProfil('continu', true).map(a => a.value);
  const sansParam = M.actionsMouvementPourProfil('continu').map(a => a.value);
  assert.deepStrictEqual(avecTrue, sansParam, 'true doit se comporter exactement comme aucun 2e argument');
  assert.ok(avecTrue.includes('livraison') && avecTrue.includes('reassort'));
});

testSync('actionsMouvementPourProfil — 2e argument omis (comportement historique, tous les appelants avant ce lot) inchangé', () => {
  const actions = M.actionsMouvementPourProfil('consommable');
  assert.deepStrictEqual(actions.map(a => a.value), ['livraison', 'retrait']);
});

testSync('actionsMouvementPourProfil — profil inconnu retombe sur "continu", reapprovisionnable=false s\'applique quand même', () => {
  const actions = M.actionsMouvementPourProfil('profil_qui_nexiste_pas', false);
  const valeurs = actions.map(a => a.value);
  assert.ok(!valeurs.includes('livraison') && !valeurs.includes('reassort'));
  assert.ok(valeurs.includes('casse'));
});

testSync('actionsMouvementPourProfil — production_journaliere n\'a de toute façon jamais livraison/reassort (false n\'a aucun effet visible, pas de régression)', () => {
  const actions = M.actionsMouvementPourProfil('production_journaliere', false);
  assert.deepStrictEqual(actions.map(a => a.value), ['production_additionnelle', 'retrait', 'retour', 'casse']);
});

// ------------------------------------------------------------
// MOTEUR — construirePlanComptage : pool des surprises restreint par
// controle_aleatoire (opt-in-aware, avec repli complet si aucun opt-in).
// ------------------------------------------------------------

function planDeBase(produits, reglesParProduit, surprisesCible) {
  // dernierControleParProduit calé sur dateISO (0 jour d'écart, sous le
  // délai standard de 7 jours) pour qu'aucun produit ne soit "en retard" —
  // sinon l'étape coverage_gap les inclurait tous avant même d'atteindre le
  // tirage des surprises, et le test ne vérifierait rien sur
  // controle_aleatoire. Seule la voie "surprise" doit rester ouverte ici.
  const dernierControleParProduit = {};
  produits.forEach(p => { dernierControleParProduit[p.id] = '2026-08-30'; });
  return M.construirePlanComptage({
    produits, reglesParProduit,
    dernierControleParProduit, produitsAvecAnomalieRecente: [],
    quart: 'matin', dateISO: '2026-08-30',
    socleCible: 0, surprisesCible, seed: 'test-fixe',
    surprisesRecentesParProduit: [],
  });
}

testSync('construirePlanComptage — aucun produit avec controle_aleatoire=true nulle part -> pool complet (comportement historique, aucune régression pour un site qui n\'a jamais touché ce réglage)', () => {
  const produits = [
    { id: 'p1', actif: true }, { id: 'p2', actif: true }, { id: 'p3', actif: true },
  ];
  const regles = { p1: { controle_aleatoire: false }, p2: {}, p3: { controle_aleatoire: false } };
  const plan = planDeBase(produits, regles, 3);
  const surprises = plan.items.filter(i => i.raison_selection === 'surprise').map(i => i.produit_id);
  assert.strictEqual(surprises.length, 3, 'les 3 produits doivent rester éligibles au tirage (pool complet)');
});

testSync('construirePlanComptage — au moins un produit opt-in (controle_aleatoire=true) -> le tirage se restreint au sous-ensemble opt-in', () => {
  const produits = [
    { id: 'p1', actif: true }, { id: 'p2', actif: true }, { id: 'p3', actif: true }, { id: 'p4', actif: true },
  ];
  const regles = {
    p1: { controle_aleatoire: true }, p2: { controle_aleatoire: true },
    p3: {}, p4: { controle_aleatoire: false },
  };
  const plan = planDeBase(produits, regles, 5);
  const surprises = plan.items.filter(i => i.raison_selection === 'surprise').map(i => i.produit_id);
  assert.deepStrictEqual(surprises.sort(), ['p1', 'p2'], 'seuls p1/p2 (opt-in) doivent être tirés, même en demandant plus que leur nombre');
});

testSync('construirePlanComptage — opt-in porté par la catégorie (règle effective), pas seulement le produit', () => {
  const produits = [{ id: 'p1', actif: true }, { id: 'p2', actif: true }];
  const regles = { p1: { controle_aleatoire: true }, p2: { controle_aleatoire: false } };
  const plan = planDeBase(produits, regles, 5);
  const surprises = plan.items.filter(i => i.raison_selection === 'surprise').map(i => i.produit_id);
  assert.deepStrictEqual(surprises, ['p1']);
});

// ------------------------------------------------------------
// CÂBLAGE RÉEL — NEXUS-Inventaire-v1.html (reapprovisionnable)
// ------------------------------------------------------------

const srcEmploye = lireSource('NEXUS-Inventaire-v1.html');

testSync('NEXUS-Inventaire-v1.html — état reapprovisionnableParProduit déclaré', () => {
  assert.ok(srcEmploye.includes('let reapprovisionnableParProduit = {};'), 'état reapprovisionnableParProduit introuvable');
});

testSync('NEXUS-Inventaire-v1.html — chargerProduitsZone inclut reapprovisionnable dans la jointure inventaire_categories', () => {
  const debut = srcEmploye.indexOf('async function chargerProduitsZone');
  const bloc = srcEmploye.slice(debut, debut + 1400);
  assert.ok(bloc.includes("inventaire_categories(nom, ordre_affichage, jours_rotation, regle_active, quarts_comptage, profil, reapprovisionnable)"), 'select catégorie ne remonte pas reapprovisionnable');
});

testSync('NEXUS-Inventaire-v1.html — chargerReapprovisionnableParProduit délègue à construireReglesEffectivesParProduit (Article 11, pas de 2e cascade)', () => {
  const debut = srcEmploye.indexOf('async function chargerReapprovisionnableParProduit');
  const fin = srcEmploye.indexOf('\n  }\n', debut);
  const bloc = srcEmploye.slice(debut, fin);
  assert.ok(bloc.includes('M.construireReglesEffectivesParProduit(produits, reglesParProduitId, reglesParCategorieId)'), 'délégation au moteur central introuvable');
  assert.ok(bloc.includes("carte[p.id] = !r || r.reapprovisionnable !== false;"), 'défaut réel (true) attendu en l\'absence de règle — jamais un false fabriqué');
});

testSync('NEXUS-Inventaire-v1.html — demarrerAjoutMouvementRapide charge la map et repeuplerTypes la transmet à actionsMouvementPourProfil', () => {
  const debutFn = srcEmploye.indexOf('async function demarrerAjoutMouvementRapide');
  const finFn = srcEmploye.indexOf('async function', debutFn + 10);
  const blocFn = srcEmploye.slice(debutFn, finFn === -1 ? debutFn + 4000 : finFn);
  assert.ok(blocFn.includes('reapprovisionnableParProduit = await chargerReapprovisionnableParProduit(mouvementRapideProduits);'), 'chargement de la map introuvable dans demarrerAjoutMouvementRapide');
  assert.ok(srcEmploye.includes("const reapprovisionnable = reapprovisionnableParProduit[produitId];"), 'lecture de la map introuvable dans repeuplerTypes');
  assert.ok(srcEmploye.includes("M.actionsMouvementPourProfil(profil || 'continu', reapprovisionnable)"), 'transmission du 2e argument introuvable dans repeuplerTypes');
});

testSync('NEXUS-Inventaire-v1.html — demarrerReceptionRapide exclut les produits reapprovisionnable=false du catalogue réception', () => {
  const debut = srcEmploye.indexOf('async function demarrerReceptionRapide');
  const fin = srcEmploye.indexOf('async function', debut + 10);
  const bloc = srcEmploye.slice(debut, fin === -1 ? debut + 2000 : fin);
  assert.ok(bloc.includes('reapprovisionnableParProduit = await chargerReapprovisionnableParProduit(catalogueComplet);'), 'chargement de la map introuvable dans demarrerReceptionRapide');
  assert.ok(bloc.includes("reapprovisionnableParProduit[p.id] !== false"), 'filtre d\'exclusion introuvable dans demarrerReceptionRapide');
});

// ------------------------------------------------------------
// CÂBLAGE RÉEL — NEXUS-Parametres-Inventaire-v1.html (retrait UI des 3
// champs sans consommateur, conservation des 2 champs branchés)
// ------------------------------------------------------------

const srcParametres = lireSource('NEXUS-Parametres-Inventaire-v1.html');

testSync('NEXUS-Parametres-Inventaire-v1.html — les 3 checkboxes retirées (produit ET catégorie) n\'existent plus', () => {
  const idsRetires = [
    'profilValidationManager', 'profilComptageMasque', 'profilPhotoObligatoire',
    'catProfilValidationManager', 'catProfilComptageMasque', 'catProfilPhotoObligatoire',
  ];
  idsRetires.forEach(id => {
    assert.ok(!srcParametres.includes(`id="${id}"`), `la checkbox #${id} ne doit plus exister dans le HTML`);
    assert.ok(!srcParametres.includes(`getElementById('${id}')`), `le listener sur #${id} ne doit plus exister`);
  });
});

testSync('NEXUS-Parametres-Inventaire-v1.html — les 2 champs branchés restent présents (produit ET catégorie), avec leur listener', () => {
  const idsConserves = [
    ['regleReapprovisionnable', 'profilEnEdition.reapprovisionnable'],
    ['profilControleAleatoire', 'profilEnEdition.controle_aleatoire'],
    ['catRegleReapprovisionnable', 'categorieRegleEnEdition.reapprovisionnable'],
    ['catProfilControleAleatoire', 'categorieRegleEnEdition.controle_aleatoire'],
  ];
  idsConserves.forEach(([id, affectation]) => {
    assert.ok(srcParametres.includes(`id="${id}"`), `la checkbox #${id} doit rester présente`);
    assert.ok(srcParametres.includes(affectation), `l'affectation ${affectation} (listener #${id}) doit rester présente`);
  });
});

testSync('NEXUS-Parametres-Inventaire-v1.html — la donnée sous-jacente des 3 champs retirés continue de transiter (construction/sauvegarde), jamais effacée', () => {
  // Pass-through volontairement préservé : construireProfilEnEdition,
  // l'équivalent catégorie, et la duplication produit doivent encore citer
  // ces 3 champs, sinon une valeur existante en base serait perdue au
  // premier enregistrement (Article 5 : jamais une donnée réelle altérée
  // faute de contrôle visible).
  const occurrencesValidation = (srcParametres.match(/validation_manager_requise/g) || []).length;
  const occurrencesMasque = (srcParametres.match(/comptage_masque/g) || []).length;
  const occurrencesPhoto = (srcParametres.match(/photo_obligatoire/g) || []).length;
  assert.ok(occurrencesValidation >= 2, `validation_manager_requise doit encore transiter (construction+sauvegarde), trouvé ${occurrencesValidation}`);
  assert.ok(occurrencesMasque >= 2, `comptage_masque doit encore transiter, trouvé ${occurrencesMasque}`);
  assert.ok(occurrencesPhoto >= 2, `photo_obligatoire doit encore transiter, trouvé ${occurrencesPhoto}`);
});

testSync('NEXUS-Parametres-Inventaire-v1.html — le mécanisme séparé "Mode de comptage à l\'aveugle" (inventaire_modes_controle) n\'a pas été touché', () => {
  assert.ok(srcParametres.includes("inventaire_modes_controle"), 'la table inventaire_modes_controle doit rester référencée (mécanisme distinct de comptage_masque)');
  assert.ok(srcParametres.includes("Mode de comptage à l'aveugle"), 'le libellé du mécanisme séparé doit rester intact');
});

if (process.exitCode) { console.log('\nDes tests ont échoué.'); }
else { console.log('\nTous les tests sont passés.'); }
