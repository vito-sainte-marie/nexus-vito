// NEXUS — Moteur Commande Carburant, colle Supabase (24/08/2026)
//
// Charge les données réelles nécessaires à NexusCarburantCommandeMoteur et
// assemble l'évaluation complète (§27 du cahier) pour un site. Aucun
// calcul ici (Article 11) — uniquement des lectures Supabase, transmises
// telles quelles au moteur pur (nexus-carburant-commande-moteur.js,
// nexus-carburant-moteur.js, nexus-carburant-donnees.js doivent être
// chargés AVANT ce fichier).
//
// Réutilise explicitement l'existant plutôt que de dupliquer :
//   - station_config.cuves_carburants (limite_remplissage ajoutée par la
//     migration carburant_commande_schema_v1) et .carburant_commande_config
//     — mêmes colonnes que NexusCarburantDonnees.chargerCuvesConfig,
//     jamais une deuxième lecture de la config des cuves.
//   - NexusCarburantDonnees.chargerControleJour() pour le stock physique du
//     jour ET sa fiabilité (statut) — jamais un deuxième calcul du stock
//     théorique/de la qualité de chaîne, déjà couvert par le Sprint C2-C7
//     Carburants Pilotage.
//   - inventaire_calendrier_site (type='ferie') pour les jours fériés —
//     table générique déjà éditable par le manager dans Paramètres
//     Inventaire, jamais une deuxième table de jours fériés créée pour ce
//     module.
//   - audits_caisse.litrage_* pour l'historique de ventes — même source
//     que sommerVentesPeriode/chargerConsommationJournaliereMoyenne.
//
// Inclure après nexus-carburant-moteur.js, nexus-carburant-donnees.js et
// nexus-carburant-commande-moteur.js :
// <script src="nexus-carburant-commande-donnees.js"></script>
// ------------------------------------------------------------

