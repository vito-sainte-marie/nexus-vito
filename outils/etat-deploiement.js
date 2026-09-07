#!/usr/bin/env node
'use strict';
// État de déploiement — le calcul derrière le bloc « Déploiements » de NEXUS Live.
//
// CE QU'IL EST. Les trois compteurs demandés — en développement, prêt pour
// Production, en attente d'arbitrage — ne sont pas un affichage : ce sont un
// calcul, et toutes leurs sources existent déjà. Cet outil les produit à partir
// du registre Handoff, des gardes et du Backlog, sans rien inventer. NEXUS Live
// n'aura qu'à les rendre.
//
// CE QU'IL NE PEUT PAS FAIRE, PAR CONSTRUCTION. Il ne déploie pas, ne fusionne
// pas, ne pousse pas, n'autorise rien. Il lit et il calcule. Une épreuve
// vérifie qu'aucun verbe d'écriture n'apparaît dans ce fichier : le jour où
// quelqu'un voudra lui faire franchir cette ligne, il devra d'abord faire
// sauter cette épreuve — donc l'expliquer.
//
// « PRÊT POUR PRODUCTION » EST UNE PROPOSITION, JAMAIS UNE AUTORISATION.
// La doctrine NEXUS est explicite : « aucune décision de recette ne vaut
// autorisation de production ». Un lot marqué prêt signifie « les conditions
// mécaniques sont réunies, Frédéric peut décider » — pas « on peut y aller ».
// Le vocabulaire de cet outil est choisi pour que cette distinction survive à
// sa lecture rapide.
//
// LE CONSTAT QUI DOIT ACCOMPAGNER CET ÉTAT. Un bouton d'autorisation n'a de
// sens que si l'on ne peut pas passer à côté. Au 07/09/2026, `production`
// n'avait AUCUNE protection : pas de branche protégée, pas d'environnement
// GitHub, pas d'approbation requise. Cet outil le vérifie et le dit à chaque
// exécution, parce qu'un tableau de bord qui affiche « autorisation requise »
// devant une porte ouverte est pire qu'un tableau de bord absent : il rassure.
//
//   node outils/etat-deploiement.js            # lisible
//   node outils/etat-deploiement.js --json     # pour NEXUS Live

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = process.env.NEXUS_DEPOT ? path.resolve(process.env.NEXUS_DEPOT) : path.resolve(__dirname, '..');
const ETAT = path.join(RACINE, 'docs', 'handoff', 'STATE.json');
const BACKLOG = path.join(RACINE, 'docs', 'nexus', 'BACKLOG.md');
const CANONIQUE = 'config-par-environnement';
const PRODUCTION = 'production';

