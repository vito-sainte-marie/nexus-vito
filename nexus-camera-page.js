// Caméra EN PAGE et réduction de photo, partagées (lot JAUGEAGE-PHOTO-20261021).
// Même mécanisme que le Pointage : getUserMedia dans la page (jamais quitter la page NEXUS),
// appareil photo natif en repli via un <label for=…> sur un champ déjà présent, jamais bloquant.
// ouvrirCamera résout : un File (photo validée) | 'repli' (le natif prend le relais) | null (annulé).
// Option `guide` (jaugeage, lot JAUGEAGE-OCR-2) : un module du type nexus-capture-guidee.js. Sans elle, rien ne change :
// ni cadre, ni recadrage, ni contrôle qualité (le Pointage et les autres appelants restent à l'identique).
(function (global) {
  'use strict';
  const DIM_MAX = 2000;
  const QUALITE_JPEG = 0.85;

  // Plafonne le grand côté à DIM_MAX, sans jamais agrandir. null si les dimensions sont inexploitables.
  function calculerDimensions(w, h) {
    if (!(w > 0) || !(h > 0)) return null;
    const ratio = Math.min(1, DIM_MAX / Math.max(w, h));
    return { w: Math.round(w * ratio), h: Math.round(h * ratio) };
  }

  // Redimensionne en JPEG ; au moindre échec on garde le fichier d'origine plutôt que de bloquer l'envoi.
  async function redimensionnerPhoto(file) {
    try {
      if (!file || !file.type || !file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return file;
      const bitmap = await createImageBitmap(file);
      const d = calculerDimensions(bitmap.width, bitmap.height);
      const dejaPetite = d && d.w === bitmap.width && d.h === bitmap.height;
      if (!d || (dejaPetite && file.type === 'image/jpeg')) { if (bitmap.close) bitmap.close(); return file; }
      const canvas = document.createElement('canvas');
      canvas.width = d.w; canvas.height = d.h;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, d.w, d.h);
      if (bitmap.close) bitmap.close();
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', QUALITE_JPEG));
      if (!blob) return file;
      return new File([blob], (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch (err) {
      console.error('Redimensionnement photo (fichier d\'origine conservé) :', err);
      return file;
    }
  }

  const CSS = `.camera-overlay{position:fixed;inset:0;background:#000;z-index:100;display:flex;flex-direction:column}
.camera-video-wrap{flex:1;position:relative;overflow:hidden;background:#000}
.camera-video-wrap video,.camera-video-wrap img{width:100%;height:100%;object-fit:cover;display:block}
.camera-consigne{position:absolute;top:0;left:0;right:0;padding:14px 18px;padding-top:calc(14px + env(safe-area-inset-top));background:linear-gradient(rgba(0,0,0,.65),transparent);color:#fff;font-size:13px;line-height:1.5;text-align:center}
.camera-close{position:absolute;top:calc(14px + env(safe-area-inset-top));right:14px;width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.25);color:#fff;font-size:16px;display:flex;align-items:center;justify-content:center;cursor:pointer}
.camera-controls{padding:22px 20px calc(22px + env(safe-area-inset-bottom));background:#0B0F14;display:flex;align-items:center;justify-content:center}
.camera-btn-capture{width:68px;height:68px;min-height:68px;padding:0;border-radius:50%;background:#fff;border:4px solid rgba(255,255,255,.35);cursor:pointer}
.camera-controls-preview{padding:18px 20px calc(18px + env(safe-area-inset-bottom));background:#0B0F14;display:flex;gap:12px}
.camera-btn-texte{flex:1;padding:14px;border-radius:10px;font:600 14px 'IBM Plex Sans',system-ui,sans-serif;cursor:pointer;border:none;text-align:center}
.camera-btn-texte.reprendre{background:#1A222C;color:#EDF1F5;border:1px solid #242E38}
.camera-btn-texte.valider{background:#4FC3D9;color:#04141a}
.camera-cadre{position:absolute;box-sizing:border-box;border:2px solid rgba(79,195,217,.95);border-radius:6px;box-shadow:0 0 0 9999px rgba(0,0,0,.45);pointer-events:none}
.camera-cadre::before,.camera-cadre::after{content:'';position:absolute;background:rgba(79,195,217,.55)}
.camera-cadre::before{left:50%;top:0;bottom:0;width:1px}
.camera-cadre::after{top:50%;left:0;right:0;height:1px}
.camera-rejet{position:absolute;left:16px;right:16px;bottom:16px;padding:12px 14px;border-radius:10px;background:rgba(160,30,30,.92);color:#fff;font:600 14px 'IBM Plex Sans',system-ui,sans-serif;text-align:center}
.camera-etat{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:32px;text-align:center;color:#fff;font-size:13.5px;line-height:1.6}
.camera-etat-actions{margin-top:18px;display:flex;flex-direction:column;gap:10px;width:100%;max-width:280px}
.camera-etat-actions button,.camera-etat-actions label{display:block;padding:13px;border-radius:10px;font:600 13.5px 'IBM Plex Sans',system-ui,sans-serif;cursor:pointer;border:none;text-align:center}
.camera-etat-actions .primaire{background:#4FC3D9;color:#04141a}
.camera-etat-actions .secondaire{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.25)}`;

  function poserCss() {
    if (document.getElementById('nexus-camera-page-css')) return;
    const s = document.createElement('style'); s.id = 'nexus-camera-page-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function ouvrirCamera({ consigne, inputId, guide }) {
    poserCss();
    if (guide && guide.CONSIGNE) consigne = guide.CONSIGNE;
    return new Promise(resolve => {
      let flux = null, url = null, resolu = false;
      const overlay = document.createElement('div');
      overlay.className = 'camera-overlay';
      document.body.appendChild(overlay);
      const libererUrl = () => { if (url) { try { URL.revokeObjectURL(url); } catch (e) {} url = null; } };
      const arreter = () => { if (flux) { flux.getTracks().forEach(t => { try { t.stop(); } catch (e) {} }); flux = null; } libererUrl(); };
      function fermer(v) { if (resolu) return; resolu = true; arreter(); overlay.remove(); resolve(v); }
      const etat = html => { overlay.innerHTML = `<div class="camera-etat">${html}</div>`; };

      function repli(message) {
        etat(`<div><div style="margin-bottom:6px;font-size:22px">📷</div><div>${message}</div>
          <div class="camera-etat-actions">
            <label class="primaire" for="${inputId}">Utiliser l'appareil photo du téléphone</label>
            <button class="secondaire" type="button" data-annuler-camera>Annuler</button>
          </div></div>`);
        overlay.querySelector('[data-annuler-camera]').addEventListener('click', () => fermer(null));
        // Vrai clic utilisateur sur le champ natif masqué : son écouteur 'change' prend le relais.
        overlay.querySelector(`label[for="${inputId}"]`).addEventListener('click', () => fermer('repli'));
      }
      async function demarrer() {
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') { repli("La capture caméra intégrée n'est pas disponible sur ce navigateur."); return; }
        etat('Ouverture de la caméra…');
        try { flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }); }
        catch (err) {
          console.error('getUserMedia (caméra en page):', err);
          const refuse = err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
          repli(refuse ? "Accès à la caméra refusé. Autorisez-le dans les réglages du téléphone, ou utilisez l'appareil photo natif ci-dessous."
            : "Impossible d'ouvrir la caméra intégrée. Utilisez l'appareil photo de votre téléphone à la place.");
          return;
        }
        if (resolu) { arreter(); return; }
        vue();
      }
      function vue() {
        overlay.innerHTML = `<div class="camera-video-wrap"><div class="camera-consigne">${consigne}</div><div class="camera-close" data-fermer>✕</div><video autoplay playsinline muted></video></div>
          <div class="camera-controls"><button type="button" class="camera-btn-capture" aria-label="Prendre la photo"></button></div>`;
        const video = overlay.querySelector('video');
        video.srcObject = flux;
        if (guide) poserCadre(video);
        overlay.querySelector('[data-fermer]').addEventListener('click', () => fermer(null));
        overlay.querySelector('.camera-btn-capture').addEventListener('click', () => capturer(video));
      }
      // Cadre aux proportions de l'écran, posé sur la visée et recalculé si la visée change de taille.
      function poserCadre(video) {
        const wrap = video.parentNode;
        const cadre = document.createElement('div'); cadre.className = 'camera-cadre'; cadre.setAttribute('data-cadre-guide', '');
        wrap.insertBefore(cadre, video.nextSibling);
        const placer = () => {
          const c = guide.calculerCadre(wrap.clientWidth, wrap.clientHeight);
          if (!c) return;
          cadre.style.left = c.x + 'px'; cadre.style.top = c.y + 'px'; cadre.style.width = c.w + 'px'; cadre.style.height = c.h + 'px';
        };
        placer();
        window.addEventListener('resize', placer);
        if (typeof ResizeObserver === 'function') new ResizeObserver(placer).observe(wrap);
      }
      // Recadre sur le cadre (marge comprise), contrôle netteté et reflet. null : rejet, le message est déjà affiché.
      // Hors cadre calculable (flux sans dimensions), on retombe sur la capture entière, sans contrôle : jamais bloquant.
      function capturerGuide(video) {
        const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const wrap = video.parentNode;
        const r = guide.calculerRecadrage(video.videoWidth, video.videoHeight, wrap.clientWidth, wrap.clientHeight);
        if (!r) return false;
        const canvas = document.createElement('canvas');
        canvas.width = r.w; canvas.height = r.h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        const q = guide.evaluerQualite(ctx.getImageData(0, 0, r.w, r.h).data, r.w, r.h);
        const delai = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
        global.__nexusCaptureGuideeDernierDelaiMs = delai;
        if (!q.ok) { montrerRejet(wrap, q.message); return true; }
        canvas.toBlob(blob => {
          if (!blob) { repli("La photo n'a pas pu être capturée. Utilisez l'appareil photo de votre téléphone à la place."); return; }
          url = URL.createObjectURL(blob);
          apercu(blob);
        }, 'image/jpeg', 0.92);
        return true;
      }
      function montrerRejet(wrap, message) {
        const ancien = wrap.querySelector('.camera-rejet'); if (ancien) ancien.remove();
        const m = document.createElement('div'); m.className = 'camera-rejet'; m.setAttribute('role', 'alert'); m.textContent = message;
        wrap.appendChild(m);
        setTimeout(() => m.remove(), 4000);
      }
      function capturer(video) {
        if (guide && capturerGuide(video)) return;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (!blob) { repli("La photo n'a pas pu être capturée. Utilisez l'appareil photo de votre téléphone à la place."); return; }
          url = URL.createObjectURL(blob);
          apercu(blob);
        }, 'image/jpeg', 0.92);
      }
      function apercu(blob) {
        overlay.innerHTML = `<div class="camera-video-wrap"><div class="camera-consigne">${consigne}</div><div class="camera-close" data-fermer>✕</div><img src="${url}" alt="Photo prise"></div>
          <div class="camera-controls-preview"><button type="button" class="camera-btn-texte reprendre" data-reprendre>Reprendre</button><button type="button" class="camera-btn-texte valider" data-valider>Valider cette photo</button></div>`;
        overlay.querySelector('[data-fermer]').addEventListener('click', () => fermer(null));
        overlay.querySelector('[data-reprendre]').addEventListener('click', () => { libererUrl(); vue(); });
        overlay.querySelector('[data-valider]').addEventListener('click', () => fermer(new File([blob], 'photo.jpg', { type: 'image/jpeg' })));
      }
      demarrer();
    });
  }

  const api = { DIM_MAX, QUALITE_JPEG, calculerDimensions, redimensionnerPhoto, ouvrirCamera };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.NexusCameraPage = api;
})(typeof window !== 'undefined' ? window : globalThis);
