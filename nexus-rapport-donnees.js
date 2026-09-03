// ============================================================
// NEXUS Rapport — chargeurs de données CA/marge en cascade (10/08/2026).
//
// Colle Supabase pour Rapport NEXUS (Chapitre 1 "Synthèse dirigeant" et
// Chapitre 2 "Santé de l'entreprise") — utilise nexus-periodes.js pour
// les BORNES de période (calcul pur, aucun accès base), ce fichier se
// charge d'aller chercher si des données existent réellement pour ces
// bornes, et où.
//
// Pourquoi une cascade et pas une seule table : constat du 10/08/2026,
// documenté dans NEXUS-Data-Dictionary-v2 (v2.29) — aucune source seule
// ne couvre aujourd'hui "n'importe quelle période depuis n'importe
// quand" :
//   - `products` (table utilisée par nexus-periodes.js/analyserPeriodes)
//     a de la profondeur (depuis janvier 2026) mais seulement 4 blocs
//     d'import irréguliers, non calendaires — un mois ou trimestre
//     calendaire exact ne coïncide presque jamais avec un bloc.
//   - `current_normalized_sales` (vue sur normalized_sales) est
//     granulaire par TRANSACTION (sold_at), la seule à porter marge par
//     ligne (margin_amount_ht) — mais VÉRIFIÉ EN BASE le 10/08/2026 :
//     son total_ttc quotidien ne représente qu'une fraction du CA réel
//     (comparé jour par jour à audits_caisse, déjà la source de CA de
//     confiance dans tout NEXUS — ex. 31/07 : 565 € dans
//     normalized_sales contre 10 479 € dans audits_caisse pour le même
//     jour ; ~96 lignes/jour de façon quasi constante, plutôt le signe
//     d'un jeu de données de démonstration pour la couche API que d'une
//     capture réelle et continue des ventes). CONSÉQUENCE : cette table
//     n'est PLUS utilisée comme source de CA (retirée de la cascade
//     chargerCaPeriode ci-dessous) — l'utiliser aurait affiché un CA
//     très sous-estimé avec le badge "RÉEL", donc plus trompeur qu'une
//     donnée manquante. Elle reste la seule source connue avec une
//     marge par ligne, donc conservée pour chargerMargePeriode, mais
//     étiquetée 'derive' (pas 'reel') et avec un texte d'avertissement
//     explicite sur la couverture partielle — voir cette fonction.
//   - `audits_caisse` (vente_piste + vente_boutique, quotidien) remonte
//     à mi-juillet 2026 — CA seul, pas de marge, déjà la source établie
//     de "CA du jour" ailleurs dans NEXUS (Tempo, Verify, Carburants).
//
// Principe (confirmé par Frédéric le 10/08/2026, "Cascade + honnêteté") :
// chaque métrique essaie ses sources dans l'ordre de fiabilité/précision
// décroissante, s'arrête à la première qui a des lignes couvrant la
// période demandée, et répond EXPLICITEMENT disponible:false si aucune
// n'en a — jamais un chiffre fabriqué ou une période recalculée en
// douce sur un découpage différent de celui demandé. Comme
// audits_caisse s'enrichit chaque jour tout seul, la couverture des
// périodes courtes/récentes s'élargit d'elle-même avec le temps, sans
// changement de code.
//
// Dépend de nexus-periodes.js (chargé avant) pour resoudrePeriodeCalendaire
// / resoudrePeriodesReference — ce fichier-ci ne fait QUE la partie
// Supabase, aucun calcul de bornes de date ici (Article 11).
//
// Inclure dans une page :
//   <script src="nexus-periodes.js?v=20260903-1148"></script>
//   <script src="nexus-rapport-donnees.js?v=20260903-1148"></script>
// ------------------------------------------------------------

