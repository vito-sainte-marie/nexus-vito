// ============================================================
// NEXUS Progression — le Conseiller devient un coach personnel.
//
// Demande de Frédéric le 27/07/2026 : transformer "Mon Évolution" (jamais
// livré, resté à l'état de prototype dans NEXUS-Home-Concept-v1.html) en
// "Ma Progression". Trois questions guident tout ce moteur, jamais un
// chiffre nu :
//   1. Pourquoi cet écart est-il probablement arrivé ?
//   2. Comment l'éviter demain ?
//   3. Quels progrès ont été réalisés ?
//
// Philosophie non négociable (Article 5 + langage NEXUS déjà en vigueur
// dans nexus-verify/nexus-marge/nexus-tempo) :
//   - jamais un chiffre inventé — "Données insuffisantes" plutôt qu'un
//     score optimiste par défaut ;
//   - jamais une accusation — "les données indiquent" plutôt que "vous
//     avez fait" ;
//   - jamais une comparaison entre collègues — uniquement la personne
//     comparée à elle-même dans le temps.
//
// Attribution des écarts de caisse (décision de Frédéric, 27/07/2026) :
// audits_caisse.employes_piste/employes_boutique sont des LISTES —
// plusieurs personnes peuvent partager le même poste au même quart. Un
// écart n'est donc compté dans les statistiques personnelles d'un employé
// QUE s'il/elle était seul(e) sur ce poste ce quart-là (liste à 1 élément)
// : aucune ambiguïté, jamais de fausse accusation sur un poste partagé.
// Un quart partagé compte quand même comme "service travaillé" (utile aux
// points forts positifs, ex. "14 services sans écart" — un écart conforme
// ne fait de tort à personne, l'attribution n'a pas besoin d'être certaine
// pour créditer un bon résultat), mais jamais comme preuve d'un écart
// individuel.
//
// Inclure dans une page : <script src="nexus-progression.js"></script>
// (même mécanisme que nexus-auth.js, nexus-marge.js, nexus-tempo.js)
// ============================================================

