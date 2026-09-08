#!/usr/bin/env node
'use strict';
// Producteur d'événements NEXUS Live — la source qui manquait.
//
// LE PROBLÈME QU'IL RÉSOUT. Le MVP Live savait afficher une projection et la
// base savait la stocker, mais RIEN n'émettait. Un tableau de bord sans source
// n'affiche pas « aucune information » : il affiche un état vide, c'est-à-dire
// rassurant. C'est le mode de panne le plus dangereux d'un écran de pilotage,
// et c'était l'état exact de NEXUS Live jusqu'ici.
//
// DEUX RÈGLES QUI GOUVERNENT TOUT CE FICHIER.
//
//   1. AUCUN ÉVÉNEMENT N'EST INVENTÉ. Chaque événement produit ici pointe vers
//      un fait vérifiable : une entrée du registre Handoff, un identifiant de
//      run CI, un code de sortie de garde. Quand un fait est indisponible —
//      pas de réseau, `gh` absent — on n'émet RIEN pour lui. On n'émet jamais
//      un « PROGRESS » de remplissage : un écran qui montre une activité
//      fabriquée est pire qu'un écran vide, parce qu'on le croit.
//
//   2. LA VALIDATION APPARTIENT AU CONTRAT, PAS À CE FICHIER. Chaque événement
//      passe par `nexus-live-evenement.js` avant d'être rendu. Ce module refuse
//      déjà tout contenu ressemblant à un secret ; le producteur le laisse
//      mordre au lieu de le contourner. Réimplémenter la validation ici en
//      ferait une seconde vérité (ARCH-001).
//
// POURQUOI IL N'ÉCRIT PAS EN BASE. La RLS de `nexus_live_events` réserve
// l'écriture à `je_suis_createur()` — délibérément, pour qu'aucun `service_role`
// n'entre dans le dépôt ou la CI. Ce producteur rend donc un journal JSONL ;
// l'ingestion reste un point d'intégration explicite, exactement comme le
// commentaire de la migration l'annonce. Une source qui s'écrirait toute seule
// en base demanderait une capacité que personne n'a voulu lui donner.
//
// IDENTIFIANTS DÉTERMINISTES. Le même état du dépôt produit le même journal,
// aux mêmes `event_id`. Rejouer le producteur ne duplique donc rien, et
// l'ingestion peut être idempotente sans tenir d'état de son côté.
//
//   node outils/producteur-evenements-live.js              # JSONL sur stdout
//   node outils/producteur-evenements-live.js --resume     # lisible

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const RACINE = process.env.NEXUS_DEPOT ? path.resolve(process.env.NEXUS_DEPOT) : path.resolve(__dirname, '..');
const contrat = require(path.join(RACINE, 'nexus-live-evenement.js'));
const deploiement = require(path.join(__dirname, 'etat-deploiement.js'));

const PROTOCOLE = 'nexus-execution-event/1';

