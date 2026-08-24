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
  // `dateReference` (22/08/2026, ajouté pour le fallback temporel "dernier
  // état fiable" — voir chargerCarburantsBriefAvecFallback ci-dessous et
  // NEXUS-Data-Dictionary-v2.md v2.214/v2.215) : optionnel, défaut =
  // aujourd'hui (comportement strictement inchangé pour tous les appelants
  // existants qui ne passent pas ce 3e argument). Permet de rejouer TOUT le
  // calcul (contrôle du jour + volumes 7 jours + effet prix) ancré sur une
  // date PASSÉE, avec les mêmes fonctions que pour "aujourd'hui" — jamais
  // une deuxième formule pour "le score d'un jour" (Article 11).
  async function chargerCarburantsBrief(client, siteId, dateReference) {
    const aujourdhui = dateReference || new Date().toISOString().slice(0, 10);
    // 7 derniers jours glissants vs les 7 jours précédents — PAS la semaine
    // calendaire, même convention que chargerCandidatsFdj() ci-dessous :
    // toujours comparer des fenêtres de durée égale. Ancré sur `aujourdhui`
    // (et non plus directement sur `new Date()`) pour que ce calcul reste
    // correct quand `dateReference` désigne un jour antérieur.
    const finActuelle = new Date(`${aujourdhui}T23:59:59.999`);
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
    const D = global.NexusCarburantDonnees;
    const mix = M.calculerMixCarburant(actuel.ventes);
    const mixRef = M.calculerMixCarburant(reference.ventes);
    const evolution = mix && mixRef ? M.calculerEvolutionVolume(mix.total, mixRef.total) : null;
    const produitMoteur = M.identifierProduitMoteur(actuel.ventes);

    // Task #480 (18/08/2026, "Brancher Brief/Rapport sur les indicateurs
    // économiques carburant validés") : même lecture que Carburants
    // Pilotage (chargerEtRendreEconomie) — coût moyen pondéré + effet prix
    // stock hérité (Sprint C8), jamais un second calcul (Article 11), pour
    // les carburants actifs du site. `stockActuelL` réutilise
    // controle.parCarburant[cle].stockPhysiqueAffiche déjà chargé ci-dessus
    // — jamais une deuxième mesure de stock. Réduit à UN SEUL carburant à
    // mettre en avant via resumerEffetPrixCarburants (une carte Brief n'a
    // la place que pour une ligne).
    const cuvesConfig = await D.chargerCuvesConfig(client, siteId);
    const clesActives = M.CLES_CARBURANT.filter(cle => !cuvesConfig.config || !cuvesConfig.config[cle] || cuvesConfig.config[cle].actif);
    const prixVente = await D.chargerPrixCarburantsCourant(client, siteId);
    const effetsParCarburant = {};
    await Promise.all(clesActives.map(async cle => {
      const livraisons = await D.chargerLivraisonsCouteesCarburant(client, siteId, cle, 60);
      const cmpData = M.calculerCmpProgressif(livraisons);
      const stockActuelL = (controle && controle.parCarburant && controle.parCarburant[cle]) ? controle.parCarburant[cle].stockPhysiqueAffiche : null;
      effetsParCarburant[cle] = M.calculerEffetPrixStockHerite({ cmp: cmpData.cmp, coutRemplacementActuel: cmpData.coutRemplacementActuel, prixVenteDuMois: prixVente ? prixVente[cle] : null, stockPhysiqueActuelL: stockActuelL });
    }));
    const effetPrixResume = M.resumerEffetPrixCarburants(effetsParCarburant);

    return { controle, volumeSemaine: mix ? mix.total : null, evolution, produitMoteur, effetPrixResume };
  }

  // ============================================================
  // FALLBACK TEMPOREL "DERNIER ÉTAT FIABLE" (22/08/2026, demande de
  // Frédéric — voir NEXUS-Data-Dictionary-v2.md v2.214/v2.215). Capture du
  // 21/08 au soir : "🔴 Carburants — 0/100 · À corriger" alors que Q2
  // n'était pas encore remonté et le jaugeage d'ouverture du lendemain pas
  // encore saisi — une absence de donnée FRAÎCHE traitée comme un vrai
  // écart constaté. Principe : NEXUS ne recalcule le score courant que sur
  // une journée complète ; tant que ce n'est pas le cas, il affiche le
  // dernier score fiable (recalculé avec les MÊMES fonctions, à une date
  // antérieure — jamais une valeur figée à la main) avec sa fraîcheur
  // explicite, et garde les données du jour en cours dans un bloc séparé.
  //
  // N'appelle strictement que des fonctions déjà partagées (Article 11) :
  // chargerCarburantsBrief() (ci-dessus, désormais paramétrable par date),
  // NexusCarburantDonnees.chargerHistoriqueReleves() (section Historique de
  // Carburants Pilotage) et NexusCarburantDonnees.chargerVentesPeriode()
  // (couverture par quart, déjà utilisée ailleurs).
  // ============================================================
  // ------------------------------------------------------------
  // Traçabilité minimale du fallback (23/08/2026, audit "Anti-dégradation
  // temporelle" §9.2/§10, v2.222) — exception documentée à la règle "aucun
  // calcul métier ici" de l'en-tête de ce fichier, même précédent déjà
  // posé dans nexus-risques-donnees.js pour `enregistrerObservation` :
  // écrire un journal n'est pas un calcul métier (la décision vient déjà
  // toute faite de `NexusCarburantMoteur.resoudreEntreeJournalFraicheur`,
  // moteur pur), c'est une orchestration lire-l'existant / upsert,
  // destinée à être appelée identiquement quel que soit l'appelant.
  //
  // Une ligne par (site_id, secteur_id) — jamais dupliquée — sur le modèle
  // de `nexus_risk_signals` : on veut savoir OÙ EN EST chaque secteur
  // maintenant et DEPUIS QUAND, pas combien de fois le calcul a tourné.
  async function chargerJournalFraicheurExistant(client, siteId, secteurId) {
    const { data, error } = await client.from('journal_fraicheur_secteurs')
      .select('*').eq('site_id', siteId).eq('secteur_id', secteurId).maybeSingle();
    if (error) { console.error('Chargement journal fraîcheur secteur:', error); return null; }
    return data;
  }

  // `entree` = sortie de `NexusCarburantMoteur.resoudreEntreeJournalFraicheur`
  // ({fallbackUsed, fallbackMode, fallbackSourceVersion, fallbackAgeDays,
  // signalCritique}). Appel best-effort : toute erreur est journalée en
  // console et absorbée ici, jamais remontée à l'appelant — un incident
  // d'écriture sur ce journal ne doit jamais faire échouer ni ralentir le
  // Brief (Article 5 appliqué à l'infrastructure elle-même : une trace
  // manquante reste préférable à un Brief cassé).
  async function enregistrerFraicheurSecteur(client, siteId, secteurId, entree) {
    try {
      const maintenant = new Date().toISOString();
      const existant = await chargerJournalFraicheurExistant(client, siteId, secteurId);

      if (!existant) {
        const ligne = {
          site_id: siteId, secteur_id: secteurId,
          fallback_used: entree.fallbackUsed, fallback_mode: entree.fallbackMode,
          fallback_source_version: entree.fallbackSourceVersion, fallback_age_days: entree.fallbackAgeDays,
          signal_critique: entree.signalCritique,
          premiere_detection_le: maintenant, derniere_detection_le: maintenant,
          historique_transitions: [{ date: maintenant, fallback_used: entree.fallbackUsed, fallback_mode: entree.fallbackMode }],
          replaced_at: null,
        };
        const { data, error } = await client.from('journal_fraicheur_secteurs').insert(ligne).select().maybeSingle();
        if (error) {
          // Conflit probable (unique site_id/secteur_id) : un autre appel
          // concurrent vient de créer la ligne — relire plutôt qu'échouer,
          // même précédent que nexus-risques-donnees.js.
          const relu = await chargerJournalFraicheurExistant(client, siteId, secteurId);
          if (!relu) { console.error('Enregistrement journal fraîcheur (insert):', error); return null; }
          return relu;
        }
        return data;
      }

      const inchange = existant.fallback_used === entree.fallbackUsed
        && existant.fallback_mode === entree.fallbackMode
        && existant.fallback_source_version === entree.fallbackSourceVersion;

      // replaced_at : posé au moment précis où un fallback en cours
      // (fallback_used = true) est remplacé par un état à nouveau courant
      // (fallback_used repasse à false) — exactement le champ demandé par
      // l'audit §9.2 ("À l'arrivée de nouvelles données fiables ->
      // recalcul automatique ... replaced_at").
      const vientDEtreRemplace = existant.fallback_used && !entree.fallbackUsed;

      const patch = {
        fallback_used: entree.fallbackUsed, fallback_mode: entree.fallbackMode,
        fallback_source_version: entree.fallbackSourceVersion, fallback_age_days: entree.fallbackAgeDays,
        signal_critique: entree.signalCritique,
        derniere_detection_le: maintenant,
        replaced_at: vientDEtreRemplace ? maintenant : existant.replaced_at,
        // Jamais de ligne d'historique pour un simple "toujours pareil" —
        // seule une transition réelle (mode ou source différents) mérite
        // une entrée.
        historique_transitions: inchange ? existant.historique_transitions
          : [...(existant.historique_transitions || []), { date: maintenant, fallback_used: entree.fallbackUsed, fallback_mode: entree.fallbackMode }],
        updated_at: maintenant,
      };
      const { data, error } = await client.from('journal_fraicheur_secteurs').update(patch).eq('id', existant.id).select().maybeSingle();
      if (error) { console.error('Enregistrement journal fraîcheur (update):', error); return existant; }
      return data;
    } catch (e) {
      console.error('Enregistrement journal fraîcheur (exception, best-effort):', e);
      return null;
    }
  }

  async function chargerCarburantsBriefAvecFallback(client, siteId, dateAujourdhui) {
    const M = global.NexusCarburantMoteur;
    const D = global.NexusCarburantDonnees;
    const aujourdhui = dateAujourdhui || new Date().toISOString().slice(0, 10);
    const carburantsJour = await chargerCarburantsBrief(client, siteId, aujourdhui);
    // Écriture best-effort du journal de traçabilité (v2.222) — jamais
    // attendue (pas de `await`), jamais bloquante : un incident d'écriture
    // ne doit avoir aucun effet sur ce que Brief affiche.
    const journaliserCarburants = (fraicheur, signalCritique) => {
      enregistrerFraicheurSecteur(client, siteId, 'carburants', M.resoudreEntreeJournalFraicheur({ fraicheur, signalCritique }))
        .catch(e => console.error('Journal fraîcheur Carburants (best-effort):', e));
    };
    const completAujourdhui = M.jourCarburantEstComplet(carburantsJour.controle.parCarburant, carburantsJour.controle.aucunReleve);
    if (completAujourdhui) {
      journaliserCarburants({ mode: 'jour' }, false);
      return { ...carburantsJour, fraicheur: { mode: 'jour' } };
    }
    // Signal critique confirmé (23/08/2026, audit "Anti-dégradation
    // temporelle", §3.2/règle de précédence #5) : "un écart carburant
    // physiquement mesuré doit remplacer immédiatement le fallback, même
    // si le cycle global du jour n'est pas encore complet." Un relevé du
    // jour déjà saisi montrant un écart confirmé (statutGlobalControle
    // "À corriger") ne doit jamais être masqué derrière un état plus
    // ancien et plus favorable — priorité immédiate, jamais un fallback.
    if (M.signalCritiqueCarburantAujourdhui(carburantsJour.controle)) {
      journaliserCarburants({ mode: 'jour' }, true);
      return { ...carburantsJour, fraicheur: { mode: 'jour' } };
    }

    // Bloc "Aujourd'hui — en cours" : ce qui est déjà connu de la journée en
    // construction — jamais une donnée fabriquée pour combler le silence
    // (Article 5). Coût : une requête légère déjà utilisée ailleurs pour la
    // couverture par quart (nbQuartsAvecLitrage/nbQuartsTotal).
    const ventesJour = await D.chargerVentesPeriode(client, siteId, aujourdhui, aujourdhui);
    const enCours = M.construireBlocEnCours({
      nbQuartsAvecLitrage: ventesJour.nbQuartsAvecLitrage, nbQuartsTotal: ventesJour.nbQuartsTotal,
      releveDuJourExiste: !!carburantsJour.controle.releveDuJour,
    });

    // Historique jusqu'à J-1 inclus, jamais J lui-même (dateFin = veille) —
    // même chargeur que la section Historique de Carburants Pilotage
    // (Article 11), aucune nouvelle requête dédiée à ce fallback.
    const historique = await D.chargerHistoriqueReleves(client, siteId, 14, global.NexusPeriodes.ajouterJours(aujourdhui, -1));
    const fallback = M.trouverJourFiableAnterieur(historique, aujourdhui);
    const fraicheur = M.fraicheurCarburant({ completAujourdhui: false, fallback });

    if (fraicheur.mode === 'fallback') {
      // Rejoue TOUT le calcul à la date du dernier jour fiable — jamais une
      // valeur recopiée à la main (Article 11) — mais NE FIGE QUE LA
      // MAÎTRISE (22/08/2026, retour de Frédéric : "Carburants doit
      // réellement exploiter le dernier état fiable J-1 pour la composante
      // Maîtrise tant que la journée actuelle est incomplète"). Avant ce
      // correctif, tout l'objet `carburants` (y compris `evolution`, qui
      // alimente la Performance dans construireSecteurCarburants) était
      // remplacé par celui du jour fiable — la Performance affichée
      // redevenait donc, elle aussi, celle de J-1, alors que les ventes
      // d'aujourd'hui (déjà connues pour les quarts remontés) sont une
      // information réelle qui ne doit pas être mise de côté. Seul
      // `controle` (parCarburant/aucunReleve/releveDuJour — la seule donnée
      // que consomme la Maîtrise) vient du jour fiable ; `evolution`,
      // `produitMoteur`, `volumeSemaine` et `effetPrixResume` (tout ce qui
      // nourrit la Performance et les textes "changement"/"force") restent
      // ceux d'AUJOURD'HUI, jamais mélangés silencieusement avec J-1 dans le
      // même score (exigence explicite de Frédéric, v2.214).
      const carburantsFallback = await chargerCarburantsBrief(client, siteId, fraicheur.dateReference);
      journaliserCarburants(fraicheur, false);
      return { ...carburantsJour, controle: carburantsFallback.controle, fraicheur, enCours };
    }
    journaliserCarburants(fraicheur, false);
    // 'perime' ou 'jour_incomplet_sans_repli' : rien de fiable à figer —
    // reste honnête sur les données du jour telles quelles, avec le
    // contexte de fraîcheur pour que l'écran explique pourquoi plutôt que
    // de le taire.
    return { ...carburantsJour, fraicheur, enCours };
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

    // Fallback temporel "dernier état fiable" — extension à FDJ (22/08/2026,
    // demande de Frédéric, mécanisme déjà appliqué à Carburants v2.215/218).
    // Ne gèle QUE la Maîtrise (`nbEcarts`) : tant qu'aujourd'hui n'est pas
    // clôturé (`jourFdjEstCloture`, réutilisée telle quelle — déjà utilisée
    // ailleurs dans nexus-fdj-moteur.js pour la même notion de "jour
    // complet"), `nbEcarts` est recalculé sur la fenêtre de 7 jours se
    // terminant au dernier jour réellement clôturé plutôt que sur la
    // fenêtre du jour, qui inclurait un jour partiel. `caGrattage`/
    // `evolutionCa`/`jeuMoteur` (Performance) restent TOUJOURS ceux
    // d'aujourd'hui — jamais mélangés silencieusement avec un jour antérieur
    // dans le même score (même règle absolue que Carburants, v2.214).
    const FM = global.NexusFdjMoteur;
    const aujourdhuiIso = iso(finActuelle);
    const ligneAujourdhui = (dailyRows || []).find(r => r.date === aujourdhuiIso) || null;
    const completAujourdhui = FM.jourFdjEstCloture(ligneAujourdhui);
    let nbEcartsMaitrise = actuel.nb_ecarts_non_nuls;
    let fraicheurFdj = { mode: 'jour' };
    let enCoursFdj = null;
    let signalCritiqueFdj = false;
    // Signal critique confirmé (23/08/2026, audit "Anti-dégradation
    // temporelle", §3.2/règle de précédence #5) : "une rupture FDJ
    // confirmée doit remplacer immédiatement le fallback, même si le cycle
    // global du jour n'est pas encore complet." Un écart de caisse DÉJÀ
    // constaté aujourd'hui (sur un quart déjà remonté) reste en mode 'jour'
    // — jamais masqué derrière une fenêtre gelée plus ancienne et plus
    // favorable — `nbEcartsMaitrise` garde alors sa valeur par défaut
    // (la somme VIVANTE `actuel.nb_ecarts_non_nuls`, qui inclut déjà cet
    // écart réel).
    if (!completAujourdhui && !FM.signalCritiqueFdjAujourdhui(ligneAujourdhui)) {
      const fallback = FM.trouverDernierJourFdjFiable(dailyRows, aujourdhuiIso);
      // fraicheurCarburant() (nexus-carburant-moteur.js) est déjà 100 %
      // générique (aucun champ propre au carburant dans sa signature) —
      // réutilisée telle quelle plutôt que dupliquée (Article 11). Voir le
      // commentaire "FALLBACK TEMPOREL" de nexus-fdj-moteur.js.
      fraicheurFdj = global.NexusCarburantMoteur.fraicheurCarburant({ completAujourdhui: false, fallback });
      enCoursFdj = FM.construireBlocEnCoursFdj({
        nbQuartsControlesJour: ligneAujourdhui ? ligneAujourdhui.nb_quarts_controles : 0,
        nbEcartsJour: ligneAujourdhui ? ligneAujourdhui.nb_ecarts_non_nuls : 0,
      });
      if (fraicheurFdj.mode === 'fallback') {
        nbEcartsMaitrise = FM.sommerEcartsFenetreFdj(dailyRows, fraicheurFdj.dateReference);
      }
    } else if (!completAujourdhui) {
      signalCritiqueFdj = true;
    }
    // Écriture best-effort du journal de traçabilité (v2.222) — même
    // principe que pour Carburants ci-dessus : jamais attendue, jamais
    // bloquante pour l'affichage du Brief.
    enregistrerFraicheurSecteur(client, siteId, 'fdj', global.NexusCarburantMoteur.resoudreEntreeJournalFraicheur({ fraicheur: fraicheurFdj, signalCritique: signalCritiqueFdj }))
      .catch(e => console.error('Journal fraîcheur FDJ (best-effort):', e));

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
        // `nbEcarts` : nbEcartsMaitrise (gelé sur le dernier jour fiable si
        // aujourd'hui n'est pas clôturé, sinon identique à l'ancien calcul
        // — non-régression totale en mode 'jour'). `nbQuartsControles` reste
        // la fenêtre VIVANTE (sert uniquement de seuil "assez de données",
        // pas une mesure de Maîtrise — ne doit pas être gelé, Article 5 :
        // ne pas figer ce qui n'a pas besoin de l'être).
        nbEcarts: nbEcartsMaitrise, nbQuartsControles: actuel.nb_quarts_controles,
        fraicheur: fraicheurFdj, enCours: enCoursFdj,
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
  // Barème corrigé (22/08/2026, retour de Frédéric : "vérifier le barème
  // produisant 0/100 avec 20 anomalies sur 58 pointages. Le score doit
  // exposer le ratio et la comparaison historique.") — AVANT ce correctif,
  // `equipeScore = 100 - totalRetard` pénalisait la SOMME des minutes de
  // retard cumulées sur TOUS les pointages jamais enregistrés (aucune
  // fenêtre de date), une échelle qui n'a aucun rapport avec 0-100 : une
  // équipe de plusieurs collaborateurs avec des retards ordinaires (quelques
  // minutes chacun) dépasse très vite 100 minutes cumulées et tombe à 0,
  // quel que soit le nombre de pointages total — exactement le cas rapporté
  // ("20 anomalies sur 58 pointages" = 34 % d'anomalies, un taux élevé mais
  // pas une équipe totalement défaillante, et pourtant 0/100).
  //
  // Nouveau barème : le TAUX d'anomalies (anomalies / pointages), pas leur
  // somme de minutes — une équipe avec plus de pointages n'est plus punie
  // pour avoir plus d'occasions d'être en retard. Pente ×200 (seuil "équipe
  // en échec total" placé à 50 % d'anomalies) : pondération PROVISOIRE, même
  // discipline que tout le reste de ce fichier ("premier jet à ajuster avec
  // l'usage réel").
  //
  // Comparaison historique : ajoute une fenêtre glissante 7 jours vs 7 jours
  // précédents (même convention que chargerCarburantsBrief/chargerCandidatsFdj
  // ci-dessus — Article 11, jamais une 2e logique de fenêtre inventée), alors
  // que cette fonction ne connaissait auparavant AUCUNE notion de période
  // (portée documentée depuis la création de cette fonction). Le total
  // "toutes dates confondues" affiché par `employesASurveiller` (≥3 retards)
  // reste, lui, sur l'historique complet — mesurer une récurrence
  // individuelle sur seulement 7 jours produirait trop peu de signal pour
  // être fiable (Article 5 : ne pas couper une fenêtre uniquement pour
  // "faire comme les autres secteurs" si ça dégrade la mesure elle-même).
  //
  // Reste inchangé, documenté depuis toujours : cette fonction ne filtre
  // par aucun site (voir commentaire en tête de fichier).
  async function chargerDomaineEquipe(client, dateReference) {
    const aujourdhui = dateReference ? new Date(`${dateReference}T23:59:59.999`) : new Date();
    const iso = d => d.toISOString().slice(0, 10);
    const finActuelle = iso(aujourdhui);
    const debutActuelle = new Date(aujourdhui); debutActuelle.setDate(debutActuelle.getDate() - 6);
    const finPrecedente = new Date(debutActuelle); finPrecedente.setDate(finPrecedente.getDate() - 1);
    const debutPrecedente = new Date(finPrecedente); debutPrecedente.setDate(debutPrecedente.getDate() - 6);

    const [
      { data: pointagesRetard, error: e2 },
      { count: totalPointages, error: e3 },
      { count: totalPointagesPrec, error: e4 },
      { count: totalAnomaliesPrec, error: e5 },
      { data: pointagesRetardTous, error: e6 },
    ] = await Promise.all([
      client.from('pointages').select('employee_id, retard_min').eq('type', 'arrivee').gt('retard_min', 0).gte('date', debutActuelle.toISOString().slice(0, 10)).lte('date', finActuelle),
      client.from('pointages').select('id', { count: 'exact', head: true }).eq('type', 'arrivee').gte('date', debutActuelle.toISOString().slice(0, 10)).lte('date', finActuelle),
      client.from('pointages').select('id', { count: 'exact', head: true }).eq('type', 'arrivee').gte('date', iso(debutPrecedente)).lte('date', iso(finPrecedente)),
      client.from('pointages').select('id', { count: 'exact', head: true }).eq('type', 'arrivee').gt('retard_min', 0).gte('date', iso(debutPrecedente)).lte('date', iso(finPrecedente)),
      // Portée (collectif/individuel) et `employesASurveiller` restent
      // mesurés sur l'historique complet, sans fenêtre — voir commentaire
      // ci-dessus.
      client.from('pointages').select('employee_id').eq('type', 'arrivee').gt('retard_min', 0),
    ]);
    if (e2) console.error('Chargement pointages (Brief):', e2);
    if (e3) console.error('Chargement total pointages (Brief):', e3);
    if (e4) console.error('Chargement total pointages période précédente (Brief):', e4);
    if (e5) console.error('Chargement anomalies période précédente (Brief):', e5);
    if (e6) console.error('Chargement pointages retard historique complet (Brief):', e6);

    let equipeScore = null, employesASurveiller = null, tauxAnomalies = null;
    let totalAnomalies = 0, collaborateursConcernes = 0;
    if (pointagesRetard) {
      totalAnomalies = pointagesRetard.length;
      tauxAnomalies = totalPointages ? totalAnomalies / totalPointages : (totalAnomalies > 0 ? 1 : null);
      equipeScore = tauxAnomalies == null ? null : Math.round(Math.max(0, 100 - tauxAnomalies * 200));
    }
    if (pointagesRetardTous) {
      const retardsParEmploye = {};
      pointagesRetardTous.forEach(p => { if (p.employee_id) retardsParEmploye[p.employee_id] = (retardsParEmploye[p.employee_id] || 0) + 1; });
      employesASurveiller = Object.values(retardsParEmploye).filter(n => n >= 3).length;
      collaborateursConcernes = Object.keys(retardsParEmploye).length;
    }
    const tauxAnomaliesPeriodePrecedente = totalPointagesPrec ? (totalAnomaliesPrec || 0) / totalPointagesPrec : null;

    return {
      equipeScore, employesASurveiller, totalPointages: totalPointages != null ? totalPointages : null,
      totalAnomalies, collaborateursConcernes, tauxAnomalies,
      totalPointagesPeriodePrecedente: totalPointagesPrec != null ? totalPointagesPrec : null,
      totalAnomaliesPeriodePrecedente: totalAnomaliesPrec != null ? totalAnomaliesPrec : null,
      tauxAnomaliesPeriodePrecedente,
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
    chargerDerniereReferenceFdj, chargerCarburantsBrief, chargerCarburantsBriefAvecFallback, chargerCandidatsFdj,
    chargerJournalFraicheurExistant, enregistrerFraicheurSecteur,
    chargerSeuilsCoachEquipeFdj, chargerCandidatsCoachEquipe,
    chargerDomaineEquipe, chargerAlertesInventaireOuvertes, chargerControlesVerifyRestants, chargerMissionsRestantes,
    chargerJournalDecisions,
  };
})(typeof window !== 'undefined' ? window : globalThis);