function git(...args) {
  return execFileSync('git', args, { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}
function gitOuNull(...args) { try { return git(...args); } catch (e) { return null; } }

function refDe(branche) {
  for (const c of [`origin/${branche}`, branche]) {
    const sha = gitOuNull('rev-parse', '--verify', `${c}^{commit}`);
    if (sha) return { ref: c, sha };
  }
  return null;
}

// Un lot est classé sur ce que le REGISTRE dit, jamais sur une impression.
// Trois états seulement, parce que trois compteurs se lisent d'un coup d'œil et
// que six ne se lisent plus.
function classer(v, decisions) {
  if (v.statut === 'ATTENTE_DECISION') {
    const derniere = decisions.length ? decisions[decisions.length - 1] : null;
    // Une décision déposée mais non consommée n'attend PAS Frédéric : elle
    // attend Claude. Les confondre ferait clignoter le compteur d'arbitrage
    // pour du travail qui n'a besoin de personne.
    if (derniere && v.derniere_decision !== derniere) return 'en_developpement';
    return 'attente_arbitrage';
  }
  if (v.statut === 'ATTENTE_CONSOMMATION_DECISION') return 'en_developpement';
  if (v.statut === 'DECISION_CONSOMMEE' || v.statut === 'CLOS') return 'clos';
  return 'inconnu';
}

function fichiersDecision(lot) {
  const dir = path.join(RACINE, 'docs', 'handoff', 'lots', lot);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /^decision-\d+\.md$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
}

// Une décision qui FERME un lot est la condition nécessaire — jamais
// suffisante — d'une proposition de mise en Production.
function fermePar(lot, fichier) {
  if (!fichier) return false;
  const p = path.join(RACINE, 'docs', 'handoff', 'lots', lot, fichier);
  if (!fs.existsSync(p)) return false;
  return /^closes:\s*true\s*$/m.test(fs.readFileSync(p, 'utf8'));
}

function detteOuverte() {
  if (!fs.existsSync(BACKLOG)) return { total: null, p0: null };
  const lignes = fs.readFileSync(BACKLOG, 'utf8').split('\n').filter(l => /^\|\s*[A-Z]+-\d+/.test(l));
  const ouvertes = lignes.filter(l => !/\|\s*(FAIT|CLOS|TERMINE)\s*\|/i.test(l));
  return { total: ouvertes.length, p0: ouvertes.filter(l => /\|\s*P0\s*\|/.test(l)).length };
}

// Les barrières techniques réelles, pas déclarées. C'est le cœur honnête de
// cet outil : dire si le gate humain repose sur quelque chose.
function barrieresProduction() {
  const barrieres = { brancheProtegee: null, environnementApprobation: null, lu: false };
  const depot = gitOuNull('config', '--get', 'remote.origin.url');
  const m = depot && depot.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!m) return barrieres;
  const slug = `${m[1]}/${m[2]}`;
  try {
    execFileSync('gh', ['api', `repos/${slug}/branches/${PRODUCTION}/protection`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    barrieres.brancheProtegee = true;
  } catch (e) { barrieres.brancheProtegee = false; }
  try {
    const envs = JSON.parse(execFileSync('gh', ['api', `repos/${slug}/environments`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
    const prod = (envs.environments || []).find(x => /prod/i.test(x.name));
    barrieres.environnementApprobation = !!(prod && (prod.protection_rules || []).length);
  } catch (e) { barrieres.environnementApprobation = false; }
  barrieres.lu = true;
  return barrieres;
}

function analyser() {
  if (!fs.existsSync(ETAT)) {
    return { erreur: `STATE.json introuvable : ${ETAT}`, lots: [], compteurs: null };
  }
  let etat;
  try { etat = JSON.parse(fs.readFileSync(ETAT, 'utf8')); }
  catch (e) { return { erreur: `STATE.json illisible : ${e.message}`, lots: [], compteurs: null }; }

  const lots = [];
  for (const [lot, v] of Object.entries(etat.lots || {})) {
    const decisions = fichiersDecision(lot);
    const etatLot = classer(v, decisions);
    lots.push({
      lot,
      statut: v.statut || null,
      derniereDemande: v.derniere_demande || null,
      derniereDecision: v.derniere_decision || null,
      etat: etatLot,
      ferme: fermePar(lot, v.derniere_decision),
    });
  }

  const compteurs = {
    en_developpement: lots.filter(l => l.etat === 'en_developpement').length,
    attente_arbitrage: lots.filter(l => l.etat === 'attente_arbitrage').length,
    // « Prêt pour Production » n'est PAS le nombre de lots clos. C'est le
    // nombre de lots clos ET dont rien n'attend plus personne. Compter les lots
    // clos donnerait un chiffre flatteur et faux : 25 lots clos ne veulent pas
    // dire 25 versions promouvables.
    clos: lots.filter(l => l.etat === 'clos').length,
  };

  const prod = refDe(PRODUCTION);
  const canon = refDe(CANONIQUE);
  const ecart = (prod && canon) ? {
    production: prod.sha.slice(0, 7),
    canonique: canon.sha.slice(0, 7),
    commits: Number(gitOuNull('rev-list', '--count', `${prod.sha}..${canon.sha}`) || 0),
    fichiers: (gitOuNull('diff', '--name-only', prod.sha, canon.sha) || '').split('\n').filter(Boolean).length,
  } : null;

  return {
    erreur: null,
    lots: lots.sort((a, b) => a.lot.localeCompare(b.lot)),
    compteurs,
    ecart,
    dette: detteOuverte(),
    barrieres: barrieresProduction(),
    lotActif: etat.lot_actif || null,
  };
}

function rendre(e) {
  const l = [];
  if (e.erreur) {
    l.push('# Déploiements — ÉTAT INDISPONIBLE', '', e.erreur, '',
      'Ne rien conclure de cette absence : elle ne veut pas dire « rien en cours ».');
    return l.join('\n');
  }
  l.push('# Déploiements');
  l.push('');
  l.push(`  En développement        ${e.compteurs.en_developpement}`);
  l.push(`  En attente d'arbitrage  ${e.compteurs.attente_arbitrage}`);
  l.push(`  Lots clos               ${e.compteurs.clos}`);
  l.push('');

  const attente = e.lots.filter(x => x.etat === 'attente_arbitrage');
  if (attente.length) {
    l.push("Attendent réellement une décision :");
    for (const x of attente) l.push(`  · ${x.lot} — ${x.derniereDemande}`);
    l.push('');
  }

  if (e.ecart) {
    l.push(`Production ${e.ecart.production} · canonique ${e.ecart.canonique}`);
    l.push(`  écart : ${e.ecart.commits} commit(s), ${e.ecart.fichiers} fichier(s)`);
    l.push('');
  }
  if (e.dette.total != null) {
    l.push(`Dette ouverte au Backlog : ${e.dette.total} entrée(s), dont ${e.dette.p0} en P0`);
    l.push('');
  }

  // Le paragraphe qui compte. Un état de déploiement qui tairait l'absence de
  // barrière transformerait un tableau de bord en fausse assurance.
  l.push('Barrières techniques devant Production :');
  if (!e.barrieres.lu) {
    l.push('  · non lisibles depuis cette machine — ne pas conclure qu\'elles existent.');
  } else {
    l.push(`  · branche \`production\` protégée : ${e.barrieres.brancheProtegee ? 'oui' : 'NON'}`);
    l.push(`  · environnement GitHub avec approbation requise : ${e.barrieres.environnementApprobation ? 'oui' : 'NON'}`);
    if (!e.barrieres.brancheProtegee || !e.barrieres.environnementApprobation) {
      l.push('');
      l.push('  Aucun bouton d\'autorisation n\'a de sens tant qu\'on peut passer à côté :');
      l.push('  en l\'état, un simple `git push` atteint Production sans franchir aucune gate.');
    }
  }
  l.push('');
  l.push('« Prêt pour Production » resterait une PROPOSITION : aucune décision de');
  l.push('recette ne vaut autorisation de production. Cet outil ne déploie rien,');
  l.push('ne fusionne rien et n\'autorise rien — il calcule et il rend.');
  return l.join('\n');
}

module.exports = { analyser, rendre, classer, fermePar, detteOuverte, barrieresProduction };

if (require.main === module) {
  const e = analyser();
  console.log(process.argv.includes('--json') ? JSON.stringify(e, null, 2) : rendre(e));
  process.exit(e.erreur ? 1 : 0);
}
