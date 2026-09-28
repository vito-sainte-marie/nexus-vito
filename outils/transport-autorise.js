#!/usr/bin/env node
'use strict';
// Transport — a-t-on le droit d'ouvrir une PR vers cette destination.
//
// CE QUE CET OUTIL EXISTE POUR EMPÊCHER. Le rail fonctionne : les runs prouvent
// du travail et le poussent. Rien ne le rapatrie. Le 28/09/2026, 61 branches de
// run portaient du travail absent du rail, et 134 branches `claude/*` vivaient
// sur le dépôt. L'automatisation du transport est donc la bonne direction —
// mais elle se trompe de justification une fois sur deux.
//
// LA CAPACITÉ N'EST PAS L'AUTORISATION. `contents: write` prouve que GitHub
// laissera passer l'écriture. Il ne dit rien de ce que NEXUS autorise. Un agent
// qui déduit son droit d'agir de son pouvoir d'agir remplace un excès d'attente
// par un excès d'autonomie, et c'est le pire des deux : l'attente se voit.
// Cet outil ne prend donc AUCUNE capacité en entrée. Il n'en a pas besoin, et
// une épreuve vérifie qu'en lui en donnant on ne change pas sa réponse.
//
// UNE DESTINATION SE DÉSIGNE, ELLE NE SE DÉDUIT PAS. La mission nomme les
// branches vers lesquelles son travail peut aller. Le rapprochement est exact,
// jamais par préfixe : `handoff-continuite-20260920` autorisé n'autorise pas
// `handoff-continuite-20260920-bis`, qui est une autre branche. Quatre défauts
// de cette session sont nés de dériver du contexte ambiant ce qu'un humain
// avait désigné ailleurs.
//
// DEUX DESTINATIONS NE S'AUTOMATISENT JAMAIS, même déclarées, même autorisées :
// `main` et `production`. Elles portent des gates humaines — fusion, migration,
// déploiement — et une gate qu'un outil peut ouvrir n'est plus une gate. Si une
// mission les nomme, ce n'est pas la mission qui a tort : c'est que le geste
// appartient à Frédéric, et cet outil le dit au lieu de le prendre.
//
// CET OUTIL N'OUVRE RIEN. Il rend une décision et se tait. Ouvrir la PR est le
// travail de l'appelant, qui devra l'avoir lue.

const DESTINATIONS_A_GATE_HUMAINE = ['main', 'production'];

// `mission.autorites` : les branches que la mission désigne NOMMÉMENT comme
// destinations possibles de son travail. Absente ou vide, il n'y a pas de
// destination autorisée — et non « toutes ».
function decider({ destination, mission } = {}) {
  const dest = String(destination || '').trim();
  if (!dest) {
    return { transport: false, code: 'DESTINATION_ABSENTE',
      motif: 'Aucune destination nommée — il n’y a rien à autoriser.' };
  }
  if (DESTINATIONS_A_GATE_HUMAINE.includes(dest)) {
    return { transport: false, code: 'GATE_HUMAINE', destination: dest,
      motif: `${dest} porte une gate humaine. La PR se prépare intégralement, elle ne s’ouvre pas toute seule.` };
  }
  const declarees = (mission && Array.isArray(mission.autorites)) ? mission.autorites.map(x => String(x || '').trim()) : [];
  if (!declarees.length) {
    return { transport: false, code: 'MISSION_SANS_AUTORITE', destination: dest,
      motif: 'La mission ne désigne aucune destination. Un travail sans destination déclarée ne se transporte pas — il se rapporte.' };
  }
  if (!declarees.includes(dest)) {
    return { transport: false, code: 'DESTINATION_NON_AUTORISEE', destination: dest,
      motif: `${dest} ne figure pas dans l’autorité de la mission (${declarees.join(', ')}). `
        + 'Pouvoir écrire sur une branche n’est pas être autorisé à y transporter.' };
  }
  return { transport: true, code: 'AUTORISE', destination: dest,
    motif: `${dest} est nommément désignée par l’autorité de la mission.` };
}

module.exports = { decider, DESTINATIONS_A_GATE_HUMAINE };

if (require.main === module) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined; };
  const brutes = arg('--autorites');
  const d = decider({
    destination: arg('--destination'),
    mission: { autorites: brutes === undefined ? [] : String(brutes).split(',').map(s => s.trim()).filter(Boolean) },
  });
  console.log(`${d.transport ? 'TRANSPORT' : 'REFUS'} [${d.code}] — ${d.motif}`);
  process.exit(d.transport ? 0 : 1);
}
