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
// LE COMPTE EMPLOYÉ A EST DÉSORMAIS EXERCÉ (09/09/2026). Ce fichier disait
// jusqu'ici que NEXUS_TEST_EMPLOYEE_A_PIN et _B_PIN existaient sans usage, et
// qu'ils attendaient « le lot qui écrira ce scénario » — les injecter sans
// scénario derrière aurait fabriqué une preuve vide. Le scénario existe :
//   NEXUS_TEST_EMPLOYEE_A_NOM   le NOM du compte employé de recette.
//   NEXUS_TEST_EMPLOYEE_A_PIN   son secret dédié — jamais affiché.
// Ils restent HORS de SECRETS_REQUIS : leur absence ne doit pas faire tomber
// les preuves déjà acquises (voir SECRETS_EMPLOYE).
//
// NEXUS_TEST_EMPLOYEE_B_PIN attend toujours : aucun scénario n'exerce un
// second employé, et la règle qui valait hier vaut encore aujourd'hui.

const path = require('path');

const SECRETS_REQUIS = ['NEXUS_TEST_URL', 'NEXUS_TEST_MANAGER_NOM', 'NEXUS_TEST_CREATEUR_NOM', 'NEXUS_TEST_MANAGER_PIN', 'NEXUS_TEST_CREATEUR_PIN'];

// Le scénario EMPLOYÉ a ses propres secrets, et ils sont VOLONTAIREMENT hors
// de SECRETS_REQUIS. Les y ajouter ferait dégrader la recette ENTIÈRE le jour
// où ils manqueraient : on perdrait la preuve UI Carburants et les deux preuves
// d'accès Live, déjà acquises le 09/09/2026, pour un scénario qui n'a rien à
// voir. Une capacité optionnelle absente dégrade CE QU'ELLE COUVRE, pas le
// reste (ENV-003).
const SECRETS_EMPLOYE = ['NEXUS_TEST_EMPLOYEE_A_NOM', 'NEXUS_TEST_EMPLOYEE_A_PIN'];
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
        // MARQUEUR DE CONTRAT, pas un libellé. Chercher le mot « Timeline »
        // a cassé la preuve le jour où cette section a été renommée « Ce qui
        // s'est passé » — une preuve qui juge une prose juge un vocabulaire,
        // exactement comme le refus d'accès jugé sur ses mots le 07/09.
        contientTimeline: document.getElementById('root')
          && document.getElementById('root').dataset.nexusLive === 'rendu',
        // Ce que l'écran ANNONCE, et ce qu'il PROPOSE. Les deux sont relevés
        // séparément pour qu'on puisse juger leur cohérence : un écran qui dit
        // « un arbitrage t'attend » sans offrir de quoi répondre laisse
        // Frédéric devant une question sans bouton — le défaut exact qu'il a
        // signalé le 08/09/2026.
        attente: (document.querySelector('[data-attente]') || { dataset: {} }).dataset.attente || null,
        boutonAutoriser: !!document.getElementById('btnAutoriser'),
      };
    });
  } finally {
    await contexte.close();
  }
}

// Vocabulaire FERMÉ. Un état d'attente que la recette ne connaît pas ne doit
// pas passer pour conforme : c'est ainsi qu'un écran modifié cesse silencieuse-
// ment d'être jugé.
const ATTENTES_CONNUES = ['rien', 'arbitrage', 'repondu'];

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
  // COHÉRENCE entre ce qui est annoncé et ce qui est proposé. On ne décrète
  // pas qu'un arbitrage doit être ouvert — cela dépend du journal du moment,
  // et une preuve qui exige un état du monde se met à mentir dès que le monde
  // change. On exige seulement que les deux moitiés de l'écran s'accordent.
  if (createur && !createur.refuse) {
    // `!createur.attente` et non `=== null` : une observation qui ne porte pas
    // du tout le champ vaut `undefined`, et `undefined === null` est faux. Le
    // relevé muet passait donc sans être jugé — exactement le silence que ce
    // contrôle est censé interdire.
    if (!createur.attente) {
      echecs.push('L’écran Live ne déclare pas ce qu’il attend de Frédéric (marqueur `data-attente` absent).');
    }
    if (createur.attente === 'arbitrage' && !createur.boutonAutoriser) {
      echecs.push('Un arbitrage est annoncé mais AUCUN bouton ne permet d’y répondre.');
    }
    if (createur.attente === 'rien' && createur.boutonAutoriser) {
      echecs.push('L’écran annonce que rien n’attend Frédéric, mais propose quand même d’autoriser.');
    }
    // Répondre n'est pas résoudre : une question déjà répondue ne doit pas
    // reproposer le même bouton. Cliquer deux fois n'apprendrait rien de plus
    // et fabriquerait une seconde décision identique.
    if (createur.attente === 'repondu' && createur.boutonAutoriser) {
      echecs.push('La question est déjà répondue, mais l’écran repropose d’autoriser.');
    }
    if (!ATTENTES_CONNUES.includes(createur.attente)) {
      echecs.push(`L’écran déclare un état d’attente inconnu : « ${createur.attente} ». `
        + 'Un état non prévu ne doit pas être jugé conforme par défaut.');
    }
  }
  return echecs;
}


