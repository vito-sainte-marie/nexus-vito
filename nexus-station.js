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

  global.NexusStation = {
    siteDe, exigerSite, bloquerSiteIndetermine, fuseauDeLaStation,
    minutesDepuisMinuit, minutesLocalesStation, quartDepuisMinutes,
  };
})(window);
