/* NEXUS — Prise de poste en un appui (lot PRISE-DE-POSTE-UN-ECRAN-20261025)
 *
 * Ce module est le SEUL endroit de NEXUS qui enregistre une prise de poste
 * (RPC nexus_changer_de_quart). Il est monté par deux hôtes :
 *   - NEXUS-Prise-De-Poste-v1.html (la page, inchangée dans son rôle) ;
 *   - NEXUS-App-v1.html (l'Accueil d'un employé sans service ouvert).
 * Les deux affichent les mêmes trois cartes Piste / Caisse / Renfort ; un seul
 * appui sur une carte enregistre le poste et ouvre la suite. Il n'y a plus ni
 * « Continuer », ni récapitulatif, ni écran « confirmée » avant l'écriture.
 *
 * Ce que ce module ne fait jamais :
 *   - présélectionner un poste : les employés sont polyvalents, sans l'option
 *     planning aucun poste n'est choisi à leur place. Le poste le plus fréquent
 *     reste un simple badge, jamais une présélection ;
 *   - écrire autrement que sur l'appui d'une carte (ni au montage, ni à la
 *     lecture de l'URL, ni en consultant « Ma progression ») ;
 *   - lire autre chose que ce que la page lisait déjà.
 *
 * Aucune variable globale : tout est dans NexusPriseDePoste.
 */
