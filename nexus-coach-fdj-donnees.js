// NEXUS COACH x FDJ PILOTAGE — chargeurs de données (09/08/2026)
//
// Étape 2 de l'audit "Coach x FDJ Pilotage" (§27 : "Brancher les données
// FDJ Pilotage"). Contrairement à nexus-coach-fdj-moteur.js (pur, aucune
// donnée Supabase), CE fichier est la colle : il assemble l'objet `faits`
// attendu par NexusCoachFdj.evaluerReglesCoach() à partir des tables
// réelles, puis orchestre la génération-ou-récupération idempotente de la
// recommandation du jour. Aucune règle métier n'est décidée ici — chaque
// fonction ne fait que lire/agréger des faits déjà vrais dans la base,
// exactement comme les chargeurs équivalents de NEXUS-Brief-v1.html et
// NEXUS-FDJ-Analyse-v1.html.
//
// Dépend de nexus-fdj-moteur.js (état du stock) et nexus-coach-fdj-moteur.js
// (sélection + formulations) — les inclure AVANT ce fichier :
//   <script src="nexus-fdj-moteur.js"></script>
//   <script src="nexus-coach-fdj-moteur.js"></script>
//   <script src="nexus-coach-fdj-donnees.js"></script>
//
// Limites honnêtes (documentées ici plutôt que cachées) :
//  - "Retard de clôture" (fdj_report_late) n'a PAS d'heure de fin de quart
//    théorique stockée dans NEXUS aujourd'hui. Le proxy retenu est donc
//    grossier mais vérifiable : un quart clôturé un autre jour calendaire
//    que sa date de service est considéré "en retard" (clotureRetardMin=1),
//    sinon 0. Ce n'est pas un nombre de minutes réel malgré le nom du
//    champ (hérité du contrat de nexus-coach-fdj-moteur.js) — seulement un
//    indicateur binaire. Si NEXUS ajoute un jour une heure de fin de quart
//    planifiée, cette fonction devra être la SEULE à changer.
//  - Toutes les fenêtres "récentes" sont plafonnées (voir DEPUIS_JOURS_*)
//    pour rester des faits réellement récents, pas un historique complet
//    qui grossirait indéfiniment — plafonds documentés ligne par ligne.
// ------------------------------------------------------------

