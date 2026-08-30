// NEXUS — nexus-auth.js
// À inclure sur CHAQUE page qui nécessite une connexion (Cockpit, Missions, Plan d'action, etc.)
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// <script src="nexus-auth.js"></script>

const NEXUS_SUPABASE_URL = "https://uzhjpqpctpvxytxpxoqz.supabase.co";
const NEXUS_SUPABASE_ANON_KEY = "sb_publishable_7dV43gZxDYg6MOa6xzmdDQ_m8Mean5p";

const nexusClient = supabase.createClient(NEXUS_SUPABASE_URL, NEXUS_SUPABASE_ANON_KEY);

// Inventaire V2 — extension strictement locale à la page Inventaire.
// Elle est chargée dynamiquement pour éviter de modifier le gros fichier HTML
// monolithique uniquement pour le mode de test manager.
(function chargerExtensionInventaireV2() {
  const page = window.location.pathname.split('/').pop();
  if (page !== 'NEXUS-Inventaire-v1.html') return;
  const script = document.createElement('script');
  script.src = 'nexus-inventaire-mode-test.js';
  script.defer = true;
  document.head.appendChild(script);
})();

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

  // Conserver explicitement le rôle RH authentifié. Le mode test Inventaire
  // ne remplace JAMAIS employee.role : ainsi shifts, pointage et
  // inventaire_quart_employes continuent de voir le manager réel.
  employee.role_reel = employee.role;

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

  // Inventaire V2 — mode test terrain manager (30/08/2026).
  // Le rôle simulé est une information de session UI seulement. Il n'est
  // jamais copié dans employee.role ni dans une table Supabase.
  const pageActuelleAuth = window.location.pathname.split('/').pop();
  if (pageActuelleAuth === 'NEXUS-Inventaire-v1.html' && (employee.role_reel === 'manager' || employee.role_reel === 'gerant')) {
    const roleTestDemande = new URLSearchParams(window.location.search).get('test_role');
    const aliases = {
      caissier: 'caissier', caissiere: 'caissier', 'caissière': 'caissier',
      pompiste: 'pompiste', renfort: 'renfort'
    };
    const roleTest = roleTestDemande ? aliases[String(roleTestDemande).toLowerCase()] : null;
    employee.role_test_inventaire = roleTest || null;
    employee.mode_test_inventaire = !!roleTest;
  }

  return employee;
}

const NEXUS_PAGES_SEQUENCE_OBLIGATOIRE = ['NEXUS-Pointage-v1.html', 'NEXUS-Prise-De-Poste-v1.html'];

async function nexusPointageArriveeManquant(employee) {
  const pageActuelle = window.location.pathname.split('/').pop();
  if (NEXUS_PAGES_SEQUENCE_OBLIGATOIRE.includes(pageActuelle)) return false;
  if (employee.consultation_externe) return false;

  const siteId = employee.site_id;
  const estNiveauManager = employee.role === 'manager' || employee.role === 'gerant';

  const { data: config } = await nexusClient
    .from('station_config').select('pointage_actif, manager_pointage_requis').eq('site', siteId).maybeSingle();

  if (config && config.pointage_actif === false) return false;

  if (estNiveauManager) {
    if (!config || !config.manager_pointage_requis) return false;
  }

  const d = new Date();
  const todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const { data: arrivee, error } = await nexusClient
    .from('pointages').select('id').eq('employee_id', employee.id).eq('date', todayISO).eq('type', 'arrivee').maybeSingle();
  if (error) { console.error('Vérification pointage arrivée:', error); return false; }
  return !arrivee;
}

async function nexusPriseDePosteManquante(employee) {
  const pageActuelle = window.location.pathname.split('/').pop();
  if (NEXUS_PAGES_SEQUENCE_OBLIGATOIRE.includes(pageActuelle)) return false;
  if (employee.consultation_externe) return false;

  const estNiveauManager = employee.role === 'manager' || employee.role === 'gerant';
  if (estNiveauManager) return false;

  const d = new Date();
  const debutJourISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00`;
  const { data: shiftDuJour, error } = await nexusClient
    .from('shifts').select('id').eq('employee_id', employee.id).gte('heure_debut', debutJourISO).limit(1).maybeSingle();
  if (error) { console.error('Vérification prise de poste:', error); return false; }
  return !shiftDuJour;
}

async function nexusLogout() {
  await nexusClient.auth.signOut();
  window.location.href = "index.html";
}

function nexusQuitterConsultation() {
  localStorage.removeItem('nexus_site_consulte_createur');
  window.location.href = "NEXUS-App-v1.html";
}
