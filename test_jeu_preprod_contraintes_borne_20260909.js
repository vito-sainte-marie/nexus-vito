#!/usr/bin/env node
// Le jeu PREPROD doit satisfaire les contraintes qui existent À LA BORNE.
//
// POURQUOI CETTE GARDE EXISTE. Le 09/09/2026, trois relances de la répétition
// se sont arrêtées l'une après l'autre sur une contrainte de `shifts` :
// `shifts_heure_fin_coherente` (un service « termine » sans heure de fin),
// `shifts_journal_cloture` (clôture non tracée), puis `shifts_role_check`
// (« caissier » au lieu de « caissiere »). Chacune a coûté un cycle complet à
// Frédéric, et chacune était lisible dans le dépôt depuis le début.
//
// CE QUI EST COMPARÉ. Les valeurs littérales que le jeu écrit, appariées à
// leurs colonnes par position, contre les listes de valeurs admises extraites
// des migrations ANTÉRIEURES OU ÉGALES à la borne — celles qui s'appliquent
// déjà à l'état d'avant la release, seul état sur lequel ce jeu est semé.
//
// STATIQUE, ET JE LE DIS. Aucun serveur PostgreSQL ici : je lis des contraintes
// dans du SQL au lieu de les faire appliquer par un moteur. Une contrainte
// exprimée autrement qu'en `= ANY (ARRAY[...])` échappe à cette lecture, et une
// contrainte posée par une fonction ou un déclencheur lui échappe entièrement.
// Elle ferme la classe d'erreurs qui a coûté trois relances ; elle ne remplace
// pas la répétition.

