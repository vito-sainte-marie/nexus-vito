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
// <script src="nexus-conseiller-donnees.js?v=20260903-1143"></script>
// <script src="nexus-app-donnees.js?v=20260903-1143"></script>
// ------------------------------------------------------------

(function (global) {
  // Candidats Produits condensés pour "Votre entreprise aujourd'hui" —
  // mêmes lignes que Brief/Cockpit (NexusConseillerDonnees.chargerProduitsBrut),
  // puis facteurs (NexusIndice) et candidats (NexusConseiller) propres à
  // l'accueil.
  async function calculerCandidatsHome(client, siteId) {
    const rowsBrut = await global.NexusConseillerDonnees.chargerProduitsBrut(client, siteId);
    if (!rowsBrut.length) { console.error('Chargement products (accueil) : aucune ligne exploitable.'); return { candidats: [], facteurs: null }; }
    const facteurs = global.NexusIndice.calculerFacteurs(rowsBrut);
    const candidats = global.NexusConseiller.calculerCandidatsProduits(rowsBrut).map(global.NexusConseiller.normaliserProduit);
    return { candidats, facteurs };
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
  // Développement via points de missions). N'ACCEPTE PAS siteId : reprise
  // à l'identique du comportement existant (aucun filtre site sur
  // mission_completions/pointages ici, comme sur chargerDomaineEquipe côté
  // Brief — même anomalie préexistante, signalée là aussi, non corrigée
  // dans ce lot, Article 5).
  async function chargerDomainesRadarHome(client) {
    const [{ data: completions, error: e1 }, { data: pointagesRetard, error: e2 }, { count: totalPointages, error: e3 }] = await Promise.all([
      client.from('mission_completions').select('points'),
      client.from('pointages').select('employee_id, retard_min').eq('type', 'arrivee').gt('retard_min', 0),
      client.from('pointages').select('id', { count: 'exact', head: true }).eq('type', 'arrivee'),
    ]);
    if (e1) console.error('Chargement mission_completions (accueil):', e1);
    if (e2) console.error('Chargement pointages (accueil):', e2);
    if (e3) console.error('Chargement total pointages (accueil):', e3);
    let devScore = null;
    if (completions && completions.length) {
      const points = completions.reduce((s, c) => s + (c.points || 0), 0);
      devScore = Math.round(Math.max(0, points) / (completions.length * 12) * 100);
    }
    let equipeScore = null;
    let nbRetards = 0;
    let employesASurveiller = null;
    let tauxAnomalies = null;
    // Barème corrigé (22/08/2026, même correctif que chargerDomaineEquipe()
    // dans nexus-brief-donnees.js — voir le commentaire détaillé là-bas,
    // Article 11 : un même bug ne doit jamais être corrigé à un seul
    // endroit) : `100 - totalRetard` sommait des minutes de retard sans
    // rapport avec l'échelle 0-100 ; remplacé par le TAUX d'anomalies
    // (nbRetards / totalPointages), même pente ×200 que Brief.
    if (pointagesRetard) {
      nbRetards = pointagesRetard.length;
      tauxAnomalies = totalPointages ? nbRetards / totalPointages : (nbRetards > 0 ? 1 : null);
      equipeScore = tauxAnomalies == null ? null : Math.round(Math.max(0, 100 - tauxAnomalies * 200));
      const retardsParEmploye = {};
      pointagesRetard.forEach(p => {
        if (!p.employee_id) return;
        retardsParEmploye[p.employee_id] = (retardsParEmploye[p.employee_id] || 0) + 1;
      });
      employesASurveiller = Object.values(retardsParEmploye).filter(n => n >= 3).length;
    }
    return { devScore, equipeScore, nbRetards, employesASurveiller, tauxAnomalies, totalPointages: totalPointages != null ? totalPointages : null };
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
  async function chargerStatutCarburantsHome(client, siteId) {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const carburants = await global.NexusBriefDonnees.chargerCarburantsBriefAvecFallback(client, siteId, aujourdhui);
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
      .select('id', { count: 'exact', head: true }).eq('site', siteId).eq('vue', false);
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
      client.from('journal_decisions').select('candidate_id').eq('site', siteId).eq('rule_id', 'R5-MARGE-ECART'),
    ]);
    if (error || !data || !data.length) { console.error('Chargement products (marge accueil):', error); return null; }

    const produitsAppel = new Set(((produitsAppelRes && produitsAppelRes.data) || []).map(r => r.article));
    const rowsBrut = data.filter(r => !produitsAppel.has(r.article));
    const { periodeAffichage, rowsAffichage } = global.NexusPeriodes.analyserPeriodes(rowsBrut);
    if (!periodeAffichage) return null;

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
