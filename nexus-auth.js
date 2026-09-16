// NEXUS — nexus-auth.js
// À inclure sur CHAQUE page qui nécessite une connexion (Cockpit, Missions, Plan d'action, etc.)
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// <script src="nexus-auth.js?v=20260904-0104"></script>

const NEXUS_SUPABASE_URL = "https://uzhjpqpctpvxytxpxoqz.supabase.co";
const NEXUS_SUPABASE_ANON_KEY = "sb_publishable_7dV43gZxDYg6MOa6xzmdDQ_m8Mean5p";

const nexusClient = supabase.createClient(NEXUS_SUPABASE_URL, NEXUS_SUPABASE_ANON_KEY);

(function chargerExtensionsInventaireV2() {
  const page = window.location.pathname.split('/').pop();
  const STOCK_BUILD = '20260831-1408';
  const versionnerStock = src => `${src}?v=${STOCK_BUILD}`;

  const pagesHorizon=['NEXUS-Inventaire-Manager-v1.html','NEXUS-Carburants-Pilotage-v1.html','NEXUS-App-v1.html','NEXUS-Cockpit-v2.html','NEXUS-Scanner-v1.html','NEXUS-Radar-Manager-v1.html','NEXUS-Centre-Intelligence-v1.html'];
  if(pagesHorizon.includes(page)){const s=document.createElement('script');s.src=versionnerStock('nexus-horizon-operationnel.js');s.defer=true;document.head.appendChild(s);}

  if (page === 'NEXUS-Inventaire-v1.html') {
    const scriptTransferts = document.createElement('script'); scriptTransferts.src = 'nexus-inventaire-transferts-internes.js'; scriptTransferts.defer = true; document.head.appendChild(scriptTransferts);
    const scriptCond = document.createElement('script'); scriptCond.src = versionnerStock('nexus-inventaire-cigarettes-conditionnement-v1.js'); scriptCond.defer = true; document.head.appendChild(scriptCond);
  }
  if (['NEXUS-Inventaire-v1.html', 'NEXUS-Inventaire-Manager-v1.html'].includes(page)) {
    const s=document.createElement('script');s.src='nexus-inventaire-stock-localise-entry.js';s.defer=true;document.head.appendChild(s);
  }
  if (['NEXUS-Inventaire-v1.html','NEXUS-Inventaire-Manager-v1.html','NEXUS-Parametres-Inventaire-v1.html'].includes(page)) {
    const s=document.createElement('script');s.src='nexus-inventaire-rotation-intelligente.js';s.defer=true;document.head.appendChild(s);
  }
  if (page === 'NEXUS-Parametres-Inventaire-v1.html') {
    ['nexus-inventaire-reglages-specifiques.js','nexus-inventaire-parametres-stock-localise.js','nexus-inventaire-regles-ux-v2.js','nexus-inventaire-regles-finition-v2.js',versionnerStock('nexus-inventaire-parametres-reassort-v1.js')].forEach(src=>{const s=document.createElement('script');s.src=src;s.defer=true;document.head.appendChild(s);});
  }
  if (page === 'NEXUS-Stock-Localise-v1.html') {
    const scripts=[versionnerStock('nexus-inventaire-conditionnement.js'),'nexus-inventaire-stock-localise-ux-v2.js','nexus-inventaire-stock-controle-cible-v2.js','nexus-inventaire-stock-transfert-v2.js',versionnerStock('nexus-inventaire-reassort-boutique-v1.js'),versionnerStock('nexus-inventaire-conditionnement-stock-localise.js'),versionnerStock('nexus-inventaire-stock-transfert-deeplink-v1.js')];
    scripts.forEach(src=>{const s=document.createElement('script');s.src=src;s.defer=true;document.head.appendChild(s);});
  }

  const pagesStockMoteur=['NEXUS-App-v1.html','NEXUS-Cockpit-v2.html','NEXUS-Scanner-v1.html','NEXUS-Radar-Manager-v1.html','NEXUS-Centre-Intelligence-v1.html'];
  if(pagesStockMoteur.includes(page)){const s=document.createElement('script');s.src=versionnerStock('nexus-stock-moteur.js');s.defer=true;document.head.appendChild(s);}
  const pagesDecisionStock=['NEXUS-App-v1.html','NEXUS-Cockpit-v2.html','NEXUS-Centre-Intelligence-v1.html'];
  if(pagesDecisionStock.includes(page)) ['nexus-reappro-stock-v1.js','nexus-conseiller-stock-v3.js'].forEach(src=>{const s=document.createElement('script');s.src=versionnerStock(src);s.defer=true;document.head.appendChild(s);});
  if(page==='NEXUS-Cockpit-v2.html'){const s=document.createElement('script');s.src=versionnerStock('nexus-cockpit-stock-v3.js');s.defer=true;document.head.appendChild(s);}
  if(page==='NEXUS-Scanner-v1.html'){const s=document.createElement('script');s.src=versionnerStock('nexus-scanner-stock-v3.js');s.defer=true;document.head.appendChild(s);}
  if(page==='NEXUS-Radar-Manager-v1.html'){const s=document.createElement('script');s.src=versionnerStock('nexus-radar-stock-v3.js');s.defer=true;document.head.appendChild(s);}
  if(page==='NEXUS-FDJ-v1.html'){const s=document.createElement('script');s.src='nexus-fdj-correction-stock-depart.js';s.defer=true;document.head.appendChild(s);}
  if(page==='NEXUS-FDJ-Manager-v1.html'){const s=document.createElement('script');s.src='nexus-fdj-manager-stabilite.js';s.defer=true;document.head.appendChild(s);}
  if(page==='NEXUS-Inventaire-Manager-v1.html') ['nexus-inventaire-manager-premium-v2.js','nexus-inventaire-manager-fullwidth-v2.js',versionnerStock('nexus-inventaire-manager-reassort-cigarettes-v3.js'),versionnerStock('nexus-inventaire-couverture-operationnelle-v1.js')].forEach(src=>{const s=document.createElement('script');s.src=src;s.defer=true;document.head.appendChild(s);});
  if(page==='NEXUS-Carburants-Pilotage-v1.html'){
    ['nexus-carburant-commande-coherence-v1.js','nexus-carburant-demarrage-mois-v1.js'].forEach(src=>{const s=document.createElement('script');s.src=versionnerStock(src);s.defer=true;document.head.appendChild(s);});
  }
  if(page==='NEXUS-Carburant-Reception-v1.html'){const s=document.createElement('script');s.src=versionnerStock('nexus-reception-mobile-fix-v1.js');s.defer=true;document.head.appendChild(s);}
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
  const pageActuelleAuth=window.location.pathname.split('/').pop();
  if(pageActuelleAuth==='NEXUS-Inventaire-v1.html'&&(employee.role_reel==='manager'||employee.role_reel==='gerant')){
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
  return employee;
}

// ────────────────────────────────────────────────────────────────────
// Reconnaître la page courante — pourquoi en clair, ici, et pas ailleurs.
//
// La branche de développement identifie la page par `NexusPage.est(...)`,
// un module chargé au build juste avant celui-ci. Production est servie
// BRUTE par GitHub Pages : aucun build ne tourne, aucune balise n'est
// injectée, et `nexus-page.js` n'est chargé par aucun écran. Appeler
// `NexusPage` ici lèverait une exception au premier écran ouvert.
//
// `NexusPage` existe parce que Cloudflare Pages retire l'extension `.html`
// et que l'écran de prise de poste ne se reconnaissait plus lui-même —
// boucle de redirection infinie, 04/09/2026. GitHub Pages sert `/X.html`
// tel quel : la comparaison directe ci-dessous est exacte sur cet
// hébergeur. Elle redeviendra insuffisante le jour où l'hébergement
// changera ou où le mode d'artefact « construit » entrera en service ;
// c'est ce jour-là, et pas avant, qu'il faudra charger `nexus-page.js`.
// ────────────────────────────────────────────────────────────────────
const NEXUS_PAGES_SEQUENCE_OBLIGATOIRE=['NEXUS-Pointage-v1.html','NEXUS-Prise-De-Poste-v1.html'];
async function nexusPointageArriveeManquant(employee){const page=window.location.pathname.split('/').pop();if(NEXUS_PAGES_SEQUENCE_OBLIGATOIRE.includes(page)||employee.consultation_externe)return false;const siteId=employee.site_id;const manager=employee.role==='manager'||employee.role==='gerant';const {data:config}=await nexusClient.from('station_config').select('pointage_actif, manager_pointage_requis').eq('site',siteId).maybeSingle();if(config&&config.pointage_actif===false)return false;if(manager&&(!config||!config.manager_pointage_requis))return false;const d=new Date();const today=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const {data:arrivee,error}=await nexusClient.from('pointages').select('id').eq('employee_id',employee.id).eq('date',today).eq('type','arrivee').maybeSingle();if(error){console.error('Vérification pointage arrivée:',error);return false;}return !arrivee;}
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
function nexusDateLocaleISO(d){
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

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
    .limit(5);
  if(error){ console.error('Service courant : lecture impossible \u2014', error); return { erreur: true }; }
  // JAMAIS le service de la veille (11/09/2026, arbitrage C.1/C.2 apres le
  // parcours Caissiere). La requete ne filtre que sur l'employe, le site et
  // le statut : un quart laisse ouvert hier revenait donc comme service du
  // jour. C'est ce qui a produit un retard de 1028 minutes ECRIT en base sur
  // une arrivee de 10 h 33.
  //
  // Le filtre se fait ici, sur la date locale de l'appareil, et non par une
  // borne SQL : `sites.timezone` n'existe pas encore en Production (la
  // migration de la release l'apporte), et la station est sur site avec ses
  // employes. C'est la meme regle que l'ecran de pointage applique deja.
  // Aucun quart ne franchit minuit a cette station : le quart 2 finit au
  // plus tard a 22 h 10.
  const jourLocal = nexusDateLocaleISO(new Date());
  const tous = data || [];
  const services = tous.filter(sv => sv.heure_debut && nexusDateLocaleISO(new Date(sv.heure_debut)) === jourLocal);
  // Signale la PRESENCE d'un service ouvert d'un autre jour, pas l'absence
  // d'un service du jour : une absence n'est pas une anomalie, et un journal
  // d'erreur declenche par du vide apprend a ignorer les journaux.
  const ouvertsHorsDuJour = tous.length - services.length;
  if(ouvertsHorsDuJour > 0){
    console.error('Service courant : ' + ouvertsHorsDuJour + ' service(s) ouvert(s) commence(s) un autre jour, ignore(s) \u2014 le service de la veille n\'est jamais reutilise.');
  }
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

async function nexusPriseDePosteManquante(employee){const page=window.location.pathname.split('/').pop();if(NEXUS_PAGES_SEQUENCE_OBLIGATOIRE.includes(page)||employee.consultation_externe)return false;const manager=employee.role==='manager'||employee.role==='gerant';if(manager)return false;// S-4 / Q2 : la porte d'accès regarde le service RÉELLEMENT actif, plus
  // l'existence d'un service dans la journée de l'appareil. Après un
  // pointage de départ, l'employé n'a plus de service courant : s'il
  // revient sur un parcours qui en exige un, il est renvoyé vers la prise
  // de poste. C'est une conséquence voulue du contrat, pas un effet de bord.
  //
  // En cas d'erreur technique, on ne bloque pas : une panne de lecture ne
  // doit pas enfermer un employé hors de l'application.
  const r=await nexusServiceCourant(employee);
  if(r.erreur)return false;
  if(!r.aucun)return false;
  // Apres la cloture, la prise de poste ne s'impose plus (11/09/2026,
  // arbitrage C.3). L'employee qui vient de pointer son depart n'a plus de
  // service courant : l'ancien contrat la renvoyait aussitot vers
  // "Quel est votre role pour ce quart ?", comme ecran principal. Elle vient
  // de partir ; on ne lui redemande pas de reprendre. Reprendre un poste
  // reste possible, mais par une action volontaire, jamais par une
  // redirection automatique.
  return !(await nexusDepartPointeAujourdhui(employee));}

/**
 * L'employe a-t-il deja pointe son depart aujourd'hui ?
 *
 * Sert aux DEUX portes qui menaient a la prise de poste : celle de
 * nexusPriseDePosteManquante, et celle de NEXUS-App-v1.html. La premiere
 * seule avait ete corrigee le 11/09/2026, et l'ecran d'accueil continuait a
 * rediriger : une correction posee sur une porte quand il y en a deux ne
 * corrige rien, elle deplace l'endroit ou l'on se cogne.
 *
 * En cas d'erreur de lecture : false, donc ancien contrat conserve. On ne
 * relache pas une porte parce qu'on n'a pas pu la lire.
 */
async function nexusDepartPointeAujourdhui(employee){
  if(!employee||!employee.id)return false;
  const journee = nexusDateLocaleISO(new Date());
  const { data, error } = await nexusClient
    .from('pointages').select('id')
    .eq('employee_id', employee.id).eq('date', journee).eq('type', 'depart').limit(1);
  if(error){
    console.error('Depart du jour : lecture impossible \u2014', error);
    return false;
  }
  return !!(data && data.length);}
async function nexusLogout(){await nexusClient.auth.signOut();window.location.href="index.html";}
function nexusQuitterConsultation(){localStorage.removeItem('nexus_site_consulte_createur');window.location.href="NEXUS-App-v1.html";}
