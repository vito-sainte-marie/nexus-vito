#!/usr/bin/env node
'use strict';
// NEXUS — garde déterministe de la boucle autonome Fast Track (préparation,
// 10/10/2026, GO de Frédéric sur l'issue #28, commentaire du lot
// BOUCLE-AUTONOME-FAST-TRACK-PREPARATION-1-20261010). PRÉPARER SANS ARMER.
//
// Ce module ne déclenche rien et n'écrit sur aucune ref protégée : il répond
// à une seule question, pour un seul tour candidat de la boucle
// Claude -> push rail -> workflow_dispatch tests.yml -> Claude, « ce tour a-t-il
// le droit de s'exécuter ? ». `evaluerTour` est pure — aucune lecture disque,
// aucun appel réseau, aucune horloge implicite : tout lui est donné en
// argument, pour qu'une mutation d'une seule condition fasse échouer une
// seule épreuve (convention déjà suivie par outils/handoff.js et
// outils/classification-canal.js).
//
// L'armement réel (interrupteur à la valeur exacte "arme"), toute mutation de
// `main`/`production`, le plafond de coût définitif et toute fusion main
// restent des paliers humains distincts, jamais décidés ici (CLAUDE.md,
// ARMEMENT-ARBITRAGE-AUTONOME-1-20261008/decision-1.md et decision-2.md,
// FAST-TRACK-ANTI-PAUSE-1-20261007/decision-1.md, FAST-TRACK-CYCLE-POINTEUR-
// 1-20261008/decision-1.md — les quatre refusent déjà, chacune à sa façon,
// qu'un lot technique vaille armement). Ce module ne fait que rendre cette
// frontière vérifiable par du code plutôt que par la seule discipline de qui
// l'invoque.

const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(__dirname, '..');

// Nom de variable et valeur canonique de l'interrupteur. Toute autre valeur
// (y compris "true", "1", "oui", une chaîne vide, une faute de frappe) est
// un défaut sûr : désarmé. L'absence de la variable est le cas par défaut de
// ce dépôt aujourd'hui (vérifié : `NEXUS_BOUCLE_AUTONOME` n'apparaît dans
// aucun fichier de ce rail avant ce lot) — donc le comportement par défaut de
// `estArme` sur l'environnement réel, sans aucune préparation supplémentaire,
// est déjà `false`.
const INTERRUPTEUR_VAR = 'NEXUS_BOUCLE_AUTONOME';
const VALEUR_ARMEE = 'arme';

// Plafonds proposés par Frédéric dans le GO de préparation du 10/10/2026.
// Valeurs initiales, pas un maximum définitif : un plafond de coût définitif
// reste un palier humain distinct (voir en-tête).
const PLAFOND_TOURS_PAR_LOT = 3;
const PLAFOND_TOURS_PAR_JOUR = 10;

// Vocabulaire clos des codes de refus/autorisation. Fermé comme celui de
// `docs/handoff/PROTOCOL.md` : un code hors de cette liste est un bug du
// dispositif, jamais une valeur silencieusement tolérée.
const CODES = Object.freeze({
  DESARME: 'DESARME',
  STOP_HUMAIN: 'STOP_HUMAIN',
  AUCUNE_NOUVELLE_DEMANDE: 'AUCUNE_NOUVELLE_DEMANDE',
  DECISION_DEJA_TRAITEE: 'DECISION_DEJA_TRAITEE',
  VERDICT_REPETE: 'VERDICT_REPETE',
  CI_ROUGE: 'CI_ROUGE',
  PLAFOND_LOT_ATTEINT: 'PLAFOND_LOT_ATTEINT',
  PLAFOND_JOUR_ATTEINT: 'PLAFOND_JOUR_ATTEINT',
  AUTORISE: 'AUTORISE',
});

const FICHIER_JOURNAL_DEFAUT = path.join(RACINE, 'docs', 'handoff', 'BOUCLE-AUTONOME-JOURNAL.json');

function estArme(env) {
  return !!env && env[INTERRUPTEUR_VAR] === VALEUR_ARMEE;
}

function jourISO(dateISO) {
  return String(dateISO || '').slice(0, 10);
}

function toursDuLot(journal, lot) {
  return (journal.tours || []).filter(t => t.lot === lot);
}

function toursPourLot(journal, lot) {
  return toursDuLot(journal, lot).length;
}

function toursAujourdhui(journal, maintenantISO) {
  const jour = jourISO(maintenantISO);
  return (journal.tours || []).filter(t => jourISO(t.horodate) === jour).length;
}

