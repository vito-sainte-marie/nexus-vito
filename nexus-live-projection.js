// NEXUS — Projection Live (07/09/2026)
//
// Origine : lot NEXUS-LIVE-CONTROL-CENTER-1-20260906, spec-1.md §6.
// Réduit un journal d'événements `nexus-execution-event/1` (déjà validés,
// cf. nexus-live-evenement.js) en une projection structurée unique. Ne relit
// jamais de texte libre : uniquement les champs structurés du contrat.
//
// « Le Centre de contrôle lit la vérité d'exécution ; il ne pilote pas
// l'exécution nominale. » (spec-1.md §5) — ce module ne fait donc que
// projeter, jamais décider.

(function (global) {
  'use strict';

  const STATUT_SYSTEME = { AUTONOME: 'AUTONOMOUS', HUMAIN_REQUIS: 'HUMAN_REQUIRED', BLOQUE: 'FAIL_CLOSED', REPOS: 'IDLE' };

  function projectionVide() {
    return {
      system_status: STATUT_SYSTEME.REPOS,
      active_lots: [],
      active_actor: null,
      current_phase: null,
      guardians: {},
      tests: {},
      ci: {},
      next_automatic_step: null,
      last_event_id: null,
      updated_at: null,
    };
  }

  function parAntecedenceOccurredAt(a, b) {
    return Date.parse(a.occurred_at) - Date.parse(b.occurred_at);
  }

  // events : liste d'événements déjà validés (nexus-live-evenement.js).
  // Événements non conformes ou non fournis => projection vide (fail
  // closed sur l'affichage, jamais une projection inventée).
  function construireProjectionLive(events) {
    if (!Array.isArray(events) || events.length === 0) return projectionVide();

    const tries = events.slice().sort(parAntecedenceOccurredAt);
    const parLot = new Map();
    for (const evt of tries) {
      if (!parLot.has(evt.lot_id)) parLot.set(evt.lot_id, []);
      parLot.get(evt.lot_id).push(evt);
    }

    const dernier = tries[tries.length - 1];
    const projection = projectionVide();
    projection.active_lots = Array.from(parLot.keys());
    projection.last_event_id = dernier.event_id;
    projection.updated_at = dernier.occurred_at;
    projection.current_phase = dernier.phase;
    projection.active_actor = dernier.actor ? dernier.actor.id : null;
    projection.next_automatic_step = dernier.next_step != null ? dernier.next_step : null;

    // Guardians : dernier statut connu par acteur de rôle "guardian" et par lot.
    for (const evt of tries) {
      if (evt.actor && evt.actor.role === 'guardian') {
        projection.guardians[evt.actor.id] = evt.status;
      }
    }

    // Tests/CI : dernier statut connu pour les phases TEST / CI.
    for (const evt of tries) {
      if (evt.phase === 'TEST') projection.tests[evt.lot_id] = evt.status;
      if (evt.phase === 'CI') projection.ci[evt.lot_id] = evt.status;
    }

    // Gate humain : un événement human_gate.required=true non suivi d'un
    // événement plus récent qui le referme reste actif. On ne referme un
    // gate que si un événement postérieur du même lot déclare
    // human_gate.required=false ou atteint DONE.
    let gateActif = null;
    for (const evt of tries) {
      if (evt.human_gate && evt.human_gate.required) {
        // `event_id` transporté : une autorisation doit pouvoir DÉSIGNER la
        // question à laquelle elle répond. Sans cette référence, elle flotte
        // sans objet et rien ne permet de rapprocher la réponse du gate.
        gateActif = { event_id: evt.event_id || null, lot_id: evt.lot_id,
          reason_code: evt.human_gate.reason_code || null, question: evt.human_gate.question };
      // `evt.lot_id === gateActif.lot_id` : le commentaire ci-dessus promettait
      // « du même lot » depuis le premier jour, le code ne le vérifiait pas.
      // N'importe quel événement DONE, même d'un autre lot, éteignait donc le
      // gate — et avec lui le compteur « en attente de ton arbitrage ».
      } else if (gateActif && evt.lot_id === gateActif.lot_id
        && (evt.phase === 'DONE' || (evt.human_gate && evt.human_gate.required === false))) {
        gateActif = null;
      }
    }

    if (dernier.status === 'BLOCKED' && !gateActif) {
      projection.system_status = STATUT_SYSTEME.BLOQUE;
    } else if (gateActif) {
      projection.system_status = STATUT_SYSTEME.HUMAIN_REQUIS;
      projection.human_gate = gateActif;
    } else if (dernier.phase === 'DONE' && dernier.status === 'PASSED') {
      projection.system_status = STATUT_SYSTEME.REPOS;
    } else {
      projection.system_status = STATUT_SYSTEME.AUTONOME;
    }

    return projection;
  }

  // ── Fraîcheur du journal ────────────────────────────────────────────
  //
  // Le 08/09/2026, l'écran Live affichait huit événements vieux de treize
  // heures sans le dire : un journal mort ressemblait exactement à un journal
  // vivant. C'est le mode de défaillance que NEXUS combat partout ailleurs —
  // « une anomalie ne doit jamais être masquée par un affichage rassurant »
  // (Bible, Philosophie).
  //
  // Cette fonction ne décide de rien : elle rend l'âge et un niveau, l'écran
  // choisit comment le montrer. Sans horodatage exploitable, elle rend
  // `INCONNU` — jamais « frais ».
  const SEUIL_TIEDE_MIN = 30;
  const SEUIL_FROID_MIN = 180;

  function fraicheurJournal(events, maintenantISO) {
    const t1 = Date.parse(maintenantISO);
    if (!Array.isArray(events) || !events.length || !Number.isFinite(t1)) {
      return { niveau: 'INCONNU', ageMinutes: null, dernierISO: null };
    }
    let dernier = null;
    for (const e of events) {
      const t = Date.parse(e && e.occurred_at);
      if (!Number.isFinite(t)) continue;
      if (dernier === null || t > dernier) dernier = t;
    }
    if (dernier === null) return { niveau: 'INCONNU', ageMinutes: null, dernierISO: null };
    const ageMinutes = Math.max(0, Math.round((t1 - dernier) / 60000));
    const niveau = ageMinutes >= SEUIL_FROID_MIN ? 'FROID'
      : ageMinutes >= SEUIL_TIEDE_MIN ? 'TIEDE' : 'FRAIS';
    return { niveau, ageMinutes, dernierISO: new Date(dernier).toISOString() };
  }

  // ── Bloc « Déploiements » ───────────────────────────────────────────
  //
  // Les trois compteurs demandés par Frédéric. Ils sont LUS dans la preuve du
  // dernier événement de type `deploiement`, jamais recalculés ici : leur
  // propriétaire logique est `outils/etat-deploiement.js` (Bible,
  // « Architecture de vérité »).
  //
  // En l'absence d'un tel événement, on rend `null` — et l'écran doit alors
  // dire qu'il ne sait pas, jamais afficher trois zéros. Un tableau de bord
  // qui montre des zéros faute de données ment plus qu'un tableau vide.
  function extraireDeploiements(events) {
    if (!Array.isArray(events)) return null;
    let retenu = null, tRetenu = -Infinity;
    for (const e of events) {
      const ev = e && e.evidence;
      if (!ev || ev.type !== 'deploiement' || !ev.compteurs) continue;
      const t = Date.parse(e.occurred_at);
      if (!Number.isFinite(t) || t < tRetenu) continue;
      retenu = e; tRetenu = t;
    }
    if (!retenu) return null;
    const ev = retenu.evidence;
    return {
      compteurs: ev.compteurs,
      dette: ev.dette || null,
      ecart: ev.ecart || null,
      // Jamais un fait : l'écran doit l'afficher comme une proposition.
      pretProductionEstUneProposition: ev.pret_production_est_une_proposition !== false,
      occurredAt: retenu.occurred_at,
      source: ev.ref || null,
    };
  }

  // ── LE VERDICT (08/09/2026) ─────────────────────────────────────────
  //
  // Retour de Frédéric en regardant l'écran : « on lit SYSTÈME AUTONOME, puis
  // juste dessous "Prochaine étape automatique : —", puis 0 en développement,
  // puis deux Guardians BLOCKED. Pour un humain, ces quatre éléments réunis
  // créent une question immédiate : est-ce que ça fonctionne réellement ou
  // est-ce que c'est bloqué ? Un système NEXUS ne devrait jamais laisser cette
  // ambiguïté. »
  //
  // Le bloc du haut doit donc rendre un JUGEMENT, pas des données. Et ce
  // jugement se CALCULE à partir des faits — un verdict affirmé serait
  // exactement le « chiffre inventé » que la Bible interdit ailleurs.
  //
  // Trois niveaux, et l'ordre compte : ce qui attend Frédéric l'emporte sur
  // tout le reste, puis un invariant non garanti, puis une simple vigilance.
  const VERDICT = { NORMAL: 'NORMAL', VIGILANCE: 'VIGILANCE', INTERVENTION: 'INTERVENTION' };

  // Traduction des statuts d'événement en langage d'exploitant.
  //
  // `BLOCKED` est le mot le plus trompeur du vocabulaire : le producteur
  // l'emploie pour une garde de RAPPORT qui a trouvé quelque chose — elle n'a
  // rien bloqué du tout. Frédéric l'a relevé : « BLOCKED est beaucoup trop
  // violent et trop ambigu ; cela peut signifier qu'ils ont découvert une
  // violation, qu'ils ne sont pas exécutables, qu'ils attendent, ou qu'ils ont
  // bloqué le pipeline. Ces situations sont radicalement différentes. »
  //
  // La traduction se fait ici et pas dans le producteur : changer le
  // vocabulaire du contrat demanderait une migration de la contrainte
  // `status` en base (même famille que LIVE-001). L'information, elle, est
  // déjà portée par le résumé de l'événement.
  function libelleStatutGarde(evt) {
    const s = evt && evt.status;
    if (s === 'PASSED') return { texte: 'Conforme', ton: 'ok' };
    if (s === 'FAILED') return { texte: 'Action requise', ton: 'grave' };
    if (s === 'BLOCKED') return { texte: 'À surveiller', ton: 'vigilance' };
    if (s === 'WAITING') return { texte: 'En attente', ton: 'attente' };
    if (s === 'STARTED' || s === 'PROGRESS') return { texte: 'En cours', ton: 'attente' };
    // Statut inconnu : on ne traduit pas ce qu'on ne comprend pas.
    return { texte: 'État non interprété', ton: 'inconnu' };
  }

  // Risques STRUCTURELS — ceux qui ne doivent jamais rester enfouis dans un
  // journal. Frédéric : « ce message ne doit absolument pas être enfoui dans
  // la timeline. C'est un risque structurel majeur. »
  function risquesStructurels(events) {
    const risques = [];
    if (!Array.isArray(events)) return risques;
    let barriere = null, tBarriere = -Infinity;
    for (const e of events) {
      const ev = e && e.evidence;
      if (!ev || ev.type !== 'protection') continue;
      const t = Date.parse(e.occurred_at);
      if (!Number.isFinite(t) || t < tBarriere) continue;
      barriere = e; tBarriere = t;
    }
    if (barriere && barriere.status === 'BLOCKED') {
      risques.push({
        code: 'PRODUCTION_NON_PROTEGEE',
        titre: 'Protection Production incomplète',
        texte: 'Un push direct vers la branche Production reste techniquement possible. '
          + 'Aucun passage en Production ne peut être garanti tant que cette protection n’est pas en place.',
      });
    }
    return risques;
  }

  // `events` : journal validé. `projection` : sortie de construireProjectionLive.
  // `deploiements` : sortie de extraireDeploiements (peut être null).
  function verdictLive({ events, projection, deploiements, fraicheur }) {
    const proj = projection || projectionVide();
    const risques = risquesStructurels(events);
    const gardes = Object.entries((proj.guardians) || {});
    const enEchec = gardes.filter(([, s]) => s === 'FAILED').map(([id]) => id);
    const aSurveiller = gardes.filter(([, s]) => s === 'BLOCKED').map(([id]) => id);
    const attend = proj.human_gate || null;

    // 1. Ce qui attend Frédéric passe avant tout.
    if (attend) {
      return { niveau: VERDICT.INTERVENTION, risques, enEchec, aSurveiller,
        titre: 'Une décision t’attend',
        explication: attend.question,
        decisions: 1 };
    }
    // 2. Une garde réellement en échec bloque la chaîne.
    if (enEchec.length) {
      return { niveau: VERDICT.INTERVENTION, risques, enEchec, aSurveiller,
        titre: 'La chaîne est arrêtée',
        explication: `${enEchec.length} contrôle(s) en échec : ${enEchec.join(', ')}. `
          + 'Rien ne progresse tant qu’ils ne sont pas corrigés.',
        decisions: 0 };
    }
    // 3. Un invariant non garanti interdit de dire « tout va bien ».
    //
    // Frédéric : « le statut global ne devrait probablement pas être vert
    // "système autonome" tant qu'un invariant aussi important n'est pas
    // garanti ». Le verdict le dit donc littéralement : autonome EN TEST.
    if (risques.length) {
      return { niveau: VERDICT.VIGILANCE, risques, enEchec, aSurveiller,
        titre: 'Autonome en Test',
        explication: 'La chaîne travaille seule sur Test. Mais un invariant de Production n’est pas garanti : '
          + risques.map(r => r.titre.toLowerCase()).join(', ') + '.',
        decisions: 0 };
    }
    // 4. Des signalements sans blocage : à surveiller, pas à craindre.
    if (aSurveiller.length) {
      return { niveau: VERDICT.VIGILANCE, risques, enEchec, aSurveiller,
        titre: 'La chaîne avance, avec des points à surveiller',
        explication: `${aSurveiller.length} contrôle(s) ont signalé quelque chose sans rien bloquer. `
          + 'Aucune décision ne t’est demandée.',
        decisions: 0 };
    }
    // 5. Rien à signaler — et on le DIT, plutôt que de laisser une page vide.
    const age = fraicheur && fraicheur.niveau !== 'INCONNU' ? fraicheur : null;
    return { niveau: VERDICT.NORMAL, risques, enEchec, aSurveiller,
      titre: 'La chaîne fonctionne normalement',
      explication: 'Claude et les Guardians poursuivent sans intervention.'
        + (age ? '' : ' L’âge du journal n’a pas pu être déterminé.'),
      decisions: 0 };
  }

  // ── LA TIMELINE RÉSUMÉE (08/09/2026) ────────────────────────────────
  //
  // Retour de Frédéric : « la timeline est le point le moins NEXUS de la page.
  // Elle montre plusieurs fois "Déploiements — 0 en développement, 24 clos,
  // 29 dettes", puis 30, puis 30 dont 20 P0, puis 31 dont 21 P0. Techniquement
  // je comprends : ce sont des snapshots successifs. Mais pour moi, cela
  // ressemble à du bruit. Ce n'est d'ailleurs pas vraiment une timeline, c'est
  // un journal système brut. »
  //
  // Ce que fait ce résumé :
  //   · il groupe les contrôles d'un même instant en UNE ligne ;
  //   · il ne montre un état de déploiement que s'il a CHANGÉ, et décrit
  //     alors le changement plutôt que de répéter l'état ;
  //   · il traduit chaque type d'événement en langage d'exploitant.
  //
  // CE QU'IL NE FAIT PAS : perdre de l'information en silence. Les répétitions
  // écartées sont COMPTÉES et rendues avec le résumé (`masques`), et le
  // journal technique complet reste accessible. Un résumé qui escamote sans
  // le dire serait la même faute que les cartes qui disparaissaient.
  //
  // Un type d'événement inconnu n'est jamais écarté : il est rendu tel quel et
  // marqué comme non interprété — on ne cache pas ce qu'on ne comprend pas.

  function compteursIdentiques(a, b) {
    if (!a || !b) return false;
    return a.en_developpement === b.en_developpement
      && a.attente_arbitrage === b.attente_arbitrage
      && a.clos === b.clos;
  }

  function detteIdentique(a, b) {
    const va = a && a.total, vb = b && b.total;
    const pa = a && a.p0, pb = b && b.p0;
    return va === vb && pa === pb;
  }

  function phraseChangement(avant, apres) {
    const morceaux = [];
    const d = (x, y) => (Number(y) || 0) - (Number(x) || 0);
    const dDette = avant && avant.dette && apres.dette ? d(avant.dette.total, apres.dette.total) : null;
    const dP0 = avant && avant.dette && apres.dette ? d(avant.dette.p0, apres.dette.p0) : null;
    if (dDette) {
      morceaux.push(`${Math.abs(dDette)} sujet${Math.abs(dDette) > 1 ? 's' : ''} `
        + `${dDette > 0 ? 'ajouté' : 'retiré'}${Math.abs(dDette) > 1 ? 's' : ''} au suivi`
        + (dP0 ? ` (dont ${Math.abs(dP0)} prioritaire${Math.abs(dP0) > 1 ? 's' : ''})` : ''));
    }
    const dDev = avant ? d(avant.compteurs.en_developpement, apres.compteurs.en_developpement) : null;
    const dArb = avant ? d(avant.compteurs.attente_arbitrage, apres.compteurs.attente_arbitrage) : null;
    const dClos = avant ? d(avant.compteurs.clos, apres.compteurs.clos) : null;
    if (dArb) morceaux.push(`${Math.abs(dArb)} arbitrage${Math.abs(dArb) > 1 ? 's' : ''} ${dArb > 0 ? 'en attente de plus' : 'de moins'}`);
    if (dClos) morceaux.push(`${Math.abs(dClos)} lot${Math.abs(dClos) > 1 ? 's' : ''} ${dClos > 0 ? 'terminé' : 'rouvert'}${Math.abs(dClos) > 1 ? 's' : ''}`);
    if (dDev) morceaux.push(`${Math.abs(dDev)} lot${Math.abs(dDev) > 1 ? 's' : ''} ${dDev > 0 ? 'ouvert' : 'refermé'}${Math.abs(dDev) > 1 ? 's' : ''}`);
    return morceaux.join(', ');
  }

  function resumerTimeline(events) {
    if (!Array.isArray(events) || !events.length) return { entrees: [], masques: 0 };
    const tries = events.slice().sort(parAntecedenceOccurredAt);
    const entrees = [];
    let masques = 0;
    let dernierDeploiement = null;
    let gardesEnCours = null;

    const viderGardes = () => {
      if (!gardesEnCours) return;
      const { moment, ok, surveiller, echec } = gardesEnCours;
      const parts = [];
      if (ok) parts.push(`${ok} conforme${ok > 1 ? 's' : ''}`);
      if (surveiller) parts.push(`${surveiller} à surveiller`);
      if (echec) parts.push(`${echec} en échec`);
      entrees.push({
        occurredAt: moment,
        titre: `Contrôles automatiques — ${parts.join(', ')}`,
        detail: echec ? 'La chaîne est arrêtée tant qu’ils ne passent pas.'
          : surveiller ? 'Signalements sans blocage : rien n’est arrêté.'
          : 'Aucun signalement.',
        ton: echec ? 'grave' : surveiller ? 'vigilance' : 'ok',
      });
      gardesEnCours = null;
    };

    for (const e of tries) {
      const ev = (e && e.evidence) || {};
      const type = ev.type;

      // Les contrôles d'un même instant forment UNE ligne.
      if (type === 'garde') {
        if (gardesEnCours && gardesEnCours.moment !== e.occurred_at) viderGardes();
        if (!gardesEnCours) gardesEnCours = { moment: e.occurred_at, ok: 0, surveiller: 0, echec: 0 };
        if (e.status === 'FAILED') gardesEnCours.echec++;
        else if (e.status === 'BLOCKED') gardesEnCours.surveiller++;
        else gardesEnCours.ok++;
        continue;
      }
      viderGardes();

      if (type === 'deploiement') {
        const apres = { compteurs: ev.compteurs, dette: ev.dette };
        if (dernierDeploiement
          && compteursIdentiques(dernierDeploiement.compteurs, apres.compteurs)
          && detteIdentique(dernierDeploiement.dette, apres.dette)) {
          masques++; // relevé identique : répéter l'état n'apprend rien
          continue;
        }
        const changement = dernierDeploiement ? phraseChangement(dernierDeploiement, apres) : '';
        entrees.push({
          occurredAt: e.occurred_at,
          titre: dernierDeploiement
            ? (changement || 'État des lots mis à jour')
            : 'État des lots relevé',
          detail: `${apres.compteurs.en_developpement} en développement, `
            + `${apres.compteurs.attente_arbitrage} en attente d’arbitrage, `
            + `${apres.compteurs.clos} terminés.`,
          ton: 'neutre',
        });
        dernierDeploiement = apres;
        continue;
      }

      if (type === 'protection') {
        entrees.push({
          occurredAt: e.occurred_at,
          titre: e.status === 'BLOCKED' ? 'Risque Production détecté' : 'Protection de Production vérifiée',
          detail: e.status === 'BLOCKED'
            ? 'Un push direct vers la branche Production reste possible.'
            : 'La branche est tenue : aucun passage direct.',
          ton: e.status === 'BLOCKED' ? 'grave' : 'ok',
        });
        continue;
      }

      if (type === 'ci') {
        const t = { PASSED: ['Intégration continue réussie', 'ok'], FAILED: ['Intégration continue en échec', 'grave'] }[e.status]
          || ['Intégration continue en cours', 'attente'];
        entrees.push({ occurredAt: e.occurred_at, titre: t[0], detail: e.summary, ton: t[1] });
        continue;
      }

      if (type === 'autorisation') {
        entrees.push({ occurredAt: e.occurred_at, titre: 'Autorisation accordée',
          detail: e.summary, ton: 'ok' });
        continue;
      }

      if (e.human_gate && e.human_gate.required) {
        entrees.push({ occurredAt: e.occurred_at, titre: 'Arbitrage demandé',
          detail: e.human_gate.question, ton: 'vigilance' });
        continue;
      }

      // Type non interprété : rendu tel quel, et DIT comme tel. On ne cache
      // pas ce qu'on ne comprend pas.
      entrees.push({ occurredAt: e.occurred_at, titre: e.summary || 'Événement sans résumé',
        detail: null, ton: 'inconnu', nonInterprete: true });
    }
    viderGardes();
    return { entrees, masques };
  }

  // ── LE FLUX VERS PRODUCTION (08/09/2026) ────────────────────────────
  //
  // Frédéric : « je voudrais voir Demande → Orchestrator → Claude → Guardians
  // → Test → Prêt Production → Frédéric → Production, avec l'étape courante
  // visuellement mise en évidence. C'est particulièrement important parce que
  // NEXUS Live est justement censé matérialiser cette chaîne que nous avons
  // construite. Aujourd'hui, la chaîne existe dans l'infrastructure, mais elle
  // n'est pas visible dans l'interface. »
  //
  // L'ÉTAPE COURANTE SE DÉDUIT DES FAITS, elle ne se déclare pas. Et quand les
  // faits ne permettent pas de la situer, on le DIT — une chaîne qui désigne
  // une étape au hasard vaut moins qu'une chaîne qui admet ne pas savoir.
  //
  // DEUX ÉTAPES NE SONT JAMAIS MARQUÉES « FAITE » AUTOMATIQUEMENT : celle de
  // Frédéric et celle de Production. Aucune décision de recette ne vaut
  // autorisation de production ; laisser l'écran cocher ces cases tout seul
  // serait fabriquer l'autorisation qu'il a mission de seulement transmettre.
  const ETAPES = [
    { cle: 'DEMANDE', libelle: 'Demande', qui: 'Un besoin est formulé' },
    { cle: 'ORCHESTRATOR', libelle: 'Arbitrage', qui: 'L’Orchestrator tranche la conception' },
    { cle: 'CLAUDE', libelle: 'Développement', qui: 'Claude écrit et prouve' },
    { cle: 'GUARDIANS', libelle: 'Contrôles', qui: 'Les Guardians relisent automatiquement' },
    { cle: 'TEST', libelle: 'Test', qui: 'La recette juge sur l’environnement réel' },
    { cle: 'PRET_PRODUCTION', libelle: 'Prêt pour Production', qui: 'Une proposition, jamais une autorisation' },
    { cle: 'FREDERIC', libelle: 'Ton autorisation', qui: 'Toi seul' },
    { cle: 'PRODUCTION', libelle: 'Production', qui: 'Mise en service' },
  ];

  // AUCUNE phase ne désigne « Ton autorisation » ni « Production », et c'est
  // l'invariant qui compte dans tout ce flux : ces deux étapes appartiennent à
  // un humain et à une mise en service réelle. Un événement d'exécution ne
  // peut donc jamais les rendre « courantes », ni marquer comme « faites »
  // celles qui les précèdent au-delà de ce que les faits permettent.
  //
  // Une première version portait un garde explicite (`if (FREDERIC ||
  // PRODUCTION) etat = 'a_venir'`). Une mutation l'a supprimé sans qu'aucune
  // épreuve ne bronche : il était INATTEIGNABLE, puisque aucune phase ne mène
  // à ces étapes. Une protection qu'aucun cas ne peut atteindre n'est pas une
  // protection, c'est un décor. L'invariant est donc porté par cette table —
  // vérifiable, et éprouvé par un contrat de source.
  const PHASE_VERS_ETAPE = {
    ANALYSE: 'CLAUDE', EXECUTION: 'CLAUDE', TEST: 'TEST',
    GUARDIAN_REVIEW: 'GUARDIANS', CI: 'TEST',
  };
  const ETAPES_JAMAIS_ATTEINTES_PAR_UN_EVENEMENT = ['FREDERIC', 'PRODUCTION'];

  function etapeCourante(events, projection) {
    const proj = projection || projectionVide();
    // Ce qui attend un humain situe la chaîne mieux que tout le reste.
    if (proj.human_gate) {
      const qui = String(proj.human_gate.who || '').toLowerCase();
      if (qui === 'frederic') return 'FREDERIC';
      return 'ORCHESTRATOR';
    }
    if (!Array.isArray(events) || !events.length) return null;
    let dernier = null, t0 = -Infinity;
    for (const e of events) {
      const t = Date.parse(e && e.occurred_at);
      if (!Number.isFinite(t) || t < t0) continue;
      dernier = e; t0 = t;
    }
    if (!dernier) return null;
    // Un GATE sans human_gate exploitable ne situe rien : on ne devine pas.
    return PHASE_VERS_ETAPE[dernier.phase] || null;
  }

  function fluxLive({ events, projection, deploiements }) {
    const courante = etapeCourante(events, projection);
    const iCourante = ETAPES.findIndex(e => e.cle === courante);
    const bloquees = new Set();
    // Une garde en échec bloque l'étape des contrôles, pas les autres.
    const gardes = Object.values((projection && projection.guardians) || {});
    if (gardes.includes('FAILED')) bloquees.add('GUARDIANS');
    // Un risque structurel de Production marque l'étape Production.
    if (risquesStructurels(events).length) bloquees.add('PRODUCTION');

    return {
      inconnue: iCourante < 0,
      etapes: ETAPES.map((e, i) => {
        let etat;
        if (bloquees.has(e.cle)) etat = 'bloquee';
        else if (iCourante < 0) etat = 'inconnue';
        else if (i < iCourante) etat = 'faite';
        else if (i === iCourante) etat = 'courante';
        else etat = 'a_venir';
        return { ...e, etat };
      }),
    };
  }

  const api = { STATUT_SYSTEME_LIVE: STATUT_SYSTEME, projectionVide, construireProjectionLive,
    fluxLive, etapeCourante, ETAPES_FLUX: ETAPES, PHASE_VERS_ETAPE,
    ETAPES_JAMAIS_ATTEINTES_PAR_UN_EVENEMENT,
    resumerTimeline,
    VERDICT, verdictLive, risquesStructurels, libelleStatutGarde,
    fraicheurJournal, extraireDeploiements, SEUIL_TIEDE_MIN, SEUIL_FROID_MIN };

  global.NexusLiveProjection = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
