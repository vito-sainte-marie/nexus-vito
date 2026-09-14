#!/usr/bin/env node
// NEXUS — un PREPROD ne survit pas à sa release.
//
// ARBITRAGE DE FRÉDÉRIC BRAGANCE, 09/09/2026 : « il doit être détruit après
// chaque release ». Cette garde existe parce qu'une décision que rien ne
// mécanise est une décoration : elle tient tant que quelqu'un y pense, et
// cesse de tenir le jour où personne n'y pense.
//
// CE QU'UN PREPROD CONTIENT. Une copie récente de Production : les noms, les
// pointages, les évaluations et les éléments de paie d'une vraie équipe,
// dupliqués dans un second environnement avec ses propres accès. Anonymisé, il
// reste une base construite à partir de données réelles. Oublié, il devient
// exactement l'endroit où une fuite se loge — celle du 04/09/2026, deux accès
// anonymes ouverts sur la recette, était de cette famille.
//
// CE QUE CETTE GARDE NE SAIT PAS FAIRE, et qu'il faut savoir. Elle lit un
// REGISTRE DÉCLARÉ, pas la liste réelle des projets Supabase — la lire
// demanderait un jeton d'administration que personne n'a voulu accorder. Elle
// détecte donc un PREPROD déclaré puis oublié, jamais un PREPROD créé sans
// être déclaré. C'est pourquoi la construction doit passer par l'outillage,
// qui inscrit avant de créer : contourner l'outil, c'est contourner la garde,
// et cela doit rester un geste conscient plutôt qu'un oubli possible.

'use strict';
const fs = require('fs');
const path = require('path');

const REGISTRE = path.join(__dirname, '..', 'docs', 'handoff', 'PREPROD-CYCLE.json');

function lireRegistre(chemin) {
  try {
    const d = JSON.parse(fs.readFileSync(chemin || REGISTRE, 'utf8'));
    if (!Array.isArray(d.cycles)) return null;
    return d;
  } catch (e) {
    return null;
  }
}

// Fonction PURE : c'est elle qui juge, et c'est elle que les épreuves
// interrogent. Séparée de la lecture parce qu'une garde dont le verdict est
// mêlé à ses entrées-sorties finit par être éprouvée sur son texte plutôt que
// sur son comportement.
function controler({ registre, maintenantISO }) {
  if (!registre) {
    return { indisponible: 'Registre PREPROD illisible ou absent : aucune conclusion possible.' };
  }
  const t = Date.parse(maintenantISO);
  if (!Number.isFinite(t)) {
    return { indisponible: 'Instant de référence illisible : aucune conclusion possible.' };
  }
  const fenetre = Number(registre.fenetre_heures);
  if (!Number.isFinite(fenetre) || fenetre <= 0) {
    return { indisponible: 'Fenêtre de vie non déclarée : sans seuil, « trop vieux » n’a pas de sens.' };
  }

  const ouverts = [];
  const illisibles = [];
  for (const c of registre.cycles) {
    if (c && c.detruit_le) continue; // fermé : rien à dire
    const cree = Date.parse(c && c.cree_le);
    if (!Number.isFinite(cree)) {
      // Une entrée sans date de création ne peut pas être jugée périmée. La
      // taire reviendrait à laisser un environnement hors de toute surveillance.
      illisibles.push({ ref: (c && c.projet_ref) || '(sans référence)', release: (c && c.release) || null });
      continue;
    }
    const heures = (t - cree) / 3600000;
    ouverts.push({
      ref: c.projet_ref || '(sans référence)',
      release: c.release || null,
      heures: Math.floor(heures),
      perime: heures > fenetre,
    });
  }

  return {
    indisponible: null,
    fenetre,
    ouverts,
    illisibles,
    perimes: ouverts.filter(o => o.perime),
  };
}

module.exports = { controler, lireRegistre, REGISTRE };

if (require.main === module) {
  const r = controler({ registre: lireRegistre(), maintenantISO: new Date().toISOString() });

  if (r.indisponible) {
    // Fail closed. « Je ne sais pas » n'est pas « tout va bien » : un registre
    // illisible est exactement la situation où un PREPROD oublié passerait.
    console.error(r.indisponible);
    process.exit(1);
  }

  if (r.illisibles.length) {
    console.error(`${r.illisibles.length} entrée(s) PREPROD sans date de création exploitable :`);
    for (const e of r.illisibles) console.error(`  ${e.ref}${e.release ? ` (release ${e.release})` : ''}`);
    console.error('\nUne entrée qu’on ne peut pas dater ne peut pas être jugée périmée.');
    process.exit(1);
  }

  if (r.perimes.length) {
    console.error(`${r.perimes.length} PREPROD ouvert(s) au-delà de ${r.fenetre} h :`);
    for (const e of r.perimes) {
      console.error(`  ${e.ref}${e.release ? ` (release ${e.release})` : ''} — ouvert depuis ${e.heures} h`);
    }
    console.error('\nUn PREPROD est détruit après sa release (arbitrage du 09/09/2026).');
    console.error('Détruire l’environnement, puis renseigner `detruit_le` dans docs/handoff/PREPROD-CYCLE.json.');
    process.exit(1);
  }

  if (r.ouverts.length) {
    console.log(`${r.ouverts.length} PREPROD ouvert(s), dans la fenêtre de ${r.fenetre} h :`);
    for (const e of r.ouverts) console.log(`  ${e.ref} — ouvert depuis ${e.heures} h`);
    process.exit(0);
  }

  console.log('Aucun PREPROD ouvert.');
  process.exit(0);
}