// Idempotence : CE commit_decision précis a-t-il déjà été rejoué pour ce lot,
// que le tour ait alors été autorisé ou refusé ? Un seul enregistrement par
// couple (lot, commit_decision) suffit à fermer la porte pour toujours sur ce
// couple — rejouer la même décision n'a pas de second effet utile.
function dejaTraite(journal, lot, commitDecision) {
  if (!commitDecision) return false;
  return toursDuLot(journal, lot).some(t => t.commit_decision === commitDecision);
}

// Anti-répétition de verdict : si les `seuil` derniers tours enregistrés pour
// CE lot (quel que soit leur commit_decision, donc même entre décisions
// successives distinctes) portent le même `verdict_hash`, boucler encore
// n'apporterait rien — l'arbitre répond la même chose. Distinct de
// `dejaTraite`, qui ne regarde qu'un seul commit_decision.
function verdictRepete(journal, lot, verdictHash, seuil) {
  if (verdictHash === undefined || verdictHash === null) return false;
  const s = seuil || 2;
  const tours = toursDuLot(journal, lot).filter(t => t.verdict_hash !== undefined);
  const derniers = tours.slice(-s);
  return derniers.length === s && derniers.every(t => t.verdict_hash === verdictHash);
}

// Fonction pure : aucun accès disque/réseau/horloge. `maintenant` est une
// chaîne ISO fournie par l'appelant (jamais `new Date()` ici), pour que le
// même appel produise toujours le même verdict.
//
// Ordre des gardes, du plus prioritaire au moins prioritaire : un interrupteur
// désarmé ou un motif du palier Frédéric dominent tout le reste ; vient
// ensuite l'absence de travail réel à faire (rien de nouveau, déjà traité,
// verdict qui se répète) ; puis la santé technique (CI) ; puis les plafonds
// de volume. Un appelant qui a plusieurs raisons de refuser voit toujours le
// motif le plus significatif, jamais le premier trouvé par accident d'ordre
// de test.
function evaluerTour(entree) {
  const {
    env,
    lot,
    commitDecision,
    verdictHash,
    motifsStopPresents,
    ciConclusion,
    nouvelleDecisionDisponible,
    journal,
    maintenant,
    seuilVerdictRepete,
  } = entree || {};

  if (!estArme(env)) {
    return {
      autorise: false,
      code: CODES.DESARME,
      motif: `${INTERRUPTEUR_VAR} absent ou différent de "${VALEUR_ARMEE}" — défaut sûr : désarmé.`,
    };
  }

  const stops = Array.isArray(motifsStopPresents) ? motifsStopPresents.filter(Boolean) : [];
  if (stops.length > 0) {
    return {
      autorise: false,
      code: CODES.STOP_HUMAIN,
      motif: `motif(s) du palier Frédéric présent(s) : ${stops.join(', ')} — réveil humain requis, la boucle ne décide pas seule.`,
    };
  }

  if (!nouvelleDecisionDisponible) {
    return {
      autorise: false,
      code: CODES.AUCUNE_NOUVELLE_DEMANDE,
      motif: `${lot} : aucune décision consommée actionnable au-delà de ce qui est déjà traité — rien à boucler.`,
    };
  }

  if (dejaTraite(journal || {}, lot, commitDecision)) {
    return {
      autorise: false,
      code: CODES.DECISION_DEJA_TRAITEE,
      motif: `${lot} : commit_decision ${commitDecision} déjà rejoué — idempotence.`,
    };
  }

  if (verdictRepete(journal || {}, lot, verdictHash, seuilVerdictRepete)) {
    return {
      autorise: false,
      code: CODES.VERDICT_REPETE,
      motif: `${lot} : le même verdict se répète sans évoluer — boucler davantage n'apporterait rien, escalade requise.`,
    };
  }

  if (ciConclusion !== 'success') {
    return {
      autorise: false,
      code: CODES.CI_ROUGE,
      motif: `CI non verte (${ciConclusion || 'inconnue'}) sur le commit candidat — aucun tour ne se lance sur du rouge.`,
    };
  }

  const toursLot = toursPourLot(journal || {}, lot);
  if (toursLot >= PLAFOND_TOURS_PAR_LOT) {
    return {
      autorise: false,
      code: CODES.PLAFOND_LOT_ATTEINT,
      motif: `${lot} : ${toursLot}/${PLAFOND_TOURS_PAR_LOT} tours déjà consommés pour ce lot.`,
    };
  }

  const toursJour = toursAujourdhui(journal || {}, maintenant);
  if (toursJour >= PLAFOND_TOURS_PAR_JOUR) {
    return {
      autorise: false,
      code: CODES.PLAFOND_JOUR_ATTEINT,
      motif: `${toursJour}/${PLAFOND_TOURS_PAR_JOUR} tours déjà consommés aujourd'hui, tous lots confondus.`,
    };
  }

  return {
    autorise: true,
    code: CODES.AUTORISE,
    motif: 'toutes les gardes déterministes sont satisfaites pour ce tour.',
  };
}

