// ============================================================
// NEXUS FDJ Pilotage (Analyse) — colle Supabase (11/08/2026)
//
// Refactoring des pages monolithiques, 5e et dernière page traitée après
// Brief, Cockpit, App et Inventaire Manager : NEXUS-FDJ-Analyse-v1.html
// (1790 lignes). Domaine à part (synthèse/pilotage FDJ, vues Phase B +
// nexus-fdj-moteur.js/nexus-coach-fdj-moteur.js), sans recoupement avec
// nexus-conseiller-donnees.js ni nexus-inventaire-manager-donnees.js.
//
// Ce fichier ne contient QUE des lectures (Article 11 — un chargeur ne
// fait jamais un deuxième calcul ni une écriture) : les 10 fonctions
// extraites sont chacune un simple SELECT en lecture (ou 2 SELECT liés
// pour chargerDerniereReference), vérifiées une par une pour l'absence
// de insert/update/upsert/delete avant extraction.
//
// DETTE DE DUPLICATION TROUVÉE ET NON TRAITÉE DANS CE LOT (Article 5 —
// transparence) : quatre de ces fonctions existent aussi, sous le même
// nom, dans NEXUS-FDJ-v1.html (écran employé) et/ou NEXUS-FDJ-Manager-v1.html
// (écran manager stock/carnets) — deux pages qui NE font PAS partie des 5
// pages ciblées par l'audit "philosophie/architecture" (APP/Inventaire
// Manager/FDJ Analyse/Brief/Cockpit), donc non touchées dans ce chantier :
//   - chargerJeux / chargerEmplacements : IDENTIQUES mot pour mot dans les
//     3 pages (FDJ-Analyse, FDJ-Manager, FDJ-v1) — vraie duplication,
//     candidate évidente à une centralisation future si l'une de ces 2
//     pages entre un jour dans un chantier de refactoring.
//   - chargerMouvementsStock : PAS identique — FDJ-Analyse et FDJ-v1 font
//     `select('*')`, FDJ-Manager sélectionne un sous-ensemble de colonnes
//     explicite. Ne pas unifier sans vérifier que `select('*')` ne casse
//     rien côté Manager.
//   - chargerDerniereReference : PAS identique — la version FDJ-Manager
//     renvoie 2 champs de plus (`type`, `controlePar`) que celle de
//     FDJ-Analyse/FDJ-v1. Écart réel, non corrigé ici (même discipline que
//     l'écart `contexte` de chargerMargePlusHome documenté en v2.42).
//   - chargerParametresFdjSite : la requête est identique (table
//     fdj_site_settings, même filtre site) mais le DÉFAUT appliqué diffère
//     totalement selon la page (`{ seuil_min_quarts_moyenne: 3 }` ici,
//     `{ fenetre_acces_quart_min: 30 }` dans FDJ-v1) — chaque
//     page ne consomme qu'un champ différent de la même ligne de config,
//     ce n'est pas un doublon à fusionner mais une coïncidence de requête.
//   - chargerEmployesSite : requête identique à celle de FDJ-Manager
//     (mêmes colonnes, mêmes filtres) — mais NE PAS confondre avec la
//     fonction de même nom dans nexus-inventaire-manager-donnees.js, qui
//     sélectionne une colonne `role` en plus et filtre les managers/gérants
//     (comportement différent, domaine différent).
//
// Convention : chaque fonction reçoit `client` (nexusClient) en premier
// paramètre, puis `site` (siteId) et les paramètres déjà explicites dans
// la version d'origine. `chargerParametresFdjSite` et
// `chargerPremiereDateSuiviJeu` perdent leur cache interne (page-level
// `let ...Cache` dans la page d'origine) : ce fichier ne fait QUE lire,
// jamais mémoriser un résultat côté service — la page garde son cache et
// appelle ce chargeur seulement au premier accès, exactement comme avant.
// `chargerVue` et `chargerShiftFacts` reçoivent des dates déjà formatées
// en ISO (string) plutôt que des objets Date, pour ne pas dupliquer ici
// l'utilitaire `dateISO()` propre à la page.
//
// Inclure après nexus-auth.js (nexusClient) :
// <script src="nexus-fdj-analyse-donnees.js?v=20260904-0104"></script>
// ------------------------------------------------------------

