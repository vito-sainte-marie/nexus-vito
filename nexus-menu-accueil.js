/* Menu ☰ de l'Accueil (lot MENU-ACCUEIL-EMPLOYE-20261030).
 *
 * Module PUR : il reçoit des faits déjà calculés par l'Accueil (poste du jour,
 * réception et FDJ applicables) et rend les entrées du menu puis du HTML. Il ne
 * lit rien, n'écrit rien et ne crée aucun droit : il reprend ceux que l'Accueil
 * a déjà établis (roleADroitModule, réglage de réception, forfait).
 * Jaugeage et Index n'y figurent que pour le manager et le gérant ; pour les
 * employés, leur seule porte reste le fil de l'Accueil.
 */
(function (root) {
  'use strict';

  const URL = {
    reception: 'NEXUS-Carburant-Reception-v1.html',
    jaugeage: 'NEXUS-Releves-Piste-v1.html?ecran=jauge',
    index: 'NEXUS-Releves-Piste-v1.html',
    inventaire: 'NEXUS-Inventaire-v1.html',
    missions: 'NEXUS-Missions-v1.html',
    datesCourtes: 'NEXUS-Dates-Courtes-Releve-v1.html',
    pointage: 'NEXUS-Pointage-v1.html',
    coachFdj: 'NEXUS-Coach-FDJ-v1.html',
    fdj: 'NEXUS-FDJ-v1.html',
    progression: 'NEXUS-Progression-v1.html',
    prisePoste: 'NEXUS-Prise-De-Poste-v1.html',
  };
  // Icône du registre NexusIcones, par entrée. Sans icône de bibliothèque (fermeture, jaugeage, index, déconnexion),
  // l'entrée reste en texte seul : on n'en invente pas.
  const ICONE = {
    reception: 'mod-reception-carburant', inventaire: 'mod-inventaire', dates_courtes: 'mod-dates-courtes',
    missions: 'mod-missions', pointage: 'mod-pointage', fdj: 'mod-fdj', coach_fdj: 'mod-coach-fdj',
    progression: 'mod-progression', changer_poste: 'mod-prise-de-poste',
  };
  const POSTES_SANS_RECHERCHE = ['pompiste', 'caissiere', 'renfort'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // f : { estNiveauManager, enService, roleDuJour, receptionApplicable, fdjApplicable }
  // Rend [] quand l'Accueil n'a pas de menu à offrir (employé hors service).
  function groupes(f) {
    if (!f) return [];
    const manager = !!f.estNiveauManager;
    if (!manager && !f.enService) return [];
    const role = f.roleDuJour;
    const g = [];
    const carburant = [];
    if (manager || f.receptionApplicable) carburant.push({ code: 'reception', libelle: 'Réception carburant', href: URL.reception });
    // Fermeture de la piste (lot FERMETURE-PISTE-20261031) : pour le pompiste en service, elle remplace « Relevés d'index » ;
    // le lien du fil est donné par l'Accueil. Le manager garde l'écran de choix des relevés.
    if (!manager && f.enService && f.fermetureLien) carburant.push({ code: 'fermeture', libelle: 'Fermeture de la piste', sousTitre: 'Index de fin, puis inventaire de clôture', href: f.fermetureLien });
    if (manager) carburant.push({ code: 'jaugeage', libelle: 'Jaugeage', href: URL.jaugeage });
    // Sans fil de fermeture connu, l'écran de choix des relevés (sans `moment`) reste la porte des index de fin de quart.
    // Le Jaugeage reste hors menu employé.
    // Employé : « Relevés d'index » est un geste du pompiste du jour ; manager et gérant gardent l'entrée telle quelle.
    if (manager || (f.enService && !f.fermetureLien && role === 'pompiste')) carburant.push({ code: 'index', libelle: 'Relevés d\'index', href: URL.index });
    if (carburant.length) g.push({ code: 'carburant', titre: 'Carburant', entrees: carburant });
    // Lot 3 mobile (24/11) : le menu montre ce qu'on peut faire. Le renfort n'a plus d'entrée Inventaire grisée :
    // le groupe est absent pour lui. L'exclusion de l'Accueil (roleDuJour !== 'renfort') n'est pas touchée.
    if (manager || role !== 'renfort') g.push({ code: 'inventaire', titre: 'Inventaire', entrees: [{ code: 'inventaire', libelle: 'Inventaire', href: URL.inventaire }] });
    // Pointage : seulement si la station l'a activé (station_config.pointage_actif, lu par l'Accueil).
    const travail = [];
    // Dates courtes (poste du jour) : employé seulement, quand l'Accueil a établi le droit ; manager et gérant gardent leur menu inchangé.
    if (!manager && f.datesCourtesApplicable === true) travail.push({ code: 'dates_courtes', libelle: 'Dates courtes', href: URL.datesCourtes });
    travail.push({ code: 'missions', libelle: 'Missions', href: URL.missions });
    if (f.pointageActif === true) travail.push({ code: 'pointage', libelle: 'Pointage', href: URL.pointage });
    g.push({ code: 'travail', titre: 'Mon travail', entrees: travail });
    const caisse = [];
    if (f.fdjApplicable) caisse.push({ code: 'fdj', libelle: 'FDJ', href: URL.fdj });
    if (manager || role === 'caissiere') caisse.push({ code: 'coach_fdj', libelle: 'Coach FDJ', href: URL.coachFdj });
    if (caisse.length) g.push({ code: 'caisse', titre: 'Caisse', entrees: caisse });
    g.push({ code: 'moi', titre: 'Moi', entrees: [
      { code: 'progression', libelle: 'Ma progression et mes séries', href: URL.progression },
      { code: 'changer_poste', libelle: 'Changer de poste', href: URL.prisePoste, id: 'menuChangerPoste' },
      { code: 'deconnexion', libelle: 'Se déconnecter', href: '#', id: 'menuLogout' },
    ] });
    return g;
  }

  // La recherche libre reste au manager et au gérant ; pompiste, caisse et renfort ne l'ont pas.
  function rechercheVisible(f) {
    if (!f) return true;
    if (f.estNiveauManager) return true;
    return POSTES_SANS_RECHERCHE.indexOf(f.roleDuJour) === -1;
  }

  // Icône 24 px décorative (alt="") : le libellé visible reste la seule information.
  function icone(code) {
    const reg = root && root.NexusIcones;
    if (!ICONE[code] || !reg || !reg.img) return '';
    return reg.img(ICONE[code], 24, { decoratif: true });
  }

  function html(gs) {
    return (gs || []).map((gr) => '<div class="mm-groupe" data-groupe="' + esc(gr.code) + '"><div class="mm-titre">' + esc(gr.titre) + '</div>'
      + gr.entrees.map((e) => '<a class="mm-entree" data-entree="' + esc(e.code) + '"' + (e.id ? ' id="' + esc(e.id) + '"' : '') + ' href="' + esc(e.href) + '">'
        + icone(e.code) + '<span class="mm-texte">' + esc(e.libelle) + (e.sousTitre ? '<span class="mm-mention">' + esc(e.sousTitre) + '</span>' : '') + '</span></a>').join('')
      + '</div>').join('');
  }

  // Menu latéral du bureau pour un employé (lot GARDE-GESTION-EMPLOYE-20261124). UNE seule liste : celle de l'Accueil.
  // Le menu latéral n'a pas les faits du jour (poste, service) ; il offre donc le plus large de ce que l'Accueil peut
  // proposer à un employé, et chaque écran garde sa propre règle. Sans « Se déconnecter » ni fermeture (qui exige un lien du fil).
  function groupesLateraux() {
    return groupes({ estNiveauManager: false, enService: true, roleDuJour: 'caissiere', receptionApplicable: true,
      fdjApplicable: true, datesCourtesApplicable: true, pointageActif: true })
      .map((gr) => ({ code: gr.code, titre: gr.titre, entrees: gr.entrees.filter((e) => e.code !== 'deconnexion' && e.code !== 'fermeture') }))
      .filter((gr) => gr.entrees.length);
  }

  const api = { groupes, groupesLateraux, rechercheVisible, html, URL, ICONE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.NexusMenuAccueil = api;
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null));
