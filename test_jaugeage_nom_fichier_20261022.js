'use strict';
// Nom des photos de jaugeage (lot JAUGEAGE-OCR-2-20261022, decision-5) :
//   AAAA-MM-JJ_<uid>_nexus-jaug_<site>_<HHhMM>[-N][_qforcee-…].<ext>
// Heure de la station, jamais celle de l'appareil. L'identifiant reste en 2e position : la politique de stockage
// documents_a_traiter_jaugeage_pompiste exige  storage.filename(name) like '____-__-__\_<auth.uid()>\_%'  (aucune migration).
// Les sources peuvent être remplacées par des copies mutées (test_jaugeage_nom_fichier_mutations_20261022.js).
const fs = require('fs');
const path = require('path');
const G = require(process.env.NEXUS_CAPTURE_GUIDEE_SOURCE || path.join(__dirname, 'nexus-capture-guidee.js'));
const lire = f => fs.readFileSync(path.isAbsolute(f) ? f : path.join(__dirname, f), 'utf8');
const SRC_PAGE = process.env.NEXUS_RELEVES_SOURCE || 'NEXUS-Releves-Piste-v1.html';
let echecs = 0, passes = 0;
function ok(cond, msg) { if (cond) passes++; else { echecs++; console.error('ÉCHEC : ' + msg); } }

const UID = '0d44032a-1b2c-4d3e-8f90-123456789abc';
const SITE = 'vito-sainte-marie';
const MOTIF = /^\d{4}-\d{2}-\d{2}_[0-9a-f-]{36}_nexus-jaug_[a-z0-9-]+_\d{2}h\d{2}(-\d+)?(_qforcee-n\d+-r\d+)?\.(jpg|png|webp|heic)$/;
// Équivalent exact de la politique de stockage (like '____-__-__\_<uid>\_%').
const politiqueAccepte = (nom, uid) => new RegExp('^.{4}-.{2}-.{2}_' + uid.replace(/[-]/g, '\\-') + '_.*$', 's').test(nom);
const nom = (o) => G.nomPhotoJaugeage(Object.assign({ instant: new Date('2026-10-22T13:22:05Z'), fuseau: 'Indian/Reunion', uid: UID, site: SITE, ext: 'jpg' }, o || {}));

ok(typeof G.nomPhotoJaugeage === 'function', 'nomPhotoJaugeage existe');
if (typeof G.nomPhotoJaugeage === 'function') {
  // 1. Forme et heure de station
  const n = nom();
  ok(n === `2026-10-22_${UID}_nexus-jaug_${SITE}_17h22.jpg`, `forme attendue, heure de La Réunion UTC+4 (obtenu ${n})`);
  ok(MOTIF.test(n), 'le nom suit le motif');
  // 23 h 30 UTC = lendemain 03 h 30 à La Réunion : ni le jour ni l'heure de l'UTC
  const t = nom({ instant: new Date('2026-10-22T23:30:00Z') });
  ok(t === `2026-10-23_${UID}_nexus-jaug_${SITE}_03h30.jpg`, `23 h 30 UTC donne jour et heure de la station (obtenu ${t})`);
  const p = nom({ instant: new Date('2026-10-22T23:30:00Z'), fuseau: 'America/Martinique' });
  ok(p === `2026-10-22_${UID}_nexus-jaug_${SITE}_19h30.jpg`, `autre fuseau, jour précédent (obtenu ${p})`);
  ok(nom({ instant: new Date('2026-10-22T20:05:00Z'), fuseau: 'UTC' }).endsWith('_20h05.jpg'), 'zéros de tête sur les minutes');
  ok(/_00h0\d\.jpg$/.test(nom({ instant: new Date('2026-10-22T20:05:00Z'), fuseau: 'Indian/Reunion' })), 'minuit sur 00h et non 24h');
  // 2. Place de l'identifiant exigée par la politique
  ok(politiqueAccepte(n, UID), 'la politique de stockage accepte le nom (date puis uid puis _)');
  ok(!politiqueAccepte(n, '11111111-1111-4111-8111-111111111111'), 'le nom d\'un autre déposant est refusé par la politique');
  ok(n.indexOf('_' + UID + '_') === 10, 'l\'identifiant occupe les caractères 11 à 47, juste après la date');
  // 3. Extension réelle
  ok(nom({ ext: 'png' }).endsWith('.png') && nom({ ext: 'heic' }).endsWith('.heic') && nom({ ext: 'webp' }).endsWith('.webp'), 'le repli sur l\'original garde son extension');
  // 4. Collision -N avant l'extension
  ok(nom({ rang: 1 }) === n && nom({ rang: undefined }) === n, 'rang 1 ou absent : pas de suffixe');
  ok(nom({ rang: 2 }) === `2026-10-22_${UID}_nexus-jaug_${SITE}_17h22-2.jpg`, 'rang 2 : -2 avant l\'extension');
  ok(MOTIF.test(nom({ rang: 3 })) && nom({ rang: 3 }).endsWith('-3.jpg'), 'rang 3 : -3');
  // 5. Marque de qualité forcée conservée, après l'heure et le rang
  const f = G.descriptifForcee({ ok: false, motif: 'flou', nettete: 412.6, reflet: 0.0123 });
  const nf = nom({ forcee: f, rang: 2 });
  ok(nf === `2026-10-22_${UID}_nexus-jaug_${SITE}_17h22-2_qforcee-n413-r12.jpg`, `suffixe _qforcee conservé (obtenu ${nf})`);
  ok(MOTIF.test(nf) && politiqueAccepte(nf, UID), 'nom forcé : motif et politique');
  ok(nom({ forcee: undefined }).indexOf('qforcee') < 0, 'photo normale : aucune marque');
  // 6. Refus sans les éléments nécessaires : jamais un nom deviné
  ok(nom({ fuseau: null }) === null && nom({ fuseau: '' }) === null && nom({ fuseau: undefined }) === null, 'sans fuseau : null (pas de repli sur l\'appareil)');
  ok(nom({ uid: '' }) === null && nom({ site: '' }) === null && nom({ ext: '' }) === null, 'sans uid, site ou extension : null');
  ok(nom({ instant: new Date('x') }) === null, 'instant invalide : null');
  ok(nom({ site: 'a/../b' }) === null, 'site contenant un séparateur : null');
}

