// test_cablage_garde_ordre_migration_20261003.js
//
// `outils/garde-ordre-migration-code.js` refuse un candidat qui ajoute une
// migration non qualifiée. Son épreuve propre prouve qu'elle FONCTIONNE ;
// celle-ci prouve qu'elle TOURNE au moment de publier, et refuse qu'on la
// débranche du workflow de Production.
//
// Elle refuse :
//   1. que l'étape quitte le job `construire`, ou passe après « Construire » ;
//   2. qu'elle cesse d'appeler la garde sur `HEAD` contre `$CIBLE` ;
//   3. que la cible cesse d'être le dernier déploiement github-pages
//      `success`, ou devienne `origin/production` / `github.event.before`
//      (deux cibles qui rendent la comparaison vide ou incomplète) ;
//   4. qu'un maillon d'échec fermé disparaisse (forme du SHA, présence du
//      commit, présence de la garde dans l'arbre) ;
//   5. que l'étape devienne consultative (`if:`, `continue-on-error`, `|| true`) ;
//   6. que `construire` perde `deployments: read` ou gagne une écriture.
// Chaque refus a son contre-témoin, joué sur une copie en mémoire.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const WORKFLOW = '.github/workflows/deploiement-production.yml';
const NOM_ETAPE = '- name: Garde ordre migration → code';

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

const yml = fs.readFileSync(path.join(RACINE, WORKFLOW), 'utf8');

// Découpe un job de premier niveau (`  nom:`) jusqu'au job suivant.
function job(src, nom) {
  const debut = src.indexOf(`\n  ${nom}:\n`);
  if (debut < 0) return null;
  const suite = src.slice(debut + 1).search(/\n  [a-z_-]+:\n/);
  return suite < 0 ? src.slice(debut) : src.slice(debut, debut + 1 + suite);
}

function etapes(jobSrc) {
  const morceaux = jobSrc.split(/\n(?=      - name:)/);
  return morceaux.slice(1).map(m => ({ nom: m.split('\n')[0].trim(), src: m }));
}

