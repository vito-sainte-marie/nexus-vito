#!/usr/bin/env node
'use strict';
// Guardian Business Rules — « une vérité métier = un propriétaire logique »
// (ARCH-001 : "A business truth has one logical owner; wrappers, CIN and UI
// consume it and do not rebuild a parallel calculation.")
//
// POURQUOI CETTE GARDE EXISTE. Le lot CARB-004 a coûté des jours parce qu'un
// calcul vivait au mauvais endroit : le moteur possédait une règle, un écran
// en gardait une copie, et rien ne disait laquelle faisait foi. La copie ne
// crie jamais — elle se contente de diverger le jour où l'une des deux bouge.
// C'est le défaut le plus cher du dépôt et le seul qui ne laisse aucune trace
// à l'exécution : les deux versions « marchent ».
//
// CE QU'ELLE CHERCHE. Une seule chose, littérale et vérifiable : un nombre
// métier dont un `nexus-*-moteur.js` est le propriétaire déclaré (constante
// nommée en MAJUSCULES) et qui est REDÉCLARÉ ailleurs — dans un écran
// `NEXUS-*.html` ou dans une couche d'enrobage `nexus-*.js` — soit comme une
// constante rivale, soit comme une valeur de repli `|| 36000`.
//
// CE QU'ELLE NE FAIT PAS. Elle ne juge pas les calculs, ne compare pas des
// formules, ne devine pas la sémantique d'un nombre. Elle ne remplace pas la
// revue humaine : elle désigne un endroit à regarder, avec ses deux adresses.
//
// ── CALIBRATION SUR LE VRAI DÉPÔT (07/09/2026) ─────────────────────────
// Mesuré, pas supposé. Version naïve — « toute constante MAJUSCULE numérique
// d'un moteur, cherchée partout ailleurs » : 51 862 occurrences sur 8 887
// paires (constante × fichier). Illisible, donc inutilisable, donc ignoré.
// Quatre filtres ont été ajoutés un par un, chacun mesuré :
//
//   1. Commentaires, chaînes, et hors-`<script>` des HTML neutralisés.
//      « arrondi au multiple de 1000 L » en prose n'est pas une déclaration,
//      et `width: 500px` n'est pas un seuil métier.   8 887 -> 1 459 paires.
//   2. Valeur revendiquée par PLUSIEURS constantes moteur => inattribuable,
//      donc silence. `0.15` appartient à la fois à SEUIL_CONTRIBUTION_
//      STRATEGIQUE, SEUIL_FDJ_EVOLUTION et TOLERANCE_ECART_PREPARATION_RATIO :
//      aucune ne peut être désignée propriétaire de la copie. Un garde qui ne
//      sait pas conclure se tait — il n'accuse pas au hasard.
//   3. Le porteur doit REDÉCLARER, pas seulement mentionner : `const NOM_MAJ =
//      v` (rivale) ou `|| v` / `?? v` (repli). `.limit(limite || 15)` n'est
//      pas une vérité métier ; `const CAMION_CAPACITE = 36000` en est une.
//                                                     1 459 -> 25 paires.
//   4. Banalité de la valeur. Les 25 restantes ont été LUES une par une : les
//      22 portant un petit entier rond (7, 10, 14, 15, 20, 21, 25, 30) étaient
//      TOUTES des coïncidences — `const TOTAL_BARRES = 10` d'un graphe,
//      `var REPLI = 30`, `const FENETRE_ANOMALIE_RECENTE_JOURS = 7`. Dans un
//      dépôt plein de nombres de jours et de pourcentages, un petit entier
//      rond se recroise par hasard. D'où `valeurSignature` : une valeur ne
//      peut identifier son propriétaire que si elle est difficile à atteindre
//      par accident.                                     25 -> 2 findings.
//
// PISTE ESSAYÉE PUIS REJETÉE — « rattraper » une valeur banale quand le nom du
// porteur partage un jeton distinctif avec celui du propriétaire. Elle a été
// implémentée, mesurée, et a rendu exactement UN finding de plus :
// `DEPUIS_JOURS_ROTATION = 30` (nexus-coach-fdj-donnees.js) accusé de recopier
// `FDJ_ROTATION_FENETRE_JOURS_DEFAUT = 30` (nexus-fdj-moteur.js). Lecture
// faite : le premier est l'horizon de requête des recommandations déjà données
// au coach, le second la fenêtre d'observation de la rotation des carnets de
// jeu. Deux sujets différents, un mot commun. ROTATION est un homonyme dans ce
// dépôt — et le vocabulaire métier en compte d'autres. Un jeton partagé ne
// peut donc pas ACCUSER ; il ne fait plus que renforcer une accusation déjà
// portée par la valeur (`confiance: 'forte'`). Le rappel perdu est assumé :
// une vérité métier valant `3` ne sera pas vue. Mais un garde qui crie 25 fois
// pour 2 vrais défauts est un garde qu'on désactive, et un garde désactivé
// protège moins que pas de garde — il rassure.
//
//   node outils/guardian-regles-metier.js        # 0 si aucun finding, 1 sinon
//
// Variables d'environnement :
//   NEXUS_DEPOT   racine à analyser (défaut : la racine du projet)