function git(...args) {
  try { return execFileSync('git', args, { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch (e) { return null; }
}

// L'identifiant naît du FAIT, jamais de l'horloge : deux exécutions sur le
// même état doivent produire le même identifiant, sinon l'ingestion
// dupliquerait à chaque passage.
function identifiant(...parts) {
  return 'evt-' + crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24);
}

function evenement({ lot, run, acteur, role, phase, statut, resume, preuve, gate, occurredAt }) {
  const e = {
    protocol: PROTOCOLE,
    event_id: identifiant(lot, run, phase, statut, resume),
    occurred_at: occurredAt,
    lot_id: lot,
    run_id: run,
    actor: { id: acteur, role },
    phase,
    status: statut,
    summary: resume,
  };
  if (preuve) e.evidence = preuve;
  if (gate) e.human_gate = gate;
  return e;
}

// ── Faits : le registre Handoff ─────────────────────────────────────────
function evenementsRegistre(etatDep, horodatage) {
  const evts = [];
  for (const l of etatDep.lots || []) {
    if (l.etat === 'attente_arbitrage') {
      evts.push(evenement({
        lot: l.lot, run: 'handoff', acteur: 'orchestrator', role: 'orchestrator',
        phase: 'GATE', statut: 'WAITING',
        resume: `Demande ${l.derniereDemande} publiée, en attente d'arbitrage.`,
        preuve: { type: 'handoff', ref: `docs/handoff/lots/${l.lot}/${l.derniereDemande}` },
        // Le contrat exige qu'un gate dise QUELLE question il pose. Il a
        // raison : « autorisation requise » sans objet ne se traite pas.
        gate: { required: true, who: 'orchestrator',
          question: `Arbitrer ${l.derniereDemande} du lot ${l.lot} ?` },
        occurredAt: horodatage,
      }));
    } else if (l.etat === 'en_developpement') {
      evts.push(evenement({
        lot: l.lot, run: 'handoff', acteur: 'claude', role: 'execution',
        phase: 'EXECUTION', statut: 'PROGRESS',
        resume: `Décision déposée, non consommée — le lot attend Claude, pas un arbitrage.`,
        preuve: { type: 'handoff', ref: `docs/handoff/lots/${l.lot}` },
        occurredAt: horodatage,
      }));
    }
  }
  return evts;
}

// ── Faits : les gardes ──────────────────────────────────────────────────
// Le code de sortie EST le fait. Un garde qui ne s'exécute pas ne produit
// aucun événement — surtout pas un « PASSED » par défaut.
const GARDES = [
  { nom: 'guardian-qa', fichier: 'guardian-qa.js', bloquant: true },
  { nom: 'verifier-apprentissage', fichier: 'verifier-apprentissage.js', bloquant: true },
  { nom: 'guardian-regles-metier', fichier: 'guardian-regles-metier.js', bloquant: false },
  { nom: 'guardian-bible', fichier: 'guardian-bible.js', bloquant: false },
  { nom: 'guardians-router', fichier: 'guardians-router.js', bloquant: false },
];

function evenementsGardes(lot, horodatage, { executer } = {}) {
  const lancer = executer || ((f) => {
    try { execFileSync('node', [path.join(__dirname, f)], { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); return 0; }
    catch (e) { return typeof e.status === 'number' ? e.status : null; }
  });
  const evts = [];
  for (const g of GARDES) {
    const code = lancer(g.fichier);
    if (code === null) continue; // fait indisponible : on se tait
    const propre = code === 0;
    evts.push(evenement({
      lot, run: 'gardes', acteur: g.nom, role: 'guardian',
      phase: 'GUARDIAN_REVIEW',
      // Un garde non bloquant qui trouve quelque chose n'est pas un ÉCHEC :
      // c'est un signalement. Les confondre ferait passer une dette connue
      // pour une régression, et l'écran crierait au feu chaque jour.
      statut: propre ? 'PASSED' : (g.bloquant ? 'FAILED' : 'BLOCKED'),
      resume: propre
        ? `${g.nom} : aucun signalement.`
        : `${g.nom} : signalements présents${g.bloquant ? ' (bloquant)' : ' (rapport, non bloquant)'}.`,
      preuve: { type: 'garde', ref: `outils/${g.fichier}` },
      occurredAt: horodatage,
    }));
  }
  return evts;
}

// ── Faits : la CI ───────────────────────────────────────────────────────
function evenementsCI(lot, horodatage) {
  let runs;
  try {
    runs = JSON.parse(execFileSync('gh',
      ['run', 'list', '--branch', 'config-par-environnement', '--event', 'push', '--limit', '1',
        '--json', 'databaseId,status,conclusion,headSha'],
      { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch (e) { return []; } // pas de réseau, pas d'événement inventé
  if (!Array.isArray(runs) || !runs.length) return [];
  const r = runs[0];
  const fini = r.status === 'completed';
  return [evenement({
    lot, run: String(r.databaseId), acteur: 'github-actions', role: 'ci',
    phase: 'CI',
    statut: !fini ? 'PROGRESS' : (r.conclusion === 'success' ? 'PASSED' : 'FAILED'),
    resume: `CI sur ${String(r.headSha).slice(0, 7)} : ${fini ? r.conclusion : r.status}.`,
    preuve: { type: 'ci', ref: String(r.databaseId) },
    occurredAt: horodatage,
  })];
}

// ── Faits : la barrière Production ──────────────────────────────────────
function evenementBarriere(lot, etatDep, horodatage) {
  const b = etatDep.barrieres || {};
  if (!b.lu) return []; // barrières illisibles : on ne conclut pas
  const tenue = !!b.brancheProtegee;
  return [evenement({
    lot, run: 'production', acteur: 'github', role: 'ci',
    phase: 'GATE',
    statut: tenue ? 'WAITING' : 'BLOCKED',
    resume: tenue
      ? `Branche production tenue (${(b.reglesEffectives || []).join(', ')}) — promotion soumise à autorisation humaine.`
      : 'Branche production SANS protection : un push direct l\'atteint. Le gate humain ne repose sur rien.',
    preuve: { type: 'protection', ref: 'refs/heads/production' },
    // PAS de human_gate ici, et c'est délibéré. Cet événement décrit l'état de
    // la BARRIÈRE, pas une promotion proposée. Marquer « autorisation requise »
    // en l'absence de toute demande ferait clignoter en permanence le compteur
    // « en attente de ton arbitrage » — celui-là doit rester allumé seulement
    // quand quelque chose attend réellement Frédéric, sinon il ne veut plus
    // rien dire et on cesse de le regarder.
    occurredAt: horodatage,
  })];
}

// ── Branches de travail en rade ─────────────────────────────────────────
//
// Le signal qui manquait le plus, parce qu'il est fait de silence : un run
// infonuagique pousse sa branche, écrit « Create PR » dans l'issue, et
// personne ne clique. Le 08/09/2026, trois branches attendaient ainsi, dont
// une portant une décision d'arbitrage — Frédéric croyait sa demande jamais
// traitée alors qu'elle l'avait été trois fois.
//
// Une ligne dans un journal de CI se rate aussi bien qu'une branche. Cet
// événement l'amène là où Frédéric regarde.
//
// PAS de human_gate quand tout est classé : le compteur « en attente de ton
// arbitrage » ne doit s'allumer que quand quelque chose l'attend réellement.
// Quand des branches sont en rade, en revanche, c'est bien à lui de trancher
// ce qu'on en fait — la garde, elle, ne fusionne rien.
function evenementBranchesEnRade(lot, horodatage, options = {}) {
  const controler = options.controler || (() => require(path.join(__dirname, 'garde-branches-en-rade.js')).controler());
  let r;
  try { r = controler(); } catch (e) { r = { indisponible: e.message }; }
  // Ne pas savoir n'est pas une information à afficher — et surtout pas un
  // « aucune branche en rade » qui se lirait « tout va bien ».
  if (!r || r.indisponible) return [];
  const enRade = (r.signalements || []).filter(s => s.bloquant);
  if (!enRade.length) {
    return [evenement({
      lot, run: 'branches', acteur: 'garde-branches-en-rade', role: 'guardian',
      phase: 'GUARDIAN_REVIEW', statut: 'PASSED',
      resume: `Aucune branche de travail en rade (${r.total} examinée(s)).`,
      preuve: { type: 'garde', ref: 'outils/garde-branches-en-rade.js' },
      occurredAt: horodatage,
    })];
  }
  const noms = enRade.map(s => s.branche).join(', ');
  return [evenement({
    lot, run: 'branches', acteur: 'garde-branches-en-rade', role: 'guardian',
    phase: 'GATE', statut: 'WAITING',
    resume: `${enRade.length} branche(s) de travail non rapatriée(s) et non classée(s) : ${noms}.`,
    preuve: { type: 'garde', ref: 'outils/garde-branches-en-rade.js' },
    // `gate`, et non `humanGate` : le premier jet employait l'autre nom, que
    // `evenement()` ignore en silence — l'événement partait sans son gate, et
    // le compteur de Frédéric serait resté éteint sur la seule chose qui
    // l'attendait vraiment.
    gate: { required: true, who: 'frederic',
      question: `Que fait-on de ${noms} — rapatrier, ou inscrire le sort au registre ?` },
    occurredAt: horodatage,
  })];
}

// ── Assemblage ──────────────────────────────────────────────────────────
function produire(options = {}) {
  const { maintenant, etatDep, executerGarde } = options;
  const horodatage = (maintenant || new Date()).toISOString();
  const etat = etatDep || deploiement.analyser();
  if (etat.erreur) {
    return { erreur: etat.erreur, evenements: [], rejetes: [] };
  }
  const lotCourant = etat.lotActif || 'NEXUS';

  const candidats = []
    .concat(evenementsRegistre(etat, horodatage))
    .concat(evenementsGardes(lotCourant, horodatage, { executer: executerGarde }))
    .concat(evenementsCI(lotCourant, horodatage))
    .concat(evenementBarriere(lotCourant, etat, horodatage))
    .concat(evenementBranchesEnRade(lotCourant, horodatage, { controler: options.controlerBranches }));

  const { evenements, rejetes } = filtrer(candidats);
  return { erreur: null, evenements, rejetes };
}

// Le contrat a le dernier mot. Un événement rejeté n'est pas corrigé pour
// passer : il est écarté et compté, parce qu'un producteur qui contourne son
// propre contrat ne produit plus une vérité, seulement du volume.
//
// Cette étape est une fonction à part, et exportée, pour une raison précise :
// tant qu'elle vivait à l'intérieur de `produire`, on ne pouvait l'éprouver
// qu'avec les événements réels du dépôt — tous valides. Une mutation
// supprimant le refus survivait donc à toute la suite. Un chemin de rejet qui
// n'est jamais emprunté par une épreuve n'est pas un garde, c'est une
// intention.
function filtrer(candidats) {
  const evenements = [];
  const rejetes = [];
  for (const c of candidats || []) {
    const erreurs = contrat.validerEvenementLive(c);
    if (erreurs.length) rejetes.push({ event_id: c && c.event_id, erreurs });
    else if (contrat.estDoublon(c, evenements)) rejetes.push({ event_id: c.event_id, erreurs: ['doublon'] });
    else evenements.push(c);
  }
  return { evenements, rejetes };
}


// ── Ingestion ───────────────────────────────────────────────────────────
// La correspondance entre la FORME de l'événement (`actor: {id, role}`) et
// les COLONNES de la table (`actor_id`, `actor_role`) vit ici, à un seul
// endroit. La laisser à chaque appelant garantirait qu'un jour deux
// correspondances divergent, et l'écran afficherait des rôles faux sans que
// rien ne le signale.
//
// Ce mode rend du SQL, il ne l'exécute PAS : la RLS réserve l'écriture au
// Créateur, et donner des identifiants à cet outil reviendrait à créer la
// capacité que la migration a délibérément refusée. Quelqu'un qui a le droit
// d'écrire pipe cette sortie ; le producteur reste sans pouvoir.
//
// `on conflict (event_id) do nothing` : combiné aux identifiants
// déterministes, rejouer l'ingestion entière est sans effet.
function litteral(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'object') return '\'' + JSON.stringify(v).replace(/'/g, "''") + '\'::jsonb';
  return '\'' + String(v).replace(/'/g, "''") + '\'';
}

function sqlIngestion(evenements) {
  if (!evenements.length) return '-- aucun événement à ingérer\n';
  const valeurs = evenements.map(e => '  (' + [
    litteral(e.event_id), litteral(e.occurred_at), litteral(e.lot_id), litteral(e.run_id),
    litteral(e.actor.id), litteral(e.actor.role), litteral(e.phase), litteral(e.status),
    litteral(e.summary), litteral(e.evidence || null), litteral(e.next_step || null),
    litteral(e.human_gate || null), litteral(e.source || null),
  ].join(', ') + ')').join(',\n');
  return 'insert into public.nexus_live_events\n'
    + '  (event_id, occurred_at, lot_id, run_id, actor_id, actor_role, phase, status,\n'
    + '   summary, evidence, next_step, human_gate, source)\nvalues\n'
    + valeurs + '\non conflict (event_id) do nothing;\n';
}

module.exports = { produire, filtrer, sqlIngestion, litteral, evenement, identifiant, evenementsRegistre, evenementsGardes, evenementBarriere, evenementBranchesEnRade, GARDES };

if (require.main === module) {
  const r = produire();
  if (r.erreur) { console.error('Producteur indisponible : ' + r.erreur); process.exit(1); }
  if (process.argv.includes('--sql')) {
    console.log(sqlIngestion(r.evenements));
  } else if (process.argv.includes('--resume')) {
    console.log(`${r.evenements.length} événement(s) produit(s), ${r.rejetes.length} rejeté(s).`);
    for (const e of r.evenements) console.log(`  [${e.phase}/${e.status}] ${e.actor.id} — ${e.summary}`);
    for (const x of r.rejetes) console.error(`  REJETÉ ${x.event_id} : ${x.erreurs.join(', ')}`);
  } else {
    for (const e of r.evenements) console.log(JSON.stringify(e));
  }
  process.exit(0);
}
