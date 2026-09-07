// Recette navigateur Test — conditionnée aux secrets Test (Gouvernance
// Autonome v2, point 6 du lot NEXUS-GOVERNANCE-AUTONOME-V2).
//
// POURQUOI. La preuve la plus forte reste la navigation réelle, mais elle
// exige des identifiants Test que ce canal ne détient pas forcément. Le
// choix retenu : `npx playwright` à la demande plutôt qu'une dépendance
// commitée — aucun framework externe ajouté au dépôt tant que personne ne
// lance réellement la recette (npx télécharge à l'exécution, jamais au
// clone). Si les secrets Test manquent, ce script NE FAIT PAS ÉCHOUER LA CI :
// il déclare précisément les noms attendus et sort en succès, conforme à
// « rester non bloquant pour les lots sans UI ».
'use strict';

const { execFileSync } = require('child_process');

// Noms minimaux à provisionner dans l'environnement d'exécution (jamais
// commités). PIN/URL Test uniquement — jamais une variable Production.
const SECRETS_REQUIS = [
  'NEXUS_TEST_URL',
  'NEXUS_TEST_PIN_MANAGER',
  'NEXUS_TEST_PIN_EMPLOYE',
];

function secretsManquants(env) {
  return SECRETS_REQUIS.filter(nom => !env[nom] || !String(env[nom]).trim());
}

function executer(env = process.env) {
  const manquants = secretsManquants(env);
  if (manquants.length) {
    return {
      executee: false,
      manquants,
      message: `Recette navigateur Test non exécutée — secrets absents du runner : ${manquants.join(', ')}. ` +
        'Provisionner ces noms (Test uniquement, jamais Production) pour l\'activer. Non bloquant.',
    };
  }
  try {
    execFileSync('npx', ['--yes', 'playwright', '--version'], { stdio: 'pipe' });
  } catch (err) {
    return {
      executee: false,
      manquants: [],
      message: `Recette navigateur Test non exécutée — npx/playwright indisponible dans cet environnement (${err.message}). Non bloquant.`,
    };
  }
  // Le scénario réel (login PIN Test, carte "Prochaine commande", etc.) est
  // un spec Playwright distinct, hors périmètre de ce lot gouvernance/CI —
  // ce module ne fait que garantir la précondition (secrets + outillage
  // disponibles) sans écrire de test applicatif à sa place.
  return {
    executee: true,
    manquants: [],
    message: 'Précondition recette navigateur Test satisfaite (secrets présents, playwright disponible via npx). Spec applicatif à écrire séparément par le lot produit concerné.',
  };
}

module.exports = { SECRETS_REQUIS, secretsManquants, executer };

if (require.main === module) {
  const resultat = executer(process.env);
  console.log(resultat.message);
  process.exit(0);
}
