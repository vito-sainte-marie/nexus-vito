// Test — Refonte du modèle de statuts FDJ (21/08/2026, demande de Frédéric) :
// "Ça ne devrait pas être librement contradictoire" (cas réel observé :
// écart +1,00 € avec verdict "Conforme" enregistré côté caisse).
//
// Règles vérifiées ici (nexus-fdj-moteur.js, fonctions pures) :
//   Si écart = 0        -> seul "Conforme" est proposable.
//   Si écart ≠ 0        -> "Conforme" n'est plus proposable, seulement
//                          "Conforme avec écart justifié" / "Écart à régulariser".
//   État du quart        -> jamais "Contrôlé/Clôturé" tant que la saisie
//                          n'est pas validée, jamais si le verdict retenu
//                          est incohérent avec l'écart actuel.
//
// nexus-fdj-moteur.js est un IIFE qui s'attache à globalThis.NexusFdjMoteur
// dès qu'il est require()-é — aucun mock nécessaire, ce sont les vraies
// fonctions pures testées ici.

require(__dirname + '/nexus-fdj-moteur.js');
const assert = require('assert');
const M = globalThis.NexusFdjMoteur;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) optionsVerdictControleFdj — le menu proposé dépend de l'écart.
// ------------------------------------------------------------

let optsZero = M.optionsVerdictControleFdj(0);
assert.strictEqual(optsZero.length, 1, 'Écart nul : une seule option proposée');
assert.strictEqual(optsZero[0].value, 'conforme', 'Écart nul : seule option = Conforme');
ok('écart=0 -> une seule option, "Conforme"');

let optsNull = M.optionsVerdictControleFdj(null);
assert.strictEqual(optsNull.length, 1);
assert.strictEqual(optsNull[0].value, 'conforme');
ok('écart=null (pas encore calculé) traité comme écart=0 -> "Conforme" seul');

let optsPositif = M.optionsVerdictControleFdj(1.00);
assert.strictEqual(optsPositif.some(o => o.value === 'conforme'), false, 'Écart ≠ 0 : "Conforme" ne doit plus être proposé');
assert.strictEqual(optsPositif.some(o => o.value === 'avec_ecart'), true, 'Écart ≠ 0 : "avec_ecart" proposé');
assert.strictEqual(optsPositif.some(o => o.value === 'a_regulariser'), true, 'Écart ≠ 0 : "a_regulariser" proposé');
assert.strictEqual(optsPositif.length, 2, 'Écart ≠ 0 : exactement 2 options, jamais "Conforme"');
ok('écart=+1,00€ -> exclut "Conforme", propose seulement avec_ecart/a_regulariser (cas réel Frédéric)');

let optsNegatif = M.optionsVerdictControleFdj(-2.50);
assert.strictEqual(optsNegatif.some(o => o.value === 'conforme'), false);
assert.strictEqual(optsNegatif.length, 2);
ok('écart négatif : même règle, "Conforme" exclu');

// ------------------------------------------------------------
// 2) verdictCoherentAvecEcart — détecte la contradiction historique.
// ------------------------------------------------------------

assert.strictEqual(M.verdictCoherentAvecEcart('conforme', 1.00), false, 'Le cas réel signalé (écart +1,00€ / verdict Conforme) doit être détecté incohérent');
ok('verdict "Conforme" + écart +1,00€ -> INCOHÉRENT (reproduit le bug signalé par Frédéric)');

assert.strictEqual(M.verdictCoherentAvecEcart('conforme', 0), true);
assert.strictEqual(M.verdictCoherentAvecEcart('avec_ecart', 1.00), true);
assert.strictEqual(M.verdictCoherentAvecEcart('a_regulariser', -3), true);
assert.strictEqual(M.verdictCoherentAvecEcart('avec_ecart', 0), false, 'Un verdict "avec écart" sans écart réel est aussi incohérent');
ok('verdicts cohérents acceptés, incohérences dans les deux sens détectées');

// ------------------------------------------------------------
// 3) deriverStatutCaisseDepuisVerdict — un seul champ pilote la caisse.
// ------------------------------------------------------------

