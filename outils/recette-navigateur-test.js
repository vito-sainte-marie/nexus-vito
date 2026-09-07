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
// Le PIN existe déjà là où il faut : dans le secret GitHub NEXUS_TEST_PIN,
// injecté au runner et illisible ailleurs. Ce qui manquait n'était pas
// l'accès, c'était ce fichier.
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
//   NEXUS_TEST_MANAGER_USERNAME    (ex. manager-test)
//   NEXUS_TEST_PIN                 secret — jamais affiché

const path = require('path');

const SECRETS_REQUIS = ['NEXUS_TEST_URL', 'NEXUS_TEST_MANAGER_USERNAME', 'NEXUS_TEST_PIN'];
const ECRAN_CARBURANTS = 'NEXUS-Carburants-Pilotage-v1.html';

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
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.getByRole('button', { name: /se connecter/i }).click(),
  ]);
  const url = page.url();
  if (/NEXUS-Login/i.test(url)) {
    // Message volontairement muet sur la valeur saisie.
    throw new Error('Connexion refusée : toujours sur l\'écran de login après validation. ' +
      'Identifiant inconnu, PIN incorrect, ou compte de recette désactivé.');
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
    await connecter(page, base, env.NEXUS_TEST_MANAGER_USERNAME, env.NEXUS_TEST_PIN);
    const vu = await lireRecommandation(page, base);
    const echecs = verifier(vu);
    return { executee: true, bloquant: echecs.length > 0, vu, echecs };
  } finally {
    await navigateur.close();
  }
}

module.exports = { SECRETS_REQUIS, secretsManquants, verifier, extraireCommitServi, ATTENDU, executer };

if (require.main === module) {
  executer().then(r => {
    if (!r.executee) { console.log(r.message); process.exit(0); }
    console.log(`Recette navigateur NEXUS Test — site ${r.vu.site}, version servie ${r.vu.commit || 'inconnue'}`);
    console.log(`  ${r.vu.texteCommande || '(ligne de commande recommandée introuvable dans le texte)'}`);
    console.log(`  optimiseur brut : ${JSON.stringify(r.vu.optimiseurBrut)}`);
    console.log(`  après arrondi   : ${JSON.stringify(r.vu.volumes)} = ${r.vu.total} L`);
    console.log(`  reliquat        : ${JSON.stringify(r.vu.reliquatArrondi)}`);
    if (!r.bloquant) { console.log('\nPreuve UI satisfaite.'); process.exit(0); }
    console.error('\nÉCHEC de la recette navigateur :');
    for (const e of r.echecs) console.error('  - ' + e);
    process.exit(1);
  }).catch(e => {
    // Le message d'erreur ne doit jamais contenir de valeur saisie.
    console.error('ÉCHEC de la recette navigateur : ' + e.message);
    process.exit(1);
  });
}