// ─────────────────────────────────────────────────────────────────────────
// SCÉNARIO EMPLOYÉ — prendre son poste, y compris avec un quart déjà ouvert.
//
// POURQUOI IL MANQUAIT, ET POURQUOI IL COMPTE PLUS QUE LES AUTRES.
// Frédéric Bragance, 09/09/2026 : « les employés utilisent NEXUS au
// compte-gouttes […] il ouvre un quart, commence la journée, parfois il ne fait
// rien — ni inventaire, ni missions — et ne referme même pas le quart, car pour
// eux NEXUS ne fonctionne pas correctement. »
//
// Le quart laissé ouvert est donc le comportement ORDINAIRE, pas un accident.
// Or la release 2026.09.1 installe `shifts_un_seul_service_en_cours`, un index
// unique qui interdit deux services ouverts pour un même employé. Un filet
// existe — le déclencheur `nexus_shifts_avant_insertion` clôt le précédent —
// et il a été éprouvé en SQL le 09/09. MAIS PAS À L'ÉCRAN.
//
// C'est la différence qui décide. `NEXUS-Prise-De-Poste-v1.html` insère sans
// rattraper la moindre erreur d'unicité : en cas de refus, l'employé lit
// « Un problème est survenu, réessayez », et réessayer échouera toujours. Une
// preuve SQL ne dit rien de ce que la personne voit ; et ce que la personne
// voit est précisément ce qui décide de l'adoption.
//
// LE SCÉNARIO PREND DONC LE POSTE DEUX FOIS DE SUITE. La première ouvre un
// service ; la seconde est le lendemain de l'employé qui n'a pas fermé. C'est
// la seconde qui prouve quelque chose — la première n'est que sa condition.

const ECRAN_PRISE_DE_POSTE = 'NEXUS-Prise-De-Poste-v1.html';

// Une seule prise de poste, du choix du rôle à l'écran final. Rend un objet
// FACTUEL — jamais un verdict : le jugement est rendu par une fonction pure,
// pour qu'il soit éprouvable sans navigateur.
async function prendreLePoste(page, base) {
  const alertes = [];
  const surDialogue = async (d) => { alertes.push(d.message()); await d.dismiss().catch(() => {}); };
  page.on('dialog', surDialogue);
  try {
    await page.goto(new URL(ECRAN_PRISE_DE_POSTE, base).href, { waitUntil: 'domcontentloaded' });

    const cartes = page.locator('.role-card');
    await cartes.first().waitFor({ timeout: 30000 });
    const nbRoles = await cartes.count();
    if (!nbRoles) return { atteint: 'aucun_role', alertes, role: null };
    // On prend le premier rôle proposé plutôt qu'un rôle codé en dur : le rôle
    // n'est pas le sujet, et l'épingler casserait le scénario au premier
    // changement de catalogue.
    const role = await cartes.first().getAttribute('data-role');
    await cartes.first().click();

    await page.locator('#btnVoirMissions').click();
    const confirmer = page.locator('#btnConfirmer');
    await confirmer.waitFor({ timeout: 30000 });
    await confirmer.click();

    // On attend l'ÉVÉNEMENT voulu — le titre de l'écran final — et non un
    // délai. Un `waitForTimeout` transformerait une lenteur en échec, et c'est
    // exactement l'erreur déjà commise sur `connecter` le 07/09.
    try {
      await page.locator('#titre').filter({ hasText: /Prise de poste confirmée/i })
        .waitFor({ timeout: 30000 });
      return { atteint: 'confirme', alertes, role };
    } catch (e) {
      const titre = (await page.locator('#titre').innerText().catch(() => '') || '').trim();
      return { atteint: 'bloque', alertes, role, titre };
    }
  } finally {
    page.off('dialog', surDialogue);
  }
}

