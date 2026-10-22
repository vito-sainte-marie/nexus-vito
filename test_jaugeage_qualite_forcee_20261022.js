'use strict';
// « Envoyer quand même » après deux refus de qualité consécutifs (lot JAUGEAGE-OCR-2-20261022, suite de decision-4).
// La photo forcée part, marquée qualite_forcee avec la netteté et le reflet mesurés (pour calibrer plus tard). Seuils inchangés.
// Les sources peuvent être remplacées par des copies mutées (test_jaugeage_qualite_forcee_mutations_20261022.js).
const fs = require('fs');
const path = require('path');
const G = require(process.env.NEXUS_CAPTURE_GUIDEE_SOURCE || path.join(__dirname, 'nexus-capture-guidee.js'));
const lire = f => fs.readFileSync(path.isAbsolute(f) ? f : path.join(__dirname, f), 'utf8');
const SRC_CAMERA = process.env.NEXUS_CAMERA_SOURCE || 'nexus-camera-page.js';
const SRC_PAGE = process.env.NEXUS_RELEVES_SOURCE || 'NEXUS-Releves-Piste-v1.html';
let echecs = 0, passes = 0;
function ok(cond, msg) { if (cond) passes++; else { echecs++; console.error('ÉCHEC : ' + msg); } }

const refus = (motif, nettete, reflet) => ({ ok: false, motif, nettete, reflet, message: 'x' });
const bon = { ok: true, motif: null, nettete: 800, reflet: 0, message: '' };

// ---------- 1. Quand le bouton apparaît ----------
{
  ok(G.SEUIL_REFUS_FORCER === 2, 'le bouton se propose au deuxième refus consécutif');
  let c = 0;
  ok(G.forcagePropose(c) === false, 'aucun refus : pas de bouton');
  c = G.refusSuivant(c, refus('flou', 300, 0));
  ok(c === 1 && G.forcagePropose(c) === false, 'premier refus : bouton ABSENT');
  c = G.refusSuivant(c, refus('reflet', 700, 0.08));
  ok(c === 2 && G.forcagePropose(c) === true, 'deuxième refus (flou puis reflet) : bouton PRÉSENT');
  c = G.refusSuivant(c, refus('flou', 200, 0));
  ok(c === 3 && G.forcagePropose(c) === true, 'les refus suivants gardent le bouton');
  ok(G.refusSuivant(c, bon) === 0 && G.forcagePropose(G.refusSuivant(c, bon)) === false, 'une photo acceptée remet le compteur à zéro');
  // refus, accepté, refus : non consécutifs, pas de bouton
  let d = G.refusSuivant(0, refus('flou', 300, 0)); d = G.refusSuivant(d, bon); d = G.refusSuivant(d, refus('flou', 300, 0));
  ok(d === 1 && G.forcagePropose(d) === false, 'refus, acceptée, refus : pas consécutifs, bouton absent');
}

// ---------- 2. Ce que porte une photo forcée ----------
{
  const f = G.descriptifForcee(refus('flou', 412.6, 0.0123));
  ok(f.qualite_forcee === true, 'marquée qualite_forcee');
  ok(f.nettete === 412.6 && f.reflet === 0.0123 && f.motif === 'flou', 'netteté, reflet et motif mesurés conservés');
  const s = G.suffixeNomForcee(f);
  ok(s === '_qforcee-n413-r12', `suffixe de nom lisible (obtenu ${s})`);
  ok(/^_qforcee-n\d+-r\d+$/.test(G.suffixeNomForcee(G.descriptifForcee(refus('reflet', 1234.4, 0.5)))), 'suffixe de forme stable');
  ok(G.suffixeNomForcee(null) === '' && G.suffixeNomForcee({}) === '', 'photo non forcée : aucun suffixe');
  // compatible avec la politique de stockage : `____-__-__\_<uid>\_%` puis extension jpg|jpeg|png|webp|heic
  const nom = `2026-10-22_0d44032a-0000-4000-8000-000000000000_1792668408983${s}.jpg`;
  ok(/^\d{4}-\d{2}-\d{2}_[0-9a-f-]{36}_%?\d+/.test(nom) && /\.(jpg|jpeg|png|webp|heic)$/.test(nom), 'le nom forcé garde date_uid_ en tête et une extension acceptée');
  ok(G.SEUIL_NETTETE === 500 && G.SEUIL_REFLET === 0.03, 'seuils inchangés (500 et 3 %)');
}

// ---------- 3. Câblage dans la caméra (jaugeage seulement) ----------
{
  const cam = lire(SRC_CAMERA);
  ok(/resolu = false, refus = 0;/.test(cam), 'compteur de refus tenu par session de caméra');
  ok(/refus = guide\.refusSuivant\(refus, q\);/.test(cam), 'le compteur suit chaque verdict');
  ok(/guide\.forcagePropose\(refus\)/.test(cam), 'le bouton dépend de forcagePropose');
  ok(/b.textContent = 'Envoyer quand même'/.test(cam), 'libellé « Envoyer quand même »');
  ok(/data-forcer/.test(cam), 'bouton repérable');
  ok(/\.qualiteForcee = guide\.descriptifForcee\(/.test(cam), 'la photo validée porte le descriptif forcé');
  // Pointage / appels sans guide : aucun bouton
  ok(!/Envoyer quand même/.test(cam.split('function ouvrirCamera')[0]), 'rien de tel hors de ouvrirCamera');
  ok(/if \(guide && capturerGuide\(video\)\) return;/.test(cam), 'chemin guidé toujours conditionné à l\'option');
}

// ---------- 4. Câblage dans l'envoi (Relevés Piste) ----------
{
  const rp = lire(SRC_PAGE);
  ok(/fichier\.qualiteForcee/.test(rp) && /suffixeNomForcee\(fichier\.qualiteForcee\)/.test(rp), 'envoyerPhoto lit la marque de la photo d\'origine (avant redimensionnement)');
  ok(/\$\{date\}_\$\{emp\.id\}_\$\{Date\.now\(\)\}\$\{suffixeForcee\}\.\$\{fmtEnvoi\.ext\}/.test(rp), 'le chemin garde date_uid_ puis ajoute le suffixe avant l\'extension');
  ok(/\.insert\(\{ site: emp\.site_id, fichier_path: chemin, type_document: 'jaugeage_veeder_root', status: 'en_attente', depose_par: emp\.id \}\)/.test(rp), 'insertion inchangée : aucune colonne ajoutée');
  ok((rp.match(/ouvrirCamera\(\{[^}]*\}\)/g) || []).length === 1, 'toujours un seul appel de caméra');
}

console.log(`test_jaugeage_qualite_forcee_20261022 : ${passes} vérifications réussies, ${echecs} échec(s)`);
process.exit(echecs ? 1 : 0);
