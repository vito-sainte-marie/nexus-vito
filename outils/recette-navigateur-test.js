#!/usr/bin/env node
'use strict';
// Recette navigateur NEXUS Test — la preuve UI, sans saisie humaine de PIN.
//
// POURQUOI. Jusqu'au 07/09/2026, prouver qu'un écran affiche la bonne valeur
// demandait que Frédéric ouvre un navigateur et tape un PIN. La preuve était
// donc rare, tardive, et jamais rejouée — c'est exactement ainsi que CARB-004
// a pu vivre un lot entier en étant mort à l'écran : le moteur était prouvé,
// l'écran ne l'était pas.
//
// Le PIN existe déjà là où il faut : dans des secrets GitHub dédiés par
// profil, injectés au runner et illisibles ailleurs. Ce qui manquait n'était
// pas l'accès, c'était ce fichier.
//
// Jusqu'au 08/09/2026, les quatre comptes de recette (Manager, Créateur,
// Employé A, Employé B) partageaient un seul secret NEXUS_TEST_PIN. Frédéric
// a depuis attribué un PIN distinct à chaque compte : partager un secret
// entre profils qui n'ont pas la même autorisation (Créateur vs Manager) est
// une friction de moindre-privilège inutile dès qu'on peut l'éviter. Chaque
// profil consomme désormais son propre secret, par son NOM.
//
// LE PIN NE DOIT JAMAIS SORTIR D'ICI. Il n'est ni journalisé, ni inclus dans
// un message d'erreur, ni écrit dans une capture. Playwright reçoit la valeur
// et rien d'autre ne la voit. Si vous ajoutez une trace, vérifiez d'abord
// qu'elle ne peut pas la contenir.
//
// NON BLOQUANT SI LES SECRETS MANQUENT (règle ENV-003 : une capacité Test
// optionnelle indisponible dégrade explicitement, elle ne tue pas le lot).
// En revanche, si les secrets SONT là et que la recette échoue, elle échoue —
// une preuve qui s'excuse ne prouve rien.
//
//   node outils/recette-navigateur-test.js
//
// Environnement attendu :
//   NEXUS_TEST_URL                 (ex. https://nexus-test-ddf.pages.dev)
//   NEXUS_TEST_MANAGER_NOM         le NOM de l'employé, pas son username.
//                                  Le champ est étiqueté « Prénom » à l'écran,
//                                  mais la fonction `nexus_identifiant_de_connexion`
//                                  résout sur `employees.nom` — vérifié en base
//                                  le 07/09/2026 : 'manager-test' rend NULL,
//                                  'Manager Test' rend 'manager-test'.
//                                  Le rail passait un username : la recette
//                                  échouait sur « Prénom ou code PIN incorrect »
//                                  et le PIN était soupçonné à tort.
//   NEXUS_TEST_MANAGER_PIN         secret dédié au compte Manager Test — jamais affiché.
//   NEXUS_TEST_CREATEUR_NOM        le NOM du compte Créateur de recette.
//   NEXUS_TEST_CREATEUR_PIN        secret dédié au compte Créateur Test — jamais affiché.
//
// Deux secrets supplémentaires existent côté GitHub mais ne sont PAS encore
// consommés par cette recette : NEXUS_TEST_EMPLOYEE_A_PIN et
// NEXUS_TEST_EMPLOYEE_B_PIN. Aucun scénario de ce fichier n'exerce
// aujourd'hui un compte Employé — les ajouter à SECRETS_REQUIS sans
// scénario derrière fabriquerait une preuve vide. Ils attendent le lot qui
// écrira ce scénario.

const path = require('path');

const SECRETS_REQUIS = ['NEXUS_TEST_URL', 'NEXUS_TEST_MANAGER_NOM', 'NEXUS_TEST_CREATEUR_NOM', 'NEXUS_TEST_MANAGER_PIN', 'NEXUS_TEST_CREATEUR_PIN'];
const ECRAN_CARBURANTS = 'NEXUS-Carburants-Pilotage-v1.html';
const ECRAN_LIVE = 'NEXUS-Live-Developpement-v1.html';

function secretsManquants(env) {
  return SECRETS_REQUIS.filter(n => !env[n] || !String(env[n]).trim());
}

// Les attentes de la recette. Elles ne sont PAS des constantes décoratives :
// elles décrivent le scénario semé par outils/recette-carburants-test.sql, et
// une divergence doit se lire comme un échec, jamais s'ajuster au résultat.
const ATTENDU = {
  total: 36000,
  reliquatRecupereL: 1000,
  carburantCredite: 'go',
  carburantRefuse: 'sp95',
  motifRefus: /[Cc]apacité disponible/,
};