// VERDICT PUR — éprouvable sans navigateur, mutable en microsecondes.
// `premiere` et `seconde` sont les objets rendus par `prendreLePoste`.
function verifierEmploye(premiere, seconde) {
  const echecs = [];
  if (!premiere || !seconde) {
    echecs.push('Scénario employé : observation manquante — on ne conclut pas.');
    return echecs;
  }
  if (premiere.atteint === 'aucun_role') {
    echecs.push('Prise de poste : aucun rôle proposé à l’employé. L’écran ne permet pas de commencer.');
    return echecs;
  }
  if (premiere.atteint !== 'confirme') {
    echecs.push('Prise de poste initiale REFUSÉE' +
      (premiere.alertes.length ? ` — l’écran dit : « ${premiere.alertes[0]} »` : '') +
      '. Un employé ne peut pas commencer sa journée.');
    return echecs;
  }
  // LE POINT QUI COMPTE.
  if (seconde.atteint !== 'confirme') {
    echecs.push('PRISE DE POSTE AVEC UN QUART DÉJÀ OUVERT REFUSÉE' +
      (seconde.alertes.length ? ` — l’écran dit : « ${seconde.alertes[0]} »` : '') +
      '. C’est le comportement ordinaire de l’équipe : la release la mettrait dehors, ' +
      'et « réessayez » ne marchera jamais.');
  }
  if (seconde.alertes.length) {
    echecs.push(`Une alerte est apparue à la seconde prise de poste : « ${seconde.alertes[0]} ». ` +
      'Même si l’écran finit par aboutir, l’employé a vu une erreur.');
  }
  return echecs;
}

async function observerEmploye(navigateur, base, nom, pin) {
  const page = await navigateur.newPage({ viewport: { width: 420, height: 900 } });
  try {
    await connecter(page, base, nom, pin);
    const premiere = await prendreLePoste(page, base);
    const seconde = await prendreLePoste(page, base);
    // Le pointage d'arrivée s'intercale avant l'accueil : on le franchit par le
    // repli prévu par l'écran, sinon l'invitation reste éternellement NON JUGÉE.
    const pointage = await franchirPointageArrivee(page, base).catch(
      (e) => ({ franchi: false, motif: String(e && e.message).split('\n')[0] }));
    // L'invitation se juge APRÈS la prise de poste, parce que c'est là qu'elle
    // vit : « sur l'accueil employé après la prise de poste ».
    // ISOLÉE. L'invitation est le dernier maillon et le plus récent ; une
    // panne chez elle ne doit pas effacer les deux preuves qui précèdent. La
    // leçon du 09/09/2026 : j'avais isolé le scénario employé du reste de la
    // recette, et oublié d'isoler l'invitation du scénario employé.
    let invitation = null;
    try {
      invitation = await observerInvitationInventaire(page, base);
    } catch (e) {
      invitation = { presente: false, etat: null, visible: false, texte: '',
        motif: 'observation impossible : ' + String(e && e.message).split('\n')[0] };
    }
    return { premiere, seconde, invitation, pointage };
  } finally {
    await page.close();
  }
}


// L'INVITATION À L'INVENTAIRE, jugée à l'écran (09/09/2026).
//
// LE PIÈGE QUE CETTE ÉPREUVE ÉVITE. La carte peut être LÉGITIMEMENT absente :
// quand rien n'attend ce rôle, ne rien afficher est le comportement juste. Une
// épreuve qui exigerait sa présence serait rouge les jours calmes ; une épreuve
// qui accepterait son absence ne prouverait rien du tout.
//
// La carte écrit donc sa décision sur elle-même, en trois états — `aucune`,
// `proposee`, `indisponible` — et l'on juge la COHÉRENCE entre ce qu'elle a
// décidé et ce qu'elle montre. C'est vérifiable tous les jours, calmes compris.


