#!/usr/bin/env node
'use strict';
// Garde ENV-001 — « Claude doit partir du HEAD canonique attendu de
// config-par-environnement » (docs/learning/RULES.json).
//
// POURQUOI CETTE GARDE EXISTE. Le 07/09/2026, trois runs Claude successifs ont
// terminé « avec succès » en laissant leur travail sur des branches racinées
// sur `main`. Le seul ancêtre commun avec la branche canonique était la
// baseline gelée `501c0c7` : 260 fichiers de faux diff, et un delta prouvé
// mais intransportable autrement qu'à la main, fichier par fichier. L'écart
// entre « Claude a fini » et « NEXUS a intégré » ne se voyait nulle part.
//
// La cause a été corrigée à la racine (`base_branch` sur claude-code-action,
// `main` 10c65d0) : la branche de travail part désormais du HEAD canonique.
// Cette garde ne remplace pas ce correctif — elle le SURVEILLE. Un workflow
// peut être réédité, une entrée supprimée, une action mise à jour ; le jour où
// cela arrive, l'audit du 07/09 demande que le rail se taise moins vite qu'il
// ne s'est tu la première fois (§12.1 : « Automatiser le contrôle ENV-001
// avant codage et avant déclaration d'intégration »).
//
// CE QU'ELLE VÉRIFIE. Une seule chose, littérale : le HEAD canonique est-il un
// ANCÊTRE de la référence examinée ? C'est la formulation exacte de « partir
// du HEAD canonique attendu ». Un travail parti d'un canonique plus ancien
// n'est pas refusé par principe — il est déclaré en retard, avec le nombre de
// commits manquants, parce que c'est cela qu'un humain doit décider de rebaser
// ou non.
//
// CE QU'ELLE NE FAIT PAS. Elle ne juge pas le contenu, ne lit aucun secret, ne
// touche à rien. Elle lit des refs Git et sort 0 ou 1.
//
//   node outils/garde-env-001.js              # examine HEAD
//   node outils/garde-env-001.js <ref>        # examine une autre référence
//
// Variables d'environnement (pour les tests et les runners) :
//   NEXUS_DEPOT              répertoire du dépôt (défaut : la racine du projet)
//   NEXUS_BRANCHE_CANONIQUE  nom de la branche canonique (défaut : config-par-environnement)
//   NEXUS_BRANCHE_DEFAUT     nom de la branche par défaut (défaut : main)

const path = require('path');
const { execFileSync } = require('child_process');

const DEPOT = process.env.NEXUS_DEPOT ? path.resolve(process.env.NEXUS_DEPOT) : path.resolve(__dirname, '..');
const CANONIQUE = process.env.NEXUS_BRANCHE_CANONIQUE || 'config-par-environnement';
const DEFAUT = process.env.NEXUS_BRANCHE_DEFAUT || 'main';

function git(...args) {
  return execFileSync('git', args, { cwd: DEPOT, encoding: 'utf8' }).trim();
}

// Une ref peut exister localement, sous origin/, ou pas du tout. On préfère
// TOUJOURS origin/ quand elle existe : c'est l'état publié qui fait foi, pas
// une copie locale qui peut être en retard sans que personne le sache.
function resoudre(nom) {
  for (const candidat of [`origin/${nom}`, nom]) {
    try { return { ref: candidat, sha: git('rev-parse', '--verify', `${candidat}^{commit}`) }; }
    catch (e) { /* ref suivante */ }
  }
  return null;
}

function estAncetre(ancetre, descendant) {
  try { git('merge-base', '--is-ancestor', ancetre, descendant); return true; }
  catch (e) { return false; }
}

function court(sha) { return sha.slice(0, 7); }

