// NEXUS — d'où viennent les écarts de caisse d'un employé (14/09/2026).
//
// POURQUOI CE FICHIER EXISTE. Trois écrans employés lisaient `audits_caisse`
// en clair pour en extraire les écarts d'une seule personne : Mon Évolution,
// Ma Progression et Apprentissage. Chacun refaisait le même geste, et chacun
// recevait donc les mêmes champs de trop : l'identifiant du collègue qui
// tenait l'autre poste, l'écart de ce poste, l'écart du quart entier,
// l'identité du validateur et le commentaire brut du manager. La RLS ne
// pouvait rien y faire : elle filtre des lignes, jamais des colonnes.
//
// Le tri se fait désormais côté serveur, dans `mes_ecarts_caisse()`
// (migration 20260914210000), qui ne rend que les postes réellement tenus
// par l'appelant. Ce module est le seul endroit qui sait CHOISIR la source :
// projection pour soi, lignes brutes pour un manager qui regarde quelqu'un
// d'autre. Écrire ce choix dans les trois écrans aurait garanti qu'un
// quatrième écran, un jour, le réécrive de travers.
//
// CE QUE CE MODULE NE DÉCIDE PAS. Il ne classe rien et ne calcule aucun
// statut : la mise en forme des services reste `NexusProgression`, la gravité
// reste `NexusVerifyMoteur` / `NexusEcartsMoteur`. Il choisit une source et
// pagine, rien de plus.
(function (global) {
  'use strict';

  const TAILLE_PAGE = 1000;

  // Colonnes lues sur les lignes brutes, chemin manager uniquement. La liste
  // est ici, une fois, pour que les deux écrans qui ont une vue manager ne
  // divergent pas : ce sont exactement les champs que
  // `NexusProgression.construireServicesCaisse` consomme.
  const SELECT_AUDITS_BRUT = 'id, date, quart, ecart_piste, ecart_boutique, '
    + 'employes_piste, employes_boutique, valide_le, ecart_piste_valide, '
    + 'ecart_boutique_valide, commentaire_validation, ecart_piste_origine, '
    + 'ecart_boutique_origine, cause_code_piste, cause_code_boutique';

  // Pagination explicite : PostgREST plafonne les réponses, et un plafond
  // silencieux se lit comme « cet employé n'a pas travaillé avant mars ».
  // Chaque requête est reconstruite à neuf — un builder supabase-js ne se
  // rejoue pas.
  async function paginer(fabriquerRequete) {
    const tout = [];
    for (let debut = 0; ; debut += TAILLE_PAGE) {
      const { data, error } = await fabriquerRequete().range(debut, debut + TAILLE_PAGE - 1);
      if (error) return { data: null, error };
      const page = data || [];
      tout.push(...page);
      if (page.length < TAILLE_PAGE) return { data: tout, error: null };
    }
  }

  // Les postes tenus par l'utilisateur connecté, un par ligne. Aucun
  // paramètre d'identité : la fonction SQL ne filtre que sur `auth.uid()`,
  // donc personne ne peut demander les postes de quelqu'un d'autre, pas même
  // en modifiant cet appel dans la console du navigateur.
  //
  // `depuis` (facultatif) : borne basse de date, au format AAAA-MM-JJ.
  async function chargerPostesEmploye({ client, depuis }) {
    return paginer(() => {
      let requete = client.rpc('mes_ecarts_caisse').order('date', { ascending: false });
      if (depuis) requete = requete.gte('date', depuis);
      return requete;
    });
  }

  // Les services d'une personne, dans la forme `services[]` attendue par tout
  // NexusProgression.
  //
  // `vueManager` vrai signifie : un manager regarde la progression de
  // quelqu'un d'autre (`?employe=<id>`). Ce cas garde les lignes brutes,
  // seule source qui porte la représentation complète du quart, et il reste
  // gardé par la RLS d'`audits_caisse`, qui ne l'ouvre qu'aux managers et
  // gérants du site. Un employé qui forcerait `vueManager` dans sa console
  // recevrait zéro ligne, pas les écarts d'un collègue.
  //
  // Dans tous les autres cas, y compris un manager qui consulte sa PROPRE
  // progression, la source est la projection.
  async function chargerServicesCaisse({ client, siteId, cibleId, vueManager }) {
    const P = global.NexusProgression;
    if (!P) return { services: null, erreur: new Error('NexusProgression absent'), source: null };

    if (vueManager) {
      const { data, error } = await paginer(() => client
        .from('audits_caisse').select(SELECT_AUDITS_BRUT)
        .eq('site', siteId).order('date', { ascending: false }));
      if (error) return { services: null, erreur: error, source: 'audits_caisse' };
      return {
        services: P.construireServicesCaisse(data || [], cibleId),
        erreur: null,
        source: 'audits_caisse',
      };
    }

    const { data, error } = await chargerPostesEmploye({ client });
    if (error) return { services: null, erreur: error, source: 'mes_ecarts_caisse' };
    return {
      services: P.construireServicesCaisseDepuisProjection(data || []),
      erreur: null,
      source: 'mes_ecarts_caisse',
    };
  }

  // ---------------------------------------------------------------------
  // FDJ — même problème, même remède (17/09/2026, relecture de la PR #62).
  //
  // « Ma Progression » chargeait ses quarts FDJ par
  // `from('fdj_shifts').select('*, fdj_cash_controls(*)')`. L'étoile
  // imbriquée envoyait à l'employé, dans la réponse réseau, le commentaire
  // interne du manager (`motif_ecart_texte`), son verdict
  // (`resultat_controle`) et l'identité du contrôleur (`valide_par`,
  // `controle_par`). L'écran n'en affichait rien ; c'est la réponse qui
  // compte, pas ce qu'on en fait ensuite.
  //
  // Pour soi : `fdj_ma_progression_caisse()` (migration 20260916220900),
  // sans paramètre d'identité, qui ne rend que les douze champs consommés
  // par `construireServicesCaisseFdj` et ne rend que les quarts clôturés.
  // Pour un manager qui consulte quelqu'un d'autre : les lignes brutes,
  // gardées par la RLS de `fdj_cash_controls` — qui, après la Phase C, ne
  // les ouvre qu'au manager du site.
  // ---------------------------------------------------------------------

  // Les colonnes lues sur les lignes brutes, chemin manager uniquement.
  // Écrites une fois, ici : `select('*')` sur une table de montants finit
  // toujours par transporter la colonne de trop.
  const SELECT_FDJ_SHIFTS_BRUT = 'id, site, date, quart, statut, '
    + 'fdj_cash_controls(statut, caisse_attendue, caisse_reelle, '
    + 'caisse_reelle_origine, ecart, ecart_origine, motif_ecart, valide_le)';

  async function chargerServicesCaisseFdj({ client, siteId, cibleId, vueManager }) {
    const P = global.NexusProgression;
    if (!P) return { servicesFdj: null, erreur: new Error('NexusProgression absent'), source: null };

    if (vueManager) {
      const { data, error } = await paginer(() => client
        .from('fdj_shifts').select(SELECT_FDJ_SHIFTS_BRUT)
        .eq('site', siteId).eq('employee_id', cibleId)
        .order('date', { ascending: false }));
      if (error) return { servicesFdj: null, erreur: error, source: 'fdj_shifts' };
      return {
        servicesFdj: P.construireServicesCaisseFdj(data || []),
        erreur: null,
        source: 'fdj_shifts',
      };
    }

    const { data, error } = await paginer(() => client
      .rpc('fdj_ma_progression_caisse').order('date', { ascending: false }));
    if (error) return { servicesFdj: null, erreur: error, source: 'fdj_ma_progression_caisse' };
    return {
      servicesFdj: P.construireServicesCaisseFdjDepuisProjection(data || []),
      erreur: null,
      source: 'fdj_ma_progression_caisse',
    };
  }

  global.NexusCaisseSource = {
    SELECT_AUDITS_BRUT,
    SELECT_FDJ_SHIFTS_BRUT,
    chargerPostesEmploye,
    chargerServicesCaisse,
    chargerServicesCaisseFdj,
  };
})(window);