(function (global) {
  // Même seuil que NEXUS Verify (classifierEcart) — ne jamais faire
  // coexister deux définitions différentes de "écart conforme" dans NEXUS.
  const SEUIL_ECART_CONFORME = 2; // €

  // Seuils provisoires (27/07/2026) — premier jet documenté plutôt
  // qu'enfoui, à recalibrer une fois plusieurs mois d'historique réel
  // disponibles (même esprit que SEUIL_ECART_OPERATIONS_EUR dans App-v1).
  const SEUIL_MIN_PONTAGES = 5;
  const SEUIL_MIN_CONTROLES_TENUE = 3;
  const SEUIL_MIN_EVALUATIONS = 1;
  const SEUIL_MIN_ASSIGNATIONS = 3;
  const SEUIL_MIN_ECARTS_TENDANCE = 2; // par fenêtre, pour comparer deux périodes

  // ------------------------------------------------------------
  // 1) Services caisse — reconstruction par employé
  // ------------------------------------------------------------

  // rowsAudits : lignes audits_caisse déjà filtrées par site (date, quart,
  // ecart_piste, ecart_boutique, employes_piste, employes_boutique).
  function construireServicesCaisse(rowsAudits, employeeId) {
    const services = [];
    (rowsAudits || []).forEach(a => {
      const listePiste = a.employes_piste || [];
      const listeBoutique = a.employes_boutique || [];
      const surPiste = listePiste.includes(employeeId);
      const surBoutique = listeBoutique.includes(employeeId);
      if (!surPiste && !surBoutique) return;
      services.push({
        date: a.date,
        quart: a.quart,
        surPiste, surBoutique,
        soloPiste: surPiste && listePiste.length === 1,
        soloBoutique: surBoutique && listeBoutique.length === 1,
        ecartPiste: surPiste ? Number(a.ecart_piste) : null,
        ecartBoutique: surBoutique ? Number(a.ecart_boutique) : null,
      });
    });
    // Plus récent d'abord — plus pratique pour les séries et le compteur
    // "N derniers services" du message d'accueil.
    services.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
    return services;
  }

  function estConforme(montant) {
    return montant == null || Math.abs(montant) <= SEUIL_ECART_CONFORME;
  }

  // Un service est "propre" si tous les postes occupés par l'employé ce
  // jour-là sont conformes — peu importe qu'il ait été seul ou non : un
  // écart conforme ne fait de tort à personne, l'attribution n'a pas
  // besoin d'être certaine pour créditer un bon résultat.
  function serviceEstPropre(s) {
    const okPiste = !s.surPiste || estConforme(s.ecartPiste);
    const okBoutique = !s.surBoutique || estConforme(s.ecartBoutique);
    return okPiste && okBoutique;
  }

  function nbServicesConformes(services) {
    return (services || []).filter(serviceEstPropre).length;
  }

  // Écarts réellement attribuables à CET employé : uniquement les postes
  // occupés en solo et hors seuil de conformité. C'est la SEULE liste
  // utilisable pour parler de "vos écarts" — tout le reste resterait une
  // supposition sur un poste partagé.
  function ecartsAttribuables(services) {
    const ecarts = [];
    (services || []).forEach(s => {
      if (s.soloPiste && !estConforme(s.ecartPiste)) {
        ecarts.push({ date: s.date, quart: s.quart, poste: 'piste', montant: s.ecartPiste });
      }
      if (s.soloBoutique && !estConforme(s.ecartBoutique)) {
        ecarts.push({ date: s.date, quart: s.quart, poste: 'boutique', montant: s.ecartBoutique });
      }
    });
    ecarts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return ecarts;
  }

  // Série de services propres — la plus récente (en cours) et la
  // meilleure jamais observée. Sert à "vous êtes à N services sans écart"
  // et "vous égalez/battez votre record".
  function meilleureSerieConforme(services) {
    // services est trié du plus récent au plus ancien : on le retrie du
    // plus ancien au plus récent pour parcourir l'historique dans l'ordre
    // chronologique, plus simple pour détecter des séries.
    const chrono = [...(services || [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    let record = 0, courante = 0, enCours = 0;
    chrono.forEach(s => {
      if (serviceEstPropre(s)) {
        courante += 1;
        if (courante > record) record = courante;
      } else {
        courante = 0;
      }
    });
    // La série "en cours" est la série propre qui se termine au tout
    // dernier service connu (si le dernier service n'est pas propre, la
    // série en cours est 0).
    for (let i = chrono.length - 1; i >= 0; i--) {
      if (serviceEstPropre(chrono[i])) enCours += 1; else break;
    }
    return { enCours, record, total: chrono.length };
  }

  // Tendance de l'écart moyen (uniquement sur les écarts attribuables) :
  // compare les nbJours derniers jours à la fenêtre équivalente juste
  // avant. Retourne null si l'une des deux fenêtres n'a pas assez
  // d'écarts pour être honnête (SEUIL_MIN_ECARTS_TENDANCE) — jamais de
  // "-40 %" calculé sur un ou deux points isolés.
  function tendanceEcartMoyen(ecarts, nbJours) {
    if (!ecarts || !ecarts.length) return null;
    const jours = nbJours || 21;
    const auj = new Date();
    const seuil1 = new Date(auj.getTime() - jours * 86400000).toISOString().slice(0, 10);
    const seuil2 = new Date(auj.getTime() - 2 * jours * 86400000).toISOString().slice(0, 10);
    const recents = ecarts.filter(e => e.date >= seuil1);
    const precedents = ecarts.filter(e => e.date >= seuil2 && e.date < seuil1);
    if (recents.length < SEUIL_MIN_ECARTS_TENDANCE || precedents.length < SEUIL_MIN_ECARTS_TENDANCE) return null;
    const moyenne = liste => liste.reduce((s, e) => s + Math.abs(e.montant), 0) / liste.length;
    const moyRecente = moyenne(recents);
    const moyPrecedente = moyenne(precedents);
    return { moyRecente, moyPrecedente, ameliore: moyRecente < moyPrecedente, nbJours: jours };
  }

  // Répartition par quart des écarts attribuables — purement descriptive,
  // jamais présentée comme une cause psychologique inventée ("l'attention
  // baisse en fin de service" n'est pas une donnée, c'est une hypothèse).
  // On se limite à ce que les données montrent réellement : la proportion
  // du quart dominant.
  function quartDominant(ecarts) {
    if (!ecarts || ecarts.length < SEUIL_MIN_ECARTS_TENDANCE) return null;
    const parQuart = {};
    ecarts.forEach(e => { parQuart[e.quart] = (parQuart[e.quart] || 0) + 1; });
    const quarts = Object.keys(parQuart);
    if (quarts.length < 2) return { quart: quarts[0], part: 1, n: ecarts.length };
    quarts.sort((a, b) => parQuart[b] - parQuart[a]);
    const quart = quarts[0];
    const part = parQuart[quart] / ecarts.length;
    return part >= 0.7 ? { quart, part, n: ecarts.length } : null;
  }

  // ------------------------------------------------------------
  // 2) Les 5 compétences (Caisse / Ponctualité / Missions / Tenue /
  //    Relation client) — même palette de statuts que l'État global de
  //    App-v1 (COULEUR_STATUT_DOMAINE), pour rester cohérent visuellement.
  // ------------------------------------------------------------

  function statutCaisse(services) {
    const attribuables = services.filter(s => s.soloPiste || s.soloBoutique);
    if (attribuables.length < SEUIL_MIN_ASSIGNATIONS) return { statut: 'Données insuffisantes', detail: null };
    const nbEcarts = ecartsAttribuables(services).length;
    const taux = 1 - nbEcarts / attribuables.length;
    if (taux >= 0.9) return { statut: 'Sous contrôle', detail: `${nbEcarts} écart(s) sur ${attribuables.length} service(s) en solo` };
    if (taux >= 0.7) return { statut: 'À surveiller', detail: `${nbEcarts} écart(s) sur ${attribuables.length} service(s) en solo` };
    return { statut: 'À corriger', detail: `${nbEcarts} écart(s) sur ${attribuables.length} service(s) en solo` };
  }

  // Même formule que statutEquipe (App-v1) et chargerDomainesRadarHome —
  // jamais une deuxième définition du score de ponctualité qui donnerait
  // un chiffre différent de ce que voit déjà le manager.
  function statutPonctualite(pointagesArriveeEmploye) {
    const total = (pointagesArriveeEmploye || []).length;
    if (total < SEUIL_MIN_PONTAGES) return { statut: 'Données insuffisantes', detail: null };
    const retards = pointagesArriveeEmploye.filter(p => (p.retard_min || 0) > 0);
    const totalRetard = retards.reduce((s, p) => s + (p.retard_min || 0), 0);
    const score = Math.round(Math.max(0, 100 - totalRetard));
    const statut = score >= 90 ? 'Sous contrôle' : score >= 70 ? 'À surveiller' : 'À corriger';
    return { statut, detail: `${retards.length} retard(s) sur ${total} pointage(s)`, score, nbRetards: retards.length, total };
  }

  // mission_assignments : uniquement les missions ponctuelles assignées
  // avec échéance (assigned_to_employee_id, due_at, status, updated_at) —
  // les missions récurrentes du catalogue n'ont pas de notion
  // d'assignation individuelle, elles ne peuvent donc pas entrer dans ce
  // calcul sans inventer un total qui n'existe pas.
  function statutMissions(assignationsEmploye) {
    const total = (assignationsEmploye || []).length;
    if (total < SEUIL_MIN_ASSIGNATIONS) return { statut: 'Données insuffisantes', detail: null };
    const terminees = assignationsEmploye.filter(a => a.status === 'terminee');
    const taux = terminees.length / total;
    const enRetard = terminees.filter(a => a.due_at && a.updated_at && a.updated_at.slice(0, 10) > a.due_at.slice(0, 10)).length;
    const statut = (taux >= 0.9 && enRetard === 0) ? 'Sous contrôle' : (taux >= 0.6 ? 'À surveiller' : 'À corriger');
    return { statut, detail: `${terminees.length}/${total} mission(s) assignée(s) terminée(s)`, taux, enRetard };
  }

  function statutTenue(controlesEmploye) {
    const total = (controlesEmploye || []).length;
    if (total < SEUIL_MIN_CONTROLES_TENUE) return { statut: 'Données insuffisantes', detail: null };
    const conformes = controlesEmploye.filter(c => c.conforme).length;
    const taux = conformes / total * 100;
    const statut = taux >= 90 ? 'Sous contrôle' : taux >= 70 ? 'À surveiller' : 'À corriger';
    return { statut, detail: `${conformes}/${total} contrôle(s) conforme(s)`, taux };
  }

  // evaluations_employes : critère "accueil" (type standard, /2) et
  // "service" (type renfort, /5) — les deux seuls critères qui parlent
  // explicitement de relation client dans la grille réelle
  // (NEXUS-Evaluation-Employe-v1.html). Normalisés sur 100 puis moyennés.
  function statutRelationClient(evaluationsEmploye) {
    const notes = [];
    (evaluationsEmploye || []).forEach(e => {
      if (!e.criteres) return;
      if (e.type === 'standard' && e.criteres.accueil != null) notes.push(e.criteres.accueil / 2 * 100);
      if (e.type === 'renfort' && e.criteres.service != null) notes.push(e.criteres.service / 5 * 100);
    });
    if (notes.length < SEUIL_MIN_EVALUATIONS) return { statut: 'Données insuffisantes', detail: null };
    const moyenne = notes.reduce((s, n) => s + n, 0) / notes.length;
    const statut = moyenne >= 85 ? 'Sous contrôle' : moyenne >= 60 ? 'À surveiller' : 'À corriger';
    return { statut, detail: `${notes.length} évaluation(s) prise(s) en compte`, moyenne };
  }

  // ------------------------------------------------------------
  // 3) Niveau NEXUS — synthèse des 5 compétences en étoiles.
  //    V1 provisoire (27/07/2026) : compte, parmi les compétences ayant
  //    assez de données, la proportion "Sous contrôle" — les compétences
  //    à "Données insuffisantes" sont exclues du calcul (jamais pénalisées
  //    pour un manque de données, Article 5), pas remplacées par une
  //    valeur par défaut optimiste ni pessimiste.
  // ------------------------------------------------------------
  function niveauNexus(competences) {
    const exploitables = Object.values(competences).filter(c => c.statut !== 'Données insuffisantes');
    if (!exploitables.length) return { etoiles: null, detail: 'Historique encore insuffisant pour établir un niveau NEXUS.' };
    const poids = { 'Sous contrôle': 1, 'À surveiller': 0.5, 'À corriger': 0 };
    const score = exploitables.reduce((s, c) => s + (poids[c.statut] != null ? poids[c.statut] : 0), 0) / exploitables.length;
    const etoiles = Math.max(1, Math.round(score * 5));
    return { etoiles, detail: `${exploitables.length}/${Object.keys(competences).length} compétence(s) avec assez de données` };
  }

  // ------------------------------------------------------------
  // 4) Points forts — jamais fabriqués : chaque bullet doit être appuyé
  //    par un vrai seuil franchi. Retourne au plus 3 lignes, les plus
  //    parlantes en premier.
  // ------------------------------------------------------------
  function pointsForts({ services, statutPonctualiteVal, statutTenueVal, statutRelationClientVal }) {
    const forts = [];
    const serie = meilleureSerieConforme(services);
    if (serie.enCours >= 3) {
      forts.push({ texte: `${serie.enCours} service${serie.enCours > 1 ? 's' : ''} sans écart de caisse d'affilée.`, poids: serie.enCours });
    } else if (nbServicesConformes(services) >= 5 && services.length >= 5) {
      const pct = Math.round(nbServicesConformes(services) / services.length * 100);
      if (pct >= 80) forts.push({ texte: `${pct} % de vos services sans écart de caisse.`, poids: pct / 20 });
    }
    if (statutPonctualiteVal.statut === 'Sous contrôle' && statutPonctualiteVal.nbRetards === 0) {
      forts.push({ texte: `Ponctualité parfaite sur vos ${statutPonctualiteVal.total} derniers pointages.`, poids: statutPonctualiteVal.total / 5 });
    }
    if (statutTenueVal.statut === 'Sous contrôle') {
      forts.push({ texte: 'Tenue conforme lors de vos derniers contrôles.', poids: 3 });
    }
    if (statutRelationClientVal.statut === 'Sous contrôle') {
      forts.push({ texte: 'Excellent accueil client observé.', poids: 3 });
    }
    forts.sort((a, b) => b.poids - a.poids);
    return forts.slice(0, 3).map(f => f.texte);
  }

  // ------------------------------------------------------------
  // 5) Axe de progression principal — un seul, le plus significatif
  //    parmi les compétences ayant assez de données. Priorité : "À
  //    corriger" avant "À surveiller" ; à égalité, le plus de preuves
  //    disponibles gagne (plus fiable à expliquer).
  // ------------------------------------------------------------
  const ORDRE_GRAVITE = { 'À corriger': 2, 'À surveiller': 1, 'Sous contrôle': 0 };

  function identifierAxeProgression({ services, statutCaisseVal, statutPonctualiteVal, statutMissionsVal, statutTenueVal, ecartsAttribuablesVal }) {
    const candidats = [
      { domaine: 'Caisse', val: statutCaisseVal, preuves: ecartsAttribuablesVal.length },
      { domaine: 'Ponctualité', val: statutPonctualiteVal, preuves: statutPonctualiteVal.nbRetards || 0 },
      { domaine: 'Missions', val: statutMissionsVal, preuves: statutMissionsVal.enRetard || 0 },
      { domaine: 'Tenue', val: statutTenueVal, preuves: 1 },
    ].filter(c => c.val.statut !== 'Données insuffisantes' && ORDRE_GRAVITE[c.val.statut] > 0);

    if (!candidats.length) return null;
    candidats.sort((a, b) => (ORDRE_GRAVITE[b.val.statut] - ORDRE_GRAVITE[a.val.statut]) || (b.preuves - a.preuves));
    const choisi = candidats[0];

    if (choisi.domaine === 'Caisse') {
      // Vocabulaire coach (27/07/2026, demande de Frédéric — "le Coach ne
      // parle jamais de problèmes, il parle de progression") : "point
      // d'attention" plutôt que "écart", uniquement sur ce texte destiné
      // au coach personnel (identifierAxeProgression n'est consommé que
      // par Ma Progression, jamais par une vue manager).
      const dominant = quartDominant(ecartsAttribuablesVal);
      const constat = ecartsAttribuablesVal.length === 1
        ? `Un point d'attention a été identifié sur votre dernier service en solo (${Math.abs(ecartsAttribuablesVal[0].montant).toFixed(2)} €).`
        : `${ecartsAttribuablesVal.length} points d'attention ont été identifiés sur vos services en solo.`;
      const causeProbable = dominant
        ? `Les données indiquent qu'ils surviennent surtout lors du quart ${dominant.quart === 'quart2' ? 'du soir' : 'du matin'} (${dominant.n} sur ${ecartsAttribuablesVal.length}).`
        : null;
      return {
        domaine: 'Caisse', constat, causeProbable,
        recommandation: 'Prenez deux secondes supplémentaires pour vérifier chaque rendu de monnaie, en particulier pendant les périodes chargées.',
      };
    }
    if (choisi.domaine === 'Ponctualité') {
      return {
        domaine: 'Ponctualité',
        constat: `Les données indiquent ${statutPonctualiteVal.nbRetards} retard(s) sur vos ${statutPonctualiteVal.total} derniers pointages.`,
        causeProbable: null,
        recommandation: 'Prévoyez quelques minutes de marge avant le début de votre service pour sécuriser votre pointage.',
      };
    }
    if (choisi.domaine === 'Missions') {
      return {
        domaine: 'Missions',
        constat: `Les données indiquent ${statutMissionsVal.detail}.`,
        causeProbable: null,
        recommandation: 'Traitez vos missions assignées dès leur réception plutôt qu\'en fin d\'échéance, pour ne jamais dépendre du dernier moment.',
      };
    }
    // Tenue
    return {
      domaine: 'Tenue',
      constat: `Les données indiquent ${statutTenueVal.detail}.`,
      causeProbable: null,
      recommandation: 'Vérifiez votre tenue avant chaque prise de poste, à l\'aide de la liste utilisée lors des contrôles.',
    };
  }

  // ------------------------------------------------------------
  // 6) Encouragement — toujours quelque chose de réel à dire, jamais un
  //    chiffre gonflé. Priorité : record en cours > tendance en
  //    amélioration > proximité d'un record > message neutre.
  // ------------------------------------------------------------
  function genererEncouragement({ services, ecartsAttribuablesVal }) {
    const serie = meilleureSerieConforme(services);
    if (serie.enCours > 0 && serie.enCours >= serie.record && serie.total >= 5) {
      return `Vous réalisez actuellement votre meilleure série de services sans écart depuis le début de vos données NEXUS (${serie.enCours}).`;
    }
    const tendance = tendanceEcartMoyen(ecartsAttribuablesVal);
    if (tendance && tendance.ameliore) {
      return `Bonne nouvelle : votre écart moyen est passé de ${tendance.moyPrecedente.toFixed(2)} € à ${tendance.moyRecente.toFixed(2)} € sur les ${tendance.nbJours} derniers jours. Continuez ainsi.`;
    }
    if (serie.record > 0 && serie.enCours > 0 && serie.enCours < serie.record) {
      const reste = serie.record - serie.enCours;
      return `Vous êtes à ${reste} service${reste > 1 ? 's' : ''} sans écart de votre record personnel (${serie.record}).`;
    }
    return 'NEXUS affinera ses observations au fil de vos prochains services — continuez à enregistrer votre activité.';
  }

  // ------------------------------------------------------------
  // 7) Système de reconnaissance (27/07/2026, demande de Frédéric —
  //    "inciter les employés à utiliser NEXUS au maximum", voir
  //    Proposition_evolution_NEXUS_Employe.pdf) : niveaux nommés +
  //    badges de réussite. Même exigence que le reste du moteur — chaque
  //    seuil franchi doit être un vrai fait, jamais une estimation.
  // ------------------------------------------------------------

  // Série de ponctualité (même construction que meilleureSerieConforme,
  // appliquée aux pointages plutôt qu'aux services caisse) — nécessite
  // `date` sur chaque pointage pour être ordonnée chronologiquement.
  function calculerSeriePonctualite(pointagesArriveeEmploye) {
    const chrono = [...(pointagesArriveeEmploye || [])]
      .filter(p => p.date)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    let record = 0, courante = 0, enCours = 0;
    chrono.forEach(p => {
      if ((p.retard_min || 0) === 0) {
        courante += 1;
        if (courante > record) record = courante;
      } else {
        courante = 0;
      }
    });
    for (let i = chrono.length - 1; i >= 0; i--) {
      if ((chrono[i].retard_min || 0) === 0) enCours += 1; else break;
    }
    return { enCours, record, total: chrono.length };
  }

  // "Expérience" NEXUS — un proxy honnête de l'usage réel de l'app :
  // chaque composante ne peut exister que si l'employé est passé par
  // NEXUS (audit caisse renseigné par un manager sur un service travaillé,
  // mission cochée dans l'app, pointage effectué dans l'app). Encourager
  // l'expérience revient donc mécaniquement à encourager l'usage de NEXUS.
  function calculerExperience({ nbServices, nbMissionsCompletees, nbPointages }) {
    return (nbServices || 0) + (nbMissionsCompletees || 0) + (nbPointages || 0);
  }

  // Niveaux nommés (seuils provisoires, 27/07/2026 — à recalibrer avec
  // plusieurs mois de recul, même esprit que les autres seuils de ce
  // fichier). Un niveau élevé n'est jamais atteint si une compétence
  // reste "À corriger" — l'expérience ne remplace jamais la fiabilité,
  // elle s'y ajoute : plafond appliqué dans calculerNiveauNomme.
  const NIVEAUX_NEXUS = [
    { id: 'decouverte', nom: 'Découverte', seuil: 0 },
    { id: 'fiable', nom: 'Employé fiable', seuil: 15 },
    { id: 'confirme', nom: 'Confirmé', seuil: 40 },
    { id: 'reference', nom: 'Référence', seuil: 80 },
    { id: 'expert', nom: 'Expert', seuil: 150 },
    { id: 'ambassadeur', nom: 'Ambassadeur', seuil: 250 },
  ];

  function calculerNiveauNomme(experience, competences) {
    let index = 0;
    for (let i = 0; i < NIVEAUX_NEXUS.length; i++) {
      if (experience >= NIVEAUX_NEXUS[i].seuil) index = i; else break;
    }
    const nbACorriger = Object.values(competences || {}).filter(c => c.statut === 'À corriger').length;
    if (nbACorriger >= 2) index = Math.min(index, 1); // jamais au-delà de "Employé fiable"
    else if (nbACorriger === 1) index = Math.min(index, 3); // jamais au-delà de "Référence"

    const niveau = NIVEAUX_NEXUS[index];
    const suivant = NIVEAUX_NEXUS[index + 1] || null;
    return {
      id: niveau.id, nom: niveau.nom, experience,
      progression: suivant ? { manque: suivant.seuil - experience, seuilSuivant: suivant.seuil, nomSuivant: suivant.nom } : null,
    };
  }

  // Badges de réussite — "obtenu" dès que le record correspondant a été
  // atteint au moins une fois dans l'historique (pas besoin d'être dans
  // la série en ce moment, un badge gagné reste gagné). Paliers
  // progressifs choisis pour donner une première réussite tôt, comme
  // demandé par Frédéric ("inciter à utiliser NEXUS au maximum").
  function calculerBadges({ seriesCaisse, seriePonctualite, nbMissionsCompletees }) {
    const badges = [];
    const ajouter = (id, label, valeurActuelle, seuil) => {
      badges.push({ id, label, obtenu: valeurActuelle >= seuil, valeurActuelle, seuil });
    };
    ajouter('caisse-7', 'Une semaine sans écart de caisse (7 services)', seriesCaisse.record, 7);
    ajouter('caisse-30', 'Un mois sans écart de caisse (30 services)', seriesCaisse.record, 30);
    ajouter('ponctualite-7', '7 jours sans retard', seriePonctualite.record, 7);
    ajouter('ponctualite-30', '30 jours sans retard', seriePonctualite.record, 30);
    ajouter('missions-25', '25 missions réalisées', nbMissionsCompletees || 0, 25);
    ajouter('missions-100', '100 missions réalisées', nbMissionsCompletees || 0, 100);
    return badges;
  }

  global.NexusProgression = {
    SEUIL_ECART_CONFORME,
    construireServicesCaisse, estConforme, serviceEstPropre,
    nbServicesConformes, ecartsAttribuables, meilleureSerieConforme,
    tendanceEcartMoyen, quartDominant,
    statutCaisse, statutPonctualite, statutMissions, statutTenue, statutRelationClient,
    niveauNexus, pointsForts, identifierAxeProgression, genererEncouragement,
    calculerSeriePonctualite, calculerExperience, calculerNiveauNomme, calculerBadges,
    NIVEAUX_NEXUS,
  };
})(window);