'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passes = 0;
function t(nom, fn) {
  try { fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { console.error(`  ✗ ${nom}\n    ${e.message}`); process.exitCode = 1; }
}

const RACINE = __dirname;
const BORNE = '20260904130807';
const JEU = path.join(RACINE, 'outils', 'jeu-preprod-cas-production.sql');

// Les listes de valeurs admises, dernière définition gagnante — une contrainte
// redéfinie plus tard (drop puis add) remplace la précédente.
function valeursAdmises(borne) {
  const dir = path.join(RACINE, 'supabase', 'migrations');
  const fichiers = fs.readdirSync(dir).filter(f => f.endsWith('.sql') && f.split('_')[0] <= borne).sort();
  // Clé (table, contrainte) — SANS LA TABLE, le `statut` d'une autre table
  // écrase celui de `shifts` et l'épreuve dénonce des fautes imaginaires.
  // C'est arrivé à la première version de ce fichier.
  const par = new Map();
  const litteraux = (txt) => [...txt.matchAll(/'([^']*)'/g)].map(v => v[1]);

  for (const f of fichiers) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');

    // a) Contraintes EN LIGNE : il faut la table qui les englobe.
    for (const bloc of src.matchAll(/create table\s+(?:if not exists\s+)?(?:"?public"?\.)?"?(\w+)"?\s*\(([\s\S]*?)\n\);/gi)) {
      const table = bloc[1];
      for (const m of bloc[2].matchAll(/constraint\s+"?(\w+)"?\s+check\s*\(+\s*"?(\w+)"?\s*=\s*any\s*\(\s*array\s*\[([^\]]*)\]/gi)) {
        const v = litteraux(m[3]);
        if (v.length) par.set(`${table}.${m[1]}`, { table, colonne: m[2], valeurs: v });
      }
    }

    // b) Contraintes ajoutées après coup : la table est nommée par l'ordre.
    for (const m of src.matchAll(/alter table\s+(?:"?public"?\.)?"?(\w+)"?\s+add constraint\s+"?(\w+)"?\s+check\s*\(+\s*"?(\w+)"?\s*=\s*any\s*\(\s*array\s*\[([^\]]*)\]/gi)) {
      const v = litteraux(m[4]);
      if (v.length) par.set(`${m[1]}.${m[2]}`, { table: m[1], colonne: m[3], valeurs: v });
    }
  }

  // Une contrainte redéfinie plus tard remplace la précédente : l'ordre
  // d'insertion suffit, `set` écrase.
  const parColonne = new Map();
  for (const { table, colonne, valeurs } of par.values()) parColonne.set(`${table}.${colonne}`, valeurs);
  return parColonne;
}

// Apparier colonnes et valeurs d'un `insert into public.shifts (...) select ...`.
function ecrituresDuJeu(src) {
  const out = [];
  const re = /insert into public\.(\w+)\s*\(([^)]*)\)\s*select([\s\S]*?)\nfrom /gi;
  for (const m of src.matchAll(re)) {
    const cols = m[2].split(',').map(c => c.trim());
    const vals = decouper(m[3]);
    if (cols.length !== vals.length) continue;   // formes non appariables, ignorées
    cols.forEach((c, i) => out.push({ table: m[1], colonne: c, valeur: vals[i].trim() }));
  }
  return out;
}

// Découpe une liste SQL aux virgules de PREMIER niveau (parenthèses et
// apostrophes respectées) — un split(',') naïf casserait sur `(now() - x)`.
function decouper(txt) {
  const parts = []; let prof = 0, cur = '', q = false;
  for (const c of txt) {
    if (c === "'") q = !q;
    if (!q) {
      if (c === '(' || c === '[') prof++;
      else if (c === ')' || c === ']') prof--;
      else if (c === ',' && prof === 0) { parts.push(cur); cur = ''; continue; }
    }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

const admises = valeursAdmises(BORNE);
const ecritures = ecrituresDuJeu(fs.readFileSync(JEU, 'utf8'));

t('la lecture des contraintes et du jeu produit bien quelque chose', () => {
  assert.ok(admises.size >= 3, `seulement ${admises.size} colonne(s) contrainte(s) lue(s) : extraction en panne`);
  assert.ok(ecritures.length >= 8, `seulement ${ecritures.length} écriture(s) appariée(s) : extraction en panne`);
  assert.ok(admises.has('shifts.role') && admises.has('shifts.statut'),
    'shifts.role et shifts.statut doivent être lus, ce sont eux qui ont coûté les relances');
  assert.ok(admises.get('shifts.role').includes('caissiere'),
    'la lecture doit retrouver « caissiere » dans shifts_role_check, sinon elle lit autre chose');
});

t('chaque littéral du jeu appartient aux valeurs admises à la borne', () => {
  const fautes = [];
  for (const e of ecritures) {
    const ok = admises.get(`${e.table}.${e.colonne}`);
    if (!ok) continue;
    const lit = e.valeur.match(/^'([^']*)'$/);
    if (!lit) continue;                       // expression, pas un littéral
    if (!ok.includes(lit[1]))
      fautes.push(`${e.table}.${e.colonne} = « ${lit[1] } » — admis : ${ok.join(', ')}`);
  }
  assert.deepStrictEqual(fautes, [],
    'Le jeu écrit des valeurs que la borne refuse :\n    ' + fautes.join('\n    '));
});

t('MUTATION : « caissier » sans e est bien rejeté', () => {
  // La faute exacte du 09/09. Sans cette mutation, l'épreuve passerait aussi
  // sur un jeu n'écrivant aucune valeur contrainte, et ne prouverait rien.
  const mute = ecrituresDuJeu(
    fs.readFileSync(JEU, 'utf8').replace(/'caissiere'/g, "'caissier'"));
  const fautes = mute.filter(e => {
    const ok = admises.get(`${e.table}.${e.colonne}`); const lit = e.valeur.match(/^'([^']*)'$/);
    return ok && lit && !ok.includes(lit[1]);
  });
  assert.ok(fautes.length > 0,
    'la mutation devait produire au moins une faute : l’épreuve ne détecte pas ce qu’elle couvre');
});

console.log(`\n${passes}/3 vérifications passées — le jeu respecte les contraintes de l’état qu’il peuple.`);
