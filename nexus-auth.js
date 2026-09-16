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
// ════════════════════════════════════════════════════════════════════
// RÈGLE D'ACCÈS — L'AUTHENTIFICATION N'EST JAMAIS UNE PREUVE DE PRÉSENCE
// (16/09/2026)
//
//   « L'authentification n'est jamais une preuve de présence.
//
//     La navigation dans NEXUS, la consultation du Cockpit ou l'accès à
//     l'espace personnel ne doivent créer ni service, ni shift, ni
//     pointage, ni retard, ni variable de paie.
//
//     Après connexion et avant toute prise de poste, NEXUS présente deux
//     chemins distincts :
//       1. Consulter NEXUS — navigation sans preuve de présence ;
//       2. Commencer mon service — action explicite créant le service
//          opérationnel.
//
//     Aucun service ne peut être créé implicitement par le login, le
//     chargement d'un écran, une redirection ou la consultation d'une
//     donnée.
//
//     Cette règle s'applique aux employés comme aux managers. »
//
// CE QUE LA RÈGLE CORRIGE. Jusqu'au 16/09/2026, `nexusRequireAuth()` — la
// porte unique des 52 écrans authentifiés — traitait TOUTE page de la même
// façon : pas de service courant ⇒ renvoi vers la prise de poste. Un
// employé qui voulait seulement relire ses écarts validés devait donc
// d'abord ouvrir un service, et la simple consultation fabriquait la
// preuve de présence qu'elle n'aurait jamais dû produire. La garde n'était
// pas mal placée — elle est bien centralisée depuis S-4 — elle était trop
// LARGE : elle confondait « consulter ses propres données » et « agir sur
// le terrain ».
//
// POURQUOI UNE LISTE EN DUR. La catégorie d'un écran est une propriété de
// l'écran, jamais une donnée de la requête : aucun paramètre d'URL, aucun
// champ de formulaire, aucune valeur de `localStorage` n'entre dans
// `nexusCategorieAcces()`. Un utilisateur qui modifierait sa requête ne
// peut pas se déclarer « en consultation » sur un écran opérationnel.
//
// CE QUE CETTE CLASSIFICATION N'EST PAS. Ce n'est pas une autorisation
// d'accès aux données. Elle ne décide que d'une REDIRECTION de navigation.
// L'autorisation reste entièrement du côté Supabase — RLS et `auth.uid()`
// — et ne dépend d'aucune valeur venue du navigateur. Relâcher la
// redirection ne rend pas une ligne de plus.
//
// PAR DÉFAUT, UN ÉCRAN NON CLASSÉ EST OPÉRATIONNEL : l'oubli conserve
// l'ancien contrat au lieu de l'ouvrir. `test_acces_hors_service_20260916.js`
// vérifie de surcroît que les quatre listes couvrent TOUS les écrans du
// dépôt, pour qu'un écran nouveau soit classé sciemment, pas par défaut.
// ════════════════════════════════════════════════════════════════════
/* NEXUS-ACCES-REGLE:DEBUT — bloc pur, extrait et exécuté tel quel par les épreuves */
const NEXUS_PAGES_SEQUENCE_OBLIGATOIRE=['NEXUS-Pointage-v1.html','NEXUS-Prise-De-Poste-v1.html'];

