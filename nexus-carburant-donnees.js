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
      .select('date,quart,litrage_gazole,litrage_sp95,litrage_gnr')
      .eq('site', siteId).gte('date', debut).lte('date', fin);
    if (error) { console.error('Chargement ventes carburant (période):', error); return { ventes: { go: null, sp95: null, gnr: null }, nbQuartsTotal: 0, nbQuartsAvecLitrage: 0, lignes: [] }; }
    const lignes = data || [];
    const ventes = global.NexusCarburantMoteur.sommerVentesPeriode(lignes);
    const nbQuartsAvecLitrage = lignes.filter(l => l.litrage_gazole != null || l.litrage_sp95 != null || l.litrage_gnr != null).length;
    return { ventes, nbQuartsTotal: lignes.length, nbQuartsAvecLitrage, lignes };
  }

  // Aligne une référence sur les mêmes positions commerciales réellement
  // présentes dans la période courante (ex. lundi Q1/Q2 + mardi Q1). Cela
  // interdit de comparer 3 quarts courants à 4 ou 6 quarts historiques.
  function alignerQuartsComparables(lignesActuelles, debutActuel, lignesReference, debutReference) {
    const jour = 86400000;
    const origineActuelle = Date.parse(`${debutActuel}T00:00:00Z`);
    const origineReference = Date.parse(`${debutReference}T00:00:00Z`);
    const aDuLitrage = l => l && (l.litrage_gazole != null || l.litrage_sp95 != null || l.litrage_gnr != null);
    const signatures = new Set((lignesActuelles || []).filter(aDuLitrage).map(l => {
      const offset = Math.round((Date.parse(`${l.date}T00:00:00Z`) - origineActuelle) / jour);
      return `${offset}:${String(l.quart || '').toUpperCase()}`;
    }));
    return (lignesReference || []).filter(l => {
      if (!aDuLitrage(l)) return false;
      const offset = Math.round((Date.parse(`${l.date}T00:00:00Z`) - origineReference) / jour);
      return signatures.has(`${offset}:${String(l.quart || '').toUpperCase()}`);
    });
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
    // CORRECTIF 28/08/2026 (§19, "statut actif/remplacé") : le filtre par
    // `statut` a été délibérément RETIRÉ ici, et ce n'est PAS un oubli.
    // Cette fonction sert aussi à la reconstruction POINT-DANS-LE-TEMPS
    // (chargerControleJour appelle chargerDernierPointZero(..., date) pour
    // une date PASSÉE quelconque, et chargerHistoriqueReleves fait
    // l'équivalent pour toute une fenêtre) : elle doit retrouver la
    // référence en vigueur À CETTE DATE-LÀ, même si une certification plus
    // récente l'a depuis fait passer en 'remplace'. Filtrer sur
    // `statut = 'actif'` casserait silencieusement tout recalcul historique
    // antérieur à la dernière certification (Article 5 — jamais un calcul
    // silencieusement faux). Le cycle actif/remplacé écrit par
    // certifierPointZero reste réel et interrogeable (ex. pour un futur
    // badge "référence en vigueur" dans l'historique), simplement pas ICI :
    // `type = 'initialisation'` + tri par date reste la SEULE condition de
    // sélection de l'ancre, exactement comme avant que 'valide' (valeur
    // alors uniforme sur toutes les lignes, donc déjà sans effet filtrant
    // réel) ne soit remplacé par ce cycle à deux états.
    let requete = client.from('carburant_stock_references')
      .select('*').eq('site', siteId).eq('type', 'initialisation');
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

  // Consigne le contexte de ventilation d'un calcul (doctrine du 02/09/2026 :
  // « mémoriser le contexte estimation, sans enregistrer cette estimation
  // comme une vérité métier »). Une ligne par quart entrant dans la fenêtre.
  //
  // Table append-only : un recalcul écrit un NOUVEAU calcul_id plutôt que de
  // réécrire l'ancien, pour qu'on puisse toujours répondre plus tard à « sur
  // quoi reposait ce chiffre ce jour-là ». Rien n'est jamais écrit dans
  // carburant_controles depuis ici — c'est précisément la séparation
  // demandée.
  //
  // Best-effort : une erreur d'écriture ici ne doit jamais empêcher le
  // contrôle lui-même d'aboutir (même principe que journal_fraicheur_secteurs).
  async function enregistrerContexteVentilation(client, siteId, date, ventilation, methode) {
    if (!ventilation || !ventilation.contexte || !ventilation.contexte.length) return { ok: true, lignes: 0 };
    const calculId = (globalThis.crypto && globalThis.crypto.randomUUID)
      ? globalThis.crypto.randomUUID() : null;
    if (!calculId) return { ok: false, lignes: 0, raison: 'uuid_indisponible' };
    const lignes = ventilation.contexte.map(c => ({
      site: siteId, date, calcul_id: calculId,
      fenetre_debut: ventilation.fenetreDebut || null,
      fenetre_fin: ventilation.fenetreFin || null,
      quart_date: c.date, quart: String(c.quart), nature: c.nature,
      fraction: c.fraction,
      volume_go: c.volumes ? c.volumes.go : null,
      volume_sp95: c.volumes ? c.volumes.sp95 : null,
      volume_gnr: c.volumes ? c.volumes.gnr : null,
      methode: c.nature === 'reel' ? null : (methode || 'moyenne_recente_14j'),
      estimable: c.estimable !== false,
    }));
    const { error } = await client.from('carburant_ventilation_contexte').insert(lignes);
    if (error) { console.error('Enregistrement contexte de ventilation carburant:', error); return { ok: false, lignes: 0 }; }
    return { ok: true, lignes: lignes.length, calculId };
  }

  // Moyennes de litrage par quart sur les N derniers jours, pour estimer la
  // part d'une fenêtre qui n'est pas mesurable (doctrine du 02/09/2026).
  // Retourne { '1': {go, sp95, gnr}, '2': {...} } — un carburant sans aucun
  // point d'historique reste `null`, jamais un zéro fabriqué (Article 5).
  async function chargerMoyennesParQuart(client, siteId, dateFinExclusiveISO, joursHistorique) {
    const jours = joursHistorique || 14;
    const fin = new Date(`${dateFinExclusiveISO}T00:00:00`);
    const debut = new Date(fin);
    debut.setDate(debut.getDate() - jours);
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const { data, error } = await client.from('audits_caisse')
      .select('date,quart,litrage_gazole,litrage_sp95,litrage_gnr')
      .eq('site', siteId).gte('date', iso(debut)).lt('date', dateFinExclusiveISO);
    if (error) { console.error('Chargement moyennes par quart (ventilation carburant):', error); return {}; }
    const champs = { go: 'litrage_gazole', sp95: 'litrage_sp95', gnr: 'litrage_gnr' };
    const cumul = { '1': {}, '2': {} };
    (data || []).forEach(l => {
      const num = String(l.quart) === '2' ? '2' : '1';
      Object.entries(champs).forEach(([carb, champ]) => {
        if (l[champ] == null) return;
        if (!cumul[num][carb]) cumul[num][carb] = { somme: 0, n: 0 };
        cumul[num][carb].somme += Number(l[champ]);
        cumul[num][carb].n += 1;
      });
    });
    const moyennes = {};
    ['1', '2'].forEach(num => {
      moyennes[num] = {};
      ['go', 'sp95', 'gnr'].forEach(carb => {
        const c = cumul[num][carb];
        moyennes[num][carb] = c && c.n ? c.somme / c.n : null;
      });
    });
    return moyennes;
  }

  // Dates civiles (fuseau du site) couvertes par [t0, t1], bornes incluses.
  function datesDeLaFenetre(t0, t1, fuseau) {
    if (!t0 || !t1) return [];
    const jour = d => new Intl.DateTimeFormat('en-CA', { timeZone: fuseau || 'UTC' }).format(d);
    const dates = [];
    let curseur = new Date(t0.getTime());
    let garde = 0;
    while (curseur <= t1 && garde < 40) {
      const j = jour(curseur);
      if (!dates.includes(j)) dates.push(j);
      curseur = new Date(curseur.getTime() + 12 * 3600 * 1000);
      garde += 1;
    }
    const dernier = jour(t1);
    if (!dates.includes(dernier)) dates.push(dernier);
    return dates;
  }

  // Dernière mesure physique issue d'une réception terminée, par
  // carburant. Une réception est une vraie ancre temporelle : son stock
  // après livraison incorpore déjà la livraison et ne doit jamais être
  // additionné une seconde fois au relevé d'ouverture du même jour.
  async function chargerDernieresAncresReception(client, siteId, instantLimite) {
    const vide = { go: null, sp95: null, gnr: null };
    if (!instantLimite) return vide;
    const { data: visites, error: e1 } = await client.from('carburant_reception_visites')
      .select('id,date_visite,heure_fin,statut')
      .eq('site', siteId).neq('statut', 'en_cours').neq('statut', 'annulee_doublon')
      .not('heure_fin', 'is', null).lt('heure_fin', instantLimite.toISOString())
      .order('heure_fin', { ascending: false }).limit(20);
    if (e1) { console.error('Chargement ancres de réception carburant:', e1); return vide; }
    if (!visites || !visites.length) return vide;
    const ids = visites.map(v => v.id);
    const { data: mesures, error: e2 } = await client.from('carburant_reception_mesures')
      .select('visite_id,carburant,jaugeage_apres_l,jaugeage_apres_le')
      .in('visite_id', ids).not('jaugeage_apres_l', 'is', null);
    if (e2) { console.error('Chargement mesures post-livraison carburant:', e2); return vide; }

    const visiteParId = Object.fromEntries(visites.map(v => [v.id, v]));
    const groupes = {};
    (mesures || []).forEach(m => {
      if (!Object.prototype.hasOwnProperty.call(vide, m.carburant)) return;
      const cle = `${m.visite_id}:${m.carburant}`;
      if (!groupes[cle]) groupes[cle] = { stockReel: 0, mesureLe: null };
      groupes[cle].stockReel += Number(m.jaugeage_apres_l) || 0;
      if (m.jaugeage_apres_le && (!groupes[cle].mesureLe || m.jaugeage_apres_le > groupes[cle].mesureLe)) {
        groupes[cle].mesureLe = m.jaugeage_apres_le;
      }
    });
    const resultat = { ...vide };
    visites.forEach(v => {
      ['go', 'sp95', 'gnr'].forEach(cle => {
        if (resultat[cle]) return;
        const g = groupes[`${v.id}:${cle}`];
        if (!g) return;
        const mesureLe = g.mesureLe || v.heure_fin;
        if (!mesureLe) return;
        resultat[cle] = {
          visiteId: v.id, date: v.date_visite, mesureLe,
          stockReel: g.stockReel, source: 'reception', visite: visiteParId[v.id],
        };
      });
    });
    return resultat;
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
    const [{ data: releveDuJour, error: e1 }, { data: dernierReleve, error: e2 }, pointZero, { data: stationConfig, error: e5 }] = await Promise.all([
      client.from('carburant_releves').select('*').eq('site', siteId).eq('date', date).maybeSingle(),
      client.from('carburant_releves').select('*').eq('site', siteId).lt('date', date).order('date', { ascending: false }).limit(1).maybeSingle(),
      chargerDernierPointZero(client, siteId, date),
      client.from('station_config').select('horaires,fuseau_horaire').eq('site', siteId).maybeSingle(),
    ]);
    if (e1) console.error('Chargement relevé carburant du jour (contrôle):', e1);
    if (e2) console.error('Chargement dernier relevé carburant (contrôle):', e2);
    if (e5) console.error('Chargement horaires site (fenêtre ventes horodatée):', e5);
    const horaires = (stationConfig && stationConfig.horaires) || null;
    // Fuseau de la station (24/08/2026, v2.232, anomalie signalée par
    // Frédéric : heures carburant fausses en Martinique) — station_config.
    // fuseau_horaire est NOT NULL avec un défaut 'America/Martinique' en
    // base, mais si le site n'a encore AUCUNE ligne station_config
    // (`stationConfig` null, cas déjà géré ailleurs sur `horaires`), on
    // retombe explicitement sur la seule station réelle connue de NEXUS
    // aujourd'hui plutôt que sur 'Europe/Paris' — jamais un fuseau
    // métropolitain par défaut pour une station ultramarine.
    const fuseau = (stationConfig && stationConfig.fuseau_horaire) || 'America/Martinique';

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
    // Chaîne temporelle (21/08/2026, correction du bug "ventes du jour" —
    // voir l'en-tête de nexus-carburant-moteur.js) : quand l'ancre est un
    // relevé réel (jamais un point zéro, volontairement laissé sur son
    // fonctionnement date-à-date existant, exceptionnel et déjà couvert par
    // sa propre règle du 14/08/2026 — Frédéric : "Point zéro ≠ dernière
    // référence physique"), la fenêtre de ventes utilise les INSTANTS réels
    // (mesure_le) et non plus les dates civiles. `fenetreIsolable` (par
    // défaut true, jamais false pour l'ancre point zéro) signale si un
    // quart chevauche l'une des deux bornes — dans ce cas ventesDepuis reste
    // à null pour les 3 carburants (jamais une ventilation devinée), ce que
    // calculerCarburant traduit déjà honnêtement en "Données insuffisantes"
    // sans code supplémentaire ici (Article 11).
    let fenetreIsolable = true;
    let fenetreDebut = null, fenetreFin = null, quartsChevauchants = [];
    if (referenceCertifieeCeJour) {
      // Zéro jour écoulé depuis la certification : zéro vente, explicite —
      // jamais une requête sur une plage vide qui redonnerait `null` et
      // ferait retomber le statut sur "Données insuffisantes".
      ventesDepuis = { go: 0, sp95: 0, gnr: 0 };
    } else if (ancreEstPointZero) {
      // Point zéro anchrant une date ultérieure : fonctionnement date-à-date
      // historique, volontairement inchangé (portée limitée au relevé réel,
      // voir Data Dictionary v2.205).
      const { data: lignesVentes, error: e3 } = await client.from('audits_caisse')
        .select('litrage_gazole,litrage_sp95,litrage_gnr')
        .eq('site', siteId).gte('date', dateAncre).lt('date', date);
      if (e3) console.error('Chargement ventes depuis dernier relevé (contrôle):', e3);
      ventesDepuis = M.sommerVentesPeriode(lignesVentes || []);
    } else if (dateAncre && dernierReleve && dernierReleve.mesure_le) {
      // 25/08/2026 (retour de Frédéric) : les bornes de fenêtre ne sont plus
      // systématiquement `mesure_le` brut, mais `M.instantFenetreReleve` —
      // qui retombe sur minuit local de la date du relevé pour un jaugeage
      // d'ouverture normal (origine != 'reception_livraison'), et sur
      // `mesure_le` réel uniquement pour un relevé lié à une livraison. Voir
      // le commentaire de `instantFenetreReleve` (nexus-carburant-moteur.js)
      // pour le raisonnement complet et le cas réel qui l'a motivé.
      fenetreDebut = M.instantFenetreReleve(dernierReleve, fuseau);
      fenetreFin = releveDuJour ? M.instantFenetreReleve(releveDuJour, fuseau) : new Date();
      const { data: lignesQuarts, error: e3 } = await client.from('audits_caisse')
        .select('date,quart,litrage_gazole,litrage_sp95,litrage_gnr')
        .eq('site', siteId).gte('date', dateAncre).lte('date', date);
      if (e3) console.error('Chargement ventes (fenêtre horodatée, contrôle):', e3);
      const resolu = M.resoudreVentesFenetre(lignesQuarts || [], horaires, fenetreDebut, fenetreFin, fuseau);
      ventesDepuis = resolu.ventes;
      fenetreIsolable = resolu.isolable;
      quartsChevauchants = resolu.quartsChevauchants;
    } else if (dateAncre) {
      // Repli honnête : ancre réelle mais sans mesure_le connu (ne devrait
      // plus arriver après le backfill du 21/08/2026, mais jamais une
      // exception si un cas résiduel existait) — comportement historique.
      const { data: lignesVentes, error: e3 } = await client.from('audits_caisse')
        .select('litrage_gazole,litrage_sp95,litrage_gnr')
        .eq('site', siteId).gte('date', dateAncre).lt('date', date);
      if (e3) console.error('Chargement ventes depuis dernier relevé (contrôle, repli sans mesure_le):', e3);
      ventesDepuis = M.sommerVentesPeriode(lignesVentes || []);
    }

    // Une réception terminée entre l'ancienne ancre et la mesure courante
    // devient l'ancre de calcul pour les seuls carburants effectivement
    // livrés. Les ventes sont alors résolues depuis son horodatage réel.
    // Si un quart chevauche cet instant, le théorique reste volontairement
    // non calculé : NEXUS ne ventile jamais au hasard un quart agrégé.
    const instantCible = releveDuJour ? M.instantFenetreReleve(releveDuJour, fuseau) : new Date();
    const instantAncreBase = ancreEstPointZero
      ? M.instantLocalVersUTC(pointZero.date, String(pointZero.heure || '00:00').slice(0, 5), fuseau)
      : (dernierReleve ? M.instantFenetreReleve(dernierReleve, fuseau) : null);
    const receptions = await chargerDernieresAncresReception(client, siteId, instantCible);
    const fenetresParCarburant = {};
    await Promise.all(CARBURANTS_INFO.map(async ({ cle }) => {
      const reception = receptions[cle];
      if (!reception || !instantAncreBase || new Date(reception.mesureLe) <= instantAncreBase) return;
      const debut = new Date(reception.mesureLe);
      const dateDebut = reception.date || dateAncre;
      const { data: lignesQuarts, error: e3 } = await client.from('audits_caisse')
        .select('date,quart,litrage_gazole,litrage_sp95,litrage_gnr')
        .eq('site', siteId).gte('date', dateDebut).lte('date', date);
      if (e3) console.error('Chargement ventes depuis réception (contrôle):', e3);
      const resolu = M.resoudreVentesFenetre(lignesQuarts || [], horaires, debut, instantCible, fuseau);
      fenetresParCarburant[cle] = { reception, debut, fin: instantCible, resolu };
    }));

    // Ventilation avec estimation (02/09/2026, doctrine de Frédéric). Calculée
    // À CÔTÉ de la résolution stricte ci-dessus, jamais à sa place : les
    // champs existants (ventes, theorique, ecart, fenetreIsolable) gardent
    // exactement leur sens mesuré, et carburant_controles n'en voit rien.
    // Ce bloc ne sert qu'à pouvoir AFFICHER et TRACER un ordre de grandeur
    // là où la chaîne se taisait — jamais à le promouvoir en écart constaté.
    let ventilation = null;
    {
      const debutVentilation = Object.values(fenetresParCarburant).length
        ? new Date(Math.min(...Object.values(fenetresParCarburant).map(f => f.debut.getTime())))
        : instantAncreBase;
      if (debutVentilation && instantCible && horaires) {
        const dates = datesDeLaFenetre(debutVentilation, instantCible, fuseau);
        const moyennes = await chargerMoyennesParQuart(client, siteId, date, 14);
        const { data: lignesVentil } = await client.from('audits_caisse')
          .select('date,quart,litrage_gazole,litrage_sp95,litrage_gnr')
          .eq('site', siteId).gte('date', dates[0]).lte('date', dates[dates.length - 1]);
        ventilation = M.ventilerFenetreAvecEstimation(
          lignesVentil || [], horaires, debutVentilation, instantCible, fuseau, moyennes, dates);
        ventilation.fenetreDebut = debutVentilation.toISOString();
        ventilation.fenetreFin = instantCible.toISOString();
      }
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
      let dernierReel = ancreEstPointZero
        ? (pointZero.lignes ? pointZero.lignes[cle] : null)
        : (cle === 'go' ? M.stockReelGoTotal(dernierReleve) : (dernierReleve ? dernierReleve[`stock_reel_${cle}`] : null));
      const fenetreCarburant = fenetresParCarburant[cle];
      if (fenetreCarburant) dernierReel = fenetreCarburant.reception.stockReel;
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
      const livraison = (referenceCertifieeCeJour || fenetreCarburant) ? 0 : (releveDuJour ? (releveDuJour[`livraison_${cle}`] || 0) : 0);
      const mouvement = referenceCertifieeCeJour ? 0 : (releveDuJour ? (releveDuJour[`mouvement_${cle}`] || 0) : 0);
      // 13/08/2026, audit Carburants Pilotage : la page a besoin d'afficher
      // le "stock physique" en toutes lettres (jauge + tableau), pas
      // seulement l'écart déjà calculé — reelDuJour/dernierReel sont donc
      // remontés tels quels en plus du résultat de calculerCarburant,
      // jamais recalculés une seconde fois côté HTML.
      const ventesCarburant = fenetreCarburant ? fenetreCarburant.resolu.ventes[cle] : ventesDepuis[cle];
      const resultat = M.calculerCarburant({ dernierReel, reelDuJour, livraison, mouvement, ventes: ventesCarburant });
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
        ventesDepuis: ventesCarburant,
        fenetreIsolable: fenetreCarburant ? fenetreCarburant.resolu.isolable : fenetreIsolable,
        quartsChevauchants: fenetreCarburant ? fenetreCarburant.resolu.quartsChevauchants : quartsChevauchants,
        ancreCalculSource: fenetreCarburant ? 'reception' : (ancreEstPointZero ? 'point_zero' : 'ouverture'),
        ancreCalculHeure: fenetreCarburant ? fenetreCarburant.reception.mesureLe : (instantAncreBase ? instantAncreBase.toISOString() : null),
        ancreCalculDate: fenetreCarburant ? fenetreCarburant.reception.date : dateAncre,
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
      // Chaîne temporelle (21/08/2026) : fenêtre réellement retenue pour le
      // calcul, et pourquoi elle n'a pas pu être isolée le cas échéant —
      // alimente le bloc "Comment cet écart est calculé" (preuve auditable,
      // demande de Frédéric) sans que l'écran ait à recalculer quoi que ce
      // soit lui-même.
      fenetreIsolable: CARBURANTS_INFO.every(({ cle }) => parCarburant[cle].fenetreIsolable !== false),
      fenetreDebut, fenetreFin, quartsChevauchants,
      ventilation,
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
  //
  // CORRECTIF 28/08/2026 (refonte qualitative §19, "le point zéro doit
  // porter date/heure/utilisateur/source/volumes/motif/statut
  // actif-remplacé/justification, les corrections ne doivent jamais
  // supprimer les précédentes") :
  //   - `motifCategorie` obligatoire — même convention que reporterCommande
  //     (obligatoire côté écran, cette fonction persiste ce qui lui est
  //     donné ; ici on refuse quand même l'insertion si absent, car
  //     `motif` est la seule trace de "pourquoi cette nouvelle référence",
  //     contrairement à un report de commande qui a déjà `statut` pour le
  //     contexte).
  //   - `note` devient la justification libre complémentaire (colonne
  //     existante, inchangée, toujours optionnelle) — jamais fusionnée avec
  //     `motif` : un champ catégorisé (recherche/filtre fiable) et un champ
  //     texte libre (contexte) répondent à deux besoins différents.
  //   - Chaîne d'audit immuable : si une référence 'actif' existe déjà pour
  //     ce site (chargerDernierPointZero, réutilisé — Article 11, jamais
  //     une deuxième requête équivalente), elle est repassée à 'remplace'
  //     PAR UN UPDATE (jamais supprimée) avant l'insertion de la nouvelle
  //     ligne 'actif', qui référence l'ancienne via `reference_precedente_id`.
  async function certifierPointZero(client, siteId, { date, heure, source, controlePar, type, motifCategorie, note, valeurs }) {
    if (!motifCategorie) {
      return { ok: false, error: 'motif_requis', message: 'Le motif de cette certification est obligatoire.' };
    }
    // Réutilise la même requête que l'ancre de calcul (Article 11) : seule
    // une référence 'initialisation' active peut être "remplacée" au sens
    // de la chaîne d'audit — un simple 'recomptage' ne clôt jamais la
    // référence en vigueur (voir le commentaire de chargerDernierPointZero).
    const ancienneRef = (type || 'initialisation') === 'initialisation'
      ? await chargerDernierPointZero(client, siteId)
      : null;

    if (ancienneRef) {
      const { error: eRemplace } = await client.from('carburant_stock_references')
        .update({ statut: 'remplace' }).eq('id', ancienneRef.id);
      if (eRemplace) { console.error('Passage ancien point zéro en "remplace":', eRemplace); return { ok: false, error: eRemplace }; }
    }

    // Un 'recomptage' n'est jamais l'ancre de calcul (voir plus haut) : la
    // contrainte SQL n'autorisant que 'actif'/'remplace', on le stocke en
    // 'remplace' — à lire ici comme "n'est pas la référence active", pas
    // comme "vient de remplacer quelque chose" (son reference_precedente_id
    // reste null, il ne rejoint jamais la chaîne d'audit des initialisations).
    const statutInsertion = (type || 'initialisation') === 'initialisation' ? 'actif' : 'remplace';
    const { data: ref, error: e1 } = await client.from('carburant_stock_references').insert({
      site: siteId, date, heure: heure || null, source: source || 'terrain',
      controle_par: controlePar || null, type: type || 'initialisation',
      statut: statutInsertion,
      motif: motifCategorie, note: note || null,
      reference_precedente_id: ancienneRef ? ancienneRef.id : null,
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

  // ============================================================
  // Pont Inventaire → Carburants (19/08/2026, demande de Frédéric) — le
  // pompiste du Quart 1 saisit le jaugeage physique d'ouverture directement
  // dans son parcours Inventaire ; Inventaire DÉCLENCHE l'action mais
  // n'écrit jamais dans ses propres tables pour cette donnée (Article 11) :
  // elle va directement dans carburant_releves/carburant_releve_versions,
  // par le MÊME chemin d'écriture ("preuve avant vue", prochaineVersion-
  // ReleveCarburant/diffReleveCarburant du moteur partagé) que la saisie
  // manager sur NEXUS-Carburants-v1.html — jamais une deuxième
  // implémentation de cette logique.
  // ============================================================

  // Relevé déjà enregistré pour (site, date), si un existe — permet à
  // Inventaire de savoir si le jaugeage du jour a déjà une valeur (saisie
  // par le pompiste ou par le manager) sans dupliquer la logique de saisie.
  // NEXUS-Carburants-v1.html a sa propre copie locale de cette même requête
  // (antérieure à ce fichier partagé) — non touchée ici pour ne pas prendre
  // de risque de régression sur un écran manager déjà éprouvé ; à collapser
  // dans un futur nettoyage si Frédéric le demande.
  async function chargerReleveDuJour(client, siteId, date) {
    const { data, error } = await client.from('carburant_releves').select('*')
      .eq('site', siteId).eq('date', date).maybeSingle();
    if (error) { console.error('Chargement relevé du jour (pont Inventaire):', error); return null; }
    return data;
  }

  // Statut du contrôle d'ouverture du jour (fait / impossible + motif) —
  // signal UNIQUE consulté à la fois par le bloc Inventaire (pour ne plus
  // relancer le pompiste une fois fait) et par le manager (bannière "non
  // réalisé"), distinct de carburant_releves qui porte les valeurs
  // mesurées elles-mêmes.
  async function chargerStatutJaugeageJour(client, siteId, date) {
    const { data, error } = await client.from('carburant_jaugeage_statuts_jour').select('*')
      .eq('site', siteId).eq('date', date).maybeSingle();
    if (error) { console.error('Chargement statut jaugeage du jour:', error); return null; }
    return data;
  }

  // Écrit le jaugeage d'ouverture du pompiste. `valeurs` : { go_cuve1,
  // go_cuve2, sp95, gnr } (sous-ensemble éventuel — un champ omis/null
  // reprend la valeur déjà en base si une ligne existe déjà pour ce jour,
  // jamais écrasée à null). Ne fixe jamais livraison_*/mouvement_* (repris
  // du précédent ou 0) : le pompiste ne déclare qu'un jaugeage physique,
  // pas une livraison ou un mouvement exceptionnel — ces gestes restent la
  // responsabilité du manager sur son écran habituel.
  async function enregistrerJaugeageOuverturePompiste(client, siteId, { date, employeeId, valeurs }) {
    const M = global.NexusCarburantMoteur;
    if (!M) { console.error('NexusCarburantMoteur non chargé — jaugeage pompiste impossible.'); return { ok: false, error: new Error('moteur carburant absent') }; }

    const precedent = await chargerReleveDuJour(client, siteId, date);
    const { versionNum, typeVersion } = M.prochaineVersionReleveCarburant(precedent);
    // `mesure_le` (28/08/2026, P0 — retour de Frédéric, "pourquoi le moteur
    // de commande semble encore travailler depuis le jaugeage du 27 août à
    // 10:10 alors que Dylan a saisi celui du 28 août à 05:52") : cette
    // fonction (saisie terrain/pompiste) n'a jamais été mise à jour pour
    // renseigner `mesure_le` lors de l'introduction de ce mécanisme
    // (v2.205/v2.244) — exactement le même oubli, sur un chemin d'écriture
    // différent, que celui déjà corrigé en P0 le 27/08/2026 sur le pont
    // Réception (voir enregistrerReceptionCarburant ci-dessous). Conséquence
    // réelle vérifiée sur vito-sainte-marie : `chargerStockEtFiabiliteParCarburant`
    // exige `releveDuJour.mesure_le` pour reconnaître "un jaugeage a été saisi
    // aujourd'hui" (Cas A) — sans lui, le moteur de commande retombait
    // silencieusement sur "aucun jaugeage aujourd'hui" (Cas B) et ancrait la
    // recommandation sur le DERNIER relevé possédant un `mesure_le`, ici le
    // relevé MANAGER de la veille (27/08 10:10) au lieu du relevé terrain du
    // jour même (28/08 05:52), pourtant bien présent en base et déjà affiché
    // sur "Situation aujourd'hui" (qui ne dépend pas de `mesure_le`). Même
    // convention que l'écran manager et le pont Réception (Article 11,
    // jamais une deuxième convention de capture d'instant).
    const mesureLe = new Date().toISOString();

    const nouveauSnapshot = {
      stock_reel_go_cuve1: valeurs.go_cuve1 != null ? Number(valeurs.go_cuve1) : (precedent ? precedent.stock_reel_go_cuve1 : null),
      stock_reel_go_cuve2: valeurs.go_cuve2 != null ? Number(valeurs.go_cuve2) : (precedent ? precedent.stock_reel_go_cuve2 : null),
      stock_reel_sp95: valeurs.sp95 != null ? Number(valeurs.sp95) : (precedent ? precedent.stock_reel_sp95 : null),
      stock_reel_gnr: valeurs.gnr != null ? Number(valeurs.gnr) : (precedent ? precedent.stock_reel_gnr : null),
      livraison_go: precedent ? precedent.livraison_go : 0,
      livraison_sp95: precedent ? precedent.livraison_sp95 : 0,
      livraison_gnr: precedent ? precedent.livraison_gnr : 0,
      mouvement_go: precedent ? precedent.mouvement_go : 0,
      mouvement_sp95: precedent ? precedent.mouvement_sp95 : 0,
      mouvement_gnr: precedent ? precedent.mouvement_gnr : 0,
      motif_mouvement: precedent ? precedent.motif_mouvement : null,
      commentaire: precedent ? precedent.commentaire : null,
    };

    const diff = M.diffReleveCarburant(precedent, nouveauSnapshot);
    if (precedent && !diff) return { ok: true, dejaAJour: true, releve: precedent };

    const { error: eVersion } = await client.from('carburant_releve_versions').insert({
      site: siteId, date, version_num: versionNum, type_version: typeVersion,
      ...nouveauSnapshot,
      // Un précédent existait déjà (cas rare : manager plus rapide que le
      // pompiste, ou double-tentative) -> le moteur classe ceci comme
      // 'correction_manager' (seules deux valeurs existent pour type_version,
      // jamais une troisième inventée ici, Article 11) ; le motif reste
      // honnête sur ce qui s'est réellement passé plutôt que de bloquer le
      // pompiste avec un champ de motif qu'il ne devrait jamais voir.
      motif_correction: typeVersion === 'correction_manager' ? 'Jaugeage terrain (pont Inventaire, pompiste Quart 1)' : null,
      diff_vs_precedent: diff, auteur: employeeId, origine: 'terrain_pompiste', mesure_le: mesureLe,
    });
    if (eVersion && eVersion.code !== '23505') {
      console.error('Preuve jaugeage pompiste (carburant_releve_versions):', eVersion);
      return { ok: false, error: eVersion };
    }

    const ligne = {
      site: siteId, date, version_num: versionNum, ...nouveauSnapshot,
      saisi_par: employeeId, origine: 'terrain_pompiste', mesure_le: mesureLe,
    };
    const { data, error } = await client.from('carburant_releves')
      .upsert(ligne, { onConflict: 'site,date' }).select().maybeSingle();
    if (error) { console.error('Écriture jaugeage pompiste (carburant_releves):', error); return { ok: false, error }; }

    // Marque le contrôle du jour "fait" — best-effort, non bloquant (Article
    // 5) : si cette écriture secondaire échoue, le jaugeage réel est déjà en
    // sécurité dans carburant_releves, seul l'indicateur de statut du jour
    // manquerait, jamais la donnée elle-même.
    const { error: eStatut } = await client.from('carburant_jaugeage_statuts_jour')
      .upsert({ site: siteId, date, statut: 'fait', motif_impossible: null, declare_par: employeeId }, { onConflict: 'site,date' });
    if (eStatut) console.error('Marquage statut jaugeage "fait" (non bloquant):', eStatut);

    return { ok: true, dejaAJour: false, releve: data };
  }

  // ============================================================
  // PONT RÉCEPTION → CARBURANTS (21/08/2026, constat de Frédéric : une
  // livraison bien enregistrée dans la réception carburant ne se voyait
  // jamais dans le "stock" de Carburants Pilotage, faute de pont entre les
  // deux modules — contrairement au pont Jaugeage Inventaire → Carburants
  // ci-dessus, qui ne couvre que le jaugeage d'ouverture du pompiste, pas
  // une livraison. Même chemin d'écriture que ce pont (Article 11) :
  // versionnement via M.prochaineVersionReleveCarburant/diffReleveCarburant,
  // seule la traduction mesures->colonnes change (M.patchReleveDepuis
  // ReceptionMesures). Appelée par NEXUS-Carburant-Reception-v1.html juste
  // après qu'une visite de réception a été marquée 'terminee'/'terminee_
  // avec_derogation' (voir NexusReceptionDonnees.soumettreVisiteComplete).
  // ============================================================

  // Écrit le stock réel + la livraison mesurés par UNE visite de réception
  // carburant. `visiteId` est OBLIGATOIRE et sert de clé d'idempotence
  // stricte (une même visite ne doit jamais être appliquée deux fois : son
  // litrage de livraison est additif, un double-appel le compterait deux
  // fois — voir le contrôle explicite ci-dessous, distinct du diff par
  // valeur qui ne suffit pas ici). `mesures`/`cuvesGo` : voir
  // M.patchReleveDepuisReceptionMesures. Ne fixe jamais mouvement_*/motif_
  // mouvement/commentaire (repris du relevé du jour s'il existe) : une
  // livraison n'est jamais un mouvement exceptionnel.
  async function enregistrerReleveDepuisReceptionLivraison(client, siteId, { date, employeeId, visiteId, mesures, cuvesGo }) {
    const M = global.NexusCarburantMoteur;
    if (!M) { console.error('NexusCarburantMoteur non chargé — pont réception carburant impossible.'); return { ok: false, error: new Error('moteur carburant absent') }; }
    if (!visiteId) { console.error('Pont réception carburant : visiteId requis pour l’idempotence.'); return { ok: false, error: new Error('visiteId manquant') }; }

    // Idempotence stricte par visite — voir l'en-tête ci-dessus : le diff par
    // valeur (plus bas) ne protège pas contre un double comptage de
    // livraison_*, qui est additif.
    const { data: dejaApplique, error: eCheck } = await client.from('carburant_releve_versions')
      .select('id').eq('visite_reception_id', visiteId).limit(1).maybeSingle();
    if (eCheck) { console.error('Pont réception carburant — vérification idempotence:', eCheck); return { ok: false, error: eCheck }; }
    if (dejaApplique) return { ok: true, dejaAJour: true };

    const precedent = await chargerReleveDuJour(client, siteId, date);
    const patch = M.patchReleveDepuisReceptionMesures(mesures, cuvesGo);
    const { versionNum, typeVersion } = M.prochaineVersionReleveCarburant(precedent);
    // `mesure_le` (27/08/2026, P0 — retour de Frédéric, crash réel sur
    // vito-sainte-marie) : ce pont (task #63) a été écrit AVANT le mécanisme
    // `mesure_le`/`instantFenetreReleve` (v2.205/v2.244), et n'a jamais été
    // mis à jour pour le renseigner — chaque réception via ce pont
    // enregistrait donc systématiquement `mesure_le: null`, alors que c'est
    // PRÉCISÉMENT le cas (`origine: 'reception_livraison'`) pour lequel
    // `instantFenetreReleve` a besoin d'un instant réel (un jaugeage
    // post-livraison n'est pas une ouverture de journée, v2.205). Résultat
    // réel constaté : `resoudreVentesFenetre` recevait un `t1` null et
    // plantait (`t1.getTime()`), remontant jusqu'au Brief NEXUS. Même
    // convention que l'écran manager (`NEXUS-Carburants-v1.html`,
    // `mesure_le: new Date().toISOString()` au moment de l'enregistrement) —
    // Article 11, jamais une deuxième convention de capture d'instant.
    const mesureLe = new Date().toISOString();

    const nouveauSnapshot = {
      stock_reel_go_cuve1: patch.stockReel.go_cuve1 != null ? patch.stockReel.go_cuve1 : (precedent ? precedent.stock_reel_go_cuve1 : null),
      stock_reel_go_cuve2: patch.stockReel.go_cuve2 != null ? patch.stockReel.go_cuve2 : (precedent ? precedent.stock_reel_go_cuve2 : null),
      stock_reel_sp95: patch.stockReel.sp95 != null ? patch.stockReel.sp95 : (precedent ? precedent.stock_reel_sp95 : null),
      stock_reel_gnr: patch.stockReel.gnr != null ? patch.stockReel.gnr : (precedent ? precedent.stock_reel_gnr : null),
      livraison_go: (precedent ? Number(precedent.livraison_go) || 0 : 0) + (patch.livraison.go || 0),
      livraison_sp95: (precedent ? Number(precedent.livraison_sp95) || 0 : 0) + (patch.livraison.sp95 || 0),
      livraison_gnr: (precedent ? Number(precedent.livraison_gnr) || 0 : 0) + (patch.livraison.gnr || 0),
      mouvement_go: precedent ? precedent.mouvement_go : 0,
      mouvement_sp95: precedent ? precedent.mouvement_sp95 : 0,
      mouvement_gnr: precedent ? precedent.mouvement_gnr : 0,
      motif_mouvement: precedent ? precedent.motif_mouvement : null,
      commentaire: precedent ? precedent.commentaire : null,
    };

    const diff = M.diffReleveCarburant(precedent, nouveauSnapshot);

    const { error: eVersion } = await client.from('carburant_releve_versions').insert({
      site: siteId, date, version_num: versionNum, type_version: typeVersion,
      ...nouveauSnapshot,
      motif_correction: typeVersion === 'correction_manager' ? 'Livraison carburant réceptionnée (pont Réception → Carburants)' : null,
      diff_vs_precedent: diff, auteur: employeeId, origine: 'reception_livraison',
      visite_reception_id: visiteId, mesure_le: mesureLe,
    });
    if (eVersion && eVersion.code !== '23505') {
      console.error('Preuve pont réception carburant (carburant_releve_versions):', eVersion);
      return { ok: false, error: eVersion };
    }

    const ligne = {
      site: siteId, date, version_num: versionNum, ...nouveauSnapshot,
      saisi_par: employeeId, origine: 'reception_livraison', mesure_le: mesureLe,
    };
    const { data, error } = await client.from('carburant_releves')
      .upsert(ligne, { onConflict: 'site,date' }).select().maybeSingle();
    if (error) { console.error('Écriture pont réception carburant (carburant_releves):', error); return { ok: false, error }; }

    return { ok: true, dejaAJour: false, releve: data };
  }

  // Déclare le jaugeage du jour impossible (équipement inaccessible, panne
  // Veeder-Root, etc.) — n'écrit JAMAIS de valeur dans carburant_releves
  // (Article 5, jamais une fausse précision) : seul le statut du jour est
  // posé, avec motif obligatoire, pour que le manager voie "non réalisé —
  // provisoire" plutôt qu'un silence qui ressemblerait à un oubli.
  async function enregistrerJaugeageImpossible(client, siteId, { date, employeeId, motif, commentaire }) {
    const { data, error } = await client.from('carburant_jaugeage_statuts_jour')
      .upsert({ site: siteId, date, statut: 'impossible', motif_impossible: motif, commentaire: commentaire || null, declare_par: employeeId }, { onConflict: 'site,date' })
      .select().maybeSingle();
    if (error) { console.error('Déclaration jaugeage impossible:', error); return { ok: false, error }; }
    return { ok: true, statut: data };
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
    // CORRECTIF 28/08/2026 (§19) : même raison que chargerDernierPointZero
    // ci-dessus — pas de filtre `statut` ici, cette liste alimente
    // pointZeroApplicable(date) pour CHAQUE jour de la fenêtre, y compris
    // des dates antérieures à la dernière certification (qui a fait passer
    // les précédentes en 'remplace' sans les invalider historiquement).
    const { data: pointsZeroAsc, error: e2 } = await client.from('carburant_stock_references')
      .select('*').eq('site', siteId).eq('type', 'initialisation').lte('date', fin)
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
        // Champ ajouté le 18/08/2026 (Cadrage risques Phase 5, tâche #234) —
        // additif, aucun champ existant retiré ni renommé : le stock
        // physique jaugé CE jour, jusqu'ici calculé en local puis jeté sans
        // être exposé. Nécessaire à NexusRisquesDonnees.
        // chargerAutonomiesCarburantAvecHistorique() pour reconstituer une
        // autonomie des jours précédents SANS écrire une 2e requête qui
        // relirait `carburant_releves` (Article 11 — cette fonction est déjà
        // la seule à reconstruire le physique par jour en tenant compte du
        // point zéro).
        resultatCarb.reelDuJour = reelDuJour;
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

  // ============================================================
  // VALORISATION ÉCONOMIQUE — Sprint C8 "Économique" (17/08/2026, audit
  // "Carburants — Réceptions, deltas et effet économique du stock" §6/§7).
  // Voir l'en-tête dédié dans nexus-carburant-moteur.js pour le contexte
  // complet (aucun coût d'achat n'existait nulle part dans NEXUS avant ce
  // sprint) — ce fichier ne fait AUCUN calcul de CMP/effet prix, il charge
  // les lignes brutes (Article 11).
  // ============================================================

  // Livraisons dont le coût d'achat a été saisi par un manager, triées
  // chronologiquement croissant, avec le stock avant livraison déjà
  // mesuré par jaugeage pendant cette même visite (carburant_reception_
  // mesures.jaugeage_avant_l, sommé par carburant — plusieurs cuves
  // peuvent porter le même carburant) — jamais une deuxième mesure de
  // stock physique inventée pour la valorisation (Article 11, réutilise
  // la vérité déjà posée par le Sprint C4). `quantiteLivreeL` = quantité
  // MESURÉE par jaugeage (vérité terrain), jamais le BL documentaire
  // (Article 5 — le CMP doit refléter ce qui est réellement entré en
  // cuve, pas ce qui était annoncé).
  async function chargerLivraisonsCouteesCarburant(client, siteId, carburant, limite = 60) {
    const { data: lignes, error: eLignes } = await client.from('carburant_reception_visite_lignes')
      .select('visite_id, quantite_mesuree_l, cout_achat_par_litre')
      .eq('site', siteId).eq('carburant', carburant)
      .not('cout_achat_par_litre', 'is', null)
      .limit(limite);
    if (eLignes) { console.error('Chargement livraisons coûtées carburant:', eLignes); return []; }
    if (!lignes || !lignes.length) return [];

    const visiteIds = lignes.map(l => l.visite_id);
    const [{ data: visites, error: eVisites }, { data: mesures, error: eMesures }] = await Promise.all([
      client.from('carburant_reception_visites').select('id, date_visite').in('id', visiteIds),
      client.from('carburant_reception_mesures').select('visite_id, jaugeage_avant_l').eq('carburant', carburant).in('visite_id', visiteIds),
    ]);
    if (eVisites) { console.error('Chargement visites (livraisons coûtées):', eVisites); return []; }
    if (eMesures) { console.error('Chargement mesures (livraisons coûtées):', eMesures); return []; }

    const dateParVisite = {};
    (visites || []).forEach(v => { dateParVisite[v.id] = v.date_visite; });
    const stockAvantParVisite = {};
    (mesures || []).forEach(m => {
      if (m.jaugeage_avant_l == null) return;
      stockAvantParVisite[m.visite_id] = (stockAvantParVisite[m.visite_id] || 0) + Number(m.jaugeage_avant_l);
    });

    return lignes
      .map(l => ({
        date: dateParVisite[l.visite_id] || null,
        stockAvantL: stockAvantParVisite[l.visite_id] != null ? stockAvantParVisite[l.visite_id] : null,
        quantiteLivreeL: l.quantite_mesuree_l,
        coutAchatParLitre: l.cout_achat_par_litre,
      }))
      // Une ligne dont la visite est introuvable (cas limite, jamais
      // observé en production) ne doit jamais entrer dans le calcul
      // silencieusement — exclue plutôt que triée avec une date null.
      .filter(l => l.date)
      .sort((a, b) => (a.date < b.date ? -1 : (a.date > b.date ? 1 : 0)));
  }

  // Prix de vente courant du site (station_config.prix_carburants — un
  // SEUL prix "actuel" en base, pas d'historique par mois : même source
  // déjà utilisée par Paramètres Station/APP/Verify, jamais une deuxième
  // copie, Article 11). Clés en base "sp"/"go"/"gnr" remappées ici vers
  // les clés carburant NEXUS standard "sp95"/"go"/"gnr".
  async function chargerPrixCarburantsCourant(client, siteId) {
    const { data, error } = await client.from('station_config')
      .select('prix_carburants').eq('site', siteId).maybeSingle();
    if (error) { console.error('Chargement prix carburants (Sprint C8):', error); return null; }
    const p = data && data.prix_carburants;
    if (!p) return null;
    return {
      sp95: p.sp != null ? Number(p.sp) : null,
      go: p.go != null ? Number(p.go) : null,
      gnr: p.gnr != null ? Number(p.gnr) : null,
      mois: p.mois || null,
    };
  }

  // Écriture manager du coût d'achat sur une ligne de réception déjà
  // posée (Sprint C8, l'employé ne connaît jamais ce coût au moment de la
  // livraison). RLS déjà restreint UPDATE à manager/gérant + site
  // (vérifié en direct lors du Sprint C5 "Robustesse") — aucune nouvelle
  // politique nécessaire.
  async function enregistrerCoutAchatLigne(client, ligneId, coutAchatParLitre, nomManager) {
    const { error } = await client.from('carburant_reception_visite_lignes')
      .update({ cout_achat_par_litre: coutAchatParLitre, cout_saisi_par: nomManager || null, cout_saisi_le: new Date().toISOString() })
      .eq('id', ligneId);
    if (error) { console.error('Enregistrement coût d\'achat (Sprint C8):', error); return false; }
    return true;
  }

  // ============================================================
  // TARIFS D'ACHAT (cahier "Vocabulaire & intégration du prix d'achat",
  // 17/08/2026, §4/§5/§6) — table carburant_tarifs_achat (migration
  // carburant_tarifs_achat_prix_snapshot). La résolution "quel tarif
  // s'applique à une date" est faite par la BASE (trigger
  // carburant_resoudre_prix_achat_snapshot) au moment où une réception est
  // créée — c'est cette valeur, jamais recalculée, qui compte. Ce fichier
  // ne fait que charger/écrire des lignes brutes (Article 11) ; l'écran
  // "Tarifs actifs" utilise en plus NexusCarburantMoteur.resoudreTarifActifParmi
  // pour savoir, à l'affichage, lequel des tarifs déjà saisis est actif
  // aujourd'hui — même règle, appliquée côté client uniquement pour
  // montrer l'état courant, jamais pour écrire une réception.
  // ============================================================

  // Historique des tarifs d'un carburant, le plus récent en premier —
  // alimente à la fois "Tarifs actifs" (le premier après tri par
  // date_effet décroissant est l'actif à ce jour) et l'historique complet
  // affiché dans le bloc manager "Tarifs carburants".
  async function chargerHistoriqueTarifsAchat(client, siteId, carburant, limite = 24) {
    const { data, error } = await client.from('carburant_tarifs_achat')
      .select('*').eq('site', siteId).eq('carburant', carburant)
      .order('date_effet', { ascending: false }).order('created_at', { ascending: false })
      .limit(limite);
    if (error) { console.error('Chargement historique tarifs achat carburant:', error); return []; }
    return data || [];
  }

  // Les 3 carburants d'un coup, pour l'écran Économie/Tarifs — une seule
  // fonction plutôt que 3 appels dispersés dans l'écran (Article 11).
  async function chargerHistoriqueTarifsAchatTousCarburants(client, siteId, limite = 24) {
    const M = global.NexusCarburantMoteur;
    const resultat = {};
    await Promise.all(M.CLES_CARBURANT.map(async cle => {
      resultat[cle] = await chargerHistoriqueTarifsAchat(client, siteId, cle, limite);
    }));
    return resultat;
  }

  // Écriture manager d'un nouveau tarif d'achat de référence (§4 du
  // cahier) — jamais un UPDATE d'une ligne existante : chaque saisie crée
  // une nouvelle version, la précédente reste en base telle quelle (§10,
  // "ne réécrit pas les snapshots déjà appliqués"). `dateFin` optionnelle,
  // purement informative (la résolution ne s'appuie que sur date_effet,
  // voir le trigger et resoudreTarifActifParmi).
  async function enregistrerTarifAchat(client, { site, carburant, dateEffet, dateFin, prixAchatParLitre, prixVenteParLitre, sourceType, sourceReference, createdBy }) {
    const { data, error } = await client.from('carburant_tarifs_achat').insert({
      site, carburant, date_effet: dateEffet, date_fin: dateFin || null,
      prix_achat_par_litre: prixAchatParLitre,
      prix_vente_par_litre: prixVenteParLitre != null ? prixVenteParLitre : null,
      source_type: sourceType || 'saisie_manager',
      source_reference: sourceReference || null,
      created_by: createdBy || null,
    }).select().single();
    if (error) { console.error('Enregistrement tarif achat carburant:', error); return null; }
    return data;
  }

  // Override manager "prix spécifique à cette livraison" (§6 du cahier) —
  // motif obligatoire côté appelant (l'UI bloque l'envoi sans motif, cette
  // fonction ne fait que persister ce qui lui est donné). Ne touche jamais
  // carburant_tarifs_achat : le tarif de référence du mois reste intact,
  // seule cette ligne de réception change.
  async function enregistrerOverridePrixLigne(client, ligneId, { prixParLitre, motif, nomManager }) {
    const { error } = await client.from('carburant_reception_visite_lignes').update({
      cout_achat_par_litre: prixParLitre,
      cout_saisi_par: nomManager || null,
      cout_saisi_le: new Date().toISOString(),
      prix_achat_override: true,
      prix_achat_override_motif: motif,
      prix_achat_source_id: null,
    }).eq('id', ligneId);
    if (error) { console.error('Enregistrement override prix achat (réception):', error); return false; }
    return true;
  }

  global.NexusCarburantDonnees = {
    CARBURANTS_INFO, chargerVentesPeriode, alignerQuartsComparables, chargerControleJour,
    enregistrerContexteVentilation, chargerJoursSansReleve,
    chargerCuvesConfig, chargerConsommationJournaliereMoyenne, CUVES_PAR_DEFAUT,
    chargerDerniereLivraison, chargerDernierPointZero, certifierPointZero,
    chargerHistoriquePointsZero, chargerHistoriqueReleves,
    chargerReleveDuJour, chargerStatutJaugeageJour,
    enregistrerJaugeageOuverturePompiste, enregistrerJaugeageImpossible,
    enregistrerReleveDepuisReceptionLivraison,
    chargerDerniersControles, chargerVersionsControleCarburant,
    chargerHistoriqueControlesCarburant,
    chargerLivraisonsCouteesCarburant, chargerPrixCarburantsCourant, enregistrerCoutAchatLigne,
    chargerHistoriqueTarifsAchat, chargerHistoriqueTarifsAchatTousCarburants,
    enregistrerTarifAchat, enregistrerOverridePrixLigne,
  };
})(typeof window !== 'undefined' ? window : globalThis);
