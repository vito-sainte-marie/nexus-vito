// NEXUS — nexus-auth.js
// À inclure sur CHAQUE page qui nécessite une connexion (Cockpit, Missions, Plan d'action, etc.)
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// <script src="nexus-auth.js?v=20260904-0104"></script>

// Configuration d'environnement (04/09/2026). L'URL et la clé ne sont plus
// écrites ici : elles viennent de `nexus-config.js`, généré au build depuis
// les variables d'environnement. Un même code source sert donc la recette et
// la production, et c'est le build — jamais le dépôt — qui décide de la base
// visée.
//
// ÉCHEC FERMÉ : sans configuration valide, NEXUS refuse de démarrer et le
// dit. Il ne retombe sur aucune valeur par défaut — une valeur par défaut
// serait forcément celle d'un environnement, et ferait écrire la recette
// dans la base de l'autre.
const NEXUS_CFG = (typeof window !== 'undefined' && window.NEXUS_CONFIG) || null;
if (!NEXUS_CFG || !NEXUS_CFG.supabaseUrl || !NEXUS_CFG.supabaseCle || !NEXUS_CFG.environnement) {
  const manquant = !NEXUS_CFG ? 'nexus-config.js n’a pas été chargé'
    : 'nexus-config.js est incomplet (' + ['environnement','supabaseUrl','supabaseCle'].filter(c => !NEXUS_CFG[c]).join(', ') + ')';
  const message = 'NEXUS ne peut pas démarrer : ' + manquant
    + '. Ce fichier est produit au moment du build par outils/generer-config.js ; '
    + 'sans lui, l’application ignore à quelle base elle doit parler et refuse de deviner.';
  document.addEventListener('DOMContentLoaded', () => {
    document.body.innerHTML = '<div style="max-width:640px;margin:14vh auto;padding:22px;'
      + 'font:14px/1.6 system-ui,sans-serif;color:#EDF1F5;background:#141B22;'
      + 'border:1px solid #F0546B;border-radius:12px">'
      + '<strong style="color:#F0546B">Configuration absente</strong><br><br>'
      + message.replace(/</g, '&lt;') + '</div>';
  }, { once: true });
  throw new Error(message);
}

// `nexus-page.js` est posé par le même build que `nexus-config.js`, juste
// avant ce fichier. Son absence ne doit pas se manifester par une
// `ReferenceError` au milieu d'un garde de navigation : on le dit.
// `nexus-build.js` porte l'identité de la génération ET la primitive qui
// épingle les ressources chargées à l'exécution. Sans lui, ce fichier ne peut
// pas construire une URL versionnée — et il ne doit surtout pas en inventer
// une : c'est exactement ce qu'il faisait jusqu'au 05/09/2026 avec sa propre
// constante de génération, figée au 31 août, qui gouvernait dix-huit scripts
// et faisait charger au Cockpit des fichiers vieux de cinq jours.
if (typeof NexusBuild === 'undefined' || typeof NexusBuild.versionner !== 'function') {
  throw new Error('NEXUS ne peut pas démarrer : nexus-build.js n’a pas été chargé. '
    + 'Il porte l’identité de la génération et la seule primitive autorisée à '
    + 'épingler une ressource. Aucune valeur de repli n’est prévue : une seconde '
    + 'génération est précisément le défaut que ce garde-fou empêche.');
}

if (typeof NexusPage === 'undefined' || typeof NexusPage.est !== 'function') {
  throw new Error('NEXUS ne peut pas démarrer : nexus-page.js n’a pas été chargé. '
    + 'Ce fichier identifie la page courante indépendamment de l’hébergeur ; '
    + 'sans lui, les gardes de séquence obligatoire boucleraient.');
}

const NEXUS_SUPABASE_URL = NEXUS_CFG.supabaseUrl;
const NEXUS_SUPABASE_ANON_KEY = NEXUS_CFG.supabaseCle;
const NEXUS_ENVIRONNEMENT = NEXUS_CFG.environnement;

const nexusClient = supabase.createClient(NEXUS_SUPABASE_URL, NEXUS_SUPABASE_ANON_KEY);

