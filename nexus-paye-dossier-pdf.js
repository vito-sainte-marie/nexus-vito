/* ------------------------------------------------------------
 * NEXUS PAYE — Dossier comptable PDF (03/09/2026).
 *
 * Demande de Frédéric : « la sortie principale du module ne peut pas
 * rester un CSV ». Un CSV est un format d'échange technique ; ce que la
 * comptable attend, c'est un document lisible — une synthèse du mois et
 * une fiche par salarié — qu'elle peut lire, classer et archiver telle
 * quelle. Le CSV reste disponible, mais en second, comme export
 * technique.
 *
 * Ce fichier ne calcule RIEN (Article 11) : il reçoit le dossier déjà
 * agrégé par `NexusPayeMoteur.dossierComptable()` — la même agrégation
 * que celle affichée sur la carte salarié — et se contente de le mettre
 * en page avec les primitives génériques de `nexus-pdf-moteur.js`.
 * Aucune règle de paie ici, aucun seuil, aucune requête : si un chiffre
 * du PDF diffère de l'écran, c'est un bug de mise en page, jamais une
 * divergence de calcul.
 *
 * Charger APRÈS pdf-lib, nexus-pdf-moteur.js et nexus-paye-moteur.js.
 * ------------------------------------------------------------ */
(function (global) {
  'use strict';

  const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
    'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function moisLabel(periodeISO) {
    const p = String(periodeISO || '').slice(0, 10).split('-');
    if (p.length !== 3) return String(periodeISO || '');
    return `${MOIS_FR[Number(p[1]) - 1] || p[1]} ${p[0]}`;
  }

  function jjmmaaaa(iso) {
    const p = String(iso || '').slice(0, 10).split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(iso || '');
  }

  function euros(centimes) {
    if (centimes == null) return '—';
    const v = Number(centimes) / 100;
    return `${v > 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')} €`;
  }

  function heures(valeur) {
    const v = Number(valeur || 0);
    return `${(Math.round(v * 100) / 100).toString().replace('.', ',')} h`;
  }

  function minutes(valeur) {
    const v = Number(valeur || 0);
    return v ? `${v} min` : '—';
  }

  function nombre(valeur, unite) {
    const v = Number(valeur || 0);
    return v ? `${v} ${unite}${v > 1 && unite !== 'h' ? 's' : ''}` : '—';
  }

  // Période couverte par un événement RH, exprimée telle que la comptable
  // en a besoin : ce qui tombe DANS le mois, plus le rappel de la période
  // réelle quand l'événement déborde (une maternité de juillet à janvier
  // ne doit pas ressembler à une absence d'un mois).
  function periodeEvenement(ev) {
    const dansLeMois = `du ${jjmmaaaa(ev.debut)} au ${jjmmaaaa(ev.fin)}`;
    const deborde = (ev.evenementDebut && ev.evenementDebut < ev.debut)
      || (ev.evenementFin && ev.evenementFin > ev.fin) || ev.finIndeterminee;
    if (!deborde) return dansLeMois;
    const fin = ev.dateReprise ? `reprise le ${jjmmaaaa(ev.dateReprise)}`
      : (ev.finIndeterminee ? 'retour non daté' : jjmmaaaa(ev.evenementFin));
    return `${dansLeMois} (événement : du ${jjmmaaaa(ev.evenementDebut)} au ${fin})`;
  }

  // Les variables d'un salarié, sous la forme d'un tableau clé/valeur —
  // exactement l'ordre de lecture demandé : présence, absence, CP,
  // maladie/maternité, retards, heures supplémentaires, jours fériés,
  // éléments financiers.
  function lignesVariables(v) {
    const lignes = [
      { variable: 'Présence confirmée', valeur: v.presence.jours ? `${nombre(v.presence.jours, 'jour')} · ${heures(v.presence.heures)}` : '0' },
      { variable: 'Absence non déclarée', valeur: nombre(v.absence.jours, 'jour') },
      { variable: 'Congés payés', valeur: nombre(v.congesPayes.jours, 'jour') },
      { variable: 'Maladie / maternité / paternité', valeur: nombre(v.maladieMaternite.jours, 'jour') },
      { variable: 'Autres absences qualifiées', valeur: nombre(v.autresAbsences.jours, 'jour') },
      { variable: 'Retards', valeur: v.retards.occurrences ? `${minutes(v.retards.minutes)} sur ${nombre(v.retards.occurrences, 'jour')}` : '—' },
      { variable: 'Heures supplémentaires', valeur: v.heuresSupplementaires.heures ? heures(v.heuresSupplementaires.heures) : '—' },
      { variable: 'Jours fériés travaillés', valeur: nombre(v.joursFeries.jours, 'jour') },
      { variable: 'Acomptes', valeur: v.financier.acompteCentimes ? euros(v.financier.acompteCentimes) : '—' },
      { variable: 'Dettes / avances', valeur: v.financier.detteCentimes ? euros(v.financier.detteCentimes) : '—' },
      { variable: 'Retenues sur écart de caisse', valeur: v.financier.retenueEcartCentimes ? euros(v.financier.retenueEcartCentimes) : '—' },
    ];
    return lignes;
  }

  function ficheSalarie(rapport, salarie, periodeISO) {
    const v = salarie.variables;
    rapport._nouvellePage();
    rapport.titre(salarie.nom || '—', { taille: 16 });
    rapport.sousTitre(`${salarie.role || 'poste non précisé'} · ${moisLabel(periodeISO)} · ${salarie.statutLibelle}`);

    if (salarie.statut !== 'pret') {
      rapport.bandeau(salarie.statut === 'donnee_manquante'
        ? 'Donnée manquante : cette fiche est incomplète, elle ne doit pas être traitée en l’état.'
        : `${v.elementsEnAttente} élément(s) restent à vérifier — ils ne sont PAS comptés dans les variables ci-dessous.`);
    }

    rapport.sectionTitre('Variables du mois');
    rapport.tableau(
      [{ label: 'Variable', cle: 'variable', largeur: 0.62 }, { label: 'Valeur', cle: 'valeur', largeur: 0.38, align: 'droite' }],
      lignesVariables(v),
    );

    const evenements = [...v.congesPayes.detail, ...v.maladieMaternite.detail, ...v.autresAbsences.detail];
    if (evenements.length) {
      rapport.sectionTitre('Événements RH couvrant le mois');
      rapport.tableau(
        [{ label: 'Motif', cle: 'motif', largeur: 0.3 }, { label: 'Période', cle: 'periode', largeur: 0.52 }, { label: 'Jours', cle: 'jours', largeur: 0.18, align: 'droite' }],
        evenements.map(ev => ({ motif: ev.libelle, periode: periodeEvenement(ev), jours: String(ev.jours) })),
      );
    }

    if (v.financier.lignes.length) {
      rapport.sectionTitre('Éléments financiers');
      rapport.tableau(
        [{ label: 'Date', cle: 'date', largeur: 0.16 }, { label: 'Libellé', cle: 'libelle', largeur: 0.64 }, { label: 'Montant', cle: 'montant', largeur: 0.2, align: 'droite' }],
        v.financier.lignes.map(l => ({ date: l.date ? jjmmaaaa(l.date) : '—', libelle: l.libelle, montant: euros(l.montantCentimes) })),
      );
    }

    const notes = [];
    if (v.presence.joursReconstitues) notes.push(`${v.presence.joursReconstitues} journée(s) confirmée(s) par une seule source — Verify ou pointage, pas les deux.`);
    if (v.presence.heuresParDefaut) notes.push(`${heures(v.presence.heuresParDefaut)} attribuées au barème par poste, faute de durée au planning.`);
    if (v.heuresSupplementaires.heuresDejaIncluses) notes.push(`${heures(v.heuresSupplementaires.heuresDejaIncluses)} supplémentaires sont déjà comprises dans les heures de présence (barème jeudi/vendredi/samedi).`);
    if (v.financier.ecartsInformatifs) notes.push(`${v.financier.ecartsInformatifs} écart(s) de caisse restent informatifs : aucune retenue.`);
    if (notes.length) rapport.encadre(notes.map(n => ({ texte: `- ${n}` })));
  }

  /**
   * Construit le dossier comptable PDF et renvoie
   * `{ bytes, nomFichier, titre }`. `dossier` vient de
   * `NexusPayeMoteur.dossierComptable(rapport)`.
   */
  async function construireDossierPdf(dossier, options) {
    const opts = options || {};
    const label = moisLabel(dossier.periode);
    const rapport = await global.NexusPdfMoteur.creerRapport({
      titre: `NEXUS PAYE — Dossier comptable ${label}`,
      sujet: 'Variables de paie préparées par NEXUS — la comptable établit le bulletin.',
      entete: { app: 'NEXUS PAYE', sousTitre: `Dossier comptable · ${label}` },
    });

    rapport.pageDeGarde({
      titre: 'DOSSIER COMPTABLE',
      // A3 / B1-c (05/09/2026) — le repli était 'ViTO Sainte-Marie'. Un
      // dossier comptable ne reste pas dans l'application : il part chez une
      // comptable. Un PDF portant le nom d'un autre commerce n'est pas une
      // approximation d'affichage, c'est une contamination d'identité client.
      // Repli sur l'identifiant du site courant, jamais sur un nom propre.
      nomEntreprise: opts.nomEntreprise || opts.site || 'Commerce non identifié',
      periodeBornes: label.charAt(0).toUpperCase() + label.slice(1),
      accroche: 'Variables de paie préparées par NEXUS',
      sousAccroche: 'La comptable reste responsable du bulletin.',
      mentionBas: `Généré le ${jjmmaaaa(String(dossier.genereLe).slice(0, 10))}`,
    });

    rapport._nouvellePage();
    rapport.titre('Synthèse mensuelle');
    rapport.sousTitre(`${label.charAt(0).toUpperCase() + label.slice(1)} · ${dossier.synthese.salaries} salarié(s) suivis`);

    if (dossier.statutGlobal !== 'pret') {
      rapport.bandeau(dossier.statutGlobal === 'donnee_manquante'
        ? 'Dossier incomplet : au moins un salarié a une donnée manquante. Ne pas traiter en l’état.'
        : 'Dossier provisoire : des éléments restent à vérifier. Ils ne sont pas comptés dans les variables.');
    }

    rapport.sectionTitre('État du dossier');
    rapport.ligneCle('Salariés prêts', String(dossier.synthese.prets));
    rapport.ligneCle('Salariés avec un arbitrage en attente', String(dossier.synthese.aVerifier));
    rapport.ligneCle('Salariés avec une donnée manquante', String(dossier.synthese.donneeManquante));
    if (dossier.ecartsNonAttribues) rapport.ligneCle('Écarts de caisse non attribués', String(dossier.ecartsNonAttribues));

    rapport.sectionTitre('Totaux du mois');
    rapport.ligneCle('Jours travaillés', String(dossier.synthese.joursTravailles));
    rapport.ligneCle('Heures confirmées', heures(dossier.synthese.heuresConfirmees));
    rapport.ligneCle('Jours de congés payés', String(dossier.synthese.joursCongesPayes));
    rapport.ligneCle('Jours maladie / maternité / paternité', String(dossier.synthese.joursMaladieMaternite));
    rapport.ligneCle('Jours d’absence non déclarée', String(dossier.synthese.joursAbsenceNonDeclaree));
    rapport.ligneCle('Retards cumulés', minutes(dossier.synthese.retardsMinutes));
    rapport.ligneCle('Heures supplémentaires', heures(dossier.synthese.heuresSupplementaires));
    rapport.ligneCle('Jours fériés travaillés', String(dossier.synthese.joursFeries));
    rapport.ligneCle('Acomptes', euros(dossier.synthese.acompteCentimes));
    rapport.ligneCle('Dettes / avances', euros(dossier.synthese.detteCentimes));
    rapport.ligneCle('Retenues sur écart de caisse', euros(dossier.synthese.retenueEcartCentimes));

    rapport.sectionTitre('Récapitulatif par salarié');
    rapport.tableau(
      [
        { label: 'Salarié', cle: 'nom', largeur: 0.28 },
        { label: 'Statut', cle: 'statut', largeur: 0.17 },
        { label: 'Jours', cle: 'jours', largeur: 0.1, align: 'droite' },
        { label: 'Heures', cle: 'heures', largeur: 0.13, align: 'droite' },
        { label: 'CP', cle: 'cp', largeur: 0.08, align: 'droite' },
        { label: 'Mal./Mat.', cle: 'maladie', largeur: 0.12, align: 'droite' },
        { label: 'Retards', cle: 'retards', largeur: 0.12, align: 'droite' },
      ],
      dossier.salaries.map(s => ({
        nom: s.nom, statut: s.statutLibelle,
        jours: String(s.variables.presence.jours),
        heures: heures(s.variables.presence.heures),
        cp: String(s.variables.congesPayes.jours),
        maladie: String(s.variables.maladieMaternite.jours),
        retards: s.variables.retards.minutes ? `${s.variables.retards.minutes} min` : '—',
      })),
    );

    rapport.encadre([
      { texte: 'Ce que NEXUS garantit', gras: true },
      { texte: 'NEXUS prépare des variables : il n’établit aucun bulletin et n’applique aucune retenue.' },
      { texte: 'Seuls les éléments arbitrés figurent dans ce dossier ; ce qui reste à vérifier en est exclu et signalé.' },
      { texte: 'Un écart de caisse ne devient une retenue que sur décision explicite du manager, montant saisi à la main.' },
    ]);

    dossier.salaries.forEach(s => ficheSalarie(rapport, s, dossier.periode));

    rapport.piedDePageToutesPages(`NEXUS PAYE · Dossier comptable ${label} · généré le ${jjmmaaaa(String(dossier.genereLe).slice(0, 10))}`);
    const bytes = await global.NexusPdfMoteur.finaliser(rapport);
    return {
      bytes,
      nomFichier: `NEXUS-Dossier-comptable-${opts.site || 'station'}-${String(dossier.periode).slice(0, 7)}.pdf`,
      titre: `Dossier comptable ${label}`,
    };
  }

  global.NexusPayeDossierPdf = { construireDossierPdf, moisLabel, periodeEvenement, lignesVariables, euros, heures, minutes, nombre, jjmmaaaa };
})(typeof window !== 'undefined' ? window : globalThis);
