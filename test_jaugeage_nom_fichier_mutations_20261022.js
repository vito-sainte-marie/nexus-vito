'use strict';
// Mutations du nom des photos de jaugeage (decision-5) : chaque mutant doit rendre l'épreuve rouge.
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-nom-'));
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const SRC = { G: lire('nexus-capture-guidee.js'), C: lire('nexus-camera-page.js'), P: lire('NEXUS-Releves-Piste-v1.html') };
const ENV = { G: 'NEXUS_CAPTURE_GUIDEE_SOURCE', C: 'NEXUS_CAMERA_SOURCE', P: 'NEXUS_RELEVES_SOURCE' };
const EXT = { G: 'js', C: 'js', P: 'html' };
const MUTANTS = [
  ['place', 'identifiant déplacé après le nom (hors de la place exigée par la politique)', 'G', "p.year + '-' + p.month + '-' + p.day + '_' + o.uid + '_nexus-jaug_' + o.site", "p.year + '-' + p.month + '-' + p.day + '_nexus-jaug_' + o.site + '_' + o.uid"],
  ['place', 'identifiant déplacé en tête, avant la date', 'G', "p.year + '-' + p.month + '-' + p.day + '_' + o.uid + '_nexus-jaug_'", "o.uid + '_' + p.year + '-' + p.month + '-' + p.day + '_nexus-jaug_'"],
  ['place', 'identifiant retiré du nom', 'G', "'_' + o.uid + '_nexus-jaug_'", "'_nexus-jaug_'"],
  ['place', 'date retirée de la tête', 'G', "p.year + '-' + p.month + '-' + p.day + '_' + o.uid", "o.uid"],
  ['heure', 'jour et heure de l\'UTC au lieu de la station', 'G', "timeZone: o.fuseau,", "timeZone: 'UTC',"],
  ['heure', 'cycle 12 h (24h devient 12h)', 'G', "hourCycle: 'h23'", "hourCycle: 'h24'"],
  ['heure', 'séparateur HHhMM modifié', 'G', "p.hour + 'h' + p.minute", "p.hour + ':' + p.minute"],
  ['heure', 'fuseau absent toléré (repli UTC)', 'G', "if (!o.fuseau || !o.uid", "if (!o.uid"],
  ['collision', 'suffixe -N supprimé', 'G', "const rang = o.rang > 1 ? '-' + Math.floor(o.rang) : '';", "const rang = '';"],
  ['collision', '-N posé dès le rang 1', 'G', "o.rang > 1 ?", "o.rang > 0 ?"],
  ['extension', 'extension forcée en .jpg', 'G', "'.' + o.ext;", "'.jpg';"],
  ['marque', 'suffixe _qforcee perdu', 'G', "suffixeNomForcee(o.forcee) + '.'", "'.'"],
  ['marque', 'suffixe _qforcee avant l\'heure', 'G', "'h' + p.minute + rang + suffixeNomForcee(o.forcee)", "'h' + p.minute + suffixeNomForcee(o.forcee) + rang"],
  ['site', 'site non contrôlé (séparateur de chemin admis)', 'G', "!/^[a-z0-9-]+$/.test(o.site) || ", ""],
  ['câblage', 'Date.now() réintroduit dans le nom', 'P', "const instant = new Date();", "const instant = new Date(); const nomPhotoMs = Date.now();\n      void nomPhotoMs; /* Date.now() */"],
  ['câblage', 'envoi avec écrasement', 'P', "upsert: false", "upsert: true"],
  ['câblage', 'heure de l\'appareil (fuseau non lu)', 'P', "const fuseau = await nexusFuseauSite(emp.site_id);", "const fuseau = Intl.DateTimeFormat().resolvedOptions().timeZone;"],
  ['câblage', 'réessai sans borne', 'P', "rang <= G.LIMITE_RANG", "rang <= 1e9"],
  ['câblage', 'dossier modifié', 'P', "${emp.site_id}/jaugeage_veeder_root/${nomPhoto}", "${emp.site_id}/${nomPhoto}"],
];
let survivants = 0, applicables = 0;
MUTANTS.forEach(([axe, nom, cible, a, b], i) => {
  if (!SRC[cible].includes(a)) { console.log(`INAPPLICABLE [${axe}] ${nom} (motif absent)`); survivants++; return; }
  applicables++;
  const f = path.join(dir, `m${i}.${EXT[cible]}`);
  fs.writeFileSync(f, SRC[cible].replace(a, b));
  const r = spawnSync(process.execPath, [path.join(__dirname, 'test_jaugeage_nom_fichier_20261022.js')], { env: Object.assign({}, process.env, { [ENV[cible]]: f }), encoding: 'utf8', timeout: 60000 });
  const tue = r.status !== 0; if (!tue) survivants++;
  console.log(`${tue ? 'TUÉ     ' : 'SURVIVANT'} [${axe}] ${nom}`);
});
fs.rmSync(dir, { recursive: true, force: true });
console.log(`mutations : ${applicables - survivants} tuées sur ${MUTANTS.length}, ${survivants} survivant(s) ou inapplicable(s)`);
process.exit(survivants ? 1 : 0);
