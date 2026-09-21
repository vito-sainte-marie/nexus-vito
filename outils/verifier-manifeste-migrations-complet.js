#!/usr/bin/env node
// Prototype de contrôle combiné : chaque migration postérieure à la borne
// Production est-elle classée soit dans le manifeste HISTORIQUE (clos,
// jamais réécrit ici), soit dans son ADDENDUM courant (append-only) ?
//
// Ce module démontre le mécanisme demandé par `decision-4.md` §2 (lot
// NEXUS-CONTINUITE-TERRAIN-1-20260920) : permettre à des migrations
// postérieures à la borne du manifeste historique d'être classées SANS
// rouvrir ce manifeste. Depuis `decision-5.md` du même lot, il est câblé
// dans `test_manifeste_migrations_complet_20260909.js` — le contrôle réel
// lit désormais le manifeste historique ET cet addendum.
//
// GARDE D'IMMUABILITÉ : le manifeste historique est lu, jamais écrit, et son
// empreinte SHA256 doit concorder avec celle figée dans l'addendum avant
// toute conclusion — un manifeste historique qui a changé sous ce contrôle
// fait échouer le contrôle plutôt que de certifier sur une base mouvante.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RACINE = path.resolve(__dirname, '..');
const DIR_MIGRATIONS = path.join(RACINE, 'supabase', 'migrations');
const MANIFESTE_HISTORIQUE = path.join(
  RACINE, 'docs', 'handoff', 'lots', 'NEXUS-PRODUCTION-READINESS-1-20260908',
  'manifeste-migrations-production-1.md');
const ADDENDUM_COURANT = path.join(RACINE, 'docs', 'handoff', 'MANIFESTE-MIGRATIONS-PRODUCTION-COURANT.md');

function empreinte(texte) {
  return crypto.createHash('sha256').update(texte).digest('hex');
}

function extraireEmpreinteAttendue(texteAddendum) {
  // La ligne d'empreinte figée dans l'addendum est le seul repère : si elle
  // est absente, le mécanisme refuse de conclure plutôt que de supposer
  // « pas de garde, donc tout va bien ».
  const m = texteAddendum.match(/^([0-9a-f]{64})\s+docs\/handoff\/lots\/NEXUS-PRODUCTION-READINESS-1-20260908\/manifeste-migrations-production-1\.md$/m);
  return m ? m[1] : null;
}

// Vérifie que CHAQUE migration postérieure à `versionProduction` est citée
// dans le manifeste historique OU dans l'addendum courant.
//
// Paramètres injectables pour l'épreuve par mutation (jamais utilisés hors
// test) : `contenuHistoriqueOverride`, `contenuAddendumOverride`,
// `migrationsOverride`.
function verifierManifesteComplet({
  versionProduction = '20260904175722',
  dirMigrations = DIR_MIGRATIONS,
  contenuHistoriqueOverride,
  contenuAddendumOverride,
  migrationsOverride,
} = {}) {
  const contenuHistorique = contenuHistoriqueOverride !== undefined
    ? contenuHistoriqueOverride : fs.readFileSync(MANIFESTE_HISTORIQUE, 'utf8');
  const contenuAddendum = contenuAddendumOverride !== undefined
    ? contenuAddendumOverride : fs.readFileSync(ADDENDUM_COURANT, 'utf8');

  const empreinteAttendue = extraireEmpreinteAttendue(contenuAddendum);
  if (!empreinteAttendue) {
    return { verdict: 'ADDENDUM_SANS_EMPREINTE', absentes: null };
  }
  const empreinteReelle = empreinte(contenuHistorique);
  if (empreinteReelle !== empreinteAttendue) {
    return { verdict: 'MANIFESTE_HISTORIQUE_MODIFIE', absentes: null, empreinteAttendue, empreinteReelle };
  }

  const migrations = migrationsOverride
    || fs.readdirSync(dirMigrations).filter(f => f.endsWith('.sql')).sort();
  const promotion = migrations.filter(f => f.split('_')[0] > versionProduction);

  const absentes = promotion.filter(f => {
    const nom = f.replace(/\.sql$/, '');
    return !contenuHistorique.includes(nom) && !contenuAddendum.includes(nom);
  });

  return {
    verdict: absentes.length === 0 ? 'COMPLET' : 'MIGRATIONS_NON_CLASSEES',
    absentes,
    promotionTotale: promotion.length,
  };
}

if (require.main === module) {
  const r = verifierManifesteComplet();
  console.log(`Verdict : ${r.verdict}`);
  if (r.verdict === 'MIGRATIONS_NON_CLASSEES') {
    console.error(`${r.absentes.length} migration(s) non classée(s) (ni manifeste historique, ni addendum courant) :`);
    r.absentes.forEach(f => console.error(`  ${f}`));
    process.exit(1);
  }
  if (r.verdict === 'MANIFESTE_HISTORIQUE_MODIFIE') {
    console.error(`REFUS — le manifeste historique a changé sous ce contrôle (attendu ${r.empreinteAttendue}, obtenu ${r.empreinteReelle}).`);
    process.exit(1);
  }
  if (r.verdict === 'ADDENDUM_SANS_EMPREINTE') {
    console.error('REFUS — l’addendum ne porte pas d’empreinte du manifeste historique à vérifier.');
    process.exit(1);
  }
  console.log(`${r.promotionTotale} migration(s) de la promotion, toutes classées (manifeste historique + addendum).`);
  process.exit(0);
}

module.exports = { verifierManifesteComplet, empreinte, extraireEmpreinteAttendue, MANIFESTE_HISTORIQUE, ADDENDUM_COURANT };
