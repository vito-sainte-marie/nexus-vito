// NEXUS — l'identité du commerce, jamais devinée (A3, 05/09/2026).
//
// POURQUOI CE FICHIER EXISTE. NEXUS a longtemps été une application
// « Sainte-Marie généralisée » : quand il ne savait pas de quel commerce il
// parlait, il prenait celui qu'il connaissait. `employee.site_id ||
// 'vito-sainte-marie'`, `fuseau || 'America/Martinique'` — le repli était
// silencieux, et un salarié d'un autre commerce pouvait lire les données ou
// vivre à l'heure d'une station qui n'est pas la sienne.
//
// LA RÈGLE (arbitrage du 05/09/2026) : une configuration multi-site absente
// doit être VISIBLE et BLOQUANTE si elle influence une décision métier. Elle
// n'est jamais remplacée en silence par les valeurs de Sainte-Marie.
//
// Ce module ne contient donc AUCUNE valeur de repli. C'est son intérêt : il
// n'y a pas d'endroit où en ajouter une sans que cela se voie.
(function (global) {
  'use strict';

  // Le site d'un employé, ou null. Jamais une chaîne vide : filtrer sur
  // `site = ''` renverrait 0 ligne, donc un écran vide indiscernable d'un
  // commerce sans données — un mauvais résultat déguisé en résultat normal.
  function siteDe(employee) {
    const brut = employee && employee.site_id;
    if (typeof brut !== 'string') return null;
    const site = brut.trim();
    return site || null;
  }

  // Écran d'arrêt. Même forme que celui posé en A11 pour le poste du jour :
  // dire ce qui manque, dire pourquoi NEXUS refuse de deviner, offrir une
  // sortie. Un calque plutôt qu'un remplacement de conteneur — tous les
  // écrans n'ont pas le même squelette, et A3 ne doit pas les réécrire.
  function bloquerSiteIndetermine(explication) {
    if (document.getElementById('nexusSiteIndetermine')) return;
    const calque = document.createElement('div');
    calque.id = 'nexusSiteIndetermine';
    calque.setAttribute('role', 'alertdialog');
    calque.style.cssText = 'position:fixed; inset:0; z-index:99999; background:#0b0f14; color:#e6edf3; ' +
      'display:flex; align-items:center; justify-content:center; padding:24px; ' +
      'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;';
    calque.innerHTML =
      '<div style="max-width:520px; line-height:1.55; font-size:14px;">' +
        '<strong style="font-size:16px;">Site indéterminé</strong><br><br>' +
        (explication || 'NEXUS ne peut pas savoir de quel commerce il s’agit.') + '<br><br>' +
        'Aucune donnée n’a été lue. NEXUS refuse de choisir un commerce à votre ' +
        'place : afficher les chiffres d’une autre station serait pire que de ne ' +
        'rien afficher.<br><br>' +
        '<button id="nexusSiteReessayer" style="padding:9px 16px; border-radius:8px; border:1px solid #2f81f7; background:#2f81f7; color:#fff; font-size:14px; cursor:pointer;">Réessayer</button>' +
        '<a href="index.html" style="margin-left:10px; color:#2f81f7; text-decoration:none; font-size:14px;">Se déconnecter</a>' +
      '</div>';
    document.body.appendChild(calque);
    const bouton = document.getElementById('nexusSiteReessayer');
    if (bouton) bouton.addEventListener('click', () => window.location.reload());
  }

  // Le point d'entrée des écrans. Renvoie le site, ou null APRÈS avoir
  // bloqué : l'appelant n'a qu'à sortir. Un employé authentifié sans site est
  // un état impossible, pas une absence normale — d'où console.error, au sens
  // de la règle A4-bis.
  function exigerSite(employee, explication) {
    const site = siteDe(employee);
    if (site) return site;
    console.error('Site indéterminé : l’employé authentifié ne porte aucun site_id exploitable. Aucune requête n’est émise.');
    bloquerSiteIndetermine(explication);
    return null;
  }

  // Le fuseau de la station — source unique `sites.timezone` (A3-3).
  //
  // CONTRAT (arbitré le 05/09/2026) :
  //     await NexusStation.fuseauDeLaStation(siteId)
  //       -> { timezone: 'America/Martinique' }
  //       -> { indetermine: 'configuration' }
  //       -> { indetermine: 'reseau' }
  //
  // Pas de paramètre `client` : le client Supabase est un global posé par
  // nexus-auth.js, et le passer en argument inviterait à en passer un autre.
  // Le mot `timezone` est celui de la colonne : un synonyme serait une
  // invitation à diverger.
  //
  // Un `siteId` absent LÈVE au lieu de renvoyer un état : ce n'est pas une
  // situation du commerce, c'est une erreur de contrat entre deux morceaux
  // de code. La confondre avec « pas de configuration » ferait passer un
  // bogue pour une donnée manquante.
  //
  // Il n'y a aucun repli, et c'est le cœur du correctif : un fuseau ne
  // s'affiche pas, il DÉCOUPE LES JOURNÉES. Calculer un quart, un retard ou
  // une date de clôture dans l'heure d'une autre station produit un résultat
  // faux sans le moindre message d'erreur. Mieux vaut refuser de calculer.
  //
  // `sites` a toujours une ligne par site — contrairement à station_config,
  // qui peut ne pas en avoir. C'est la raison du choix de table : le cas
  // « pas de configuration » ne peut plus se confondre avec « pas de fuseau ».
  async function fuseauDeLaStation(siteId) {
    if (typeof siteId !== 'string' || !siteId.trim()) {
      throw new TypeError('NexusStation.fuseauDeLaStation : siteId manquant ou invalide. Résolvez le site avant d’appeler (NexusStation.exigerSite).');
    }
    const { data, error } = await nexusClient
      .from('sites').select('timezone').eq('site_id', siteId.trim()).maybeSingle();
    if (error) {
      console.error('Fuseau de la station : lecture impossible —', error);
      return { indetermine: 'reseau' };
    }
    // La requête a RÉUSSI et ne rapporte aucun fuseau exploitable : ce n'est
    // pas une panne technique, c'est une configuration incomplète. Règle
    // A4-bis — `error` est réservé à l'échec de la requête, traité au-dessus.
    // Règle A3 — l'absence est visible (ce journal) et bloquante (l'appelant
    // reçoit `indetermine` et ne calculera rien).
    if (!data || !data.timezone) {
      console.warn('Fuseau de la station : aucun fuseau exploitable pour « ' + siteId + ' » — configuration incomplète. Aucun découpage de journée ne sera calculé ; NEXUS ne substitue pas le fuseau d’une autre station.');
      return { indetermine: 'configuration' };
    }
    return { timezone: data.timezone };
  }

  // ────────────────────────────────────────────────────────────────
  // Le quart du moment (A3 / C2, 05/09/2026)
  //
  // NEXUS déterminait le quart avec `new Date().getHours()` — l'heure de
  // l'APPAREIL — comparée à un seuil écrit en dur : '12:40' dans Inventaire
  // et FDJ, 13 dans Prise de poste, 12 dans l'horizon opérationnel. Quatre
  // valeurs, aucune venant de la configuration du site, et une heure qui
  // dépend du téléphone de celui qui regarde.
  //
  // La règle est désormais : un quart ne peut être déterminé que par
  // l'heure locale de la STATION et le seuil CONFIGURÉ du site.
  //
  // Ces trois fonctions sont PURES — aucune n'accède au réseau, à
  // localStorage ni à `nexusClient`. Elles rendent la détermination du quart
  // testable, y compris le cas « appareil dans un fuseau différent de la
  // station », qui était jusqu'ici impossible à éprouver.
  // ────────────────────────────────────────────────────────────────

  // "12:40" -> 760. Null si l'entrée n'est pas une heure exploitable : on ne
  // devine pas, et surtout on ne renvoie pas 0 — minuit est une heure valide,
  // la confondre avec « absent » ferait basculer toute la journée.
  function minutesDepuisMinuit(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm == null ? '' : hhmm).trim());
    if (!m) return null;
    const h = Number(m[1]), min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }

  // L'heure locale de la station, en minutes depuis minuit. `instant` permet
  // de tester un moment précis sans dépendre de l'horloge de la machine.
  function minutesLocalesStation(timezone, instant) {
    if (typeof timezone !== 'string' || !timezone.trim()) {
      throw new TypeError('minutesLocalesStation : timezone obligatoire. L’heure de l’appareil ne détermine jamais un quart.');
    }
    const d = instant instanceof Date ? instant : new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
    return Number(parts.hour) * 60 + Number(parts.minute);
  }

  // Le quart, ou null si l'un des deux ingrédients manque. Null n'est pas un
  // repli : c'est un refus, et l'appelant doit le traiter.
  function quartDepuisMinutes(minutesMaintenant, minutesBascule) {
    if (!Number.isFinite(minutesMaintenant) || !Number.isFinite(minutesBascule)) return null;
    return minutesMaintenant < minutesBascule ? '1' : '2';
  }

  // ────────────────────────────────────────────────────────────────
  // LE RENFORT NE SE DÉDUIT PAS DE L'HORLOGE (09/09/2026)
  //
  // Arbitrage de Frédéric Bragance : le renfort est un quart de plein droit.
  // Le planning le sait depuis toujours — `planning_shifts.quart` et
  // `planning_regles_effectif.quart` acceptent `quart1`, `quart2` ET
  // `renfort`, et l'écran Planning lui donne son libellé. L'exécution, elle,
  // ne rendait que « 1 » ou « 2 » : un renfort était enregistré « matin » ou
  // « soir », jamais « renfort ».
  //
  // ET IL EST IMPOSSIBLE DE LE DEVINER. À 10 h, un pompiste du quart 1 et un
  // renfort travaillent tous les deux ; aucune heure ne les distingue. Le
  // renfort est une décision de PLANIFICATION, pas un moment de la journée.
  // C'est pourquoi le planning décide et l'horloge n'est que le repli.
  //
  // Ce n'est pas un détail de vocabulaire : sur les deux seuls quarts engagés
  // de la station depuis le 04/09/2026, celui qui a validé 64 missions est un
  // renfort. L'employé le plus engagé de la mesure travaillait dans le régime
  // que l'exécution ne savait pas nommer.
  const QUARTS_PLANIFIABLES = ['quart1', 'quart2', 'renfort'];

  // Les statuts de planning qui décrivent quelqu'un AU TRAVAIL. Un repos ou un
  // congé ne porte pas de quart exploitable : si la personne prend son poste
  // malgré tout, on ne lui oppose pas son planning, on retombe sur l'horloge.
  const STATUTS_AU_TRAVAIL = ['travail_normal', 'manager', 'renfort', 'transfert_site'];

  // PURE. `planifie` vient du planning (ou null), les deux minutes de
  // l'horloge de la station. Rend le quart ET sa source — sans la source, on ne
  // saurait pas si « quart2 » est une décision ou une déduction, et l'on ne
  // pourrait ni l'expliquer à l'employé ni la corriger.
  function quartDuJour({ planifie, minutesMaintenant, minutesBascule }) {
    if (typeof planifie === 'string' && QUARTS_PLANIFIABLES.includes(planifie)) {
      return { quart: planifie, source: 'planning' };
    }
    const q = quartDepuisMinutes(minutesMaintenant, minutesBascule);
    if (q === null) return null;
    return { quart: q === '1' ? 'quart1' : 'quart2', source: 'horloge' };
  }

  // Le quart PLANIFIÉ d'un employé pour une date. Rend null quand rien n'est
  // publié, quand le statut n'est pas un statut de travail, ou quand la lecture
  // échoue : dans les trois cas l'appelant retombera sur l'horloge, ce qui est
  // le comportement d'avant. Une panne de planning ne doit jamais empêcher
  // quelqu'un de prendre son poste.
  async function quartPlanifie(employeeId, dateLocaleISO, client) {
    if (typeof employeeId !== 'string' || !employeeId.trim()) return null;
    if (typeof dateLocaleISO !== 'string' || !dateLocaleISO.trim()) return null;
    try {
      const { data, error } = await (client || nexusClient)
        .from('planning_shifts')
        .select('quart, statut, publie')
        .eq('employee_id', employeeId).eq('date', dateLocaleISO)
        .eq('publie', true)
        .maybeSingle();
      if (error || !data) return null;
      if (!STATUTS_AU_TRAVAIL.includes(data.statut)) return null;
      return QUARTS_PLANIFIABLES.includes(data.quart) ? data.quart : null;
    } catch (e) {
      return null;
    }
  }

  // La date locale de la station, au format ISO. Même raison que
  // `minutesLocalesStation` : la date de l'appareil ne dit pas quel jour il est
  // à la station, et un employé qui prend son poste à 23 h en métropole n'est
  // pas le lendemain en Martinique.
  function dateLocaleStation(timezone, instant) {
    if (typeof timezone !== 'string' || !timezone.trim()) {
      throw new TypeError('dateLocaleStation : timezone obligatoire. La date de l’appareil ne détermine jamais un jour de planning.');
    }
    const d = instant instanceof Date ? instant : new Date();
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
    return `${p.year}-${p.month}-${p.day}`;
  }

  // ────────────────────────────────────────────────────────────────
  // LA règle complète du quart (Verify, 05/09/2026)
  //
  // Les trois primitives ci-dessus sont pures ; il restait à chaque écran de
  // les assembler avec la lecture du seuil. Quatre écrans le faisaient, en
  // quatre copies quasi identiques — Inventaire, Inventaire Manager, FDJ, et
  // les données du manager. Verify, lui, ne le faisait NULLE PART : son
  // sélecteur proposait le premier `<option>` de son DOM.
  //
  // Corriger Verify par une cinquième copie aurait ajouté un endroit de plus
  // où la règle peut diverger le jour où le seuil change. L'assemblage vit
  // donc ici, une seule fois.
  //
  // Le vocabulaire reste NEUTRE — « 1 » / « 2 ». Inventaire nomme ses quarts
  // « matin » / « soir » parce que sa contrainte de base l'exige ; il
  // traduit. Imposer un vocabulaire ici obligerait tous les autres à
  // détraduire.
  //
  // Contrat de retour identique à fuseauDeLaStation : un objet qui dit
  // pourquoi il ne sait pas, jamais un repli silencieux.
  //
  // `client` est optionnel : la couche de données du manager reçoit le sien
  // par injection, ce qui la rend testable sans réseau. Lui imposer le client
  // global aurait cassé cette injection — ou laissé une quatrième copie de la
  // règle vivre à côté de celle-ci.
  async function quartConfigureDuMoment(siteId, timezone, instant, client) {
    if (typeof siteId !== 'string' || !siteId.trim()) {
      throw new TypeError('NexusStation.quartConfigureDuMoment : siteId manquant ou invalide.');
    }
    if (!timezone) {
      console.warn('Quart du moment : fuseau du commerce non résolu — aucun quart n’est déterminé.');
      return { indetermine: 'fuseau' };
    }
    const r = await seuilDeBascule(siteId, client, timezone, instant);
    if (r.indetermine) return r;
    return { quart: quartDepuisMinutes(minutesLocalesStation(timezone, instant), r.minutes) };
  }

  // LE JOUR DÉCIDE DE L'HORAIRE — corrigé le 09/09/2026.
  //
  // Vito Sainte-Marie a deux régimes, et `station_config.horaires` les porte
  // depuis toujours sous les noms `normal` et `etendu` — l'écran Paramètres
  // Station les étiquette d'ailleurs « Dimanche à Mercredi » et « Jeudi à
  // Samedi » en toutes lettres. Ce n'est donc pas une convention inventée ici :
  // elle était déjà déclarée à l'écran, et seul le code l'ignorait.
  //
  // CE QUE ÇA CASSAIT. Le seuil lisait `quart2.normal` — 12:40 — tous les
  // jours. Or du jeudi au samedi le quart 2 commence à 13:40 et le quart 1
  // court jusqu'à 14:15. Un employé prenant son poste un jeudi à 13 h était
  // enregistré sur le QUART 2 alors qu'il faisait le quart 1. Une heure, trois
  // jours par semaine. Arbitrage de Frédéric Bragance, 09/09/2026 : « le jeudi
  // à 13 h, nous sommes toujours sur le quart 1 ».
  const JOURS_ETENDUS = ['Thu', 'Fri', 'Sat'];

  // PURE. Rendue séparément pour être éprouvable sans réseau ni horloge.
  function cleHoraireDuJour(timezone, instant) {
    if (typeof timezone !== 'string' || !timezone.trim()) {
      throw new TypeError('cleHoraireDuJour : timezone obligatoire. Le jour de l’appareil ne détermine jamais un quart.');
    }
    const d = instant instanceof Date ? instant : new Date();
    const jour = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'short' }).format(d);
    return JOURS_ETENDUS.includes(jour) ? 'etendu' : 'normal';
  }

  // PURE. `horaires` = station_config.horaires ; `cle` = 'etendu' | 'normal'.
  // Le repli sur `normal` quand `etendu` est absent sert les commerces à
  // horaire uniforme — il ne masque pas une configuration incomplète, puisque
  // l'absence des DEUX rend le seuil indéterminé.
  function seuilDepuisHoraires(horaires, cle) {
    const q2 = horaires && horaires.quart2;
    if (!q2) return null;
    const brut = (cle === 'etendu' ? q2.etendu : q2.normal) || q2.normal;
    return minutesDepuisMinuit(brut);
  }

  // Le seuil configuré du site, en minutes depuis minuit, POUR LE JOUR DONNÉ.
  // Extrait pour les écrans qui résolvent le contexte UNE fois puis décident
  // plusieurs fois sans réseau — Prise de poste tranche à trois endroits, la
  // rendre asynchrone partout aurait été un recul. Ils ne réassemblent donc
  // pas la règle : ils lisent le même seuil, par le même chemin.
  //
  // `timezone` est OBLIGATOIRE depuis le 09/09/2026 : sans lui, on ne sait pas
  // quel jour il est CHEZ LA STATION, et prendre le jour de l'appareil
  // reproduirait à l'échelle du jour l'erreur que `minutesLocalesStation`
  // interdit déjà à l'échelle de l'heure. Son absence est un refus, pas un
  // repli.
  async function seuilDeBascule(siteId, client, timezone, instant) {
    if (typeof siteId !== 'string' || !siteId.trim()) {
      throw new TypeError('NexusStation.seuilDeBascule : siteId manquant ou invalide.');
    }
    if (typeof timezone !== 'string' || !timezone.trim()) {
      console.warn('Seuil de bascule : fuseau du commerce non fourni. Le jour local est indéterminable, aucun seuil rendu.');
      return { indetermine: 'fuseau' };
    }
    const { data, error } = await (client || nexusClient)
      .from('station_config').select('horaires').eq('site', siteId.trim()).maybeSingle();
    if (error) {
      console.error('Seuil de bascule : lecture des horaires impossible —', error);
      return { indetermine: 'reseau' };
    }
    // Règle A4-bis : la requête a réussi, c'est la configuration qui manque.
    const cle = cleHoraireDuJour(timezone, instant);
    const minutes = seuilDepuisHoraires(data && data.horaires, cle);
    if (minutes === null) {
      console.warn('Seuil de bascule : aucun horaire configuré pour « ' + siteId + ' » — NEXUS ne devine pas à quel quart appartient ce moment.');
      return { indetermine: 'configuration' };
    }
    return { minutes, regime: cle };
  }

  global.NexusStation = {
    siteDe, exigerSite, bloquerSiteIndetermine, fuseauDeLaStation,
    minutesDepuisMinuit, minutesLocalesStation, quartDepuisMinutes,
    cleHoraireDuJour, seuilDepuisHoraires, JOURS_ETENDUS,
    quartDuJour, quartPlanifie, dateLocaleStation,
    QUARTS_PLANIFIABLES, STATUTS_AU_TRAVAIL,
    quartConfigureDuMoment, seuilDeBascule,
  };
})(window);
