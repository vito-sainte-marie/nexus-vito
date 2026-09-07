// Recette navigateur — preuve négative d'accès Créateur sur NEXUS Test.
// Lot NEXUS-LIVE-CONTROL-CENTER-1-20260906, spec-1.md §7.
//
// Script à usage unique pour cette session (pas un test de non-régression
// permanent — dépend d'un navigateur téléchargé et de secrets d'exécution).
// Ne journalise jamais NEXUS_TEST_PIN ; seuls des booléens/faits dérivés
// sont imprimés.
//
// Vérifie, contre le déploiement NEXUS Test réel (NEXUS_TEST_URL) :
//  1) accès direct (sans session) à un écran déjà gardé Créateur -> redirigé login ;
//  2) manager-test authentifié -> je_suis_createur() = false, écran verrouillé ;
//  3) employe-test-a authentifié -> je_suis_createur() = false, écran verrouillé ;
//  4) aucune valeur sensible (PIN) n'apparaît dans les journaux produits ici.

const { chromium } = require('playwright');

const URL_TEST = process.env.NEXUS_TEST_URL;
// Le formulaire de connexion NEXUS résout le "prénom" saisi vers un
// username technique via employees_public.nom (NEXUS-Login-v1.html) : ce
// n'est donc pas le username lui-même qu'il faut saisir, mais le nom
// affiché. Les noms affichés (Manager Test / Employé Test A) ont été
// communiqués explicitement dans l'issue #28 (réveil du 2026-09-07T00:36Z)
// aux côtés des usernames techniques (manager-test / employe-test-a) —
// aucune valeur n'est devinée ici.
const MANAGER_NOM = 'Manager Test';
const EMPLOYE_A_NOM = 'Employé Test A';
const PIN = process.env.NEXUS_TEST_PIN;

if (!URL_TEST || !PIN) {
  console.log(JSON.stringify({ executable: false, motif: 'variables_environnement_test_absentes' }));
  process.exit(0);
}

// Le login NEXUS résout le "prénom" affiché vers un username technique via
// employees_public.nom (NEXUS-Login-v1.html). Les usernames injectés
// (manager-test, employe-test-a) sont des identifiants techniques : on
// tente donc le login en les utilisant directement comme "prénom" saisi,
// ce que fera échouer la résolution si `nom` diffère du username — dans ce
// cas le script le signale explicitement plutôt que de deviner une valeur.

async function tenterConnexion(page, prenomSaisi) {
  await page.goto(`${URL_TEST}/NEXUS-Login-v1.html`, { waitUntil: 'networkidle' });
  await page.fill('#prenom', prenomSaisi);
  await page.fill('#pin', PIN);
  await page.click('#connexion');
  // On attend soit la navigation post-connexion, soit l'apparition du
  // message d'erreur — jamais un délai fixe qui pourrait couper court à
  // une réponse réseau lente (Auth Supabase Test).
  await Promise.race([
    page.waitForURL(/NEXUS-App-v1/, { timeout: 10000 }).catch(() => {}),
    page.locator('#errorConnexion').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
  ]);
  await page.waitForTimeout(500);
  const url = page.url();
  const erreurVisible = await page.locator('#errorConnexion').isVisible().catch(() => false);
  const texteErreur = erreurVisible ? (await page.locator('#errorConnexion').textContent().catch(() => '')) : null;
  const boutonTexte = await page.locator('#connexion').textContent().catch(() => null);
  return { connecte: /NEXUS-App-v1/.test(url), urlFinale: url, erreur: texteErreur, boutonTexte };
}

async function estCreateur(page) {
  return page.evaluate(async () => {
    try {
      // eslint-disable-next-line no-undef
      const { data, error } = await nexusClient.rpc('je_suis_createur');
      return { ok: !error, valeur: data, erreur: error ? error.message : null };
    } catch (e) {
      return { ok: false, valeur: null, erreur: String(e && e.message || e) };
    }
  });
}

async function ecranCreateurVerrouille(page) {
  await page.goto(`${URL_TEST}/NEXUS-Debug-Createur-v1.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const url = page.url();
  const verrouille = await page.locator('.locked').isVisible().catch(() => false);
  const texteVerrou = verrouille ? await page.locator('.locked').textContent().catch(() => '') : null;
  return { redirigeLogin: /NEXUS-Login-v1(\.html)?(\?|$)/.test(url), verrouille, texteVerrou, urlFinale: url };
}

(async () => {
  const resultats = { executable: true };
  const browser = await chromium.launch();
  try {
    // 1) Accès direct sans session -> doit rediriger vers le login (fail closed).
    let page = await browser.newPage();
    resultats.acces_direct_sans_session = await ecranCreateurVerrouille(page);
    await page.close();

    // 2) manager-test.
    page = await browser.newPage();
    const loginManager = await tenterConnexion(page, MANAGER_NOM);
    resultats.login_manager_test = { connecte: loginManager.connecte, erreur: loginManager.erreur, boutonTexte: loginManager.boutonTexte, urlFinale: loginManager.urlFinale };
    if (loginManager.connecte) {
      resultats.ecran_createur_manager_test = await ecranCreateurVerrouille(page);
      resultats.je_suis_createur_manager_test = await estCreateur(page);
    }
    await page.close();

    // 3) employe-test-a.
    page = await browser.newPage();
    const loginEmploye = await tenterConnexion(page, EMPLOYE_A_NOM);
    resultats.login_employe_test_a = { connecte: loginEmploye.connecte, erreur: loginEmploye.erreur, boutonTexte: loginEmploye.boutonTexte, urlFinale: loginEmploye.urlFinale };
    if (loginEmploye.connecte) {
      resultats.ecran_createur_employe_test_a = await ecranCreateurVerrouille(page);
      resultats.je_suis_createur_employe_test_a = await estCreateur(page);
    }
    await page.close();
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify(resultats, null, 2));
})();