(function (global) {
  'use strict';

  function dateISOAujourdhui() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function heureHHMMAujourdhui(fuseau) {
    try {
      return new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau || 'America/Martinique', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    } catch (e) {
      const d = new Date();
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  }

  // Config carburant_commande_config + cuves_carburants (avec
  // limite_remplissage) + fuseau_horaire — une seule lecture station_config,
  // jamais trois requêtes séparées pour trois colonnes de la même table.
  // Repli explicite si le site n'a pas encore de config commande (colonne
  // NOT NULL avec défaut en base depuis la migration — ce cas ne devrait
  // survenir qu'en test) : jamais un plantage, mais aucune recommandation
  // fabriquée non plus (l'appelant verra config=null et devra l'afficher
  // comme "réglages non configurés", pas comme une valeur par défaut
  // inventée ici).
  async function chargerConfigEtCuves(client, siteId) {
    // `horaires` ajouté (25/08/2026, retour de Frédéric) — nécessaire pour
    // résoudre les fenêtres de quarts lors du calcul du "stock estimé
    // maintenant" (chargerStockEtFiabiliteParCarburant ci-dessous) ; même
    // ligne station_config déjà lue ici, jamais une deuxième requête pour
    // une seule colonne supplémentaire (Article 11).
    const { data, error } = await client.from('station_config')
      .select('carburant_commande_config, cuves_carburants, fuseau_horaire, horaires')
      .eq('site', siteId).maybeSingle();
    if (error) { console.error('Chargement config Commande Carburant:', error); return { config: null, cuves: null, fuseau: 'America/Martinique', horaires: null }; }
    return {
      config: (data && data.carburant_commande_config) || null,
      cuves: (data && data.cuves_carburants) || null,
      fuseau: (data && data.fuseau_horaire) || 'America/Martinique',
      horaires: (data && data.horaires) || null,
    };
  }

  // Jours fériés déclarés pour ce site (inventaire_calendrier_site,
  // type='ferie' uniquement — 'vacances' n'entre pas dans ce lot, voir
  // Data Dictionary "Portée non traitée" : la prévision saisonnière/
  // vacances du cahier §8 priorités 5-7 demande davantage d'historique que
  // ce que ce lot peut raisonnablement exploiter). Retourne l'ensemble
  // complet connu du site (passé ET futur) : le moteur en a besoin des
  // deux côtés (passé pour la prévision, futur pour le calendrier de
  // livraison).
  async function chargerJoursFeries(client, siteId) {
    const { data, error } = await client.from('inventaire_calendrier_site')
      .select('date').eq('site', siteId).eq('type', 'ferie');
    if (error) { console.error('Chargement jours fériés (Commande Carburant):', error); return []; }
    return (data || []).map(r => r.date);
  }

  // Historique de ventes par jour, agrégé (une ligne par date, litrage
  // sommé sur tous les quarts de ce jour) — format attendu par
  // NexusCarburantCommandeMoteur.prevoirConsommationJour/Fenetre :
  // [{ date, ventes: { go, sp95, gnr } }]. `joursHistorique` = 180 par
  // défaut (~6 mois, large marge pour que la recherche "même jour de
  // semaine" du moteur (§8) puisse remonter jusqu'à 8 occurrences même sur
  // un site encore jeune).
  async function chargerHistoriqueVentesParJour(client, siteId, dateFinExclusiveISO, joursHistorique) {
    const fenetre = joursHistorique || 180;
    const fin = new Date(`${dateFinExclusiveISO}T00:00:00`);
    const debut = new Date(fin);
    debut.setDate(debut.getDate() - fenetre);
    const debutISO = `${debut.getFullYear()}-${String(debut.getMonth() + 1).padStart(2, '0')}-${String(debut.getDate()).padStart(2, '0')}`;
    const { data, error } = await client.from('audits_caisse')
      .select('date,litrage_gazole,litrage_sp95,litrage_gnr')
      .eq('site', siteId).gte('date', debutISO).lt('date', dateFinExclusiveISO);
    if (error) { console.error('Chargement historique ventes (Commande Carburant):', error); return []; }
    const parDate = {};
    (data || []).forEach(l => {
      if (!parDate[l.date]) parDate[l.date] = { go: null, sp95: null, gnr: null };
      const j = parDate[l.date];
      if (l.litrage_gazole != null) j.go = (j.go || 0) + Number(l.litrage_gazole);
      if (l.litrage_sp95 != null) j.sp95 = (j.sp95 || 0) + Number(l.litrage_sp95);
      if (l.litrage_gnr != null) j.gnr = (j.gnr || 0) + Number(l.litrage_gnr);
    });
    return Object.keys(parDate).sort().map(date => ({ date, ventes: parDate[date] }));
  }

  // Historique de ventes d'UN SEUL créneau de quart ('1' ou '2'), même forme
  // que chargerHistoriqueVentesParJour ci-dessus ([{date, ventes:{go,sp95,
  // gnr}}]) — réutilise directement M.moyenneRecente/moyennePondereeMemeJourSemaine
  // (Article 11, jamais un second calcul de moyenne) pour estimer la
  // contribution d'un quart pas encore clôturé (25/08/2026, retour de
  // Frédéric : "nexus doit faire une estimation des ventes en fonction de
  // son historique"). `joursHistorique` = 90 par défaut (suffisant pour la
  // moyenne récente sur 14 jours utilisée ci-dessous, sans alourdir la
  // requête comme les 180 jours de l'historique journalier complet).
  async function chargerHistoriqueVentesParQuart(client, siteId, quartNum, dateFinExclusiveISO, joursHistorique) {
    const fenetre = joursHistorique || 90;
    const fin = new Date(`${dateFinExclusiveISO}T00:00:00`);
    const debut = new Date(fin);
    debut.setDate(debut.getDate() - fenetre);
    const debutISO = `${debut.getFullYear()}-${String(debut.getMonth() + 1).padStart(2, '0')}-${String(debut.getDate()).padStart(2, '0')}`;
    const { data, error } = await client.from('audits_caisse')
      .select('date,litrage_gazole,litrage_sp95,litrage_gnr')
      .eq('site', siteId).eq('quart', quartNum).gte('date', debutISO).lt('date', dateFinExclusiveISO);
    if (error) { console.error('Chargement historique ventes par quart (Commande Carburant):', error); return []; }
    return (data || []).map(l => ({
      date: l.date,
      ventes: {
        go: l.litrage_gazole != null ? Number(l.litrage_gazole) : null,
        sp95: l.litrage_sp95 != null ? Number(l.litrage_sp95) : null,
        gnr: l.litrage_gnr != null ? Number(l.litrage_gnr) : null,
      },
    })).sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  // Avis Verify informatif (28/08/2026, retour de Frédéric — refonte
  // qualitative v2.260) : "je ne veux pas de dépendance artificielle entre
  // NEXUS Verify et NEXUS Carburants [...] si une caisse n'est pas encore
  // validée, cela ne doit PAS automatiquement rendre la fiabilité carburant
  // 'à confirmer' [...] à moins que cela bloque réellement NEXUS pour
  // connaître ou certifier les litres utilisés." Task #240 (audit de ce
  // même lot) a confirmé que `litrage_gazole/sp95/gnr` sont écrits par
  // l'employé À LA CLÔTURE du quart dans Verify, INDÉPENDAMMENT de toute
  // validation manager ultérieure (`valide_le_piste`/`valide_le_boutique`)
  // — donc la fiabilité carburant (`detailQualiteDonneesCommande`, point 15)
  // n'a JAMAIS dépendu de cette validation, et continue à ne jamais en
  // dépendre ici (Article 5 : aucun couplage artificiel introduit).
  //
  // Cette fonction ne fait qu'exposer un badge PUREMENT INFORMATIF côté
  // écran : "⚠️ Contrôle caisse Qn en attente" quand un quart d'aujourd'hui
  // n'est pas encore (totalement) validé par le manager — jamais fusionné
  // dans le calcul de confiance (Article 11 : réutilise
  // NexusVerifyMoteur.statutValidationQuart, déjà défini et testé pour
  // NEXUS Verify/Historique, v2.234 — aucun 2ᵉ calcul de statut de
  // validation écrit ici).
  // 28/08/2026, retour de Frédéric (v2.263) — élargi de "aujourd'hui
  // seulement" à une fenêtre de `SEUIL_FALLBACK_JOURS_PEREMPTION` jours
  // (3 j, `nexus-carburant-moteur.js` — même seuil déjà utilisé ailleurs
  // dans NEXUS pour "au-delà, une donnée n'est plus assez fraîche pour
  // être présentée comme le reflet de la situation courante", Article 11 :
  // aucun nouveau seuil arbitraire inventé pour ce lot). Chaque entrée
  // porte désormais sa PROPRE date (`date`) — nécessaire pour que l'écran
  // puisse dire précisément "Quart 2 du 27 août", jamais un avis anonyme,
  // et pour construire le lien Verify vers CE quart précis, jamais
  // seulement la page d'accueil de Verify.
  async function chargerAvisVerifyJour(client, siteId, dateISO) {
    const V = global.NexusVerifyMoteur;
    const MC = global.NexusCarburantCommandeMoteur;
    const M = global.NexusCarburantMoteur;
    if (!V || !V.statutValidationQuart || !MC) return [];
    const joursFenetre = (M && M.SEUIL_FALLBACK_JOURS_PEREMPTION) || 3;
    const dateDebut = MC.ajouterJoursISO(dateISO, -(joursFenetre - 1));
    const { data, error } = await client.from('audits_caisse')
      .select('date, quart, ecart_piste, ecart_boutique, valide_le_piste, valide_le_boutique, premiere_validation_le_piste, premiere_validation_le_boutique, valide_par_piste, valide_par_boutique')
      .eq('site', siteId).gte('date', dateDebut).lte('date', dateISO);
    if (error) { console.error('Chargement avis Verify (Commande Carburant):', error); return []; }
    return (data || [])
      .map(a => ({ date: a.date, quart: a.quart, statut: V.statutValidationQuart(a) }))
      .filter(x => x.statut && (x.statut.etat === 'en_attente' || x.statut.etat === 'partiel'))
      // Plus récent en premier (le quart d'aujourd'hui, s'il existe, avant
      // celui d'hier) — ordre de lecture le plus utile pour le manager.
      .sort((a, b) => (a.date === b.date ? b.quart - a.quart : (a.date < b.date ? 1 : -1)));
  }

  // Dernière commande NEXUS non encore livrée pour un carburant donné
  // (statut 'validee' ou 'modifiee', pas 'hors_nexus'/'annulee'/'livree') —
  // §10 du cahier : une commande déjà en cours doit être intégrée, jamais
  // une deuxième recommandation comme si elle n'existait pas. Lit
  // `carburants` (jsonb {sp95:{volumeL},go:{...},gnr:{...}}) et n'expose
  // que la part du volume concernant CE carburant.
  async function chargerCommandeEnCoursParCarburant(client, siteId) {
    const { data, error } = await client.from('carburant_commandes')
      .select('id, carburants, livraison_prevue_le, statut')
      .eq('site', siteId).in('statut', ['validee', 'modifiee', 'confirmee_fournisseur', 'hors_nexus'])
      .order('proposee_le', { ascending: false });
    if (error) { console.error('Chargement commandes en cours (Commande Carburant):', error); return {}; }
    const parCarburant = {};
    (data || []).forEach(cmd => {
      if (!cmd.carburants) return;
      Object.keys(cmd.carburants).forEach(c => {
        if (parCarburant[c]) return; // déjà pris la plus récente (order desc ci-dessus)
        const ligne = cmd.carburants[c];
        if (!ligne || ligne.volumeL == null) return;
        parCarburant[c] = { commandeId: cmd.id, volumeL: ligne.volumeL, livraisonPrevueLe: cmd.livraison_prevue_le };
      });
    });
    return parCarburant;
  }

  // Stock "estimé maintenant" par carburant actif (25/08/2026, retour de
  // Frédéric — cahier "Correction à apporter au moteur Prochaine
  // commande") : "Le jaugeage saisi le matin correspond au stock physique
  // d'ouverture avant les ventes de la journée. Il ne doit donc jamais être
  // considéré comme le stock disponible 'maintenant'." Confirmé exact :
  // avant ce correctif, cette fonction renvoyait `stockPhysiqueAffiche`
  // (le jaugeage brut, `reelDuJour`) tel quel comme `stockActuelL`, sans
  // jamais déduire les ventes déjà captées depuis ce jaugeage — l'ancre de
  // TOUTE la projection (stockPrevuLivraison) était donc systématiquement
  // en avance sur la réalité d'un montant égal aux ventes du jour déjà
  // réalisées au moment de l'évaluation.
  //
  // Formule appliquée désormais : stock estimé maintenant = jaugeage
  // d'ouverture − ventes réellement captées depuis ce jaugeage jusqu'à
  // maintenant. Réutilise NexusCarburantDonnees.chargerControleJour
  // (Article 11, même lecture que Carburants Pilotage, jamais une deuxième
  // lecture du stock physique) puis calcule la fenêtre "jaugeage -> maintenant"
  // manquante, selon 2 cas :
  //   A) jaugeage déjà saisi aujourd'hui -> il faut les ventes depuis
  //      l'instant représenté par ce jaugeage jusqu'à maintenant — fenêtre
  //      que chargerControleJour ne calcule PAS pour son propre usage (son
  //      ventesDepuis sert au rapprochement réel/théorique entre deux
  //      jaugeages consécutifs, s'arrête à la mesure du jour) — recalculée
  //      ici via la primitive bas niveau
  //      NexusCarburantMoteur.resoudreVentesFenetre, le même mécanisme déjà
  //      utilisé pour l'écart de rapprochement, réutilisé à un niveau plus
  //      bas plutôt que dupliqué (Article 11). Borne basse = `M.instantFenetreReleve`
  //      (25/08/2026, retour de Frédéric), PAS `mesure_le` brut : un
  //      jaugeage d'ouverture normal (origine != 'reception_livraison')
  //      représente TOUJOURS le stock à l'ouverture de sa journée, même
  //      saisi tardivement dans NEXUS par un employé — comparer son heure de
  //      SAISIE aux horaires de quart produisait un faux "chevauchement" dès
  //      qu'un jaugeage matinal était entré en cours de quart 1 (le cas
  //      normal sur vito-sainte-marie, vérifié sur données réelles 23 et
  //      24/08). Seul un relevé lié à une livraison (`reception_livraison`)
  //      garde son `mesure_le` réel comme ancre précise.
  //   B) aucun jaugeage aujourd'hui -> chargerControleJour a DÉJÀ étendu sa
  //      propre fenêtre jusqu'à maintenant dans ce cas précis (sa
  //      `fenetreFin` vaut `new Date()` quand `releveDuJour` est absent) :
  //      son `ventesDepuis` est directement réutilisable, rien à
  //      recalculer.
  // Limite connue, héritée de chargerControleJour et non traitée ici :
  // quand l'ancre est un point zéro, la fenêtre reste calculée date-à-date
  // et ne s'étend pas jusqu'à "maintenant" (portée volontairement
  // inchangée depuis v2.205, cas rare limité au jour même d'une nouvelle
  // certification) — documenté au Data Dictionary plutôt que silencieusement
  // approximé.
  //
  // `stockFiable` : un statut de chaîne physique exploitable NE SUFFIT PLUS
  // seul (comme avant) — le stock estimé maintenant doit aussi avoir pu
  // être calculé (ventes résolues sans chevauchement de quart) ; sinon,
  // jamais un repli silencieux sur le jaugeage brut (ce serait recommettre
  // exactement l'erreur signalée).
  // `maintenant` (optionnel, Date ou ISO) : instant "now" utilisé pour la
  // borne haute de la fenêtre de ventes captées depuis le jaugeage —
  // injectable pour les tests (jamais `new Date()` en dur dans la logique,
  // même précédent que `construireContextePlausibilite`), défaut = instant
  // réel en production.
  async function chargerStockEtFiabiliteParCarburant(client, siteId, dateISO, horaires, fuseau, maintenant) {
    const NCD = global.NexusCarburantDonnees;
    const M = global.NexusCarburantMoteur;
    // MC (Commande Carburant, distinct du moteur générique M ci-dessus) —
    // uniquement pour réutiliser M.moyenneRecente (25/08/2026, estimation
    // historique d'un quart en cours) plutôt que dupliquer un second calcul
    // de moyenne (Article 11).
    const MC = global.NexusCarburantCommandeMoteur;
    if (!NCD || !M) { console.error('NexusCarburantDonnees/NexusCarburantMoteur non chargés — impossible de lire le stock physique.'); return { parCarburant: {}, aucunReleve: true }; }
    const controle = await NCD.chargerControleJour(client, siteId, dateISO);
    if (controle.aucunReleve || !controle.parCarburant) return { parCarburant: {}, aucunReleve: true };

    const resultat = {};

    if (controle.releveDuJour && controle.releveDuJour.mesure_le) {
      // Cas A — jaugeage saisi aujourd'hui.
      const { data: lignesQuartsJour, error } = await client.from('audits_caisse')
        .select('date,quart,litrage_gazole,litrage_sp95,litrage_gnr')
        .eq('site', siteId).eq('date', dateISO);
      if (error) console.error('Chargement quarts du jour (stock estimé maintenant):', error);
      const t0 = M.instantFenetreReleve(controle.releveDuJour, fuseau);
      const t1 = maintenant ? new Date(maintenant) : new Date();
      const resolu = M.resoudreVentesFenetre(lignesQuartsJour || [], horaires, t0, t1, fuseau);

      // Estimation historique des quarts encore ouverts (25/08/2026, retour
      // de Frédéric : "nexus doit faire une estimation des ventes en
      // fonction de son historique" — jamais bloquer tout calcul tant qu'un
      // quart n'est pas clôturé). Distinct du chevauchement réel v2.205
      // (`resolu.isolable === false`) : là, une ligne EXISTE déjà mais est
      // ambiguë, jamais une estimation (Article 5, précision impossible).
      // Ici, aucune ligne n'existe encore pour le quart en cours — NEXUS
      // estime sa part avec la moyenne récente du même créneau, prorata du
      // temps déjà écoulé, plutôt que d'afficher un blocage total. Le
      // résultat reste marqué `estimeParHistorique` pour que l'écran
      // affiche honnêtement "estimation" et non une mesure certaine.
      let estimeParHistorique = false;
      const estimationsL = { go: 0, sp95: 0, gnr: 0 };
      if (resolu.isolable !== false) {
        const quartsAEstimer = M.quartsAEstimerDansFenetre(lignesQuartsJour || [], horaires, dateISO, t0, t1, fuseau);
        for (const q of quartsAEstimer) {
          if (q.fraction <= 0) continue;
          const historiqueQuart = await chargerHistoriqueVentesParQuart(client, siteId, q.quart, dateISO);
          ['go', 'sp95', 'gnr'].forEach(carb => {
            const moy = MC ? MC.moyenneRecente(historiqueQuart, carb, dateISO, 14).moyenne : null;
            if (moy != null) {
              estimationsL[carb] += moy * q.fraction;
              estimeParHistorique = true;
            }
          });
        }
      }

      Object.entries(controle.parCarburant).forEach(([cle, r]) => {
        const venteReelle = resolu.ventes[cle];
        const estimee = estimationsL[cle] || 0;
        // `ventes` combine la part réellement close (venteReelle, jamais
        // altérée) et l'estimation du quart encore ouvert — mais seulement
        // si une estimation existe ou qu'une vente réelle a été trouvée ;
        // si ni l'un ni l'autre (aucune donnée du tout, même pas
        // d'historique pour estimer), `ventes` reste honnêtement `null`
        // plutôt que de fabriquer un zéro (Article 5).
        const ventes = venteReelle != null ? venteReelle + estimee
          : (estimeParHistorique ? estimee : null);
        const jaugeageL = r.reelDuJour != null ? Number(r.reelDuJour) : null;
        const stockEstimeL = (jaugeageL != null && ventes != null) ? jaugeageL - ventes : null;
        resultat[cle] = {
          stockActuelL: stockEstimeL,
          jaugeageOuvertureL: jaugeageL,
          jaugeageOuvertureLe: controle.releveDuJour.mesure_le,
          ventesDepuisJaugeageL: ventes,
          ventesEstimeesInclusesL: estimeParHistorique ? estimee : 0,
          stockEstimeParHistorique: estimeParHistorique && stockEstimeL != null,
          stockFiable: r.statut !== 'Données insuffisantes' && stockEstimeL != null,
          // Ancre de la RECOMMANDATION (27/08/2026, règles 1+2 de Frédéric :
          // "le jaugeage du matin est l'unique point physique de départ de
          // la recommandation" / "elle ne doit jamais attendre la clôture
          // du Quart 1") — DISTINCTE de `stockActuelL` ci-dessus. `stockActuelL`
          // ("stock estimé maintenant") reste utile pour l'AFFICHAGE
          // (monitoring en temps réel), mais l'utiliser comme ancre de
          // projection multi-jours revenait à soustraire deux fois la même
          // consommation du jour : une fois via les ventes RÉELLEMENT
          // captées depuis ce matin (`ventes` ci-dessus), une seconde fois
          // via la prévision d'UNE JOURNÉE COMPLÈTE pour aujourd'hui dans la
          // fenêtre de ventes prévues (`prevoirConsommationFenetre` inclut
          // toujours la date du jour). Vérifié sur données réelles
          // vito-sainte-marie 27/08 : GO stock prévu avant livraison passait
          // de -740 L (ancre stock maintenant, double compte) à +1 734 L
          // (ancre jaugeage), soit 2 474 L d'écart — non négligeable.
          // L'ancre jaugeage ne dépend JAMAIS de la clôture du Quart 1 (ni
          // de l'estimation d'un quart encore ouvert) : elle reste
          // disponible et stable toute la journée dès que le jaugeage du
          // matin est saisi, conformément à la règle 2.
          stockAncreCommandeL: jaugeageL,
          // La qualité du rapprochement veille → aujourd'hui ne remet pas
          // en cause la mesure physique d'ouverture utilisée pour projeter
          // une commande. Un quart chevauchant une livraison peut rendre
          // l'ÉCART non calculable tout en laissant le stock d'ouverture
          // parfaitement exploitable pour la recommandation.
          stockAncreCommandeFiable: jaugeageL != null,
          // 27/08/2026, point 15 (fiabilité à 6 facteurs) — signaux
          // supplémentaires transmis tels quels au moteur, jamais recalculés
          // une 2ᵉ fois (Article 11) : `pointZeroExiste` réutilise le
          // point zéro déjà chargé par NexusCarburantDonnees.chargerControleJour
          // (v2.2xx), `anomalieMajeure` réutilise le statut d'écart déjà
          // qualifié par le même appel (r.statut === 'À corriger').
          pointZeroExiste: !!controle.pointZero,
          anomalieMajeure: r.statut === 'À corriger',
          // 28/08/2026, retour de Frédéric (v2.263) — "à confirmer" doit
          // pouvoir afficher l'écart CHIFFRÉ réel ("Écart GO de -1 195 L à
          // qualifier"), jamais un texte générique quand le chiffre existe
          // déjà. `r.ecart` est calculé par NexusCarburantDonnees.
          // chargerControleJour (même source que "Situation aujourd'hui"),
          // simplement jamais transmis plus loin jusqu'ici (Article 11,
          // aucun second calcul d'écart).
          ecartPhysiqueTheoriqueL: r.ecart != null ? Number(r.ecart) : null,
          // 28/08/2026, nouvelle demande de Frédéric (diagnostic contextuel
          // de l'écart) — `statut` (Sous contrôle/À surveiller/À corriger/
          // Données insuffisantes) est l'UNIQUE juge de "y a-t-il un écart
          // significatif" pour NexusCarburantMoteur.diagnostiquerEcartCarburant
          // ci-dessous ; jusqu'ici seul le booléen dérivé `anomalieMajeure`
          // était transmis, jamais le statut brut lui-même (Article 11,
          // même source, simplement pas encore relayée).
          statut: r.statut || null,
        };
      });
      // Source de l'ancre, exposée UNE fois (28/08/2026, point 4 — retour de
      // Frédéric : "Afficher explicitement la source utilisée pour le calcul
      // de commande [...] expliquer pourquoi" un relevé plus récent aurait
      // été écarté). Cas A : le jaugeage du jour lui-même sert d'ancre — même
      // décision pour les 3 carburants, donc un seul objet, jamais dupliqué
      // par carburant (Article 11).
      return {
        parCarburant: resultat, aucunReleve: false,
        sourceAncre: {
          utiliseAujourdhui: true,
          dateISO: controle.releveDuJour.date,
          mesureLe: controle.releveDuJour.mesure_le,
          origine: controle.releveDuJour.origine || null,
          motif: null,
        },
      };
    }

    // Cas B — aucun jaugeage aujourd'hui : ventesDepuis de
    // chargerControleJour va déjà jusqu'à "maintenant" (voir commentaire
    // ci-dessus). Pas de "jaugeage du matin" disponible pour CE jour — la
    // règle 1 de Frédéric ne s'applique qu'à un jaugeage réellement pris ce
    // matin (Article 5, jamais un jaugeage fabriqué faute de mieux) : ce cas
    // garde donc l'ancre "dernier stock fiable connu" comme avant,
    // documenté en portée non traitée (v2.255).
    Object.entries(controle.parCarburant).forEach(([cle, r]) => {
      const jaugeageL = r.dernierReel != null ? Number(r.dernierReel) : null;
      const ventes = r.ventesDepuis;
      const stockEstimeL = (jaugeageL != null && ventes != null) ? jaugeageL - ventes : null;
      const fiable = r.statut !== 'Données insuffisantes' && stockEstimeL != null;
      resultat[cle] = {
        stockActuelL: stockEstimeL,
        jaugeageOuvertureL: jaugeageL,
        jaugeageOuvertureLe: controle.dernierReleve ? controle.dernierReleve.mesure_le : null,
        ventesDepuisJaugeageL: ventes,
        stockFiable: fiable,
        stockAncreCommandeL: stockEstimeL,
        stockAncreCommandeFiable: fiable,
        // 27/08/2026, point 15 — mêmes signaux qu'au Cas A ci-dessus.
        pointZeroExiste: !!controle.pointZero,
        anomalieMajeure: r.statut === 'À corriger',
        // 28/08/2026, v2.263 — même champ que le Cas A ci-dessus.
        ecartPhysiqueTheoriqueL: r.ecart != null ? Number(r.ecart) : null,
        // 28/08/2026 — même champ que le Cas A ci-dessus (diagnostic
        // contextuel de l'écart).
        statut: r.statut || null,
      };
    });
    // Source de l'ancre — Cas B : aucun relevé pour `dateISO`, l'ancre est le
    // dernier relevé réel antérieur (`controle.dernierReleve`, déjà chargé
    // par chargerControleJour, Article 11). Le motif reste honnête et
    // explicite (28/08/2026, point 4) plutôt que de laisser deviner
    // pourquoi une date différente d'aujourd'hui apparaît sur l'écran.
    return {
      parCarburant: resultat, aucunReleve: false,
      sourceAncre: controle.dernierReleve ? {
        utiliseAujourdhui: false,
        dateISO: controle.dernierReleve.date,
        mesureLe: controle.dernierReleve.mesure_le,
        origine: controle.dernierReleve.origine || null,
        motif: `Aucun jaugeage saisi le ${dateISO} — dernier relevé fiable connu utilisé (${controle.dernierReleve.date}).`,
      } : {
        utiliseAujourdhui: false, dateISO: null, mesureLe: null, origine: null,
        motif: `Aucun jaugeage saisi le ${dateISO} et aucun relevé antérieur connu.`,
      },
    };
  }

  // ============================================================
  // JOURNAL HORODATÉ DES RECOMMANDATIONS (27/08/2026, refonte qualitative,
  // point 20) — même discipline que enregistrerFraicheurSecteur
  // (nexus-brief-donnees.js, v2.222) : écrire un journal n'est pas un
  // calcul métier (la décision vient déjà toute faite de
  // NexusCarburantCommandeMoteur.resoudreEntreeJournalRecommandation,
  // moteur pur), c'est une orchestration lire-l'existant / upsert. Une
  // ligne par (site_id, carburant) — jamais dupliquée, jamais réécrite
  // en place : `historique` ne fait que grandir (Article 5 — chaîne
  // d'audit immuable, même principe que les points zéro).
  // ============================================================
  async function chargerJournalRecommandationExistant(client, siteId, carburant) {
    const { data, error } = await client.from('carburant_recommandation_journal')
      .select('*').eq('site_id', siteId).eq('carburant', carburant).maybeSingle();
    if (error) { console.error('Chargement journal recommandation carburant:', error); return null; }
    return data;
  }

  // Appel best-effort (jamais attendu par l'appelant, jamais bloquant) :
  // un incident d'écriture sur ce journal ne doit jamais empêcher
  // l'évaluation Commande Carburant de fonctionner — seulement priver
  // l'historique d'une ligne pour ce tour-ci (tracé en console).
  async function enregistrerRecommandationCarburant(client, siteId, carburant, { recommandationL, etat, ventesPrevuesL, stockAncreCommandeL }) {
    const M = global.NexusCarburantCommandeMoteur;
    try {
      const existant = await chargerJournalRecommandationExistant(client, siteId, carburant);
      const resolu = M.resoudreEntreeJournalRecommandation({ existant, recommandationL, etat, ventesPrevuesL, stockAncreCommandeL });
      if (resolu.inchange) return existant;

      if (resolu.estNouveau) {
        const ligne = {
          site_id: siteId, carburant, recommandation_l: recommandationL, etat,
          ventes_prevues_l: (typeof ventesPrevuesL === 'number') ? ventesPrevuesL : null,
          stock_ancre_l: (typeof stockAncreCommandeL === 'number') ? stockAncreCommandeL : null,
          premiere_detection_le: resolu.snapshot.date, derniere_maj_le: resolu.snapshot.date,
          historique: [resolu.snapshot],
        };
        const { data, error } = await client.from('carburant_recommandation_journal').insert(ligne).select().maybeSingle();
        if (error) {
          // Conflit probable (unique site_id/carburant) : un autre appel
          // concurrent vient de créer la ligne — relire plutôt qu'échouer,
          // même précédent que journal_fraicheur_secteurs.
          const relu = await chargerJournalRecommandationExistant(client, siteId, carburant);
          if (!relu) { console.error('Enregistrement journal recommandation (insert):', error); return null; }
          return relu;
        }
        return data;
      }

      const patch = {
        recommandation_l: recommandationL, etat,
        ventes_prevues_l: (typeof ventesPrevuesL === 'number') ? ventesPrevuesL : null,
        stock_ancre_l: (typeof stockAncreCommandeL === 'number') ? stockAncreCommandeL : null,
        derniere_maj_le: resolu.snapshot.date,
        historique: [...(existant.historique || []), resolu.snapshot],
        updated_at: resolu.snapshot.date,
      };
      const { data, error } = await client.from('carburant_recommandation_journal').update(patch).eq('id', existant.id).select().maybeSingle();
      if (error) { console.error('Enregistrement journal recommandation (update):', error); return existant; }
      return data;
    } catch (e) {
      console.error('Enregistrement journal recommandation (exception, best-effort):', e);
      return null;
    }
  }

  // ============================================================
  // ORCHESTRATION — construit l'évaluation complète du site (§27) en une
  // seule fonction, consommée directement par l'écran (carte "Prochaine
  // commande") et par Cockpit/Brief (signal, sans recalcul, Article 11).
  // ============================================================

  async function evaluerCommandeCarburantSite(client, siteId, options) {
    const M = global.NexusCarburantCommandeMoteur;
    // MB (moteur de BASE, distinct de M ci-dessus) — uniquement pour
    // réutiliser NexusCarburantMoteur.diagnostiquerEcartCarburant (28/08/2026,
    // nouvelle demande de Frédéric), déjà écrit dans le moteur partagé par
    // Situation aujourd'hui ET Prochaine commande (Article 11 : un seul
    // diagnostic d'écart, jamais deux calculs divergents selon l'écran).
    const MB = global.NexusCarburantMoteur;
    if (!M) { console.error('NexusCarburantCommandeMoteur non chargé — évaluation Commande Carburant impossible.'); return null; }

    const dateISO = (options && options.dateISO) || dateISOAujourdhui();
    const { config, cuves, fuseau, horaires } = await chargerConfigEtCuves(client, siteId);
    if (!config || !cuves) {
      return { ok: false, motif: "Configuration Commande Carburant absente pour ce site (station_config.carburant_commande_config / cuves_carburants).", etatGlobal: 'non_calculable' };
    }
    const heureMaintenantHHMM = (options && options.heureHHMM) || heureHHMMAujourdhui(fuseau);

    const carburantsActifs = Object.keys(cuves).filter(c => cuves[c] && cuves[c].actif);
    if (!carburantsActifs.length) {
      return { ok: false, motif: 'Aucun carburant actif configuré pour ce site.', etatGlobal: 'non_calculable' };
    }

    const [historiqueParJour, joursFeriesISO, stockInfo, commandesEnCours, historiqueQuart1, historiqueQuart2, avisVerifyJour, derniereReception] = await Promise.all([
      chargerHistoriqueVentesParJour(client, siteId, dateISO),
      chargerJoursFeries(client, siteId),
      chargerStockEtFiabiliteParCarburant(client, siteId, dateISO, horaires, fuseau, options && options.maintenant),
      chargerCommandeEnCoursParCarburant(client, siteId),
      // Couverture estimée par quart (28/08/2026, retour de Frédéric sur
      // v2.259 — "Couverture estimée : mardi Q2" plutôt qu'un nombre de
      // jours décimal) : chargerHistoriqueVentesParQuart() existe déjà
      // depuis v2.246 (estimation d'un quart en cours), réutilisée telle
      // quelle (Article 11) — une seule requête par quart pour LES 3
      // carburants (la table retourne déjà les 3 colonnes de litrage par
      // ligne), jamais une requête par carburant.
      chargerHistoriqueVentesParQuart(client, siteId, '1', dateISO),
      chargerHistoriqueVentesParQuart(client, siteId, '2', dateISO),
      // Avis Verify informatif (28/08/2026, point 245) — chargé en
      // parallèle, jamais transmis à M.evaluerCarburant/detailQualiteDonneesCommande
      // (aucune dépendance artificielle Verify -> confiance carburant).
      chargerAvisVerifyJour(client, siteId, dateISO),
      // La couverture physique doit repartir de la mesure la plus fraîche
      // connue. Une réception terminée aujourd'hui fournit un jaugeage
      // post-livraison par cuve, plus récent que l'ouverture, sans pour
      // autant remplacer l'ouverture dans la chaîne de rapprochement.
      (global.NexusReceptionDonnees && typeof global.NexusReceptionDonnees.chargerDerniereVisite === 'function')
        ? global.NexusReceptionDonnees.chargerDerniereVisite(client, siteId)
        : Promise.resolve(null),
    ]);

    const receptionPhysiqueDuJour = derniereReception && derniereReception.date_visite === dateISO
      && ['terminee', 'terminee_avec_derogation'].includes(derniereReception.statut)
      ? derniereReception
      : null;

    // Diagnostic contextuel de l'écart (28/08/2026, nouvelle demande de
    // Frédéric) — deux entrées calculées UNE fois, communes aux 3
    // carburants (le relevé qui sert d'ancre au calcul de commande couvre
    // toujours les 3 carburants à la fois, jamais un par carburant, même
    // convention que `sourceAncre` ci-dessus) :
    //   - `releveValide` : le relevé ancre a-t-il déjà été validé par un
    //     manager ? Même règle que diagnosticAbsenceControle/le badge
    //     "à valider" de la Pilotage (`origine !== 'terrain_pompiste'`).
    //     `true` par défaut quand aucune ancre n'est identifiée (rien à
    //     valider dans ce cas, ne doit jamais bloquer artificiellement).
    //   - `verifyManquantsJusquAncre` : sous-ensemble d'`avisVerifyJour`
    //     (déjà chargé ci-dessus, Article 11) dont la date est antérieure
    //     ou égale à la date du relevé ancre — "jusqu'à la date/au quart du
    //     relevé", jamais toute la fenêtre de péremption si l'ancre est plus
    //     récente que certains avis (cas normal : l'ancre EST aujourd'hui,
    //     donc généralement égal à `avisVerifyJour` en entier, mais reste
    //     honnête si l'ancre retombe sur un jour antérieur, Cas B).
    const dateAncre = stockInfo.sourceAncre ? stockInfo.sourceAncre.dateISO : null;
    const releveValide = stockInfo.sourceAncre ? (stockInfo.sourceAncre.origine !== 'terrain_pompiste') : true;
    const verifyManquantsJusquAncre = dateAncre
      ? (avisVerifyJour || []).filter(a => a.date <= dateAncre)
      : (avisVerifyJour || []);

    const evaluationsParCarburant = {};
    const capacitesDisponiblesL = {};
    carburantsActifs.forEach(carburant => {
      const cuvesCarburant = cuves[carburant].cuves || [];
      const limiteRemplissageL = cuvesCarburant.reduce((s, c) => s + (Number(c.limite_remplissage) || 0), 0);
      const stock = stockInfo.parCarburant[carburant] || { stockActuelL: null, stockFiable: false, stockAncreCommandeL: null, stockAncreCommandeFiable: false };
      const consommationMoyenneJour = M.moyenneRecente(historiqueParJour, carburant, dateISO, 14).moyenne;
      const commandeEnCours = commandesEnCours[carburant] || null;
      const stockPostReceptionL = receptionPhysiqueDuJour && M.stockPhysiquePostLivraison
        ? M.stockPhysiquePostLivraison(receptionPhysiqueDuJour, carburant)
        : null;
      // Couverture opérationnelle à deux scénarios (01/09/2026, retour de
      // Frédéric après la réception réelle du jour). Le jaugeage d'ouverture
      // reste l'unique point de départ commun :
      //   1. sans livraison — ce que le stock du matin aurait couvert seul ;
      //   2. avec livraison — ouverture + quantité réellement mesurée lors
      //      de la réception du jour, ou volume commandé si la livraison est
      //      encore attendue aujourd'hui (projection alors conditionnelle).
      //
      // Cette construction évite le mélange temporel précédent : partir du
      // jaugeage post-livraison pris en cours de Q1 puis soustraire un Q1
      // complet revenait à rapprocher deux fenêtres différentes. Ici les
      // deux scénarios partent tous deux de l'ouverture et consomment les
      // mêmes prévisions prudentes par quart (moyenne haute contextuelle du
      // moteur). Le jaugeage post-livraison reste affiché comme dernière
      // vérité physique, mais n'est plus utilisé comme une fausse ouverture.
      const ligneReception = receptionPhysiqueDuJour
        ? (receptionPhysiqueDuJour.lignes || []).find(l => l.carburant === carburant)
        : null;
      const livraisonMesureeAujourdhuiL = ligneReception && ligneReception.quantite_mesuree_l != null
        ? Number(ligneReception.quantite_mesuree_l)
        : null;
      const commandeAttendAujourdHui = !!(commandeEnCours
        && commandeEnCours.livraisonPrevueLe === dateISO
        && commandeEnCours.volumeL != null);
      const livraisonProjeteeAujourdhuiL = livraisonMesureeAujourdhuiL != null
        ? livraisonMesureeAujourdhuiL
        : (commandeAttendAujourdHui ? Number(commandeEnCours.volumeL) : 0);
      const stockCouvertureSansLivraisonL = stock.stockAncreCommandeL;
      const stockCouvertureAvecLivraisonL = stockCouvertureSansLivraisonL != null
        ? Number(stockCouvertureSansLivraisonL) + livraisonProjeteeAujourdhuiL
        : null;
      const couvertureSansLivraison = M.estimerCouvertureParQuart({
        stockDisponibleL: stockCouvertureSansLivraisonL, dateDebutISO: dateISO, quartDepart: 'Q1',
        historiqueQuart1, historiqueQuart2, carburant, joursFeriesISO,
      });
      const couvertureAvecLivraison = livraisonProjeteeAujourdhuiL > 0
        ? M.estimerCouvertureParQuart({
            stockDisponibleL: stockCouvertureAvecLivraisonL, dateDebutISO: dateISO, quartDepart: 'Q1',
            historiqueQuart1, historiqueQuart2, carburant, joursFeriesISO,
          })
        : null;

      // 27/08/2026, règles 1+2 de Frédéric — la RECOMMANDATION s'ancre sur
      // `stockAncreCommandeL` (jaugeage du matin, jamais net des ventes déjà
      // captées aujourd'hui), PAS sur `stock.stockActuelL` ("stock estimé
      // maintenant", réservé à l'affichage temps réel ci-dessous). Voir le
      // commentaire détaillé dans chargerStockEtFiabiliteParCarburant.
      const evaluation = M.evaluerCarburant({
        carburant, maintenantISO: dateISO, heureMaintenantHHMM, config, joursFeriesISO,
        stockActuelL: stock.stockAncreCommandeL, limiteRemplissageL, consommationMoyenneJour,
        historiqueParJour, commandeEnCoursVolumeL: commandeEnCours ? commandeEnCours.volumeL : 0,
        stockFiable: stock.stockAncreCommandeFiable,
        // 27/08/2026, point 15 — signaux bruts pour la fiabilité à 6
        // facteurs (Article 11 : tous déjà chargés/calculés ci-dessus,
        // jamais une requête ou un calcul supplémentaire pour ce seul
        // usage).
        jaugeageOuvertureLe: stock.jaugeageOuvertureLe, ventesDepuisJaugeageL: stock.ventesDepuisJaugeageL,
        pointZeroExiste: stock.pointZeroExiste, anomalieMajeure: stock.anomalieMajeure,
        commandeEnCoursLivraisonPrevueLe: commandeEnCours ? commandeEnCours.livraisonPrevueLe : null,
      });
      evaluationsParCarburant[carburant] = {
        ...evaluation, limiteRemplissageL, commandeEnCours, consommationMoyenneJour,
        // Jaugeage d'ouverture horodaté + ventes captées depuis (25/08/2026,
        // retour de Frédéric, "affichage minimal obligatoire") — transmis
        // tel quel pour l'écran, jamais recalculé une seconde fois côté HTML
        // (Article 11).
        jaugeageOuvertureL: stock.jaugeageOuvertureL, jaugeageOuvertureLe: stock.jaugeageOuvertureLe,
        ventesDepuisJaugeageL: stock.ventesDepuisJaugeageL,
        // Estimation historique du quart en cours (25/08/2026, retour de
        // Frédéric) — exposée pour que l'écran affiche honnêtement
        // "estimation, quart en cours" plutôt que de présenter une valeur
        // estimée comme une mesure certaine (Article 5).
        stockEstimeParHistorique: !!stock.stockEstimeParHistorique,
        ventesEstimeesInclusesL: stock.ventesEstimeesInclusesL || 0,
        // "Stock estimé maintenant" (terminologie exacte de Frédéric) — même
        // valeur que `stockActuelL` passé à evaluerCarburant() ci-dessus,
        // simplement exposée sous son propre nom pour l'écran plutôt que de
        // forcer NEXUS-Carburants-Pilotage-v1.html à aller la rechercher dans
        // scenarioMaintenant (qui ne la porte pas — elle est un INPUT du
        // scénario, pas un de ses résultats).
        stockEstimeMaintenantL: stock.stockActuelL,
        stockFiable: stock.stockFiable,
        // 28/08/2026, v2.263 — écart physique/théorique chiffré, transmis
        // tel quel pour que le résumé "N éléments à résoudre" (voir plus
        // bas) puisse afficher "Écart GO de -1 195 L à qualifier" plutôt
        // qu'un texte générique quand le chiffre est déjà connu.
        ecartPhysiqueTheoriqueL: stock.ecartPhysiqueTheoriqueL != null ? stock.ecartPhysiqueTheoriqueL : null,
        // 28/08/2026, nouvelle demande de Frédéric — diagnostic contextuel
        // de l'écart (Article 11 : NexusCarburantMoteur.diagnostiquerEcartCarburant,
        // le même moteur partagé aussi consulté par Situation aujourd'hui
        // via COMMANDE_CTX, jamais un second calcul de diagnostic). `MB`
        // peut manquer si nexus-carburant-moteur.js n'est pas chargé —
        // robustesse Article 5, jamais un plantage pour un enrichissement
        // secondaire.
        diagnosticEcart: MB && MB.diagnostiquerEcartCarburant
          ? MB.diagnostiquerEcartCarburant({
              statut: stock.statut, ecartL: stock.ecartPhysiqueTheoriqueL,
              releveValide, verifyManquants: verifyManquantsJusquAncre,
            })
          : null,
        // 28/08/2026, retour de Frédéric — "Couverture estimée : mardi Q2"
        // remplace le langage décimal ("4,3 j") dans la vue principale. Même
        // ancre que la recommandation (`stockAncreCommandeL`, jaugeage du
        // matin — Article 11, jamais une 2ᵉ référence de stock concurrente),
        // toujours projetée depuis Q1 de la date du jour (jamais un saut à
        // Q2 selon l'heure actuelle, pour rester mathématiquement cohérent
        // avec l'ancre unique de la carte). `historiqueQuart1`/
        // `historiqueQuart2` déjà chargés ci-dessus (Article 11, aucune
        // requête supplémentaire).
        couvertureEstimeeSansLivraison: couvertureSansLivraison,
        couvertureEstimeeAvecLivraison: couvertureAvecLivraison,
        // Compatibilité : tous les consommateurs historiques continuent de
        // lire couvertureEstimeeParQuart, désormais alignée sur le scénario
        // opérationnel pertinent (avec livraison quand elle existe).
        couvertureEstimeeParQuart: couvertureAvecLivraison || couvertureSansLivraison,
        stockCouvertureL: stockCouvertureAvecLivraisonL,
        stockCouvertureSansLivraisonL,
        livraisonCouvertureL: livraisonProjeteeAujourdhuiL,
        livraisonCouvertureStatut: livraisonMesureeAujourdhuiL != null
          ? 'effectuee'
          : (commandeAttendAujourdHui ? 'attendue' : 'aucune'),
        sourceCouverture: livraisonMesureeAujourdhuiL != null
          ? 'ouverture_plus_livraison_mesuree'
          : (commandeAttendAujourdHui ? 'ouverture_plus_commande_attendue' : 'ancre_ouverture'),
        stockPhysiquePostLivraisonL: stockPostReceptionL,
      };
      capacitesDisponiblesL[carburant] = evaluation.scenarioMaintenant
        ? M.capaciteDisponibleLivraison(limiteRemplissageL, evaluation.scenarioMaintenant.stockPrevuLivraisonL)
        : null;
    });

    // Philosophie de volume à deux modes (25/08/2026, retour de Frédéric) —
    // hors fin de mois, NEXUS cherche à compléter le camion vers 36 000 L ;
    // en fin de mois (5 derniers jours calendaires, provisoire), il revient
    // au comportement historique de minimisation du stock résiduel.
    //
    // Correctif (27/08/2026, retour de Frédéric — logique explicite du
    // passage de mois) : ce "fin de mois" doit se lire sur la date de
    // LIVRAISON, jamais sur la date de commande. Exemple donné par
    // Frédéric : commande passée le dernier jour ouvré du mois (fin de
    // mois), mais livraison le mardi 1er du mois suivant (week-end/jour
    // férié entre les deux) — ce stock arrive déjà sur le mois suivant, un
    // camion plein de 36 000 L est alors voulu, pas une minimisation.
    // Avant ce correctif, `estFinDeMois(dateISO)` (date de commande)
    // bloquait à tort le camion complet dans exactement ce cas. La réserve
    // de sécurité (`reserveCibleJours`, dans evaluerScenarioCommande)
    // n'est PAS concernée par ce correctif : elle reste calculée sur la
    // date de commande, ce qui donne bien 1 jour de réserve (le tampon que
    // Frédéric veut précisément pour ce mardi de livraison), inchangé.
    const fenetreCommandeAujourdhui = M.calculerFenetreLivraison({
      dateCommandeISO: dateISO, heureCommandeHHMM: heureMaintenantHHMM, config, joursFeriesISO,
    });
    // Repli sur la date de commande si aucune fenêtre de livraison n'est
    // calculable (config incohérente/aucun jour de livraison autorisé,
    // §4) — jamais un plantage, comportement historique conservé dans ce
    // cas limite (Article 5, pas de deuxième hypothèse fabriquée).
    const dateReferenceFinDeMois = fenetreCommandeAujourdhui.livraisonISO || dateISO;
    const modeFinDeMois = M.estFinDeMois(dateReferenceFinDeMois);
    const viserCamionComplet = !modeFinDeMois;
    const global_ = M.construireEvaluationGlobale({ evaluationsParCarburant, config, capacitesDisponiblesL, viserCamionComplet });

    // Journal horodaté des recommandations (point 20) — best-effort, JAMAIS
    // attendu (pas de `await` sur la boucle elle-même) : une trace de
    // journal manquante reste préférable à un écran Carburants ralenti ou
    // cassé par un incident d'écriture (même précédent que la
    // traçabilité fraîcheur des secteurs, v2.222). Seuls les carburants
    // `non_calculable` sont exclus (Article 5/point 16 — jamais journaliser
    // une recommandation de "0 L" fictive quand NEXUS ne sait tout
    // simplement pas).
    carburantsActifs.forEach(carburant => {
      const ev = evaluationsParCarburant[carburant];
      if (!ev || ev.etat === 'non_calculable') return;
      const recommandationL = (global_.commandeRecommandee && global_.commandeRecommandee.volumes[carburant] != null)
        ? global_.commandeRecommandee.volumes[carburant] : 0;
      enregistrerRecommandationCarburant(client, siteId, carburant, {
        recommandationL, etat: ev.etat,
        ventesPrevuesL: ev.scenarioMaintenant ? ev.scenarioMaintenant.ventesPrevuesL : null,
        stockAncreCommandeL: stockInfo.parCarburant[carburant] ? stockInfo.parCarburant[carburant].stockAncreCommandeL : null,
      }).catch(e => console.error('Journal recommandation carburant (arrière-plan) :', e));
    });

    // 28/08/2026, v2.263 — causes précises et résolubles bloquant la
    // confirmation de la commande (Article 11 : réutilise les `causes`
    // déjà calculées par detailQualiteDonneesCommande dans chaque
    // évaluation par carburant ; Verify n'y figure jamais tant qu'aucune
    // donnée Verify n'est réellement consommée par ce moteur).
    // 28/08/2026, v2.264, point 2 — retour de Frédéric : "une anomalie ne
    // doit bloquer la recommandation que si elle peut réellement modifier la
    // décision". Filtre aux seuls carburants réellement retenus dans
    // `commandeRecommandee.volumes` quand une commande a pu être établie —
    // un carburant non évalué (ex. GNR) mais absent de la commande (ex. GO
    // seul recommandé) ne doit plus faire dire "commande à confirmer" à
    // cause de LUI. Quand aucune commande n'a pu être établie du tout
    // (`commandeRecommandee` null), aucun filtre : tous les carburants
    // non fiables comptent, car ils expliquent précisément cette absence.
    const carburantsInclusCommande = global_.commandeRecommandee ? Object.keys(global_.commandeRecommandee.volumes) : null;
    const causesAConfirmer = M.resumerCausesConfirmationCommande(evaluationsParCarburant, carburantsInclusCommande);
    // Point 1 — trois états mutuellement exclusifs (jamais "CALCUL SUSPENDU"
    // en même temps qu'une "Commande recommandée" affichée), calculés UNE
    // fois ici et relayés à l'écran (Article 11, aucun second calcul).
    const etatConfirmation = M.etatConfirmationCommande({ commandeRecommandee: global_.commandeRecommandee, causesAConfirmer });

    return {
      ok: true, dateISO, heureMaintenantHHMM, fuseau, cuves, config, modeFinDeMois, avisVerifyJour, causesAConfirmer,
      etatConfirmationCommande: etatConfirmation,
      // 28/08/2026, point 4 — source de l'ancre utilisée pour TOUT le
      // calcul de commande (même décision pour les 3 carburants, un seul
      // objet — Article 11). Déjà calculée par chargerStockEtFiabiliteParCarburant
      // ci-dessus (stockInfo.sourceAncre), simplement relayée ici.
      sourceAncreCommande: stockInfo.sourceAncre || null,
      ...global_,
    };
  }

  // ============================================================
  // ÉCRITURE — cycle de vie d'une commande (§31-34 du cahier).
  // ============================================================

  // Propose/enregistre une commande (§31, bouton "Préparer ma commande").
  // `volumes` = { sp95: L, go: L } (déjà arrondis par le moteur/l'écran).
  // `confidence`/`raison` viennent de l'évaluation globale déjà calculée —
  // jamais recalculés ici (Article 11, ce fichier ne fait qu'écrire).
  async function creerPropositionCommande(client, siteId, { volumes, total, confidence, raison, cutoffDeadline, livraisonPrevueLe, createdBy }) {
    const carburants = {};
    Object.entries(volumes || {}).forEach(([c, v]) => { carburants[c] = { volumeL: v }; });
    const { data, error } = await client.from('carburant_commandes').insert({
      site: siteId, statut: 'proposee', carburants, volume_total_l: total,
      confidence: confidence || 'a_confirmer', raison: raison || null,
      cutoff_deadline: cutoffDeadline || null, livraison_prevue_le: livraisonPrevueLe || null,
      created_by: createdBy || null,
    }).select().single();
    if (error) { console.error('Création proposition commande carburant:', error); return { ok: false, error }; }
    return { ok: true, commande: data };
  }

  // Valide une proposition (§31, "Valider la commande") — le manager
  // confirme qu'il commande réellement ce volume auprès du fournisseur.
  async function validerCommande(client, commandeId, { validePar, volumes, total }) {
    // `statut` reste 'validee' même si le manager a ajusté les volumes
    // avant de confirmer (§31, "Modifier" puis "Valider la commande") — le
    // détail du changement vit dans `carburants` lui-même, jamais un statut
    // 'modifiee' séparé qui compliquerait inutilement le cycle de vie sans
    // information supplémentaire réelle (le volume final EST la source de
    // vérité, peu importe qu'il ait été ajusté avant validation).
    const patch = { statut: 'validee', valide_par: validePar || null, valide_le: new Date().toISOString() };
    if (volumes) {
      const carburants = {};
      Object.entries(volumes).forEach(([c, v]) => { carburants[c] = { volumeL: v }; });
      patch.carburants = carburants;
      if (total != null) patch.volume_total_l = total;
    }
    const { data, error } = await client.from('carburant_commandes').update(patch).eq('id', commandeId).select().maybeSingle();
    if (error) { console.error('Validation commande carburant:', error); return { ok: false, error }; }
    return { ok: true, commande: data };
  }

  // Reporte une proposition (§32) — jamais un simple "fermer l'alerte" :
  // motif obligatoire côté écran, catégorisé (§32 : commande déjà passée
  // hors NEXUS / fournisseur indisponible / décision de trésorerie / volume
  // à modifier / autre).
  async function reporterCommande(client, commandeId, { motifCategorie, motif }) {
    const { data, error } = await client.from('carburant_commandes')
      .update({ statut: 'reportee', motif_report_categorie: motifCategorie || 'autre', motif_report: motif || null })
      .eq('id', commandeId).select().maybeSingle();
    if (error) { console.error('Report commande carburant:', error); return { ok: false, error }; }
    return { ok: true, commande: data };
  }

  // Enregistre une commande passée EN DEHORS de NEXUS (§33) — évite qu'une
  // recommandation persistante et incorrecte continue de s'afficher alors
  // qu'une commande a bien été passée par un autre canal.
  async function enregistrerCommandeHorsNexus(client, siteId, { volumes, total, dateCommande, livraisonPrevueLe, createdBy }) {
    const carburants = {};
    Object.entries(volumes || {}).forEach(([c, v]) => { carburants[c] = { volumeL: v }; });
    const { data, error } = await client.from('carburant_commandes').insert({
      site: siteId, statut: 'hors_nexus', source: 'hors_nexus', carburants, volume_total_l: total,
      confidence: 'fiable', proposee_le: dateCommande ? new Date(dateCommande).toISOString() : new Date().toISOString(),
      livraison_prevue_le: livraisonPrevueLe || null, created_by: createdBy || null,
    }).select().single();
    if (error) { console.error('Enregistrement commande hors NEXUS:', error); return { ok: false, error }; }
    return { ok: true, commande: data };
  }

  // 27/08/2026, refonte qualitative Carburants (point 22, demande de
  // Frédéric) — cycle de vie enrichi de 2 étapes réelles (voir migration
  // carburant_commandes_ajout_statuts_confirmee_reception_controlee) :
  //
  // Confirmation fournisseur (§entre "validee" et "livree") — le manager a
  // obtenu un accusé du fournisseur (appel, e-mail, portail) que la
  // commande validée sera bien honorée. Jamais automatique : seul un
  // manager peut savoir qu'il a reçu cette confirmation (Article 5, aucune
  // donnée Supabase ne permet de le déduire).
  async function confirmerCommandeFournisseur(client, commandeId, { confirmePar, referenceFournisseur }) {
    const patch = {
      statut: 'confirmee_fournisseur', confirmee_fournisseur_par: confirmePar || null,
      confirmee_fournisseur_le: new Date().toISOString(), reference_fournisseur: referenceFournisseur || null,
    };
    const { data, error } = await client.from('carburant_commandes').update(patch).eq('id', commandeId).select().maybeSingle();
    if (error) { console.error('Confirmation fournisseur commande carburant:', error); return { ok: false, error }; }
    return { ok: true, commande: data };
  }

  // Rapprochement réception (§34) — appelé par NEXUS-Carburant-Reception-v1.html
  // une fois une visite terminée, pour relier la commande à sa livraison
  // réelle (chaîne recommandation -> commande -> livraison prévue ->
  // réception). Marque 'livree', jamais une réécriture des volumes
  // recommandés d'origine (la vérité "ce qui a été reçu" reste dans
  // carburant_reception_visite_lignes, ce champ ne fait que pointer vers
  // elle — Article 5, jamais un double enregistrement de la même mesure).
  async function rapprocherCommandeReception(client, commandeId, visiteId, dateLivraison) {
    const { data, error } = await client.from('carburant_commandes')
      .update({ statut: 'livree', visite_reception_id: visiteId, livree_le: dateLivraison || new Date().toISOString().slice(0, 10) })
      .eq('id', commandeId).select().maybeSingle();
    if (error) { console.error('Rapprochement commande/réception carburant:', error); return { ok: false, error }; }
    return { ok: true, commande: data };
  }

  // 27/08/2026, point 22 — étape "Réception contrôlée", distincte de la
  // simple réception physique (statut 'livree' ci-dessus, posé dès le
  // rapprochement). Réutilise le verdict DÉJÀ produit par le parcours
  // qualité de réception existant (NexusReceptionMoteur.libelleStatutReception,
  // lu par "Qualité des réceptions" sur cet écran, Article 11 — jamais un
  // second contrôle qualité inventé ici) : l'appelant transmet le verdict
  // qu'il a déjà sous les yeux, cette fonction ne fait qu'écrire la
  // transition sur la commande. `verdict` ∈ {conforme, ecart_mineur, anomalie}.
  async function controlerReceptionCommande(client, commandeId, { controlePar, verdict, note }) {
    const patch = {
      statut: 'reception_controlee', reception_controlee_par: controlePar || null,
      reception_controlee_le: new Date().toISOString(), reception_controle_verdict: verdict || null,
    };
    if (note) patch.reception_controle_note = note;
    const { data, error } = await client.from('carburant_commandes').update(patch).eq('id', commandeId).select().maybeSingle();
    if (error) { console.error('Contrôle réception commande carburant:', error); return { ok: false, error }; }
    return { ok: true, commande: data };
  }

  // Historique des commandes du site, le plus récent en premier — écran
  // "Historique des commandes" / audit léger, jamais recalculé.
  async function chargerHistoriqueCommandes(client, siteId, limite) {
    const { data, error } = await client.from('carburant_commandes')
      .select('*').eq('site', siteId).order('proposee_le', { ascending: false }).limit(limite || 30);
    if (error) { console.error('Chargement historique commandes carburant:', error); return []; }
    return data || [];
  }

  // Contexte historique de plausibilité (25/08/2026, retour de Frédéric,
  // §"historique de commandes réel comme référence de plausibilité") —
  // réutilise chargerHistoriqueCommandes() telle quelle (Article 11, jamais
  // une deuxième lecture) puis délègue tout le calcul au moteur pur
  // (NexusCarburantCommandeMoteur.construireContextePlausibilite). Fenêtre
  // large (100) car le site pilote n'a que 18 commandes sur mai-août — pas
  // de risque de payload excessif pour ce volume, à revoir si le nombre de
  // sites/commandes grandit significativement.
  async function chargerContextePlausibiliteCarburant(client, siteId, volumeProposeL) {
    const M = global.NexusCarburantCommandeMoteur;
    const historique = await chargerHistoriqueCommandes(client, siteId, 100);
    if (!M || !historique.length) {
      return { nombreCommandes: 0, volumeMoyenL: null, volumeMedianL: null, volumeSpTypiqueL: null, volumeGoTypiqueL: null, intervalleMoyenJours: null, joursDepuisDerniereCommande: null, joursAvantProchaineCommandeEstimee: null, ecartAuPattern: null };
    }
    return M.construireContextePlausibilite(historique, volumeProposeL);
  }

  global.NexusCarburantCommandeDonnees = {
    chargerConfigEtCuves, chargerJoursFeries, chargerHistoriqueVentesParJour,
    chargerCommandeEnCoursParCarburant, chargerStockEtFiabiliteParCarburant,
    evaluerCommandeCarburantSite,
    chargerJournalRecommandationExistant, enregistrerRecommandationCarburant,
    creerPropositionCommande, validerCommande, reporterCommande,
    confirmerCommandeFournisseur, controlerReceptionCommande,
    enregistrerCommandeHorsNexus, rapprocherCommandeReception, chargerHistoriqueCommandes,
    chargerContextePlausibiliteCarburant,
  };
})(typeof window !== 'undefined' ? window : globalThis);