(function (global) {
  'use strict';

  // Intitulé « Renfort opérationnel » (03/08/2026) : renommage d'affichage
  // uniquement — la valeur stockée reste 'renfort' (shifts.role,
  // mission_catalog.role_required). « Boutique » devient « Caisse » à l'écran
  // (brief du 25/10/2026) ; la valeur stockée reste 'caissiere'.
  // `image` : WebP ~400 px, épinglé à la main (outils/build.sh n'épingle que
  // les .js et .css). Voir assets/postes/ORIGINE.md.
  const ROLES = [
    { value: 'pompiste',  label: 'Piste',   icon: 'icon-role-pompiste.png',  image: 'assets/postes/poste-pompiste.webp?v=e40da5c9', sousTitre: 'Service carburant et contrôles' },
    { value: 'caissiere', label: 'Caisse',  icon: 'icon-role-caissiere.png', image: 'assets/postes/poste-caissiere.webp?v=78f52dcb', sousTitre: 'Encaissement et accueil client' },
    { value: 'renfort',   label: 'Renfort', icon: 'icon-role-renfort.png',   image: 'assets/postes/poste-renfort.webp?v=3ee33e46', sousTitre: 'Appui à l\'équipe' },
    { value: 'manager',   label: 'Manager', icon: 'icon-role-manager.png' },
  ];

  let employeeCourant = null;
  let roleChoisi = null;
  let hoteCourant = null;
  let optionsCourantes = {};
  // Poste le plus fréquent (fonction SQL poste_le_plus_frequent) : null tant
  // que non lu ou si la lecture échoue ; l'écran reste alors pleinement utilisable.
  let posteFrequent = null;
  let catalogue = [];

  function roleInfo(value) {
    return ROLES.find(r => r.value === value) || { value, label: value, icon: '❔' };
  }

  // Correspondance entre le rôle ADMINISTRATIF (employees.role) et le rôle du
  // jour. La base écrit 'caissier' au masculin, l'écran propose 'caissiere'.
  const ROLE_ADMIN_VERS_JOUR = { pompiste: 'pompiste', caissier: 'caissiere', caissiere: 'caissiere', renfort: 'renfort' };

  /**
   * Les rôles réellement proposables à CETTE employée pour SA journée.
   *
   * LA RÈGLE, arbitrée le 15/10/2026 : tous les employés opérationnels sont
   * polyvalents. employees.role n'est plus qu'une fiche.
   *     fiche non manager        → pompiste, caissiere, renfort
   *     fiche manager/gerant     → tous les rôles existants
   *     fiche inconnue/absente   → pompiste, caissiere, renfort + anomalie
   * Le poste de manager n'est JAMAIS proposé à qui n'est ni manager ni
   * gérant : c'est la seule ligne de cette matrice qui touche aux permissions.
   */
  function rolesDisponibles() {
    const estManager = employeeCourant.role === 'manager' || employeeCourant.role === 'gerant';
    if (estManager) return ROLES;
    const admin = (employeeCourant && employeeCourant.role) || '';
    if (!ROLE_ADMIN_VERS_JOUR[admin]) {
      console.error('Prise de poste : rôle administratif « ' + admin + ' » inconnu, trois fonctions opérationnelles proposées.');
    }
    return ROLES.filter(r => r.value !== 'manager');
  }

  // Cette valeur est ÉCRITE dans shifts.quart, donc dans le rôle du jour. Heure
  // locale de la station, seuil configuré du site, aucun quart si l'un des deux
  // manque. Le planning décide, l'horloge est le repli (09/09/2026).
  let FUSEAU_STATION_PDP = null;
  let BASCULE_QUART2_PDP = null;
  let QUART_PLANIFIE_PDP = null;

  function quartDuMoment() {
    if (!FUSEAU_STATION_PDP || BASCULE_QUART2_PDP === null) return null;
    const r = NexusStation.quartDuJour({
      planifie: QUART_PLANIFIE_PDP,
      minutesMaintenant: NexusStation.minutesLocalesStation(FUSEAU_STATION_PDP),
      minutesBascule: BASCULE_QUART2_PDP,
    });
    if (!r) return null;
    // « matin » et « soir » sont déjà écrits dans l'historique de shifts.quart ;
    // « renfort » s'ajoute, il ne remplace rien.
    return r.quart === 'quart1' ? 'matin' : r.quart === 'quart2' ? 'soir' : 'renfort';
  }

  async function resoudreContexteQuart(employee) {
    const fuseau = await NexusStation.fuseauDeLaStation(employee.site_id);
    FUSEAU_STATION_PDP = fuseau.timezone || null;
    const seuil = await NexusStation.seuilDeBascule(employee.site_id, undefined, FUSEAU_STATION_PDP);
    BASCULE_QUART2_PDP = seuil.indetermine ? null : seuil.minutes;
    // Le quart planifié est lu UNE fois. Son absence n'est pas une erreur : une
    // panne de planning ne doit jamais empêcher quelqu'un de prendre son poste.
    if (FUSEAU_STATION_PDP) {
      QUART_PLANIFIE_PDP = await NexusStation.quartPlanifie(
        employee.id, NexusStation.dateLocaleStation(FUSEAU_STATION_PDP));
    }
    if (!FUSEAU_STATION_PDP || BASCULE_QUART2_PDP === null) {
      console.warn('Prise de poste : fuseau ou horaires de quart non configurés — le quart ne sera pas deviné.');
      return false;
    }
    return true;
  }

  async function chargerCatalogue() {
    const { data, error } = await nexusClient
      .from('mission_catalog')
      .select('mission_id, titre, role_required, priority, estimated_duration_min')
      .eq('actif', true);
    if (error) { console.error('Chargement catalogue:', error); return []; }
    return data || [];
  }

  function missionsPourRole(role) {
    return catalogue.filter(m => Array.isArray(m.role_required) && m.role_required.includes(role));
  }

  // Lecture seule. Un échec n'empêche jamais la prise de poste.
  async function chargerPosteFrequent() {
    try {
      const { data, error } = await nexusClient.rpc('poste_le_plus_frequent');
      if (error || !Array.isArray(data) || !data[0]) return null;
      return data[0];
    } catch (e) {
      return null;
    }
  }

  // Un badge sous le seul rôle concerné, jamais de présélection. À partir de 5
  // prises de poste, le poste le plus fréquent ; de 1 à 4, le dernier poste
  // (rétabli sur décision de Frédéric, 25/10).
  function libelleFrequence(pf) {
    if (!pf || !pf.poste) return '';
    if (pf.etat === 'dominant') return `Poste le plus fréquent, ${pf.retenus} sur ${pf.eligibles}`;
    if (pf.etat === 'dernier_poste') return 'Dernier poste';
    return '';
  }

  function echapper(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ── Présentation ──────────────────────────────────────────────────────
  // Fond #0B0F14, cartes #141B22, carte mise en avant cernée #4FC3D9, le vert
  // #34D399 est réservé aux confirmations. Aucune @media : la colonne est
  // bornée (max-width) et lisible en 375×812 comme en bureau.
  const CSS = `
.pdp{max-width:460px;margin:0 auto;color:#EDF1F5;font-family:'IBM Plex Sans',sans-serif;}
.pdp-titre{font-size:22px;font-weight:600;margin:0;}
.pdp-sous{font-size:14px;color:#8A96A5;margin:6px 0 14px;line-height:1.5;}
.pdp-cartes{display:flex;flex-direction:column;gap:12px;}
.pdp-carte{display:flex;align-items:stretch;width:100%;min-height:112px;text-align:left;font:inherit;color:inherit;background:#141B22;border:1px solid #242E38;border-radius:16px;padding:0;overflow:hidden;cursor:pointer;-webkit-tap-highlight-color:transparent;}
.pdp-carte:active{border-color:#4FC3D9;}
.pdp-carte:focus-visible{outline:2px solid #4FC3D9;outline-offset:2px;}
.pdp-carte[disabled]{opacity:.55;cursor:default;}
.pdp-carte.pdp-avant{border:2px solid #4FC3D9;}
.pdp-visuel{position:relative;display:block;order:2;flex:0 0 44%;background:#141B22;}
.pdp-visuel::after{content:'';position:absolute;inset:0;background:linear-gradient(to right,#141B22 0%,rgba(20,27,34,0) 50%);pointer-events:none;}
.pdp-image{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;}
.pdp-corps{flex:1;align-self:center;padding:14px 16px;}
.pdp-nom{font-size:24px;font-weight:700;letter-spacing:.01em;}
.pdp-badge{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#4FC3D9;margin-top:4px;}
.pdp-tag{font-size:12.5px;color:#8A96A5;margin-top:4px;line-height:1.45;}
.pdp-securite{background:#3A1D1F;border:1px solid rgba(240,87,90,.4);color:#EDF1F5;border-radius:12px;padding:10px 14px;font-size:12px;line-height:1.45;margin:0 0 12px;}
.pdp-erreur{padding:12px 0;line-height:1.55;font-size:14px;}
.pdp-resume{background:#141B22;border:1px solid #242E38;border-radius:14px;padding:14px 16px;}
.pdp-resume-role{font-size:17px;font-weight:600;}
.pdp-resume-quart{font-size:12.5px;color:#8A96A5;margin-top:2px;}
.pdp-ligne{display:flex;justify-content:space-between;font-size:13.5px;color:#8A96A5;margin-top:10px;}
.pdp-ligne b{color:#EDF1F5;font-weight:600;}
.pdp-btn{width:100%;margin-top:10px;padding:14px;border-radius:12px;border:1px solid #4FC3D9;background:#4FC3D9;color:#0B0F14;font:inherit;font-weight:600;font-size:15px;cursor:pointer;}
.pdp-btn.pdp-texte{background:none;border:none;color:#4FC3D9;}
.pdp-btn[disabled]{opacity:.55;}
`;

  function poserStyle() {
    if (document.getElementById('pdp-style')) return;
    const st = document.createElement('style');
    st.id = 'pdp-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function messageContexteManquant() {
    return '<div class="pdp pdp-erreur" id="pdpImpossible"><strong>Prise de poste impossible</strong><br><br>'
      + 'Il manque le fuseau horaire du commerce ou ses horaires de quart.<br><br>'
      + 'Votre prise de poste enregistre le quart travaillé : sans ces deux '
      + 'informations, NEXUS ne peut pas savoir si vous prenez le matin ou le '
      + 'soir, et il ne le devinera pas.<br><br>'
      + 'Un manager doit les renseigner dans <b>Paramètres Station</b>.</div>';
  }

  // Rappel de sécurité (décision de Frédéric, 25/10/2026) : une seule fois par
  // jour et par employé, à la première ouverture de NEXUS du jour. Mémorisé sur
  // l'appareil (localStorage), clé = employé + jour de la station ; jamais en
  // base (consulter NEXUS ne crée rien, POSTE-005). Stockage absent, illisible
  // ou jour inconnu : on affiche, en cas de doute on n'efface pas un rappel de
  // sécurité. Le texte, lui, ne change pas.
  const TEXTE_RAPPEL_SECURITE = '<div class="pdp-securite" id="rappelSecurite">⚠️ <b>Rappel sécurité</b> — N\'utilisez jamais NEXUS ni votre téléphone à la vue d\'un client. Strictement interdit sur la piste de distribution de carburant, encore plus pendant une distribution en cours.</div>';
  // Jour de la page courante déjà annoncé : un nouveau rendu dans la même page
  // (retour sur le choix) ne doit pas faire disparaître ce que l'employé lit.
  let rappelAffichePourCle = null;

  function cleRappelSecurite() {
    try {
      if (!employeeCourant || !employeeCourant.id || !FUSEAU_STATION_PDP) return null;
      return 'nexus_rappel_securite_' + employeeCourant.id + '_' + NexusStation.dateLocaleStation(FUSEAU_STATION_PDP);
    } catch (e) { return null; }
  }

  function rappelSecuriteAAfficher() {
    const cle = cleRappelSecurite();
    if (!cle) return true;
    if (rappelAffichePourCle === cle) return true;
    try {
      if (global.localStorage.getItem(cle)) return false;
    } catch (e) { return true; }
    try { global.localStorage.setItem(cle, '1'); } catch (e) { /* tant pis : il se réaffichera */ }
    rappelAffichePourCle = cle;
    return true;
  }

  // Trois cartes pour un employé, quatre pour un manager. Le rappel de sécurité
  // est affiché sans appui (une fois par jour), texte inchangé. Aucune carte
  // n'est présélectionnée.
  function renderChoixPoste() {
    const rappelSecurite = rappelSecuriteAAfficher() ? TEXTE_RAPPEL_SECURITE : '';
    const badge = libelleFrequence(posteFrequent);
    const cartes = rolesDisponibles().map(r => `
        <button type="button" class="pdp-carte" data-role="${r.value}">
          ${r.image ? `<span class="pdp-visuel"><img class="pdp-image" src="${r.image}" width="400" height="280" alt="" decoding="async"></span>` : ''}
          <span class="pdp-corps">
            <span class="pdp-nom" style="display:block;">${r.label}</span>
            ${badge && posteFrequent && r.value === posteFrequent.poste ? `<span class="pdp-badge" style="display:block;">${echapper(badge)}</span>` : ''}
            ${r.sousTitre ? `<span class="pdp-tag" style="display:block;">${r.sousTitre}</span>` : ''}
          </span>
        </button>`).join('');
    hoteCourant.innerHTML = `
      <div class="pdp" id="pdpChoix">
        <h2 class="pdp-titre">Bonjour ${echapper(employeeCourant.nom)}</h2>
        <p class="pdp-sous">Où travaillez-vous pour ce quart ?</p>
        ${rappelSecurite}
        <div class="pdp-cartes" id="pdpCartes">${cartes}</div>
      </div>`;
    hoteCourant.querySelectorAll('.pdp-carte').forEach(el => {
      el.addEventListener('click', () => confirmerPriseDePoste(el.dataset.role, el));
    });
  }

  // FDJ Vague 1 (17/09/2026) — l'ouverture du quart FDJ est une CONSÉQUENCE de
  // la prise de poste, jamais une action de plus. Ce module est le seul endroit
  // de NEXUS qui en ouvre un. Elle ne bloque jamais la prise de poste ; son
  // idempotence est garantie côté base (fdj_ouvrir_quart_depuis_prise_de_poste).
  //
  // Un conflit de responsable ou un refus motivé est une information métier
  // que l'employé doit recevoir : seul ce cas retient la navigation (une note,
  // un bouton). Une ouverture réussie ou déjà faite ne coûte aucun appui.
  let messageOuvertureFdj = null;

  async function ouvrirQuartFdjDepuisPriseDePoste(priseDePosteId) {
    messageOuvertureFdj = null;
    if (!priseDePosteId) return;
    const { data, error } = await nexusClient.rpc('fdj_ouvrir_quart_depuis_prise_de_poste', {
      p_prise_de_poste_id: priseDePosteId,
    });
    if (error) { console.error('Ouverture du quart FDJ depuis la prise de poste:', error); return; }
    if (!data) return;
    // Le pompiste n'est jamais retenu par un message FDJ (recette du 25/10) :
    // l'appui sur « Piste » ouvre directement le fil. Seul un conflit de
    // responsable retient la navigation, et seulement hors piste.
    if (roleChoisi === 'pompiste') return;
    if (data.conflit) { messageOuvertureFdj = { ton: 'conflit', texte: data.message }; return; }
    if (data.ouvert === false && data.message) { messageOuvertureFdj = { ton: 'info', texte: data.message }; return; }
  }

  // CHANGEMENT DE QUART (16/10/2026) — la prise de poste passe par UNE fonction
  // SQL transactionnelle, nexus_changer_de_quart(), qui clôture le quart ouvert
  // ET enregistre le nouveau en une seule opération. Premier appel SANS
  // confirmation : si un quart est déjà ouvert, la base n'écrit rien et répond
  // « confirmation_requise ». Seule une confirmation volontaire renvoie l'appel
  // avec p_cloture_confirmee = true.
  const MOTIF_RELEVE = 'Relève absente ou en retard';

  async function appelerChangementDeQart(confirmee, motif) {
    return nexusClient.rpc('nexus_changer_de_quart', {
      p_role: roleChoisi,
      p_quart: quartDuMoment(),
      p_motif: motif || null,
      p_cloture_confirmee: !!confirmee,
    });
  }

  function renderConfirmationChangement(quartOuvert) {
    const ancien = roleInfo(quartOuvert && quartOuvert.role);
    const nouveau = roleInfo(roleChoisi);
    hoteCourant.innerHTML = `
      <div class="pdp" id="pdpConfirmation">
        <h2 class="pdp-titre">Un quart est déjà ouvert</h2>
        <p class="pdp-sous">Confirmez avant de changer de quart.</p>
        <div class="pdp-securite" id="avertissementChangement">⚠️ <b>Votre quart en cours (${ancien.label}) sera clôturé définitivement.</b> Vous ne pourrez pas le rouvrir depuis votre espace. Votre nouvelle prise de poste (${nouveau.label}) sera enregistrée dans la même opération ; si elle échoue, votre quart en cours reste ouvert. Vos missions et justificatifs du jour sont conservés.</div>
        <label class="pdp-sous" for="motifChangement">Motif (facultatif)</label>
        <select id="motifChangement" style="width:100%;margin:6px 0 10px;padding:10px;">
          <option value="">Aucun motif</option>
          <option value="releve">${MOTIF_RELEVE}</option>
          <option value="autre">Autre motif justifié…</option>
        </select>
        <input type="text" id="motifAutre" maxlength="200" placeholder="Précisez le motif" style="display:none;width:100%;margin-bottom:10px;padding:10px;box-sizing:border-box;">
        <button class="pdp-btn" id="btnConfirmerChangement">Clôturer mon quart et prendre mon poste</button>
        <button class="pdp-btn pdp-texte" id="btnAnnulerChangement">Annuler</button>
      </div>`;
    const sel = document.getElementById('motifChangement');
    const autre = document.getElementById('motifAutre');
    sel.addEventListener('change', () => { autre.style.display = sel.value === 'autre' ? 'block' : 'none'; });
    // Annuler n'écrit rien : on revient aux cartes, aucune n'est présélectionnée.
    document.getElementById('btnAnnulerChangement').addEventListener('click', () => { roleChoisi = null; renderChoixPoste(); });
    document.getElementById('btnConfirmerChangement').addEventListener('click', async () => {
      const btn = document.getElementById('btnConfirmerChangement');
      btn.disabled = true;
      btn.textContent = 'Changement de quart…';
      let motif = null;
      if (sel.value === 'releve') motif = MOTIF_RELEVE;
      else if (sel.value === 'autre') motif = (autre.value || '').trim() || null;
      await terminerPriseDePoste(await appelerChangementDeQart(true, motif), () => {
        btn.disabled = false;
        btn.textContent = 'Clôturer mon quart et prendre mon poste';
      });
    });
  }

  // Rôle RÉEL du compte (employees.role), pas le rôle choisi pour ce quart : un
  // manager qui se met « renfort » reste un manager et retombe sur son poste de
  // pilotage.
  function estNiveauManagerCourant() {
    return employeeCourant && (employeeCourant.role === 'manager' || employeeCourant.role === 'gerant');
  }

  // Destination après la prise de poste : celle d'avant le lot, sans écran
  // intermédiaire.
  function destinationApresPriseDePoste() {
    // Retour automatique (28/07/2026) : page atteinte via le blocage de
    // nexus-auth.js (?retour=<page>).
    const retour = new URLSearchParams(window.location.search).get('retour');
    if (retour) return retour;
    if (estNiveauManagerCourant()) return 'NEXUS-App-v1.html';
    // Seul le pompiste entre dans le fil « Mon début de quart » (jaugeage du
    // fil) ; caissière, renfort et polyvalent gardent leur destination d'avant.
    if (roleChoisi !== 'pompiste') return 'NEXUS-Missions-v1.html';
    return NexusFilDebutQuart.ACCUEIL_DEMARRAGE;
  }

  async function terminerPriseDePoste(reponse, reactiver) {
    const { data, error } = reponse;
    if (error || !data || data.ok !== true) {
      console.error('Confirmation prise de poste:', error || data);
      alert('Un problème est survenu, réessayez. Votre quart en cours n\'a pas été modifié.');
      reactiver();
      return;
    }
    await ouvrirQuartFdjDepuisPriseDePoste(data.prise_de_poste_id);
    const destination = destinationApresPriseDePoste();
    const aller = () => {
      if (typeof optionsCourantes.aller === 'function') optionsCourantes.aller(destination);
      else window.location.href = destination;
    };
    if (messageOuvertureFdj) {
      hoteCourant.innerHTML = `
        <div class="pdp">
          <h2 class="pdp-titre">Votre poste est pris</h2>
          <div class="pdp-securite" id="noteFdj">${messageOuvertureFdj.texte}</div>
          <button type="button" class="pdp-carte" id="pdpSuite">Continuer</button>
        </div>`;
      document.getElementById('pdpSuite').addEventListener('click', aller);
      return;
    }
    aller();
  }

  // L'UNIQUE écriture : l'appui sur une carte.
  async function confirmerPriseDePoste(role, carte) {
    if (roleChoisi) return; // un appui est déjà en cours
    roleChoisi = role;
    const cartes = hoteCourant.querySelectorAll('.pdp-carte');
    const rendre = () => { roleChoisi = null; cartes.forEach(c => { c.disabled = false; }); };
    cartes.forEach(c => { c.disabled = true; });
    if (carte) carte.classList.add('pdp-avant');

    const reponse = await appelerChangementDeQart(false, null);
    if (!reponse.error && reponse.data && reponse.data.code === 'confirmation_requise') {
      renderConfirmationChangement(reponse.data.quart_ouvert);
      return;
    }
    await terminerPriseDePoste(reponse, () => { rendre(); if (carte) carte.classList.remove('pdp-avant'); });
  }

  function preparer(hote, employee, opts) {
    poserStyle();
    hoteCourant = hote;
    employeeCourant = employee;
    optionsCourantes = opts || {};
    roleChoisi = null;
  }

  /**
   * Monte les cartes de choix de poste dans `hote`.
   * opts.aller(destination) : remplace la navigation (tests) ; sinon location.
   */
  async function monter(hote, employee, opts) {
    preparer(hote, employee, opts);
    // Sans fuseau ni horaires, la prise de poste écrirait un quart deviné dans
    // shifts — donc dans le rôle du jour. On s'arrête.
    if (!(await resoudreContexteQuart(employee))) {
      hote.innerHTML = messageContexteManquant();
      return false;
    }
    posteFrequent = await chargerPosteFrequent();
    renderChoixPoste();
    return true;
  }

  /**
   * Récapitulatif « missions prévues, priorités, temps estimé » : il vit sur
   * l'Accueil, une fois le service pris. Lecture seule, n'écrit jamais.
   */
  async function recapitulatif(hote, employee, role) {
    preparer(hote, employee, {});
    roleChoisi = null;
    if (!catalogue.length) catalogue = await chargerCatalogue();
    let quartLibelle = '';
    try {
      if (await resoudreContexteQuart(employee)) {
        const q = quartDuMoment();
        quartLibelle = q === 'matin' ? 'Quart du matin' : q === 'soir' ? 'Quart du soir' : '';
      }
    } catch (e) { /* le récapitulatif se passe du quart */ }
    const info = roleInfo(role);
    const missions = missionsPourRole(role);
    const prioritaires = missions.filter(m => m.priority === 'critique' || m.priority === 'haute').length;
    const tempsTotal = missions.reduce((s, m) => s + (m.estimated_duration_min || 0), 0);
    hote.innerHTML = `
      <div class="pdp pdp-resume" id="pdpResume">
        <div class="pdp-resume-role">${info.label}</div>
        ${quartLibelle ? `<div class="pdp-resume-quart">${quartLibelle}</div>` : ''}
        <div class="pdp-ligne"><span>Missions prévues</span><b>${missions.length}</b></div>
        <div class="pdp-ligne"><span>Priorités (critique/haute)</span><b>${prioritaires}</b></div>
        <div class="pdp-ligne"><span>Temps estimé</span><b>${tempsTotal} min</b></div>
      </div>`;
  }

  global.NexusPriseDePoste = { monter, recapitulatif, ROLES };
})(window);