// L'identité de la version RÉELLEMENT servie, lue dans nexus-build.js.
// (Et non nexus-generation.json, qui n'a jamais existé — dix minutes perdues
// le 05/09 à interroger une URL imaginaire.)
function extraireCommitServi(source) {
  const m = String(source).match(/commit:\s*'([0-9a-f]{7,40})'/);
  return m ? m[1] : null;
}

// Cloudflare Pages déploie de façon asynchrone. Lancer la recette dès le push
// testerait la version PRÉCÉDENTE — exactement ce que `decision-2.md` du lot
// CARB-004 interdit : « aucune preuve UI sur une version qui ne contient pas
// le correctif ». On attend donc que la version servie soit celle qu'on teste,
// et si elle ne vient pas, on le DIT plutôt que de prouver autre chose.
async function attendreVersionServie(base, commitAttendu, timeoutMs = 240000, pasMs = 15000) {
  const url = new URL('nexus-build.js', base).href;
  const limite = Date.now() + timeoutMs;
  let vu = null;
  while (Date.now() < limite) {
    try {
      const reponse = await fetch(url, { cache: 'no-store' });
      vu = extraireCommitServi(await reponse.text());
      if (vu && commitAttendu.startsWith(vu)) return { servie: true, commit: vu };
    } catch (e) { /* déploiement en cours, on repasse */ }
    await new Promise(r => setTimeout(r, pasMs));
  }
  return { servie: false, commit: vu };
}

async function connecter(page, base, identifiant, pin) {
  await page.goto(new URL('NEXUS-Login-v1.html', base).href, { waitUntil: 'domcontentloaded' });
  // Sélection par type et par ordre plutôt que par un id qui n'existe pas :
  // l'écran de connexion expose un champ texte puis un champ mot de passe.
  await page.locator('input[type="text"], input:not([type])').first().fill(identifiant);
  await page.locator('input[type="password"]').first().fill(pin);
  await page.getByRole('button', { name: /se connecter/i }).click();

  // Première version : `Promise.all([waitForLoadState('networkidle'), click()])`
  // puis lecture de l'URL. C'était une course, pas une attente — `networkidle`
  // se résout avant que l'aller-retour d'authentification ait abouti, et
  // l'échec remontait « connexion refusée » trois secondes après le clic, en
  // accusant le PIN pour un simple retard. On attend maintenant l'événement
  // qu'on veut réellement : quitter l'écran de connexion.
  try {
    await page.waitForURL(u => !/NEXUS-Login/i.test(u.href), { timeout: 30000 });
  } catch (e) {
    // `innerText` ne contient jamais la valeur d'un champ de saisie : le
    // message rapporté ici ne peut pas transporter le PIN.
    const visible = (await page.locator('body').innerText().catch(() => '') || '')
      .split('\n').map(l => l.trim()).filter(Boolean).slice(0, 12).join(' / ');
    throw new Error('Connexion refusée : toujours sur l\'écran de login 30 s après validation. ' +
      'Identifiant inconnu, secret de recette périmé, ou compte désactivé.\n  Écran : ' + visible);
  }
}

// Lit l'objet RÉELLEMENT produit par la chaîne de l'écran, pas le texte
// affiché : le texte peut être juste pour de mauvaises raisons (arrondi vers
// le haut plutôt que récupération du reliquat, par exemple — c'est
// exactement ce qui a failli passer le 07/09).
async function lireRecommandation(page, base) {
  await page.goto(new URL(ECRAN_CARBURANTS, base).href, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => typeof NexusCarburantCommandeDonnees === 'object' && typeof nexusClient === 'object'
      && typeof SITE_ID !== 'undefined' && typeof FUSEAU_STATION !== 'undefined',
    null, { timeout: 30000 });

  const p0 = await page.evaluate(() => typeof NexusCarburantsP0 !== 'undefined' && NexusCarburantsP0.actif === true);
  if (!p0) throw new Error('La couche P0 n\'est pas installée sur l\'écran : la recette n\'exercerait pas la chaîne réelle.');

  return page.evaluate(async () => {
    const r = await NexusCarburantCommandeDonnees.evaluerCommandeCarburantSite(
      nexusClient, SITE_ID, { timezone: FUSEAU_STATION });
    const c = r && r.commandeRecommandee;
    return {
      ok: !!(r && r.ok),
      site: SITE_ID,
      commit: (typeof NexusBuild !== 'undefined' && NexusBuild && NexusBuild.commitCourt) || null,
      total: c ? c.total : null,
      volumes: c ? c.volumes : null,
      reliquatArrondi: c ? c.reliquatArrondi : null,
      optimiseurBrut: r && r.optimisation ? { volumesRetenus: r.optimisation.volumesRetenus, total: r.optimisation.total } : null,
      texteCommande: (document.body.innerText.match(/Commande recommandée[^\n]*/) || [null])[0],
    };
  });
}