// CONSULTATION — l'employé y lit ce qui le concerne, le manager y pilote et
// y administre. Aucun de ces écrans n'exige d'être en service : les ouvrir
// ne crée ni service, ni shift, ni pointage, ni retard, ni variable de paie.
const NEXUS_PAGES_CONSULTATION = [
  // Espace personnel de l'employé + accueil (qui porte les deux chemins).
  'NEXUS-App-v1.html',
  'NEXUS-Mon-Evolution-v1.html',
  'NEXUS-Mon-Planning-v1.html',
  'NEXUS-Progression-v1.html',
  'NEXUS-Apprentissage-v1.html',
  'NEXUS-Boite-Reception-v1.html',
  'NEXUS-Documentation-v1.html',
  // Pilotage et contrôle du manager — nommés par l'arbitrage du 16/09/2026 :
  // « le manager doit pouvoir consulter le Cockpit, contrôler Verify,
  // regarder les carburants, consulter les employés, analyser les résultats,
  // effectuer une tâche administrative, sans être automatiquement considéré
  // comme présent ou en service. »
  'NEXUS-Cockpit-v2.html',
  'NEXUS-Verify-v1.html',
  'NEXUS-Carburants-Pilotage-v1.html',
  'NEXUS-Resultats-Equipe-v1.html',
  'NEXUS-Evaluation-Employe-v1.html',
  'NEXUS-Analyse-Ecarts-v1.html',
  'NEXUS-FDJ-Analyse-v1.html',
  'NEXUS-Centre-Intelligence-v1.html',
  'NEXUS-Radar-Manager-v1.html',
  'NEXUS-Capital-v1.html',
  'NEXUS-Rapport-v1.html',
  'NEXUS-Journal-v1.html',
  'NEXUS-Tracabilite-v1.html',
  // Tâches administratives.
  'NEXUS-Planning-v1.html',
  'NEXUS-Assignations-v1.html',
  'NEXUS-Paye-v1.html',
  'NEXUS-Campagne-v1.html',
  'NEXUS-Import-v1.html',
  'NEXUS-Admin-API-v1.html',
  'NEXUS-Admin-Sites-v1.html',
  'NEXUS-Parametres-Station-v1.html',
  'NEXUS-Parametres-Inventaire-v1.html',
  'NEXUS-Parametres-Rappels-v1.html',
  'NEXUS-Parametres-Comptes-Clients-v1.html',
  'NEXUS-FDJ-Parametres-v1.html',
  'NEXUS-Debug-v1.html',
  'NEXUS-Debug-Createur-v1.html',
];

// OPÉRATIONNEL — le geste de terrain d'un quart. La garde reste ENTIÈRE :
// ces écrans continuent d'exiger un service ouvert et le pointage d'arrivée.
// C'est la moitié de l'arbitrage qu'il ne faut pas perdre de vue : dissocier
// n'est pas désarmer.
const NEXUS_PAGES_OPERATIONNELLES = [
  'NEXUS-Missions-v1.html',
  'NEXUS-Brief-v1.html',
  'NEXUS-Inventaire-v1.html',
  'NEXUS-Inventaire-Manager-v1.html',
  'NEXUS-Scanner-v1.html',
  'NEXUS-Scanner-Stock-v1.html',
  'NEXUS-Stock-Localise-v1.html',
  'NEXUS-Rayon-v1.html',
  'NEXUS-Produits-v1.html',
  'NEXUS-Carburants-v1.html',
  'NEXUS-Carburant-Reception-v1.html',
  'NEXUS-FDJ-v1.html',
  'NEXUS-FDJ-Manager-v1.html',
  'NEXUS-Coach-FDJ-v1.html',
  'NEXUS-Comptes-Clients-v1.html',
  'NEXUS-Tempo-v1.html',
];

// PUBLIQUES — aucune session n'y est exigée : elles n'appellent pas
// `nexusRequireAuth()`. Elles ne sont listées que pour qu'aucun écran du
// dépôt n'échappe au classement, et donc à la relecture.
const NEXUS_PAGES_PUBLIQUES = [
  'NEXUS-Login-v1.html',
  'NEXUS-Home-Concept-v1.html',
  'NEXUS-API-v1.html',
  'NEXUS-CGU-v1.html',
  'NEXUS-Confidentialite-v1.html',
  'NEXUS-Mentions-Legales-v1.html',
  'NEXUS-FAQ-v1.html',
  'NEXUS-Feuille-de-Route-v1.html',
  'NEXUS-Propos-v1.html',
];

