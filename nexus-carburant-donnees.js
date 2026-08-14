// ============================================================
// NEXUS Carburants — colle Supabase (11/08/2026)
//
// Phase 1 de "NEXUS Carburants Pilotage" (vision détaillée de Frédéric,
// 6 familles d'intelligence bâties sur le moteur existant, sans nouvelle
// saisie). Ce fichier ne fait AUCUN calcul (Article 11 — un moteur pur ne
// touche jamais Supabase) : il charge les lignes brutes et les passe à
// nexus-carburant-moteur.js, exactement comme nexus-rapport-donnees.js le
// fait pour Rapport NEXUS et nexus-coach-fdj-donnees.js pour Coach FDJ.
//
// Deux familles de chargeurs :
//  - chargerVentesPeriode() : litrage déjà capté par NEXUS Verify
//    (audits_caisse.litrage_gazole/sp95/gnr) sur une période calendaire —
//    alimente Performance commerciale (volumes, mix, comparaisons).
//  - chargerControleJour() : reproduit exactement la chaîne de calcul de
//    NEXUS-Carburants-v1.html (dernier relevé réel → ventes depuis ce
//    relevé → théorique/écart/statut) pour un jour donné, en lecture
//    seule — jamais une deuxième formule pour la même question, réutilisé
//    tel quel par Brief NEXUS et Carburants Pilotage.
//
// Inclure après nexus-carburant-moteur.js :
// <script src="nexus-carburant-donnees.js"></script>
// ------------------------------------------------------------

