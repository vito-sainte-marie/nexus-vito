// NEXUS Stock Engine — source centrale de lecture du stock.
// Principe : le stock réel et le stock théorique restent deux vérités distinctes.
// Aucun moteur NEXUS ne doit les additionner ni écraser l'une avec l'autre.
// V6 : lecture RPC unique + cache mémoire court partagé entre Cockpit/Conseiller/Radar.
(function(){
  'use strict';
  const RPC='nexus_stock_lire_etat';
  const CACHE_TTL_MS=15000;
  const cache=new Map();

  function assertClient(){
    if(typeof nexusClient==='undefined') throw new Error('NEXUS Stock Engine: nexusClient indisponible');
  }

  function filtrerLocal(data,options={}){
    let rows=Array.isArray(data)?data:[];
    if(options.actifsSeulement!==false) rows=rows.filter(r=>r.actif===true);
    if(options.produitId) rows=rows.filter(r=>String(r.produit_id)===String(options.produitId));
    if(options.categorieId) rows=rows.filter(r=>String(r.categorie_id)===String(options.categorieId));
    if(options.natureReference) rows=rows.filter(r=>r.stock_reference_nature===options.natureReference);
    return rows;
  }

  async function chargerBrut(site){
    const now=Date.now();
    const c=cache.get(site);
    if(c?.data && (now-c.at)<CACHE_TTL_MS) return c.data;
    if(c?.promise) return c.promise;

    const promise=(async()=>{
      const {data,error}=await nexusClient.rpc(RPC,{p_site:site});
      if(error) throw new Error(`NEXUS Stock Engine — lecture centrale indisponible (${error.message||error.code||'RPC'})`);
      const rows=(Array.isArray(data)?data:[]).map(normaliserEtat);
      cache.set(site,{data:rows,at:Date.now(),promise:null});
      return rows;
    })();
    cache.set(site,{data:c?.data||null,at:c?.at||0,promise});
    try{return await promise;}catch(e){cache.delete(site);throw e;}
  }

  async function chargerEtat(site,options={}){
    assertClient();
    if(!site) throw new Error('NEXUS Stock Engine: site requis');
    const rows=await chargerBrut(site);
    return filtrerLocal(rows,options);
  }

  async function chargerProduit(site,produitId){
    const rows=await chargerEtat(site,{produitId,actifsSeulement:false});
    return rows[0]||null;
  }

  function invaliderCache(site){ if(site) cache.delete(site); else cache.clear(); }

  function normaliserEtat(etat){
    if(!etat) return etat;
    return {
      ...etat,
      stock_reel_observe:etat.stock_reel_observe??etat.stock_reel??null,
      stock_reel_observe_le:etat.stock_reel_observe_le??etat.stock_reel_le??null,
      ecart_brut_non_aligne:etat.ecart_brut_non_aligne??etat.ecart_reel_theorique??null,
      comparaison_fiable:etat.comparaison_fiable===true,
      ecart_reference:Object.prototype.hasOwnProperty.call(etat,'ecart_reference')?etat.ecart_reference:null,
      stock_reference_le:etat.stock_reference_le??(etat.stock_reference_nature==='reel'?etat.stock_reel_le:etat.stock_theorique_le)??null,
      stock_reference_confiance:etat.stock_reference_confiance??(etat.stock_reference_nature==='reel'?'non_evaluee':etat.stock_reference_nature==='theorique'?'theorique':'insuffisante'),
      stock_reference_statut:etat.stock_reference_statut??(etat.stock_reference_nature==='reel'?'observe':etat.stock_reference_nature==='theorique'?'theorique_seul':'indisponible'),
      transferts_internes_integres:etat.transferts_internes_integres===true
    };
  }

  function stockPourUsage(etat,politique='reference'){
    etat=normaliserEtat(etat);
    if(!etat) return {quantite:null,nature:'indisponible',source:null,date:null,confiance:'insuffisante'};
    if(politique==='reel') return {quantite:etat.stock_reel_observe,nature:etat.stock_reel_observe==null?'indisponible':'reel',source:etat.stock_reel_source,date:etat.stock_reel_observe_le,confiance:etat.stock_reference_nature==='reel'?etat.stock_reference_confiance:'non_evaluee',transfertsInternesIntegres:etat.transferts_internes_integres};
    if(politique==='theorique') return {quantite:etat.stock_theorique,nature:etat.stock_theorique==null?'indisponible':'theorique',source:etat.stock_theorique_source,date:etat.stock_theorique_le,confiance:etat.stock_theorique==null?'insuffisante':'theorique',transfertsInternesIntegres:false};
    return {quantite:etat.stock_reference,nature:etat.stock_reference_nature,source:etat.stock_reference_nature==='reel'?etat.stock_reel_source:etat.stock_theorique_source,date:etat.stock_reference_le,confiance:etat.stock_reference_confiance,statut:etat.stock_reference_statut,transfertsInternesIntegres:etat.stock_reference_nature==='reel'&&etat.transferts_internes_integres};
  }

  function comparer(etat){
    etat=normaliserEtat(etat);
    if(!etat) return {reel:null,theorique:null,ecart:null,ecartBrut:null,comparable:false,raison:'donnee_absente'};
    const deux=etat.stock_reel_observe!=null&&etat.stock_theorique!=null;
    return {reel:etat.stock_reel_observe,reelLe:etat.stock_reel_observe_le,theorique:etat.stock_theorique,theoriqueLe:etat.stock_theorique_le,ecart:etat.comparaison_fiable?etat.ecart_reference:null,ecartBrut:etat.ecart_brut_non_aligne,comparable:deux&&etat.comparaison_fiable,deltaSecondes:etat.delta_t_secondes??null,raison:!deux?'source_manquante':etat.comparaison_fiable?'aligne_temporellement':'horodatages_non_alignes'};
  }

  function expliquer(etat){
    etat=normaliserEtat(etat);
    if(!etat) return {titre:'Stock indisponible',detail:'Aucune source de stock exploitable.',niveau:'insuffisant'};
    const c=comparer(etat);
    if(etat.stock_reference_nature==='indisponible') return {titre:'Stock indisponible',detail:'Ni inventaire physique ni stock théorique rapproché.',niveau:'insuffisant'};
    if(etat.stock_reference_nature==='reel'&&etat.stock_theorique==null) return {titre:'Stock réel disponible',detail:etat.transferts_internes_integres?'Inventaire physique disponible. Les transferts internes postérieurs sont intégrés sans modifier le total global.':'Inventaire physique disponible. Aucun stock théorique n’est actuellement rapproché.',niveau:etat.stock_reference_confiance};
    if(etat.stock_reference_nature==='theorique') return {titre:'Stock théorique uniquement',detail:'Aucun inventaire physique exploitable. NEXUS conserve la valeur importée comme théorie, sans la présenter comme stock réel.',niveau:'theorique'};
    if(c.comparable) return {titre:'Réel et théorique comparables',detail:'Les deux mesures sont suffisamment proches dans le temps pour interpréter leur écart.',niveau:etat.stock_reference_confiance};
    return {titre:'Deux stocks, mais comparaison provisoire',detail:'Le réel et le théorique existent, mais leurs horodatages sont trop éloignés. NEXUS ne transforme pas l’écart brut en anomalie.',niveau:etat.stock_reference_confiance};
  }

  // Compatibilité avec l'ancien Conseiller Cockpit : il attend un tableau par rayon.
  // Aucun rayon n'est remonté tant que l'écart réel/théorique n'est pas fiable.
  function calculerAnalyseStock(releves=[],ventes=[],controles=[]){
    const rows=Array.isArray(releves)?releves:[];
    return {
      rows,
      total:rows.length,
      avecStockReel:rows.filter(r=>(r.stock_reel_observe??r.stock_reel??null)!=null).length,
      avecStockTheorique:rows.filter(r=>r.stock_theorique!=null).length,
      comparables:rows.filter(r=>r.comparaison_fiable===true).length,
      ventes:Array.isArray(ventes)?ventes.length:0,
      controles:Array.isArray(controles)?controles.length:0
    };
  }

  function calculerRisqueParRayon(analyse){
    const rows=Array.isArray(analyse)?analyse:Array.isArray(analyse?.rows)?analyse.rows:[];
    const groupes=new Map();
    for(const r of rows){
      if(r.comparaison_fiable!==true || r.ecart_reference==null || Math.abs(Number(r.ecart_reference))<=0.001) continue;
      const categorie=r.categorie||'Sans catégorie';
      if(!groupes.has(categorie)) groupes.set(categorie,{categorie,nbAVerifier:0,risqueEur:0});
      const g=groupes.get(categorie);
      g.nbAVerifier++;
    }
    return [...groupes.values()].sort((a,b)=>b.nbAVerifier-a.nbAVerifier || a.categorie.localeCompare(b.categorie,'fr'));
  }

  window.NexusStock=Object.freeze({chargerEtat,chargerProduit,invaliderCache,stockPourUsage,comparer,expliquer,normaliserEtat,calculerAnalyseStock,calculerRisqueParRayon,doctrine:Object.freeze({reel:'inventaire physique observé et horodaté',theorique:'stock logiciel/importé, conservé séparément',reference:'priorité au réel lorsqu’il existe, sans écraser le théorique',transfert:'un transfert interne déplace le réel entre lieux ; il ne crée ni ne détruit du stock global',ecart:'un écart ne devient décisionnel que si réel et théorique sont temporellement comparables',import:'un nouvel import actualise le théorique uniquement ; il ne remplace jamais le réel'})});
})();
