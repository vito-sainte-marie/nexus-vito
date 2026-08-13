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
      .select('litrage_gazole,litrage_sp95,litrage_gnr')
      .eq('site', siteId).gte('date', debut).lte('date', fin);
    if (error) { console.error('Chargement ventes carburant (période):', error); return { ventes: { go: null, sp95: null, gnr: null }, nbQuartsTotal: 0, nbQuartsAvecLitrage: 0 }; }
    const lignes = data || [];
    const ventes = global.NexusCarburantMoteur.sommerVentesPeriode(lignes);
    const nbQuartsAvecLitrage = lignes.filter(l => l.litrage_gazole != null || l.litrage_sp95 != null || l.litrage_gnr != null).length;
    return { ventes, nbQuartsTotal: lignes.length, nbQuartsAvecLitrage };
  }

  // Reprend exactement la chaîne de NEXUS-Carburants-v1.html : dernier
  // relevé RÉEL avant `date` (ancre), ventes captées depuis ce relevé
  // jusqu'à `date` (exclue), stock réel DE `date` si un relevé existe pour
  // ce jour précis. Retourne { parCarburant: {go:{...},sp95:{...},gnr:{...}},
  // aucunReleve: bool } — `aucunReleve` distingue explicitement "aucun
  // relevé n'existe encore pour ce site" de "un relevé existe mais les
  // données sont insuffisantes pour calculer un écart", deux situations
  // honnêtement différentes à l'affichage (Brief/Pilotage).
  async function chargerControleJour(client, siteId, date) {
    const M = global.NexusCarburantMoteur;
    const [{ data: releveDuJour, error: e1 }, { data: dernierReleve, error: e2 }] = await Promise.all([
      client.from('carburant_releves').select('*').eq('site', siteId).eq('date', date).maybeSingle(),
      client.from('carburant_releves').select('*').eq('site', siteId).lt('date', date).order('date', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (e1) console.error('Chargement relevé carburant du jour (contrôle):', e1);
    if (e2) console.error('Chargement dernier relevé carburant (contrôle):', e2);

    if (!releveDuJour && !dernierReleve) {
      return { parCarburant: null, aucunReleve: true };
    }

    let ventesDepuis = { go: null, sp95: null, gnr: null };
    if (dernierReleve) {
      const { data: lignesVentes, error: e3 } = await client.from('audits_caisse')
        .select('litrage_gazole,litrage_sp95,litrage_gnr')
        .eq('site', siteId).gt('date', dernierReleve.date).lt('date', date);
      if (e3) console.error('Chargement ventes depuis dernier relevé (contrôle):', e3);
      ventesDepuis = M.sommerVentesPeriode(lignesVentes || []);
    }

    const parCarburant = {};
    CARBURANTS_INFO.forEach(({ cle }) => {
      const reelDuJour = cle === 'go'
        ? M.stockReelGoTotal(releveDuJour)
        : (releveDuJour ? releveDuJour[`stock_reel_${cle}`] : null);
      const dernierReel = cle === 'go'
        ? M.stockReelGoTotal(dernierReleve)
        : (dernierReleve ? dernierReleve[`stock_reel_${cle}`] : null);
      const livraison = releveDuJour ? (releveDuJour[`livraison_${cle}`] || 0) : 0;
      const mouvement = releveDuJour ? (releveDuJour[`mouvement_${cle}`] || 0) : 0;
      parCarburant[cle] = M.calculerCarburant({ dernierReel, reelDuJour, livraison, mouvement, ventes: ventesDepuis[cle] });
    });

    return { parCarburant, aucunReleve: false, dateDernierReleve: dernierReleve ? dernierReleve.date : null };
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

  global.NexusCarburantDonnees = { CARBURANTS_INFO, chargerVentesPeriode, chargerControleJour, chargerJoursSansReleve };
})(typeof window !== 'undefined' ? window : globalThis);