assert.strictEqual(M.deriverStatutCaisseDepuisVerdict('conforme'), 'conforme');
assert.strictEqual(M.deriverStatutCaisseDepuisVerdict('avec_ecart'), 'valide_avec_ecart');
assert.strictEqual(M.deriverStatutCaisseDepuisVerdict('a_regulariser'), 'a_regulariser');
assert.strictEqual(M.deriverStatutCaisseDepuisVerdict(null), 'provisoire', 'Pas de verdict retenu -> statut caisse provisoire, jamais un statut définitif par défaut');
ok('statut de caisse dérivé du verdict, jamais choisi indépendamment');

// ------------------------------------------------------------
// 4) motifEcartObligatoire — "Motif = masqué" si écart nul.
// ------------------------------------------------------------

assert.strictEqual(M.motifEcartObligatoire(0), false);
assert.strictEqual(M.motifEcartObligatoire(null), false);
assert.strictEqual(M.motifEcartObligatoire(1.00), true);
assert.strictEqual(M.motifEcartObligatoire(-0.50), true);
ok('motif obligatoire seulement si écart ≠ 0');

// ------------------------------------------------------------
// 5) etatDuQuartFdj — badge dérivé "État du quart" (lecture seule).
// ------------------------------------------------------------

// Saisie non finalisée -> jamais "Contrôlé"/"Clôturé", quel que soit le verdict.
let etatBrouillon = M.etatDuQuartFdj({ statutShift: 'brouillon', verdictControle: 'conforme', ecart: 0 });
assert.strictEqual(etatBrouillon.code, 'non_controle', 'Saisie en brouillon -> État du quart ne peut pas être Clôturé/Contrôlé');
ok('statutShift=brouillon -> "Non contrôlé", même si un verdict Conforme est déjà renseigné');

// Saisie validée mais aucun verdict retenu -> pas encore contrôlé.
let etatSansVerdict = M.etatDuQuartFdj({ statutShift: 'valide', verdictControle: null, ecart: 0 });
assert.strictEqual(etatSansVerdict.code, 'non_controle');
ok('statutShift=valide sans verdict -> "Non contrôlé" (contrôle manager encore à faire)');

// Saisie validée mais verdict incohérent avec l'écart courant (le cas réel).
let etatIncoherent = M.etatDuQuartFdj({ statutShift: 'valide', verdictControle: 'conforme', ecart: 1.00 });
assert.strictEqual(etatIncoherent.code, 'non_controle', 'Verdict incohérent avec écart -> traité comme non contrôlé, jamais Contrôlé/Clôturé à tort');
ok('statutShift=valide + verdict "Conforme" + écart +1,00€ -> "Non contrôlé" (bloque le cas ambigu signalé)');

// Saisie validée + verdict cohérent Conforme (écart nul) -> Contrôlé.
let etatConforme = M.etatDuQuartFdj({ statutShift: 'valide', verdictControle: 'conforme', ecart: 0 });
assert.strictEqual(etatConforme.code, 'controle');
ok('statutShift=valide + Conforme + écart=0 -> "Contrôlé"');

// Saisie validée + écart justifié -> Clôturé.
let etatCloture = M.etatDuQuartFdj({ statutShift: 'valide', verdictControle: 'avec_ecart', ecart: 1.00 });
assert.strictEqual(etatCloture.code, 'cloture');
ok('statutShift=valide + "Conforme avec écart justifié" -> "Clôturé"');

// Saisie validée + écart à régulariser -> action encore due, jamais confondu avec Clôturé.
let etatARegulariser = M.etatDuQuartFdj({ statutShift: 'valide', verdictControle: 'a_regulariser', ecart: -5 });
assert.strictEqual(etatARegulariser.code, 'a_regulariser');
assert.notStrictEqual(etatARegulariser.code, 'cloture', '"À régulariser" ne doit jamais être confondu avec "Clôturé"');
ok('statutShift=valide + "Écart à régulariser" -> "À régulariser", distinct de "Clôturé"');

// Appel sans argument -> ne doit jamais planter (défensif, comme le reste du moteur FDJ).
let etatVide = M.etatDuQuartFdj();
assert.strictEqual(etatVide.code, 'non_controle');
ok('appel sans argument -> "Non contrôlé", ne plante jamais');

console.log(`\n${n}/${n} tests passés — modèle de statuts FDJ (écart -> verdict -> état du quart).`);