(function (global) {
  // Confiance NEXUS (taxonomie déjà en usage dans Brief) :
  // 'reel'   = mesuré directement, sans transformation (normalized_sales,
  //            audits_caisse — un CA ou une marge par transaction/jour).
  // 'derive' = reconstruit à partir d'une autre donnée déjà vraie
  //            (products : agrégat d'un bloc d'import qui ne correspond
  //            pas exactement à la période calendaire demandée mais
  //            coïncide avec elle).

  /**
   * CA agrégé sur [periode.debut, periode.fin] (bornes incluses), pour
   * un site — cascade audits_caisse → products. normalized_sales
   * délibérément EXCLU (voir en-tête du fichier — sous-estime fortement
   * le CA réel, vérifié en base le 10/08/2026).
   * Retourne { disponible:true, valeur, source, confiance } ou
   * { disponible:false, raison }.
   */
  async function chargerCaPeriode(client, site, periode) {
    const { debut, fin } = periode;

    const { data: audits, error: e2 } = await client
      .from('audits_caisse')
      .select('date, vente_piste, vente_boutique')
      .eq('site', site)
      .gte('date', debut)
      .lte('date', fin);
    if (e2) console.error('Rapport NEXUS — chargement CA (audits_caisse):', e2);
    if (!e2 && audits && audits.length) {
      const valeur = audits.reduce((s, a) => s + (a.vente_piste || 0) + (a.vente_boutique || 0), 0);
      return { disponible: true, valeur, source: 'audits_caisse', confiance: 'reel', nbLignes: audits.length };
    }

    const { data: produits, error: e3 } = await client
      .from('products')
      .select('ca')
      .eq('site', site)
      .eq('periode_debut', debut)
      .eq('periode_fin', fin);
    if (e3) console.error('Rapport NEXUS — chargement CA (products):', e3);
    if (!e3 && produits && produits.length) {
      const valeur = produits.reduce((s, p) => s + (p.ca || 0), 0);
      return { disponible: true, valeur, source: 'products', confiance: 'derive', nbLignes: produits.length };
    }

    return { disponible: false, raison: `Aucune donnée de CA ne couvre la période ${debut} → ${fin}.` };
  }

  /**
   * Marge agrégée (montant € et taux %) sur [periode.debut, periode.fin],
   * pour un site — cascade normalized_sales → products (pas de proxy
   * quotidien fiable pour la marge ailleurs que normalized_sales : ni
   * audits_caisse ni aucune autre table n'a de champ marge). Le taux
   * calculé à partir de normalized_sales est étiqueté 'derive' (pas
   * 'reel') et porte `couvertureIncertaine:true` — cette table ne capte
   * qu'une fraction des ventes réelles (voir en-tête du fichier), donc le
   * TAUX de marge qu'elle donne peut être représentatif sans que le
   * MONTANT le soit — l'appelant doit afficher le taux avec prudence,
   * jamais le montant seul comme un chiffre d'affaires de marge fiable.
   * Retourne { disponible:true, montant, tauxPct, source, confiance } ou
   * { disponible:false, raison }.
   */
  async function chargerMargePeriode(client, site, periode) {
    const { debut, fin } = periode;

    const { data: ventes, error: e1 } = await client
      .from('current_normalized_sales')
      .select('total_ttc, margin_amount_ht, unit_sale_price_ht, quantity, sold_at')
      .eq('site', site)
      .gte('sold_at', `${debut}T00:00:00`)
      .lte('sold_at', `${fin}T23:59:59.999`);
    if (e1) console.error('Rapport NEXUS — chargement marge (normalized_sales):', e1);
    if (!e1 && ventes && ventes.length) {
      const montant = ventes.reduce((s, v) => s + (v.margin_amount_ht || 0), 0);
      const caHt = ventes.reduce((s, v) => s + (v.unit_sale_price_ht || 0) * (v.quantity || 0), 0);
      const tauxPct = caHt > 0 ? (montant / caHt) * 100 : null;
      return { disponible: true, montant, tauxPct, source: 'normalized_sales', confiance: 'derive', couvertureIncertaine: true, nbLignes: ventes.length };
    }

    const { data: produits, error: e3 } = await client
      .from('products')
      .select('ca, marge')
      .eq('site', site)
      .eq('periode_debut', debut)
      .eq('periode_fin', fin);
    if (e3) console.error('Rapport NEXUS — chargement marge (products):', e3);
    if (!e3 && produits && produits.length) {
      const montant = produits.reduce((s, p) => s + (p.marge || 0), 0);
      const ca = produits.reduce((s, p) => s + (p.ca || 0), 0);
      const tauxPct = ca > 0 ? (montant / ca) * 100 : null;
      return { disponible: true, montant, tauxPct, source: 'products', confiance: 'derive', nbLignes: produits.length };
    }

    return { disponible: false, raison: `Aucune donnée de marge ne couvre la période ${debut} → ${fin}.` };
  }

  /**
   * Essaie chargerCaPeriode/chargerMargePeriode sur la période demandée,
   * puis sur chacune des références de repli si la première échoue —
   * s'arrête à la première qui répond disponible:true. `chargeur` est
   * chargerCaPeriode ou chargerMargePeriode. Retourne le même shape que
   * ces fonctions, plus `periodeUtilisee` (celle qui a effectivement
   * fourni la donnée) — ou { disponible:false, raison } si aucune des
   * périodes essayées n'a de données.
   */
  async function chargerAvecRepli(chargeur, client, site, periodesCandidates) {
    for (const p of periodesCandidates) {
      const resultat = await chargeur(client, site, p);
      if (resultat.disponible) return { ...resultat, periodeUtilisee: p };
    }
    return { disponible: false, raison: `Aucune des périodes de référence essayées (${periodesCandidates.map(p => p.label || `${p.debut}→${p.fin}`).join(', ')}) n'a de données.` };
  }

  /**
   * Décisions du journal (`journal_decisions`) prises PENDANT la période
   * — utilisé par Chapitre 1 ("décisions prises pendant la période").
   * Retourne toujours un tableau (jamais null) — un journal vide est une
   * information légitime, pas une erreur.
   *
   * `periode_reference_debut`/`periode_reference_fin` ajoutés à la
   * sélection (12/08/2026, cadrage §13, lot P2.2 "effets observés") —
   * colonnes déjà présentes sur `journal_decisions` depuis l'origine (Marge+
   * les écrit pour ses décisions R5-MARGE-ECART) mais jamais lues jusqu'ici.
   * Nécessaires à `NexusRapportDirectionMoteur.construireDecisionsChapitre()`
   * pour retrouver la marge % de la catégorie AU MOMENT de la décision et la
   * comparer à la période la plus récente disponible.
   */
  async function chargerDecisionsPeriode(client, site, periode) {
    const { data, error } = await client
      .from('journal_decisions')
      .select('id, candidate_id, rule_id, etat, recommandation, impact_eur, article, categorie, date, employee_id, created_at, periode_reference_debut, periode_reference_fin')
      .eq('site', site)
      .gte('date', periode.debut)
      .lte('date', periode.fin)
      .order('date', { ascending: false });
    if (error) { console.error('Rapport NEXUS — chargement décisions:', error); return []; }
    return data || [];
  }

  global.NexusRapportDonnees = {
    chargerCaPeriode,
    chargerMargePeriode,
    chargerAvecRepli,
    chargerDecisionsPeriode,
  };
})(window);