/**
 * À quelle catégorie d'accès appartient cet écran ?
 *
 * 'sequence'     — les deux écrans du parcours de prise de poste eux-mêmes ;
 *                  les garder gardés provoquerait une boucle de redirection.
 * 'consultation' — lecture de ses propres données, pilotage, administration.
 * 'publique'     — pas de session exigée.
 * 'operationnel' — geste de terrain : la garde s'applique. C'est AUSSI le
 *                  défaut, pour qu'un écran oublié reste fermé.
 */
function nexusCategorieAcces(page){
  if(NEXUS_PAGES_SEQUENCE_OBLIGATOIRE.includes(page))return 'sequence';
  if(NEXUS_PAGES_CONSULTATION.includes(page))return 'consultation';
  if(NEXUS_PAGES_PUBLIQUES.includes(page))return 'publique';
  return 'operationnel';
}

/**
 * Cet écran exige-t-il un service opérationnel ouvert ?
 *
 * LA question des trois portes — celle de la prise de poste, celle du
 * pointage d'arrivée, et celle de l'accueil. Elles posaient la même question
 * de trois façons ; elles la posent désormais une seule fois, ici.
 */
function nexusPageExigeServiceOperationnel(page){
  return nexusCategorieAcces(page) === 'operationnel';
}
/* NEXUS-ACCES-REGLE:FIN */
async function nexusPointageArriveeManquant(employee){const page=window.location.pathname.split('/').pop();if(!nexusPageExigeServiceOperationnel(page)||employee.consultation_externe)return false;const siteId=employee.site_id;const manager=employee.role==='manager'||employee.role==='gerant';const {data:config}=await nexusClient.from('station_config').select('pointage_actif, manager_pointage_requis').eq('site',siteId).maybeSingle();if(config&&config.pointage_actif===false)return false;if(manager&&(!config||!config.manager_pointage_requis))return false;const d=new Date();const today=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const {data:arrivee,error}=await nexusClient.from('pointages').select('id').eq('employee_id',employee.id).eq('date',today).eq('type','arrivee').maybeSingle();if(error){console.error('Vérification pointage arrivée:',error);return false;}return !arrivee;}
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
  // borne SQL calculee dans le fuseau du site. Ce n'est PAS faute de donnee :
  // `sites.timezone` EXISTE en Production — la migration 20260905131500 y est
  // inscrite depuis le 05/09/2026. Une version anterieure de ce commentaire
  // affirmait le contraire ; c'etait faux, et un motif faux est pire qu'une
  // absence de motif, parce qu'il survit a sa propre peremption.
  //
  // Le vrai motif : la station est sur site avec ses employes, aucun quart n'y
  // franchit minuit (le quart 2 finit au plus tard a 22 h 10), et c'est deja
  // la regle que l'ecran de pointage applique. Deux definitions de la journee
  // pour un meme employe seraient pires qu'une definition imparfaite.
  //
  // Ce qui ferait tomber ce choix et imposerait la borne SQL : un quart a
  // cheval sur minuit, ou un appareil hors du fuseau de sa station.
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

async function nexusPriseDePosteManquante(employee){const page=window.location.pathname.split('/').pop();if(!nexusPageExigeServiceOperationnel(page)||employee.consultation_externe)return false;const manager=employee.role==='manager'||employee.role==='gerant';if(manager)return false;// S-4 / Q2 : la porte d'accès regarde le service RÉELLEMENT actif, plus
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
 * Servait aux DEUX portes qui menaient a la prise de poste : celle de
 * nexusPriseDePosteManquante, et celle de NEXUS-App-v1.html. La premiere
 * seule avait ete corrigee le 11/09/2026, et l'ecran d'accueil continuait a
 * rediriger : une correction posee sur une porte quand il y en a deux ne
 * corrige rien, elle deplace l'endroit ou l'on se cogne.
 *
 * 16/09/2026 : il y en avait TROIS, et la porte de l'accueil a ete supprimee
 * — l'accueil est un ecran de consultation. Cette fonction n'a donc plus
 * qu'UN appelant, nexusPriseDePosteManquante. On l'ecrit ici parce qu'un
 * motif faux survit a sa propre peremption : « sert aux deux portes » etait
 * vrai le 11/09 et ne l'est plus.
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
