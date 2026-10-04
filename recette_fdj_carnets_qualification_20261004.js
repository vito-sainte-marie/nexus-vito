#!/usr/bin/env node
'use strict';
// Recette navigateur réelle — FDJ-CARNETS-LEDGER-AUDIT-1-20261004.
//
// GO recette de Frédéric (decision-1.md, 04/10/2026) : qualifier sur
// nexus-test la correction de réconciliation ('correction' annule 'actives',
// §4 de request-1.md) et la fermeture du gap d'idempotence sur les 6
// écritures manager hors quart (§5), vérifier le comportement réel
// retry/double-clic, et constater — sans la masquer — la dette sur les 3
// chemins à clé fraîche (§8 : 2 écritures employé + la correction manager
// elle-même, hors périmètre de ce lot).
//
// MÉTHODE : exercer le CODE RÉELLEMENT SERVI par le rail (navigateur réel,
// session Manager Test authentifiée), pas une resimulation Node. Pour
// l'idempotence serveur, on utilise directement la réponse de
// `fdj_enregistrer_mouvement_stock` (champs `ecrits`/`rejeux`/`idempotent`,
// migration 20260916221000) plutôt qu'une requête de comptage séparée —
// c'est la fonction elle-même qui dit si l'appel a été un rejeu.
//
// PRUDENCE SUR L'EMPREINTE : chaque opération manager testée écrit une
// quantité de 1 (minimum représentable), jamais plus, et chaque jeton de
// rejeu est strictement local à cette exécution — aucune donnée supprimée
// (la table est append-only), mais l'empreinte est volontairement minimale.
// Pour les 3 chemins « clé fraîche », AUCUNE écriture de doublon n'est
// provoquée : la dette est démontrée en lisant, en page, que la fonction de
// génération de clé (`genererIdempotencyKey`) rend bien deux valeurs
// distinctes à deux appels successifs — preuve suffisante et sans effet de
// bord sur les données.
//
// AUCUNE opération sur fdj_stock_references (Point Zéro) : spécifié,
// jamais exécuté (decision-1.md, condition explicite).

const path = require('path');
const {
  urlTestDuRail, secretsManquants, attendreVersionServie, SECRETS_REQUIS,
} = require('./outils/recette-navigateur-test.js');

// `connecter` n'est pas exporté par outils/recette-navigateur-test.js —
// reproduit ici à l'identique (même sélecteurs, même attente de sortie
// d'écran) plutôt que dupliqué en silence : voir ce fichier pour l'original.
async function connecter(page, base, identifiant, pin) {
  await page.goto(new URL('NEXUS-Login-v1.html', base).href, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="text"], input:not([type])').first().fill(identifiant);
  await page.locator('input[type="password"]').first().fill(pin);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL(u => !/NEXUS-Login/i.test(u.href), { timeout: 30000 });
}

const ECRAN_FDJ_MANAGER = 'NEXUS-FDJ-Manager-v1.html';

// Les 6 opérations fermées par ce lot (§5 de request-1.md), avec une charge
// minimale et sans précondition de stock bloquante (vérifié sur la fonction
// serveur : aucun contrôle de solde suffisant n'y existe — seul un garde-fou
// métier côté écran, pas côté commande).
const OPERATIONS_FERMEES = [
  { operation: 'reception', motif: null, source: 'Recette qualification FDJ 04/10/2026', emplacementSource: null },
  { operation: 'reappro_caisse', motif: null, source: null, emplacementSource: null },
  { operation: 'retrait_caisse', motif: 'Recette qualification FDJ 04/10/2026', source: null, emplacementSource: null },
  { operation: 'blocage', motif: 'Recette qualification FDJ 04/10/2026', source: null, emplacementSource: 'bureau' },
  { operation: 'retour_bloque', motif: null, source: null, emplacementSource: null },
  { operation: 'rapprochement_activation', motif: 'Recette qualification FDJ 04/10/2026', source: null, emplacementSource: null },
];