// 7. Câblage dans la page
const rp = lire(SRC_PAGE);
const corps = (rp.match(/async function envoyerPhoto\([\s\S]*?\n  \}\n/) || [''])[0];
ok(/window\.NexusCaptureGuidee/.test(corps) && /G\.nomPhotoJaugeage\(/.test(corps), 'envoyerPhoto construit le nom par la fonction pure');
ok(/nexusFuseauSite\(emp\.site_id\)/.test(corps), 'l\'heure vient du fuseau de la station');
// Ajout 3 (decision-1 PARCOURS-POMPISTE-CORRECTIFS-RECETTE-20261022) : fuseau introuvable => ancien nom <date>_<uid>_<ms>, l'envoi n'est jamais bloqué.
ok(!/nom de photo impossible/.test(corps), 'fuseau introuvable : plus de blocage de l\'envoi');
ok(/nomPhoto \|\| `[^\n]*Date\.now\(\)/.test(corps), 'fuseau introuvable : repli sur l\'ancien nom <date>_<uid>_<ms>');
ok((corps.match(/Date\.now\(\)/g) || []).length === 1, 'Date.now() seulement dans le repli (jamais dans le nom normal)');
ok(/\$\{date\}_\$\{emp\.id\}_\$\{Date\.now\(\)\}/.test(corps), 'le repli respecte la politique de stockage : AAAA-MM-JJ_<uid>_ en tête');
ok(/upsert: false/.test(corps), 'envoi sans écrasement');
ok(/\$\{emp\.site_id\}\/jaugeage_veeder_root\/\$\{/.test(corps), 'dossier <site>/jaugeage_veeder_root/ inchangé');
ok(/rang <= G\.LIMITE_RANG/.test(corps) && G.LIMITE_RANG >= 2 && G.LIMITE_RANG <= 20, 'réessai -N borné par une limite documentée (≤ 20)');
ok(/fichier_path: chemin/.test(corps) && /depose_par: emp\.id/.test(corps), 'insertion inchangée : le nom retenu est dans fichier_path');
ok(!/\{ nomPhoto|migration/.test(corps), 'aucune migration référencée');
ok(!fs.readdirSync(__dirname).some(f => /20261022.*\.sql$/.test(f) && /jaug/i.test(f)), 'aucune migration SQL de jaugeage ajoutée');

if (echecs) { console.error(`${echecs} échec(s), ${passes} réussite(s)`); process.exit(1); }
console.log(`${passes} vérifications vertes`);
