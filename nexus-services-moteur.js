// NEXUS — clôture des services (04/09/2026). Moteur métier pur.
//
// Un service se termine sur un ÉVÉNEMENT RÉEL : l'employé le termine, il
// pointe son départ, il ouvre un nouveau service, ou le manager corrige.
// Jamais sur la seule heure courante — exigence explicite de Frédéric.
// L'horloge ne sert qu'à SIGNALER au manager un service resté ouvert ;
// c'est lui qui tranche, et sa décision est journalisée.
//
// NEXUS n'invente jamais une heure de départ. D'où deux états distincts :
// « terminé » quand la fin est connue, « clos sans pointage » quand on
// sait que le service est fini mais pas quand. Cette distinction est aussi
// une contrainte de base : elle ne dépend pas de la discipline d'appel.
(function (global) {
  'use strict';

  const STATUTS = ['en_cours', 'termine', 'clos_sans_pointage', 'legacy', 'test'];
  const SOURCES = ['employe', 'pointage_depart', 'manager', 'prise_de_poste_suivante', 'systeme_legacy', 'test'];

  // Une source ne peut clore qu'avec l'état qu'elle est capable d'établir.
  // Une prise de poste suivante prouve que le service précédent est fini,
  // mais ne dit rien de l'heure : elle ne peut donc jamais produire
  // « terminé ». C'est ce tableau qui rend l'invention impossible en amont
  // de la base, plutôt que de compter sur l'appelant.
  const ETATS_AUTORISES = {
    employe: ['termine'],
    pointage_depart: ['termine'],
    manager: ['termine', 'clos_sans_pointage'],
    prise_de_poste_suivante: ['clos_sans_pointage'],
    systeme_legacy: ['legacy'],
    test: ['test'],
  };

  const LIBELLE_STATUT = {
    en_cours: 'En cours',
    termine: 'Terminé',
    clos_sans_pointage: 'Clos sans heure de fin',
    legacy: 'Service antérieur au suivi',
    test: 'Prise de poste de test',
  };

  const LIBELLE_SOURCE = {
    employe: 'clôturé par l’employé',
    pointage_depart: 'clôturé par le pointage de départ',
    manager: 'clôturé par le manager',
    prise_de_poste_suivante: 'clos par l’ouverture du service suivant',
    systeme_legacy: 'qualifié comme service antérieur',
    test: 'marqué comme test',
  };

  function estOuvert(shift) { return !!shift && shift.statut === 'en_cours'; }

  // Le service ouvert d'un employé. Il ne peut y en avoir qu'un : si
  // plusieurs traînent, on retourne le plus récent et on signale les
  // autres — jamais un choix silencieux.
  function serviceOuvert(shifts, employeeId) {
    const ouverts = (shifts || [])
      .filter(s => estOuvert(s) && (!employeeId || s.employee_id === employeeId))
      .sort((a, b) => String(b.heure_debut).localeCompare(String(a.heure_debut)));
    return { service: ouverts[0] || null, enTrop: ouverts.slice(1) };
  }

  /**
   * Construit la clôture d'un service, ou explique pourquoi elle est
   * refusée. Ne touche à rien : renvoie `{ ok, patch, erreur }`, l'appelant
   * décide. Les règles reproduites ici sont exactement celles que la base
   * fait respecter — l'écran ne peut donc pas proposer une clôture que
   * Postgres rejettera ensuite en silence.
   */
  function preparerCloture(shift, options) {
    const o = options || {};
    if (!shift) return { ok: false, erreur: 'Aucun service à clôturer.' };
    if (!estOuvert(shift)) {
      return { ok: false, erreur: `Ce service est déjà « ${LIBELLE_STATUT[shift.statut] || shift.statut} ».` };
    }
    if (!SOURCES.includes(o.source)) return { ok: false, erreur: 'Origine de clôture inconnue.' };

    // État par défaut : celui que la source est capable d'établir, et non
    // une déduction à partir de la présence d'une heure. Déduire menait à
    // un refus juste avec un message faux — « cette source ne peut pas
    // produire cet état » là où il fallait lire « il manque l'heure de
    // fin ». Un refus incompréhensible coûte aussi cher qu'un refus absent.
    const etat = o.statut || ETATS_AUTORISES[o.source][0];
    if (!(ETATS_AUTORISES[o.source] || []).includes(etat)) {
      return { ok: false, erreur: `Une clôture « ${LIBELLE_SOURCE[o.source]} » ne peut pas produire l’état « ${LIBELLE_STATUT[etat] || etat} ».` };
    }

    if (etat === 'termine') {
      if (!o.heureFin) return { ok: false, erreur: 'Une heure de fin est requise pour terminer un service.' };
      if (String(o.heureFin) < String(shift.heure_debut)) {
        return { ok: false, erreur: 'L’heure de fin précède le début du service.' };
      }
      if (o.maintenant && String(o.heureFin) > String(o.maintenant)) {
        return { ok: false, erreur: 'L’heure de fin est dans le futur.' };
      }
    } else if (o.heureFin) {
      // Garde-fou : on refuse une heure de fin sur un état qui signifie
      // précisément « on ne sait pas quand ». La laisser passer
      // reviendrait à inventer la donnée qu'on prétend ne pas avoir.
      return { ok: false, erreur: 'Cet état signifie que l’heure de fin est inconnue : elle ne peut pas être renseignée.' };
    }

    if (o.source === 'manager' && !o.motif) {
      return { ok: false, erreur: 'Un motif est requis : une correction manager doit dire pourquoi.' };
    }

    return {
      ok: true,
      patch: {
        statut: etat,
        heure_fin: etat === 'termine' ? o.heureFin : null,
        cloture_par: o.actorId || null,
        cloture_le: o.maintenant || new Date().toISOString(),
        cloture_source: o.source,
        cloture_motif: o.motif || null,
      },
    };
  }

  /**
   * Services restés ouverts au-delà du seuil. C'est un SIGNALEMENT, pas
   * une clôture : rien n'est modifié ici, et rien ne doit l'être ailleurs
   * sur la seule foi de l'horloge. Le manager voit la liste et tranche
   * service par service.
   */
  function servicesRestesOuverts(shifts, options) {
    const o = options || {};
    const seuilMs = (o.seuilHeures || 14) * 3600 * 1000;
    const maintenant = new Date(o.maintenant || Date.now()).getTime();
    return (shifts || [])
      .filter(estOuvert)
      .map(s => ({ shift: s, ouvertDepuisMin: Math.round((maintenant - new Date(s.heure_debut).getTime()) / 60000) }))
      .filter(x => x.ouvertDepuisMin * 60000 > seuilMs)
      .sort((a, b) => b.ouvertDepuisMin - a.ouvertDepuisMin);
  }

  // Phrase de journal, lisible telle quelle par un manager.
  function journalCloture(shift, nomParActeur) {
    if (!shift || shift.statut === 'en_cours') return null;
    const qui = shift.cloture_par && nomParActeur ? (nomParActeur[shift.cloture_par] || null) : null;
    const quand = shift.cloture_le ? String(shift.cloture_le).slice(0, 16).replace('T', ' à ') : null;
    return [
      LIBELLE_STATUT[shift.statut] || shift.statut,
      LIBELLE_SOURCE[shift.cloture_source] || shift.cloture_source,
      qui ? `par ${qui}` : null,
      quand ? `le ${quand}` : null,
      shift.cloture_motif || null,
    ].filter(Boolean).join(' · ');
  }

  global.NexusServicesMoteur = {
    STATUTS, SOURCES, ETATS_AUTORISES, LIBELLE_STATUT, LIBELLE_SOURCE,
    estOuvert, serviceOuvert, preparerCloture, servicesRestesOuverts, journalCloture,
  };
})(typeof window !== 'undefined' ? window : globalThis);