function verifier(vu) {
  const echecs = [];
  if (!vu.ok || vu.total == null) {
    echecs.push('L\'écran ne produit aucune recommandation. Si le motif est « données insuffisantes », ' +
      'la base Test n\'est pas semée : exécuter outils/recette-carburants-test.sql avant la recette.');
    return echecs;
  }
  if (vu.total !== ATTENDU.total) echecs.push(`total ${vu.total} L, attendu ${ATTENDU.total} L`);

  const rel = vu.reliquatArrondi;
  if (!rel) {
    echecs.push('reliquatArrondi absent de commandeRecommandee — la traversée de la couche P0 est rompue.');
  } else {
    if (rel.recupereL !== ATTENDU.reliquatRecupereL) {
      echecs.push(`reliquat récupéré ${rel.recupereL} L, attendu ${ATTENDU.reliquatRecupereL} L. ` +
        'Un total juste sans récupération signifierait que les 36 000 L viennent d\'ailleurs — ' +
        'd\'un arrondi vers le haut, par exemple — et ne prouverait pas CARB-004.');
    }
    if ((rel.parCarburant || {})[ATTENDU.carburantCredite] !== ATTENDU.reliquatRecupereL) {
      echecs.push(`le compartiment récupéré doit être crédité à ${ATTENDU.carburantCredite}, ` +
        `vu : ${JSON.stringify(rel.parCarburant)}`);
    }
    const motif = (rel.motifs || {})[ATTENDU.carburantRefuse];
    if (!motif) echecs.push(`${ATTENDU.carburantRefuse} doit porter un motif de refus explicite, pas un silence.`);
    else if (!ATTENDU.motifRefus.test(motif)) echecs.push(`le motif de refus doit nommer la capacité, vu : ${motif}`);
  }
  return echecs;
}


// Un ÉCHEC sur données non semées ne s'impute pas au moteur.
//
// Distinction de la même famille que « compte inconnectable » contre « accès
// refusé ». Le 08/09/2026 le semis n'a pas pu s'exécuter — base Test
// injoignable en IPv6 depuis le runner — et la recette a jugé des données
// dérivées, puis conclu que CARB-004 n'était pas prouvé. L'accusation était
// fausse : le fait réel est qu'on n'a pas maîtrisé l'entrée.
//
// La preuve est alors déclarée MANQUANTE — jamais satisfaite par défaut, et
// jamais transformée en régression. Un SUCCÈS sur données non semées reste en
// revanche une observation vraie : l'écran a bel et bien produit ces chiffres.
// « Le semis a-t-il eu lieu ? » est une question à laquelle on répond OUI
// seulement sur une affirmation explicite. Toute autre valeur — absente, vide,
// « 0 », « true », un héritage d'un run précédent — vaut NON. Fonction séparée
// et exportée : la lire depuis `executer()` la rendait inéprouvable, et une
// mutation la remplaçant par `true` y a survécu sans que rien ne bronche.
function semisEffectue(env) {
  return (env || {}).NEXUS_SEMIS_FAIT === '1';
}

function jugerCarburants(echecsCarburants, semisFait) {
  if (semisFait || echecsCarburants.length === 0) {
    return { echecs: echecsCarburants, indisponibilite: null };
  }
  return {
    echecs: [],
    indisponibilite: 'Jeu de recette NON semé (ENV-003) : la base Test n\'a pas pu être préparée avant ce '
      + 'passage. L\'écran a donc été jugé sur des données dérivées, et il s\'en écarte — '
      + `${echecsCarburants.length} écart(s) : ${echecsCarburants.join(' ; ')} `
      + 'Cet écart n\'est PAS imputable au moteur et ne vaut pas régression. '
      + 'LA PREUVE UI CARBURANTS RESTE NON SATISFAITE. Correctif : SEC-014 au Backlog.',
  };
}

