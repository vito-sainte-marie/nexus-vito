// ============================================================
// NEXUS Brief — colle Supabase (11/08/2026)
//
// Refactoring des pages monolithiques (audit "philosophie/architecture",
// priorité #3 des 3 chantiers déférés lors du choix de la v2.37, demandé
// explicitement par Frédéric : "refactoring des pages monolithiques"),
// NEXUS-Brief-v1.html choisi comme page pilote. Objectif rappelé par
// Frédéric : Brief affiche ; un moteur calcule ; un service récupère les
// données — sans changer une seule couleur ni un seul bouton.
//
// Ce fichier est ce "service" pour NEXUS-Brief-v1.html : toutes les
// requêtes Supabase qui vivaient jusqu'ici mélangées à l'affichage dans le
// <script> inline de Brief (~360 lignes, sur 1559 lignes au total).
// AUCUN calcul métier ici (Article 11 — un chargeur ne fait jamais un
// deuxième calcul) : chaque fonction lit des lignes brutes et les passe
// telles quelles aux moteurs déjà partagés (NexusConseiller, NexusTempo,
// NexusStock, NexusFdjMoteur, NexusCoachFdj, NexusCarburantDonnees/Moteur,
// NexusMarge, NexusPeriodes) — exactement le même principe que
// nexus-carburant-donnees.js pour Carburants ou nexus-coach-fdj-donnees.js
// pour Coach FDJ.
//
// Convention : chaque fonction reçoit `client` (nexusClient) et `siteId`
// (SITE_ACTUEL) en paramètres explicites plutôt que de fermer sur les
// variables module-level de Brief — un chargeur ne doit dépendre que de ce
// qu'on lui donne, ni d'un état de page qu'il ne contrôle pas. Seule
// exception assumée et documentée : chargerDomaineEquipe() ne filtre
// aujourd'hui par aucun site (reprise à l'identique du comportement
// existant dans NEXUS-Brief-v1.html avant ce refactoring — voir le
// commentaire sur la fonction elle-même).
//
// chargerJournalDecisions() ne modifie plus deux variables de Brief
// (JOURNAL_DECISIONS/VALIDEES_SITE) par effet de bord : elle retourne
// désormais { journal, validees }, et c'est Brief qui décide quoi faire du
// résultat (son propre état, sa propre responsabilité) — cohérent avec le
// principe "un service récupère les données, il ne décide pas de l'état de
// la page qui l'appelle".
//
// MISE À JOUR 11/08/2026 (2e page du refactoring, NEXUS-Cockpit-v2.html) :
// 5 des chargeurs qui vivaient ici en copie (repérés comme dupliqués dès
// la v2.40) sont désormais dans nexus-conseiller-donnees.js, un fichier
// réellement partagé entre Brief et Cockpit — ce fichier ne garde qu'un
// alias de même nom qui délègue, pour que NEXUS-Brief-v1.html n'ait AUCUN
// changement d'appel à faire (Article 11 appliqué sans casser l'existant).
// Voir Data Dictionary v2.41.
//
// Inclure après nexus-conseiller.js ET nexus-conseiller-donnees.js :
// <script src="nexus-conseiller-donnees.js"></script>
// <script src="nexus-brief-donnees.js"></script>
// ------------------------------------------------------------

