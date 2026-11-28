// ============================================================
// NEXUS APP (accueil) — colle Supabase (11/08/2026)
//
// Refactoring des pages monolithiques, 3e page traitée après Brief et
// Cockpit : NEXUS-App-v1.html (2586 lignes, la plus grosse des 5 pages
// ciblées par l'audit). Les chargeurs qui étaient de véritables doublons
// avec Brief (fetchAllRowsHome, chargerConstatTempoHome,
// chargerMessagesAdvisorHome, chargerControlesVerifyHome, estProduitAppelHome)
// sont partis directement dans nexus-conseiller-donnees.js — ce fichier ne
// garde que ce qui reste propre à l'accueil : construction du résumé
// "Votre entreprise aujourd'hui" (candidats produits condensés, domaine
// Équipe façon Radar, statut Carburants du jour, alertes FDJ non vues) et
// Nexus Marge+ (voir écart documenté ci-dessous, Data Dictionary v2.42).
//
// AUCUN calcul métier ici (Article 11) : chaque fonction charge des lignes
// brutes et délègue aux moteurs déjà partagés (NexusConseiller, NexusIndice,
// NexusMarge, NexusPeriodes, NexusCarburantDonnees/Moteur).
//
// Convention : chaque fonction reçoit `client` et `siteId` explicitement.
//
// ÉCART DE COMPORTEMENT REPÉRÉ ET NON RÉSOLU (Article 5 — transparence
// avant unification forcée) : chargerMargePlusHome() construit un
// `candidatTop` avec un champ `contexte` ("Comparaison faite uniquement
// entre produits économiquement comparables.") que NEXUS-Brief-v1.html
// (nexus-brief-donnees.js::chargerMargePlus) n'a jamais eu. Les deux
// fonctions ont donc divergé avant ce refactoring, sans que personne ne
// l'ait remarqué — exactement le risque que l'audit "philosophie/
// architecture" signale. Ce lot NE les unifie PAS : imposer un même
// candidatTop aux deux pages changerait ce que l'une ou l'autre affiche
// aujourd'hui, ce que Frédéric a explicitement exclu ("ne pas changer les
// calculs validés"). chargerMargePlusHome() reste donc une fonction
// séparée, avec son `contexte` préservé tel quel — à trancher séparément
// si Frédéric confirme vouloir harmoniser les deux affichages.
//
// Inclure après nexus-conseiller.js ET nexus-conseiller-donnees.js :
// <script src="nexus-conseiller-donnees.js?v=20260904-0104"></script>
// <script src="nexus-app-donnees.js?v=20260904-0104"></script>
// ------------------------------------------------------------

