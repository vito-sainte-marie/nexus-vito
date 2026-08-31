// NEXUS Inventaire V2 — Stock localisé : sécurisation UX du relevé physique
// Présentation uniquement : ne modifie ni le moteur de stock, ni la persistance.
// Objectif : éviter qu'un filtre de recherche actif masque des références alors
// que le relevé physique de la catégorie attend toutes les références affichables.
(function nexusStockLocaliseUxV2() {
  'use strict';

  if ((window.location.pathname.split('/').pop() || '') !== 'NEXUS-Stock-Localise-v1.html') return;

  function init() {
    const recherche = document.getElementById('recherche');
    const btnReleve = document.getElementById('btnReleve');
    const btnAnnuler = document.getElementById('btnAnnuler');
    const btnEnregistrer = document.getElementById('btnEnregistrer');
    const status = document.getElementById('status');
    const toolbar = document.querySelector('.toolbar');
    if (!recherche || !btnReleve || !btnAnnuler || !btnEnregistrer || !toolbar) return false;
    if (document.getElementById('nexusStockLocaliseSearchHelp')) return true;

    const style = document.createElement('style');
    style.textContent = `
      #recherche.nexus-releve-verrouille{opacity:.52;cursor:not-allowed}
      #nexusStockLocaliseSearchHelp{grid-column:1/-1;margin:-4px 2px 2px;color:var(--dim);font-size:10.5px;line-height:1.4}
      #nexusStockLocaliseSearchHelp strong{color:var(--mid);font-weight:600}
      #nexusStockLocaliseMode{display:none;align-items:center;gap:6px;margin:0 0 12px;padding:8px 10px;border:1px solid rgba(79,195,217,.2);border-radius:10px;background:rgba(79,195,217,.05);color:var(--mid);font-size:11px;line-height:1.4}
      #nexusStockLocaliseMode.is-active{display:flex}
      #nexusStockLocaliseMode b{color:#c9f7ff}
    `;
    document.head.appendChild(style);

    const aide = document.createElement('div');
    aide.id = 'nexusStockLocaliseSearchHelp';
    aide.innerHTML = '<strong>Recherche :</strong> utile pour consulter une référence. Lors d’un relevé physique, NEXUS réaffiche toute la catégorie pour éviter un comptage partiel involontaire.';
    toolbar.appendChild(aide);

    const mode = document.createElement('div');
    mode.id = 'nexusStockLocaliseMode';
    mode.innerHTML = '● <span><b>Relevé physique en cours</b> — comptez toutes les références de la catégorie dans chaque emplacement.</span>';
    const summary = document.getElementById('summary');
    if (summary && summary.parentNode) summary.parentNode.insertBefore(mode, summary.nextSibling);

    function verrouillerRecherche() {
      // Le moteur actuel enregistre un relevé complet de catégorie. Un filtre actif
      // au démarrage rendrait certaines lignes invisibles et empêcherait la validation.
      if (recherche.value) {
        recherche.value = '';
        recherche.dispatchEvent(new Event('input', { bubbles: true }));
      }
      recherche.disabled = true;
      recherche.classList.add('nexus-releve-verrouille');
      recherche.placeholder = 'Recherche suspendue pendant le relevé';
      mode.classList.add('is-active');
    }

    function deverrouillerRecherche() {
      recherche.disabled = false;
      recherche.classList.remove('nexus-releve-verrouille');
      recherche.placeholder = 'Rechercher un produit…';
      mode.classList.remove('is-active');
    }

    // Capture : nettoyer le filtre avant que le gestionnaire métier ne rende les champs.
    btnReleve.addEventListener('click', verrouillerRecherche, true);
    btnAnnuler.addEventListener('click', deverrouillerRecherche);

    // La sauvegarde est asynchrone dans la page. On ne déverrouille qu'après le retour
    // visuel d'un enregistrement réussi, afin de ne pas perturber une erreur de saisie.
    if (status) {
      const observer = new MutationObserver(() => {
        const texte = (status.textContent || '').toLowerCase();
        if (texte.includes('relevé enregistré') || texte.includes('releve enregistre')) deverrouillerRecherche();
      });
      observer.observe(status, { childList: true, characterData: true, subtree: true });
    }

    // Si l'utilisateur revient sur la page après un rerender ou une annulation native.
    btnEnregistrer.addEventListener('click', () => {
      if (!recherche.disabled) verrouillerRecherche();
    }, true);

    return true;
  }

  if (init()) return;
  let essais = 0;
  const timer = setInterval(() => {
    essais += 1;
    if (init() || essais >= 40) clearInterval(timer);
  }, 150);
})();