(function (global) {
  // estProduitAppel extrait vers nexus-conseiller-donnees.js (3e page du
  // refactoring, App-v1, 11/08/2026 — identique aux 3 copies). Alias
  // conservé : NexusBriefDonnees.estProduitAppel reste appelable de
  // l'extérieur si un futur code en a besoin.
  function estProduitAppel(categorie, article) {
    return global.NexusConseillerDonnees.estProduitAppel(categorie, article);
  }

  // Délègue à NexusConseillerDonnees.chargerProduitsBrut (partagé avec
  // Cockpit — identique requête + filtre produits d'appel). Nom et
  // signature conservés pour que construireBrief() n'ait rien à changer.
  async function chargerProducts(client, siteId) {
    return global.NexusConseillerDonnees.chargerProduitsBrut(client, siteId);
  }

  // Nexus Marge+ — même moteur que NEXUS-Scanner-v1.html (R5-MARGE-ECART),
  // repris à l'identique de chargerMargePlusHome() dans NEXUS-App-v1.html
  // (duplication non traitée dans ce lot, voir Data Dictionary v2.40).
  async function chargerMargePlus(client, siteId, rowsBrut) {
    const { periodeAffichage, rowsAffichage } = global.NexusPeriodes.analyserPeriodes(rowsBrut);
    if (!periodeAffichage) return null;
    const [exclusionsRes, valideesRes] = await Promise.all([
      client.from('marge_exceptions').select('article').eq('site', siteId),
      client.from('journal_decisions').select('candidate_id').eq('site', siteId).eq('rule_id', 'R5-MARGE-ECART'),
    ]);
    const rowsPropres = rowsAffichage.filter(r => (r.ca || 0) > 0 && (r.marge || 0) >= 0 && (r.marge || 0) <= (r.ca || 0));
    const exclusionsManuelles = new Set(((exclusionsRes && exclusionsRes.data) || []).map(r => r.article));
    const valideesMarge = new Set(((valideesRes && valideesRes.data) || []).map(d => d.candidate_id));
    const ecarts = global.NexusMarge.detecterEcartsMarge(rowsPropres, exclusionsManuelles)
      .filter(e => !valideesMarge.has(`LIVE-R5-${e.categorie}|${e.article}`));
    const meilleur = ecarts[0];
    const candidatTop = meilleur ? {
      candidate_id: `LIVE-R5-${meilleur.categorie}|${meilleur.article}`, etat: '💡 RECOMMANDATION',
      article: meilleur.article, categorie: meilleur.categorie, impact_eur: meilleur.gainPotentiel,
      situation: `${meilleur.article} a une marge de ${meilleur.margePct.toFixed(1)} %, contre ${meilleur.medianeGroupe.toFixed(1)} % pour les ${meilleur.tailleGroupe} produits comparables du même type.`,
      analyse: `Cet écart peut venir d'un prix d'achat renégocié, d'une remise non répercutée, ou d'un choix délibéré — à vérifier avant d'ajuster quoi que ce soit.`,
      recommandation: `Vérifiez si le prix d'achat ou de vente de ${meilleur.article} peut se rapprocher de la marge médiane de son groupe.`,
      impact: `Si aligné sur la médiane du groupe, gain potentiel estimé à environ ${Math.round(meilleur.gainPotentiel).toLocaleString('fr-FR')} € sur cette période — une hypothèse, pas une garantie.`,
      ca_reference: meilleur.ca, periode_reference_debut: periodeAffichage.debut, periode_reference_fin: periodeAffichage.fin,
    } : null;
    // categoriesEnEcart (12/08/2026, pilote moteur de risques) : catégories
    // distinctes déjà repérées ici par comparaison de pairs — sert de
    // périmètre borné à NexusRisquesDonnees.qualifierEtEnregistrerRisquesBriefPilote(),
    // qui y ajoute sa propre lecture temporelle. Une seule exécution de
    // detecterEcartsMarge (Article 11), jamais un second balayage.
    return { nbEcarts: ecarts.length, gainPotentiel: ecarts.reduce((s, e) => s + e.gainPotentiel, 0), candidatTop, categoriesEnEcart: [...new Set(ecarts.map(e => e.categorie))] };
  }

  // chargerMessagesAdvisor / calculerStatutOperations / chargerConstatTempo
  // extraits vers nexus-conseiller-donnees.js (3e page du refactoring,
  // App-v1, 11/08/2026 — identiques entre App et Brief). Alias conservés.
  async function chargerMessagesAdvisor(client, siteId) {
    return global.NexusConseillerDonnees.chargerMessagesAdvisor(client, siteId);
  }

  function calculerStatutOperations(moyenneEcartAbsolu, nbJours) {
    return global.NexusConseillerDonnees.calculerStatutOperations(moyenneEcartAbsolu, nbJours);
  }

  async function chargerConstatTempo(client, siteId) {
    return global.NexusConseillerDonnees.chargerConstatTempo(client, siteId);
  }

  // Caisse/Stock/Rappels — extraits vers nexus-conseiller-donnees.js
  // (partagé avec Cockpit, 11/08/2026). Alias conservés pour que
  // construireBrief() n'ait rien à changer.
  async function chargerCandidatsCaisse(client, siteId) {
    return global.NexusConseillerDonnees.chargerCandidatsCaisse(client, siteId);
  }

  async function chargerCandidatsStock(client, siteId) {
    return global.NexusConseillerDonnees.chargerCandidatsStock(client, siteId);
  }

  async function chargerCandidatsRappels(client, siteId) {
    return global.NexusConseillerDonnees.chargerCandidatsRappels(client, siteId);
  }

  async function chargerDerniereReferenceFdj(client, siteId) {
    const { data, error } = await client.from('fdj_stock_references').select('*').eq('site', siteId).eq('statut', 'valide')
      .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) { console.error('Chargement référence stock FDJ (Brief):', error); return null; }
    if (!data) return null;
    const { data: lignes, error: e2 } = await client.from('fdj_stock_reference_lignes').select('game_id, bureau_reel, caisse_reel').eq('reference_id', data.id);
    if (e2) { console.error('Chargement lignes référence stock FDJ (Brief):', e2); return null; }
    const map = {};
    (lignes || []).forEach(l => { map[l.game_id] = { bureau: l.bureau_reel, caisse: l.caisse_reel }; });
    return { creeLe: data.created_at, lignes: map };
  }

  // Carburants (Phase 1 de la montée en puissance de NEXUS Carburants) :
  // résumé condensé pour la carte autonome de Brief, PAS intégré au
  // classement cross-moteurs. Réutilise TEL QUEL nexus-carburant-moteur.js
  // / nexus-carburant-donnees.js — jamais un recalcul local (Article 11).
  async function chargerCarburantsBrief(client, siteId) {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    // 7 derniers jours glissants vs les 7 jours précédents — PAS la semaine
    // calendaire, même convention que chargerCandidatsFdj() ci-dessous :
    // toujours comparer des fenêtres de durée égale.
    const finActuelle = new Date(); finActuelle.setHours(23, 59, 59, 999);
    const debutActuelle = new Date(finActuelle); debutActuelle.setDate(debutActuelle.getDate() - 6);
    const finPrecedente = new Date(debutActuelle); finPrecedente.setDate(finPrecedente.getDate() - 1);
    const debutPrecedente = new Date(finPrecedente); debutPrecedente.setDate(debutPrecedente.getDate() - 6);
    const iso = d => d.toISOString().slice(0, 10);

    const [controle, actuel, reference] = await Promise.all([
      global.NexusCarburantDonnees.chargerControleJour(client, siteId, aujourdhui),
      global.NexusCarburantDonnees.chargerVentesPeriode(client, siteId, iso(debutActuelle), iso(finActuelle)),
      global.NexusCarburantDonnees.chargerVentesPeriode(client, siteId, iso(debutPrecedente), iso(finPrecedente)),
    ]);
    const M = global.NexusCarburantMoteur;
    const mix = M.calculerMixCarburant(actuel.ventes);
    const mixRef = M.calculerMixCarburant(reference.ventes);
    const evolution = mix && mixRef ? M.calculerEvolutionVolume(mix.total, mixRef.total) : null;
    const produitMoteur = M.identifierProduitMoteur(actuel.ventes);
    return { controle, volumeSemaine: mix ? mix.total : null, evolution, produitMoteur };
  }

  async function chargerCandidatsFdj(client, siteId) {
    const finActuelle = new Date(); finActuelle.setHours(23, 59, 59, 999);
    const debutActuelle = new Date(finActuelle); debutActuelle.setDate(debutActuelle.getDate() - 6); debutActuelle.setHours(0, 0, 0, 0);
    const finComp = new Date(debutActuelle); finComp.setDate(finComp.getDate() - 1); finComp.setHours(23, 59, 59, 999);
    const debutComp = new Date(finComp); debutComp.setDate(debutComp.getDate() - 6); debutComp.setHours(0, 0, 0, 0);
    const iso = d => d.toISOString().slice(0, 10);

    const [{ data: jeuxData, error: e1 }, { data: dailyRows, error: e2 }, { data: gameDailyRows, error: e3 },
      { data: emplacements, error: e4 }, { data: mouvements, error: e5 }, reference] = await Promise.all([
      client.from('fdj_games').select('id, nom').eq('site', siteId).eq('actif', true),
      client.from('view_fdj_daily_summary').select('*').eq('site', siteId).gte('date', iso(debutComp)).lte('date', iso(finActuelle)),
      client.from('view_fdj_game_daily').select('game_id, ca, date').eq('site', siteId).gte('date', iso(debutActuelle)).lte('date', iso(finActuelle)),
      client.from('fdj_locations').select('id, type').eq('site', siteId).eq('actif', true),
      client.from('fdj_stock_movements').select('type_mouvement, quantite, game_id, location_source_id, location_destination_id, created_at').eq('site', siteId),
      chargerDerniereReferenceFdj(client, siteId),
    ]);
    if (e1 || e2 || e3 || e4 || e5) { [e1, e2, e3, e4, e5].forEach(e => { if (e) console.error('Chargement données FDJ (Brief):', e); }); return { candidats: [], resume: null }; }
    if (!jeuxData || !jeuxData.length) return { candidats: [], resume: null };

    const champs = ['ca_grattage', 'nb_ecarts_non_nuls', 'nb_quarts_controles'];
    const sommer = lignes => champs.reduce((acc, c) => { acc[c] = (lignes || []).reduce((s, l) => s + (l[c] != null ? Number(l[c]) : 0), 0); return acc; }, {});
    const actuelRows = (dailyRows || []).filter(r => r.date >= iso(debutActuelle));
    const compRows = (dailyRows || []).filter(r => r.date < iso(debutActuelle));
    const actuel = sommer(actuelRows);
    const comp = sommer(compRows);
    const evolCa = comp.nb_quarts_controles > 0 && comp.ca_grattage > 0 ? (actuel.ca_grattage - comp.ca_grattage) / comp.ca_grattage : null;

    const gameCa = {};
    (gameDailyRows || []).forEach(l => { if (l.ca) gameCa[l.game_id] = (gameCa[l.game_id] || 0) + Number(l.ca); });
    let jeuMoteur = null, caMax = 0;
    Object.entries(gameCa).forEach(([gid, ca]) => { if (ca > caMax) { caMax = ca; jeuMoteur = { id: gid, nom: (jeuxData.find(j => j.id === gid) || {}).nom || gid }; } });

    const locations = {};
    (emplacements || []).forEach(e => { locations[e.type] = e.id; });
    const soldes = global.NexusFdjMoteur.soldesCarnetsAvecReference(mouvements || [], locations, reference);

    const candidatsBrut = global.NexusFdjMoteur.calculerCandidatsFdj({
      soldes, jeux: jeuxData.map(j => ({ id: j.id, nom: j.nom })),
      actuel, evolCa, jeuMoteur,
      labelPeriode: '7 derniers jours', labelComp: '7 jours précédents',
      periodeCle: iso(debutActuelle),
    });
    // resume : ces mêmes nombres (actuel.ca_grattage, evolCa, jeuMoteur,
    // nb_ecarts_non_nuls) servent déjà à calculer candidatsBrut ci-dessus
    // mais sont aussi retournés à l'appelant pour que
    // NexusSecteursMoteur.construireSecteurs (Article 11, aucun second
    // calcul) puisse construire le secteur FDJ sans réinterroger Supabase
    // une deuxième fois pour les mêmes lignes.
    return {
      candidats: candidatsBrut.map(global.NexusConseiller.normaliserFdj),
      resume: {
        caGrattage: actuel.ca_grattage, evolutionCa: evolCa, jeuMoteur,
        nbEcarts: actuel.nb_ecarts_non_nuls, nbQuartsControles: actuel.nb_quarts_controles,
      },
    };
  }

  // Paramétrage FDJ du site : les seuils déclencheurs de
  // calculerCandidatsCoachEquipe viennent de fdj_site_settings plutôt que
  // d'être identiques pour tous les sites. Absence de ligne -> repli sur
  // les mêmes valeurs que l'ancien comportement (voir
  // NexusCoachFdj.SEUILS_COACH_EQUIPE_DEFAUT).
  async function chargerSeuilsCoachEquipeFdj(client, siteId) {
    const { data, error } = await client.from('fdj_site_settings').select('coach_seuil_risque_recurrent, coach_seuil_axe_equipe, coach_seuil_progres_base, coach_seuil_progres_baisse').eq('site', siteId).maybeSingle();
    if (error) { console.error('Chargement paramètres FDJ site (seuils Coach):', error); return undefined; }
    if (!data) return undefined;
    return {
      risqueRecurrent: data.coach_seuil_risque_recurrent,
      axeEquipe: data.coach_seuil_axe_equipe,
      progresBase: data.coach_seuil_progres_base,
      progresBaisse: data.coach_seuil_progres_baisse,
    };
  }

  // Candidats Coach FDJ — lit coach_daily_recommendations déjà écrites
  // (aucune règle recalculée ici, voir NexusCoachFdj.calculerCandidatsCoachEquipe
  // — Article 11). Même fenêtre fixe que chargerCandidatsFdj ci-dessus.
  async function chargerCandidatsCoachEquipe(client, siteId) {
    const finActuelle = new Date(); finActuelle.setHours(23, 59, 59, 999);
    const debutActuelle = new Date(finActuelle); debutActuelle.setDate(debutActuelle.getDate() - 6); debutActuelle.setHours(0, 0, 0, 0);
    const finComp = new Date(debutActuelle); finComp.setDate(finComp.getDate() - 1); finComp.setHours(23, 59, 59, 999);
    const debutComp = new Date(finComp); debutComp.setDate(debutComp.getDate() - 6); debutComp.setHours(0, 0, 0, 0);
    const iso = d => d.toISOString().slice(0, 10);

    const [{ data: actuel, error: e1 }, { data: comp, error: e2 }] = await Promise.all([
      client.from('coach_daily_recommendations').select('employee_id, rule_id').eq('site', siteId).gte('date', iso(debutActuelle)).lte('date', iso(finActuelle)),
      client.from('coach_daily_recommendations').select('rule_id').eq('site', siteId).gte('date', iso(debutComp)).lte('date', iso(finComp)),
    ]);
    if (e1 || e2) { [e1, e2].forEach(e => { if (e) console.error('Chargement coach_daily_recommendations (Brief):', e); }); return []; }

    const seuils = await chargerSeuilsCoachEquipeFdj(client, siteId);
    const candidatsBrut = global.NexusCoachFdj.calculerCandidatsCoachEquipe({
      actuel: actuel || [], comp: comp || [],
      labelPeriode: '7 derniers jours', labelComp: '7 jours précédents',
      periodeCle: iso(debutActuelle),
    }, seuils);
    return candidatsBrut.map(global.NexusConseiller.normaliserCoach);
  }

  // Domaine Équipe — repris de chargerDomainesRadarHome() dans App-v1
  // (ponctualité uniquement, comme partout ailleurs dans NEXUS).
  // N'ACCEPTE PAS siteId : comportement repris à l'identique de l'ancienne
  // version locale de NEXUS-Brief-v1.html, qui n'a jamais filtré cette
  // requête par site (aucun changement de comportement introduit par ce
  // refactoring — signalé ici pour que ça ne passe pas inaperçu à la
  // prochaine lecture, Article 5).
  async function chargerDomaineEquipe(client) {
    const [{ data: pointagesRetard, error: e2 }, { count: totalPointages, error: e3 }] = await Promise.all([
      client.from('pointages').select('employee_id, retard_min').eq('type', 'arrivee').gt('retard_min', 0),
      client.from('pointages').select('id', { count: 'exact', head: true }).eq('type', 'arrivee'),
    ]);
    if (e2) console.error('Chargement pointages (Brief):', e2);
    if (e3) console.error('Chargement total pointages (Brief):', e3);
    let equipeScore = null, employesASurveiller = null;
    // totalAnomalies/collaborateursConcernes (12/08/2026, cadrage §11, lot
    // P1.4 "Lecture Équipe") : `pointagesRetard` contenait déjà
    // `employee_id` par ligne — la granularité nécessaire pour distinguer
    // incident individuel / récurrence individuelle / problème collectif
    // existait donc depuis la première version de cette fonction, jamais
    // exploitée au-delà du seul comptage `employesASurveiller` (nb de
    // collaborateurs à ≥3 retards). Aucune nouvelle requête : ce lot ne
    // fait qu'exposer 2 agrégats calculés à partir des mêmes lignes déjà
    // chargées.
    let totalAnomalies = 0, collaborateursConcernes = 0;
    if (pointagesRetard) {
      const totalRetard = pointagesRetard.reduce((s, p) => s + (p.retard_min || 0), 0);
      equipeScore = Math.round(Math.max(0, 100 - totalRetard));
      const retardsParEmploye = {};
      pointagesRetard.forEach(p => { if (p.employee_id) retardsParEmploye[p.employee_id] = (retardsParEmploye[p.employee_id] || 0) + 1; });
      employesASurveiller = Object.values(retardsParEmploye).filter(n => n >= 3).length;
      totalAnomalies = pointagesRetard.length;
      collaborateursConcernes = Object.keys(retardsParEmploye).length;
    }
    return {
      equipeScore, employesASurveiller, totalPointages: totalPointages != null ? totalPointages : null,
      totalAnomalies, collaborateursConcernes,
    };
  }

  async function chargerAlertesInventaireOuvertes(client, siteId) {
    const { count, error } = await client.from('inventaire_alertes').select('id', { count: 'exact', head: true }).eq('site', siteId).eq('statut', 'ouverte');
    if (error) { console.error('Chargement alertes inventaire (Brief):', error); return null; }
    return count;
  }

  async function chargerControlesVerifyRestants(client, siteId) {
    return global.NexusConseillerDonnees.chargerControlesVerifyRestants(client, siteId);
  }

  async function chargerMissionsRestantes(client, siteId) {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const [catalogueRes, completionsRes] = await Promise.all([
      client.from('mission_catalog').select('mission_id', { count: 'exact', head: true }).eq('actif', true).eq('ponctuelle', false).eq('site_id', siteId),
      client.from('mission_completions').select('mission_id').eq('site_id', siteId).eq('date', aujourdhui),
    ]);
    if (catalogueRes.error) { console.error('Chargement mission_catalog (Brief):', catalogueRes.error); return null; }
    const total = catalogueRes.count != null ? catalogueRes.count : null;
    if (total == null) return null;
    const faitesAujourdhui = new Set((completionsRes.data || []).map(r => r.mission_id)).size;
    return Math.max(0, total - faitesAujourdhui);
  }

  // Journal des décisions — extrait vers nexus-conseiller-donnees.js
  // (partagé avec Cockpit, 11/08/2026 : même requête exacte que Brief).
  // Alias conservé pour que construireBrief() n'ait rien à changer.
  async function chargerJournalDecisions(client, siteId) {
    return global.NexusConseillerDonnees.chargerJournalDecisions(client, siteId);
  }

  global.NexusBriefDonnees = {
    estProduitAppel, chargerProducts,
    chargerMargePlus, chargerMessagesAdvisor, calculerStatutOperations, chargerConstatTempo,
    chargerCandidatsCaisse, chargerCandidatsStock, chargerCandidatsRappels,
    chargerDerniereReferenceFdj, chargerCarburantsBrief, chargerCandidatsFdj,
    chargerSeuilsCoachEquipeFdj, chargerCandidatsCoachEquipe,
    chargerDomaineEquipe, chargerAlertesInventaireOuvertes, chargerControlesVerifyRestants, chargerMissionsRestantes,
    chargerJournalDecisions,
  };
})(typeof window !== 'undefined' ? window : globalThis);