(function (global) {
  // Candidats Produits condensés pour "Votre entreprise aujourd'hui" —
  // mêmes lignes que Brief/Cockpit (NexusConseillerDonnees.chargerProduitsBrut),
  // puis facteurs (NexusIndice) et candidats (NexusConseiller) propres à
  // l'accueil.
  async function calculerCandidatsHome(client, siteId, role) {
    const rowsBrut = await global.NexusConseillerDonnees.chargerProduitsBrut(client, siteId);
    if (!rowsBrut.length) { console.error('Chargement products (accueil) : aucune ligne exploitable.'); return { candidats: [], facteurs: null, cibleRes: null }; }
    // Fuseau du site : fraîcheur de la paire mesurée dans le jour de la station.
    const fuseau = (typeof nexusFuseauSite === 'function') ? await nexusFuseauSite(siteId) : null;
    // A4-1 : cible de marge du site (une seule lecture partagée), jamais écrite en dur.
    const cibleRes = await global.NexusCibleMarge.charger(client, siteId, role).then(() => global.NexusCibleMarge.nonEvalue());
    const facteurs = global.NexusIndice.calculerFacteurs(rowsBrut, { fuseau, cibleMarge: global.NexusCibleMarge.cibleNotante(cibleRes) });
    const candidats = global.NexusConseiller.calculerCandidatsProduits(rowsBrut, { fuseau }).map(global.NexusConseiller.normaliserProduit);
    return { candidats, facteurs, cibleRes };
  }

  // Décisions déjà validées du site — juste les candidate_id (pas la ligne
  // complète comme chargerJournalDecisions, l'accueil n'affiche pas de
  // journal, seulement un filtre).
  async function chargerValideesHome(client, siteId) {
    const { data, error } = await client.from('journal_decisions').select('candidate_id').eq('site', siteId);
    if (error) { console.error('Chargement journal_decisions (accueil):', error); return new Set(); }
    return new Set((data || []).map(d => d.candidate_id));
  }

  // Domaine Équipe pour "Votre entreprise aujourd'hui" — mêmes formules que
  // NEXUS-Radar-Manager-v1.html (Équipe via retards de pointage,
  // Développement via points de missions). Lot A2 : siteId OBLIGATOIRE (lève sans lui),
  // filtre mission_completions.site_id et pointages.site.
  async function chargerDomainesRadarHome(client, siteId) {
    global.NexusSiteRequis.exiger(siteId, 'chargerDomainesRadarHome');
    // Lot A4-4 : la règle de ponctualité vit dans nexus-ponctualite.js
    // (30 jours glissants depuis le jour de la station, dénominateur = arrivées
    // mesurées). Plus de comptage maison ici.
    const P = global.NexusPonctualite;
    const jour = await global.nexusAujourdhuiStation(siteId);
    const fen = P && jour ? P.fenetre(jour) : null;
    const [{ data: completions, error: e1 }, ptsRes] = await Promise.all([
      client.from('mission_completions').select('points').eq('site_id', siteId),
      fen ? P.charger(client, siteId, fen.debut, fen.fin) : Promise.resolve({ error: new Error('Jour de la station ou NexusPonctualite indisponible'), data: null }),
    ]);
    if (e1) console.error('Chargement mission_completions (accueil):', e1);
    if (ptsRes.error) console.error('Chargement pointages (accueil):', ptsRes.error);
    let devScore = null;
    if (completions && completions.length) {
      const points = completions.reduce((s, c) => s + (c.points || 0), 0);
      devScore = Math.round(Math.max(0, points) / (completions.length * 12) * 100);
    }
    let equipeScore = null;
    let nbRetards = 0;
    let employesASurveiller = null;
    let tauxAnomalies = null;
    let totalPointages = null;
    if (ptsRes.data) {
      const r = P.tauxPonctualite(ptsRes.data, fen);
      nbRetards = r.nbRetards;
      tauxAnomalies = r.tauxAnomalies;
      // Décision du gérant (27/11/2026) : aucun score d'équipe ni liste de
      // collaborateurs « à surveiller » tirés du pointage au premier niveau.
      // equipeScore et employesASurveiller restent null ; les faits mesurés
      // (taux, nombre de pointages) sont conservés.
      totalPointages = r.nbMesures;
    }
    return { devScore, equipeScore, nbRetards, employesASurveiller, tauxAnomalies, totalPointages };
  }

  // Axe Carburants pour "Votre entreprise aujourd'hui".
  //
  // Correctif "règle anti-divergence" (23/08/2026, audit "Anti-dégradation
  // temporelle" §7 — v2.224) : le commentaire ci-dessus affirmait depuis
  // l'origine réutiliser "TEL QUEL" le même calcul que Brief, mais c'est
  // devenu FAUX en silence à partir de la v2.214 (fallback temporel
  // "dernier état fiable") : Brief est passé par `chargerCarburantsBriefAvecFallback`
  // (qui fige la Maîtrise sur le dernier jour fiable tant qu'aujourd'hui
  // est incomplet) alors que cette fonction continuait d'appeler
  // `chargerControleJour` directement sur AUJOURD'HUI SEUL — sans jamais
  // être mise à jour en même temps. Résultat concret exactement décrit par
  // l'audit (§7, "règle anti-divergence") : si Brief affichait Carburants
  // en mode "fallback" (badge "Mis à jour hier", score du dernier jour
  // fiable), "Votre entreprise aujourd'hui" (NEXUS-App-v1.html) pouvait
  // afficher un statut DIFFÉRENT pour le même secteur, au même instant,
  // simplement parce qu'aujourd'hui n'était pas encore complet — la
  // dégradation artificielle que tout ce chantier cherche à éliminer,
  // réapparue par une deuxième porte non mise à jour.
  //
  // Corrigé en délégant à `NexusBriefDonnees.chargerCarburantsBriefAvecFallback`
  // (Article 11 — une seule vérité, cette fois vraiment tenue à jour) :
  // `parCarburant`/`aucunReleve` viennent désormais du même `controle`
  // fallback-aware que Brief, donc `statutGlobalControle`/`texteControleJour`
  // (strictement inchangées) produisent nécessairement le même résultat
  // que Brief au même instant. `fraicheur` est retournée en plus (champ
  // additif, non consommé par `renderEntrepriseAujourdhui` aujourd'hui,
  // disponible si un badge de fraîcheur devait être ajouté à cette carte
  // plus tard).
  // P0-1 (20/09/2026, lot NEXUS-CONTINUITE-TERRAIN-1-20260920) : `timezone`
  // traversait cette fonction sans jamais servir à calculer `aujourdhui`,
  // qui restait daté en UTC (`new Date().toISOString()`). America/Martinique
  // est UTC-4 : dès 20 h locale, en plein service du soir, cette date UTC
  // pointait déjà sur demain, et l'Accueil affichait "à jour" un statut
  // Carburants qui ne l'était pas. `NexusStation.dateLocaleStation` est la
  // même primitive que Prise de poste/Inventaire/FDJ (Article 11, jamais un
  // second calcul de date) ; fuseau non résolu -> repli UTC identique à
  // avant, pour ne jamais bloquer l'Accueil sur une configuration absente.
  async function chargerStatutCarburantsHome(client, siteId, timezone) {
    const aujourdhui = await nexusAujourdhuiStation(siteId);   // jour de la station ; indéterminé => rien à dater, jamais l'UTC
    if (!aujourdhui) {
      console.error('Statut carburants : fuseau de la station indéterminé.');
      return { statut: null, detail: null, parCarburant: {}, aucunReleve: null, fraicheur: null, indetermine: true };
    }
    const carburants = await global.NexusBriefDonnees.chargerCarburantsBriefAvecFallback(client, siteId, aujourdhui, timezone);
    const { parCarburant, aucunReleve } = carburants.controle;
    const statut = global.NexusCarburantMoteur.statutGlobalControle(aucunReleve ? null : parCarburant);
    const detail = global.NexusCarburantMoteur.texteControleJour(parCarburant, aucunReleve);
    return { statut, detail, parCarburant, aucunReleve, fraicheur: carburants.fraicheur };
  }

  // Axe FDJ pour "Votre entreprise aujourd'hui" — réutilise le même signal
  // que le point rouge de la sidebar (fdj_alertes non vues, voir
  // nexus-desktop.js/nexusVerifierAlertesFdj) — jamais un second calcul.
  async function chargerAlertesFdjNonVuesHome(client, siteId) {
    const { count, error } = await client.from('fdj_alertes')
      .select('id', { count: 'exact', head: true }).eq('site', siteId).eq('vue', false).eq('resolue_automatiquement', false);
    if (error) { console.error('Chargement alertes FDJ non vues (accueil):', error); return null; }
    return count;
  }

  // Nexus Marge+ — voir l'écart de comportement documenté en tête de
  // fichier (champ `contexte`, absent côté Brief) : PAS unifié avec
  // NexusBriefDonnees.chargerMargePlus dans ce lot, volontairement.
  async function chargerMargePlusHome(client, siteId) {
    const [{ data, error }, produitsAppelRes, exclusionsRes, valideesRes] = await Promise.all([
      global.NexusConseillerDonnees.fetchAllRows(() => client.from('products')
        .select('categorie, article, ca, marge, periode_debut, periode_fin')
        .eq('site', siteId).order('periode_debut', { ascending: false }).order('article', { ascending: true })),
      client.from('produits_appel').select('article').eq('site', siteId),
      client.from('marge_exceptions').select('article').eq('site', siteId),
      client.from('journal_decisions').select('candidate_id, rule_id, periode_reference_debut, periode_reference_fin').eq('site', siteId).eq('rule_id', 'R5-MARGE-ECART'),
    ]);
    if (error || !data || !data.length) { console.error('Chargement products (marge accueil):', error); return null; }

    const produitsAppel = new Set(((produitsAppelRes && produitsAppelRes.data) || []).map(r => r.article));
    const rowsBrut = data.filter(r => !produitsAppel.has(r.article));
    const { periodeAffichage, rowsAffichage } = global.NexusPeriodes.analyserPeriodes(rowsBrut);
    if (!periodeAffichage) return null;

    const exclusionsManuelles = new Set(((exclusionsRes && exclusionsRes.data) || []).map(r => r.article));
    const ecarts = global.NexusMarge.ecartsMargeDeLaPeriode(rowsAffichage, {
      periode: periodeAffichage, produitsAppel, exclusionsManuelles,
      decisions: (valideesRes && valideesRes.data) || [],
    }).filter(e => !e.validee);

    const meilleur = ecarts[0];
    const candidatTop = meilleur ? {
      candidate_id: meilleur.candidate_id, etat: '💡 RECOMMANDATION',
      article: meilleur.article, categorie: meilleur.categorie, impact_eur: meilleur.gainPotentiel,
      situation: `${meilleur.article} a une marge de ${meilleur.margePct.toFixed(1)} %, contre ${meilleur.medianeGroupe.toFixed(1)} % pour les ${meilleur.tailleGroupe} produits comparables du même type.`,
      contexte: `Comparaison faite uniquement entre produits économiquement comparables.`,
      analyse: `Cet écart peut venir d'un prix d'achat renégocié, d'une remise non répercutée, ou d'un choix délibéré — à vérifier avant d'ajuster quoi que ce soit.`,
      recommandation: `Vérifiez si le prix d'achat ou de vente de ${meilleur.article} peut se rapprocher de la marge médiane de son groupe.`,
      impact: `Si aligné sur la médiane du groupe, gain potentiel estimé à environ ${Math.round(meilleur.gainPotentiel).toLocaleString('fr-FR')} € sur cette période — une hypothèse, pas une garantie.`,
      ca_reference: meilleur.ca, periode_reference_debut: periodeAffichage.debut, periode_reference_fin: periodeAffichage.fin,
    } : null;

    return { nbEcarts: ecarts.length, gainPotentiel: ecarts.reduce((s, e) => s + e.gainPotentiel, 0), candidatTop };
  }

  global.NexusAppDonnees = {
    calculerCandidatsHome, chargerValideesHome, chargerDomainesRadarHome,
    chargerStatutCarburantsHome, chargerAlertesFdjNonVuesHome, chargerMargePlusHome,
  };
})(typeof window !== 'undefined' ? window : globalThis);
