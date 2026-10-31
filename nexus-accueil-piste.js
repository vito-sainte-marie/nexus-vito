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
  const URL_POINTAGE = 'NEXUS-Pointage-v1.html';
  const DELAI_FERMETURE_MIN = 45;
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

  // Index de fin et inventaire de clôture peuvent se faire dans l'un ou l'autre ordre : la plage va de la plus petite à la plus grande heure.
  function bornes(a, b) {
    const ok = [a, b].filter((x) => x && !isNaN(new Date(x).getTime()));
    return ok.sort((x, y) => new Date(x) - new Date(y)).concat([null, null]).slice(0, 2);
  }

  function libelleQuart(q) {
    return q === 'matin' ? 'Quart du matin' : q === 'soir' ? 'Quart du soir' : '';
  }

  // Minutes depuis minuit -> « 13 h 15 ». L'heure vient de la station (finMinutes), jamais d'une constante ici.
  function heureDeMinutes(min) {
    return String(Math.floor(min / 60)).padStart(2, '0') + ' h ' + String(min % 60).padStart(2, '0');
  }

  // Deux bornes connues -> « de → à » ; une seule -> cette borne ; aucune -> null (la ligne est omise, jamais estimée).
  function plage(de, a) {
    const l = [de, a].filter(Boolean);
    return l.length ? l.join(' → ') : null;
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
    // Fermeture de la piste (lot FERMETURE-PISTE-20261031). Fin du quart lue par l'Accueil dans station_config.horaires
    // (finMinutes) ; sans elle, aucune fermeture n'est proposée. Le lien du fil est donné par l'Accueil, jamais recalculé ici.
    const maintenant = Number(f.maintenantMinutes);
    const debut = Number(f.finMinutes) - DELAI_FERMETURE_MIN;
    const fermetureOuverte = f.finMinutes != null && maintenant >= debut;
    const stepsFermeture = [
      { libelle: 'Index de fin de quart', fait: !f.finIndexApplicable || !!f.finIndexFait },
      { libelle: 'Inventaire de clôture zone piste', fait: !!f.clotureInventaireFait },
    ];
    const fermetureFaites = stepsFermeture.filter((e) => e.fait).length;
    const fermetureFaite = fermetureFaites === stepsFermeture.length;
    const avecFermeture = f.finMinutes != null;
    const ecranFermeture = filTermine && fermetureOuverte && !fermetureFaite;
    const ecranTermine = avecFermeture && filTermine && fermetureFaite;
    const mode = ecranTermine ? 'termine' : ecranFermeture ? 'fermeture' : (avecFermeture && filTermine) ? 'ouverture_reduite' : 'ouverture';
    const rc = f.recap || {};
    const heureOuvertureFin = heureLocale(rc.ouvertureA, f.fuseau);
    return {
      mode,
      fermeture: avecFermeture ? {
        avant: heureDeMinutes(Number(f.finMinutes)),
        proposeeA: heureDeMinutes(debut),
        faites: fermetureFaites, total: stepsFermeture.length,
        etapes: stepsFermeture,
        // La barre se remplit de gauche à droite selon le nombre d'étapes faites, quel que soit l'ordre où elles le sont.
        segments: stepsFermeture.map((e, i) => i < fermetureFaites),
        href: f.fermetureLien || null,
        commence: fermetureFaites > 0,
      } : null,
      termine: ecranTermine ? {
        apresMidi: f.quart === 'matin',
        ouverture: plage(heureLocale(rc.ouvertureDe, f.fuseau), heureOuvertureFin),
        fermeture: plage(heureLocale(bornes(rc.fermetureDe, rc.fermetureA)[0], f.fuseau), heureLocale(bornes(rc.fermetureDe, rc.fermetureA)[1], f.fuseau)),
        missions: m.total > 0 ? m.faites + ' sur ' + m.total : null,
        missionsToutes: m.total > 0 && m.faites >= m.total,
        // Le pointage de départ n'existe que si la station l'active ; sinon la sortie est la déconnexion.
        pointageActif: f.pointageActif === true,
      } : null,
      ouvertureFaiteA: heureOuvertureFin,
      prenom: f.prenom || '',
      poste: { libelle: f.libelleRole || 'Pompiste', quart: libelleQuart(f.quart), depuis: heureLocale(f.heureDebut, f.fuseau), fin: avecFermeture ? heureDeMinutes(Number(f.finMinutes)) : null, image: IMAGES_POSTE.pompiste },
      etapes, faites, total: etapes.length, filTermine,
      // Le bouton ne pointe que vers le fil de l'Accueil, jamais vers une étape recalculée ici.
      bouton: (!filTermine && f.filLien) ? { libelle: 'Continuer : ' + prochaine.libelle, href: f.filLien } : null,
      reception: f.receptionApplicable ? { href: URL_RECEPTION, livraison: livraison && livraison.length ? livraison : null } : null,
      // Fin de quart : une fois le fil terminé, tant que le relevé de fin n'est pas final. Cible donnée par l'Accueil.
      finQuart: (!avecFermeture && filTermine && f.finQuartLien && !f.finQuartFait) ? { libelle: 'Fin de quart : relevé des index', href: f.finQuartLien } : null,
      // Une étape à faire sans bouton est une impasse : l'Accueil doit toujours fournir filLien.
      incoherent: !filTermine && !f.filLien,
      missions: filTermine ? { restantes: Math.max(0, m.total - m.faites), total: m.total } : null,
      points: Number(f.points) || 0,
    };
  }

  function html(v) {
    if (!v) return '';
    const p = v.poste;
    const sousLigne = [[p.quart, p.fin ? 'fin à ' + p.fin : ''].filter(Boolean).join(' · '), p.depuis ? 'En service depuis ' + p.depuis : ''].filter(Boolean);
    const carte = '<div class="ap-poste" id="apPoste"><div class="ap-poste-texte"><div class="ap-poste-nom">' + esc(p.libelle) + '</div>'
      + sousLigne.map((l) => '<div class="ap-poste-sous">' + esc(l) + '</div>').join('')
      + '</div><div class="ap-poste-image" style="background-image:url(\'' + esc(p.image) + '\')"></div></div>';
    const lignes = v.etapes.map((e) => {
      const marque = e.etat === 'a_faire' ? '○' : '✓';
      const note = e.etat === 'sans_objet' ? ' <span class="ap-sans-objet">sans objet</span>' : '';
      return '<li class="ap-etape ap-' + e.etat + '"><span class="ap-marque" aria-hidden="true">' + marque + '</span>' + esc(e.libelle) + note + '</li>';
    }).join('');
    const segments = v.etapes.map((e) => '<i class="' + (e.etat === 'a_faire' ? '' : 'ap-plein') + '"></i>').join('');
    let out = '';
    if (v.mode === 'termine') {
      const t = v.termine;
      // Une coche n'est posée que sur ce qui est fait : « 0 sur N » et zéro point restent sans coche.
      const rec = [['Ouverture', t.ouverture, true], ['Fermeture', t.fermeture, true], ['Missions', t.missions, t.missionsToutes]].filter((x) => x[1]);
      const ligne = (texte, fait) => '<li class="ap-etape ' + (fait ? 'ap-fait' : 'ap-a_faire') + '"><span class="ap-marque" aria-hidden="true">' + (fait ? '✓' : '○') + '</span>' + texte + '</li>';
      out += '<div class="ap-salut"><h1 class="ap-h1" id="apTermine">Quart terminé. Merci ' + esc(v.prenom) + '</h1>'
        + (t.apresMidi ? '<div class="ap-poste-sous">La piste est prête pour le quart du soir</div>' : '') + '</div>' + carte;
      out += '<section class="ap-fil" id="apRecap"><ul class="ap-etapes">'
        + rec.map((x) => ligne(esc(x[0]) + ' · ' + esc(x[1]), x[2])).join('')
        + ligne('+' + v.points + ' point' + (v.points > 1 ? 's' : '') + ' aujourd’hui', v.points > 0) + '</ul>'
        + (t.pointageActif
          ? '<a class="ap-bouton" id="apBoutonDepart" href="' + URL_POINTAGE + '">Pointer mon départ</a>'
          : '<a class="ap-bouton" id="apLogout" href="#">Se déconnecter</a>')
        + '</section>';
      out += '<a class="ap-lien-discret" id="apResterEncore" href="' + URL_MISSIONS + '">Je reste encore : voir les missions</a>';
      out += '<a class="ap-progression" id="apProgression" href="' + URL_PROGRESSION + '"><span>Ma progression · +' + v.points + ' point' + (v.points > 1 ? 's' : '') + ' aujourd’hui</span><span>Mes séries ›</span></a>';
      out += '<div class="ap-pied"><a href="' + URL_PRISE_DE_POSTE + '" id="apChangerPoste">Changer de poste</a>' + (t.pointageActif ? '<a href="#" id="apLogout">Se déconnecter</a>' : '') + '</div>';
      return out;
    }
    out += '<div class="ap-salut"><h1 class="ap-h1">Bonjour ' + esc(v.prenom) + '</h1></div>';
    out += carte;
    if (v.mode === 'fermeture') {
      const fe = v.fermeture;
      out += '<section class="ap-fil" id="apFermeture"><div class="ap-fil-titre">Fermeture de la piste · avant ' + esc(fe.avant) + '</div>'
        + '<div class="ap-fil-compte">' + fe.faites + ' sur ' + fe.total + '</div><div class="ap-segments">'
        + fe.segments.map((x) => '<i class="' + (x ? 'ap-plein' : '') + '"></i>').join('') + '</div>'
        + '<ul class="ap-etapes" id="apEtapesFermeture">' + fe.etapes.map((e) => '<li class="ap-etape ' + (e.fait ? 'ap-fait' : 'ap-a_faire') + '"><span class="ap-marque" aria-hidden="true">' + (e.fait ? '✓' : '○') + '</span>' + esc(e.libelle) + '</li>').join('') + '</ul>'
        + (fe.href ? '<a class="ap-bouton" id="apBoutonFermeture" href="' + esc(fe.href) + '">' + (fe.commence ? 'Continuer la fermeture' : 'Commencer la fermeture') + '</a>' : '')
        + '<div class="ap-fil-resume">' + (v.ouvertureFaiteA ? '✓ Ouverture faite à ' + esc(v.ouvertureFaiteA) : '✓ Ouverture faite') + '</div>'
        + (v.missions && v.missions.restantes > 0 ? '<div class="ap-fil-resume">' + v.missions.restantes + ' mission' + (v.missions.restantes > 1 ? 's' : '') + ' restante' + (v.missions.restantes > 1 ? 's' : '') + ' · <a href="' + URL_MISSIONS + '" id="apVoirMissions">Voir</a></div>' : '')
        + '</section>';
    } else if (v.mode === 'ouverture_reduite') {
      out += '<section class="ap-fil" id="apFil"><div class="ap-fil-titre">✓ Ouverture de la piste terminée</div>'
        + '<div class="ap-fil-resume">Fermeture proposée à partir de ' + esc(v.fermeture.proposeeA) + '</div></section>';
    } else {
      out += '<section class="ap-fil" id="apFil"><div class="ap-fil-titre">' + (v.filTermine ? 'Ouverture de la piste terminée' : 'Ouverture de la piste')
        + '</div><div class="ap-fil-compte">' + v.faites + ' sur ' + v.total + '</div><div class="ap-segments">' + segments + '</div><ul class="ap-etapes">' + lignes + '</ul>'
        + (v.bouton ? '<a class="ap-bouton" id="apBoutonPrincipal" href="' + esc(v.bouton.href) + '">' + esc(v.bouton.libelle) + '</a>' : '')
        + '</section>';
    }
    if (v.reception) {
      const l = v.reception.livraison;
      out += '<a class="ap-reception' + (l ? ' ap-attendue' : '') + '" id="apReception" href="' + esc(v.reception.href) + '"><span class="ap-camion" aria-hidden="true">🚚</span><span><b>Réception carburant</b><br><span class="ap-reception-sous">'
        + (l ? 'Livraison prévue aujourd’hui · ' + esc(listeCarburants(l)) : 'Un camion arrive ? Commencez ici') + '</span></span></a>';
    }
    if (v.missions && v.mode !== 'fermeture') {
      const r = v.missions.restantes;
      out += '<section class="ap-missions" id="apMissions"><div class="ap-fil-titre">Missions du jour</div>'
        + (r > 0
          ? '<div class="ap-missions-sous">' + r + ' mission' + (r > 1 ? 's' : '') + ' à faire</div><a class="ap-bouton" id="apBoutonMissions" href="' + URL_MISSIONS + '">Commencer les missions</a>'
          : '<div class="ap-missions-sous">' + (v.missions.total ? 'Toutes les missions sont faites' : 'Aucune mission aujourd’hui') + '</div>')
        + '</section>';
    }
    // Bouton secondaire (encadré) sous les missions : « Commencer les missions » reste le seul bouton principal.
    if (v.mode === 'ouverture_reduite' && v.fermeture.href) {
      out += '<a class="ap-lien-discret" id="apFermerMaintenant" href="' + esc(v.fermeture.href) + '">Fermer la piste maintenant</a>';
    }
    if (v.finQuart) {
      out += '<a class="ap-bouton ap-secondaire" id="apFinQuart" href="' + esc(v.finQuart.href) + '">' + esc(v.finQuart.libelle) + '</a>';
    }
    out += '<a class="ap-progression" id="apProgression" href="' + URL_PROGRESSION + '"><span>Ma progression · +' + v.points + ' point' + (v.points > 1 ? 's' : '') + ' aujourd’hui</span><span>Mes séries ›</span></a>';
    out += '<div class="ap-pied"><a href="' + URL_PRISE_DE_POSTE + '" id="apChangerPoste">Changer de poste</a><a href="#" id="apLogout">Se déconnecter</a></div>';
    return out;
  }

  const api = { etapesOuverture, livraisonAttendue, heureLocale, modele, html, STATUTS_COMMANDE_ATTENDUE, URL_RECEPTION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.NexusAccueilPiste = api;
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null));
