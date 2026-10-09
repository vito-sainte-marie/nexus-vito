#!/usr/bin/env node
'use strict';
// Capacités de canal — une autorisation ne confère pas une capacité.
//
// LE DÉFAUT QUE CECI SUPPRIME. Le 09/10/2026, le GO Production de Frédéric sur
// le lot G1 est arrivé par le seul chemin dont il disposait : un commentaire
// d'issue portant `@claude`. Ce chemin réveille `.github/workflows/claude.yml`,
// dont l'enveloppe Supabase est « Test, lecture seule » — par construction, et
// c'est très bien ainsi. Claude s'y est arrêté sans écrire une ligne, ce qui
// était la seule conduite correcte ; mais il avait fallu brûler un run entier
// pour découvrir que le geste mandaté était impossible, puis publier une
// demande entière pour l'expliquer. Le GO était valide. L'exécutant ne l'était
// pas. Rien, dans le dispositif, ne savait distinguer les deux.
//
// CE QUE CE MODULE AJOUTE. `CANAUX.json` répond à « où poster pour ce rôle ».
// Ce module répond à une question différente et jusqu'ici non posée : « ce
// canal peut-il réellement accomplir le geste ? ». Les deux réponses se lisent
// dans des fichiers écrits, jamais dans du code : changer l'enveloppe d'un
// canal est une édition de `docs/handoff/CAPACITES-CANAL.json`.
//
// POURQUOI CHAQUE VALEUR PORTE UNE PREUVE. `outils/preflight-capacites.js` pose
// déjà la règle : une capacité DÉCLARÉE est une opinion, une capacité EXERCÉE
// est un fait. Une enveloppe entièrement déclarative se périmerait en silence,
// et la première chose qu'elle laisserait passer serait justement l'élargissement
// de surface qu'elle est censée empêcher. Deux types de preuve sont donc admis,
// et un seul suffit par valeur sensible :
//   EXERCEE  — une commande, une date, un résultat. Le refus mesuré d'un canal
//              est une preuve aussi recevable que son succès.
//   ENVELOPPE — un fichier du dépôt qui BORNE le canal, relu sur le vrai dépôt
//              par l'épreuve. Pour un workflow, la relecture ne cherche pas des
//              mots interdits : elle énumère les secrets et les permissions
//              RÉELLEMENT référencés, commentaires exclus, et les compare à une
//              liste close. Un contrôle par sous-chaîne rendait un faux positif
//              dès le premier essai sur le vrai dépôt — `claude.yml` nomme
//              `service_role` dans le commentaire qui l'INTERDIT — et un
//              détecteur à faux positifs se fait débrancher, emportant avec lui
//              les vrais écarts. Une liste close, elle, rougit exactement quand
//              un secret ou une permission apparaît, disparaît ou change. Si le
//              fichier devient illisible, la vérification ÉCHOUE : un invariant
//              invérifiable est un échec, pas une tolérance.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FICHIER_REGISTRE = 'docs/handoff/CAPACITES-CANAL.json';

// Liste FERMÉE des valeurs. Un « PEUT-ÊTRE » finirait traité comme un OUI au
// premier réveil pressé.
const VALEURS = Object.freeze(['OUI', 'NON']);

// Les capacités dont un OUI engage la Production ou une écriture : pour
// celles-là, et pour tous les NON, une preuve est exigée. Un OUI de confort
// (lire le dépôt) n'a pas besoin d'être prouvé ; un OUI sur Production, si.
const CAPACITES_SENSIBLES = Object.freeze([
  'SUPABASE_PRODUCTION_LECTURE',
  'SUPABASE_PRODUCTION_ECRITURE',
  'PRODUCTION_FUSION_DEPLOIEMENT',
]);

function vide(v) { return v === undefined || v === null || String(v).trim() === ''; }

function chargerRegistre(racine) {
  const chemin = path.join(racine || process.cwd(), FICHIER_REGISTRE);
  return JSON.parse(fs.readFileSync(chemin, 'utf8'));
}