const fs = require('fs');
const path = require('path');

const RACINE_DEFAUT = process.env.NEXUS_DEPOT
  ? path.resolve(process.env.NEXUS_DEPOT)
  : path.resolve(__dirname, '..');

const RE_MOTEUR = /^nexus-.*-moteur\.js$/;
const RE_TEST = /^test_/;

// Le propriétaire se déclare : une constante nommée en MAJUSCULES, à valeur
// numérique littérale, dans un moteur. C'est la forme qu'a prise la doctrine
// dans ce dépôt — MAXIMUM_CAMION_LITRES, SEUIL_AUTONOMIE_ALERTE_JOURS. Une
// valeur enfouie dans un objet ou une variable minuscule n'est pas revendiquée
// comme vérité de référence, et la garde ne lui invente pas ce statut.
const RE_CONSTANTE_MOTEUR = /\bconst\s+([A-Z][A-Z0-9_]{2,})\s*=\s*(-?\d+(?:\.\d+)?)\s*;/g;

// ── Lecture neutralisée ────────────────────────────────────────────────
// Les commentaires et les chaînes sont remplacés par des espaces plutôt que
// supprimés : les numéros de ligne restent ceux du fichier réel, sans quoi le
// finding enverrait le lecteur à la mauvaise adresse — et un garde dont on ne
// retrouve pas le défaut est un garde qu'on cesse de croire.
function neutraliser(source) {
  const blanchir = (m) => m.replace(/[^\n]/g, ' ');
  let s = source.replace(/\/\*[\s\S]*?\*\//g, blanchir);
  // Le `[^:]` protège les `https://` : sans lui, une URL avalait la fin de sa
  // ligne, et avec elle une déclaration parfois placée juste derrière.
  s = s.replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
  s = s.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, blanchir);
  return s;
}

// Dans un écran, seule la partie `<script>` peut porter une règle métier. Le
// CSS et le balisage sont pleins de nombres (largeurs, durées, codes) qui
// n'ont jamais rien à voir avec un seuil — les inclure était la deuxième
// source de bruit mesurée.
function scriptsSeuls(html) {
  const lignes = html.split('\n');
  const sortie = lignes.map((l) => ' '.repeat(l.length));
  const re = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const premiere = html.slice(0, m.index).split('\n').length - 1;
    const hauteur = m[0].split('\n').length;
    for (let i = 0; i < hauteur; i++) sortie[premiere + i] = lignes[premiere + i];
  }
  return sortie.join('\n');
}

function lireNeutralise(racine, fichier) {
  let contenu;
  try { contenu = fs.readFileSync(path.join(racine, fichier), 'utf8'); }
  catch (err) { return null; }
  if (fichier.endsWith('.html')) contenu = scriptsSeuls(contenu);
  return neutraliser(contenu);
}

// ── Signature d'une valeur ─────────────────────────────────────────────
// Une valeur n'identifie son propriétaire que si on ne peut pas tomber dessus
// par hasard. Trois formes le garantissent dans ce dépôt : un ordre de
// grandeur que rien d'autre n'emprunte (>= 1000 : 36000 litres, 15000 ms), un
// nombre de chiffres qu'on ne tape pas au jugé (>= 3 significatifs : 28500),
// ou une finesse qui est en soi une décision (>= 3 décimales : 0.006, 0.001).
// Tout le reste — 7, 10, 0.15, 0.5, 1.5 — s'est révélé, à la lecture des 25
// candidats du dépôt réel, coïncidence à 100 %.
function chiffresSignificatifs(valeur) {
  const s = String(Math.abs(Number(valeur))).replace('.', '').replace(/^0+/, '').replace(/0+$/, '');
  return s.length;
}
function decimales(valeur) {
  const s = String(valeur);
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
}
function valeurSignature(valeur) {
  const n = Math.abs(Number(valeur));
  if (!isFinite(n) || n === 0) return false;
  return n >= 1000 || chiffresSignificatifs(valeur) >= 3 || decimales(valeur) >= 3;
}

