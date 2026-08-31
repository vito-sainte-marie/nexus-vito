// NEXUS Inventaire V2 — Transfert interne directement depuis Stock par emplacement
(function () {
  'use strict';
  if ((window.location.pathname.split('/').pop() || '') !== 'NEXUS-Stock-Localise-v1.html') return;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  let ctx = null;

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  async function chargerContexte() {
    const { data: { session } } = await nexusClient.auth.getSession();
    if (!session) return null;
    const { data: employee } = await nexusClient.from('employees')
      .select('id,role,site_id').eq('id', session.user.id).maybeSingle();
    if (!employee || !['manager','gerant'].includes(employee.role)) return null;

    const { data: quarts } = await nexusClient.from('inventaire_quarts')
      .select('id,quart,statut,ouvert_le,created_at')
      .eq('site', employee.site_id).eq('date', todayISO())
      .in('statut', ['ouverture_en_cours','ouvert'])
      .order('ouvert_le', { ascending:false, nullsFirst:false }).limit(1);

    const quart = quarts && quarts[0] ? quarts[0] : null;
    return { employee, quart };
  }

  async function donneesCategorie(categorieId) {
    const site = ctx.employee.site_id;
    const [p,z,m] = await Promise.all([
      nexusClient.from('inventaire_zone_produit')
        .select('id,designation,categorie_id,actif')
        .eq('site',site).eq('categorie_id',categorieId).eq('actif',true).order('designation'),
      nexusClient.from('inventaire_zones').select('id,code,nom,ordre_affichage').eq('site',site).order('ordre_affichage'),
      nexusClient.from('inventaire_categories_zones_stock').select('zone_id,ordre,actif')
        .eq('site',site).eq('categorie_id',categorieId).eq('actif',true).order('ordre')
    ]);
    for (const r of [p,z,m]) if (r.error) throw r.error;
    const zoneById = Object.fromEntries((z.data||[]).map(x => [x.id,x]));
    const zones = (m.data||[]).map(x => zoneById[x.zone_id]).filter(Boolean);
    return { produits:p.data||[], zones };
  }

  async function stockConnu(produitId, zoneId) {
    const site = ctx.employee.site_id;
    const { data: releve, error } = await nexusClient.from('inventaire_stock_localise_releves')
      .select('quantite_base,releve_le')
      .eq('site',site).eq('produit_id',produitId).eq('zone_id',zoneId)
      .order('releve_le',{ascending:false}).limit(1).maybeSingle();
    if (error) throw error;
    if (!releve) return null;

    const { data: mouvements, error: errMv } = await nexusClient.from('inventaire_mouvements')
      .select('quantite,zone_source_id,zone_destination_id,cree_le,statut_validation')
      .eq('site',site).eq('produit_id',produitId).eq('type_mouvement','transfert')
      .gt('cree_le',releve.releve_le).order('cree_le',{ascending:true});
    if (errMv) throw errMv;
    let q = Number(releve.quantite_base)||0;
    for (const mv of mouvements||[]) {
      if (mv.statut_validation && mv.statut_validation !== 'valide') continue;
      const d = Number(mv.quantite)||0;
      if (mv.zone_source_id === zoneId) q -= d;
      if (mv.zone_destination_id === zoneId) q += d;
    }
    return { q, at:releve.releve_le };
  }

  function installerStyle() {
    if (document.getElementById('nexusStockTransferStyle')) return;
    const s = document.createElement('style');
    s.id = 'nexusStockTransferStyle';
    s.textContent = `
      #nexusStockTransferBtn{border-color:rgba(79,195,217,.34);color:#c9f7ff;background:rgba(79,195,217,.07)}
      #nexusStockTransferModal{position:fixed;inset:0;z-index:650;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(5,9,13,.82)}
      #nexusStockTransferModal.actif{display:flex}
      .nst-card{width:min(560px,100%);max-height:90vh;overflow:auto;background:#141B22;border:1px solid #2a3540;border-radius:16px;padding:18px;box-shadow:0 22px 70px rgba(0,0,0,.45)}
      .nst-title{font-size:19px;font-weight:700;margin-bottom:4px}.nst-sub{font-size:12px;line-height:1.45;color:#8A96A5;margin-bottom:14px}
      .nst-label{font-size:10px;color:#8A96A5;margin:10px 0 5px;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em}
      .nst-input{width:100%;background:#1A222C;border:1px solid #2a3540;border-radius:9px;padding:10px 11px;color:#EDF1F5;font-size:13px}
      .nst-grid{display:grid;grid-template-columns:1fr 42px 1fr;gap:8px;align-items:end}.nst-swap{height:42px;border-radius:50%;border:1px solid rgba(79,195,217,.3);background:rgba(79,195,217,.08);color:#4FC3D9;font-size:17px}
      .nst-stock{margin-top:8px;padding:10px 11px;border:1px solid rgba(79,195,217,.18);border-radius:10px;background:rgba(79,195,217,.045);font-size:11.5px;line-height:1.45;color:#8A96A5}.nst-stock b{color:#EDF1F5}.nst-stock.warn{border-color:rgba(245,166,35,.3);color:#F5A623}
      .nst-qty{display:grid;grid-template-columns:1fr 1fr;gap:8px}.nst-actions{display:flex;gap:8px;margin-top:16px}.nst-btn{flex:1;border-radius:10px;padding:11px 13px;border:1px solid #2a3540;background:transparent;color:#8A96A5;font-weight:600}.nst-btn.primary{background:#4FC3D9;border-color:#4FC3D9;color:#04141a}.nst-btn:disabled{opacity:.42}
      @media(max-width:620px){.nst-grid{grid-template-columns:1fr}.nst-swap{width:42px;justify-self:center;transform:rotate(90deg)}.nst-qty{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function creerUI() {
    if (document.getElementById('nexusStockTransferBtn')) return true;
    const actions = document.querySelector('.actions');
    const categorie = document.getElementById('categorie');
    if (!actions || !categorie) return false;

    installerStyle();
    const btn = document.createElement('button');
    btn.type='button'; btn.id='nexusStockTransferBtn'; btn.className='btn'; btn.textContent='↔ Transfert interne';
    const ref = document.getElementById('btnAnnuler');
    actions.insertBefore(btn, ref || null);

    const modal = document.createElement('div');
    modal.id='nexusStockTransferModal';
    modal.innerHTML = `<div class="nst-card">
      <div class="nst-title">Transfert interne</div>
      <div class="nst-sub">Déplacez un stock réel d’un emplacement à un autre. NEXUS conserve le même stock global et refuse un transfert supérieur au stock connu au départ.</div>
      <div id="nstQuart" class="nst-stock"></div>
      <div class="nst-label">Produit</div><select id="nstProduit" class="nst-input"></select>
      <div class="nst-grid">
        <div><div class="nst-label">Depuis</div><select id="nstSource" class="nst-input"></select></div>
        <button type="button" id="nstSwap" class="nst-swap">⇄</button>
        <div><div class="nst-label">Vers</div><select id="nstDestination" class="nst-input"></select></div>
      </div>
      <div id="nstStock" class="nst-stock">Sélectionnez un produit et un emplacement.</div>
      <div class="nst-qty">
        <div><div class="nst-label">Quantité</div><input id="nstQuantite" class="nst-input" type="number" min="0.01" step="1" inputmode="decimal" value="1"></div>
        <div><div class="nst-label">Unité saisie</div><select id="nstUnite" class="nst-input"><option value="paquet">Paquet / unité</option><option value="cartouche">Cartouche</option><option value="carton">Carton</option><option value="caisse">Caisse</option></select></div>
      </div>
      <div id="nstFacteurBloc" style="display:none"><div class="nst-label">Unités par conditionnement</div><input id="nstFacteur" class="nst-input" type="number" min="1" step="1" value="10"></div>
      <div class="nst-label">Note facultative</div><input id="nstNote" class="nst-input" type="text" placeholder="Ex. réassort caisse depuis le bureau">
      <div class="nst-actions"><button type="button" id="nstFermer" class="nst-btn">Annuler</button><button type="button" id="nstValider" class="nst-btn primary">Enregistrer le transfert</button></div>
    </div>`;
    document.body.appendChild(modal);

    const produit = modal.querySelector('#nstProduit'), source = modal.querySelector('#nstSource'), dest = modal.querySelector('#nstDestination');
    const unite = modal.querySelector('#nstUnite'), facteur = modal.querySelector('#nstFacteur'), qte = modal.querySelector('#nstQuantite');
    const stockBox = modal.querySelector('#nstStock'), valider = modal.querySelector('#nstValider');
    let data = {produits:[],zones:[]};

    async function actualiserStock() {
      if (!produit.value || !source.value || !dest.value) return;
      try {
        const [s,d] = await Promise.all([stockConnu(produit.value,source.value), stockConnu(produit.value,dest.value)]);
        if (!s || !d) {
          const manque=[]; if(!s) manque.push('départ'); if(!d) manque.push('destination');
          stockBox.className='nst-stock warn';
          stockBox.innerHTML=`Stock ${manque.join(' et ')} non initialisé. Faites d’abord un relevé physique ou un contrôle ciblé sur ce produit.`;
          valider.disabled=true; return;
        }
        stockBox.className='nst-stock';
        stockBox.innerHTML=`Stock réel connu au départ : <b>${s.q}</b> unité(s). Destination : <b>${d.q}</b>. Le total global restera inchangé.`;
        valider.disabled = !ctx.quart || s.q <= 0;
        stockBox.dataset.stockSource=String(s.q);
      } catch(e){console.error(e);stockBox.className='nst-stock warn';stockBox.textContent='Stock indisponible.';valider.disabled=true;}
    }

    function majConditionnement(){
      const cond=unite.value!=='paquet'; modal.querySelector('#nstFacteurBloc').style.display=cond?'block':'none';
      if(unite.value==='cartouche' && (!facteur.value || Number(facteur.value)===1)) facteur.value='10';
    }

    async function ouvrir() {
      const catId = categorie.value;
      if (!catId) return;
      data = await donneesCategorie(catId);
      produit.innerHTML = data.produits.map(p=>`<option value="${p.id}">${esc(p.designation)}</option>`).join('');
      const opts=data.zones.map(z=>`<option value="${z.id}">${esc(z.nom)}</option>`).join(''); source.innerHTML=opts; dest.innerHTML=opts;
      const bureau=data.zones.find(z=>z.code==='bureau'), boutique=data.zones.find(z=>z.code==='boutique');
      if(bureau) source.value=bureau.id; if(boutique) dest.value=boutique.id;
      if(source.value===dest.value && data.zones.length>1) dest.value=data.zones.find(z=>z.id!==source.value).id;
      modal.querySelector('#nstQuart').innerHTML = ctx.quart ? `Quart actif : <b>${esc(ctx.quart.quart||'quart en cours')}</b>` : 'Aucun quart actif : ouvrez un quart avant d’enregistrer un transfert.';
      valider.disabled=!ctx.quart;
      modal.classList.add('actif'); majConditionnement(); await actualiserStock();
    }

    btn.addEventListener('click',()=>ouvrir().catch(e=>console.error('Transfert stock localisé:',e)));
    modal.querySelector('#nstFermer').addEventListener('click',()=>modal.classList.remove('actif'));
    modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('actif')});
    modal.querySelector('#nstSwap').addEventListener('click',()=>{const v=source.value;source.value=dest.value;dest.value=v;actualiserStock()});
    [produit,source,dest].forEach(el=>el.addEventListener('change',actualiserStock));
    unite.addEventListener('change',()=>{majConditionnement();actualiserStock()}); facteur.addEventListener('input',actualiserStock);

    valider.addEventListener('click', async()=>{
      if (!ctx.quart || !produit.value || !source.value || !dest.value || source.value===dest.value) return;
      const saisie=Number(qte.value); if(!(saisie>0)) return alert('Saisissez une quantité supérieure à 0.');
      const cond=unite.value!=='paquet'; const f=cond?Math.max(1,Number(facteur.value)||1):1; const base=saisie*f;
      const connu=Number(stockBox.dataset.stockSource);
      if(Number.isFinite(connu) && base>connu) return alert(`Stock insuffisant au départ : ${connu} unité(s) connues.`);
      valider.disabled=true; valider.textContent='Enregistrement…';
      const { data: result, error } = await nexusClient.rpc('inventaire_enregistrer_transfert_localise',{
        p_site:ctx.employee.site_id,p_quart_id:ctx.quart.id,p_produit_id:produit.value,
        p_zone_source_id:source.value,p_zone_destination_id:dest.value,p_quantite_base:base,
        p_unite_saisie:unite.value,p_quantite_saisie:saisie,p_facteur_conditionnement:f,
        p_justification:modal.querySelector('#nstNote').value.trim()||null
      });
      if(error){
        console.error(error); const msg=String(error.message||'');
        if(msg.includes('STOCK_SOURCE_INSUFFISANT')) alert('Transfert refusé : le stock réel disponible au départ est insuffisant.');
        else if(msg.includes('STOCK_SOURCE_NON_INITIALISE')||msg.includes('STOCK_DESTINATION_NON_INITIALISE')) alert('Transfert refusé : le produit doit d’abord être relevé physiquement dans les deux emplacements.');
        else alert('Le transfert n’a pas pu être enregistré.');
        valider.disabled=false; valider.textContent='Enregistrer le transfert'; await actualiserStock(); return;
      }
      const r=result&&result[0];
      modal.querySelector('#nstNote').value='';
      alert(`Transfert enregistré${r ? ` · stock départ restant : ${r.stock_source_apres}` : ''}.`);
      location.reload();
    });
    return true;
  }

  async function init(){ctx=await chargerContexte();if(!ctx)return; if(creerUI())return; let n=0;const t=setInterval(()=>{n++;if(creerUI()||n>40)clearInterval(t)},150)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();