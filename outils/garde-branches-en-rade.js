#!/usr/bin/env node
'use strict';
// Branches en rade — le travail poussé que personne ne rapatrie.
//
// CE QUE CETTE GARDE EXISTE POUR EMPÊCHER. Le rail GitHub fonctionne : les
// runs infonuagiques coupent bien leur branche depuis `config-par-environnement`
// et y poussent un travail réel. Mais rien ne la fusionne. Le run écrit un lien
// « Create PR » dans l'issue, et s'arrête là. Personne ne clique.
//
// Le 08/09/2026, TROIS branches attendaient ainsi, dont deux portant la même
// décision d'arbitrage. Frédéric croyait sa demande jamais traitée : elle
// l'avait été trois fois. Le MVP NEXUS Live et le correctif CARB-004 avaient
// déjà connu le même sort. À chaque fois le travail existait, à chaque fois
// quelqu'un a dû le retrouver à la main, et à chaque fois le temps perdu l'a
// été sur la seule ressource qui ne se rattrape pas : la sienne.
//
// Un silence ne se remarque pas. C'est pourquoi il faut une machine pour le
// remarquer à notre place.
//
// POURQUOI UN REGISTRE, ET PAS SEULEMENT UN CALCUL. Mesuré sur le dépôt réel
// avant d'être câblé (règle QA-002) : 19 des 20 branches `claude/*` ne sont pas
// contenues dans le canonique, et ne le seront jamais — leur contenu a été
// transporté à la main, commit par commit, sans jamais devenir un ancêtre. Une
// garde qui les crierait toutes serait désactivée dans la semaine, et
// emporterait avec elle les vraies.
//
// Deux autres signaux ont été essayés et écartés, mesure à l'appui :
//   · « la branche a des commits en avance » → 19 signalements sur 20 ;
//   · « le contenu diffère du canonique »    → accuse jusqu'à la branche
//     `20260908-0213`, pourtant fusionnée proprement le jour même, parce que
//     le canonique a avancé depuis. Un signal qui accuse ce qu'on vient de
//     faire correctement est pire qu'un silence.
//
// Reste le seul signal exact : les commits sont-ils CONTENUS dans le canonique.
// Il est binaire et ne ment pas. On lui adjoint donc une mémoire — le registre
// des branches classées — sur le modèle des dérogations du Handoff : chaque
// branche écartée l'est NOMMÉMENT, avec un motif et le sha exact couvert.
//
// LE CLASSEMENT NE VAUT QUE POUR CE QU'IL A VU. Si la branche reçoit de
// nouveaux commits après son classement, l'entrée ne la couvre plus et elle
// réapparaît. Sans cela, classer une branche une fois l'aurait rendue muette à
// jamais, y compris pour du travail poussé le lendemain.
//
// CETTE GARDE NE FUSIONNE RIEN. Elle nomme et elle se tait ensuite. Fusionner
// suppose de lire le travail, et cette lecture n'appartient pas à un outil.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
const CANONIQUE = process.env.NEXUS_BRANCHE_CANONIQUE || 'config-par-environnement';
const PREFIXE = 'claude/';
const REGISTRE = path.join(RACINE, 'docs', 'handoff', 'BRANCHES-CLASSEES.json');
const BACKLOG = path.join(RACINE, 'docs', 'nexus', 'BACKLOG.md');
// Vocabulaire repris MOT POUR MOT de l'audit canonique
// `docs/gouvernance/2026-09-07-audit-travaux-claude-branches-isolees.md`, qui
// définissait déjà ces quatre sorts. Le premier jet de cette garde en avait
// inventé un second — deux vocabulaires pour la même notion, c'est-à-dire une
// seconde vérité à maintenir. Il n'en reste qu'un.
const SORTS = ['INTEGREE', 'SUPERSEDEE', 'A_REPRENDRE', 'HISTORIQUE_SANS_ACTION'];