// FRANCHIR LE POINTAGE D'ARRIVÉE (09/09/2026)
//
// `nexus-auth.js` impose une séquence : prise de poste, PUIS pointage
// d'arrivée, et seulement ensuite l'accueil. La recette allait droit à
// l'accueil et se faisait renvoyer pointer ; l'invitation à l'inventaire
// restait donc éternellement NON JUGÉE.
//
// ON N'INVENTE AUCUN CONTOURNEMENT. L'écran capture normalement la photo par
// `getUserMedia`, et prévoit DÉJÀ un repli par champ fichier « si getUserMedia
// est indisponible ou refusé — jamais un employé totalement bloqué faute de
// caméra en page ». Un navigateur sans caméra est exactement ce cas. La
// recette emprunte donc le chemin de repli prévu par l'écran, pas une porte
// dérobée.
//
// LA PHOTO EST INCONFONDABLE. `outils/fixtures/photo-pointage-recette.png` est
// un damier rouge et noir de 240x160 portant, dans ses métadonnées, « PHOTO DE
// TEST NEXUS - recette navigateur automatisee. Ne represente aucun lieu reel.
// Ne jamais utiliser comme preuve de presence. » Elle ne ressemble à aucun
// parking et le dit dans son propre fichier.
//
// ELLE N'ÉCRIT QUE SUR TEST, sous le compte de recette. Le pointage réel d'un
// employé n'est jamais touché.

const PHOTO_RECETTE = path.join(__dirname, 'fixtures', 'photo-pointage-recette.png');

async function franchirPointageArrivee(page, base) {
  const url = page.url();
  if (!/Pointage/i.test(url)) {
    await page.goto(new URL('NEXUS-Pointage-v1.html', base).href, { waitUntil: 'domcontentloaded' })
      .catch(() => {});
  }
  const champ = page.locator('#photoInput-arrivee');
  // Le motif porte la page ET ce que l'écran affiche : sans eux, « champ
  // absent » ne localise rien et la session suivante recommence l'enquête.
  const situer = async () => {
    let chemin = page.url();
    try { chemin = new URL(page.url()).pathname.split('/').pop() || chemin; } catch (e) { /* url exotique */ }
    const vu = (await page.locator('body').innerText().catch(() => '') || '')
      .split('\n').map(l => l.trim()).filter(Boolean).slice(0, 6).join(' / ');
    return `page ${chemin} — écran : ${vu.slice(0, 220)}`;
  };
  try {
    await champ.waitFor({ state: 'attached', timeout: 20000 });
  } catch (e) {
    return { franchi: false, motif: 'champ photo d’arrivée absent — ' + (await situer()) };
  }
  try {
    await champ.setInputFiles(PHOTO_RECETTE);
  } catch (e) {
    return { franchi: false, motif: 'dépôt de la photo refusé : ' + String(e && e.message).split('\n')[0] };
  }
  // L'écran téléverse puis réaffiche l'état. On attend l'ÉVÉNEMENT voulu —
  // l'arrivée enregistrée — et non un délai : l'upload peut prendre plus d'une
  // minute sur le réseau de la station, l'écran le dit lui-même.
  try {
    await page.waitForFunction(() => /Arriv[ée]/i.test(document.body.innerText || ''),
      { timeout: 90000 });
    return { franchi: true, motif: null };
  } catch (e) {
    return { franchi: false, motif: 'arrivée non confirmée après dépôt de la photo — ' + (await situer()) };
  }
}

const ECRAN_ACCUEIL = 'NEXUS-App-v1.html';

