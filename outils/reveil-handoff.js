#!/usr/bin/env node
'use strict';
// Réveil automatique — le Handoff est déjà un bus d'événements ; il ne lui
// manquait qu'une horloge.
//
// POURQUOI. Jusqu'au 07/09/2026, il fallait que Frédéric écrive « @claude »
// sur l'issue #28 pour qu'un travail reprenne, y compris quand la décision
// attendait déjà, déposée et lisible, dans le registre. L'humain servait de
// facteur entre deux agents — exactement ce que la gouvernance autonome v2
// dit qu'il ne doit pas faire (« Frédéric : ne doit pas servir de facteur
// entre agents pour les problèmes déterministes »).
//
// Cet outil ne décide rien et ne réveille personne : il RÉPOND à une question,
// « reste-t-il une décision déposée que personne n'a consommée ? ». Un
// déclencheur l'appellera et n'ouvrira une session que si la réponse est oui.
// C'est ce qui sépare une horloge utile d'un réveil toutes les heures pour
// rien.
//
// ÉTAT RÉEL AU 07/09/2026 : OUTIL PRÊT, AUCUN DÉCLENCHEUR ACTIF.
// Rien n'appelle ce fichier automatiquement aujourd'hui. Le `schedule` GitHub
// envisagé a été REFUSÉ par `decision-1.md` du lot
// NEXUS-ORCHESTRATION-AUTONOMIE-1-20260907 : il ne peut vivre que sur la
// branche par défaut, et `main` reste fermée. Le déclencheur relève du lot
// ORCH-001 au Backlog — un control-plane externe, auditable et révocable, sans
// modification de `main` ni nouveau secret. Tant qu'il n'existe pas, cet outil
// ne doit être présenté nulle part comme « un réveil autonome » : il s'appelle
// à la main, ou depuis un run déjà déclenché autrement.
//
// CE QU'IL NE FAIT PAS. Il ne consomme pas, n'écrit pas dans STATE.json, ne
// pousse rien, ne touche à aucune branche. Il lit et il conclut.
//
//   node outils/reveil-handoff.js            # texte lisible, sortie 0
//   node outils/reveil-handoff.js --json     # objet complet
//
// Sortie GitHub Actions : écrit `reveil=true|false` et `lot=<LOT_ID>` dans
// $GITHUB_OUTPUT quand la variable existe, pour conditionner l'étape suivante.

const fs = require('fs');
const path = require('path');

// La lecture du registre appartient à handoff.js (ARCH-001). On la lui
// emprunte plutôt que d'en écrire une seconde qui divergerait au premier
// changement de format.
const handoff = require(path.join(__dirname, 'handoff.js'));

function etatRegistre() {
  const chemin = handoff.CHEMINS.ETAT;
  if (!fs.existsSync(chemin)) return null;
  try { return JSON.parse(fs.readFileSync(chemin, 'utf8')); } catch (e) { return { illisible: e.message }; }
}

// Un lot appelle un réveil quand une décision existe dans le registre et que
// STATE.json ne la déclare pas consommée. Deux formes distinctes, volontairement
// séparées parce qu'elles n'appellent pas la même suite :
//
//   DECISION_NON_CONSOMMEE  — la dernière décision n'est pas celle qu'on a
//                             marquée consommée. Il y a du travail.
//   DECISION_PERIMEE        — une décision existe, mais elle répond à une
//                             demande qui n'est plus la demande active.
//                             `handoff.js consommer` la refusera ; réveiller
//                             Claude produirait un run qui échoue. C'est un
//                             appel à l'humain, pas à l'agent.
function examiner(etat) {
  const lots = [];
  for (const [lot, v] of Object.entries((etat && etat.lots) || {})) {
    const decisions = handoff.echanges(lot, 'decision');
    const derniere = handoff.dernier(decisions);
    if (!derniere) continue;
    if (v.statut === 'DECISION_CONSOMMEE' && v.derniere_decision === derniere.fichier) continue;

    const demandes = handoff.echanges(lot, 'request');
    const active = handoff.dernier(demandes);
    const env = handoff.lireEnveloppe(path.join(handoff.CHEMINS.LOTS, lot, derniere.fichier));
    const vise = env && env.env && env.env.in_reply_to
      ? path.basename(String(env.env.in_reply_to).trim()) : null;
    const perimee = !!(active && vise && vise !== active.fichier);

    lots.push({
      lot,
      decision: derniere.fichier,
      demande_active: active ? active.fichier : null,
      repond_a: vise,
      statut: v.statut || null,
      motif: perimee ? 'DECISION_PERIMEE' : 'DECISION_NON_CONSOMMEE',
    });
  }
  return lots;
}

function analyser() {
  const etat = etatRegistre();
  if (!etat) return { reveil: false, motif: 'REGISTRE_ABSENT', lots: [],
    message: 'docs/handoff/STATE.json absent — rien à réveiller, mais rien ne va bien non plus.' };
  if (etat.illisible) return { reveil: false, motif: 'REGISTRE_ILLISIBLE', lots: [],
    message: `STATE.json illisible (${etat.illisible}) — un réveil sur un registre corrompu ferait plus de mal que de bien.` };

  const lots = examiner(etat);
  const aConsommer = lots.filter(l => l.motif === 'DECISION_NON_CONSOMMEE');
  const perimees = lots.filter(l => l.motif === 'DECISION_PERIMEE');

  if (aConsommer.length) {
    const premier = aConsommer[0];
    return { reveil: true, motif: 'DECISION_NON_CONSOMMEE', lot: premier.lot, lots,
      message: `Réveil : ${premier.lot}/${premier.decision} est déposée et non consommée.` +
        (aConsommer.length > 1 ? ` (${aConsommer.length} lots concernés ; le premier est traité.)` : '') };
  }
  if (perimees.length) {
    // Pas de réveil : `consommer` refuserait, et un run qui échoue à coup sûr
    // n'apprend rien à personne. GOV-001 interdit d'ailleurs de rejouer un
    // réveil identique. C'est un cas pour l'humain.
    const p = perimees[0];
    return { reveil: false, motif: 'DECISION_PERIMEE', lot: p.lot, lots,
      message: `Pas de réveil : ${p.lot}/${p.decision} répond à ${p.repond_a}, ` +
        `mais la demande active est ${p.demande_active}. La consommation serait refusée — ` +
        'une décision sur la demande active doit être rendue par un humain.' };
  }
  return { reveil: false, motif: 'RIEN_A_FAIRE', lots: [],
    message: 'Rien à réveiller : toutes les décisions déposées sont consommées.' };
}

function ecrireSortieActions(r) {
  const fichier = process.env.GITHUB_OUTPUT;
  if (!fichier) return;
  const lignes = [`reveil=${r.reveil}`, `motif=${r.motif}`, `lot=${r.lot || ''}`];
  fs.appendFileSync(fichier, lignes.join('\n') + '\n');
}

module.exports = { analyser, examiner };

if (require.main === module) {
  const r = analyser();
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(r.message);
    for (const l of r.lots) console.log(`  - ${l.lot} : ${l.decision} (${l.motif}), statut ${l.statut}`);
  }
  ecrireSortieActions(r);
  // Toujours 0 : ce n'est pas une garde, c'est une question. Un code d'erreur
  // ferait passer « rien à faire » pour une panne, et la CI deviendrait rouge
  // chaque fois que tout va bien.
  process.exit(0);
}