(function chargerExtensionsInventaireV2() {
  const page = NexusPage.identifiant();

  const pagesHorizon=['NEXUS-Inventaire-Manager-v1.html','NEXUS-Carburants-Pilotage-v1.html','NEXUS-App-v1.html','NEXUS-Cockpit-v2.html','NEXUS-Scanner-v1.html','NEXUS-Radar-Manager-v1.html','NEXUS-Centre-Intelligence-v1.html'];
  if(NexusPage.est(pagesHorizon)){const s=document.createElement('script');s.src=NexusBuild.versionner('nexus-horizon-operationnel.js');s.defer=true;document.head.appendChild(s);}

  if (NexusPage.est('NEXUS-Inventaire-v1.html')) {
    const scriptTransferts = document.createElement('script'); scriptTransferts.src = NexusBuild.versionner('nexus-inventaire-transferts-internes.js'); scriptTransferts.defer = true; document.head.appendChild(scriptTransferts);
    const scriptCond = document.createElement('script'); scriptCond.src = NexusBuild.versionner('nexus-inventaire-cigarettes-conditionnement-v1.js'); scriptCond.defer = true; document.head.appendChild(scriptCond);
  }
  if (NexusPage.est(['NEXUS-Inventaire-v1.html', 'NEXUS-Inventaire-Manager-v1.html'])) {
    const s=document.createElement('script');s.src=NexusBuild.versionner('nexus-inventaire-stock-localise-entry.js');s.defer=true;document.head.appendChild(s);
  }
  if (NexusPage.est(['NEXUS-Inventaire-v1.html','NEXUS-Inventaire-Manager-v1.html','NEXUS-Parametres-Inventaire-v1.html'])) {
    const s=document.createElement('script');s.src=NexusBuild.versionner('nexus-inventaire-rotation-intelligente.js');s.defer=true;document.head.appendChild(s);
  }
  if (NexusPage.est('NEXUS-Parametres-Inventaire-v1.html')) {
    [NexusBuild.versionner('nexus-inventaire-reglages-specifiques.js'),NexusBuild.versionner('nexus-inventaire-parametres-stock-localise.js'),NexusBuild.versionner('nexus-inventaire-regles-ux-v2.js'),NexusBuild.versionner('nexus-inventaire-regles-finition-v2.js'),NexusBuild.versionner('nexus-inventaire-parametres-reassort-v1.js')].forEach(src=>{const s=document.createElement('script');s.src=src;s.defer=true;document.head.appendChild(s);});
  }
  if (NexusPage.est('NEXUS-Stock-Localise-v1.html')) {
    const scripts=[NexusBuild.versionner('nexus-inventaire-conditionnement.js'),NexusBuild.versionner('nexus-inventaire-stock-localise-ux-v2.js'),NexusBuild.versionner('nexus-inventaire-stock-controle-cible-v2.js'),NexusBuild.versionner('nexus-inventaire-stock-transfert-v2.js'),NexusBuild.versionner('nexus-inventaire-reassort-boutique-v1.js'),NexusBuild.versionner('nexus-inventaire-conditionnement-stock-localise.js'),NexusBuild.versionner('nexus-inventaire-stock-transfert-deeplink-v1.js')];
    scripts.forEach(src=>{const s=document.createElement('script');s.src=src;s.defer=true;document.head.appendChild(s);});
  }

  const pagesStockMoteur=['NEXUS-App-v1.html','NEXUS-Cockpit-v2.html','NEXUS-Scanner-v1.html','NEXUS-Radar-Manager-v1.html','NEXUS-Centre-Intelligence-v1.html'];
  if(NexusPage.est(pagesStockMoteur)){const s=document.createElement('script');s.src=NexusBuild.versionner('nexus-stock-moteur.js');s.defer=true;document.head.appendChild(s);}
  const pagesDecisionStock=['NEXUS-App-v1.html','NEXUS-Cockpit-v2.html','NEXUS-Centre-Intelligence-v1.html'];
  if(NexusPage.est(pagesDecisionStock)) ['nexus-reappro-stock-v1.js','nexus-conseiller-stock-v3.js'].forEach(src=>{const s=document.createElement('script');s.src=NexusBuild.versionner(src);s.defer=true;document.head.appendChild(s);});
  if(NexusPage.est('NEXUS-Cockpit-v2.html')){const s=document.createElement('script');s.src=NexusBuild.versionner('nexus-cockpit-stock-v3.js');s.defer=true;document.head.appendChild(s);}
  if(NexusPage.est('NEXUS-Scanner-v1.html')){const s=document.createElement('script');s.src=NexusBuild.versionner('nexus-scanner-stock-v3.js');s.defer=true;document.head.appendChild(s);}
  if(NexusPage.est('NEXUS-Radar-Manager-v1.html')){const s=document.createElement('script');s.src=NexusBuild.versionner('nexus-radar-stock-v3.js');s.defer=true;document.head.appendChild(s);}
  if(NexusPage.est('NEXUS-FDJ-v1.html')){const s=document.createElement('script');s.src=NexusBuild.versionner('nexus-fdj-correction-stock-depart.js');s.defer=true;document.head.appendChild(s);}
  if(NexusPage.est('NEXUS-FDJ-Manager-v1.html')){const s=document.createElement('script');s.src=NexusBuild.versionner('nexus-fdj-manager-stabilite.js');s.defer=true;document.head.appendChild(s);}
  if(NexusPage.est('NEXUS-Inventaire-Manager-v1.html')) [NexusBuild.versionner('nexus-inventaire-manager-premium-v2.js'),NexusBuild.versionner('nexus-inventaire-manager-fullwidth-v2.js'),NexusBuild.versionner('nexus-inventaire-manager-reassort-cigarettes-v3.js'),NexusBuild.versionner('nexus-inventaire-couverture-operationnelle-v1.js')].forEach(src=>{const s=document.createElement('script');s.src=src;s.defer=true;document.head.appendChild(s);});
  if(NexusPage.est('NEXUS-Carburants-Pilotage-v1.html')){
    ['nexus-carburant-commande-coherence-v1.js','nexus-carburant-demarrage-mois-v1.js'].forEach(src=>{const s=document.createElement('script');s.src=NexusBuild.versionner(src);s.defer=true;document.head.appendChild(s);});
  }
  if(NexusPage.est('NEXUS-Carburant-Reception-v1.html')){const s=document.createElement('script');s.src=NexusBuild.versionner('nexus-reception-mobile-fix-v1.js');s.defer=true;document.head.appendChild(s);}
})();