// TOUT EST LU DANS LA PAGE, EN UNE FOIS, ET RIEN N'ATTEND UN ÉLÉMENT.
//
// Ma première version enchaînait `locator.getAttribute()` et `isVisible()`.
// Playwright attend qu'un élément soit attaché avant de répondre : quand
// l'accueil redirige vers la prise de poste — ce qu'il fait dès qu'il ne
// trouve pas de service actif — la carte disparaît et l'attente court jusqu'au
// bout de son délai. Trente secondes plus tard, l'exception remontait et
// emportait TOUT LE SCÉNARIO EMPLOYÉ avec elle : les deux preuves acquises la
// veille, prise de poste et quart déjà ouvert, sont repassées en « NON
// EXÉCUTÉE ».
//
// On lit donc l'état par une évaluation unique, qui rend un objet ou null et
// n'attend jamais rien.
async function observerInvitationInventaire(page, base) {
  try {
    await page.goto(new URL(ECRAN_ACCUEIL, base).href, { waitUntil: 'domcontentloaded' });
  } catch (e) {
    return { presente: false, etat: null, visible: false, texte: '', motif: 'accueil inatteignable' };
  }
  // La carte part d'« indisponible » et se décide ensuite. On attend un état
  // TRANCHÉ sans jamais l'exiger : rester « indisponible » est une réponse, et
  // la borne est ce qui la distingue d'une lenteur.
  const lire = () => page.evaluate(() => {
    const el = document.getElementById('participationInventaire');
    if (!el) return null;
    return {
      etat: el.getAttribute('data-etat'),
      visible: el.offsetParent !== null || el.style.display !== 'none',
      texte: ((document.getElementById('participationTexte') || {}).textContent || '').trim(),
    };
  }).catch(() => null);

  let vue = null;
  const limite = Date.now() + 20000;
  do {
    vue = await lire();
    if (vue && (vue.etat === 'aucune' || vue.etat === 'proposee')) break;
    if (Date.now() >= limite) break;
    await page.waitForTimeout(500).catch(() => {});
  } while (true);

  // L'accueil redirige vers la prise de poste quand il ne trouve aucun service
  // actif. La carte est alors absente pour une raison qui n'a rien à voir avec
  // elle : on le DIT, plutôt que de le compter comme un défaut de la carte.
  if (!vue) {
    // LE MOTIF PORTE L'URL RÉELLE. Ma première version disait « carte absente
    // du document » sans dire DE QUEL document : la carte est pourtant bien
    // servie — vérifié par une requête directe sur nexus-test — et le message
    // envoyait donc chercher un défaut là où il n'y en avait pas. Un
    // diagnostic qui ne nomme pas ce qu'il a regardé ne diagnostique rien.
    // LE CHEMIN, PAS L'URL ENTIÈRE. Ma version précédente testait l'URL
    // complète et voyait « App-v1 » dans le paramètre `retour=NEXUS-App-v1`
    // d'une redirection vers le pointage : elle concluait « l'accueil est bien
    // affiché, c'est la carte qui manque », et accusait la carte d'un défaut
    // qui n'existait pas. Une chaîne de requête n'est pas une destination.
    const url = page.url();
    let chemin = url;
    try { chemin = new URL(url).pathname.split('/').pop() || url; } catch (e) { /* url exotique */ }
    const motif =
      /Pointage/i.test(chemin)
        ? `le pointage d’arrivée est exigé avant l’accueil (${chemin}) — séquence obligatoire de nexus-auth, et il réclame une photo`
      : /Prise-De-Poste/i.test(chemin) ? `l’accueil a redirigé vers la prise de poste (${chemin}) : aucun service actif`
      : /Login/i.test(chemin) ? `l’accueil a redirigé vers la connexion (${chemin}) : session perdue`
      : /App-v1/i.test(chemin) ? `carte absente alors que l’accueil est bien affiché (${chemin})`
      : `page inattendue après navigation : ${chemin}`;
    return { presente: false, etat: null, visible: false, texte: '', motif };
  }
  return { presente: true, etat: vue.etat, visible: !!vue.visible, texte: vue.texte || '' };
}

// Les situations où l'accueil n'a jamais été affiché : le jugement n'a pas eu
// lieu, ni dans un sens ni dans l'autre.
const NON_JUGEABLE = /redirig|inatteignable|inattendue|pointage/i;

// L'INDISPONIBILITÉ, rendue SÉPARÉMENT du verdict.
//
// Trois états, jamais deux : conforme, fautif, ou non jugé. Ranger le troisième
// avec le deuxième transforme une séquence métier normale — le pointage exigé
// avant l'accueil — en défaut rouge, tous les jours, jusqu'à ce que plus
// personne ne lise la recette.
function indisponibiliteInvitation(vue) {
  if (!vue || vue.presente) return null;
  if (!NON_JUGEABLE.test(vue.motif || '')) return null;
  return 'Invitation à l’inventaire NON JUGÉE : ' + vue.motif + '. '
    + 'Ce n’est pas un défaut de la carte, et ce n’est pas non plus une preuve.';
}

