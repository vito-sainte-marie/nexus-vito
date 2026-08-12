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
// Inclure après nexus-conseiller.js (et tous les moteurs qu'il utilise) :
// <script src="nexus-brief-donnees.js"></script>
// ------------------------------------------------------------

(function (global) {
  // Pagination générique par lots de 1000 lignes — identique à la version
  // qui existait en local dans NEXUS-Brief-v1.html (et, à l'identique,
  // dans une quinzaine d'autres pages NEXUS non touchées par ce lot ; voir
  // Data Dictionary v2.40 pour la dette résiduelle documentée).
  async function fetchAllRows(builderFactory, pageSize = 1000) {
    let toutes = [];
    let from = 0;
    while (true) {
      const { data, error } = await builderFactory().range(from, from + pageSize - 1);
      if (error) return { data: null, error };
      toutes = toutes.concat(data || []);
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
    return { data: toutes, error: null };
  }

  async function chargerProduitsAppel(client, siteId) {
    const { data, error } = await client.from('produits_appel').select('article').eq('site', siteId);
    if (error) { console.error('Chargement produits d’appel (Brief):', error); return new Set(); }
    return new Set((data || []).map(r => r.article));
  }

  function estProduitAppel(categorie, article) {
    return global.NexusMarge.familleMarge(categorie, article).exclue;
  }

  async function chargerProducts(client, siteId) {
    const [{ data, error }, produitsAppel] = await Promise.all([
      fetchAllRows(() => client.from('products')
        .select('categorie, article, ca, marge, quantite, periode_debut, periode_fin')
        .eq('site', siteId).order('periode_debut', { ascending: false }).order('article', { ascending: true })),
      chargerProduitsAppel(client, siteId),
    ]);
    if (error || !data) { console.error('Chargement products (Brief):', error); return []; }
    return data.filter(r => !produitsAppel.has(r.article));
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
    return { nbEcarts: ecarts.length, gainPotentiel: ecarts.reduce((s, e) => s + e.gainPotentiel, 0), candidatTop };
  }

  async function chargerMessagesAdvisor(client, siteId) {
    const { data, error } = await client
      .from('advisor_messages')
      .select('id, priority, confidence_level, message_text, generated_at, advisor_rules(code, domain, name)')
      .eq('site_id', siteId).not('status', 'in', '(resolu,expire)').order('generated_at', { ascending: false });
    if (error) { console.error('Chargement advisor_messages (Brief):', error); return []; }
    const parRegle = new Map();
    (data || []).forEach(m => {
      const code = (m.advisor_rules && m.advisor_rules.code) || m.id;
      if (!parRegle.has(code)) {
        parRegle.set(code, { id: m.id, priority: m.priority, confidence_level: m.confidence_level, message_text: m.message_text, generated_at: m.generated_at, code, domaine: m.advisor_rules && m.advisor_rules.domain, nomRegle: m.advisor_rules && m.advisor_rules.name });
      }
    });
    return Array.from(parRegle.values());
  }

  function calculerStatutOperations(moyenneEcartAbsolu, nbJours) {
    if (!nbJours) return 'Données insuffisantes';
    return moyenneEcartAbsolu <= global.NexusBoussoleMoteur.SEUIL_ECART_OPERATIONS_EUR ? 'Stable' : 'À surveiller';
  }

  // Constat NEXUS Tempo — le calcul lui-même vit dans
  // NexusTempo.calculerConstatTempo() (centralisé le 11/08/2026, Article
  // 11, source unique partagée avec NEXUS-App-v1.html) ; cette fonction ne
  // fait plus que charger les lignes (glue Supabase) et calculer le statut
  // opérations local, propre à Brief.
  async function chargerConstatTempo(client, siteId) {
    const [{ data, error }, produitsRes] = await Promise.all([
      fetchAllRows(() => client.from('audits_caisse')
        .select('date, quart, vente_piste, vente_boutique, ecart_piste, ecart_boutique, employes_piste, employes_boutique')
        .eq('site', siteId).order('date', { ascending: true })),
      fetchAllRows(() => client.from('products').select('categorie, article, ca, periode_debut, periode_fin').eq('site', siteId)),
    ]);
    if (error || !data) {
      console.error('Chargement audits_caisse (constat Tempo, Brief):', error);
      return { jourARenforcer: null, jourMoteur: null, jourPlusRentable: null, jourProgression: null, totalJours: 0, statutOperations: 'Données insuffisantes', detailOperations: null };
    }
    const constat = global.NexusTempo.calculerConstatTempo(data, (produitsRes && produitsRes.error ? [] : (produitsRes.data || [])), estProduitAppel);
    const statutOperationsVal = calculerStatutOperations(constat.detailOperations, constat.totalJours);
    return { ...constat, statutOperations: statutOperationsVal };
  }

  async function chargerCandidatsCaisse(client, siteId) {
    const { data, error } = await fetchAllRows(() => client.from('v_caisse_ecart_a_traiter').select('*').eq('site', siteId));
    if (error) { console.error('Chargement v_caisse_ecart_a_traiter (Brief):', error); return { raw: [], normalises: [] }; }
    return { raw: data || [], normalises: (data || []).map(global.NexusConseiller.normaliserCaissePersonne) };
  }

  async function chargerCandidatsStock(client, siteId) {
    const { data: releves, error: err1 } = await fetchAllRows(() => client
      .from('stock_releves').select('article, categorie, quantite_theorique, releve_le').eq('site', siteId)
      .order('releve_le', { ascending: true }).order('article', { ascending: true }));
    if (err1 || !releves || !releves.length) { if (err1) console.error('Chargement stock_releves (Brief):', err1); return []; }
    const { data: ventes } = await fetchAllRows(() => client.from('products')
      .select('article, quantite, prix_vente, periode_debut, periode_fin').eq('site', siteId).order('article', { ascending: true }));
    const { data: controles } = await fetchAllRows(() => client.from('controles_stock')
      .select('article, ecart, controle_le').eq('site', siteId).order('controle_le', { ascending: false }).order('article', { ascending: true }));
    const analyse = global.NexusStock.calculerAnalyseStock(releves, ventes, controles);
    const parRayon = global.NexusStock.calculerRisqueParRayon(analyse);
    return parRayon.map(global.NexusConseiller.normaliserStockRayon);
  }

  async function chargerCandidatsRappels(client, siteId) {
    const { data, error } = await fetchAllRows(() => client.from('rappels').select('*').eq('site', siteId).eq('fait', false)
      .order('date_echeance', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }));
    if (error) { console.error('Chargement rappels (Brief):', error); return []; }
    return (data || []).map(global.NexusConseiller.normaliserRappel);
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
    if (pointagesRetard) {
      const totalRetard = pointagesRetard.reduce((s, p) => s + (p.retard_min || 0), 0);
      equipeScore = Math.round(Math.max(0, 100 - totalRetard));
      const retardsParEmploye = {};
      pointagesRetard.forEach(p => { if (p.employee_id) retardsParEmploye[p.employee_id] = (retardsParEmploye[p.employee_id] || 0) + 1; });
      employesASurveiller = Object.values(retardsParEmploye).filter(n => n >= 3).length;
    }
    return { equipeScore, employesASurveiller, totalPointages: totalPointages != null ? totalPointages : null };
  }

  async function chargerAlertesInventaireOuvertes(client, siteId) {
    const { count, error } = await client.from('inventaire_alertes').select('id', { count: 'exact', head: true }).eq('site', siteId).eq('statut', 'ouverte');
    if (error) { console.error('Chargement alertes inventaire (Brief):', error); return null; }
    return count;
  }

  async function chargerControlesVerifyRestants(client, siteId) {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const { data, error } = await client.from('audits_caisse').select('quart').eq('site', siteId).eq('date', aujourdhui);
    if (error) { console.error('Chargement audits_caisse (contrôles restants, Brief):', error); return null; }
    const quartsFaits = new Set((data || []).map(a => a.quart));
    return Math.max(0, 2 - quartsFaits.size);
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

  // Journal des décisions — retourne { journal, validees } plutôt que de
  // modifier un état de page par effet de bord (voir note en tête de
  // fichier). C'est à l'appelant (NEXUS-Brief-v1.html) d'assigner le
  // résultat à ses propres variables JOURNAL_DECISIONS/VALIDEES_SITE.
  async function chargerJournalDecisions(client, siteId) {
    const { data, error } = await fetchAllRows(() => client
      .from('journal_decisions').select('*').eq('site', siteId).order('created_at', { ascending: false }));
    if (error) { console.error('Chargement journal_decisions (Brief):', error); return { journal: [], validees: new Set() }; }
    const journal = data || [];
    return { journal, validees: new Set(journal.map(d => d.candidate_id)) };
  }

  global.NexusBriefDonnees = {
    fetchAllRows,
    chargerProduitsAppel, estProduitAppel, chargerProducts,
    chargerMargePlus, chargerMessagesAdvisor, calculerStatutOperations, chargerConstatTempo,
    chargerCandidatsCaisse, chargerCandidatsStock, chargerCandidatsRappels,
    chargerDerniereReferenceFdj, chargerCarburantsBrief, chargerCandidatsFdj,
    chargerSeuilsCoachEquipeFdj, chargerCandidatsCoachEquipe,
    chargerDomaineEquipe, chargerAlertesInventaireOuvertes, chargerControlesVerifyRestants, chargerMissionsRestantes,
    chargerJournalDecisions,
  };
})(typeof window !== 'undefined' ? window : globalThis);