async function nexusAttendreGardeModeTestInventaire() {
  if (window.NEXUS_INVENTAIRE_MODE_TEST_READY) return true;
  for (let i = 0; i < 120; i++) {
    await new Promise(resolve => setTimeout(resolve, 25));
    if (window.NEXUS_INVENTAIRE_MODE_TEST_READY) return true;
  }
  console.error('Mode test Inventaire : garde de simulation non prête, test annulé par sécurité.');
  return false;
}

async function nexusRequireAuth() {
  const { data: { session } } = await nexusClient.auth.getSession();
  if (!session) { window.location.href = "NEXUS-Login-v1.html"; return null; }
  const { data: employee, error } = await nexusClient.from("employees").select("id, username, nom, role, est_createur, site_id").eq("id", session.user.id).single();
  if (error || !employee) { await nexusClient.auth.signOut(); window.location.href = "NEXUS-Login-v1.html"; return null; }
  if (!employee.site_id) { console.error('nexusRequireAuth: employé sans site_id — configuration de compte incomplète.'); await nexusClient.auth.signOut(); window.location.href = "NEXUS-Login-v1.html?erreur=site_manquant"; return null; }
  employee.consultation_externe=false;
  if(employee.est_createur){const siteConsulte=localStorage.getItem('nexus_site_consulte_createur');if(siteConsulte&&siteConsulte!==employee.site_id){employee.site_id=siteConsulte;employee.consultation_externe=true;}}
  employee.role_reel=employee.role;
  if(await nexusPriseDePosteManquante(employee)){const p=(window.location.pathname.split('/').pop()||'NEXUS-App-v1.html')+window.location.search;window.location.href=`NEXUS-Prise-De-Poste-v1.html?retour=${encodeURIComponent(p)}`;return null;}
  if(await nexusPointageArriveeManquant(employee)){const p=(window.location.pathname.split('/').pop()||'NEXUS-App-v1.html')+window.location.search;window.location.href=`NEXUS-Pointage-v1.html?retour=${encodeURIComponent(p)}`;return null;}
  const pageActuelleAuth=NexusPage.identifiant();
  if(NexusPage.est('NEXUS-Inventaire-v1.html')&&(employee.role_reel==='manager'||employee.role_reel==='gerant')){
    const r=new URLSearchParams(window.location.search).get('test_role');
    const a={caissier:'caissier',caissiere:'caissier','caissière':'caissier',pompiste:'pompiste',renfort:'renfort'};
    const rt=r?a[String(r).toLowerCase()]:null;
    employee.role_test_inventaire=rt||null;
    employee.mode_test_inventaire=!!rt;
    // Sécurité P0 : si un rôle de test est demandé, l'authentification ne
    // rend la main à l'écran Inventaire qu'une fois les no-op d'écriture et
    // le quart virtuel installés. Si la garde ne charge pas, on retire le
    // paramètre de test plutôt que d'exécuter une simulation potentiellement
    // écrivante sur les données officielles.
    if (employee.mode_test_inventaire) {
      const gardePrete = await nexusAttendreGardeModeTestInventaire();
      if (!gardePrete) {
        employee.role_test_inventaire = null;
        employee.mode_test_inventaire = false;
        const u = new URL(window.location.href);
        u.searchParams.delete('test_role');
        window.location.replace(u.pathname.split('/').pop() + u.search + u.hash);
        return null;
      }
    }
  }
  // A3 / A3-6 (05/09/2026) — le nom du commerce dans les pieds de page.
  //
  // Trente écrans affichaient « Vito Sainte-Marie Usine » en pied de page.
  // Aucune décision n'en dépendait — c'est pourquoi ce lot est venu en
  // dernier — mais un produit multi-site ne peut pas signer chaque écran du
  // nom d'un autre client.
  //
  // Un seul mécanisme, ici, plutôt que trente lectures : cette fonction est
  // le seul endroit qui tourne sur TOUS les écrans. Elle remplit les
  // `<span class="nexus-nom-commerce">` et ne bloque rien — le rendu n'attend
  // pas le réseau. Même doctrine qu'en B1 : nom réel, sinon identifiant du
  // commerce, sinon libellé neutre. Jamais le nom d'un autre.
  nexusRemplirNomDuCommerce(employee);
  return employee;
}