// LE RÉSUMÉ, RENDU PAR LA MÊME SOURCE QUE LE VERDICT.
//
// Le 09/09/2026, le rapport se contredisait en deux lignes : l'indisponibilité
// disait « NON JUGÉE : le pointage est exigé », et le résumé, juste en dessous,
// « NON SATISFAITE — carte absente de l'accueil ». Deux expressions décidaient
// séparément du même fait, et l'une ignorait le motif.
//
// Corriger l'expression du résumé n'aurait rien réglé sur le fond : deux
// endroits qui jugent la même chose divergeront de nouveau. Le résumé est donc
// rendu ICI, à côté du verdict et de l'indisponibilité, et l'affichage se
// contente de l'imprimer.
function resumeInvitation(invitation) {
  if (!invitation) return 'NON EXÉCUTÉE';
  if (!invitation.presente) {
    return NON_JUGEABLE.test(invitation.motif || '')
      ? `NON JUGÉE — ${invitation.motif}`
      : 'NON SATISFAITE — carte absente de l’accueil';
  }
  if (invitation.etat === 'indisponible') return 'NON JUGÉE — l’accueil n’a pas pu décider';
  if (invitation.etat === 'proposee') {
    return invitation.visible
      ? `satisfaite — « ${invitation.texte} »`
      : 'NON SATISFAITE — décidée puis non montrée';
  }
  return invitation.visible
    ? 'NON SATISFAITE — affichée alors que rien n’attend'
    : 'satisfaite — rien n’attendait, rien n’est montré';
}

// VERDICT PUR — éprouvable sans navigateur.
function verifierInvitation(vue) {
  const echecs = [];
  if (!vue) { echecs.push('Invitation inventaire : aucune observation.'); return echecs; }
  if (!vue.presente) {
    // Une redirection vers la prise de poste n'est pas un défaut de la carte :
    // l'accueil n'a jamais été affiché. L'accuser masquerait la vraie cause.
    // NON JUGÉE N'EST PAS UN ÉCHEC, et ma première version l'y rangeait quand
    // même : le rapport disait « ÉCHEC de la recette » puis, dans la même
    // ligne, « ce n'est pas un défaut de la carte ». Une recette qui se
    // contredit en une phrase n'apprend rien à qui la lit.
    // L'indisponibilité se rend par `indisponibiliteInvitation`, à part.
    if (NON_JUGEABLE.test(vue.motif || '')) return echecs;
    echecs.push('La carte d’invitation à l’inventaire est ABSENTE de l’accueil employé'
      + (vue.motif ? ` — ${vue.motif}` : '') + '. '
      + 'Un employé ne peut donc jamais se voir proposer une mission que personne n’a prise.');
    return echecs;
  }
  if (vue.etat === 'proposee') {
    if (!vue.visible) {
      echecs.push('L’accueil a décidé qu’une mission d’inventaire attendait, et ne l’a PAS montrée. '
        + 'C’est exactement le défaut mesuré : 36 services pris en renfort, zéro participation.');
    } else if (!vue.texte) {
      echecs.push('La carte est visible mais VIDE : elle invite sans dire à quoi.');
    }
  } else if (vue.etat === 'aucune') {
    if (vue.visible) {
      echecs.push('La carte s’affiche alors que RIEN n’attend ce rôle. '
        + 'Un « 0 mission en attente » ajoute du bruit à un outil qu’on reproche déjà d’en faire trop.');
    }
  }
  // `indisponible` n'est pas un échec : c'est un refus de conclure, remonté
  // comme indisponibilité par l'appelant. Le confondre avec « aucune » ferait
  // passer une panne pour un calme.
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

    // Scénario employé — optionnel, et sa propre dégradation.
    let employe = null, echecsEmploye = [], employeIndisponible = null;
    const manquantsEmploye = SECRETS_EMPLOYE.filter(n => !env[n] || !String(env[n]).trim());
    if (manquantsEmploye.length) {
      employeIndisponible = `Scénario employé NON EXÉCUTÉ — absents du runner : ${manquantsEmploye.join(', ')}. `
        + 'La prise de poste n’est donc éprouvée qu’en SQL, jamais à l’écran. '
        + 'Or c’est l’écran que l’équipe voit, et c’est lui qui décide de l’adoption.';
    } else {
      try {
        employe = await observerEmploye(navigateur, base,
          env.NEXUS_TEST_EMPLOYEE_A_NOM, env.NEXUS_TEST_EMPLOYEE_A_PIN);
        echecsEmploye = verifierEmploye(employe.premiere, employe.seconde);
        if (employe.invitation && employe.invitation.etat === 'indisponible') {
          employeIndisponible = 'Invitation inventaire NON JUGÉE : l’accueil n’a pas pu décider '
            + '(fuseau, quart ou lecture des règles). Ne pas lire cette absence comme « rien n’attendait ».';
        }
        echecsEmploye = echecsEmploye.concat(verifierInvitation(employe.invitation));
        const nonJugee = indisponibiliteInvitation(employe.invitation);
        if (nonJugee) employeIndisponible = (employeIndisponible ? employeIndisponible + ' ' : '') + nonJugee;
        // INSTRUMENTATION (09/09/2026) — le franchissement du pointage rendait
        // déjà son motif, et personne ne l'imprimait. Une observation qu'on ne
        // regarde pas ne sert à rien : le rapport le dit désormais, qu'il ait
        // réussi ou échoué.
        if (employe.pointage && !employe.pointage.franchi) {
          employeIndisponible = (employeIndisponible ? employeIndisponible + ' ' : '')
            + `Pointage d’arrivée NON FRANCHI par la recette : ${employe.pointage.motif || 'motif non rendu'}.`;
        }
      } catch (e) {
        // Un compte inconnectable et un écran qui refuse sont deux choses
        // opposées — même distinction que pour le Créateur le 07/09. On ne
        // convertit pas l'un en l'autre : la preuve est déclarée manquante.
        employeIndisponible = `Compte employé « ${env.NEXUS_TEST_EMPLOYEE_A_NOM} » non exploitable : ${e.message.split('\n')[0]} `
          + 'LA PREUVE DU PARCOURS EMPLOYÉ RESTE NON SATISFAITE.';
      }
    }

    const indisponibilites = [carburantsNonAttribuable, createurIndisponible, employeIndisponible].filter(Boolean);
    return { executee: true, bloquant: (echecs.length + echecsLive.length + echecsEmploye.length) > 0,
      vu, echecs: echecs.concat(echecsLive, echecsEmploye), semisFait, indisponibilites,
      live: { createur, manager }, employe };
  } finally {
    await navigateur.close();
  }
}