// --- Persistance du journal (append-only, un seul écrivain à la fois attendu) ---

function chargerJournal(fichier) {
  const f = fichier || FICHIER_JOURNAL_DEFAUT;
  if (!fs.existsSync(f)) return { version: 1, tours: [] };
  const brut = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!Array.isArray(brut.tours)) throw new Error(`journal corrompu (pas de liste "tours") : ${f}`);
  return brut;
}

// Enregistre CHAQUE évaluation (autorisée ou refusée) — pas seulement les
// tours exécutés — pour que `dejaTraite`/`verdictRepete` voient aussi les
// refus. Un tour refusé n'a pas d'effet de bord réel ; le consigner n'est
// pas une mutation du produit, c'est la mémoire de la garde elle-même.
function enregistrerTour(fichier, entree) {
  const f = fichier || FICHIER_JOURNAL_DEFAUT;
  const journal = chargerJournal(f);
  journal.tours.push(entree);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(journal, null, 2) + '\n');
  return journal;
}

module.exports = {
  INTERRUPTEUR_VAR,
  VALEUR_ARMEE,
  PLAFOND_TOURS_PAR_LOT,
  PLAFOND_TOURS_PAR_JOUR,
  CODES,
  FICHIER_JOURNAL_DEFAUT,
  estArme,
  toursPourLot,
  toursAujourdhui,
  dejaTraite,
  verdictRepete,
  evaluerTour,
  chargerJournal,
  enregistrerTour,
};

// --- CLI, préparée pour un futur câblage dans tests.yml — NON câblée ici. ---
//
// `node outils/garde-boucle-autonome.js evaluer --lot L --commit C [...]`
// n'exécute jamais `gh workflow run` lui-même : il se contente de répondre
// GO/NO-GO pour le tour décrit par ses arguments, et d'écrire son verdict
// dans $GITHUB_ENV s'il existe (convention déjà suivie par claude.yml et
// tests.yml), sinon sur stdout. L'appelant (un futur step de workflow) reste
// seul responsable de l'action réelle. Cette CLI sort toujours 0 : un refus
// de boucler n'est jamais un échec de CI, c'est le fonctionnement voulu.
if (require.main === module) {
  const args = process.argv.slice(3);
  const opt = { motifsStopPresents: [] };
  for (let i = 0; i < args.length; i++) {
    const v = () => args[++i];
    switch (args[i]) {
      case '--lot': opt.lot = v(); break;
      case '--commit': opt.commitDecision = v(); break;
      case '--verdict-hash': opt.verdictHash = v(); break;
      case '--ci': opt.ciConclusion = v(); break;
      case '--nouvelle-decision': opt.nouvelleDecisionDisponible = v() === '1'; break;
      case '--stop': opt.motifsStopPresents.push(v()); break;
      case '--journal': opt.journalFichier = v(); break;
      case '--maintenant': opt.maintenant = v(); break;
      default: console.error(`Option inconnue : ${args[i]}`); process.exit(2);
    }
  }
  const commande = process.argv[2];
  if (commande !== 'evaluer') {
    console.error("Usage : garde-boucle-autonome.js evaluer --lot L --commit C --ci success|failure|... --nouvelle-decision 0|1 [--verdict-hash H] [--stop MOTIF]... [--journal fichier] [--maintenant ISO]");
    process.exit(2);
  }
  const journal = chargerJournal(opt.journalFichier);
  const maintenant = opt.maintenant || new Date().toISOString();
  const verdict = evaluerTour({
    env: process.env,
    lot: opt.lot,
    commitDecision: opt.commitDecision,
    verdictHash: opt.verdictHash,
    motifsStopPresents: opt.motifsStopPresents,
    ciConclusion: opt.ciConclusion,
    nouvelleDecisionDisponible: !!opt.nouvelleDecisionDisponible,
    journal,
    maintenant,
  });
  enregistrerTour(opt.journalFichier, {
    lot: opt.lot, commit_decision: opt.commitDecision, verdict_hash: opt.verdictHash,
    horodate: maintenant, autorise: verdict.autorise, code: verdict.code,
  });
  console.log(`${verdict.autorise ? 'AUTORISE' : 'REFUS'} — ${verdict.code} — ${verdict.motif}`);
  const sortieEnv = process.env.GITHUB_ENV;
  if (sortieEnv) {
    fs.appendFileSync(sortieEnv, `NEXUS_BOUCLE_TOUR_AUTORISE=${verdict.autorise ? '1' : '0'}\nNEXUS_BOUCLE_TOUR_CODE=${verdict.code}\n`);
  }
  process.exit(0);
}
