// ============================================================
// NEXUS Ponctualité — règle unique du taux de ponctualité / d'anomalies
// (lot A4-4, 27/11/2026).
//
// Avant ce fichier, six lecteurs de `pointages.retard_min` appliquaient
// chacun leur fenêtre et leur formule (historique complet, 7 jours,
// 14 jours, période choisie, somme de minutes). Un même collaborateur
// pouvait donc être « ponctuel à 95 % » sur un écran et « équipe à 25 » sur
// un autre. Désormais : UNE règle, une fenêtre commune de 30 jours glissants
// calculée depuis le jour de la STATION (nexusAujourdhuiStation, A3), jamais
// depuis l'UTC.
//
// Règle de dénominateur : `retard_min` est nullable depuis le 19/09/2026.
//   NULL  = retard non mesuré : ni « à l'heure » ni « en retard », il sort
//           des DEUX côtés de la fraction ;
//   0     = à l'heure (mesuré) ;
//   > 0   = en retard.
// Dépend de rien : l'inclure avant les fichiers *-donnees.js qui l'utilisent.
// ============================================================
(function (global) {
  const FENETRE_JOURS = 30;
  const PAGE = 1000; // plafond PostgREST : on pagine, jamais de lecture tronquée

  function mesure(p) {
    return p && p.retard_min != null && Number.isFinite(Number(p.retard_min));
  }

  // Pure. `pointages` : lignes {employee_id, type, retard_min, date}.
  // Ne retient que les arrivées, datées dans [debut, fin] (inclus, jours ISO ;
  // une borne absente n'est pas appliquée).
  function tauxPonctualite(pointages, bornes) {
    const b = bornes || {};
    const lignes = (pointages || []).filter(p => {
      if (!p || (p.type != null && p.type !== 'arrivee')) return false;
      if (b.debut && !(p.date >= b.debut)) return false;
      if (b.fin && !(p.date <= b.fin)) return false;
      return true;
    });
    const mesurees = lignes.filter(mesure);
    const retards = mesurees.filter(p => Number(p.retard_min) > 0);
    const nbMesures = mesurees.length;
    const nbRetards = retards.length;
    const tauxAnomalies = nbMesures > 0 ? nbRetards / nbMesures : null;
    const parEmploye = {};
    retards.forEach(p => { if (p.employee_id) parEmploye[p.employee_id] = (parEmploye[p.employee_id] || 0) + 1; });
    // Par collaborateur : retards et arrivées mesurées (taille d'échantillon).
    const parColl = {};
    mesurees.forEach(p => {
      if (!p.employee_id) return;
      const c = parColl[p.employee_id] || (parColl[p.employee_id] = { nom: p.employees ? p.employees.nom : p.employee_id, nbRetards: 0, totalPointages: 0 });
      c.totalPointages++;
      if (Number(p.retard_min) > 0) c.nbRetards++;
    });
    return {
      parCollaborateur: parColl,
      nbArrivees: lignes.length,
      nbMesures,
      nbNonMesures: lignes.length - nbMesures,
      nbRetards,
      tauxAnomalies,
      tauxPonctualite: tauxAnomalies == null ? null : 1 - tauxAnomalies,
      retardsParEmploye: parEmploye,
    };
  }

  // Collaborateurs ayant au moins `seuil` retards (défaut 3) dans la fenêtre.
  function collaborateursASurveiller(retardsParEmploye, seuil) {
    const s = seuil || 3;
    return Object.values(retardsParEmploye || {}).filter(n => n >= s).length;
  }

  // Fenêtre de 30 jours finissant le jour de la station (inclus).
  function fenetre(jourStation, nJours) {
    if (!jourStation) return null;
    const n = nJours || FENETRE_JOURS;
    const decaler = global.nexusDecalerJour;
    if (typeof decaler !== 'function') return null;
    return { debut: decaler(jourStation, -(n - 1)), fin: jourStation };
  }

  // Charge les arrivées d'un site entre deux jours (paginé). Les lignes, pas
  // des comptes : la fenêtre est bornée, donc le volume aussi.
  async function charger(client, siteId, debut, fin) {
    let tout = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await client.from('pointages')
        .select('employee_id, type, retard_min, date, employees(nom)')
        .eq('site', siteId).eq('type', 'arrivee')
        .gte('date', debut).lte('date', fin)
        .order('date', { ascending: true }).order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) return { error, data: null };
      tout = tout.concat(data || []);
      if (!data || data.length < PAGE) break;
    }
    return { error: null, data: tout };
  }

  global.NexusPonctualite = { FENETRE_JOURS, tauxPonctualite, collaborateursASurveiller, fenetre, charger };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.NexusPonctualite;
})(typeof window !== 'undefined' ? window : global);
