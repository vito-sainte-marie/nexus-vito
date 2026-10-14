'use strict';
// Règle unique de « preuve des conditions » — 14/10/2026 (P8/1, revue de 6d216c0b).
//
// Deux endroits la lisaient chacun à sa manière : le juge de la boucle
// (`relancer-claude-ci.js`, qui rend `CONDITIONS_NON_PROUVEES`) et la garde du
// dépôt (`handoff.js`, qui refuse la demande avant écriture). Une garde plus
// lâche que le juge laisse passer ce que le juge arrête. Les deux lisent donc
// ici : quand la décision antérieure exige une preuve, et quel titre la porte.
const net = v => String(v == null ? '' : v).normalize('NFC').replace(/`/g, '').trim();
// Vide n'est pas « aucune » : un champ absent ne vaut jamais feu vert.
const aucune = v => /^(aucune?s?|aucun|non|none|néant)$/i.test(net(v));

function frontmatter(texte) {
  const m = texte.match(/^---\n([\s\S]*?)\n---/);
  const f = {};
  if (m) for (const l of m[1].split('\n')) { const x = l.match(/^([a-z_]+):\s*(.*)$/); if (x) f[x[1]] = x[2].trim(); }
  return f;
}

// Ce qu'exige une décision de la demande suivante. Une décision sans contrat
// (matérialisée par un humain) exige une preuve si son verdict en pose.
function exigePreuve(texte, lireContrat) {
  const c = lireContrat(texte);
  if (c && net(c.DECISION)) return !aucune(c.CONDITIONS);
  return ['APPROVED_WITH_CONDITIONS', 'NEEDS_EVIDENCE'].includes(frontmatter(texte).decision);
}

// `nom` : « decision-2 » (sans extension). Le titre est exact, fin de ligne
// comprise : « (suite) » ou tout autre suffixe ne vaut pas preuve.
const titrePreuve = nom => new RegExp(`^## Preuve des conditions de ${String(nom).replace(/\.md$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm');

module.exports = { net, aucune, frontmatter, exigePreuve, titrePreuve };
