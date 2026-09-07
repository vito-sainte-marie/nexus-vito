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
// sens que si l'on ne peut pas passer à côté. Au matin du 07/09/2026,
// `production` n'avait AUCUNE protection ; un ruleset a été posé le soir même
// et vérifié par une tentative de push réellement refusée. Cet outil relit
// cette barrière à CHAQUE exécution plutôt que de la tenir pour acquise : une
// règle se désactive aussi vite qu'elle se pose, et un tableau de bord qui
// affiche « autorisation requise » devant une porte rouverte est pire qu'un
// tableau de bord absent — il rassure.
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
  // `rules/branches/<b>` et non `branches/<b>/protection` : le second est
  // l'API des protections CLASSIQUES et rend 404 quand la branche est
  // protégée par un ruleset — ce qui est le cas ici depuis le 07/09/2026.
  // Première version de cette fonction : elle annonçait « NON protégée » sur
  // une branche qui l'était. Un tableau de bord qui sous-estime une protection
  // est moins dangereux qu'un qui la surestime, mais il reste faux, et un
  // chiffre faux dans un tableau de bord ne se discute pas : il se croit.
  // `rules/branches` rend les règles EFFECTIVES, quelle qu'en soit la source.
  try {
    const regles = JSON.parse(execFileSync('gh', ['api', `repos/${slug}/rules/branches/${PRODUCTION}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
    const types = new Set((regles || []).map(r => r.type));
    barrieres.brancheProtegee = types.has('pull_request') || types.has('non_fast_forward');
    barrieres.reglesEffectives = [...types].sort();
    barrieres.prObligatoire = types.has('pull_request');
    barrieres.ciExigee = types.has('required_status_checks');
  } catch (e) { barrieres.brancheProtegee = false; barrieres.reglesEffectives = []; }
  try {
    const envs = JSON.parse(execFileSync('gh', ['api', `repos/${slug}/environments`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
    const prod = (envs.environments || []).find(x => /prod/i.test(x.name));
    barrieres.environnementApprobation = !!(prod && (prod.protection_rules || []).length);
  } catch (e) { barrieres.environnementApprobation = false; }
  barrieres.lu = true;
  return barrieres;
}

// Les gestes que Claude ne peut pas faire, et dont l'oubli ne se voit nulle
// part. Un secret manquant ne casse rien : l'étape CI se déclare simplement
// indisponible et passe. Un PIN compromis ne casse rien non plus — jusqu'au
// jour où quelqu'un s'en sert. Ces deux dettes sont donc silencieuses par
// nature, et c'est exactement pourquoi elles méritent d'être répétées à chaque
// lecture de l'état plutôt que confiées à la mémoire de quiconque.
//
// AUCUNE VALEUR DE SECRET N'EST LUE ICI. `gh secret list` ne rend que des NOMS
// et des DATES ; GitHub ne restitue jamais une valeur, y compris à son
// propriétaire. Cet outil s'en tient à « ce nom existe-t-il » et « depuis
// quand », ce qui suffit à savoir si le geste a été fait.
const PIN_DIVULGUE_LE = '2026-09-07T12:00:00Z';

function gestesHumains() {
  const gestes = [];
  let secrets = null;
  try {
    secrets = JSON.parse(execFileSync('gh', ['secret', 'list', '--json', 'name,updatedAt'],
      { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch (e) {
    return [{ code: 'SECRETS_ILLISIBLES', fait: null,
      texte: 'Secrets non lisibles depuis cette machine — ne pas conclure que les gestes sont faits.' }];
  }
  const par = new Map(secrets.map(s => [s.name, s.updatedAt]));

  gestes.push({
    code: 'SECRET_ECRITURE_TEST',
    fait: par.has('SUPABASE_TEST_DB_URL_WRITE'),
    texte: par.has('SUPABASE_TEST_DB_URL_WRITE')
      ? 'Secret d\'écriture Test présent — la CI peut semer le jeu de recette seule.'
      : 'Créer le secret SUPABASE_TEST_DB_URL_WRITE (rôle Test en écriture, jamais service_role). '
        + 'Sans lui, l\'étape de semis se déclare indisponible et la recette part sur des données absentes.',
  });

  const pin = par.get('NEXUS_TEST_PIN');
  const rotate = pin ? pin > PIN_DIVULGUE_LE : null;
  gestes.push({
    code: 'PIN_RECETTE',
    fait: rotate,
    texte: rotate
      ? 'PIN de recette renouvelé après sa divulgation.'
      : 'Changer le PIN de recette : il a été écrit en clair dans une conversation le 07/09/2026, '
        + 'le dépôt est public et les noms de connexion y figurent. Le secret n\'a pas bougé depuis. '
        + 'Aucune donnée de production n\'est exposée, mais une recette en cours peut être corrompue.',
  });
  return gestes;
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
    gestes: gestesHumains(),
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
    l.push(`  · branche \`production\` protégée : ${e.barrieres.brancheProtegee ? 'oui' : 'NON'}` +
      (e.barrieres.reglesEffectives && e.barrieres.reglesEffectives.length
        ? ` (${e.barrieres.reglesEffectives.join(', ')})` : ''));
    l.push(`  · environnement GitHub avec approbation requise : ${e.barrieres.environnementApprobation ? 'oui' : 'NON'}`);
    // Deux absences très différentes, à ne pas confondre dans le même
    // avertissement : la branche non protégée est une porte ouverte, tandis
    // que l'environnement manquant n'est une lacune QUE lorsqu'un job de
    // déploiement existe. Les dire d'une seule voix ferait crier au danger
    // devant une barrière déjà posée — et un tableau de bord qui crie à tort
    // cesse d'être lu.
    if (!e.barrieres.brancheProtegee) {
      l.push('');
      l.push('  Aucun bouton d\'autorisation n\'a de sens tant qu\'on peut passer à côté :');
      l.push('  en l\'état, un simple `git push` atteint Production sans franchir aucune gate.');
    } else if (!e.barrieres.environnementApprobation) {
      l.push('');
      l.push('  La branche est tenue : aucun push direct, PR obligatoire' +
        (e.barrieres.ciExigee ? ', CI verte exigée.' : '.'));
      l.push('  L\'environnement d\'approbation reste à créer — il ne mordra toutefois');
      l.push('  que le jour où un job de workflow déclarera `environment: production`.');
      l.push('  Aujourd\'hui aucun ne le fait : le déploiement passe par Cloudflare,');
      l.push('  hors Actions. C\'est donc la règle de branche qui protège réellement.');
    }
  }
  l.push('');
  const restants = (e.gestes || []).filter(g => g.fait !== true);
  if (restants.length) {
    l.push('Gestes qui n\'appartiennent qu\'à Frédéric :');
    for (const g of restants) l.push(`  · ${g.texte}`);
    l.push('');
  }
  l.push('« Prêt pour Production » resterait une PROPOSITION : aucune décision de');
  l.push('recette ne vaut autorisation de production. Cet outil ne déploie rien,');
  l.push('ne fusionne rien et n\'autorise rien — il calcule et il rend.');
  return l.join('\n');
}

module.exports = { analyser, rendre, classer, fermePar, detteOuverte, barrieresProduction, gestesHumains };

if (require.main === module) {
  const e = analyser();
  console.log(process.argv.includes('--json') ? JSON.stringify(e, null, 2) : rendre(e));
  process.exit(e.erreur ? 1 : 0);
}
