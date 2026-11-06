// Validation et transmission du mois Paye (06/11/2026, lot « validation et finitions »).
// Règles pures, sans DOM ni base : l'écran les lit, les tests les rejouent.
//   brouillon -> verifie -> transmis. « Transmettre » n'est possible qu'après vérification ;
//   une vérification caduque dès qu'un élément à traiter réapparaît ; un mois transmis ne
//   se recalcule jamais en silence.
const NexusPayeValidation = (function () {
  function aTraiter(e) {
    const bloqueurs = Array.isArray(e.bloqueurs) ? e.bloqueurs.length : Number(e.bloqueurs) || 0;
    const ecart = Math.max(0, (Number(e.salariesInclus) || 0) - (Number(e.salariesPrets) || 0));
    return Math.max(bloqueurs, ecart);
  }
  // Une vérification posée devient caduque si un nouvel élément à traiter apparaît.
  // Un mois transmis n'est jamais rouvert ici (règle existante : rouvrir est un geste explicite).
  function verificationCaduque(statut, restant) {
    return statut === 'verifie' && restant > 0;
  }
  // Le titre d'un bouton grisé nomme sa cause : les paramétrages à compléter sont cités par salarié.
  function causeTitre(restant, parametrages) {
    if (!parametrages.length) return `${restant} à traiter`;
    const p = `${parametrages.length} paramétrage${parametrages.length > 1 ? 's' : ''} à compléter : ${parametrages.join(', ')}`;
    const autres = restant - parametrages.length;
    return autres > 0 ? `${p} · ${autres} autre${autres > 1 ? 's' : ''} à traiter` : p;
  }
  function etat(e) {
    const statut = e.statut || 'brouillon';
    const restant = aTraiter(e);
    const n = Number(e.salariesPrets) || 0;
    const total = Number(e.salariesInclus) || 0;
    const parametrages = Array.isArray(e.parametrages) ? e.parametrages : [];
    const valider = statut === 'brouillon' && restant === 0 && n > 0;
    const libelleValider = n === 1 ? 'Valider le salarié prêt' : `Valider les ${n} salariés prêts`;
    return {
      statut, restant, n, total,
      capsule: `${statut === 'brouillon' ? 'Prêts' : 'Validés'} ${n}/${total}`,
      // Mois transmis, puis un élément à traiter est arrivé : jamais rouvert seul, mais signalé.
      elementApresTransmission: statut === 'transmis' && restant > 0,
      validerVisible: statut === 'brouillon',
      validerActif: valider,
      validerLibelle: libelleValider,
      validerTitre: valider ? '' : (restant ? `${causeTitre(restant, parametrages)} avant de valider` : 'Aucun salarié prêt à valider'),
      transmettreActif: statut === 'verifie' && restant === 0,
      transmettreTitre: statut === 'brouillon' ? 'Validez d’abord les salariés prêts'
        : statut === 'transmis' ? 'Déjà transmis' : (restant ? causeTitre(restant, parametrages) : ''),
    };
  }
  return { aTraiter, verificationCaduque, etat };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NexusPayeValidation;