// ── Corroboration par le nom ───────────────────────────────────────────
// Un jeton distinctif partagé entre les deux noms ne prouve rien à lui seul
// (voir l'homonyme ROTATION en entête), mais il change ce qu'un lecteur doit
// faire du finding : `CAMION_CAPACITE` face à `MAXIMUM_CAMION_LITRES`, il n'y
// a plus rien à vérifier. C'est à cela — et seulement à cela — que sert cette
// corroboration : hiérarchiser la file d'attente, pas ouvrir la porte.
// Les jetons ci-dessous sont ceux de la grammaire commune du dépôt : présents
// dans la moitié des noms, ils ne distinguent rien. `SEUIL_X_JOURS` et
// `SEUIL_Y_JOURS` ne parlent pas du même sujet parce qu'ils comptent des jours.
const JETONS_GENERIQUES = new Set([
  'SEUIL', 'SEUILS', 'MAXIMUM', 'MINIMUM', 'DEFAUT', 'JOUR', 'JOURS', 'HEURE',
  'HEURES', 'MINUTE', 'MINUTES', 'SECONDE', 'SECONDES', 'RATIO', 'FRACTION',
  'PLAFOND', 'PLANCHER', 'TOLERANCE', 'BUDGET', 'LIMITE', 'VALEUR', 'TOTAL',
  'NIVEAU', 'TAUX', 'FENETRE', 'CIBLE', 'MOYENNE', 'SEUIL_', 'SEUILS_',
  // Unités : elles disent en quoi on compte, jamais ce qu'on compte.
  'LITRE', 'LITRES', 'EURO', 'EUROS', 'POINT', 'POINTS', 'POURCENT', 'MOIS',
  'SEMAINE', 'SEMAINES', 'ANNEE', 'ANNEES',
]);
function jetonsDistinctifs(nom) {
  // Les jetons de moins de 4 lettres (MS, PCT, EUR, MAX, MIN, NB, PAR) sont
  // des unités ou des qualificatifs, jamais un sujet métier.
  return nom.split('_').filter((t) => t.length >= 4 && !JETONS_GENERIQUES.has(t));
}

// ── Inventaire des propriétaires ───────────────────────────────────────
function constantesMoteurs(racine) {
  const moteurs = fs.readdirSync(racine).filter((f) => RE_MOTEUR.test(f)).sort();
  const constantes = [];
  for (const moteur of moteurs) {
    const brut = lireNeutralise(racine, moteur);
    if (brut === null) continue;
    let m;
    RE_CONSTANTE_MOTEUR.lastIndex = 0;
    while ((m = RE_CONSTANTE_MOTEUR.exec(brut))) {
      constantes.push({
        nom: m[1],
        valeur: m[2],
        moteur,
        ligne: brut.slice(0, m.index).split('\n').length,
      });
    }
  }
  return constantes;
}

// Une valeur portée par plusieurs noms n'a pas de propriétaire identifiable :
// désigner l'un des trois candidats reviendrait à accuser au hasard deux fois
// sur trois. La garde préfère se taire — c'est la règle « jamais une fausse
// accusation », appliquée là où elle coûte du rappel.
function proprietairesAttribuables(constantes) {
  const parValeur = new Map();
  for (const c of constantes) {
    if (!parValeur.has(c.valeur)) parValeur.set(c.valeur, []);
    parValeur.get(c.valeur).push(c);
  }
  const retenues = [];
  for (const [, groupe] of parValeur) {
    if (new Set(groupe.map((c) => c.nom)).size !== 1) continue;
    retenues.push(groupe[0]);
  }
  return retenues.sort((a, b) => a.nom.localeCompare(b.nom));
}

// ── Recherche des copies ───────────────────────────────────────────────
function echapper(valeur) { return String(valeur).replace('.', '\\.'); }

// `(?![\w.\d])` empêche 36000 de matcher dans 360001 ou dans 36000.5.
function reRivale(valeur) {
  return new RegExp('(?:const|let|var)\\s+([A-Z][A-Z0-9_]{2,})\\s*=\\s*' + echapper(valeur) + '(?![\\w.\\d])', 'g');
}
function reRepli(valeur) {
  return new RegExp('(?:\\|\\||\\?\\?)\\s*' + echapper(valeur) + '(?![\\w.\\d])', 'g');
}

