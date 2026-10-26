#!/usr/bin/env node
// Une demande déjà arbitrée ne se ré-arbitre pas (26/10/2026).
//
// La marque `nexus-arbitrage` du relais est le hachage du corps INTÉGRAL du
// réveil : ce corps recopie la demande et son empreinte, il change donc dès que
// le rail avance. Un réveil déjà publié et déjà traité était ainsi soumis de
// nouveau à l'API, qui répondait 429 (plus de crédit) et rougissait la CI
// alors qu'aucun travail n'était dû (033ad017, run 40250278774).
//
// Ici la clé est la DEMANDE : le dernier réveil qui la nomme (lot + fichier),
// puis une réponse de l'arbitre postée après lui. Stdin : les corps des
// commentaires de l'issue, en tableau JSON, du plus ancien au plus récent.
// Sortie : TRAITE (exit 0) ou A_TRAITER (exit 3). Une entrée illisible ne
// conclut jamais TRAITE : on laisse alors le relais travailler (exit 3).
'use strict';

const REPONSE = /^(?:\s*)Réponse de l'arbitre \(ChatGPT/;

function dejaTraite(corps, lot, demande) {
  if (!Array.isArray(corps) || !lot || !demande) return false;
  const cite = (b) => typeof b === 'string'
    && b.includes('LOT_ID: `' + lot + '`')
    && b.includes('Demande en attente: `' + demande + '`');
  let dernier = -1;
  corps.forEach((b, i) => { if (cite(b)) dernier = i; });
  if (dernier < 0) return false;
  return corps.slice(dernier + 1).some((b) => typeof b === 'string' && REPONSE.test(b));
}

function main(argv) {
  const val = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : ''; };
  let brut = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => { brut += d; });
  process.stdin.on('end', () => {
    let corps = null;
    try { corps = JSON.parse(brut); } catch (e) { /* illisible : A_TRAITER */ }
    if (dejaTraite(corps, val('--lot'), val('--demande'))) { console.log('TRAITE'); process.exit(0); }
    console.log('A_TRAITER'); process.exit(3);
  });
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { dejaTraite };