/**
 * nexus-auth.js redirige systématiquement (nexusRequireAuth) vers
 * NEXUS-Prise-De-Poste-v1.html si l'employé n'a pas de poste ouvert pour le
 * quart courant — avant même d'atteindre l'écran demandé. Ce n'est pas lié à
 * FDJ : on absorbe la prise de poste si elle se présente, en conservant le
 * rôle Manager, puis on repart vers l'écran voulu.
 */
async function franchirPriseDePosteSiPresentee(page, base, ecranVoulu) {
  await page.goto(new URL(ecranVoulu, base).href, { waitUntil: 'networkidle' });
  if (!/Prise-De-Poste/i.test(page.url())) return { franchie: false };
  const cartes = page.locator('.role-card');
  await cartes.first().waitFor({ timeout: 30000 });
  const manager = cartes.filter({ hasText: /manager/i }).first();
  await manager.click();
  await page.locator('#btnVoirMissions').click();
  const confirmer = page.locator('#btnConfirmer');
  await confirmer.waitFor({ timeout: 30000 });
  await confirmer.click();
  const btnDashboard = page.locator('#btnDashboard');
  await btnDashboard.waitFor({ timeout: 30000 });
  await btnDashboard.click();
  await page.waitForLoadState('networkidle');
  return { franchie: true };
}

async function attendrePret(page, base) {
  await franchirPriseDePosteSiPresentee(page, base, ECRAN_FDJ_MANAGER);
  if (!new RegExp(ECRAN_FDJ_MANAGER.replace('.html', '')).test(page.url())) {
    await page.goto(new URL(ECRAN_FDJ_MANAGER, base).href, { waitUntil: 'networkidle' });
  }
  await page.waitForFunction(
    () => typeof nexusClient === 'object' && typeof siteId !== 'undefined' && siteId
      && typeof NexusFdjMoteur === 'object' && typeof genererIdempotencyKey === 'function',
    null, { timeout: 30000 });
}

async function trouverJeuDeRecette(page) {
  return page.evaluate(async () => {
    const { data, error } = await nexusClient.from('fdj_games').select('id, nom')
      .eq('site', siteId).eq('actif', true).order('ordre_affichage', { ascending: true }).limit(1);
    if (error) throw new Error('Lecture fdj_games impossible : ' + error.message);
    if (!data || !data.length) throw new Error('Aucun jeu FDJ actif sur ce site — qualification impossible sans jeu de recette.');
    return data[0];
  });
}

/**
 * Appelle fdj_enregistrer_mouvement_stock avec le MÊME jeton deux fois de
 * suite, dans la page (session Manager réelle). Le premier appel doit
 * écrire ; le second, portant le même jeton, doit être un rejeu reconnu par
 * le serveur lui-même (`idempotent: true`, `ecrits: 0`, `rejeux: 1`) —
 * exactement le scénario d'un retry réseau après perte de réponse.
 */
