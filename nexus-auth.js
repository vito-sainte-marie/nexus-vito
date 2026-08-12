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

  // Garde ajoutée le 11/08/2026 (audit "philosophie/architecture", section
  // "dé-Vito-iser le cœur") : jusqu'ici, chaque page retombait séparément
  // sur `employee.site_id` dès que site_id était
  // absent — un repli SILENCIEUX vers le site pilote, répété dans ~44
  // fichiers. Ce n'est pas un filet de sécurité : un compte mal configuré
  // (site_id NULL) verrait et modifierait alors les données de Vito
  // Sainte-Marie sans le savoir, ce qui est pire qu'un blocage franc.
  // nexusRequireAuth() est le seul point d'entrée de toutes les pages
  // authentifiées : garantir ICI que site_id est toujours renseigné permet
  // à tout le reste de l'application de lire `employee.site_id` directement,
  // sans jamais avoir besoin (ni le droit) de deviner un site par défaut.
  if (!employee.site_id) {
    console.error('nexusRequireAuth: employé sans site_id — configuration de compte incomplète. Refus de continuer avec un site déduit arbitrairement.');
    await nexusClient.auth.signOut();
    window.location.href = "NEXUS-Login-v1.html?erreur=site_manquant";
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

  // Ordre imposé après connexion (28/07/2026, demande de Frédéric, puis
  // inversion le même jour une fois le problème identifié : le pointage
  // arrivée calcule un retard par rapport au quart actif dans `shifts` —
  // si le pointage passait avant la prise de poste, ce quart n'existerait
  // pas encore et le retard ne pourrait jamais être calculé). L'ordre
  // définitif est donc : 1) Prise de poste (crée le quart), 2) Pointage
  // arrivée (compare l'heure réelle au quart qui vient d'être créé).
  // Les deux pages-portes s'excluent mutuellement dans les fonctions
  // ci-dessous pour ne jamais se bloquer elles-mêmes ni se renvoyer l'une
  // vers l'autre en cours de route.
  if (await nexusPriseDePosteManquante(employee)) {
    const pageActuelle = (window.location.pathname.split('/').pop() || 'NEXUS-App-v1.html') + window.location.search;
    window.location.href = `NEXUS-Prise-De-Poste-v1.html?retour=${encodeURIComponent(pageActuelle)}`;
    return null;
  }

  if (await nexusPointageArriveeManquant(employee)) {
    const pageActuelle = (window.location.pathname.split('/').pop() || 'NEXUS-App-v1.html') + window.location.search;
    window.location.href = `NEXUS-Pointage-v1.html?retour=${encodeURIComponent(pageActuelle)}`;
    return null;
  }

  return employee;
}

// Pages-portes de la séquence obligatoire — ni l'une ni l'autre ne doit
// jamais se rediriger elle-même, ni rediriger vers l'autre pendant qu'on
// y est encore (sinon on serait renvoyé de Prise de poste vers Pointage
// avant même d'avoir fini de choisir son rôle, par exemple).
const NEXUS_PAGES_SEQUENCE_OBLIGATOIRE = ['NEXUS-Pointage-v1.html', 'NEXUS-Prise-De-Poste-v1.html'];

async function nexusPointageArriveeManquant(employee) {
  const pageActuelle = window.location.pathname.split('/').pop();
  if (NEXUS_PAGES_SEQUENCE_OBLIGATOIRE.includes(pageActuelle)) return false;
  if (employee.consultation_externe) return false; // créateur en simple consultation d'un autre site

  // site_id est garanti non-nul ici : nexusRequireAuth() refuse toute
  // session dont l'employé n'a pas de site_id (voir plus haut).
  const siteId = employee.site_id;
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

async function nexusPriseDePosteManquante(employee) {
  const pageActuelle = window.location.pathname.split('/').pop();
  if (NEXUS_PAGES_SEQUENCE_OBLIGATOIRE.includes(pageActuelle)) return false;
  if (employee.consultation_externe) return false; // créateur en simple consultation d'un autre site

  const estNiveauManager = employee.role === 'manager' || employee.role === 'gerant';
  if (estNiveauManager) return false; // uniquement pour les employés, jamais pour manager/gérant

  const d = new Date();
  const debutJourISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00`;
  const { data: shiftDuJour, error } = await nexusClient
    .from('shifts').select('id').eq('employee_id', employee.id).gte('heure_debut', debutJourISO).limit(1).maybeSingle();
  if (error) { console.error('Vérification prise de poste:', error); return false; } // en cas d'erreur réseau, on ne bloque pas l'accès
  return !shiftDuJour;
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
