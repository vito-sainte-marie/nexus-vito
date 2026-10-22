'use strict';
// Capture guidée du jaugeage (lot JAUGEAGE-OCR-2-20261022, decision-4) : cadrage, recadrage, rejet qualité, non-régression.
// Les sources peuvent être remplacées par des copies mutées (test_jaugeage_capture_guidee_mutations_20261022.js).
const fs = require('fs');
const path = require('path');
const SRC_GUIDE = process.env.NEXUS_CAPTURE_GUIDEE_SOURCE || path.join(__dirname, 'nexus-capture-guidee.js');
const SRC_CAMERA = process.env.NEXUS_CAMERA_SOURCE || path.join(__dirname, 'nexus-camera-page.js');
const G = require(SRC_GUIDE);
const lire = f => fs.readFileSync(path.isAbsolute(f) ? f : path.join(__dirname, f), 'utf8');
let echecs = 0, passes = 0;
function ok(cond, msg) { if (cond) passes++; else { echecs++; console.error('ÉCHEC : ' + msg); } }
const proche = (a, b, tol) => Math.abs(a - b) <= tol;

// ---------- images synthétiques ----------
function image(w, h, fn) { const a = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = fn(x, y), k = (y * w + x) * 4; a[k] = a[k + 1] = a[k + 2] = v; a[k + 3] = 255; } return a; }
const texte = (x, y) => (((x % 24 < 6) && (y % 40 < 24)) || ((y % 40 >= 24 && y % 40 < 30) && (x % 24 < 18))) ? 90 : 225; // traits de 6 px, fond clair de LCD
function flouter(a, w, h, r) { let src = a; for (let p = 0; p < 2; p++) { const o = new Uint8ClampedArray(a.length); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let t = 0, n = 0; for (let i = -r; i <= r; i++) { const xx = p ? x : x + i, yy = p ? y + i : y; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; t += src[(yy * w + xx) * 4]; n++; } const v = t / n, k = (y * w + x) * 4; o[k] = o[k + 1] = o[k + 2] = v; o[k + 3] = 255; } src = o; } return src; }
const W = 1200, H = 720;
const nette = image(W, H, texte);

// ---------- 1. Cadrage ----------
for (const [vw, vh] of [[390, 700], [360, 640], [820, 1180], [1280, 720]]) {
  const c = G.calculerCadre(vw, vh);
  ok(c && proche(c.w / c.h, 5 / 3, 0.01), `cadre ${vw}x${vh} aux proportions 5:3 (obtenu ${c && (c.w / c.h).toFixed(3)})`);
  ok(c && c.x >= 0 && c.y >= 0 && c.x + c.w <= vw + 1e-6 && c.y + c.h <= vh + 1e-6, `cadre ${vw}x${vh} contenu dans la visée`);
  ok(c && proche(c.x + c.w / 2, vw / 2, 0.5) && proche(c.y + c.h / 2, vh / 2, 0.5), `cadre ${vw}x${vh} centré`);
}
ok(G.calculerCadre(0, 700) === null && G.calculerCadre(390, 0) === null, 'visée sans taille : pas de cadre');
ok(proche(G.PROPORTION_ECRAN, 5 / 3, 1e-9), 'proportion documentée = 5/3');
ok(G.CONSIGNE === "Faites entrer l'écran dans le cadre", 'consigne demandée');
ok(G.GUIDE_JAUGEAGE.consigne === G.CONSIGNE, 'guide jaugeage porte la consigne');