module.exports = { SECRETS_REQUIS, SECRETS_EMPLOYE, secretsManquants, verifierEmploye, verifierInvitation, indisponibiliteInvitation, resumeInvitation, verifier, verifierLive, jugerCarburants, semisEffectue, extraireCommitServi, ATTENDU, executer };

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
      // Ce que l'écran annonce et ce qu'il propose. Sans cette ligne, la preuve
      // existait dans le code mais restait invisible dans le rapport que
      // Frédéric lit — et une preuve qu'on ne lit pas ne rassure personne.
      const c = r.live && r.live.createur;
      console.log('  · Cohérence question/bouton dans Live : '
        + (!c ? 'NON SATISFAITE — Créateur non observé'
          : !c.attente ? 'NON SATISFAITE — l’écran ne déclare pas ce qu’il attend'
          : c.attente === 'arbitrage'
            ? `un arbitrage est annoncé, bouton ${c.boutonAutoriser ? 'présent' : 'ABSENT'}`
          : c.attente === 'repondu'
            ? `question répondue mais cause non levée, bouton ${c.boutonAutoriser ? 'REPROPOSÉ À TORT' : 'retiré'}`
            : `aucun arbitrage en attente, bouton ${c.boutonAutoriser ? 'PRÉSENT À TORT' : 'absent'}`));
      // Le parcours EMPLOYÉ, dit séparément et sans ambiguïté. « Non exécuté »
      // n'est pas « satisfait » : la confusion des deux est exactement ce qui a
      // laissé croire pendant un lot entier que la preuve UI existait.
      const e = r.employe;
      console.log('  · Prise de poste employé : '
        + (!e ? 'NON EXÉCUTÉE — voir indisponibilités'
          : e.premiere.atteint === 'confirme' ? 'satisfaite' : 'NON SATISFAITE'));
      console.log('  · Pointage d’arrivée franchi par la recette : '
        + (!e || !e.pointage ? 'NON EXÉCUTÉ'
          : e.pointage.franchi ? 'oui'
          : `NON — ${e.pointage.motif || 'motif non rendu'}`));
      console.log('  · Invitation à l’inventaire sur l’accueil : '
        + resumeInvitation(e && e.invitation));
      console.log('  · Prise de poste avec un quart DÉJÀ OUVERT : '
        + (!e ? 'NON EXÉCUTÉE — le cas ordinaire de l’équipe reste non éprouvé à l’écran'
          : e.seconde.atteint === 'confirme' ? 'satisfaite — le quart précédent s’est fermé seul'
          : 'NON SATISFAITE'));
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
