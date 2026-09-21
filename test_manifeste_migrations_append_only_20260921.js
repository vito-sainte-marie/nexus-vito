// Preuve + contre-preuve pour la garde 2 démasquée par
// `test_manifeste_migrations_complet_20260909.js` : les 14 migrations
// transportées par NEXUS-CONTINUITE-TERRAIN-1-20260920 ne sont classées ni
// dans le manifeste historique (clos) ni nulle part — decision-4.md demande
// un mécanisme append-only/current, prouvé par mutation, SANS rouvrir le
// manifeste historique dans ce geste.
//
// Ce fichier ne modifie ni le manifeste historique ni le contrôle réel
// `test_manifeste_migrations_complet_20260909.js` : il éprouve le prototype
// `outils/verifier-manifeste-migrations-complet.js` en lecture seule sur les
// vrais fichiers, puis avec des contenus injectés en mémoire pour la
// contre-preuve — jamais d'écriture disque.
'use strict';

const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const {
  verifierManifesteComplet,
  empreinte,
  MANIFESTE_HISTORIQUE,
  ADDENDUM_COURANT,
} = require('./outils/verifier-manifeste-migrations-complet.js');

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

const contenuHistoriqueReel = fs.readFileSync(MANIFESTE_HISTORIQUE, 'utf8');
const contenuAddendumReel = fs.readFileSync(ADDENDUM_COURANT, 'utf8');

// ── 1. Preuve sur les vrais fichiers : le mécanisme classe les 14 migrations
t('le manifeste historique + l’addendum classent ensemble toute la promotion réelle', () => {
  const r = verifierManifesteComplet();
  assert.strictEqual(r.verdict, 'COMPLET');
  assert.strictEqual(r.absentes.length, 0);
  assert.ok(r.promotionTotale >= 47, `au moins 47 migrations attendues (21+5+7+14), obtenu ${r.promotionTotale}`);
});

t('les 14 migrations transportées sont classées PAR L’ADDENDUM, pas par le manifeste historique', () => {
  // Distingue bien le mécanisme testé : si elles étaient déjà citées dans le
  // manifeste historique, cette épreuve ne prouverait rien sur l'addendum.
  const quatorze = [
    '20260914210000_mes_ecarts_caisse_projection_employe',
    '20260920140000_bascule_source_precedente_et_change_le',
  ];
  for (const nom of quatorze) {
    assert.ok(!contenuHistoriqueReel.includes(nom), `${nom} ne devrait PAS être dans le manifeste historique`);
    assert.ok(contenuAddendumReel.includes(nom), `${nom} devrait être dans l’addendum courant`);
  }
});

// ── 2. Immuabilité du manifeste historique — non touché par ce lot ───────
t('le manifeste historique réel sur disque est byte pour byte identique à son empreinte figée dans l’addendum', () => {
  const reelle = empreinte(contenuHistoriqueReel);
  assert.strictEqual(reelle, '59f9f95e9fe03e9227f1355885da3f68474a1fae097dfa58193ed1ae3dc90fa7');
});

// ── 3. CONTRE-PREUVE PAR MUTATION #1 — une migration réellement absente du
// classement doit faire échouer le contrôle : un vert obtenu en relâchant la
// garde (ex. ignorer les absences) est interdit par decision-4.md §3.
t('CONTRE-PREUVE — une migration retirée de l’addendum (et absente du manifeste historique) est détectée', () => {
  const addendumMute = contenuAddendumReel.replace(
    '`20260920140000_bascule_source_precedente_et_change_le`\n', '');
  const r = verifierManifesteComplet({ contenuAddendumOverride: addendumMute });
  assert.strictEqual(r.verdict, 'MIGRATIONS_NON_CLASSEES');
  assert.deepStrictEqual(r.absentes, ['20260920140000_bascule_source_precedente_et_change_le.sql']);
});

t('CONTRE-PREUVE — une promotion synthétique entièrement non classée échoue en bloc', () => {
  const r = verifierManifesteComplet({
    versionProduction: '20260904175722',
    contenuHistoriqueOverride: contenuHistoriqueReel,
    contenuAddendumOverride: contenuAddendumReel.replace(/`2026\d{10}_[a-z0-9_]+`/g, ''),
    migrationsOverride: ['20260904175722_x.sql', '99999999999999_migration_inventee_pour_la_preuve.sql'],
  });
  assert.strictEqual(r.verdict, 'MIGRATIONS_NON_CLASSEES');
  assert.deepStrictEqual(r.absentes, ['99999999999999_migration_inventee_pour_la_preuve.sql']);
});

// ── 4. CONTRE-PREUVE PAR MUTATION #2 — garde d'immuabilité active ────────
// Le manifeste historique ne doit jamais être réécrit ; ce contrôle refuse
// de conclure si son contenu (injecté ici, jamais le vrai fichier) diverge
// de l'empreinte que l'addendum a figée.
t('CONTRE-PREUVE — un manifeste historique modifié (contenu injecté) fait échouer le contrôle, pas passer en silence', () => {
  const historiqueAltereEnMemoire = contenuHistoriqueReel + '\n<!-- ligne ajoutée en mémoire pour la preuve, jamais écrite sur disque -->\n';
  assert.notStrictEqual(empreinte(historiqueAltereEnMemoire), empreinte(contenuHistoriqueReel));
  const r = verifierManifesteComplet({ contenuHistoriqueOverride: historiqueAltereEnMemoire });
  assert.strictEqual(r.verdict, 'MANIFESTE_HISTORIQUE_MODIFIE');
  assert.strictEqual(r.absentes, null);
});

t('CONTRE-PREUVE — un addendum sans empreinte figée refuse de conclure plutôt que de supposer', () => {
  const r = verifierManifesteComplet({ contenuAddendumOverride: '# addendum sans empreinte\n' });
  assert.strictEqual(r.verdict, 'ADDENDUM_SANS_EMPREINTE');
});

// ── 5. Le fichier réel sur disque n'a pas bougé pendant cette épreuve ────
t('le manifeste historique réel sur disque n’a pas été modifié par cette épreuve', () => {
  const relu = fs.readFileSync(MANIFESTE_HISTORIQUE, 'utf8');
  assert.strictEqual(relu, contenuHistoriqueReel);
  assert.strictEqual(crypto.createHash('sha256').update(relu).digest('hex'),
    '59f9f95e9fe03e9227f1355885da3f68474a1fae097dfa58193ed1ae3dc90fa7');
});

console.log(`\n${n}/${n} vérifications passées — mécanisme append-only éprouvé, y compris par mutation, manifeste historique intact.`);
