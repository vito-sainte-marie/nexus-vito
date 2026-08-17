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
  // CORRECTIF 14/08/2026 (retour de Frédéric, "recomptage ne doit pas
  // créer un deuxième point zéro automatiquement sauf nouvelle
  // certification explicite") : seules les certifications de type
  // 'initialisation' (une "nouvelle référence", action délibérée) peuvent
  // devenir l'ANCRE de calcul. Un 'recomptage' reste enregistré et visible
  // dans le journal (chargerHistoriquePointsZero, jamais filtré), mais
  // n'est jamais choisi ici — sinon un simple contrôle physique
  // intermédiaire remplacerait silencieusement la référence de calcul et
  // masquerait l'écart qu'il est censé révéler.
  async function chargerDernierPointZero(client, siteId, dateLimite) {
    let requete = client.from('carburant_stock_references')
      .select('*').eq('site', siteId).eq('statut', 'valide').eq('type', 'initialisation');
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

    // Le point zéro devient l'ancre s'il est plus récent que le dernier
    // relevé réel antérieur à `date` (ou si aucun relevé réel n'existe) :
    // c'est la certification qui doit servir de référence, pas une lecture
    // plus ancienne devenue non fiable.
    const ancreEstPointZero = !!pointZero && (!dernierReleve || pointZero.date >= dernierReleve.date);
    const dateAncre = ancreEstPointZero ? pointZero.date : (dernierReleve ? dernierReleve.date : null);

    // CORRECTIF 14/08/2026 (retour de Frédéric le jour même de la première
    // certification) : "Créer un point zéro ne signifie pas mettre les
    // stocks à zéro. Cela signifie : stock théorique de départ = stock
    // physique certifié, donc écart initial = 0." Le jour même de la
    // certification, la fenêtre de ventes [ancre incluse, date exclue) est
    // vide par construction (ancre == date) — ce n'est PAS une donnée
    // manquante, c'est zéro jour écoulé depuis la certification, donc zéro
    // vente. Une première version de ce correctif traitait ce jour comme
    // "historique non fiable" (jauges masquées) : c'était une erreur,
    // corrigée ici — voir plus bas.
    const referenceCertifieeCeJour = ancreEstPointZero && dateAncre === date;

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
    if (referenceCertifieeCeJour) {
      // Zéro jour écoulé depuis la certification : zéro vente, explicite —
      // jamais une requête sur une plage vide qui redonnerait `null` et
      // ferait retomber le statut sur "Données insuffisantes".
      ventesDepuis = { go: 0, sp95: 0, gnr: 0 };
    } else if (dateAncre) {
      const { data: lignesVentes, error: e3 } = await client.from('audits_caisse')
        .select('litrage_gazole,litrage_sp95,litrage_gnr')
        .eq('site', siteId).gte('date', dateAncre).lt('date', date);
      if (e3) console.error('Chargement ventes depuis dernier relevé (contrôle):', e3);
      ventesDepuis = M.sommerVentesPeriode(lignesVentes || []);
    }

    const parCarburant = {};
    CARBURANTS_INFO.forEach(({ cle }) => {
      let reelDuJour = cle === 'go'
        ? M.stockReelGoTotal(releveDuJour)
        : (releveDuJour ? releveDuJour[`stock_reel_${cle}`] : null);
      // Stock de l'ancre : un point zéro certifie UNE valeur totale par
      // carburant (pas de détail par cuve, contrairement à un relevé réel
      // GO qui somme 2 cuves) — d'où la lecture directe de pointZero.lignes
      // quand l'ancre est le point zéro, sans passer par stockReelGoTotal.
      const dernierReel = ancreEstPointZero
        ? (pointZero.lignes ? pointZero.lignes[cle] : null)
        : (cle === 'go' ? M.stockReelGoTotal(dernierReleve) : (dernierReleve ? dernierReleve[`stock_reel_${cle}`] : null));
      // Jour de la référence sans jaugeage séparé saisi ce jour-là (le cas
      // normal — un point zéro n'est pas un relevé) : le stock physique
      // AFFICHÉ est le stock certifié lui-même, jamais une case vide le
      // jour même de la certification (Article 5 — un point zéro EST une
      // mesure physique). Si un relevé réel existe aussi ce jour précis
      // (cas rare), il prime : l'écart devient alors réellement informatif.
      if (referenceCertifieeCeJour && reelDuJour == null) reelDuJour = dernierReel;
      // CORRECTIF 14/08/2026 (retour de Frédéric, "BUG CRITIQUE POINT
      // ZÉRO") : le jour même de la certification, toute livraison/
      // mouvement saisi sur le relevé de CE jour est présumé déjà reflété
      // dans le stock physique certifié lui-même (le point zéro est une
      // mesure prise à un instant précis — ici 02:00 — qui incorpore déjà
      // tout ce qui s'est passé avant cet instant). Les compter en plus du
      // stock certifié revient à les compter deux fois : c'est exactement
      // ce qui produisait un théorique fictif de dernierReel+livraison
      // (ex. 24 537+15 000=39 537 L GO) comparé à un stock réel bien plus
      // bas, donc un "écart" énorme et faux (-13 936 L GO / -16 097 L
      // SP95 dans le cas réel signalé). Règle : après certification, seuls
      // les mouvements STRICTEMENT postérieurs au point zéro comptent — en
      // l'absence d'horodatage précis sur chaque mouvement, la limite la
      // plus honnête que permette le modèle actuel (granularité JOUR) est
      // de ne jamais rejouer un mouvement daté du jour même de la
      // certification, symétriquement à ventesDepuis déjà mis à 0 plus
      // haut pour ce même jour.
      const livraison = referenceCertifieeCeJour ? 0 : (releveDuJour ? (releveDuJour[`livraison_${cle}`] || 0) : 0);
      const mouvement = referenceCertifieeCeJour ? 0 : (releveDuJour ? (releveDuJour[`mouvement_${cle}`] || 0) : 0);
      // 13/08/2026, audit Carburants Pilotage : la page a besoin d'afficher
      // le "stock physique" en toutes lettres (jauge + tableau), pas
      // seulement l'écart déjà calculé — reelDuJour/dernierReel sont donc
      // remontés tels quels en plus du résultat de calculerCarburant,
      // jamais recalculés une seconde fois côté HTML.
      const resultat = M.calculerCarburant({ dernierReel, reelDuJour, livraison, mouvement, ventes: ventesDepuis[cle] });
      // Le jour de la certification, statutCarburant() renverrait "Données
      // insuffisantes" (ecartRatio null car ventes=0 → division évitée par
      // calculerEcartRatio) — faux : l'écart EST connu, il vaut 0 par
      // construction. Statut dédié, reconnu tel quel par
      // NexusCarburantMoteur.fiabiliteControle() (niveau "ok").
      if (referenceCertifieeCeJour) resultat.statut = 'Référence certifiée';
      parCarburant[cle] = {
        ...resultat,
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
      // afficher explicitement "Référence NEXUS : certifiée le [date]
      // ([source])" plutôt que de laisser croire que le calcul part d'un
      // jaugeage quotidien classique.
      pointZero, ancreEstPointZero, referenceCertifieeCeJour,
      // Message "élégant" demandé par Frédéric (14/08/2026), affiché en
      // plus des jauges (jamais à leur place) le jour même de la
      // certification.
      messageReferenceCertifiee: referenceCertifieeCeJour
        ? `Nouvelle référence carburants certifiée le ${pointZero.date}. Les écarts antérieurs ne sont plus propagés. Les prochains écarts seront calculés à partir de cette référence.`
        : null,
      // Explication secondaire ("Voir pourquoi l'historique précédent a été
      // neutralisé"), reléguée derrière un lien plutôt qu'affichée en
      // premier plan comme dans la toute première version de ce correctif
      // — l'ancien texte reste disponible ici, jamais supprimé, seulement
      // démoté au rang d'information secondaire.
      messageHistoriqueNeutralise: (pointZero && ancreEstPointZero)
        ? `L'historique de rapprochement antérieur au ${pointZero.date} n'était pas suffisamment fiable pour servir de référence (jaugeages et fenêtres de ventes pas toujours synchronisés) — il reste archivé et consultable, mais n'est plus utilisé pour qualifier les écarts à partir de cette date.`
        : null,
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

  // Historique des points zéro certifiés (14/08/2026, section "Historique"
  // de Carburants Pilotage, demande de Frédéric) — simple journal, le plus
  // récent en premier, avec le détail des 3 carburants par certification.
  // Jamais recalculé : c'est un journal d'actions, pas un contrôle.
  async function chargerHistoriquePointsZero(client, siteId, limite = 20) {
    const { data: refs, error: e1 } = await client.from('carburant_stock_references')
      .select('*').eq('site', siteId).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(limite);
    if (e1) { console.error('Chargement historique points zéro carburants:', e1); return []; }
    if (!refs || !refs.length) return [];
    const { data: lignes, error: e2 } = await client.from('carburant_stock_reference_lignes')
      .select('reference_id,carburant,stock_reel').in('reference_id', refs.map(r => r.id));
    if (e2) console.error('Chargement lignes historique points zéro carburants:', e2);
    const parRef = {};
    (lignes || []).forEach(l => {
      if (!parRef[l.reference_id]) parRef[l.reference_id] = { go: null, sp95: null, gnr: null };
      parRef[l.reference_id][l.carburant] = Number(l.stock_reel);
    });
    return refs.map(r => ({ ...r, lignes: parRef[r.id] || { go: null, sp95: null, gnr: null } }));
  }

  // Historique des relevés (14/08/2026, section "Historique" de Carburants
  // Pilotage) — reproduit, jour par jour sur une fenêtre récente, le même
  // calcul que chargerControleJour() (même règle d'ancrage : dernier relevé
  // réel, ou point zéro s'il est plus récent — voir son en-tête pour le
  // détail de la convention), mais en UNE passe sur des données déjà
  // chargées plutôt que N appels séparés à chargerControleJour (qui
  // multiplierait les allers-retours réseau pour une simple liste). Aucune
  // nouvelle règle de calcul : les mêmes fonctions pures du moteur
  // (`calculerCarburant`, `stockReelGoTotal`) sont réutilisées à l'identique
  // pour chaque jour. Retourne du plus récent au plus ancien :
  // [{ date, referenceCertifieeCeJour, ancreEstPointZero, parCarburant: {go:{theorique,ecart,statut,...}, ...} }, ...]
  async function chargerHistoriqueReleves(client, siteId, joursFenetre = 30, dateFin) {
    const M = global.NexusCarburantMoteur;
    const fin = dateFin || new Date().toISOString().slice(0, 10);
    const finDate = new Date(`${fin}T00:00:00`);
    const debutDate = new Date(finDate);
    debutDate.setDate(debutDate.getDate() - joursFenetre);
    const debutISO = `${debutDate.getFullYear()}-${String(debutDate.getMonth() + 1).padStart(2, '0')}-${String(debutDate.getDate()).padStart(2, '0')}`;

    // Relevés de la fenêtre + une marge de sécurité de relevés plus anciens
    // (pour disposer de l'ancre du tout premier relevé affiché, même si la
    // cadence n'est pas strictement quotidienne) — chargés ascendants pour
    // un balayage séquentiel simple.
    const { data: relevesDesc, error: e1 } = await client.from('carburant_releves')
      .select('*').eq('site', siteId).lte('date', fin)
      .order('date', { ascending: false }).limit(joursFenetre + 5);
    if (e1) { console.error('Chargement historique relevés carburant:', e1); return []; }
    const releves = (relevesDesc || []).slice().reverse(); // ascendant
    if (!releves.length) return [];

    // CORRECTIF 14/08/2026 : seules les certifications 'initialisation'
    // servent d'ancre ici aussi (voir chargerDernierPointZero) — un
    // 'recomptage' n'est jamais rejoué comme référence de calcul dans
    // l'historique, il reste un journal de contrôle, pas une nouvelle
    // frontière.
    const { data: pointsZeroAsc, error: e2 } = await client.from('carburant_stock_references')
      .select('*').eq('site', siteId).eq('statut', 'valide').eq('type', 'initialisation').lte('date', fin)
      .order('date', { ascending: true });
    if (e2) console.error('Chargement points zéro (historique relevés):', e2);
    let lignesParPointZero = {};
    if (pointsZeroAsc && pointsZeroAsc.length) {
      const { data: lignes, error: e3 } = await client.from('carburant_stock_reference_lignes')
        .select('reference_id,carburant,stock_reel').in('reference_id', pointsZeroAsc.map(r => r.id));
      if (e3) console.error('Chargement lignes points zéro (historique relevés):', e3);
      (lignes || []).forEach(l => {
        if (!lignesParPointZero[l.reference_id]) lignesParPointZero[l.reference_id] = { go: null, sp95: null, gnr: null };
        lignesParPointZero[l.reference_id][l.carburant] = Number(l.stock_reel);
      });
    }

    // Ventes agrégées par jour sur toute la période couverte (du premier
    // relevé chargé à `fin`) — une seule requête, sommée en mémoire, plutôt
    // qu'une requête par relevé.
    const debutVentes = releves[0].date;
    const { data: lignesVentes, error: e4 } = await client.from('audits_caisse')
      .select('date,litrage_gazole,litrage_sp95,litrage_gnr')
      .eq('site', siteId).gte('date', debutVentes).lte('date', fin);
    if (e4) console.error('Chargement ventes (historique relevés):', e4);
    const ventesParJour = {};
    (lignesVentes || []).forEach(l => {
      if (!ventesParJour[l.date]) ventesParJour[l.date] = { go: 0, sp95: 0, gnr: 0, aUnLitrage: false };
      const j = ventesParJour[l.date];
      if (l.litrage_gazole != null) { j.go += Number(l.litrage_gazole); j.aUnLitrage = true; }
      if (l.litrage_sp95 != null) { j.sp95 += Number(l.litrage_sp95); j.aUnLitrage = true; }
      if (l.litrage_gnr != null) { j.gnr += Number(l.litrage_gnr); j.aUnLitrage = true; }
    });
    // Somme des ventes connues sur [depuisInclus, jusquExclu) — null si
    // aucun jour de la fenêtre n'a de litrage renseigné (même honnêteté que
    // sommerVentesPeriode côté moteur : jamais un 0 déguisé en "pas de vente").
    function sommeVentesFenetre(depuisInclus, jusquExclu) {
      const total = { go: 0, sp95: 0, gnr: 0 };
      let trouve = false;
      const cursor = new Date(`${depuisInclus}T00:00:00`);
      const limite = new Date(`${jusquExclu}T00:00:00`);
      while (cursor < limite) {
        const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
        const j = ventesParJour[iso];
        if (j && j.aUnLitrage) { total.go += j.go; total.sp95 += j.sp95; total.gnr += j.gnr; trouve = true; }
        cursor.setDate(cursor.getDate() + 1);
      }
      return trouve ? total : { go: null, sp95: null, gnr: null };
    }

    // Point zéro applicable à une date donnée : le plus récent avec
    // date <= cette date (même règle que chargerDernierPointZero) —
    // recherche linéaire, la liste est courte en pratique.
    function pointZeroApplicable(date) {
      let trouve = null;
      (pointsZeroAsc || []).forEach(pz => { if (pz.date <= date) trouve = pz; });
      return trouve;
    }

    const resultat = [];
    releves.forEach((releve, i) => {
      const prevReleve = i > 0 ? releves[i - 1] : null;
      const pz = pointZeroApplicable(releve.date);
      const ancreEstPointZero = !!pz && (!prevReleve || pz.date >= prevReleve.date);
      const dateAncre = ancreEstPointZero ? pz.date : (prevReleve ? prevReleve.date : null);
      // Jour de la certification elle-même : théorique = physique certifié
      // (écart = 0 par construction, voir chargerControleJour) — jamais
      // "pas de théorique" (correctif 14/08/2026, retour de Frédéric : "ne
      // pas faire disparaître les jauges").
      const referenceCertifieeCeJour = ancreEstPointZero && dateAncre === releve.date;

      const ventes = referenceCertifieeCeJour
        ? { go: 0, sp95: 0, gnr: 0 }
        : (dateAncre ? sommeVentesFenetre(dateAncre, releve.date) : { go: null, sp95: null, gnr: null });
      const parCarburant = {};
      CARBURANTS_INFO.forEach(({ cle }) => {
        const reelDuJour = cle === 'go' ? M.stockReelGoTotal(releve) : releve[`stock_reel_${cle}`];
        const dernierReel = ancreEstPointZero
          ? (lignesParPointZero[pz.id] ? lignesParPointZero[pz.id][cle] : null)
          : (cle === 'go' ? M.stockReelGoTotal(prevReleve) : (prevReleve ? prevReleve[`stock_reel_${cle}`] : null));
        // CORRECTIF 14/08/2026 (même règle que chargerControleJour) : le
        // jour même de la certification, la livraison/le mouvement saisi
        // sur CE relevé est présumé déjà incorporé dans le stock certifié
        // — l'ajouter en plus double-compterait un mouvement antérieur au
        // point zéro.
        const livraison = referenceCertifieeCeJour ? 0 : (releve[`livraison_${cle}`] || 0);
        const mouvement = referenceCertifieeCeJour ? 0 : (releve[`mouvement_${cle}`] || 0);
        const resultatCarb = M.calculerCarburant({ dernierReel, reelDuJour, livraison, mouvement, ventes: ventes[cle] });
        if (referenceCertifieeCeJour) resultatCarb.statut = 'Référence certifiée';
        parCarburant[cle] = resultatCarb;
      });
      resultat.push({ date: releve.date, referenceCertifieeCeJour, ancreEstPointZero, parCarburant });
    });

    // Seuls les jours de la fenêtre demandée sont restitués — les relevés
    // plus anciens n'ont servi qu'à calculer l'ancre du premier jour affiché.
    return resultat.filter(r => r.date >= debutISO).reverse(); // du plus récent au plus ancien
  }

  // ============================================================
  // Sprint C6 "Pilotage" (17/08/2026, audit Carburants — chaîne de preuve,
  // §10 : "Carburants Pilotage doit consommer la dernière version fiable de
  // chaque contrôle") — lecture SEULE de carburant_controles (écrit depuis
  // le Sprint C2, versionné depuis C3, avec controleInchange depuis C5).
  // Contrairement à chargerControleJour ci-dessus (qui REDÉRIVE le
  // théorique/écart en direct depuis carburant_releves — utilisé pour les
  // jauges "Situation aujourd'hui", toujours à jour même si le contrôle
  // écrit n'a pas encore été (re)calculé), ces deux chargeurs lisent la
  // PREUVE déjà posée en base, aucun recalcul : c'est la source du badge de
  // qualité et de la modale "Relevé de contrôle".
  // ============================================================

  // Dernier contrôle posé (le plus grand version_num) par carburant pour un
  // (site, date) exact — {go, sp95, gnr}, chaque valeur étant la ligne
  // carburant_controles complète ou null si aucun contrôle n'a encore été
  // écrit pour ce carburant à cette date (jaugeage pas encore saisi, ou
  // écriture de contrôle en échec — voir carburant_releves.controle_statut,
  // Sprint C5).
  async function chargerDerniersControles(client, siteId, date) {
    const { data, error } = await client.from('carburant_controles')
      .select('*').eq('site', siteId).eq('date', date)
      .order('version_num', { ascending: false });
    if (error) { console.error('Chargement derniers contrôles carburant:', error); return { go: null, sp95: null, gnr: null }; }
    const parCarburant = { go: null, sp95: null, gnr: null };
    (data || []).forEach(row => { if (!parCarburant[row.carburant]) parCarburant[row.carburant] = row; }); // premier = plus grand version_num
    return parCarburant;
  }

  // Toutes les versions du contrôle d'UN carburant à UNE date, la plus
  // récente en premier — alimente "Historique des versions et corrections"
  // de la modale "Relevé de contrôle" (audit §10.1). `limite` par défaut 20
  // (large marge : un contrôle relancé en cascade plusieurs fois reste rare
  // au-delà de quelques versions grâce à controleInchange, Sprint C5).
  async function chargerVersionsControleCarburant(client, siteId, carburant, date, limite = 20) {
    const { data, error } = await client.from('carburant_controles')
      .select('*').eq('site', siteId).eq('carburant', carburant).eq('date', date)
      .order('version_num', { ascending: false }).limit(limite);
    if (error) { console.error('Chargement versions contrôle carburant:', error); return []; }
    return data || [];
  }

  // Sprint C7 "Analyse" (17/08/2026, audit roadmap : "Signature delta
  // livraison / statistiques", critère de sortie "Historique suffisant et
  // fiable") — historique des contrôles d'UN carburant sur les N derniers
  // jours ayant un contrôle posé, UN SEUL par date (la dernière version —
  // un recalcul en cascade, Sprint C3, peut poser plusieurs versions pour
  // la même date ; les compter toutes fausserait la statistique de
  // fiabilité en sur-pondérant les jours recalculés plusieurs fois).
  // Sur-requête volontaire (limite*4 lignes brutes avant dédoublonnage) car
  // le nombre de versions par date est variable et inconnu à l'avance —
  // marge large plutôt qu'une pagination complexe pour un historique de
  // consultation, pas une preuve elle-même (qui reste `carburant_controles`
  // en base, jamais recopiée ni réécrite ici).
  async function chargerHistoriqueControlesCarburant(client, siteId, carburant, limite = 30) {
    const { data, error } = await client.from('carburant_controles')
      .select('*').eq('site', siteId).eq('carburant', carburant)
      .order('date', { ascending: false }).order('version_num', { ascending: false })
      .limit(limite * 4);
    if (error) { console.error('Chargement historique contrôles carburant:', error); return []; }
    const parDate = [];
    const datesVues = new Set();
    (data || []).forEach(row => {
      if (datesVues.has(row.date)) return; // déjà pris la version la plus récente de cette date
      datesVues.add(row.date);
      parDate.push(row);
    });
    return parDate.slice(0, limite);
  }

  global.NexusCarburantDonnees = {
    CARBURANTS_INFO, chargerVentesPeriode, chargerControleJour, chargerJoursSansReleve,
    chargerCuvesConfig, chargerConsommationJournaliereMoyenne, CUVES_PAR_DEFAUT,
    chargerDerniereLivraison, chargerDernierPointZero, certifierPointZero,
    chargerHistoriquePointsZero, chargerHistoriqueReleves,
    chargerDerniersControles, chargerVersionsControleCarburant,
    chargerHistoriqueControlesCarburant,
  };
})(typeof window !== 'undefined' ? window : globalThis);
