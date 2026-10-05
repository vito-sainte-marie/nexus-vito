// Épreuve causale de `test_migrations_immuables_20260905.js` après son
// correctif du 05/10/2026 (GO request-1, lot `GOUVERNANCE-REFERENCE-CODE-
// 20261005`).
//
// LE ROUGE QUE CE CORRECTIF FERME. CI `37356858235` échouait sur le rail
// `handoff-continuite-20260920` : Production portait 292 migrations, le rail
// n'en portait pas 2, ajoutées directement en Production après la divergence
// du rail — jamais supprimées, jamais transportées. L'ancienne comparaison
// (production au tip COURANT contre le système de fichiers local) traitait
// « jamais transportée » comme « disparue ». Le correctif compare désormais
// production AU POINT DE DIVERGENCE de la branche (`git merge-base production
// HEAD`), pas à son tip.
//
// CE QUE CETTE ÉPREUVE REFUSE DE FAIRE : réimplémenter cette logique une
// deuxième fois. `outils/comparer-migration-documentaire.js` porte déjà la
// leçon du 21/09 sur ce point précis (« un résolveur qui vit en deux
// exemplaires finit par ne plus dire la même chose des deux côtés »). Chaque
// scénario ci-dessous construit un vrai dépôt Git jetable, y copie le VRAI
// fichier de la garde (`test_migrations_immuables_20260905.js`) et son unique
// dépendance, puis l'exécute comme `node` l'exécuterait en CI — jamais une
// resimulation de son contenu.
//
// LES QUATRE PROPRIÉTÉS MESURÉES :
//   1. une migration ajoutée à production APRÈS la divergence du rail ne
//      doit plus faire rougir la garde (c'est le rouge que ce lot ferme) ;
//   2. une migration qui existait déjà en production AU POINT DE DIVERGENCE
//      et qui disparaît du système de fichiers local doit toujours faire
//      rougir la garde (c'est l'invariant que le 04/09 protégeait, et qu'il
//      ne faut pas perdre en corrigeant le faux positif) ;
//   3. une migration antérieure à la divergence dont le CONTENU change sur la
//      branche doit toujours faire rougir la garde ;
//   4. sans aucune divergence (merge-base == tip == HEAD), le comportement
//      est inchangé par rapport à l'ancienne garde — cas d'une branche
//      applicative à jour avec `production`.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');

const RACINE = __dirname;
const GARDE_SOURCE = path.join(RACINE, 'test_migrations_immuables_20260905.js');
const COMPARATEUR_SOURCE = path.join(RACINE, 'outils', 'comparer-migration-documentaire.js');

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

// Construit un dépôt jetable portant la garde et son unique dépendance, avec
// une branche `production` et une branche `rail` qui en descend.
function depotJetable() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'immuabilite-mb-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
  g('init', '-q', '-b', 'production');
  g('config', 'user.email', 'epreuve@nexus.test');
  g('config', 'user.name', 'Epreuve');

  fs.mkdirSync(path.join(dir, 'supabase', 'migrations'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'outils'), { recursive: true });
  fs.copyFileSync(GARDE_SOURCE, path.join(dir, 'test_migrations_immuables_20260905.js'));
  fs.copyFileSync(COMPARATEUR_SOURCE, path.join(dir, 'outils', 'comparer-migration-documentaire.js'));

  const ecrireMigration = (nom, contenu) => {
    fs.writeFileSync(path.join(dir, 'supabase', 'migrations', nom), contenu);
  };
  const commitTout = (message) => {
    g('add', '-A');
    g('commit', '-q', '-m', message);
    return g('rev-parse', 'HEAD');
  };

  // Point de divergence : deux migrations déjà en production, plus le nom
  // exact attendu par le contrôle 4 (le cas précis d'A12) pour qu'il ne
  // fausse pas ces scénarios, qui portent sur un tout autre invariant.
  ecrireMigration('20260101000000_a.sql', '-- a\nselect 1;\n');
  ecrireMigration('20260101000100_b.sql', '-- b\nselect 2;\n');
  ecrireMigration('20260904130807_fermer_lecture_anonyme_sites.sql', '-- A12\nselect 4;\n');
  const divergence = commitTout('production : a, b et le cas A12');

  // `rail` se détache ICI — c'est le merge-base de tous les scénarios.
  g('branch', 'rail', divergence);

  // Production avance seule après la divergence : nouvelle migration que le
  // rail n'a jamais transportée.
  ecrireMigration('20260102000000_c.sql', '-- c\nselect 3;\n');
  commitTout('production : c, apres la divergence du rail');

  g('checkout', '-q', 'rail');
  return { dir, g, divergence, ecrireMigration };
}