// ── NEXUS Live : les deux moitiés de la preuve d'accès ──────────────────
//
// Le MVP n'avait qu'une recette NÉGATIVE : on savait prouver qu'un manager
// n'entre pas. C'est la moitié rassurante et la moins utile — un écran cassé
// qui refuse tout le monde la passerait aussi. La preuve qui manquait est la
// POSITIVE : que le Créateur entre, et qu'il VOIT quelque chose. Les deux sont
// donc exigées ici, dans la même exécution, avec des sessions distinctes.
async function observerLive(navigateur, base, nom, pin) {
  const contexte = await navigateur.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await contexte.newPage();
  try {
    await connecter(page, base, nom, pin);
    await page.goto(new URL(ECRAN_LIVE, base).href, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
      const r = document.getElementById('root');
      return r && r.innerText.trim().length > 0;
    }, null, { timeout: 30000 });
    // `return await`, et non `return` : dans un `try`/`finally`, le `finally`
    // s'exécute AU MOMENT du return, pas après. Sans `await`, la fermeture du
    // contexte et l'évaluation dans la page partaient en course — et la
    // recette gagnait cette course la plupart du temps. Le 08/09/2026 elle
    // l'a perdue : « Target page, context or browser has been closed ». Une
    // preuve qui dépend d'un ordonnancement n'est pas une preuve.
    return await page.evaluate(() => {
      const texte = document.getElementById('root').innerText;
      return {
        texte: texte.slice(0, 400),
        // Détecté sur le CODE de refus, jamais sur la prose. Première
        // version : chercher « refus », « accès », « non autorisé ». L'écran
        // dit en réalité « Cet écran est réservé au Créateur NEXUS » — aucun
        // de ces mots — et la recette a donc accusé d'une fuite d'accès un
        // contrôle qui fonctionnait parfaitement. Un juge qui lit la prose
        // juge le vocabulaire ; les codes de `motifRefusLive` sont un
        // contrat, et ils ne changeront pas au gré d'une reformulation.
        refuse: /capacite_createur_absente|session_absente|module_acces_indisponible/.test(texte),
        evenementsAffiches: (document.querySelectorAll('[data-evenement], .timeline-item, .card').length),
        contientTimeline: /Timeline/i.test(texte),
      };
    });
  } finally {
    await contexte.close();
  }
}

function verifierLive(createur, manager) {
  const echecs = [];
  // `createur === null` signifie « pas d'observation », pas « refusé ». On ne
  // porte alors aucun jugement sur l'écran : l'indisponibilité est rapportée
  // ailleurs, en clair.
  if (createur && (createur.refuse || !createur.contientTimeline)) {
    echecs.push('Le Créateur doit ENTRER et voir la timeline. Vu : ' + createur.texte.replace(/\s+/g, ' ').slice(0, 200));
  }
  if (!manager.refuse) {
    echecs.push('Un manager ne doit PAS accéder à NEXUS Live. Vu : ' + manager.texte.replace(/\s+/g, ' ').slice(0, 200));
  }
  return echecs;
}