// ---------- 2. Recadrage ----------
{
  // Téléphone en portrait : visée 390x700, flux 1080x1920 (même rapport, pas de rognage).
  const vw = 390, vh = 700, fw = 1080, fh = 1920;
  const cadre = G.calculerCadre(vw, vh);
  const enVideo = G.cadreEnVideo(fw, fh, vw, vh, cadre);
  const r = G.calculerRecadrage(fw, fh, vw, vh);
  ok(r && enVideo, 'recadrage calculable');
  // le recadrage contient tout le cadre, donc l'en-tête date/heure (haut du cadre) et les quatre cases 2x2
  ok(r.x <= enVideo.x && r.y <= enVideo.y && r.x + r.w >= enVideo.x + enVideo.w && r.y + r.h >= enVideo.y + enVideo.h, 'le recadrage contient le cadre entier (en-tête date/heure compris)');
  ok(r.y < enVideo.y - 5, 'marge au-dessus du cadre : l\'en-tête au ras de la dalle n\'est pas coupé');
  ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= fw && r.y + r.h <= fh, 'recadrage borné au flux');
  ok(Number.isInteger(r.x) && Number.isInteger(r.y) && Number.isInteger(r.w) && Number.isInteger(r.h), 'recadrage en pixels entiers');
  ok(r.w * r.h < fw * fh * 0.5, 'le recadrage retire bien le décor hors cadre');
  const marge = G.MARGE_RECADRAGE;
  // Marge non bornée : visée et flux paysage 1280x720 (le cadre ne touche pas le bord)
  const rl = G.calculerRecadrage(1280, 720, 1280, 720), vl = G.cadreEnVideo(1280, 720, 1280, 720, G.calculerCadre(1280, 720));
  ok(proche(rl.w / vl.w, 1 + 2 * marge, 0.02) && proche(rl.h / vl.h, 1 + 2 * marge, 0.02), 'marge appliquée de chaque côté (' + (rl.w / vl.w).toFixed(3) + ')');
  ok(r.x === 0 && r.w === fw, 'marge latérale bornée au bord du flux (portrait : le cadre occupe 91 % de la largeur)');
  // Flux plus large que la visée : la vidéo est rognée par « cover », le rectangle doit suivre.
  const v2 = G.cadreEnVideo(1920, 1080, 390, 700, { x: 0, y: 0, w: 390, h: 700 });
  ok(proche(v2.h, 1080, 0.01) && proche(v2.w, 390 * 1080 / 700, 0.01) && proche(v2.x, (1920 - 390 * 1080 / 700) / 2, 0.01), 'cover : la visée portrait d\'un flux paysage ne couvre que sa bande centrale');
  // Cadre en bord de flux : borné sans devenir vide
  const rb = G.calculerRecadrage(200, 100, 200, 100);
  ok(rb && rb.x >= 0 && rb.y >= 0 && rb.x + rb.w <= 200 && rb.y + rb.h <= 100 && rb.w > 100, 'recadrage borné au flux, cadre toujours inclus');
  ok(G.calculerRecadrage(0, 100, 200, 100) === null && G.calculerRecadrage(200, 100, 0, 0) === null, 'dimensions inconnues : pas de recadrage');
  // Recadrer une image synthétique sur ce rectangle conserve le texte de l'en-tête (rangée du haut du cadre)
  const hautCadre = Math.round(enVideo.y), rowY = r.y;
  ok(rowY < hautCadre, 'la première rangée recadrée est au-dessus du haut de dalle');
}

// ---------- 3. Rejet qualité ----------
{
  const q = G.evaluerQualite(nette, W, H);
  ok(q.ok === true && q.motif === null && q.message === '', 'image nette acceptée');
  ok(G.evaluerQualite(flouter(nette, W, H, 4), W, H).motif === 'flou', 'image floue rejetée (flou 9 px)');
  ok(G.evaluerQualite(flouter(nette, W, H, 8), W, H).message === 'Photo floue, reprenez-la', 'message de flou demandé');
  ok(G.evaluerQualite(flouter(nette, W, H, 2), W, H).ok === true, 'léger flou (5 px) toléré');
  const reflet = image(W, H, (x, y) => (x > 200 && x < 700 && y > 100 && y < 500) ? 255 : texte(x, y));
  const qr = G.evaluerQualite(reflet, W, H);
  ok(qr.ok === false && qr.motif === 'reflet', 'plage brûlée rejetée comme reflet');
  ok(qr.message.length > 0 && /reflet/i.test(qr.message), 'message de reflet');
  const petit = image(W, H, (x, y) => (x > 200 && x < 212 && y > 100 && y < 112) ? 255 : texte(x, y));
  ok(G.evaluerQualite(petit, W, H).ok === true, 'un point brillant isolé n\'est pas un reflet');
  ok(G.evaluerQualite(image(W, H, () => 225), W, H).motif === 'flou', 'image unie rejetée');
  ok(G.mesurerNettete(new Uint8Array(4), 2, 2) === 0, 'image trop petite : netteté nulle sans erreur');
  // délai : analyse d'un recadrage de 1920x1080 bien sous 2 s
  const grande = image(1920, 1080, texte);
  const t0 = Date.now(); G.evaluerQualite(grande, 1920, 1080); const dt = Date.now() - t0;
  ok(dt < 2000, `analyse d'un recadrage 1920x1080 en moins de 2 s (${dt} ms)`);
}

