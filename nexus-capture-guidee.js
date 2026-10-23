'use strict';
// Capture guidée du jaugeage Veeder-Root (lot JAUGEAGE-OCR-2-20261022, decision-4).
// Module PUR : aucune dépendance au DOM, testable sous Node. nexus-camera-page.js ne l'emploie que si l'appelant
// lui passe l'option `guide` ; sans elle, la caméra se comporte exactement comme avant (Pointage ne l'utilise pas).
//
// PROPORTIONS DE L'ÉCRAN (largeur / hauteur de la dalle TLS-4B, hors cadre noir) : 5/3 ≈ 1,667.
//   Preuve de confirmation : mesure sur UNE seule photo réelle, celle du 21/10/2026 (1080 × 1920) — dalle visible de
//   x ≈ 110 à 1005 et y ≈ 800 à 1330, soit 895 × 530 px, rapport 1,69. La prise est légèrement oblique : l'écart
//   à 5/3 (1 %) est dans la tolérance de la visée. NON confirmé sur la fiche du constructeur ni sur d'autres photos :
//   à reconfirmer sur les quinze photos de calibration avant de figer. L'ancien guide statique des Relevés piste
//   (4/3) n'est pas aligné sur cette mesure ; il n'est pas modifié ici.
// SEUILS DE NETTETÉ ET DE REFLET : PROVISOIRES. Fixés sur des images synthétiques (voir test_capture_guidee_20261022.js),
//   jamais sur des photos réelles ; seuls la recette iPhone puis la calibration sur les quinze photos peuvent les figer.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NexusCaptureGuidee = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const PROPORTION_ECRAN = 5 / 3;
  const LARGEUR_CADRE = 0.92;     // part de la largeur de la visée occupée par le cadre
  const HAUTEUR_CADRE_MAX = 0.6;  // ... et de sa hauteur, au plus
  // Le recadrage garde le cadre PLUS cette marge de chaque côté (part du cadre) : l'en-tête date/heure, au ras du haut
  // de la dalle, et un opérateur qui cadre un peu large ne perdent rien.
  const MARGE_RECADRAGE = 0.06;
  const LARGEUR_ANALYSE = 480;    // l'analyse porte sur une réduction : le délai ne dépend pas du capteur
  const NIVEAU_BLANC = 253;       // un pixel « brûlé » (reflet) ; le fond blanc-bleuté de la dalle reste sous ce niveau
  const BLOC_REFLET = 8;
  const SEUIL_REFLET = 0.03;      // PROVISOIRE : part de blocs 8×8 entièrement brûlés au-delà de laquelle on rejette
  const SEUIL_NETTETE = 500;      // PROVISOIRE : variance du laplacien (image réduite à 480 px) en dessous de laquelle on rejette.
  // Synthétique, traits de 6 px : net 8157, flou 5 px 1025, flou 9 px 222, flou 17 px 62. Un écran réel moins contrasté peut exiger un autre seuil.
  const CONSIGNE = 'Faites entrer l\'écran dans le cadre';
  const MESSAGE_FLOU = 'Photo floue, reprenez-la';
  const MESSAGE_REFLET = 'Reflet sur l\'écran, reprenez-la';

  // Cadre dans la visée (coordonnées d'affichage), centré, aux proportions de l'écran.
  function calculerCadre(vueW, vueH) {
    if (!(vueW > 0) || !(vueH > 0)) return null;
    let w = vueW * LARGEUR_CADRE;
    let h = w / PROPORTION_ECRAN;
    if (h > vueH * HAUTEUR_CADRE_MAX) { h = vueH * HAUTEUR_CADRE_MAX; w = h * PROPORTION_ECRAN; }
    return { x: (vueW - w) / 2, y: (vueH - h) / 2, w, h };
  }

  // La visée affiche la vidéo en « cover » : une partie du flux est rognée. Convertit un rectangle d'affichage en pixels du flux.
  function cadreEnVideo(videoW, videoH, vueW, vueH, r) {
    if (!(videoW > 0) || !(videoH > 0) || !(vueW > 0) || !(vueH > 0) || !r) return null;
    const echelle = Math.max(vueW / videoW, vueH / videoH);
    const dx = (videoW * echelle - vueW) / 2, dy = (videoH * echelle - vueH) / 2;
    return { x: (r.x + dx) / echelle, y: (r.y + dy) / echelle, w: r.w / echelle, h: r.h / echelle };
  }

  // Rectangle à recadrer dans le flux : le cadre élargi de la marge, borné à l'image, en pixels entiers.
  function calculerRecadrage(videoW, videoH, vueW, vueH) {
    const cadre = calculerCadre(vueW, vueH);
    const v = cadre && cadreEnVideo(videoW, videoH, vueW, vueH, cadre);
    if (!v) return null;
    const mx = v.w * MARGE_RECADRAGE, my = v.h * MARGE_RECADRAGE;
    const x0 = Math.max(0, Math.floor(v.x - mx)), y0 = Math.max(0, Math.floor(v.y - my));
    const x1 = Math.min(videoW, Math.ceil(v.x + v.w + mx)), y1 = Math.min(videoH, Math.ceil(v.y + v.h + my));
    if (x1 - x0 < 1 || y1 - y0 < 1) return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // RGBA -> niveaux de gris, réduit par moyenne de blocs à LARGEUR_ANALYSE au plus (jamais agrandi).
  function reduireEnGris(rgba, w, h) {
    const f = Math.max(1, Math.floor(w / LARGEUR_ANALYSE));
    const ow = Math.floor(w / f), oh = Math.floor(h / f);
    const gris = new Uint8Array(ow * oh);
    for (let oy = 0; oy < oh; oy++) for (let ox = 0; ox < ow; ox++) {
      let s = 0;
      for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) {
        const k = ((oy * f + j) * w + (ox * f + i)) * 4;
        s += 0.299 * rgba[k] + 0.587 * rgba[k + 1] + 0.114 * rgba[k + 2];
      }
      gris[oy * ow + ox] = Math.round(s / (f * f));
    }
    return { gris, w: ow, h: oh };
  }

  // Variance du laplacien : forte quand les contours sont nets, faible quand l'image est floue ou unie.
  function mesurerNettete(gris, w, h) {
    if (w < 3 || h < 3) return 0;
    let n = 0, somme = 0, somme2 = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = 4 * gris[i] - gris[i - 1] - gris[i + 1] - gris[i - w] - gris[i + w];
      somme += l; somme2 += l * l; n++;
    }
    const moy = somme / n;
    return somme2 / n - moy * moy;
  }

  // Part de blocs 8×8 dont TOUS les pixels sont brûlés : un reflet couvre une surface, un pixel isolé n'en est pas un.
  function mesurerReflet(gris, w, h) {
    const bw = Math.floor(w / BLOC_REFLET), bh = Math.floor(h / BLOC_REFLET);
    if (!bw || !bh) return 0;
    let brules = 0;
    for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
      let tous = true;
      for (let j = 0; j < BLOC_REFLET && tous; j++) for (let i = 0; i < BLOC_REFLET; i++) {
        if (gris[(by * BLOC_REFLET + j) * w + bx * BLOC_REFLET + i] < NIVEAU_BLANC) { tous = false; break; }
      }
      if (tous) brules++;
    }
    return brules / (bw * bh);
  }

  // Verdict qualité d'une image RGBA (celle du recadrage). Le reflet prime : il écrase aussi la netteté.
  function evaluerQualite(rgba, w, h) {
    const r = reduireEnGris(rgba, w, h);
    const reflet = mesurerReflet(r.gris, r.w, r.h);
    const nettete = mesurerNettete(r.gris, r.w, r.h);
    let motif = null;
    if (reflet > SEUIL_REFLET) motif = 'reflet';
    else if (nettete < SEUIL_NETTETE) motif = 'flou';
    return { ok: motif === null, motif, nettete, reflet, message: motif === 'reflet' ? MESSAGE_REFLET : motif === 'flou' ? MESSAGE_FLOU : '' };
  }

  // « Envoyer quand même » : après SEUIL_REFUS_FORCER refus consécutifs, la photo peut partir malgré le verdict.
  // Elle est alors marquée (qualite_forcee) avec la netteté et le reflet mesurés, pour calibrer les seuils plus tard.
  const SEUIL_REFUS_FORCER = 2;
  const refusSuivant = (compteur, q) => (q && q.ok) ? 0 : compteur + 1;
  const forcagePropose = compteur => compteur >= SEUIL_REFUS_FORCER;
  const descriptifForcee = q => ({ qualite_forcee: true, nettete: q.nettete, reflet: q.reflet, motif: q.motif });
  // Marque portée par le nom de l'objet (aucune colonne dédiée dans documents_ocr_file) : _qforcee-n<netteté>-r<reflet en ‰>.
  // Placée après date_uid_<ms> : la politique de stockage (date, uid, extension) la laisse passer.
  function suffixeNomForcee(d) {
    if (!d || d.qualite_forcee !== true) return '';
    return '_qforcee-n' + Math.round(d.nettete) + '-r' + Math.round(d.reflet * 1000);
  }

  // Nom de l'objet envoyé : AAAA-MM-JJ_<uid>_nexus-jaug_<site>_<HHhMM>[-N][_qforcee-…].<ext>, à l'heure de la STATION.
  // La date puis `_<uid>_` en tête sont exigées par la politique de stockage (like '____-__-__\_<auth.uid()>\_%') : ne pas les déplacer.
  // Sans fuseau, uid, site ou extension valides : null (aucun nom deviné). rang >= 2 ajoute -N (collision dans la même minute).
  const LIMITE_RANG = 9;
  function nomPhotoJaugeage(o) {
    o = o || {};
    if (!o.fuseau || !o.uid || !o.site || !o.ext) return null;
    if (!/^[a-z0-9-]+$/.test(o.site) || !/^[0-9a-f-]{36}$/.test(o.uid) || !/^(jpg|jpeg|png|webp|heic)$/.test(o.ext)) return null;
    const d = o.instant instanceof Date ? o.instant : new Date(o.instant);
    if (isNaN(d.getTime())) return null;
    let p;
    try {
      p = new Intl.DateTimeFormat('en-CA', { timeZone: o.fuseau, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(d).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
    } catch (e) { return null; }
    const rang = o.rang > 1 ? '-' + Math.floor(o.rang) : '';
    return p.year + '-' + p.month + '-' + p.day + '_' + o.uid + '_nexus-jaug_' + o.site + '_' + p.hour + 'h' + p.minute + rang + suffixeNomForcee(o.forcee) + '.' + o.ext;
  }

  const GUIDE_JAUGEAGE = Object.freeze({ consigne: CONSIGNE });

  return { PROPORTION_ECRAN, LARGEUR_CADRE, HAUTEUR_CADRE_MAX, MARGE_RECADRAGE, LARGEUR_ANALYSE, NIVEAU_BLANC, SEUIL_REFLET, SEUIL_NETTETE,
    CONSIGNE, MESSAGE_FLOU, MESSAGE_REFLET, GUIDE_JAUGEAGE, SEUIL_REFUS_FORCER, refusSuivant, forcagePropose, descriptifForcee, suffixeNomForcee, nomPhotoJaugeage, LIMITE_RANG,
    calculerCadre, cadreEnVideo, calculerRecadrage, reduireEnGris, mesurerNettete, mesurerReflet, evaluerQualite };
});
