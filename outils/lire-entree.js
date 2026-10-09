'use strict';
// Lecture intégrale de l'entrée standard, tolérante à un descripteur non
// bloquant.
//
// `fs.readFileSync(0)` suppose un descripteur bloquant. Quand le processus
// hérite d'un tube en O_NONBLOCK — c'est le cas sur les exécuteurs GitHub —
// et que l'écrivain n'a encore rien écrit, read(2) rend EAGAIN et Node lève
// au lieu d'attendre. Run 37927790518 (09/10/2026) : `printf "$HISTORIQUE" |
// node outils/empreinte-progression.js --marques -` est mort sur EAGAIN, puis
// `printf` sur Broken pipe, et le réveil n'est jamais parti.
//
// Ici, EAGAIN veut dire « pas encore », jamais « fini » : on attend et on
// relit. Le silence est borné (`delaiMs`, 30 s par défaut, remis à zéro à
// chaque octet reçu) et son expiration
// lève une erreur nommée — une entrée qui n'arrive pas ne doit pas se lire
// comme une entrée vide, ce qui ferait conclure « aucune marque antérieure »
// et rouvrirait la boucle de réveil que l'empreinte doit justement fermer.
const fs = require('fs');

function dormir(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function lireEntreeStandard({ fd = 0, delaiMs = 30000, pasMs = 20 } = {}) {
  const morceaux = [];
  const tampon = Buffer.alloc(65536);
  let limite = Date.now() + delaiMs;
  for (;;) {
    let n;
    try {
      n = fs.readSync(fd, tampon, 0, tampon.length, null);
    } catch (err) {
      if (err.code === 'EAGAIN' || err.code === 'EWOULDBLOCK') {
        if (Date.now() >= limite) {
          throw new Error(`entrée standard muette depuis ${delaiMs} ms (EAGAIN répété) — lecture abandonnée, rien n'est présumé vide`);
        }
        dormir(pasMs);
        continue;
      }
      if (err.code === 'EOF') break;
      throw err;
    }
    if (n === 0) break;
    morceaux.push(Buffer.from(tampon.subarray(0, n)));
    limite = Date.now() + delaiMs;
  }
  return Buffer.concat(morceaux).toString('utf8');
}

module.exports = { lireEntreeStandard };