function gitReel(...args) {
  return execFileSync('git', args, { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

// ── Le jugement, séparé de git pour être éprouvable ─────────────────────
//
// `branches`  : [{ nom, tete }]     — ce que le dépôt distant porte aujourd'hui
// `contenues` : Set de noms          — celles dont les commits sont dans le canonique
// `classees`  : entrées du registre
function analyser({ branches, contenues, classees, renvoisConnus }) {
  const signalements = [];
  const parNom = new Map((classees || []).map(c => [c && c.branche, c]));
  const vues = new Set();

  for (const b of branches) {
    vues.add(b.nom);
    const c = parNom.get(b.nom);
    if (contenues.has(b.nom)) {
      // Fusionnée : rien à dire. Une entrée de registre devient inutile — on le
      // signale sans en faire un défaut, pour que le registre ne se fossilise
      // pas en liste de noms que plus personne ne relit.
      if (c) signalements.push({ code: 'CLASSEMENT_INUTILE', bloquant: false, branche: b.nom,
        texte: `${b.nom} est fusionnée dans ${CANONIQUE} : son classement au registre n'a plus d'objet.` });
      continue;
    }
    if (!c) {
      signalements.push({ code: 'EN_RADE', bloquant: true, branche: b.nom,
        texte: `${b.nom} porte du travail absent de ${CANONIQUE} et n'est classée nulle part. `
          + 'Soit elle est rapatriée, soit son sort est inscrit au registre — mais elle ne peut pas rester muette.' });
      continue;
    }
    // Une entrée mal formée ne classe RIEN. Fail closed : c'est exactement là
    // qu'un classement bâclé ferait taire une branche sans que personne l'ait
    // décidé.
    const defauts = validerEntree(c, renvoisConnus);
    if (defauts.length) {
      signalements.push({ code: 'CLASSEMENT_INVALIDE', bloquant: true, branche: b.nom,
        texte: `${b.nom} : classement inexploitable (${defauts.join(' ; ')}) — la branche reste donc en rade.` });
      continue;
    }
    if (c.tete !== b.tete) {
      signalements.push({ code: 'REPRISE', bloquant: true, branche: b.nom,
        texte: `${b.nom} a reçu du travail APRÈS son classement (classée sur ${String(c.tete).slice(0, 7)}, `
          + `elle est aujourd'hui sur ${String(b.tete).slice(0, 7)}). Un classement ne couvre que ce qu'il a vu.` });
    }
  }

  for (const c of classees || []) {
    if (c && c.branche && !vues.has(c.branche)) {
      signalements.push({ code: 'CLASSEMENT_ORPHELIN', bloquant: false, branche: c.branche,
        texte: `${c.branche} est classée au registre mais n'existe plus sur le dépôt distant.` });
    }
  }
  return signalements;
}

function validerEntree(c, renvoisConnus) {
  const d = [];
  if (!/^[0-9a-f]{40}$/.test(String(c.tete || ''))) d.push('`tete` doit être un sha complet');
  if (!SORTS.includes(c.sort)) d.push(`\`sort\` hors vocabulaire (${SORTS.join('|')})`);
  if (!String(c.motif || '').trim()) d.push('`motif` manquant — classer sans dire pourquoi ne classe rien');
  // `A_REPRENDRE` reconnaît qu'il reste du travail. Sans destination, ce
  // classement ferait taire la garde sur une dette dont plus rien ne porterait
  // la trace : le registre deviendrait un placard. Le travail en attente se
  // suit au Backlog, pas dans une alarme d'intégration.
  if (c.sort === 'A_REPRENDRE') {
    const renvoi = String(c.renvoi || '').trim();
    if (!renvoi) {
      d.push('`renvoi` manquant — A_REPRENDRE doit désigner où la dette est suivie (entrée Backlog ou lot)');
    } else if (renvoisConnus && !renvoisConnus.has(renvoi)) {
      // Un renvoi vers une entrée qui n'existe pas est un placard avec une
      // belle étiquette : il rassure sans rien suivre. On ne se contente donc
      // pas de la FORME de l'identifiant, on vérifie qu'il désigne une entrée
      // réelle du Backlog.
      d.push(`\`renvoi\` ${renvoi} ne désigne aucune entrée du Backlog`);
    }
  }
  return d;
}

// ── La couche git, qui peut échouer et doit le DIRE ─────────────────────
// `git` est injectable pour que les modes de défaillance soient éprouvables :
// un clone superficiel ou une branche canonique absente ne se fabriquent pas
// depuis le dépôt réel, et une mutation supprimant leur garde y survivait en
// silence. Ce qu'on ne peut pas provoquer, on ne l'a pas vérifié.
function releverDepot(options = {}) {
  const git = options.git || gitReel;
  let refCanonique;
  for (const candidat of [`origin/${CANONIQUE}`, CANONIQUE]) {
    try { git('rev-parse', '--verify', `${candidat}^{commit}`); refCanonique = candidat; break; } catch (e) {}
  }
  if (!refCanonique) {
    return { erreur: `Branche canonique ${CANONIQUE} introuvable — ne rien conclure de ce silence.` };
  }
  let lignes;
  try { lignes = git('for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/remotes/origin').split('\n').filter(Boolean); }
  catch (e) { return { erreur: 'Références distantes illisibles — ne rien conclure de ce silence.' }; }
  if (!lignes.length) {
    // Un clone superficiel n'a pas les branches distantes. Répondre « aucune
    // branche en rade » serait alors un mensonge tranquille.
    return { erreur: 'Aucune référence distante dans ce clone (clone superficiel ?) — ne rien conclure de ce silence.' };
  }
  const branches = [];
  const contenues = new Set();
  for (const l of lignes) {
    const [ref, sha] = l.split(' ');
    const nom = ref.replace(/^origin\//, '');
    if (!nom.startsWith(PREFIXE)) continue;
    branches.push({ nom, tete: sha });
    let avance;
    try { avance = git('rev-list', '--count', `${refCanonique}..${ref}`); }
    catch (e) { return { erreur: `Impossible de situer ${nom} par rapport à ${CANONIQUE}.` }; }
    if (avance === '0') contenues.add(nom);
  }
  return { branches, contenues };
}

// Les identifiants réellement présents au Backlog. Absence de fichier =
// aucun renvoi vérifiable : on rend `null`, et la validation cesse alors
// d'exiger ce qu'elle ne peut pas contrôler plutôt que d'inventer un refus.
function renvoisDuBacklog(texte) {
  if (texte == null) return null;
  const ids = new Set();
  for (const m of texte.matchAll(/^\|\s*([A-Z]+-\d+)\s*\|/gm)) ids.add(m[1]);
  return ids;
}

function lireRegistre() {
  if (!fs.existsSync(REGISTRE)) return { classees: [] };
  try {
    const j = JSON.parse(fs.readFileSync(REGISTRE, 'utf8'));
    if (!Array.isArray(j.classees)) return { erreur: `${path.relative(RACINE, REGISTRE)} : \`classees\` doit être un tableau.` };
    return { classees: j.classees };
  } catch (e) {
    return { erreur: `${path.relative(RACINE, REGISTRE)} illisible : ${e.message}` };
  }
}

function controler(options = {}) {
  const depot = releverDepot(options);
  if (depot.erreur) return { indisponible: depot.erreur };
  const registre = lireRegistre();
  if (registre.erreur) return { indisponible: registre.erreur };
  const renvoisConnus = renvoisDuBacklog(fs.existsSync(BACKLOG) ? fs.readFileSync(BACKLOG, 'utf8') : null);
  return { signalements: analyser({ branches: depot.branches, contenues: depot.contenues,
    classees: registre.classees, renvoisConnus }), total: depot.branches.length };
}

module.exports = { analyser, validerEntree, renvoisDuBacklog, releverDepot, controler, SORTS, CANONIQUE, PREFIXE };

if (require.main === module) {
  const r = controler();
  if (r.indisponible) {
    console.error('Branches en rade : INDISPONIBLE — ' + r.indisponible);
    process.exit(1);
  }
  const bloquants = r.signalements.filter(s => s.bloquant);
  const avertissements = r.signalements.filter(s => !s.bloquant);
  for (const s of bloquants) console.error(`EN RADE — ${s.texte}`);
  for (const s of avertissements) console.log(`avertissement — ${s.texte}`);
  if (!bloquants.length) {
    console.log(`Branches en rade : aucune (${r.total} branche(s) ${PREFIXE}* examinée(s)).`);
    process.exit(0);
  }
  console.error(`\n${bloquants.length} branche(s) en rade sur ${r.total} examinée(s).`);
  console.error('Rapatrier, ou inscrire le sort au registre docs/handoff/BRANCHES-CLASSEES.json.');
  process.exit(1);
}