// Rend la liste des défauts de câblage (vide = câblé).
function defautsCablage(src) {
  const defauts = [];
  const construire = job(src, 'construire');
  if (!construire) return ['job `construire` introuvable'];

  const perms = construire.slice(construire.indexOf('permissions:'), construire.indexOf('outputs:'));
  if (!/^\s*deployments:\s*read\s*$/m.test(perms)) defauts.push('`construire` n’a pas `deployments: read`');
  if (/:\s*write\b/.test(perms)) defauts.push('`construire` a une permission d’écriture');

  const liste = etapes(construire);
  const iGarde = liste.findIndex(e => e.nom.startsWith(NOM_ETAPE));
  if (iGarde < 0) {
    const ailleurs = src.includes(NOM_ETAPE);
    return defauts.concat(ailleurs ? 'l’étape de garde n’est pas dans `construire`' : 'l’étape de garde a disparu');
  }
  const iBuild = liste.findIndex(e => e.nom.startsWith('- name: Construire ('));
  if (iBuild < 0 || iBuild < iGarde) defauts.push('l’étape de garde ne précède pas « Construire »');

  const etape = liste[iGarde].src;
  if (!/^\s*node outils\/garde-ordre-migration-code\.js HEAD "\$\{CIBLE\}"\s*$/m.test(etape))
    defauts.push('l’étape n’appelle pas la garde sur HEAD contre ${CIBLE}');
  if (!/deployments\?environment=github-pages/.test(etape))
    defauts.push('la cible ne vient pas des déploiements github-pages');
  if (!/if \[ "\$\{ETAT\}" = "success" \]; then\s*\n\s*CIBLE="\$\{SHA\}"/.test(etape))
    defauts.push('la cible n’est pas filtrée sur le statut success');
  if (/origin\/production|github\.event\.before/.test(etape.split('\n').filter(l => !/^\s*#/.test(l)).join('\n')))
    defauts.push('l’étape utilise origin/production ou github.event.before');
  if (!/if ! est_sha "\$\{CIBLE\}"; then[\s\S]*?exit 1/.test(etape))
    defauts.push('la forme du SHA cible n’est plus exigée');
  if (!/if ! git cat-file -e "\$\{CIBLE\}\^\{commit\}"; then[\s\S]*?exit 1/.test(etape))
    defauts.push('la présence du commit cible n’est plus exigée');
  if (!/if \[ ! -f outils\/garde-ordre-migration-code\.js \]; then[\s\S]*?exit 1/.test(etape))
    defauts.push('l’absence de la garde dans l’arbre n’est plus refusée');
  if (!/set -euo pipefail/.test(etape)) defauts.push('`set -euo pipefail` absent');
  if (/\|\|\s*true/.test(etape) || /continue-on-error/.test(etape) || /^\s{8}if:/m.test(etape))
    defauts.push('l’étape est rendue consultative');
  return defauts;
}

function remplacerUnique(src, ancre, par) {
  assert.strictEqual(src.split(ancre).length - 1, 1, 'ancre non unique ou absente : ' + ancre);
  return src.replace(ancre, par);
}

function rougit(src, motif) {
  const d = defautsCablage(src);
  assert.ok(d.length > 0, 'la mutation n’a pas été vue');
  if (motif) assert.ok(d.some(x => motif.test(x)), 'défaut inattendu : ' + JSON.stringify(d));
}

verifier('la garde est câblée dans `construire`, avant le build, en échec fermé', () => {
  assert.deepStrictEqual(defautsCablage(yml), []);
});

verifier('la garde câblée existe dans l’arbre', () => {
  assert.ok(fs.existsSync(path.join(RACINE, 'outils/garde-ordre-migration-code.js')));
  assert.ok(fs.existsSync(path.join(RACINE, 'docs/deploiement/qualification-ordre-migration-code.json')));
});

verifier('contre-témoin : supprimer l’étape est détecté', () => {
  rougit(remplacerUnique(yml, NOM_ETAPE, '- name: Autre chose'), /disparu/);
});

verifier('contre-témoin : débrancher l’appel de la garde est détecté', () => {
  rougit(remplacerUnique(yml, 'node outils/garde-ordre-migration-code.js HEAD "${CIBLE}"', 'true'), /n’appelle pas/);
});

verifier('contre-témoin : viser origin/production est détecté', () => {
  rougit(remplacerUnique(yml, 'node outils/garde-ordre-migration-code.js HEAD "${CIBLE}"',
    'node outils/garde-ordre-migration-code.js HEAD origin/production'));
});

verifier('contre-témoin : prendre github.event.before comme cible est détecté', () => {
  rougit(remplacerUnique(yml, '              CIBLE="${SHA}"\n',
    '              CIBLE="${{ github.event.before }}"\n'));
});

verifier('contre-témoin : ignorer le statut success est détecté', () => {
  rougit(remplacerUnique(yml, 'if [ "${ETAT}" = "success" ]; then', 'if true; then'), /success/);
});

verifier('contre-témoin : retirer le contrôle de présence du commit est détecté', () => {
  rougit(remplacerUnique(yml, 'if ! git cat-file -e "${CIBLE}^{commit}"; then', 'if false; then'), /présence du commit/);
});

verifier('contre-témoin : retirer le contrôle de forme du SHA est détecté', () => {
  rougit(remplacerUnique(yml, 'if ! est_sha "${CIBLE}"; then', 'if false; then'), /forme du SHA/);
});

verifier('contre-témoin : tolérer une garde absente est détecté', () => {
  rougit(remplacerUnique(yml, 'if [ ! -f outils/garde-ordre-migration-code.js ]; then', 'if false; then'), /absence de la garde/);
});

verifier('contre-témoin : rendre l’étape consultative est détecté', () => {
  rougit(remplacerUnique(yml, 'node outils/garde-ordre-migration-code.js HEAD "${CIBLE}"',
    'node outils/garde-ordre-migration-code.js HEAD "${CIBLE}" || true'));
  rougit(remplacerUnique(yml, '      - name: Garde ordre migration → code — ce que l\'artefact ajoute, la base le porte-t-elle ?\n',
    '      - name: Garde ordre migration → code — ce que l\'artefact ajoute, la base le porte-t-elle ?\n        continue-on-error: true\n'), /consultative/);
});

verifier('contre-témoin : déplacer l’étape après « Construire » est détecté', () => {
  const construire = job(yml, 'construire');
  const liste = etapes(construire);
  const garde = liste.find(e => e.nom.startsWith(NOM_ETAPE)).src;
  const build = liste.find(e => e.nom.startsWith('- name: Construire (')).src;
  const m = remplacerUnique(remplacerUnique(yml, '\n' + garde, ''), '\n' + build, '\n' + build + '\n' + garde);
  rougit(m, /ne précède pas/);
});

verifier('contre-témoin : retirer `deployments: read` ou ajouter une écriture est détecté', () => {
  rougit(remplacerUnique(yml, '      deployments: read\n', ''), /deployments: read/);
  rougit(remplacerUnique(yml, '      deployments: read\n', '      deployments: write\n'));
});

console.log(`\n${passes} vérification(s) passée(s).`);
