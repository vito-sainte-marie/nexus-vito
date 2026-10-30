/* Accueil du pompiste en service (lot ACCUEIL-EN-SERVICE-20261030).
 *
 * Module PUR : il reçoit des faits déjà lus par l'Accueil et rend un modèle de
 * vue puis du HTML. Il ne lit rien, n'écrit rien, ne décide d'aucune étape :
 * le bouton principal pointe vers le lien du fil que l'Accueil lui donne
 * (`filLien`, issu de NexusFilDebutQuart.urlRepriseSelonFaits, inchangé).
 */
(function (root) {
  'use strict';

  const URL_RECEPTION = 'NEXUS-Carburant-Reception-v1.html';
  const URL_MISSIONS = 'NEXUS-Missions-v1.html';
  const URL_PROGRESSION = 'NEXUS-Progression-v1.html';
  const URL_PRISE_DE_POSTE = 'NEXUS-Prise-De-Poste-v1.html';
  const IMAGES_POSTE = {
    pompiste: 'assets/postes/poste-pompiste.webp?v=e40da5c9',
    caissiere: 'assets/postes/poste-caissiere.webp?v=78f52dcb',
    renfort: 'assets/postes/poste-renfort.webp?v=3ee33e46',
  };
  const STATUTS_COMMANDE_ATTENDUE = ['validee', 'modifiee', 'confirmee_fournisseur', 'hors_nexus'];
  const LIBELLE_CARBURANT = { sp95: 'SP95', sp98: 'SP98', go: 'GO', gnr: 'GNR' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Les trois étapes sont toujours nommées. Une étape sans objet pour ce site
  // (jaugeage désactivé, par exemple) compte comme faite et le dit.
  function etapesOuverture(f) {
    const def = [
      { code: 'jaugeage', libelle: 'Jaugeage Veeder-Root', applicable: !!f.jaugeageApplicable, fait: !!f.jaugeageFait },
      { code: 'index', libelle: 'Relevé des index', applicable: !!f.indexApplicable, fait: !!f.indexFait },
      { code: 'inventaire', libelle: 'Inventaire zone piste', applicable: !!f.inventaireApplicable, fait: !!(f.inventaireFait || f.inventaireOuvertureFaite) },
    ];
    return def.map((e) => ({
      code: e.code,
      libelle: e.libelle,
      etat: !e.applicable ? 'sans_objet' : e.fait ? 'fait' : 'a_faire',
    }));
  }

  // Une commande attendue AUJOURD'HUI (date de la station), dans un statut où
  // la livraison est réellement attendue. Rend les carburants concernés.
  function livraisonAttendue(commandes, dateLocale) {
    const trouves = [];
    (commandes || []).forEach((c) => {
      if (!c || c.livraison_prevue_le !== dateLocale) return;
      if (STATUTS_COMMANDE_ATTENDUE.indexOf(c.statut) === -1) return;
      Object.keys(c.carburants || {}).forEach((k) => {
        const l = c.carburants[k];
        if (l && l.volumeL != null && Number(l.volumeL) > 0 && trouves.indexOf(k) === -1) trouves.push(k);
      });
    });
    return trouves.map((k) => LIBELLE_CARBURANT[k] || String(k).toUpperCase());
  }

  function listeCarburants(libelles) {
    if (libelles.length <= 1) return libelles.join('');
    return libelles.slice(0, -1).join(', ') + ' et ' + libelles[libelles.length - 1];
  }

  function heureLocale(iso, fuseau) {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const p = new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau || undefined, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
    const h = (p.find((x) => x.type === 'hour') || {}).value;
    const m = (p.find((x) => x.type === 'minute') || {}).value;
    return h && m ? h + ' h ' + m : null;
  }

  function libelleQuart(q) {
    return q === 'matin' ? 'Quart du matin' : q === 'soir' ? 'Quart du soir' : '';
  }

  // f : faits de l'Accueil. Rend null quand le mode ne s'applique pas.
  function modele(f) {
    if (!f || !f.enService || f.consultationExterne || f.roleDuJour !== 'pompiste') return null;
    const etapes = etapesOuverture(f);
    const faites = etapes.filter((e) => e.etat !== 'a_faire').length;
    const prochaine = etapes.find((e) => e.etat === 'a_faire') || null;
    const filTermine = !prochaine;
    const livraison = f.receptionApplicable ? livraisonAttendue(f.commandes, f.dateLocale) : null;
    const m = f.missions || { total: 0, faites: 0 };
    return {
      prenom: f.prenom || '',
      poste: { libelle: f.libelleRole || 'Pompiste', quart: libelleQuart(f.quart), depuis: heureLocale(f.heureDebut, f.fuseau), image: IMAGES_POSTE.pompiste },
      etapes, faites, total: etapes.length, filTermine,
      // Le bouton ne pointe que vers le fil de l'Accueil, jamais vers une étape recalculée ici.
      bouton: (!filTermine && f.filLien) ? { libelle: 'Continuer : ' + prochaine.libelle, href: f.filLien } : null,
      reception: f.receptionApplicable ? { href: URL_RECEPTION, livraison: livraison && livraison.length ? livraison : null } : null,
      // Fin de quart : une fois le fil terminé, tant que le relevé de fin n'est pas final. Cible donnée par l'Accueil.
      finQuart: (filTermine && f.finQuartLien && !f.finQuartFait) ? { libelle: 'Fin de quart : relevé des index', href: f.finQuartLien } : null,
      // Une étape à faire sans bouton est une impasse : l'Accueil doit toujours fournir filLien.
      incoherent: !filTermine && !f.filLien,
      missions: filTermine ? { restantes: Math.max(0, m.total - m.faites), total: m.total } : null,
      points: Number(f.points) || 0,
    };
  }

  function html(v) {
    if (!v) return '';
    const p = v.poste;
    const sousLigne = [p.quart, p.depuis ? 'En service depuis ' + p.depuis : ''].filter(Boolean);
    const lignes = v.etapes.map((e) => {
      const marque = e.etat === 'a_faire' ? '○' : '✓';
      const note = e.etat === 'sans_objet' ? ' <span class="ap-sans-objet">sans objet</span>' : '';
      return '<li class="ap-etape ap-' + e.etat + '"><span class="ap-marque" aria-hidden="true">' + marque + '</span>' + esc(e.libelle) + note + '</li>';
    }).join('');
    const segments = v.etapes.map((e) => '<i class="' + (e.etat === 'a_faire' ? '' : 'ap-plein') + '"></i>').join('');
    let out = '';
    out += '<div class="ap-salut"><h1 class="ap-h1">Bonjour ' + esc(v.prenom) + '</h1></div>';
    out += '<div class="ap-poste" id="apPoste"><div class="ap-poste-texte"><div class="ap-poste-nom">' + esc(p.libelle) + '</div>'
      + sousLigne.map((l) => '<div class="ap-poste-sous">' + esc(l) + '</div>').join('')
      + '</div><div class="ap-poste-image" style="background-image:url(\'' + esc(p.image) + '\')"></div></div>';
    out += '<section class="ap-fil" id="apFil"><div class="ap-fil-titre">' + (v.filTermine ? 'Ouverture de la piste terminée' : 'Ouverture de la piste')
      + '</div><div class="ap-fil-compte">' + v.faites + ' sur ' + v.total + '</div><div class="ap-segments">' + segments + '</div><ul class="ap-etapes">' + lignes + '</ul>'
      + (v.bouton ? '<a class="ap-bouton" id="apBoutonPrincipal" href="' + esc(v.bouton.href) + '">' + esc(v.bouton.libelle) + '</a>' : '')
      + '</section>';
    if (v.reception) {
      const l = v.reception.livraison;
      out += '<a class="ap-reception' + (l ? ' ap-attendue' : '') + '" id="apReception" href="' + esc(v.reception.href) + '"><span class="ap-camion" aria-hidden="true">🚚</span><span><b>Réception carburant</b><br><span class="ap-reception-sous">'
        + (l ? 'Livraison prévue aujourd’hui · ' + esc(listeCarburants(l)) : 'Un camion arrive ? Commencez ici') + '</span></span></a>';
    }
    if (v.finQuart) {
      out += '<a class="ap-bouton" id="apFinQuart" href="' + esc(v.finQuart.href) + '">' + esc(v.finQuart.libelle) + '</a>';
    }
    if (v.missions) {
      const r = v.missions.restantes;
      out += '<section class="ap-missions" id="apMissions"><div class="ap-fil-titre">Missions du jour</div>'
        + (r > 0
          ? '<div class="ap-missions-sous">' + r + ' mission' + (r > 1 ? 's' : '') + ' à faire</div><a class="ap-bouton" id="apBoutonMissions" href="' + URL_MISSIONS + '">Commencer les missions</a>'
          : '<div class="ap-missions-sous">' + (v.missions.total ? 'Toutes les missions sont faites' : 'Aucune mission aujourd’hui') + '</div>')
        + '</section>';
    }
    out += '<a class="ap-progression" id="apProgression" href="' + URL_PROGRESSION + '"><span>Ma progression · +' + v.points + ' point' + (v.points > 1 ? 's' : '') + ' aujourd’hui</span><span>Mes séries ›</span></a>';
    out += '<div class="ap-pied"><a href="' + URL_PRISE_DE_POSTE + '" id="apChangerPoste">Changer de poste</a><a href="#" id="apLogout">Se déconnecter</a></div>';
    return out;
  }

  const api = { etapesOuverture, livraisonAttendue, heureLocale, modele, html, STATUTS_COMMANDE_ATTENDUE, URL_RECEPTION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.NexusAccueilPiste = api;
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null));