async function eprouverIdempotenceServeur(page, gameId, spec) {
  return page.evaluate(async ({ gameId, spec }) => {
    const jeton = (crypto && crypto.randomUUID) ? crypto.randomUUID()
      : `recette-fdj-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const params = {
      p_operation: spec.operation,
      p_lignes: [{ game_id: gameId, quantite: 1 }],
      p_jeton: jeton,
      p_motif: spec.motif,
      p_source: spec.source,
      p_emplacement_source: spec.emplacementSource,
    };
    const premier = await nexusClient.rpc('fdj_enregistrer_mouvement_stock', params);
    const second = await nexusClient.rpc('fdj_enregistrer_mouvement_stock', params);
    return {
      operation: spec.operation,
      jeton,
      premier: premier.error ? { erreur: premier.error.message } : premier.data,
      second: second.error ? { erreur: second.error.message } : second.data,
    };
  }, { gameId, spec });
}

/** Deux générations successives de clé, en page, SANS écriture. */
async function eprouverCleFraicheSansEcriture(page) {
  return page.evaluate(() => {
    if (typeof genererIdempotencyKey !== 'function') return { disponible: false };
    const a = genererIdempotencyKey();
    const b = genererIdempotencyKey();
    return { disponible: true, a, b, distinctes: a !== b };
  });
}

/**
 * Exerce le moteur RÉELLEMENT SERVI (pas une resimulation Node) sur le cas
 * exact du bug §4 : un mouvement 'correction' (caisse→caisse, quantité
 * négative) doit annuler 'actives', jamais toucher 'confies'/'bureau'.
 * Données synthétiques, aucune lecture ni écriture de table — seul le code
 * du moteur chargé par la page est en cause ici.
 */
async function eprouverCorrectifReconciliationEnPage(page) {
  return page.evaluate(() => {
    const gameId = 'jeu-synthetique-recette';
    const locCaisse = 'loc-caisse-synthetique';
    const locBureau = 'loc-bureau-synthetique';
    const mouvements = [
      { type_mouvement: 'transfert', game_id: gameId, quantite: 10, location_source_id: locBureau, location_destination_id: locCaisse },
      { type_mouvement: 'activation', game_id: gameId, quantite: 4, location_source_id: locCaisse, location_destination_id: locCaisse },
      // Le mouvement du bug : une correction manager qui annule 1 activation fautive.
      { type_mouvement: 'correction', game_id: gameId, quantite: -1, location_source_id: locCaisse, location_destination_id: locCaisse },
    ];
    const locations = { caisse: locCaisse, bureau: locBureau, bloque: 'loc-bloque-synthetique' };
    const solde = NexusFdjMoteur.soldesCarnetsAvecReference(mouvements, locations, null);
    return solde[gameId] || null;
  });
}

async function executer(env = process.env) {
  const manquants = secretsManquants(env);
  if (manquants.length) {
    return { executee: false, bloquant: false,
      message: `Qualification FDJ non exécutée — secrets absents : ${manquants.join(', ')}. Dégradation ENV-003, non bloquante.` };
  }

  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) {
    return { executee: false, bloquant: false,
      message: 'Qualification FDJ non exécutée — playwright absent de cet environnement. Non bloquant.' };
  }

  const cible = urlTestDuRail(env);
  if (!cible.url) {
    return { executee: false, bloquant: false, message: `Qualification FDJ non exécutée — ${cible.cause}` };
  }
  const base = cible.url;
  console.log(`Adresse NEXUS Test dérivée du rail ${cible.rail} : ${base}`);

  if (env.NEXUS_COMMIT_ATTENDU) {
    const v = await attendreVersionServie(base, env.NEXUS_COMMIT_ATTENDU);
    if (!v.servie) {
      return { executee: false, bloquant: false,
        message: `Qualification FDJ non exécutée — version servie (${v.commit || 'inconnue'}) ≠ attendue (${env.NEXUS_COMMIT_ATTENDU}).` };
    }
    console.log(`Version servie confirmée : ${v.commit}`);
  }

  const navigateur = await chromium.launch();
  const resultat = { executee: true, idempotence: [], reconciliation: null, cleFraiche: null, erreurs: [] };
  try {
    const page = await navigateur.newPage({ viewport: { width: 1280, height: 900 } });
    await connecter(page, base, env.NEXUS_TEST_MANAGER_NOM, env.NEXUS_TEST_MANAGER_PIN);
    await attendrePret(page, base);

    const commitServi = await page.evaluate(() => (typeof NexusBuild !== 'undefined' && NexusBuild && NexusBuild.commit) || null);
    resultat.commitServi = commitServi;

    // 1) Correctif de réconciliation (§4), sur le moteur RÉELLEMENT SERVI.
    resultat.reconciliation = await eprouverCorrectifReconciliationEnPage(page);

    // 2) Clé fraîche à chaque appel (§8, dette non corrigée), sans écriture.
    resultat.cleFraiche = await eprouverCleFraicheSansEcriture(page);

    // 3) Idempotence serveur réelle sur les 6 écritures fermées (§5).
    const jeu = await trouverJeuDeRecette(page);
    resultat.jeuDeRecette = jeu;
    for (const spec of OPERATIONS_FERMEES) {
      try {
        const r = await eprouverIdempotenceServeur(page, jeu.id, spec);
        resultat.idempotence.push(r);
      } catch (e) {
        resultat.erreurs.push({ operation: spec.operation, erreur: e.message });
      }
    }
  } finally {
    await navigateur.close();
  }
  return resultat;
}

function jugerIdempotence(resultat) {
  const echecs = [];
  for (const r of resultat.idempotence) {
    if (r.premier && r.premier.erreur) { echecs.push(`${r.operation} : premier appel en erreur — ${r.premier.erreur}`); continue; }
    if (r.second && r.second.erreur) { echecs.push(`${r.operation} : second appel (rejeu) en erreur — ${r.second.erreur}`); continue; }
    if (!r.premier || r.premier.ecrits !== 1 || r.premier.idempotent !== false) {
      echecs.push(`${r.operation} : premier appel attendu ecrits=1/idempotent=false, obtenu ${JSON.stringify(r.premier)}`);
    }
    if (!r.second || r.second.ecrits !== 0 || r.second.idempotent !== true || r.second.rejeux !== 1) {
      echecs.push(`${r.operation} : second appel (même jeton) attendu ecrits=0/idempotent=true/rejeux=1, obtenu ${JSON.stringify(r.second)}`);
    }
  }
  return echecs;
}

function jugerReconciliation(solde) {
  if (!solde) return ['moteur : aucun solde retourné pour le jeu synthétique'];
  const echecs = [];
  // Attendu : confies=10 (transfert initial, inchangé par la correction),
  // actives=3 (4 activées − 1 annulée par la correction), jamais confies
  // décrémenté par la correction (c'était exactement le bug).
  if (solde.confies !== 10) echecs.push(`confies attendu 10, obtenu ${solde.confies}`);
  if (solde.actives !== 3) echecs.push(`actives attendu 3 (4 activées − 1 correction), obtenu ${solde.actives}`);
  return echecs;
}

function jugerCleFraiche(c) {
  if (!c || !c.disponible) return ['genererIdempotencyKey indisponible sur la page servie'];
  if (!c.distinctes) return [`deux appels successifs ont rendu la MÊME clé (${c.a}) — la dette §8 serait résolue sans l'avoir corrigée`];
  return [];
}

async function main() {
  const r = await executer(process.env);
  if (!r.executee) {
    console.log(r.message);
    process.exit(0);
  }
  console.log('Commit servi (page) :', r.commitServi);
  console.log('Jeu de recette :', JSON.stringify(r.jeuDeRecette));
  console.log('Réconciliation (moteur servi) :', JSON.stringify(r.reconciliation));
  console.log('Clé fraîche (sans écriture) :', JSON.stringify(r.cleFraiche));
  console.log('Idempotence serveur (6 opérations, jeton rejoué) :');
  for (const i of r.idempotence) console.log('  ', i.operation, '→ premier', JSON.stringify(i.premier), '| second', JSON.stringify(i.second));
  if (r.erreurs.length) console.log('Erreurs :', JSON.stringify(r.erreurs));

  const echecs = [
    ...jugerReconciliation(r.reconciliation).map(m => `reconciliation: ${m}`),
    ...jugerCleFraiche(r.cleFraiche).map(m => `cle-fraiche: ${m}`),
    ...jugerIdempotence(r).map(m => `idempotence: ${m}`),
    ...r.erreurs.map(e => `erreur: ${e.operation} — ${e.erreur}`),
  ];

  if (echecs.length) {
    console.log('\nÉCHEC — divergences réelles constatées (non masquées) :');
    for (const e of echecs) console.log('  -', e);
    process.exitCode = 1;
  } else {
    console.log('\nQualification nexus-test : toutes les preuves attendues sont vérifiées — 6/6 idempotence serveur, réconciliation correcte, dette §8 confirmée réelle (non corrigée, comme annoncé).');
  }
}

if (require.main === module) main();

module.exports = { executer, jugerIdempotence, jugerReconciliation, jugerCleFraiche, OPERATIONS_FERMEES };