async function executer(env = process.env) {
  const manquants = secretsManquants(env);
  if (manquants.length) {
    return { executee: false, bloquant: false,
      message: `Recette navigateur Test non exécutée — absents du runner : ${manquants.join(', ')}. ` +
        'Dégradation explicite (ENV-003), non bloquante. La preuve UI reste donc NON satisfaite.' };
  }

  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) {
    return { executee: false, bloquant: false,
      message: 'Recette navigateur Test non exécutée — playwright absent de cet environnement. ' +
        'Non bloquant. En CI : `npm install --no-save playwright && npx playwright install --with-deps chromium`.' };
  }

  const base = env.NEXUS_TEST_URL.replace(/\/?$/, '/');

  if (env.NEXUS_COMMIT_ATTENDU) {
    const v = await attendreVersionServie(base, env.NEXUS_COMMIT_ATTENDU);
    if (!v.servie) {
      return { executee: false, bloquant: false,
        message: `Recette navigateur Test non exécutée — NEXUS Test sert encore ${v.commit || 'une version illisible'}, ` +
          `pas ${env.NEXUS_COMMIT_ATTENDU.slice(0, 7)}. Prouver sur une version qui n'est pas celle testée ne prouverait rien ` +
          '(decision-2.md du lot CARB-004). Non bloquant : le déploiement Cloudflare est asynchrone.' };
    }
    console.log(`Version servie confirmée : ${v.commit}`);
  }

  const navigateur = await chromium.launch();
  try {
    const page = await navigateur.newPage({ viewport: { width: 1280, height: 900 } });
    await connecter(page, base, env.NEXUS_TEST_MANAGER_NOM, env.NEXUS_TEST_MANAGER_PIN);
    const vu = await lireRecommandation(page, base);
    const echecsCarburants = verifier(vu);

    const semisFait = semisEffectue(env);
    const jugement = jugerCarburants(echecsCarburants, semisFait);
    const echecs = jugement.echecs;
    const carburantsNonAttribuable = jugement.indisponibilite;

    // NEXUS Live — accès positif Créateur, puis refus manager.
    //
    // Un compte de recette INCONNECTABLE et un écran qui REFUSE le Créateur
    // sont deux choses opposées, et les confondre serait grave dans les deux
    // sens. Le 07/09/2026, `test-createur` existait dans `employees` mais
    // n'avait aucune identité `auth.users` : la connexion échouait avant même
    // d'atteindre l'écran. Traiter cela comme « accès refusé » accuserait le
    // contrôle d'accès d'un défaut qu'il n'a pas ; le traiter comme un succès
    // serait pire encore. C'est une capacité Test indisponible au sens
    // ENV-003 : non bloquante, mais la preuve positive est alors déclarée
    // MANQUANTE — jamais satisfaite par défaut.
    const manager = await observerLive(navigateur, base, env.NEXUS_TEST_MANAGER_NOM, env.NEXUS_TEST_MANAGER_PIN);
    let createur = null;
    let createurIndisponible = null;
    try {
      createur = await observerLive(navigateur, base, env.NEXUS_TEST_CREATEUR_NOM, env.NEXUS_TEST_CREATEUR_PIN);
    } catch (e) {
      createurIndisponible = `Compte Créateur de recette « ${env.NEXUS_TEST_CREATEUR_NOM} » non connectable : `
        + 'il existe dans `employees` mais sans identité `auth.users`. '
        + 'La PREUVE D\'ACCÈS POSITIVE À NEXUS LIVE RESTE NON SATISFAITE. '
        + 'Créer ce compte demande de fixer un PIN — geste humain, hors périmètre de Claude.';
    }
    const echecsLive = createur ? verifierLive(createur, manager) : verifierLive(null, manager);

    const indisponibilites = [carburantsNonAttribuable, createurIndisponible].filter(Boolean);
    return { executee: true, bloquant: (echecs.length + echecsLive.length) > 0,
      vu, echecs: echecs.concat(echecsLive), semisFait, indisponibilites,
      live: { createur, manager } };
  } finally {
    await navigateur.close();
  }
}

module.exports = { SECRETS_REQUIS, secretsManquants, verifier, verifierLive, jugerCarburants, semisEffectue, extraireCommitServi, ATTENDU, executer };

if (require.main === module) {
  executer().then(r => {
    if (!r.executee) { console.log(r.message); process.exit(0); }
    console.log(`Recette navigateur NEXUS Test — site ${r.vu.site}, version servie ${r.vu.commit || 'inconnue'}`);
    console.log(`  ${r.vu.texteCommande || '(ligne de commande recommandée introuvable dans le texte)'}`);
    console.log(`  optimiseur brut : ${JSON.stringify(r.vu.optimiseurBrut)}`);
    console.log(`  après arrondi   : ${JSON.stringify(r.vu.volumes)} = ${r.vu.total} L`);
    console.log(`  reliquat        : ${JSON.stringify(r.vu.reliquatArrondi)}`);
    for (const i of r.indisponibilites || []) console.log('\n  INDISPONIBLE — ' + i);
    if (!r.bloquant) {
      // Énumérer ce qui est prouvé ET ce qui ne l'est pas. Une ligne unique
      // « preuve satisfaite » se lit comme un quitus général, alors qu'il peut
      // manquer la moitié de la démonstration.
      console.log('\nCe qui est prouvé, et ce qui ne l\'est pas :');
      console.log('  · UI Carburants (CARB-004) : '
        + (r.semisFait === false && (r.indisponibilites || []).some(i => /Jeu de recette NON semé/.test(i))
          ? 'NON SATISFAITE — jeu de recette non semé'
          : 'satisfaite'));
      console.log('  · Accès Live REFUSÉ au manager : satisfaite');
      console.log('  · Accès Live ACCORDÉ au Créateur : '
        + ((r.live && r.live.createur) ? 'satisfaite' : 'NON SATISFAITE — voir ci-dessus'));
      process.exit(0);
    }
    console.error('\nÉCHEC de la recette navigateur :');
    for (const e of r.echecs) console.error('  - ' + e);
    process.exit(1);
  }).catch(e => {
    // Le message d'erreur ne doit jamais contenir de valeur saisie.
    console.error('ÉCHEC de la recette navigateur : ' + e.message);
    process.exit(1);
  });
}
