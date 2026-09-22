#!/usr/bin/env node
// L'horodatage persistant du planning vient de la base — 19/09/2026.
//
// CE QU'ON GARDE. `planning_shifts.modifie_le` est la seule trace de QUAND un
// mois est devenu visible par l'équipe. Jusqu'à cette date, elle était écrite
// par l'écran sous la forme `modifie_le: new Date().toISOString()` : l'horloge
// du POSTE du manager. Une machine en retard de deux minutes suffisait à
// dater une publication AVANT la précédente, sans rien signaler — et c'est
// cette valeur qui répond « depuis quand ce planning faisait-il foi ? » quand
// un retard ou une paye est contesté.
//
// POURQUOI DEUX MOITIÉS. Retirer la ligne de l'écran ne ferme rien : tout
// appel PostgREST direct la reposerait. C'est le trigger qui retire
// l'autorité, l'écran ne fait que cesser de la revendiquer. Cette épreuve
// juge les deux, parce que chacune seule laisse le défaut entier.
//
// CE QU'ELLE NE PEUT PAS JUGER. Elle lit du texte. Que le trigger EXISTE sur
// la base visée est une autre question, vérifiée sur Test le 19/09/2026 par
// une transaction annulée : insérée à `2001-01-01`, la ligne ressort en 2026,
// et un update qui repose `2001` ressort à `now()`.

'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
let passes = 0;
let echecs = 0;
function t(nom, fn) {
  try { fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { echecs++; process.exitCode = 1; console.error(`  ✗ ${nom}\n    ${e && e.message}`); }
}
const lire = f => fs.readFileSync(path.join(RACINE, f), 'utf8');

const MIGRATION = 'supabase/migrations/20260919240000_horodatage_serveur_planning_shifts.sql';

// ── 1 · L'écran ne revendique plus l'heure ────────────────────────────────

console.log('\n── 1 · NEXUS-Planning-v1.html n\'envoie plus d\'horodatage ──');

t('aucune écriture de planning_shifts ne pose modifie_le', () => {
  const src = lire('NEXUS-Planning-v1.html');
  // Les `.update({...})` de l'écran, quel que soit leur contenu.
  const updates = src.match(/\.update\(\s*\{[^}]*\}\s*\)/g) || [];
  assert.ok(updates.length > 0, 'l\'écran n\'écrit plus rien — l\'épreuve ne juge plus rien');
  const fautifs = updates.filter(u => /modifie_le/.test(u));
  assert.strictEqual(fautifs.length, 0,
    `${fautifs.length} écriture(s) posent encore modifie_le depuis le navigateur : ${fautifs.join(' | ')}`);
});

t('les deux publications existent encore — sinon on garderait le vide', () => {
  const src = lire('NEXUS-Planning-v1.html');
  const m = src.match(/\.update\(\s*\{\s*publie:\s*true[^}]*\}\s*\)/g) || [];
  assert.strictEqual(m.length, 2,
    `${m.length} publication(s) au lieu de 2 : le contrat de cette épreuve ne porte plus sur ce qu'il croit`);
});

// ── 2 · La base prend l'autorité ──────────────────────────────────────────

console.log('\n── 2 · Le trigger qui impose l\'heure du serveur ──');

t('la migration pose un trigger before insert or update sur planning_shifts', () => {
  const sql = lire(MIGRATION);
  assert.ok(/create trigger trg_planning_shifts_horodatage_serveur\s+before insert or update on public\.planning_shifts/.test(sql),
    'le trigger n\'est plus posé, ou plus sur les deux opérations : une insertion pourrait dater d\'où elle veut');
});

t('modifie_le est ÉCRASÉ, pas complété', () => {
  const sql = lire(MIGRATION);
  assert.ok(/new\.modifie_le\s*:=\s*now\(\)/.test(sql),
    'la fonction ne pose plus now() sur modifie_le');
  assert.ok(!/coalesce\s*\(\s*new\.modifie_le/i.test(sql),
    'un coalesce rendrait l\'autorité au navigateur dès qu\'il envoie une valeur : c\'est le défaut corrigé');
});

t('genere_le est figé après la création', () => {
  const sql = lire(MIGRATION);
  assert.ok(/new\.genere_le\s*:=\s*old\.genere_le/.test(sql),
    'la date de génération redevient réinscriptible : une retouche effacerait la naissance de la ligne');
});

t('la fonction trigger n\'est exécutable ni par anon ni par authenticated', () => {
  const sql = lire(MIGRATION);
  for (const role of ['public', 'anon', 'authenticated']) {
    assert.ok(new RegExp(`revoke all on function public\\.planning_shifts_horodatage_serveur\\(\\) from ${role};`).test(sql),
      `le revoke pour ${role} manque : Supabase accorde execute par grants nommés, un revoke from public seul ne ferme rien`);
  }
});

setTimeout(() => {
  console.log(`\n${passes} réussite(s), ${echecs} échec(s)`);
}, 0);
