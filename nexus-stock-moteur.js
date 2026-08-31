// NEXUS Stock Engine — source centrale de lecture du stock.
// Principe : le stock réel et le stock théorique restent deux vérités distinctes.
// Aucun moteur NEXUS ne doit les additionner ni écraser l'une avec l'autre.
(function(){
  'use strict';

  function assertClient(){
    if(typeof nexusClient === 'undefined') throw new Error('NEXUS Stock Engine: nexusClient indisponible');
  }

  async function chargerEtat(site, options={}){
    assertClient();
    if(!site) throw new Error('NEXUS Stock Engine: site requis');

    let q=nexusClient
      .from('nexus_stock_etat')
      .select('*')
      .eq('site', site);

    if(options.actifsSeulement !== false) q=q.eq('actif', true);
    if(options.produitId) q=q.eq('produit_id', options.produitId);
    if(options.categorieId) q=q.eq('categorie_id', options.categorieId);
    if(options.natureReference) q=q.eq('stock_reference_nature', options.natureReference);

    const {data,error}=await q.order('designation',{ascending:true});
    if(error) throw error;
    return data || [];
  }

  async function chargerProduit(site, produitId){
    const rows=await chargerEtat(site,{produitId,actifsSeulement:false});
    return rows[0] || null;
  }

  function stockPourUsage(etat, politique='reference'){
    if(!etat) return {quantite:null,nature:'indisponible',source:null,date:null};

    if(politique==='reel'){
      return {
        quantite:etat.stock_reel,
        nature:etat.stock_reel == null ? 'indisponible' : 'reel',
        source:etat.stock_reel_source,
        date:etat.stock_reel_le
      };
    }

    if(politique==='theorique'){
      return {
        quantite:etat.stock_theorique,
        nature:etat.stock_theorique == null ? 'indisponible' : 'theorique',
        source:etat.stock_theorique_source,
        date:etat.stock_theorique_le
      };
    }

    return {
      quantite:etat.stock_reference,
      nature:etat.stock_reference_nature,
      source:etat.stock_reference_nature==='reel' ? etat.stock_reel_source : etat.stock_theorique_source,
      date:etat.stock_reference_nature==='reel' ? etat.stock_reel_le : etat.stock_theorique_le
    };
  }

  function comparer(etat){
    return {
      reel:etat?.stock_reel ?? null,
      theorique:etat?.stock_theorique ?? null,
      ecart:etat?.ecart_reel_theorique ?? null,
      comparable:etat?.stock_reel != null && etat?.stock_theorique != null
    };
  }

  window.NexusStock=Object.freeze({
    chargerEtat,
    chargerProduit,
    stockPourUsage,
    comparer,
    doctrine:Object.freeze({
      reel:'inventaire physique',
      theorique:'stock logiciel/importé',
      reference:'priorité au réel lorsqu’il existe, sans écraser le théorique'
    })
  });
})();
