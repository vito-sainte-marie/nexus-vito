// NEXUS — nexus-auth.js
// À inclure sur CHAQUE page qui nécessite une connexion (Cockpit, Missions, Plan d'action, etc.)
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// <script src="nexus-auth.js"></script>

const NEXUS_SUPABASE_URL = "https://uzhjpqpctpvxytxpxoqz.supabase.co";
const NEXUS_SUPABASE_ANON_KEY = "sb_publishable_7dV43gZxDYg6MOa6xzmdDQ_m8Mean5p";

const nexusClient = supabase.createClient(NEXUS_SUPABASE_URL, NEXUS_SUPABASE_ANON_KEY);

async function nexusRequireAuth() {
  const { data: { session } } = await nexusClient.auth.getSession();
  if (!session) {
    window.location.href = "NEXUS-Login-v1.html";
    return null;
  }
  const { data: employee, error } = await nexusClient
    .from("employees")
    .select("id, username, nom, role, est_createur, site_id")
    .eq("id", session.user.id)
    .single();
  if (error || !employee) {
    await nexusClient.auth.signOut();
    window.location.href = "NEXUS-Login-v1.html";
    return null;
  }
  employee.consultation_externe = false;
  if (employee.est_createur) {
    const siteConsulte = localStorage.getItem('nexus_site_consulte_createur');
    if (siteConsulte && siteConsulte !== employee.site_id) {
      employee.site_id = siteConsulte;
      employee.consultation_externe = true;
    }
  }

  // Pointage obligatoire avant le reste de l'app (28/07/2026, demande de
  // Frédéric) : tant que l'arrivée du jour n'est pas pointée, on redirige
  // systématiquement vers NEXUS-Pointage-v1.html, quelle que soit la page
  // demandée — centralisé ici pour s'appliquer à toutes les pages qui
  // incluent nexus-auth.js sans avoir à les modifier une par une. On
  // renvoie null comme pour les cas "pas connecté", pour que la page
  // appelante s'arrête net (elle a déjà ce garde-fou : `if (!employee) return;`).
  if (await nexusPointageArriveeManquant(employee)) {
    const pageActuelle = (window.location.pathname.split('/').pop() || 'NEXUS-App-v1.html') + window.location.search;
    window.location.href = `NEXUS-Pointage-v1.html?retour=${encodeURIComponent(pageActuelle)}`;
    return null;
  }

  return employee;
}

async function nexusPointageArriveeManquant(employee) {
  const pageActuelle = window.location.pathname.split('/').pop();
  if (pageActuelle === 'NEXUS-Pointage-v1.html') return false; // jamais se bloquer soi-même
  if (employee.consultation_externe) return false; // créateur en simple consultation d'un autre site

  const siteId = employee.site_id || 'vito-sainte-marie';
  const estNiveauManager = employee.role === 'manager' || employee.role === 'gerant';
  if (estNiveauManager) {
    const { data: config } = await nexusClient
      .from('station_config').select('manager_pointage_requis').eq('site', siteId).maybeSingle();
    if (!config || !config.manager_pointage_requis) return false; // pas requis pour ce poste
  }

  const d = new Date();
  const todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const { data: arrivee, error } = await nexusClient
    .from('pointages').select('id').eq('employee_id', employee.id).eq('date', todayISO).eq('type', 'arrivee').maybeSingle();
  if (error) { console.error('Vérification pointage arrivée:', error); return false; } // en cas d'erreur réseau, on ne bloque pas l'accès
  return !arrivee;
}

// Déconnexion (à appeler depuis un bouton "Se déconnecter")
// MISE À JOUR 26/07/2026 (demande de Frédéric) : redirige vers la page de
// présentation (index.html) plutôt que vers l'écran de connexion — une
// déconnexion volontaire n'a pas besoin de renvoyer directement au
// formulaire de login. Les redirections de sécurité dans nexusRequireAuth()
// ci-dessus (pas de session / session orpheline) restent volontairement
// inchangées : ce sont des cas différents, où revenir droit au login reste
// le bon réflexe.
async function nexusLogout() {
  await nexusClient.auth.signOut();
  window.location.href = "index.html";
}

function nexusQuitterConsultation() {
  localStorage.removeItem('nexus_site_consulte_createur');
  window.location.href = "NEXUS-App-v1.html";
}