function capacitesConnues(reg) { return Object.keys((reg && reg.capacites) || {}); }
function canauxConnus(reg) { return Object.keys((reg && reg.canaux) || {}); }

// Rend la valeur déclarée, ou null si le canal ou la capacité est inconnu.
// Ne devine jamais : une capacité non déclarée n'est pas un NON prudent, c'est
// un registre incomplet, et le routage doit le dire plutôt que de le combler.
function capacite(reg, canal, cap) {
  const c = reg && reg.canaux && reg.canaux[canal];
  if (!c || !c.capacites) return null;
  const v = c.capacites[cap];
  return VALEURS.includes(v) ? v : null;
}

function capable(reg, canal, cap) { return capacite(reg, canal, cap) === 'OUI'; }

// Tous les canaux capables du geste, dans l'ordre du registre. L'ordre compte :
// il place l'exécutant le moins coûteux avant Frédéric, qui est toujours le
// dernier recours et jamais le premier.
function canauxCapables(reg, cap) {
  return canauxConnus(reg).filter(k => capable(reg, k, cap));
}

// Traduit un motif STOP fermé vers la capacité que le geste exige une fois
// l'autorisation acquise. C'est la pièce qui manquait : le motif dit pourquoi
// il faut un GO, cette table dit qui pourra ensuite agir.
function capaciteDuGeste(reg, motifStop) {
  if (vide(motifStop)) return null;
  const g = (reg && reg.gestes) || {};
  const v = g[String(motifStop).trim()];
  return vide(v) || !capacitesConnues(reg).includes(v) ? null : v;
}

// Quel canal suis-je ? Préfère la déclaration explicite `NEXUS_CANAL` ; à
// défaut, reconnaît le canal GitHub Actions par la portée Supabase que
// `claude.yml` lui impose. L'inférence est volontairement étroite : mieux vaut
// rendre null que se croire habilité.
function canalCourant(env) {
  const e = env || process.env;
  if (!vide(e.NEXUS_CANAL)) return String(e.NEXUS_CANAL).trim();
  if (String(e.GITHUB_ACTIONS || '') === 'true') return 'github-actions-claude';
  return null;
}

