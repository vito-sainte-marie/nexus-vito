// Banc d'essai NEXUS — charge les moteurs navigateur dans un contexte Node
// et les branche sur un faux client Supabase alimenté par un scénario.
//
// Les fichiers moteur NEXUS sont des IIFE qui s'accrochent à `window`. On leur
// fournit donc un `window` qui est le contexte lui-même, exactement comme le
// navigateur — jamais une réécriture du module, pour que le banc teste le vrai
// code livré et pas une copie.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RACINE = path.join(__dirname, '..');

function creerContexte(fichiers) {
  const ctx = { console, setTimeout, clearTimeout, Promise, Date, JSON, Math, Object, Array,
                Number, String, Intl, isFinite, Set, Map, crypto: require('crypto').webcrypto };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);
  fichiers.forEach(f => {
    const code = fs.readFileSync(path.join(RACINE, f), 'utf8');
    try {
      vm.runInContext(code, ctx, { filename: f });
    } catch (e) {
      throw new Error(`Chargement de ${f} : ${e.message}`);
    }
  });
  return ctx;
}

// Rendu lisible d'un résultat de contrôle, pour que la sortie du banc se lise
// comme l'écran plutôt que comme un dump d'objet.
function formaterControle(res, carburants) {
  if (!res || !res.parCarburant) return '  (aucun résultat)';
  return (carburants || ['sp95', 'go', 'gnr']).map(cle => {
    const r = res.parCarburant[cle];
    if (!r) return `  ${cle.padEnd(5)} —`;
    const n = v => (v == null ? '—' : Math.round(Number(v)).toLocaleString('fr-FR'));
    return `  ${cle.padEnd(5)} ancre ${n(r.dernierReel).padStart(8)} · jaugé ${n(r.reelDuJour).padStart(8)}`
         + ` · livr ${n(r.livraison).padStart(7)} · théo ${n(r.theorique).padStart(8)}`
         + ` · ÉCART ${n(r.ecart).padStart(8)}   ${r.statut || ''}`;
  }).join('\n');
}

module.exports = { creerContexte, formaterControle, RACINE };