(function (global) {
  const DEPUIS_JOURS_ALERTES = 14;
  const DEPUIS_JOURS_QUARTS = 60;
  const DEPUIS_JOURS_STATS = 90;
  const DEPUIS_JOURS_ROTATION = 30;

  function isoDepuis(jours) {
    const d = new Date();
    d.setDate(d.getDate() - jours);
    return d.toISOString().slice(0, 10);
  }

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

  // ------------------------------------------------------------
  // CHARGEURS UNITAIRES
  // ------------------------------------------------------------

  async function chargerJeuxCoach(client, site) {
    const { data, error } = await client.from('fdj_games').select('id, nom, prix').eq('site', site).eq('actif', true);
    if (error) { console.error('Coach FDJ — chargement jeux:', error); return []; }
    return data || [];
  }

  async function chargerEmplacementsCoach(client, site) {
    const { data, error } = await client.from('fdj_locations').select('id, type').eq('site', site).eq('actif', true);
    if (error) { console.error('Coach FDJ — chargement emplacements:', error); return {}; }
    const locations = {};
    (data || []).forEach(e => { locations[e.type] = e.id; });
    return locations;
  }

  async function chargerReferenceCoach(client, site) {
    const { data, error } = await client.from('fdj_stock_references').select('*').eq('site', site).eq('statut', 'valide')
      .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) { console.error('Coach FDJ — chargement référence stock:', error); return null; }
    if (!data) return null;
    const { data: lignes, error: e2 } = await client.from('fdj_stock_reference_lignes').select('game_id, bureau_reel, caisse_reel').eq('reference_id', data.id);
    if (e2) { console.error('Coach FDJ — chargement lignes référence stock:', e2); return null; }
    const map = {};
    (lignes || []).forEach(l => { map[l.game_id] = { bureau: l.bureau_reel, caisse: l.caisse_reel }; });
    return { creeLe: data.created_at, lignes: map };
  }

  // État du stock du site — même mouvements/référence que Brief et
  // FDJ-Analyse, jamais recalculés différemment (Article 11).
  async function chargerSoldesCoach(client, site) {
    const [locations, reference, { data: mouvements, error }] = await Promise.all([
      chargerEmplacementsCoach(client, site),
      chargerReferenceCoach(client, site),
      client.from('fdj_stock_movements').select('type_mouvement, quantite, game_id, location_source_id, location_destination_id, created_at').eq('site', site),
    ]);
    if (error) { console.error('Coach FDJ — chargement mouvements stock:', error); return {}; }
    return global.NexusFdjMoteur.soldesCarnetsAvecReference(mouvements || [], locations, reference);
  }

  // Tier 1 — alertes "activation sans carnet confié" non encore vues par
  // le manager (même sémantique que le panneau Alertes de
  // NEXUS-FDJ-Manager-v1.html : `vue=false`), plafonnées à 14 jours pour
  // ne pas faire remonter indéfiniment une alerte oubliée.
  async function chargerAlertesActivationRecentes(client, site, employeeId) {
    const { data, error } = await client.from('fdj_alertes').select('id, created_at, game_id')
      .eq('site', site).eq('type', 'activation_sans_carnet_confie').eq('employee_id', employeeId)
      .eq('vue', false).gte('created_at', isoDepuis(DEPUIS_JOURS_ALERTES) + 'T00:00:00');
    if (error) { console.error('Coach FDJ — chargement alertes activation:', error); return []; }
    return data || [];
  }

  // Tier 2 — quarts PASSÉS (pas celui d'aujourd'hui, encore légitimement
  // ouvert) restés en 'brouillon', jamais clôturés.
  async function chargerShiftsIncomplets(client, site, employeeId, aujourdHui) {
    const { data, error } = await client.from('fdj_shifts').select('id, date, quart, statut')
      .eq('site', site).eq('employee_id', employeeId).eq('statut', 'brouillon').lt('date', aujourdHui);
    if (error) { console.error('Coach FDJ — chargement quarts incomplets:', error); return []; }
    return data || [];
  }

  // Tier 2 — quarts clôturés récents avec proxy de retard (voir note en
  // tête de fichier : indicateur binaire, pas des minutes réelles).
  async function chargerShiftsRecentsAvecCloture(client, site, employeeId) {
    const { data, error } = await client.from('fdj_shifts').select('id, date, quart, statut, valide_le')
      .eq('site', site).eq('employee_id', employeeId).eq('statut', 'valide').gte('date', isoDepuis(DEPUIS_JOURS_QUARTS));
    if (error) { console.error('Coach FDJ — chargement quarts récents:', error); return []; }
    return (data || []).map(s => ({
      ...s,
      clotureRetardMin: s.valide_le ? (new Date(s.valide_le).toISOString().slice(0, 10) > s.date ? 1 : 0) : null,
    }));
  }

  // Tier 2 — corrections de comptage récentes de l'employé, et taille de
  // l'échantillon de quarts clôturés sur la même fenêtre.
  async function chargerCorrectionsEtHistorique(client, site, employeeId) {
    const [{ data: corrections, error: e1 }, { data: shifts, error: e2 }] = await Promise.all([
      client.from('fdj_stock_movements').select('shift_id, created_at').eq('site', site).eq('employee_id', employeeId)
        .eq('type_mouvement', 'correction').gte('created_at', isoDepuis(DEPUIS_JOURS_QUARTS) + 'T00:00:00'),
      client.from('fdj_shifts').select('id').eq('site', site).eq('employee_id', employeeId).eq('statut', 'valide').gte('date', isoDepuis(DEPUIS_JOURS_QUARTS)),
    ]);
    if (e1) console.error('Coach FDJ — chargement corrections:', e1);
    if (e2) console.error('Coach FDJ — chargement historique quarts:', e2);
    return { correctionsRecentes: corrections || [], nbShiftsHistorique: (shifts || []).length };
  }

  // Tier 4 — conformité de l'employé sur la fenêtre récente, via la vue
  // Phase B déjà validée (view_fdj_employee_daily) — jamais recalculée.
  async function chargerConformiteEmploye(client, site, employeeId) {
    const { data, error } = await client.from('view_fdj_employee_daily').select('nb_quarts_controles, nb_quarts_conformes')
      .eq('site', site).eq('employee_id', employeeId).gte('date', isoDepuis(DEPUIS_JOURS_STATS));
    if (error) { console.error('Coach FDJ — chargement conformité employé:', error); return { tauxConformiteEmploye: null, nbQuartsControles: 0 }; }
    const nbQuartsControles = (data || []).reduce((s, l) => s + (Number(l.nb_quarts_controles) || 0), 0);
    const nbQuartsConformes = (data || []).reduce((s, l) => s + (Number(l.nb_quarts_conformes) || 0), 0);
    return { tauxConformiteEmploye: nbQuartsControles > 0 ? nbQuartsConformes / nbQuartsControles : null, nbQuartsControles };
  }

  // Tier 5 — répartition par palier de l'employé vs celle du site, via la
  // nouvelle vue view_fdj_employee_price_tier_daily (Coach x FDJ Pilotage,
  // étape "brancher les données") et la vue Phase B existante côté site.
  async function chargerPalierEmployeSite(client, site, employeeId) {
    const depuis = isoDepuis(DEPUIS_JOURS_STATS);
    const [{ data: empRows, error: e1 }, { data: siteRows, error: e2 }] = await Promise.all([
      client.from('view_fdj_employee_price_tier_daily').select('palier, tickets_vendus, ca').eq('site', site).eq('employee_id', employeeId).gte('date', depuis),
      client.from('view_fdj_price_tier_daily').select('palier, tickets_vendus, ca').eq('site', site).gte('date', depuis),
    ]);
    if (e1) console.error('Coach FDJ — chargement palier employé:', e1);
    if (e2) console.error('Coach FDJ — chargement palier site:', e2);
    const sommerPart = (lignes) => {
      const parPalier = {};
      let total = 0;
      (lignes || []).forEach(l => { const ca = Number(l.ca) || 0; parPalier[l.palier] = (parPalier[l.palier] || 0) + ca; total += ca; });
      const part = {};
      Object.keys(parPalier).forEach(p => { part[p] = total > 0 ? parPalier[p] / total : 0; });
      return { part, total };
    };
    const emp = sommerPart(empRows);
    const site_ = sommerPart(siteRows);
    const nbVentesEmploye = (empRows || []).reduce((s, l) => s + (Number(l.tickets_vendus) || 0), 0);
    return { partPalierEmploye: emp.part, partPalierSite: site_.part, nbVentesEmploye };
  }

  // Tier 5 — performance de l'employé par jour de semaine, via la vue
  // Phase B existante (view_fdj_employee_daily), regroupée côté client par
  // jour de semaine (agrégation simple, aucune formule métier nouvelle).
  async function chargerPerformanceJourEmploye(client, site, employeeId) {
    const { data, error } = await client.from('view_fdj_employee_daily').select('date, ca_grattage, nb_quarts_controles')
      .eq('site', site).eq('employee_id', employeeId).gte('date', isoDepuis(DEPUIS_JOURS_STATS));
    if (error) { console.error('Coach FDJ — chargement performance par jour:', error); return { performanceJourEmploye: {}, moyenneGeneraleEmploye: null }; }
    const lignesExploitables = (data || []).filter(l => l.ca_grattage !== null && Number(l.nb_quarts_controles) > 0);
    const parJour = {};
    let totalCa = 0;
    lignesExploitables.forEach(l => {
      const jour = new Date(l.date + 'T00:00:00').getDay();
      if (!parJour[jour]) parJour[jour] = { sommeCa: 0, nbOcc: 0 };
      parJour[jour].sommeCa += Number(l.ca_grattage);
      parJour[jour].nbOcc += 1;
      totalCa += Number(l.ca_grattage);
    });
    const performanceJourEmploye = {};
    Object.keys(parJour).forEach(j => { performanceJourEmploye[j] = { moyenneCa: parJour[j].sommeCa / parJour[j].nbOcc, nbOcc: parJour[j].nbOcc }; });
    return { performanceJourEmploye, moyenneGeneraleEmploye: lignesExploitables.length ? totalCa / lignesExploitables.length : null };
  }

  // Tier 5 — "jour fort" mesuré au niveau du SITE (échantillon plus large
  // et plus fiable que celui d'un seul employé), réutilise
  // NexusCoachFdj.evaluerJour() : une seule définition de "jour fort".
  async function chargerJourFortSite(client, site, jourSemaineActuel) {
    const { data, error } = await client.from('view_fdj_daily_summary').select('date, ca_grattage, nb_quarts_controles')
      .eq('site', site).gte('date', isoDepuis(DEPUIS_JOURS_STATS));
    if (error) { console.error('Coach FDJ — chargement jour fort site:', error); return false; }
    const lignesExploitables = (data || []).filter(l => l.ca_grattage !== null && Number(l.nb_quarts_controles) > 0);
    if (!lignesExploitables.length) return false;
    const parJour = {};
    let totalCa = 0;
    lignesExploitables.forEach(l => {
      const jour = new Date(l.date + 'T00:00:00').getDay();
      if (!parJour[jour]) parJour[jour] = { sommeCa: 0, nbOcc: 0 };
      parJour[jour].sommeCa += Number(l.ca_grattage);
      parJour[jour].nbOcc += 1;
      totalCa += Number(l.ca_grattage);
    });
    const moyenneGenerale = totalCa / lignesExploitables.length;
    const perf = parJour[jourSemaineActuel] ? { moyenneCa: parJour[jourSemaineActuel].sommeCa / parJour[jourSemaineActuel].nbOcc, nbOcc: parJour[jourSemaineActuel].nbOcc } : null;
    const ev = global.NexusCoachFdj.evaluerJour(perf, moyenneGenerale, 8);
    return !!(ev.suffisant && ev.fort);
  }

  // Le stock du plus petit palier est "sain" si aucun des jeux à ce prix
  // minimal n'est en rupture (nonActives<=0 ET bureau<=0) — même seuil que
  // detecterStockRuptureRisk, pas un nouveau (Article 11).
  function determinerPalierBasSain(jeux, soldes) {
    if (!jeux.length) return false;
    const prixMin = Math.min(...jeux.map(j => Number(j.prix)));
    const jeuxPrixMin = jeux.filter(j => Number(j.prix) === prixMin);
    return !jeuxPrixMin.some(j => { const s = soldes[j.id]; return s && s.nonActives <= 0 && s.bureau <= 0; });
  }

  // ------------------------------------------------------------
  // ASSEMBLAGE — construit l'objet `faits` complet attendu par
  // NexusCoachFdj.evaluerReglesCoach().
  // ------------------------------------------------------------
  async function assemblerFaits(client, site, employeeId, aujourdHui) {
    const jourSemaineActuel = new Date(aujourdHui + 'T00:00:00').getDay();
    const [
      jeux, soldes, alertesActivationRecentes, shiftsIncomplets, shiftsRecents,
      correctionsEtHistorique, conformite, palier, performanceJour,
    ] = await Promise.all([
      chargerJeuxCoach(client, site),
      chargerSoldesCoach(client, site),
      chargerAlertesActivationRecentes(client, site, employeeId),
      chargerShiftsIncomplets(client, site, employeeId, aujourdHui),
      chargerShiftsRecentsAvecCloture(client, site, employeeId),
      chargerCorrectionsEtHistorique(client, site, employeeId),
      chargerConformiteEmploye(client, site, employeeId),
      chargerPalierEmployeSite(client, site, employeeId),
      chargerPerformanceJourEmploye(client, site, employeeId),
    ]);
    const jourFortSite = await chargerJourFortSite(client, site, jourSemaineActuel);
    const palierBasSain = determinerPalierBasSain(jeux, soldes);
    return {
      jeux, soldes,
      alertesActivationRecentes, shiftsIncomplets, shiftsRecents,
      correctionsRecentes: correctionsEtHistorique.correctionsRecentes, nbShiftsHistorique: correctionsEtHistorique.nbShiftsHistorique,
      tauxConformiteEmploye: conformite.tauxConformiteEmploye, nbQuartsControles: conformite.nbQuartsControles,
      partPalierEmploye: palier.partPalierEmploye, partPalierSite: palier.partPalierSite, nbVentesEmploye: palier.nbVentesEmploye,
      jourSemaineActuel, performanceJourEmploye: performanceJour.performanceJourEmploye, moyenneGeneraleEmploye: performanceJour.moyenneGeneraleEmploye,
      jourFortSite, palierBasSain,
    };
  }

  async function chargerReglesActives(client, site) {
    const { data, error } = await client.from('coach_rules').select('*').eq('site', site).eq('active', true);
    if (error) { console.error('Coach FDJ — chargement règles:', error); return {}; }
    const parId = {};
    (data || []).forEach(r => { parId[r.rule_id] = r; });
    return parId;
  }

  async function chargerRotationRecente(client, site, employeeId) {
    const { data, error } = await client.from('coach_daily_recommendations').select('rule_id, date')
      .eq('site', site).eq('employee_id', employeeId).gte('date', isoDepuis(DEPUIS_JOURS_ROTATION));
    if (error) { console.error('Coach FDJ — chargement rotation récente:', error); return []; }
    return data || [];
  }

  // ------------------------------------------------------------
  // ORCHESTRATION — idempotente : si une recommandation existe déjà pour
  // cet employé aujourd'hui, elle est retournée telle quelle (§3 de
  // l'audit : "le conseil reste stable pendant la journée"), jamais
  // recalculée. Sinon, génère puis persiste.
  // ------------------------------------------------------------
  async function obtenirRecommandationDuJour(client, site, employeeId, aujourdHuiOverride) {
    const aujourdHui = aujourdHuiOverride || new Date().toISOString().slice(0, 10);

    const { data: existante, error: eExistante } = await client.from('coach_daily_recommendations').select('*')
      .eq('site', site).eq('employee_id', employeeId).eq('date', aujourdHui).maybeSingle();
    if (eExistante) { console.error('Coach FDJ — vérification recommandation existante:', eExistante); return null; }
    if (existante) return existante;

    const [regles, rotationRecente, faits] = await Promise.all([
      chargerReglesActives(client, site),
      chargerRotationRecente(client, site, employeeId),
      assemblerFaits(client, site, employeeId, aujourdHui),
    ]);

    const candidats = global.NexusCoachFdj.evaluerReglesCoach(faits, regles);
    const selection = global.NexusCoachFdj.selectionnerRecommandationCoach(candidats, regles, { aujourdHui, rotationRecente });
    const reco = global.NexusCoachFdj.construireRecommandation(selection, employeeId, aujourdHui);

    const ligne = {
      site, employee_id: employeeId, date: aujourdHui, domain: 'fdj',
      rule_id: reco.rule_id, priority: reco.priority || (regles[reco.rule_id] ? regles[reco.rule_id].priority : 6),
      message: reco.message, reason: reco.reason,
      confidence: reco.confidence || 'Élevée', // coach_daily_recommendations.confidence est NOT NULL — le conseil général (confidence=null côté moteur) est ici documenté comme 'Élevée' : la fiabilité du repli lui-même (savoir qu'aucune règle personnalisée n'était fiable) est certaine, même si le conseil n'est pas personnalisé.
      evidence_json: reco.evidence_json,
    };
    const { data: inseree, error: eInsert } = await client.from('coach_daily_recommendations').insert(ligne).select().maybeSingle();
    if (eInsert) {
      // Conflit probable (23505, unique site/employee_id/date) : un autre
      // appel concurrent a déjà inséré la recommandation du jour —
      // relire plutôt qu'échouer.
      const { data: relue, error: eRelue } = await client.from('coach_daily_recommendations').select('*')
        .eq('site', site).eq('employee_id', employeeId).eq('date', aujourdHui).maybeSingle();
      if (eRelue || !relue) { console.error('Coach FDJ — insertion recommandation:', eInsert); return null; }
      return relue;
    }
    return inseree;
  }

  global.NexusCoachFdjDonnees = {
    chargerJeuxCoach, chargerEmplacementsCoach, chargerReferenceCoach, chargerSoldesCoach,
    chargerAlertesActivationRecentes, chargerShiftsIncomplets, chargerShiftsRecentsAvecCloture,
    chargerCorrectionsEtHistorique, chargerConformiteEmploye, chargerPalierEmployeSite,
    chargerPerformanceJourEmploye, chargerJourFortSite, determinerPalierBasSain,
    assemblerFaits, chargerReglesActives, chargerRotationRecente, obtenirRecommandationDuJour,
  };
})(typeof window !== 'undefined' ? window : globalThis);