// Lit un fichier à une ref git. Rend null si la ref ou le fichier est
// illisible — l'appelant en fait un écart, jamais un silence.
function lireAuRef(racine, ref, fichier) {
  try {
    return execFileSync('git', ['show', `${ref}:${fichier}`], {
      cwd: racine || process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (_) { return null; }
}

// ── VÉRIFICATION ─────────────────────────────────────────────────────────────
// Rend la LISTE des écarts, vide si le registre est sain. Ne jette pas : un
// vérificateur qui jette ne rend qu'un seul écart, et l'on corrige trois fois
// de suite au lieu d'une.
function verifierRegistre(registre, racine, options) {
  const reg = registre || chargerRegistre(racine);
  const lire = (options && options.lire) || lireAuRef;
  const ecarts = [];
  const caps = capacitesConnues(reg);

  if (!caps.length) ecarts.push('aucune capacité déclarée');
  for (const [cap, desc] of Object.entries(reg.capacites || {})) {
    if (vide(desc)) ecarts.push(`capacité ${cap} sans description`);
  }

  for (const [id, canal] of Object.entries(reg.canaux || {})) {
    if (vide(canal.role)) ecarts.push(`canal ${id} sans rôle`);
    if (vide(canal.quoi)) ecarts.push(`canal ${id} sans description`);
    const declarees = Object.keys(canal.capacites || {});
    // Toute capacité doit être tranchée pour tout canal. Un trou dans la
    // matrice est exactement l'endroit où un geste impossible se glisserait.
    for (const cap of caps) {
      if (!declarees.includes(cap)) { ecarts.push(`canal ${id} ne tranche pas ${cap}`); continue; }
      if (!VALEURS.includes(canal.capacites[cap])) {
        ecarts.push(`canal ${id} — valeur hors liste pour ${cap} : ${canal.capacites[cap]}`);
      }
    }
    for (const cap of declarees) {
      if (!caps.includes(cap)) ecarts.push(`canal ${id} déclare une capacité inconnue : ${cap}`);
    }

    // Preuves exigées : tout NON, et tout OUI sensible. Frédéric est dispensé :
    // il EST la gate, et exiger qu'il prouve ses propres droits ferait du
    // registre une boucle.
    const preuves = canal.preuves || {};
    if (canal.role !== 'Frédéric') {
      for (const cap of caps) {
        const v = canal.capacites[cap];
        const exigee = v === 'NON' || (v === 'OUI' && CAPACITES_SENSIBLES.includes(cap));
        if (!exigee) continue;
        const p = preuves[cap];
        if (!p) {
          // Un NON peut être couvert par la borne générale du canal : exiger
          // neuf entrées pour dire « ce canal est conversationnel » produirait
          // du registre à recopier, et un registre qu'on recopie se périme.
          // Un OUI sensible, lui, n'est jamais couvert par une borne générale :
          // il affirme un pouvoir, et un pouvoir se prouve nommément.
          if (v === 'NON' && !vide(canal.enveloppe_par_defaut)) continue;
          ecarts.push(`canal ${id} — ${cap}=${v} sans preuve`);
          continue;
        }
        ecarts.push(...verifierPreuve(id, cap, p, racine, lire));
      }
    }
    for (const cap of Object.keys(preuves)) {
      if (!caps.includes(cap)) ecarts.push(`canal ${id} — preuve pour une capacité inconnue : ${cap}`);
    }
  }

  // Table des gestes : une clé qui ne mène nulle part est pire qu'absente, car
  // le routage la croirait traduite.
  for (const [motif, cap] of Object.entries((reg.gestes || {}))) {
    if (motif === '_lire') continue;
    if (!caps.includes(cap)) ecarts.push(`geste ${motif} mène à une capacité inconnue : ${cap}`);
  }

  // Tout geste traduit doit avoir au moins un exécutant, sinon le dispositif
  // mandate un geste que personne ne peut faire.
  for (const [motif, cap] of Object.entries((reg.gestes || {}))) {
    if (motif === '_lire' || !caps.includes(cap)) continue;
    if (!canauxCapables(reg, cap).length) ecarts.push(`geste ${motif} (${cap}) sans aucun exécutant capable`);
  }

  return ecarts;
}

function verifierPreuve(id, cap, p, racine, lire) {
  const e = [];
  const prefixe = `canal ${id} — preuve ${cap}`;
  if (p.type === 'EXERCEE') {
    // Même règle que preflight-capacites.lirePreuve : sans commande ni date,
    // ce n'est pas une mesure, c'est un souvenir.
    if (vide(p.commande)) e.push(`${prefixe} exercée sans commande`);
    if (vide(p.date) || Number.isNaN(Date.parse(p.date))) e.push(`${prefixe} exercée sans date lisible`);
    if (vide(p.source)) e.push(`${prefixe} exercée sans source citable`);
    return e;
  }
  if (p.type !== 'ENVELOPPE') { e.push(`${prefixe} de type inconnu : ${p.type || '(vide)'}`); return e; }
  if (vide(p.fichier)) { e.push(`${prefixe} enveloppe sans fichier`); return e; }
  if (vide(p.motif)) e.push(`${prefixe} enveloppe sans motif`);

  const aRelire = ['secrets_autorises', 'permissions_autorisees', 'exige'].some(k => (p[k] || []).length);
  if (!aRelire) return e; // motif seul : borne doctrinale, il n'y a pas de texte à mesurer

  const texte = p.ref
    ? lire(racine, p.ref, p.fichier)
    : (() => { try { return fs.readFileSync(path.join(racine || process.cwd(), p.fichier), 'utf8'); } catch (_) { return null; } })();
  if (texte === null) {
    e.push(`${prefixe} — ${p.fichier}${p.ref ? ` à ${p.ref}` : ''} illisible : enveloppe invérifiable`);
    return e;
  }

  if ((p.secrets_autorises || []).length) {
    e.push(...ecartsDeListe(prefixe, 'secret', secretsReferences(texte), p.secrets_autorises));
  }
  if ((p.permissions_autorisees || []).length) {
    e.push(...ecartsDeListe(prefixe, 'permission', permissionsDeclarees(texte), p.permissions_autorisees));
  }
  for (const mot of (p.exige || [])) {
    if (!texte.includes(mot)) e.push(`${prefixe} — ${p.fichier} ne contient plus « ${mot} » : l'enveloppe a changé`);
  }
  return e;
}

// Un écart dans les DEUX sens. Un secret en trop élargit la surface ; un secret
// en moins veut dire que l'enveloppe a bougé sans que le registre le sache, et
// les deux se corrigent, jamais ne se tolèrent.
function ecartsDeListe(prefixe, quoi, trouves, autorises) {
  const e = [];
  const close = new Set(autorises);
  for (const t of trouves) if (!close.has(t)) e.push(`${prefixe} — ${quoi} non autorisé dans le canal : ${t}`);
  for (const a of autorises) if (!trouves.includes(a)) e.push(`${prefixe} — ${quoi} attendu et absent : ${a}`);
  return e;
}

// Les commentaires sont retirés AVANT l'extraction. `claude.yml` cite des noms
// de secrets dans des commentaires — dont un qui n'existe pas, et dont le
// commentaire dit justement qu'il n'existe pas. Les lire serait mesurer la
// prose au lieu du câblage.
function sansCommentaires(texte) {
  return texte.split('\n').map(l => l.replace(/#.*$/, '')).join('\n');
}

function secretsReferences(texte) {
  const trouves = new Set();
  const re = /secrets\.([A-Za-z0-9_]+)/g;
  let m;
  while ((m = re.exec(sansCommentaires(texte))) !== null) trouves.add(m[1]);
  return [...trouves].sort();
}

// Le bloc `permissions:` d'un workflow, rendu en « clé: valeur ». Un jeton
// GITHUB_TOKEN plus large est une capacité de plus, au même titre qu'un secret.
function permissionsDeclarees(texte) {
  const lignes = sansCommentaires(texte).split('\n');
  const trouves = new Set();
  for (let i = 0; i < lignes.length; i++) {
    const tete = lignes[i].match(/^(\s*)permissions:\s*$/);
    if (!tete) continue;
    for (let j = i + 1; j < lignes.length; j++) {
      const l = lignes[j];
      if (!l.trim()) break;
      const paire = l.match(/^(\s*)([A-Za-z-]+):\s*(\S+)\s*$/);
      if (!paire || paire[1].length <= tete[1].length) break;
      trouves.add(`${paire[2]}: ${paire[3]}`);
    }
  }
  return [...trouves].sort();
}

// QUI EXÉCUTE LA SUITE. C'est la pièce qui manquait le 09/10/2026 : le contrat
// nommait un rôle (« Claude »), et « Claude » désigne trois canaux aux pouvoirs
// différents. Ici on nomme le canal, jamais le rôle seul.
//
// L'ORDRE N'EST PAS ARBITRAIRE. Entre deux canaux capables, le palier humain
// passe en dernier : `PALIER_HUMAIN_RESTREINT` dit que Frédéric ne se réveille
// pas pour ce qu'un autre canal sait faire. Quand il est le seul capable, c'est
// alors une vraie gate humaine, et le dire est exact.
function executantSuivant(reg, cap) {
  const candidats = canauxCapables(reg, cap);
  const humains = candidats.filter(k => reg.canaux[k].role === 'Frédéric');
  const autres = candidats.filter(k => reg.canaux[k].role !== 'Frédéric');
  const ordonnes = [...autres, ...humains];
  const executant = ordonnes[0] || null;
  const owner = !executant ? null : reg.canaux[executant].role === 'Frédéric' ? 'Frédéric' : 'Claude';
  return { executant, owner, candidats: ordonnes };
}

// Le routage d'un geste, de bout en bout : le motif STOP dit le geste, la table
// dit la capacité, le registre dit qui la détient, et `classifierCapacite` dit
// si l'arrêt est une limitation de canal ou un vrai blocage technique.
function routerGeste(reg, geste, canal) {
  const cap = capaciteDuGeste(reg, geste);
  if (!cap) return { geste, capacite: null, defaut: `geste inconnu de la table \`gestes\` : ${geste}` };
  const { etat, motif, detail } = require('./classification-canal.js')
    .classifierCapacite({ capaciteRequise: cap, canalCible: canal, registreCapacites: reg })
    || { etat: 'OK', motif: 'CANAL_COURANT_CAPABLE', detail: canal };
  const suite = executantSuivant(reg, cap);
  return { geste, capacite: cap, canal, etat, motif, detail, ...suite };
}

// ── PORTE D'ENTRÉE ───────────────────────────────────────────────────────────
function principal(argv) {
  const racine = path.resolve(__dirname, '..');
  const reg = chargerRegistre(racine);
  const valeur = (nom) => { const i = argv.indexOf(nom); return i >= 0 ? argv[i + 1] : undefined; };
  const geste = valeur('--geste');
  if (geste) {
    const r = routerGeste(reg, geste, valeur('--canal') || canalCourant() || '');
    if (argv.includes('--json')) { process.stdout.write(JSON.stringify(r) + '\n'); return r.defaut || !r.executant ? 1 : 0; }
    if (r.defaut) { process.stdout.write(`Routage impossible — ${r.defaut}\n`); return 1; }
    process.stdout.write(`Geste            : ${r.geste}\n`);
    process.stdout.write(`CAPACITE_REQUISE : ${r.capacite}\n`);
    process.stdout.write(`Canal courant    : ${r.canal || '(non identifié)'}\n`);
    process.stdout.write(`Verdict          : ${r.etat} / ${r.motif}\n`);
    process.stdout.write(`OWNER_NEXT       : ${r.owner || 'aucun'}\n`);
    process.stdout.write(`EXECUTANT_NEXT   : ${r.executant || 'aucun'}\n`);
    if (r.candidats.length > 1) process.stdout.write(`Autres capables  : ${r.candidats.slice(1).join(', ')}\n`);
    return r.executant ? 0 : 1;
  }
  if (argv.includes('--json')) {
    process.stdout.write(JSON.stringify({ canal_courant: canalCourant(), ecarts: verifierRegistre(reg, racine) }) + '\n');
    return 0;
  }
  const ecarts = verifierRegistre(reg, racine);
  process.stdout.write(`Canal courant : ${canalCourant() || '(non identifié)'}\n`);
  for (const id of canauxConnus(reg)) {
    const non = capacitesConnues(reg).filter(c => !capable(reg, id, c));
    process.stdout.write(`- ${id} (${reg.canaux[id].role}) — ne peut pas : ${non.join(', ') || 'rien'}\n`);
  }
  if (!ecarts.length) { process.stdout.write('Registre des capacités sain.\n'); return 0; }
  process.stdout.write(`\n${ecarts.length} écart(s) :\n`);
  for (const x of ecarts) process.stdout.write(`  - ${x}\n`);
  return 1;
}

if (require.main === module) process.exitCode = principal(process.argv.slice(2));

module.exports = {
  FICHIER_REGISTRE, VALEURS, CAPACITES_SENSIBLES,
  chargerRegistre, capacitesConnues, canauxConnus, capacite, capable,
  canauxCapables, capaciteDuGeste, canalCourant, lireAuRef, verifierRegistre,
  executantSuivant, routerGeste,
  secretsReferences, permissionsDeclarees,
};
