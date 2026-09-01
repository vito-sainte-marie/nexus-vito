// NEXUS Carburants — correctifs P0 Performance (31/08/2026)
// Branche audit-carburants-p0-20260831 uniquement.
//
// Principe : données -> qualification -> comparabilité -> calcul.
// Ce fichier ne change aucune formule commerciale. Il qualifie seulement
// les litrages Verify avant de laisser les moteurs existants les comparer.
(function (global) {
  'use strict';

  var INSTALLE = false;
  var TIMER = null;
  var REFERENCES = new Set();

  function clePeriode(debut, fin) { return String(debut || '') + '|' + String(fin || ''); }

  function dateLocaleISO(fuseau) {
    try {
      var parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: fuseau || 'America/Martinique', year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(new Date()).reduce(function (a, p) { a[p.type] = p.value; return a; }, {});
      return parts.year + '-' + parts.month + '-' + parts.day;
    } catch (e) {
      var d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
  }

  function joursISO(debut, fin) {
    var out = [];
    if (!debut || !fin || debut > fin) return out;
    var d = new Date(debut + 'T12:00:00');
    var z = new Date(fin + 'T12:00:00');
    while (d <= z) {
      out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  function quartsDepuisHoraires(horaires) {
    var q = Object.keys(horaires || {}).map(function (k) {
      var m = /^quart(\d+)$/i.exec(k);
      return m ? m[1] : null;
    }).filter(Boolean).sort(function (a, b) { return Number(a) - Number(b); });
    return q.length ? q : ['1', '2'];
  }

  function aUnLitrage(l) {
    return !!l && (l.litrage_gazole != null || l.litrage_sp95 != null || l.litrage_gnr != null);
  }

  function lignesIdentiques(a, b) {
    if (!a || !b) return false;
    return ['litrage_gazole', 'litrage_sp95', 'litrage_gnr'].every(function (champ) {
      return (a[champ] == null && b[champ] == null) || Number(a[champ]) === Number(b[champ]);
    });
  }

  function sommerLignes(lignes, moteur) {
    return moteur.sommerVentesPeriode(lignes || []);
  }

  function installer() {
    if (INSTALLE) return true;
    var NP = global.NexusPeriodes;
    var ND = global.NexusCarburantDonnees;
    var M = global.NexusCarburantMoteur;
    if (!NP || !ND || !M) return false;

    var originalReferences = NP.resoudrePeriodesReference;
    var originalMessages = M.construireMessagesPilotage;

    // Enregistre les fenêtres utilisées comme REFERENCES par l'écran.
    // Cela permet au chargeur de leur appliquer le même cutoff opérationnel
    // que le jour courant sans changer l'API publique existante.
    NP.resoudrePeriodesReference = function (periode, dateDuJourISO) {
      var refs = originalReferences(periode, dateDuJourISO);
      (refs || []).forEach(function (r) { REFERENCES.add(clePeriode(r.debut, r.fin)); });
      return refs;
    };

    ND.chargerVentesPeriode = async function (client, siteId, debut, fin) {
      var requetes = await Promise.all([
        client.from('station_config').select('horaires,fuseau_horaire').eq('site', siteId).maybeSingle(),
        client.from('audits_caisse')
          .select('date,quart,litrage_gazole,litrage_sp95,litrage_gnr')
          .eq('site', siteId).gte('date', debut).lte('date', fin),
      ]);
      var qCfg = requetes[0], qData = requetes[1];
      if (qData.error) {
        console.error('P0 Performance — chargement ventes période:', qData.error);
        return {
          ventes: { go: null, sp95: null, gnr: null }, nbQuartsTotal: 0, nbQuartsAvecLitrage: 0,
          nbQuartsAttendus: 0, couvertureComplete: false, comparable: false,
        };
      }

      var cfg = qCfg && !qCfg.error && qCfg.data ? qCfg.data : {};
      var fuseau = cfg.fuseau_horaire || 'America/Martinique';
      var today = dateLocaleISO(fuseau);
      var quartsAttendus = quartsDepuisHoraires(cfg.horaires || {});
      var lignes = qData.data || [];
      var estReference = REFERENCES.has(clePeriode(debut, fin));

      // Cutoff opérationnel du jour courant : seuls les quarts déjà présents
      // avec un litrage peuvent être comparés au dernier jour d'une référence.
      var lignesAujourdhui;
      if (debut <= today && today <= fin) {
        lignesAujourdhui = lignes.filter(function (l) { return l.date === today; });
      } else {
        var qToday = await client.from('audits_caisse')
          .select('date,quart,litrage_gazole,litrage_sp95,litrage_gnr')
          .eq('site', siteId).eq('date', today);
        lignesAujourdhui = qToday.error ? [] : (qToday.data || []);
      }
      var cutoffQuarts = quartsAttendus.filter(function (q) {
        return lignesAujourdhui.some(function (l) { return String(l.quart) === q && aUnLitrage(l); });
      });

      var finEffective = fin < today ? fin : today;
      var jours = joursISO(debut, finEffective);
      var parCle = {};
      lignes.forEach(function (l) {
        var k = l.date + '|' + String(l.quart);
        if (!parCle[k]) parCle[k] = [];
        parCle[k].push(l);
      });

      var nbAttendus = 0;
      var nbAvecLitrage = 0;
      var lignesRetenues = [];
      var anomalies = [];

      jours.forEach(function (date) {
        var autorises = quartsAttendus.slice();
        // Pour une référence, le DERNIER jour reprend exactement l'avancement
        // opérationnel observé aujourd'hui. Ex.: aujourd'hui Q1 seulement ->
        // la référence finit elle aussi après Q1, jamais après Q2.
        if (estReference && date === fin && cutoffQuarts.length < quartsAttendus.length) {
          autorises = cutoffQuarts.slice();
        }

        // Détection informative de deux quarts strictement identiques.
        if (quartsAttendus.length === 2) {
          var qa = parCle[date + '|' + quartsAttendus[0]] || [];
          var qb = parCle[date + '|' + quartsAttendus[1]] || [];
          if (qa.length === 1 && qb.length === 1 && lignesIdentiques(qa[0], qb[0])) {
            anomalies.push({ type: 'suspicion_duplication_quarts', date: date, quarts: quartsAttendus.slice() });
          }
        }

        autorises.forEach(function (quart) {
          nbAttendus++;
          var trouvees = parCle[date + '|' + quart] || [];
          if (trouvees.length === 1 && aUnLitrage(trouvees[0])) nbAvecLitrage++;
          trouvees.forEach(function (l) { lignesRetenues.push(l); });
        });
      });

      var couvertureComplete = nbAttendus > 0 && nbAvecLitrage === nbAttendus;
      var duplicationSuspecte = anomalies.length > 0;
      var comparable = couvertureComplete && !duplicationSuspecte;
      var ventes = sommerLignes(lignesRetenues, M);

      // Une fenêtre de référence doit être démontrée comparable AVANT usage.
      // Si elle ne l'est pas, l'appelant existant passe au repli suivant grâce
      // à nbQuartsAvecLitrage=0, sans aucune modification de son code.
      if (estReference && !comparable) {
        return {
          ventes: { go: null, sp95: null, gnr: null },
          nbQuartsTotal: nbAttendus,
          nbQuartsAvecLitrage: 0,
          nbQuartsAttendus: nbAttendus,
          nbQuartsRenseignesBrut: nbAvecLitrage,
          couvertureComplete: couvertureComplete,
          comparable: false,
          anomalies: anomalies,
          referenceRefusee: true,
        };
      }

      return {
        ventes: ventes,
        nbQuartsTotal: nbAttendus,
        nbQuartsAvecLitrage: nbAvecLitrage,
        nbQuartsAttendus: nbAttendus,
        couvertureComplete: couvertureComplete,
        comparable: estReference ? comparable : null,
        anomalies: anomalies,
      };
    };

    // Une période explicitement provisoire ne peut pas déclencher en parallèle
    // le message commercial ferme >=15 %. On conserve tous les messages de
    // stock/réception/qualité et on neutralise uniquement les signaux de vente.
    M.construireMessagesPilotage = function (ctx) {
      if (!ctx || !ctx.provisoire) return originalMessages(ctx);
      var prudent = Object.assign({}, ctx, {
        deltaTotal: null,
        evolutionTotale: null,
        moteurEvolution: null,
      });
      return originalMessages(prudent);
    };

    global.NexusCarburantsP0Performance = {
      actif: true,
      references: REFERENCES,
      doctrine: 'comparabilite_operationnelle_avant_evolution',
    };
    INSTALLE = true;
    console.info('NEXUS Carburants P0 Performance installé — couverture et références qualifiées.');
    return true;
  }

  if (!installer()) {
    TIMER = setInterval(function () {
      if (installer() && TIMER) {
        clearInterval(TIMER);
        TIMER = null;
      }
    }, 20);
    setTimeout(function () {
      if (TIMER) {
        clearInterval(TIMER);
        TIMER = null;
        console.error('NEXUS Carburants P0 Performance non installé : moteurs indisponibles après 15 s.');
      }
    }, 15000);
  }
})(typeof window !== 'undefined' ? window : globalThis);