let NEXUS_NOM_COMMERCE_PROMESSE = null;
async function nexusRemplirNomDuCommerce(employee) {
  const cibles = document.querySelectorAll('.nexus-nom-commerce');
  if (!cibles.length) return;
  const siteId = employee && employee.site_id;
  if (!NEXUS_NOM_COMMERCE_PROMESSE) {
    NEXUS_NOM_COMMERCE_PROMESSE = (async () => {
      const { data, error } = await nexusClient.from('sites').select('nom_entreprise').eq('site_id', siteId).maybeSingle();
      if (error) { console.error('Lecture identité du commerce :', error); return siteId || 'Commerce non identifié'; }
      if (!data || !data.nom_entreprise) { console.warn('Identité du commerce non configurée — pied de page neutre.'); return siteId || 'Commerce non identifié'; }
      return data.nom_entreprise;
    })();
  }
  const nom = await NEXUS_NOM_COMMERCE_PROMESSE;
  document.querySelectorAll('.nexus-nom-commerce').forEach(el => { el.textContent = nom; });
}

const NEXUS_PAGES_SEQUENCE_OBLIGATOIRE=['NEXUS-Pointage-v1.html','NEXUS-Prise-De-Poste-v1.html'];
async function nexusPointageArriveeManquant(employee){if(NexusPage.est(NEXUS_PAGES_SEQUENCE_OBLIGATOIRE)||employee.consultation_externe)return false;const siteId=employee.site_id;const manager=employee.role==='manager'||employee.role==='gerant';const {data:config}=await nexusClient.from('station_config').select('pointage_actif, manager_pointage_requis').eq('site',siteId).maybeSingle();if(config&&config.pointage_actif===false)return false;if(manager&&(!config||!config.manager_pointage_requis))return false;const d=new Date();const today=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const {data:arrivee,error}=await nexusClient.from('pointages').select('id').eq('employee_id',employee.id).eq('date',today).eq('type','arrivee').maybeSingle();if(error){console.error('Vérification pointage arrivée:',error);return false;}return !arrivee;}
// ────────────────────────────────────────────────────────────────────
// S-4 (05/09/2026) — LE service courant. Une seule définition.
//
// NEXUS en avait QUATRE, réparties sur neuf lectures de `shifts` : une
// fenêtre de 24 h, une borne à minuit local de l'appareil, une borne de
// journée en UTC, et un seul lecteur — Pointage — qui regardait `statut`.
//
// Tant que rien ne clôturait un service, `statut` valait toujours
// 'en_cours' : les neuf convergeaient PAR ACCIDENT. Depuis S-2 (clôture au
// pointage de départ) et S-3 (clôture à la prise de poste suivante), les
// services se ferment réellement — et les huit lecteurs qui ignoraient
// `statut` renverraient un service TERMINÉ comme s'il était actif.
//
// Contrat, arbitré le 05/09/2026 :
//     employee_id = employé courant
//     site_id     = site courant
//     statut      = 'en_cours'
//     order by heure_debut desc limit 1
//
// AUCUN repli : ni fenêtre de 24 h, ni date du jour, ni dernier service
// historique, ni rôle habituel. Sans service actif, l'appelant reçoit
// `aucun: true` et applique son propre comportement métier — le refus est
// une réponse, pas un trou à combler.
//
// Le tri sur le plus récent subsiste bien que S-1 rende le cas impossible :
// défense de lecture contre un historique imparfait ou un import.
//
// Retour : { service } | { aucun: true } | { erreur: true }
async function nexusServiceCourant(employee){
  if(!employee||!employee.id||!employee.site_id){
    console.error('Service courant : employé ou site non résolu — aucune lecture n\u2019est faite.');
    return { erreur: true };
  }
  const { data, error } = await nexusClient
    .from('shifts')
    .select('id, role, quart, heure_debut, site_id, statut')
    .eq('employee_id', employee.id)
    .eq('site_id', employee.site_id)
    .eq('statut', 'en_cours')
    .order('heure_debut', { ascending: false })
    .limit(2);
  if(error){ console.error('Service courant : lecture impossible \u2014', error); return { erreur: true }; }
  const services = data || [];
  if(!services.length) return { aucun: true };
  // S-1 pose un index unique partiel : plus d\u2019un service ouvert est
  // devenu impossible. Si cela se produit malgré tout, c\u2019est une anomalie
  // technique — on la signale, on ne la masque pas, et on retient le plus
  // récent pour ne pas bloquer l\u2019employé.
  if(services.length > 1){
    console.error('Service courant : ' + services.length + ' services ouverts pour cet employé alors que l\u2019unicité est garantie en base. Anomalie technique — le plus récent est retenu.');
  }
  return { service: services[0] };
}

async function nexusPriseDePosteManquante(employee){if(NexusPage.est(NEXUS_PAGES_SEQUENCE_OBLIGATOIRE)||employee.consultation_externe)return false;const manager=employee.role==='manager'||employee.role==='gerant';if(manager)return false;// S-4 / Q2 : la porte d'accès regarde le service RÉELLEMENT actif, plus
  // l'existence d'un service dans la journée de l'appareil. Après un
  // pointage de départ, l'employé n'a plus de service courant : s'il
  // revient sur un parcours qui en exige un, il est renvoyé vers la prise
  // de poste. C'est une conséquence voulue du contrat, pas un effet de bord.
  //
  // En cas d'erreur technique, on ne bloque pas : une panne de lecture ne
  // doit pas enfermer un employé hors de l'application.
  const r=await nexusServiceCourant(employee);
  if(r.erreur)return false;
  return !!r.aucun;}
async function nexusLogout(){await nexusClient.auth.signOut();window.location.href="index.html";}
function nexusQuitterConsultation(){localStorage.removeItem('nexus_site_consulte_createur');window.location.href="NEXUS-App-v1.html";}