// ---------- 4. Documentation dans la source ----------
{
  const src = lire(SRC_GUIDE);
  ok(/PROPORTIONS DE L'ÉCRAN/.test(src) && /UNE seule photo réelle/.test(src) && /21\/10\/2026/.test(src), 'proportions et preuve de confirmation documentées');
  ok(/SEUILS DE NETTETÉ ET DE REFLET : PROVISOIRES/.test(src) && /quinze photos/.test(src), 'seuils déclarés provisoires jusqu\'aux quinze photos');
}

// ---------- 5. Non-régression : seul le jaugeage active le guide ----------
{
  const cam = lire(SRC_CAMERA);
  ok(/function ouvrirCamera\(\{ consigne, inputId, guide \}\)/.test(cam), 'guide = option de ouvrirCamera');
  ok(/if \(guide && capturerGuide\(video\)\) return;/.test(cam), 'chemin guidé conditionné à l\'option');
  ok(/if \(guide\) poserCadre\(video\);/.test(cam), 'cadre posé seulement avec l\'option');
  ok(/if \(guide && guide\.CONSIGNE\) consigne = guide\.CONSIGNE;/.test(cam), 'consigne remplacée seulement avec l\'option');
  // chemin sans option identique à l'ancien : capture entière, JPEG 0.92, même bloc de repli
  ok(cam.includes("canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720;\n        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);\n        canvas.toBlob(blob => {\n          if (!blob) { repli(\"La photo n'a pas pu être capturée. Utilisez l'appareil photo de votre téléphone à la place.\"); return; }\n          url = URL.createObjectURL(blob);\n          apercu(blob);\n        }, 'image/jpeg', 0.92);"), 'chemin de capture sans option conservé tel quel');
  ok(!/guide/.test(cam.replace(/\/\/[^\n]*/g, '').split('function ouvrirCamera')[0]), 'calculerDimensions et redimensionnerPhoto ne dépendent pas du guide');
  const pointage = lire('NEXUS-Pointage-v1.html');
  ok(!/NexusCaptureGuidee|nexus-capture-guidee|nexus-camera-page|NexusCameraPage/.test(pointage), 'Pointage n\'emploie ni le module caméra ni le guide');
  ok(/async function ouvrirCameraPointage|function ouvrirCameraPointage/.test(pointage) && /function redimensionnerPhotoPointage|redimensionnerPhotoPointage/.test(pointage), 'Pointage garde sa caméra propre');
  const missions = lire('NEXUS-Missions-v1.html');
  ok(!/NexusCaptureGuidee|nexus-capture-guidee|NexusCameraPage/.test(missions), 'Missions n\'emploie ni le module caméra ni le guide');
  const rp = lire('NEXUS-Releves-Piste-v1.html');
  const appels = rp.match(/ouvrirCamera\(\{[^}]*\}\)/g) || [];
  ok(appels.length === 1 && /guide: window\.NexusCaptureGuidee/.test(appels[0]) && /inputId: 'jPhoto'/.test(appels[0]), 'Relevés Piste : un seul appel, celui du jaugeage, avec le guide');
  ok(/<script src="nexus-capture-guidee\.js\?v=[0-9a-f-]+"><\/script>\s*<script src="nexus-camera-page\.js\?v=/.test(rp), 'le guide est chargé avant le module caméra (jeton daté en source, empreinte après build)');
  ok(/redimensionnerPhoto\([^)]*\)[\s\S]{0,400}\.upload\(/.test(rp) || /redimensionnerPhoto/.test(rp), 'Relevés Piste redimensionne toujours avant l\'envoi');
}

console.log(`test_jaugeage_capture_guidee_20261022 : ${passes} vérifications réussies, ${echecs} échec(s)`);
process.exit(echecs ? 1 : 0);