(function (global) {
  async function chargerVue(client, site, nomVue, dateDebutISO, dateFinISO) {
    const { data, error } = await client.from(nomVue).select('*').eq('site', site).gte('date', dateDebutISO).lte('date', dateFinISO);
    if (error) { console.error(`Chargement ${nomVue}:`, error); return []; }
    return data || [];
  }

  // `defaultValue` = repli propre à la page appelante (voir note en tête
  // de fichier — chaque page consomme un champ différent de la même ligne
  // fdj_site_settings, donc un défaut différent).
  async function chargerParametresFdjSite(client, site, defaultValue) {
    const { data, error } = await client.from('fdj_site_settings').select('*').eq('site', site).maybeSingle();
    if (error) console.error('Chargement paramètres FDJ site:', error);
    return data || defaultValue;
  }

  async function chargerEmplacements(client, site) {
    const { data, error } = await client.from('fdj_locations').select('*').eq('site', site).eq('actif', true);
    if (error) { console.error('Chargement emplacements FDJ:', error); return []; }
    return data || [];
  }

  async function chargerPremiereDateSuiviJeu(client, site) {
    const { data, error } = await client.from('fdj_shifts').select('date').eq('site', site).order('date', { ascending: true }).limit(1).maybeSingle();
    if (error) { console.error('Chargement première date suivi jeu FDJ:', error); return null; }
    return data ? data.date : null;
  }

  async function chargerMouvementsStock(client, site) {
    const { data, error } = await client.from('fdj_stock_movements').select('*').eq('site', site);
    if (error) { console.error('Chargement mouvements stock FDJ:', error); return []; }
    return data || [];
  }

  async function chargerDerniereReference(client, site) {
    const { data: ref, error: e1 } = await client.from('fdj_stock_references').select('*').eq('site', site).eq('statut', 'valide').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (e1) { console.error('Chargement référence stock FDJ:', e1); return null; }
    if (!ref) return null;
    const { data: lignes, error: e2 } = await client.from('fdj_stock_reference_lignes').select('game_id, bureau_reel, caisse_reel').eq('reference_id', ref.id);
    if (e2) { console.error('Chargement lignes référence stock FDJ:', e2); return null; }
    const map = {};
    (lignes || []).forEach(l => { map[l.game_id] = { bureau: l.bureau_reel, caisse: l.caisse_reel }; });
    return { id: ref.id, date: ref.date, creeLe: ref.created_at, lignes: map };
  }

  async function chargerJeux(client, site) {
    const { data, error } = await client.from('fdj_games').select('*').eq('site', site).eq('actif', true).order('ordre_affichage', { ascending: true });
    if (error) { console.error('Chargement jeux FDJ:', error); return []; }
    return data || [];
  }

  async function chargerEmployesSite(client, site) {
    const { data, error } = await client.from('employees').select('id, nom').eq('site_id', site).eq('actif', true).order('nom', { ascending: true });
    if (error) { console.error('Chargement employés site:', error); return []; }
    return data || [];
  }

  async function chargerShiftFacts(client, site, dateDebutISO, dateFinISO) {
    const { data, error } = await client.from('view_fdj_shift_facts').select('*').eq('site', site).gte('date', dateDebutISO).lte('date', dateFinISO);
    if (error) { console.error('Chargement view_fdj_shift_facts:', error); return []; }
    return data || [];
  }

  // Paramètres explicites (debut/fin/compDebut/compFin déjà en ISO) plutôt
  // que de fermer sur `periodeResolue`, l'état de page — un chargeur ne
  // doit dépendre que de ce qu'on lui donne (même discipline que les
  // chargeurs de nexus-brief-donnees.js/nexus-app-donnees.js).
  async function chargerSyntheseCoachEquipe(client, site, debutISO, finISO, compDebutISO, compFinISO) {
    const [{ data: actuel, error: e1 }, { data: comp, error: e2 }] = await Promise.all([
      client.from('coach_daily_recommendations').select('employee_id, rule_id, date').eq('site', site).gte('date', debutISO).lte('date', finISO),
      client.from('coach_daily_recommendations').select('rule_id').eq('site', site).gte('date', compDebutISO).lte('date', compFinISO),
    ]);
    if (e1) console.error('Chargement coach_daily_recommendations (Coaching équipe):', e1);
    if (e2) console.error('Chargement coach_daily_recommendations comparaison (Coaching équipe):', e2);
    return { actuel: actuel || [], comp: comp || [] };
  }

  // Détection des comptages manquants (13/08/2026, demande directe de
  // Frédéric : "les caisses de ces derniers jours n'ont pas été faites, ou
  // plutôt les employés n'ont pas fait les inventaires") — même principe
  // que nexus-carburant-donnees.js::chargerJoursSansReleve (fenêtre récente
  // bornée, jamais un jour signalé avant le tout premier comptage réel du
  // site), adapté à 2 quarts FIXES par jour (Quart 1/Quart 2 — voir le
  // sélecteur figé de NEXUS-FDJ-Manager-v1.html, aucun site n'a un nombre
  // de quarts différent) au lieu d'un relevé unique par jour.
  //
  // Deux états distincts remontés pour chaque quart en défaut (Article 5 —
  // "pas fait" recouvre deux réalités différentes, jamais confondues) :
  // 'absent' (aucune ligne fdj_shifts du tout pour ce quart — rien n'a
  // jamais été commencé) et 'brouillon' (un employé a ouvert le quart,
  // fdj_shifts.statut vaut toujours 'brouillon' — voir l'insert dans
  // NEXUS-FDJ-v1.html — mais ne l'a jamais validé via validerQuart()).
  // Un quart 'valide' n'est jamais reporté, quel que soit son écart de
  // caisse — l'écart est un problème de contrôle, pas d'inventaire manquant
  // (hors périmètre de cette détection).
  const QUARTS_FDJ_JOUR = ['1', '2'];
  async function chargerJoursSansComptage(client, site, dateDuJour, fenetreJours = 14) {
    const premierJour = await chargerPremiereDateSuiviJeu(client, site);
    if (!premierJour) return { jours: [], premierJour: null };
    const bornInf = new Date(`${dateDuJour}T00:00:00`);
    bornInf.setDate(bornInf.getDate() - fenetreJours);
    const fenetreDebut = `${bornInf.getFullYear()}-${String(bornInf.getMonth() + 1).padStart(2, '0')}-${String(bornInf.getDate()).padStart(2, '0')}`;
    const dateDebut = premierJour > fenetreDebut ? premierJour : fenetreDebut;
    const { data: shifts, error } = await client.from('fdj_shifts').select('date, quart, statut')
      .eq('site', site).gte('date', dateDebut).lt('date', dateDuJour);
    if (error) { console.error('Chargement jours sans comptage FDJ:', error); return { jours: [], premierJour }; }
    const parCle = {};
    (shifts || []).forEach(s => { parCle[`${s.date}|${s.quart}`] = s.statut; });
    const jours = [];
    const cursor = new Date(`${dateDebut}T00:00:00`);
    const limite = new Date(`${dateDuJour}T00:00:00`);
    while (cursor < limite) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      const quartsProbleme = [];
      QUARTS_FDJ_JOUR.forEach(q => {
        const statut = parCle[`${iso}|${q}`];
        if (statut === undefined) quartsProbleme.push({ quart: q, statut: 'absent' });
        else if (statut === 'brouillon') quartsProbleme.push({ quart: q, statut: 'brouillon' });
      });
      if (quartsProbleme.length) jours.push({ date: iso, quarts: quartsProbleme });
      cursor.setDate(cursor.getDate() + 1);
    }
    return { jours, premierJour };
  }

  global.NexusFdjAnalyseDonnees = {
    chargerVue, chargerParametresFdjSite, chargerEmplacements, chargerPremiereDateSuiviJeu,
    chargerMouvementsStock, chargerDerniereReference, chargerJeux, chargerEmployesSite,
    chargerShiftFacts, chargerSyntheseCoachEquipe, chargerJoursSansComptage,
  };
})(typeof window !== 'undefined' ? window : globalThis);