function controler(refExaminee) {
  const canonique = resoudre(CANONIQUE);
  if (!canonique) {
    return { ok: false, code: 'CANONIQUE_INTROUVABLE',
      message: `La branche canonique ${CANONIQUE} est introuvable (ni locale, ni sous origin/).\n` +
        'Un contrôle ENV-001 qui ne trouve pas sa référence ne conclut pas « conforme » : il échoue.' };
  }

  let sha;
  try { sha = git('rev-parse', '--verify', `${refExaminee}^{commit}`); }
  catch (e) {
    return { ok: false, code: 'REF_INTROUVABLE', message: `Référence examinée introuvable : ${refExaminee}` };
  }

  if (estAncetre(canonique.sha, sha)) {
    const avance = Number(git('rev-list', '--count', `${canonique.sha}..${sha}`));
    return { ok: true, code: 'CONFORME', canonique, sha, avance,
      message: `ENV-001 : OK — ${refExaminee} (${court(sha)}) contient ${canonique.ref} (${court(canonique.sha)})` +
        (avance ? `, avec ${avance} commit(s) propre(s).` : ' exactement.') };
  }

  // Non conforme : reste à dire POURQUOI, parce qu'« ENV-001 échoue » sans
  // diagnostic renverrait exactement au tâtonnement du 07/09.
  const base = git('merge-base', sha, canonique.sha);
  const retard = Number(git('rev-list', '--count', `${base}..${canonique.sha}`));
  const defaut = resoudre(DEFAUT);
  const racineSurDefaut = !!(defaut && base !== canonique.sha && estAncetre(base, defaut.sha));
  // Deux comptages, parce qu'ils ne disent pas la même chose et que les
  // confondre est précisément ce qui a coûté du temps le 07/09 :
  //   `travail`  = base -> référence : ce que la branche a réellement produit.
  //   `bruit`    = canonique <-> référence : ce qu'un `git diff` naïf contre le
  //                canon afficherait. Sur la branche 1232, c'était 6 contre 260.
  const compter = (a, b) => git('diff', '--name-only', a, b).split('\n').filter(Boolean).length;
  const travail = compter(base, sha);
  const bruit = compter(canonique.sha, sha);

  let message = `ENV-001 : ÉCHEC — ${refExaminee} (${court(sha)}) ne part pas du HEAD canonique.\n` +
    `  canonique  ${canonique.ref} = ${court(canonique.sha)}\n` +
    `  base réelle             = ${court(base)}\n` +
    `  commits canoniques manquants : ${retard}`;

  if (racineSurDefaut) {
    message += `\n\n  DÉFAUT DE RAIL — la base ${court(base)} est un ancêtre de ${defaut.ref} :\n` +
      `  cette référence est racinée sur la branche par défaut, pas sur ${CANONIQUE}.\n` +
      '  C\'est le défaut du 07/09/2026. Vérifier que .github/workflows/claude.yml\n' +
      `  porte toujours « base_branch: ${CANONIQUE} » sur ${DEFAUT} : sans cette entrée,\n` +
      '  claude-code-action recoupe sa branche depuis la branche par défaut, et le\n' +
      `  \`ref:\` du checkout n'y change rien.`;
  } else {
    message += '\n\n  La base est bien sur la ligne canonique, mais en retard.\n' +
      `  Rebaser sur ${canonique.ref} avant de déclarer l'intégration.`;
  }
  message += `\n\n  travail réel de la branche (base -> réf) : ${travail} fichier(s)` +
    `\n  diff naïf contre le canon (réf <-> canon) : ${bruit} fichier(s)`;
  if (bruit > travail * 2) {
    message += `\n  Ne transporter QUE les ${travail} premiers : les ${bruit - travail} autres ne sont pas` +
      '\n  du travail, ce sont les deux branches qui ne parlent pas de la même histoire.';
  }

  return { ok: false, code: racineSurDefaut ? 'RACINE_SUR_BRANCHE_DEFAUT' : 'BASE_EN_RETARD',
    canonique, sha, base, retard, message };
}

module.exports = { controler, resoudre, estAncetre };

if (require.main === module) {
  // `--tolerer-retard` : un travail simplement DÉPASSÉ par le canon pendant
  // son exécution n'est pas le défaut que cette garde traque. Le refuser en
  // CI rendrait la garde pénible, donc désactivée, donc inutile — et une
  // garde désactivée protège moins que pas de garde, parce qu'elle rassure.
  // Le retard reste imprimé, bruyamment ; seule la sortie devient 0.
  // La racine sur la branche par défaut, elle, bloque toujours.
  const args = process.argv.slice(2);
  const tolererRetard = args.includes('--tolerer-retard');
  const refExaminee = args.find(a => !a.startsWith('--')) || 'HEAD';
  const r = controler(refExaminee);
  if (r.ok) { console.log(r.message); process.exit(0); }
  console.error(r.message);
  if (tolererRetard && r.code === 'BASE_EN_RETARD') {
    console.error('\n  (--tolerer-retard : signalé, non bloquant — un retard se rebase, il ne se cache pas.)');
    process.exit(0);
  }
  process.exit(1);
}
