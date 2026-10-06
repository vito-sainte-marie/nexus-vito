// ============================================================================
// VOIR UN BON OU UNE FACTURE (06/10/2026, demande de Frédéric : « comment
// vérifier une facture ou un bon visuellement dans compte client ? »).
//
// Les fichiers déposés (Boîte de réception, worker de l'iMac) vivent dans le
// bucket privé 'documents-a-traiter'. La politique de lecture
// documents_a_traiter_lecture_site autorise déjà un utilisateur du site à les
// lire : un lien signé de courte durée suffit, sans migration.
//
// L'onglet est ouvert PENDANT le clic, avant d'attendre le lien : ouvert après
// un `await`, Safari (iPhone, iPad, Mac) le bloque comme une fenêtre surgissante.
// ============================================================================
const NEXUS_BUCKET_DOCUMENTS = 'documents-a-traiter';
const NEXUS_DUREE_LIEN_DOCUMENT_S = 300; // 5 minutes : le temps de regarder, pas de partager

async function nexusVoirDocument(chemin) {
  if (!chemin) { alert("Ce document n'a pas de fichier enregistré."); return false; }
  const onglet = window.open('', '_blank');
  if (onglet) onglet.opener = null;
  const { data, error } = await nexusClient.storage.from(NEXUS_BUCKET_DOCUMENTS).createSignedUrl(chemin, NEXUS_DUREE_LIEN_DOCUMENT_S);
  if (error || !data || !data.signedUrl) {
    if (onglet) onglet.close();
    console.error('Lien du document :', error);
    alert("Impossible d'ouvrir ce document : " + ((error && error.message) || 'lien non obtenu'));
    return false;
  }
  if (onglet) onglet.location.href = data.signedUrl;
  else window.location.href = data.signedUrl; // onglet refusé par le navigateur : ouvrir ici
  return true;
}
