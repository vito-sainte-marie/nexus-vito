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
    pointage: 'NEXUS-Pointage-v1.html',
    coachFdj: 'NEXUS-Coach-FDJ-v1.html',
    fdj: 'NEXUS-FDJ-v1.html',
    progression: 'NEXUS-Progression-v1.html',
    prisePoste: 'NEXUS-Prise-De-Poste-v1.html',
  };
  const MENTION_DESACTIVE = 'Désactivé par le manager';
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
    if (manager) {
      carburant.push({ code: 'jaugeage', libelle: 'Jaugeage', href: URL.jaugeage });
      carburant.push({ code: 'index', libelle: 'Relevé des index', href: URL.index });
    }
    if (carburant.length) g.push({ code: 'carburant', titre: 'Carburant', entrees: carburant });
    // Option B (Frédéric, 30/10) : le renfort voit l'entrée Inventaire grisée, non cliquable, avec sa mention,
    // jusqu'au lot dédié « Inventaire renfort ». L'exclusion de l'Accueil (roleDuJour !== 'renfort') n'est pas touchée.
    const inventaire = role === 'renfort' && !manager
      ? { code: 'inventaire', libelle: 'Inventaire', desactive: true, mention: MENTION_DESACTIVE }
      : { code: 'inventaire', libelle: 'Inventaire', href: URL.inventaire };
    g.push({ code: 'inventaire', titre: 'Inventaire', entrees: [inventaire] });
    g.push({ code: 'travail', titre: 'Mon travail', entrees: [
      { code: 'missions', libelle: 'Missions', href: URL.missions },
      { code: 'pointage', libelle: 'Pointage', href: URL.pointage },
    ] });
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

  function html(gs) {
    return (gs || []).map((gr) => '<div class="mm-groupe" data-groupe="' + esc(gr.code) + '"><div class="mm-titre">' + esc(gr.titre) + '</div>'
      + gr.entrees.map((e) => e.desactive
        ? '<span class="mm-entree mm-desactive" data-entree="' + esc(e.code) + '" aria-disabled="true">' + esc(e.libelle) + '<span class="mm-mention">' + esc(e.mention) + '</span></span>'
        : '<a class="mm-entree" data-entree="' + esc(e.code) + '"' + (e.id ? ' id="' + esc(e.id) + '"' : '') + ' href="' + esc(e.href) + '">' + esc(e.libelle) + '</a>').join('')
      + '</div>').join('');
  }

  const api = { groupes, rechercheVisible, html, URL, MENTION_DESACTIVE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.NexusMenuAccueil = api;
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null));
