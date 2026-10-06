// ============================================================================
// DOUBLONS DE DOCUMENTS DÉPOSÉS (06/10/2026)
//
// Un même fichier (même empreinte fichier_hash) déposé deux fois donne deux
// factures ou deux bons. La Boîte de réception les liste dans une section
// « Doublons » ; cette règle désigne, pour chaque fichier, la ligne CONSERVÉE
// et celles qui peuvent partir. Éprouvée par test_doublons_documents_20261006.js.
//
// Ligne conservée, dans l'ordre :
//   1. une facture déjà envoyée (elle a une trace d'envoi, on ne la touche pas) ;
//   2. une ligne rattachée à un client plutôt qu'une ligne sans client ;
//   3. la plus ancienne (premier dépôt) ; à égalité, le plus petit id.
// Un doublon lui-même envoyé n'est jamais proposé à la suppression : deux
// envois du même fichier se tranchent à la main, pas par un bouton.
// ============================================================================

// docs : [{ type: 'facture'|'bon', id, fichier_hash, fichier_path, created_at, client_id, statut }]
// → [{ garde, doublon, supprimable }] — une entrée par ligne en trop.
function nexusDoublonsDocuments(docs) {
  const groupes = new Map();
  for (const d of (docs || [])) {
    if (!d || !d.fichier_hash) continue;
    const cle = d.type + '|' + d.fichier_hash;
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(d);
  }
  const envoyee = d => d.type === 'facture' && d.statut === 'envoyee';
  const rang = (a, b) =>
    (envoyee(b) - envoyee(a)) ||
    (!!b.client_id - !!a.client_id) ||
    String(a.created_at || '').localeCompare(String(b.created_at || '')) ||
    String(a.id).localeCompare(String(b.id));
  const res = [];
  for (const groupe of groupes.values()) {
    if (groupe.length < 2) continue;
    const [garde, ...autres] = groupe.slice().sort(rang);
    for (const doublon of autres) res.push({ garde, doublon, supprimable: !envoyee(doublon) });
  }
  return res.sort((a, b) => String(b.doublon.created_at || '').localeCompare(String(a.doublon.created_at || '')));
}