(function (global) {
  const CARBURANTS_INFO = [
    { cle: 'sp95', nom: 'Sans plomb (SP95)' },
    { cle: 'go', nom: 'Gasoil (GO)' },
    { cle: 'gnr', nom: 'Gasoil non routier (GNR)' },
  ];

  // Volumes vendus sur [debut, fin] (bornes incluses), par carburant, plus
  // une mesure de couverture honnête : nbQuartsAvecLitrage / nbQuartsTotal
  // sur la période — pour que l'écran puisse dire "sur 4 quarts, 3 ont un
  // litrage renseigné" plutôt que de laisser croire à une mesure complète.
  async function chargerVentesPeriode(client, siteId, debut, fin) {
    const { data, error } = await client.from('audits_caisse')
      .select('litrage_gazole,litrage_sp95,litrage_gnr')
      .eq('site', siteId).gte('date', debut).lte('date', fin);
    if (error) { console.error('Chargement ventes carburant (période):', error); return { ventes: { go: null, sp95: null, gnr: null }, nbQuartsTotal: 0, nbQuartsAvecLitrage: 0 }; }
    const lignes = data || [];
    const ventes = global.NexusCarburantMoteur.sommerVentesPeriode(lignes);
    const nbQuartsAvecLitrage = lignes.filter(l => l.litrage_gazole != null || l.litrage_sp95 != null || l.litrage_gnr != null).length;
    return { ventes, nbQuartsTotal: lignes.length, nbQuartsAvecLitrage };
  }

  // Dernier "point zéro carburants" valide, à date <= dateLimite ou sans
  // limite (14/08/2026, demande de Frédéric : "point zéro" = un contrôle
  // physique certifié qui devient la nouvelle référence de calcul,
  // exactement comme fdj_stock_references pour le stock FDJ). Retourne
  // null si aucun point zéro n'a jamais été certifié pour ce site — dans ce
  // cas la chaîne de calcul continue de fonctionner exactement comme avant
  // (aucune régression pour les sites qui n'utilisent pas cette fonction).
  async function chargerDernierPointZero(client, siteId, dateLimite) {
    let requete = client.from('carburant_stock_references')
      .select('*').eq('site', siteId).eq('statut', 'valide');
    if (dateLimite) requete = requete.lte('date', dateLimite);
    const { data: ref, error: e1 } = await requete
      .order('date', { ascending: false }).order('created_at', { ascending: false })
      .limit(1).maybeSingle();
    if (e1) { console.error('Chargement point zéro carburants:', e1); return null; }
    if (!ref) return null;
    const { data: lignes, error: e2 } = await client.from('carburant_stock_reference_lignes')
      .select('carburant,stock_reel').eq('reference_id', ref.id);
    if (e2) { console.error('Chargement lignes point zéro carburants:', e2); return null; }
    const parCarburant = { go: null, sp95: null, gnr: null };
    (lignes || []).forEach(l => { parCarburant[l.carburant] = Number(l.stock_reel); });
    return { ...ref, lignes: parCarburant };
  }

  // Reprend exactement la chaîne de NEXUS-Carburants-v1.html : dernier
  // relevé RÉEL avant `date` (ancre), ventes captées depuis le jour de ce
  // relevé INCLUS jusqu'à `date` EXCLUE (convention "relevé = ouverture du
  // jour", formalisée le 14/08/2026 — voir l'en-tête de
  // nexus-carburant-moteur.js), stock réel DE `date` si un relevé existe
  // pour ce jour précis. Retourne { parCarburant: {go:{...},sp95:{...},gnr:{...}},
  // aucunReleve: bool } — `aucunReleve` distingue explicitement "aucun
  // relevé n'existe encore pour ce site" de "un relevé existe mais les
  // données sont insuffisantes pour calculer un écart", deux situations
  // honnêtement différentes à l'affichage (Brief/Pilotage).
  //
  // POINT ZÉRO (14/08/2026, demande de Frédéric) : si un point zéro certifié
  // existe et qu'il est plus récent que le dernier relevé RÉEL antérieur à
  // `date` (ou qu'aucun relevé réel n'existe), il devient l'ANCRE du calcul
  // à la place de ce relevé — le relevé réel plus ancien est explicitement
  // disqualifié ("l'ancienne chaîne temporelle n'est pas suffisamment
  // fiable pour servir de référence", pas de tentative de le corriger). Si
  // `date` est antérieure ou égale à la date du point zéro lui-même, la
  // période est "historique non fiable" : NEXUS ne calcule et n'affiche
  // AUCUN écart pour cette période (Article 5 — mieux vaut le dire
  // explicitement que d'afficher un théorique construit sur une ancre
  // disqualifiée). Un relevé réel POSTÉRIEUR au point zéro redevient une
  // ancre normale pour les dates encore plus tardives : le point zéro n'est
  // qu'un plancher, pas une ancre permanente.
  async function chargerControleJour(client, siteId, date) {
    const M = global.NexusCarburantMoteur;
    const [{ data: releveDuJour, error: e1 }, { data: dernierReleve, error: e2 }, pointZero] = await Promise.all([
      client.from('carburant_releves').select('*').eq('site', siteId).eq('date', date).maybeSingle(),
      client.from('carburant_releves').select('*').eq('site', siteId).lt('date', date).order('date', { ascending: false }).limit(1).maybeSingle(),
      chargerDernierPointZero(client, siteId, date),
    ]);
    if (e1) console.error('Chargement relevé carburant du jour (contrôle):', e1);
    if (e2) console.error('Chargement dernier relevé carburant (contrôle):', e2);

    if (!releveDuJour && !dernierReleve && !pointZero) {
      return { parCarburant: null, aucunReleve: true };
    }

    // Historique antérieur ou égal au point zéro : rapprochement non fiable,
    // libellé exact demandé par Frédéric — jamais un écart calculé sur une
    // ancre déjà disqualifiée.
    if (pointZero && date <= pointZero.date) {
      return {
        parCarburant: null, aucunReleve: false, historiqueNonFiable: true,
        pointZero, dateDernierReleve: dernierReleve ? dernierReleve.date : null,
        releveDuJour: releveDuJour || null, dernierReleve: dernierReleve || null,
        messageHistoriqueNonFiable: `Rapprochement historique non fiable — période précédant le point zéro du ${pointZero.date}. Les horaires de jaugeage et la période de ventes n'étaient pas suffisamment synchronisés pour qualifier cet écart. Non reporté dans les calculs ultérieurs.`,
      };
    }

    // Le point zéro devient l'ancre s'il est plus récent que le dernier
    // relevé réel antérieur à `date` (ou si aucun relevé réel n'existe) :
    // c'est la certification qui doit servir de référence, pas une lecture
    // plus ancienne devenue non fiable.
    const ancreEstPointZero = !!pointZero && (!dernierReleve || pointZero.date >= dernierReleve.date);
    const dateAncre = ancreEstPointZero ? pointZero.date : (dernierReleve ? dernierReleve.date : null);

    // Convention temporelle formalisée par Frédéric le 14/08/2026 (voir
    // l'en-tête de nexus-carburant-moteur.js, "CONVENTION TEMPORELLE") :
    // le relevé représente le stock à l'OUVERTURE du jour. Les ventes à
    // sommer sont donc celles datées >= le jour de l'ANCRE (dernier relevé
    // réel, ou point zéro s'il est plus récent — ses propres ventes ont eu
    // lieu après SA propre ouverture, elles comptent) ET < le jour du
    // relevé COURANT (les ventes de ce jour n'ont pas encore eu lieu au
    // moment de cette ouverture, elles ne comptent PAS ici — elles
    // compteront dans le théorique du PROCHAIN relevé).
    // Historique de ce point précis : v2.79/v2.82 avaient d'abord exclu les
    // DEUX bornes (toujours vide en cadence quotidienne, théorique jamais
    // calculable), puis v2.82 avait à tort inclus la date cible elle-même
    // (comptait des ventes non encore advenues au moment de l'ouverture) —
    // corrigé ici en bornes [ancre incluse, date cible exclue).
    let ventesDepuis = { go: null, sp95: null, gnr: null };
    if (dateAncre) {
      const { data: lignesVentes, error: e3 } = await client.from('audits_caisse')
        .select('litrage_gazole,litrage_sp95,litrage_gnr')
        .eq('site', siteId).gte('date', dateAncre).lt('date', date);
      if (e3) console.error('Chargement ventes depuis dernier relevé (contrôle):', e3);
      ventesDepuis = M.sommerVentesPeriode(lignesVentes || []);
    }

    const parCarburant = {};
    CARBURANTS_INFO.forEach(({ cle }) => {
      const reelDuJour = cle === 'go'
        ? M.stockReelGoTotal(releveDuJour)
        : (releveDuJour ? releveDuJour[`stock_reel_${cle}`] : null);
      // Stock de l'ancre : un point zéro certifie UNE valeur totale par
      // carburant (pas de détail par cuve, contrairement à un relevé réel
      // GO qui somme 2 cuves) — d'où la lecture directe de pointZero.lignes
      // quand l'ancre est le point zéro, sans passer par stockReelGoTotal.
      const dernierReel = ancreEstPointZero
        ? (pointZero.lignes ? pointZero.lignes[cle] : null)
        : (cle === 'go' ? M.stockReelGoTotal(dernierReleve) : (dernierReleve ? dernierReleve[`stock_reel_${cle}`] : null));
      const livraison = releveDuJour ? (releveDuJour[`livraison_${cle}`] || 0) : 0;
      const mouvement = releveDuJour ? (releveDuJour[`mouvement_${cle}`] || 0) : 0;
      // 13/08/2026, audit Carburants Pilotage : la page a besoin d'afficher
      // le "stock physique" en toutes lettres (jauge + tableau), pas
      // seulement l'écart déjà calculé — reelDuJour/dernierReel sont donc
      // remontés tels quels en plus du résultat de calculerCarburant,
      // jamais recalculés une seconde fois côté HTML.
      parCarburant[cle] = {
        ...M.calculerCarburant({ dernierReel, reelDuJour, livraison, mouvement, ventes: ventesDepuis[cle] }),
        reelDuJour, dernierReel, livraison, mouvement,
        // Remonté tel quel (14/08/2026, retour de Frédéric) pour que l'écran
        // puisse expliquer PRÉCISÉMENT pourquoi le théorique est absent
        // (NexusCarburantMoteur.motifTheoriqueIndisponible) plutôt que
        // d'afficher juste "Données insuffisantes" — jamais recalculé une
        // seconde fois côté HTML, seulement transmis.
        ventesDepuis: ventesDepuis[cle],
        // Stock physique "actuel" à afficher : la dernière mesure RÉELLE
        // connue, que ce soit celle du jour (si le jaugeage est déjà fait)
        // ou la précédente sinon — jamais une valeur théorique présentée
        // comme physique (Article 5).
        stockPhysiqueAffiche: reelDuJour != null ? reelDuJour : dernierReel,
      };
    });

    return {
      parCarburant, aucunReleve: false, dateDernierReleve: dernierReleve ? dernierReleve.date : null,
      // Point zéro utilisé comme ancre (ou null) : Pilotage l'utilise pour
      // afficher explicitement "Référence : point zéro du [date] ([source])"
      // plutôt que de laisser croire que le calcul part d'un jaugeage
      // quotidien classique.
      pointZero, ancreEstPointZero,
      // 13/08/2026, audit Carburants Pilotage : la page a besoin du détail
      // du relevé du jour (pour signaler une livraison) et du dernier
      // relevé réel (pour le message "jaugeage du jour manquant, dernier
      // relevé X — stock théorique actuel Y") — déjà chargés ci-dessus,
      // simplement remontés plutôt que ré-interrogés une seconde fois.
      releveDuJour: releveDuJour || null, dernierReleve: dernierReleve || null,
    };
  }

  // Configuration des cuves par carburant (13/08/2026, audit Carburants
  // Pilotage : "rends moi paramétrable le type de carburant et répartition
  // dans les cuves"). Lit station_config.cuves_carburants — repli explicite
  // sur les valeurs réelles connues de Vito Sainte-Marie Usine si la
  // config n'existe pas encore pour un site (jamais un écran vide avant le
  // premier passage en Paramètres), mais seulement comme valeur par
  // défaut affichée : la vraie source, éditable, reste
  // station_config.cuves_carburants.
  const CUVES_PAR_DEFAUT = {
    go: { actif: true, label: 'Gasoil (GO)', cuves: [{ id: 'cuve1', label: 'Cuve 1', capacite: 20000 }, { id: 'cuve2', label: 'Cuve 2', capacite: 10000 }] },
    sp95: { actif: true, label: 'Sans plomb (SP95)', cuves: [{ id: 'unique', label: 'Cuve unique', capacite: 30000 }] },
    gnr: { actif: true, label: 'Gasoil non routier (GNR)', cuves: [{ id: 'unique', label: 'Cuve unique', capacite: 30000 }] },
  };
  async function chargerCuvesConfig(client, siteId) {
    const { data, error } = await client.from('station_config').select('cuves_carburants').eq('site', siteId).maybeSingle();
    if (error) { console.error('Chargement cuves_carburants:', error); return { config: CUVES_PAR_DEFAUT, parDefaut: true }; }
    if (data && data.cuves_carburants) return { config: data.cuves_carburants, parDefaut: false };
    return { config: CUVES_PAR_DEFAUT, parDefaut: true };
  }

  // Consommation journalière moyenne récente, par carburant — base de
  // calcul de l'autonomie (audit §7). Moyenne sur les jours RÉELLEMENT
  // couverts par un litrage (jamais divisée par la taille fixe de la
  // fenêtre demandée : un site qui n'a que 3 jours de données sur les 7
  // derniers ne doit pas voir sa moyenne diluée par 4 jours à zéro qui
  // n'existent pas). Retourne null pour un carburant sans aucune donnée
  // sur la fenêtre.
  async function chargerConsommationJournaliereMoyenne(client, siteId, dateFinExclusive, joursFenetre = 7) {
    const fin = new Date(`${dateFinExclusive}T00:00:00`);
    const debut = new Date(fin);
    debut.setDate(debut.getDate() - joursFenetre);
    const debutISO = `${debut.getFullYear()}-${String(debut.getMonth() + 1).padStart(2, '0')}-${String(debut.getDate()).padStart(2, '0')}`;
    const { data, error } = await client.from('audits_caisse')
      .select('date,litrage_gazole,litrage_sp95,litrage_gnr')
      .eq('site', siteId).gte('date', debutISO).lt('date', dateFinExclusive);
    if (error) { console.error('Chargement consommation moyenne carburant:', error); return { go: null, sp95: null, gnr: null }; }
    const lignes = data || [];
    const champs = { go: 'litrage_gazole', sp95: 'litrage_sp95', gnr: 'litrage_gnr' };
    const resultat = {};
    Object.entries(champs).forEach(([cle, champ]) => {
      const joursConcernes = new Set();
      let somme = 0;
      lignes.forEach(l => { if (l[champ] != null) { somme += Number(l[champ]); joursConcernes.add(l.date); } });
      resultat[cle] = joursConcernes.size > 0 ? somme / joursConcernes.size : null;
    });
    return resultat;
  }

  // Jours sans jaugeage saisi (13/08/2026, demande de Frédéric : "ça fait
  // 2-3 jours que le jaugeage n'a pas été indiqué") — détecte les trous
  // récents dans `carburant_releves` pour que Carburants Pilotage puisse
  // pointer directement les jours à rattraper, plutôt que de laisser le
  // manager les retrouver de tête. Fenêtre volontairement bornée
  // (`fenetreJours`, 14 par défaut) : au-delà, un site sans relevé depuis
  // longtemps a un problème plus profond qu'un oubli de 2-3 jours, hors
  // périmètre de ce widget. Jamais de jour signalé "manquant" avant le
  // tout premier relevé RÉEL du site (Article 5) — un site fraîchement
  // onboardé n'a simplement pas encore commencé, ce n'est pas un oubli.
  async function chargerJoursSansReleve(client, siteId, dateDuJour, fenetreJours = 14) {
    const { data: premier, error: e1 } = await client.from('carburant_releves')
      .select('date').eq('site', siteId).order('date', { ascending: true }).limit(1).maybeSingle();
    if (e1) { console.error('Chargement premier relevé carburant (rattrapage):', e1); return { jours: [], premierReleve: null }; }
    if (!premier) return { jours: [], premierReleve: null };

    const bornInf = new Date(`${dateDuJour}T00:00:00`);
    bornInf.setDate(bornInf.getDate() - fenetreJours);
    const fenetreDebut = `${bornInf.getFullYear()}-${String(bornInf.getMonth() + 1).padStart(2, '0')}-${String(bornInf.getDate()).padStart(2, '0')}`;
    const dateDebut = premier.date > fenetreDebut ? premier.date : fenetreDebut;

    const { data: releves, error: e2 } = await client.from('carburant_releves')
      .select('date').eq('site', siteId).gte('date', dateDebut).lt('date', dateDuJour);
    if (e2) { console.error('Chargement relevés carburant (rattrapage):', e2); return { jours: [], premierReleve: premier.date }; }
    const connues = new Set((releves || []).map(r => r.date));

    const jours = [];
    const cursor = new Date(`${dateDebut}T00:00:00`);
    const limite = new Date(`${dateDuJour}T00:00:00`);
    while (cursor < limite) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      if (!connues.has(iso)) jours.push(iso);
      cursor.setDate(cursor.getDate() + 1);
    }
    return { jours, premierReleve: premier.date };
  }

  // Dernière livraison connue (n'importe quel carburant), même si elle
  // n'est pas celle du relevé du jour (13/08/2026, audit §6 : "une
  // livraison ne doit pas disparaître dans les calculs"). Utilisé quand le
  // relevé du jour n'a lui-même aucune livraison, pour ne pas laisser le
  // bloc "Dernière livraison" vide alors qu'une livraison récente existe.
  async function chargerDerniereLivraison(client, siteId) {
    const { data, error } = await client.from('carburant_releves')
      .select('date,livraison_go,livraison_sp95,livraison_gnr')
      .eq('site', siteId)
      .or('livraison_go.gt.0,livraison_sp95.gt.0,livraison_gnr.gt.0')
      .order('date', { ascending: false }).limit(1).maybeSingle();
    if (error) { console.error('Chargement dernière livraison carburant:', error); return null; }
    return data;
  }

  // Certifie un nouveau point zéro carburants (14/08/2026, demande de
  // Frédéric : "Créer un point zéro carburants" / "Certifier un stock de
  // référence", exactement comme validerInventaireRef() pour FDJ). N'écrit
  // JAMAIS dans carburant_releves ni ne modifie l'historique existant : un
  // point zéro est une table séparée, purement additive — l'ancien
  // historique reste archivé et consultable tel quel, seulement disqualifié
  // comme ancre de calcul pour les dates postérieures (voir
  // chargerControleJour ci-dessus). `valeurs` : { go: {stockReel, theoriqueAvant},
  // sp95: {...}, gnr: {...} } — theoriqueAvant est optionnel, pure
  // traçabilité, jamais réutilisé dans un calcul.
  async function certifierPointZero(client, siteId, { date, heure, source, controlePar, type, note, valeurs }) {
    const { data: ref, error: e1 } = await client.from('carburant_stock_references').insert({
      site: siteId, date, heure: heure || null, source: source || 'terrain',
      controle_par: controlePar || null, type: type || 'initialisation',
      statut: 'valide', note: note || null,
    }).select().single();
    if (e1) { console.error('Certification point zéro carburants:', e1); return { ok: false, error: e1 }; }

    const lignes = CARBURANTS_INFO.map(({ cle }) => {
      const v = (valeurs && valeurs[cle]) || {};
      return {
        reference_id: ref.id, site: siteId, carburant: cle,
        stock_reel: Number(v.stockReel) || 0,
        stock_theorique_avant: v.theoriqueAvant != null ? Number(v.theoriqueAvant) : null,
      };
    });
    const { error: e2 } = await client.from('carburant_stock_reference_lignes').insert(lignes);
    if (e2) { console.error('Certification lignes point zéro carburants:', e2); return { ok: false, error: e2 }; }

    return { ok: true, reference: ref };
  }

  global.NexusCarburantDonnees = {
    CARBURANTS_INFO, chargerVentesPeriode, chargerControleJour, chargerJoursSansReleve,
    chargerCuvesConfig, chargerConsommationJournaliereMoyenne, CUVES_PAR_DEFAUT,
    chargerDerniereLivraison, chargerDernierPointZero, certifierPointZero,
  };
})(typeof window !== 'undefined' ? window : globalThis);
