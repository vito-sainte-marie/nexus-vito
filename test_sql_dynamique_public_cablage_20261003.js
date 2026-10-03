// test_sql_dynamique_public_cablage_20261003.js
//
// La condition P0 de la dette TRUNCATE (aucune fonction `public` exécutable
// par anon/authenticated ne porte `EXECUTE` ni `TRUNCATE`) est mesurée sur
// Test par `outils/epreuve-sql-dynamique-public-20261003.sql`, dans une étape
// de `tests.yml`. Prouver que l'épreuve SQL fonctionne ne prouve pas qu'elle
// tourne : cette épreuve-ci refuse qu'on la débranche.
//
// Elle refuse :
//   1. que l'étape CI disparaisse, perde `ON_ERROR_STOP=1`, ou cesse de
//      vérifier le marqueur terminal EXACT que le SQL imprime ;
//   2. que le SQL perde l'un de ses quatre contrôles (témoin, contre-témoin,
//      visibilité, verdict) ;
//   3. que le SQL écrive ailleurs que dans pg_temp, ou ne finisse pas par
//      ROLLBACK avant son marqueur.
// Chaque refus a son contre-témoin, joué sur une copie en mémoire.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const FICHIER_SQL = 'outils/epreuve-sql-dynamique-public-20261003.sql';
const WORKFLOW = '.github/workflows/tests.yml';

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

const sql = fs.readFileSync(path.join(RACINE, FICHIER_SQL), 'utf8');
const yml = fs.readFileSync(path.join(RACINE, WORKFLOW), 'utf8');

function marqueurTerminal(sqlSrc) {
  const m = sqlSrc.match(/^\\echo '([^']+)'\s*$/m);
  return m ? m[1] : null;
}

// Rend la liste des défauts de câblage (vide = câblé).
function defautsCablage(ymlSrc, sqlSrc) {
  const defauts = [];
  const marqueur = marqueurTerminal(sqlSrc);
  if (!marqueur) defauts.push('le SQL n’imprime pas de marqueur terminal');
  const debut = ymlSrc.indexOf(`FICHIER_SQLDYN="${FICHIER_SQL}"`);
  if (debut < 0) return defauts.concat('aucune étape ne désigne ' + FICHIER_SQL);
  // L'étape s'étend jusqu'au prochain `- name:`.
  const fin = ymlSrc.indexOf('\n      - name:', debut);
  const etape = ymlSrc.slice(debut, fin < 0 ? undefined : fin);
  const entete = ymlSrc.slice(ymlSrc.lastIndexOf('\n      - name:', debut), debut);
  if (!/psql -v ON_ERROR_STOP=1 -f "\$FICHIER_SQLDYN"/.test(etape))
    defauts.push('l’étape ne lance pas le fichier sous ON_ERROR_STOP=1');
  if (marqueur && !etape.includes(`grep -qF '${marqueur}'`))
    defauts.push('l’étape ne vérifie pas le marqueur terminal exact');
  if (/\|\|\s*true/.test(etape) || /continue-on-error/.test(entete + etape))
    defauts.push('l’étape est rendue consultative');
  if (!/NEXUS_REF_EST_LE_RAIL == '1'/.test(entete))
    defauts.push('l’étape n’a pas la condition du rail');
  return defauts;
}

function defautsSql(sqlSrc) {
  const defauts = [];
  for (const code of ['SQLDYN-000', 'SQLDYN-001', 'SQLDYN-002', 'SQLDYN-003']) {
    if (!new RegExp(`raise exception '${code}`).test(sqlSrc)) defauts.push(code + ' ne lève plus');
  }
  if (!/^\\set ON_ERROR_STOP 1$/m.test(sqlSrc)) defauts.push('ON_ERROR_STOP absent du fichier');
  const creations = sqlSrc.match(/^create\s+(or\s+replace\s+)?\w+\s+[\w.]+/gim) || [];
  for (const c of creations) {
    if (!/\bfunction\s+pg_temp\./i.test(c)) defauts.push('création hors pg_temp : ' + c);
  }
  if (/^\s*(insert|update|delete|grant|revoke|alter|drop|truncate)\b/im.test(sqlSrc))
    defauts.push('instruction d’écriture au niveau du script');
  const idxRollback = sqlSrc.lastIndexOf('\nrollback;');
  const idxEcho = sqlSrc.search(/^\\echo /m);
  if (idxRollback < 0 || idxEcho < idxRollback) defauts.push('le marqueur n’est pas précédé d’un ROLLBACK');
  if (!/from pg_temp\.fonctions_sql_dynamique\('public'\)/.test(sqlSrc))
    defauts.push('le verdict ne porte plus sur public');
  return defauts;
}

verifier('l’étape CI lance l’épreuve SQL et vérifie son marqueur exact', () => {
  assert.deepStrictEqual(defautsCablage(yml, sql), []);
});

verifier('le SQL porte ses quatre contrôles, n’écrit que dans pg_temp et finit par ROLLBACK', () => {
  assert.deepStrictEqual(defautsSql(sql), []);
});

function remplacerUnique(src, ancre, par) {
  assert.strictEqual(src.split(ancre).length - 1, 1, 'ancre non unique ou absente : ' + ancre);
  return src.replace(ancre, par);
}

verifier('contre-témoin : débrancher le lancement psql est détecté', () => {
  const m = remplacerUnique(yml, 'psql -v ON_ERROR_STOP=1 -f "$FICHIER_SQLDYN"', 'true');
  assert.ok(defautsCablage(m, sql).length > 0);
});

verifier('contre-témoin : un marqueur SQL changé sans l’étape est détecté', () => {
  const m = remplacerUnique(sql, "\\echo 'ÉPREUVE SQL DYNAMIQUE PUBLIC", "\\echo 'EPREUVE SQL DYNAMIQUE PUBLIC");
  assert.ok(defautsCablage(yml, m).length > 0);
});

verifier('contre-témoin : rendre l’étape consultative est détecté', () => {
  const m = remplacerUnique(yml, 'psql -v ON_ERROR_STOP=1 -f "$FICHIER_SQLDYN" 2>&1)',
    'psql -v ON_ERROR_STOP=1 -f "$FICHIER_SQLDYN" 2>&1 || true)');
  assert.ok(defautsCablage(m, sql).length > 0);
});

verifier('contre-témoin : retirer le témoin est détecté', () => {
  const m = remplacerUnique(sql, "raise exception 'SQLDYN-001", "raise notice 'SQLDYN-001");
  assert.ok(defautsSql(m).some(d => d.startsWith('SQLDYN-001')));
});

verifier('contre-témoin : créer le contre-témoin dans public est détecté', () => {
  const m = remplacerUnique(sql, 'create function pg_temp.contre_temoin_sql_dynamique',
    'create function public.contre_temoin_sql_dynamique');
  assert.ok(defautsSql(m).some(d => d.startsWith('création hors pg_temp')));
});

verifier('contre-témoin : valider au lieu d’annuler est détecté', () => {
  const m = remplacerUnique(sql, '\nrollback;', '\ncommit;');
  assert.ok(defautsSql(m).length > 0);
});

console.log(`\n${passes} vérification(s) passée(s).`);