function lancerGarde(dir) {
  const r = spawnSync('node', ['test_migrations_immuables_20260905.js'], { cwd: dir, encoding: 'utf8' });
  return { code: r.status, sortie: (r.stdout || '') + (r.stderr || '') };
}

verifier('1. une migration ajoutée après la divergence du rail ne fait plus rougir la garde', () => {
  const d = depotJetable();
  const r = lancerGarde(d.dir);
  assert.strictEqual(r.code, 0, 'doit passer : ' + r.sortie);
  assert.ok(/aucune migration de production n.a disparu \(0\)/.test(r.sortie), r.sortie);
  assert.ok(/20260102000000_c\.sql/.test(r.sortie), 'doit nommer la migration non évaluée, pour que ce ne soit pas un silence : ' + r.sortie);
  assert.ok(/3 migrations de production contrôlées[\s\S]*1 ajoutées? depuis/.test(r.sortie), r.sortie);
});

verifier('2. une migration déjà présente au point de divergence qui disparaît fait toujours rougir la garde', () => {
  const d = depotJetable();
  fs.unlinkSync(path.join(d.dir, 'supabase', 'migrations', '20260101000000_a.sql'));
  const r = lancerGarde(d.dir);
  assert.notStrictEqual(r.code, 0, 'doit échouer : a.sql existait déjà au merge-base');
  assert.ok(/Migrations de production absentes de cette branche/.test(r.sortie), r.sortie);
  assert.ok(/20260101000000_a\.sql/.test(r.sortie), r.sortie);
  // c.sql (ajoutée après divergence) ne doit JAMAIS apparaître dans ce refus :
  // ce serait la preuve que le correctif a régressé vers l'ancienne confusion.
  assert.ok(!/Migrations de production absentes[\s\S]*20260102000000_c\.sql/.test(r.sortie), r.sortie);
});

verifier('3. une migration antérieure à la divergence dont le contenu change fait toujours rougir la garde', () => {
  const d = depotJetable();
  d.ecrireMigration('20260101000100_b.sql', '-- b, modifiee sur le rail\nselect 2;\n');
  const r = lancerGarde(d.dir);
  assert.notStrictEqual(r.code, 0, 'doit échouer : le contenu de b.sql a changé');
  assert.ok(/Migrations de production dont le contenu a été modifié/.test(r.sortie), r.sortie);
  assert.ok(/20260101000100_b\.sql/.test(r.sortie), r.sortie);
});

verifier('4. sans divergence (branche a jour), le comportement est inchangé : tout manque fait rougir', () => {
  const d = depotJetable();
  // On rejoue le scénario sur `production` elle-même : merge-base(production,
  // HEAD) == HEAD == tip. Aucune migration n'est donc jamais « ajoutée après
  // la divergence » — le correctif ne doit rien relâcher dans ce cas.
  d.g('checkout', '-q', 'production');
  fs.unlinkSync(path.join(d.dir, 'supabase', 'migrations', '20260102000000_c.sql'));
  const r = lancerGarde(d.dir);
  assert.notStrictEqual(r.code, 0, 'doit échouer : c.sql est en production (tip == merge-base ici) et absente du disque');
  assert.ok(/20260102000000_c\.sql/.test(r.sortie), r.sortie);
});

console.log(`\n${passes} vérifications passées.`);
