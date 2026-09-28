#!/usr/bin/env node
'use strict';
// Préflight — ce qu'on peut vraiment faire, établi en le faisant.
//
// LE DÉFAUT QUE CECI REMPLACE. Pendant des semaines, l'agent a conclu qu'il ne
// pouvait pas pousser parce qu'une page de réglages, un champ de configuration
// ou un message d'erreur passé le lui disait. Les trois se sont trompés tour à
// tour : le trousseau git était périmé alors que les droits étaient entiers
// (27/09), et un jeton neuf pouvait perdre `workflow` sans que rien ne le dise
// hors d'un en-tête d'API. Une capacité DÉCLARÉE est une opinion. Une capacité
// EXERCÉE est un fait.
//
// CE PRÉFLIGHT EXÉCUTE. Il pousse réellement une ref jetable sous
// `refs/preflight/<id>`, hors de tout espace de branches, puis la supprime. Ce
// qu'il rend n'est pas un pronostic : c'est le compte rendu d'une opération qui
// a eu lieu, avec la commande exacte et l'horodatage qui l'ont établie.
//
// UNE IMPOSSIBILITÉ SANS COMMANDE NI DATE N'EN EST PAS UNE. `lirePreuve` refuse
// une preuve qui ne dit pas quelle commande l'a produite et quand. Sans cela une
// impossibilité devient éternelle : on la recopie de rapport en rapport longtemps
// après que le droit a été accordé, et l'agent attend une permission qu'il a déjà.

const { execFileSync } = require('child_process');

const NAMESPACE = 'refs/preflight';

function executerGit(args, options = {}) {
  return execFileSync('git', args, {
    cwd: options.cwd || process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    timeout: options.timeout || 60000,
  });
}

// Tente l'opération pour de vrai. `git` est injectable pour les épreuves, mais
// le défaut exécute : aucune épreuve ne peut faire croire à un préflight muet.
function verifier({ remote = 'origin', id, source = 'HEAD', git = executerGit, cwd, maintenant } = {}) {
  const jeton = String(id || `${Date.now()}-${process.pid}`).replace(/[^A-Za-z0-9._-]/g, '-');
  const ref = `${NAMESPACE}/${jeton}`;
  const commande = `git push ${remote} ${source}:${ref}`;
  const date = (maintenant || new Date()).toISOString();
  let capable, sortie;
  try {
    sortie = String(git(['push', remote, `${source}:${ref}`], { cwd }) || '').trim();
    capable = true;
  } catch (e) {
    capable = false;
    sortie = String((e && (e.stderr || e.message)) || '').trim();
  }
  if (capable) {
    // Ne jamais laisser derrière soi la trace d'une mesure.
    try { git(['push', remote, `:${ref}`], { cwd }); }
    catch (e) { sortie += `\n[ref jetable non supprimée : ${String((e && e.stderr) || e).trim()}]`; }
  }
  return { capable, commande, date, remote, ref, sortie: masquer(sortie) };
}

function masquer(texte) {
  return String(texte || '')
    .replace(/(gh[pousr]_|github_pat_)[A-Za-z0-9_]+/g, '***')
    .replace(/(https?:\/\/)[^@\s/]+@/g, '$1***@');
}

// Une preuve ne vaut que si elle dit ce qui l'a établie, et quand.
function lirePreuve(preuve) {
  if (!preuve || typeof preuve !== 'object') {
    return { recevable: false, pourquoi: 'Aucune preuve — une capacité non mesurée n’est ni acquise ni perdue.' };
  }
  if (typeof preuve.capable !== 'boolean') {
    return { recevable: false, pourquoi: 'La preuve ne conclut pas.' };
  }
  if (!preuve.commande) {
    return { recevable: false, pourquoi: 'La preuve ne dit pas quelle commande l’a établie. Une impossibilité sans commande est une rumeur.' };
  }
  if (!preuve.date || Number.isNaN(Date.parse(preuve.date))) {
    return { recevable: false, pourquoi: 'La preuve n’est pas datée. Une impossibilité sans date ne périme jamais, et fait attendre un droit déjà accordé.' };
  }
  return { recevable: true, capable: preuve.capable, commande: preuve.commande, date: preuve.date };
}

module.exports = { verifier, lirePreuve, masquer, NAMESPACE };

if (require.main === module) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined; };
  const r = verifier({ remote: arg('--remote') || 'origin', id: arg('--id') });
  console.log(`${r.capable ? 'CAPABLE' : 'REFUSÉ'} — ${r.commande}`);
  console.log(`établi le ${r.date}`);
  if (r.sortie) console.log(r.sortie.split('\n').map(l => `  ${l}`).join('\n'));
  process.exit(r.capable ? 0 : 1);
}