// Les fichiers de test sont hors portée par construction : leur métier est
// précisément d'écrire en dur la valeur attendue pour prouver que le moteur la
// respecte. Les signaler reviendrait à reprocher aux preuves d'exister.
function fichiersPorteurs(racine, restreindreA) {
  let liste = fs.readdirSync(racine)
    .filter((f) => f.endsWith('.js') || f.endsWith('.html'))
    .filter((f) => !RE_MOTEUR.test(f) && !RE_TEST.test(f));
  if (Array.isArray(restreindreA)) {
    // Portée diff : le routeur ne fait analyser que ce que le lot a touché.
    // Les chemins arrivent relatifs à la racine du dépôt ; seuls ceux de la
    // racine plate nous concernent.
    const vises = new Set(restreindreA.map((f) => f.replace(/^\.\//, '')));
    liste = liste.filter((f) => vises.has(f));
  }
  return liste.sort();
}

function analyser(options) {
  const opts = options || {};
  const racine = opts.racine ? path.resolve(opts.racine) : RACINE_DEFAUT;
  const constantes = proprietairesAttribuables(constantesMoteurs(racine));
  const porteurs = fichiersPorteurs(racine, opts.fichiers);

  const textes = new Map();
  const texte = (f) => {
    if (!textes.has(f)) textes.set(f, lireNeutralise(racine, f));
    return textes.get(f);
  };

  const findings = [];
  for (const c of constantes) {
    const jetonsProprio = new Set(jetonsDistinctifs(c.nom));
    // Seule la valeur peut ACCUSER. Sans signature, la garde ne cherche même
    // pas : rien dans un petit entier rond ne permet de conclure, et « ne pas
    // savoir conclure » se traduit ici par le silence, pas par un finding
    // qu'un lecteur devra classer sans suite.
    const signature = valeurSignature(c.valeur);
    if (!signature) continue;
    for (const f of porteurs) {
      const t = texte(f);
      if (t === null) continue;

      let m;
      const rivale = reRivale(c.valeur);
      while ((m = rivale.exec(t))) {
        const nomRival = m[1];
        const partages = jetonsDistinctifs(nomRival).filter((j) => jetonsProprio.has(j));
        findings.push({
          guardian: 'Business Rules',
          code: 'constante_metier_dupliquee',
          fichier: f,
          ligne: t.slice(0, m.index).split('\n').length,
          constante: c.nom,
          valeur: c.valeur,
          proprietaire: `${c.moteur}:${c.ligne}`,
          rival: nomRival,
          confiance: partages.length ? 'forte' : 'a_verifier',
          motifs: ['valeur_signature'].concat(partages.length ? [`jetons_partages:${partages.join('+')}`] : []),
          message: `\`${nomRival} = ${c.valeur}\` redéclare la vérité métier de \`${c.nom}\` (${c.moteur}:${c.ligne}). `
            + 'ARCH-001 : une vérité métier a un seul propriétaire logique — l\'écran consomme le moteur, il ne le recopie pas.',
        });
      }

      const repli = reRepli(c.valeur);
      while ((m = repli.exec(t))) {
        findings.push({
          guardian: 'Business Rules',
          code: 'defaut_metier_duplique',
          fichier: f,
          ligne: t.slice(0, m.index).split('\n').length,
          constante: c.nom,
          valeur: c.valeur,
          proprietaire: `${c.moteur}:${c.ligne}`,
          // Un repli n'a pas de nom : rien ne peut le corroborer, il reste à
          // vérifier par un humain — c'est aussi ce que dit `confiance`.
          confiance: 'a_verifier',
          motifs: ['valeur_signature'],
          message: `valeur de repli \`${c.valeur}\` identique à \`${c.nom}\` (${c.moteur}:${c.ligne}). `
            + 'Le jour où le moteur change son seuil, ce repli continuera de servir l\'ancien silencieusement.',
        });
      }
    }
  }

  return {
    racine,
    constantesExaminees: constantes.length,
    fichiersExamines: porteurs.length,
    findings,
  };
}

// Signature d'appel alignée sur outils/guardians-router.js : le routeur passe
// la liste des fichiers du diff, et attend `{ findings }` en retour.
function executer(options) {
  const opts = options || {};
  const r = analyser({ racine: opts.racine, fichiers: opts.fichiers });
  return { findings: r.findings, constantesExaminees: r.constantesExaminees, fichiersExamines: r.fichiersExamines };
}

module.exports = {
  analyser,
  executer,
  // Exposés pour les épreuves : chaque filtre de calibration doit pouvoir être
  // mis en défaut isolément, sinon on ne teste que leur somme.
  neutraliser,
  scriptsSeuls,
  valeurSignature,
  jetonsDistinctifs,
  constantesMoteurs,
  proprietairesAttribuables,
  fichiersPorteurs,
};

if (require.main === module) {
  const r = analyser();
  if (!r.findings.length) {
    console.log(`Business Rules: OK — ${r.constantesExaminees} constante(s) métier attribuable(s), `
      + `${r.fichiersExamines} fichier(s) examiné(s), 0 finding.`);
    process.exit(0);
  }
  console.log(`Business Rules: ${r.findings.length} finding(s) `
    + `(${r.constantesExaminees} constante(s) attribuable(s), ${r.fichiersExamines} fichier(s)).`);
  for (const f of r.findings) {
    console.log(`  [${f.code}] ${f.fichier}:${f.ligne} — ${f.message}`);
    console.log(`      confiance ${f.confiance} — motifs : ${f.motifs.join(', ')}`);
  }
  process.exit(1);
}
