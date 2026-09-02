// NEXUS Inventaire V2 — Transferts internes
// Déplace un stock entre deux lieux sans modifier le stock global.
// Exemple station : Bureau <-> Boutique. Le moteur reste générique pour tout site.
(function (global) {
  'use strict';

  const PAGE = 'NEXUS-Inventaire-v1.html';
  const ROLES_AUTORISES = new Set(['manager', 'gerant']);

  function aujourdHuiISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function echapper(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  async function contexte() {
    const { data: { session } } = await nexusClient.auth.getSession();
    if (!session) return null;
    const { data: employee } = await nexusClient.from('employees')
      .select('id, nom, role, site_id').eq('id', session.user.id).maybeSingle();
    if (!employee || !employee.site_id || !ROLES_AUTORISES.has(employee.role)) return null;

    const date = aujourdHuiISO();
    let { data: quarts } = await nexusClient.from('inventaire_quarts')
      .select('id, quart, statut, ouvert_le, created_at')
      .eq('site', employee.site_id).eq('date', date)
      .in('statut', ['ouverture_en_cours', 'ouvert'])
      .order('ouvert_le', { ascending: false, nullsFirst: false }).limit(1);
    if (!quarts || !quarts.length) {
      const r = await nexusClient.from('inventaire_quarts')
        .select('id, quart, statut, ouvert_le, created_at')
        .eq('site', employee.site_id).eq('date', date)
        .order('created_at', { ascending: false }).limit(1);
      quarts = r.data || [];
    }

    const [{ data: zones }, { data: produits }] = await Promise.all([
      nexusClient.from('inventaire_zones').select('id, code, nom').eq('site', employee.site_id).order('nom'),
      nexusClient.from('inventaire_zone_produit')
        .select('id, designation, actif, categorie_id, inventaire_categories(id, nom)')
        .eq('site', employee.site_id).eq('actif', true).order('designation')
    ]);

    return { employee, quart: quarts && quarts[0] ? quarts[0] : null, zones: zones || [], produits: produits || [] };
  }

  function optionsProduits(produits) {
    const groupes = new Map();
    produits.forEach(p => {
      const cat = p.inventaire_categories && p.inventaire_categories.nom ? p.inventaire_categories.nom : 'Autres';
      if (!groupes.has(cat)) groupes.set(cat, []);
      groupes.get(cat).push(p);
    });
    return Array.from(groupes.entries()).sort((a, b) => a[0].localeCompare(b[0], 'fr')).map(([cat, liste]) =>
      `<optgroup label="${echapper(cat)}">${liste.map(p => `<option value="${p.id}">${echapper(p.designation)}</option>`).join('')}</optgroup>`
    ).join('');
  }

  function creerUI(ctx) {
    if (document.getElementById('nexusTransfertInterneModal')) return;

    const style = document.createElement('style');
    style.textContent = `
      #nexusTransfertInterneModal{position:fixed;inset:0;z-index:500;background:rgba(5,9,13,.78);display:none;align-items:flex-end;justify-content:center;padding:12px}
      #nexusTransfertInterneModal.actif{display:flex}
      .nti-card{width:100%;max-width:460px;background:#141B22;border:1px solid #242E38;border-radius:16px;padding:18px;max-height:88vh;overflow:auto;color:#EDF1F5}
      .nti-titre{font-size:18px;font-weight:700;margin-bottom:4px}.nti-sub{font-size:12px;color:#8A96A5;line-height:1.45;margin-bottom:14px}
      .nti-label{font-size:11px;color:#8A96A5;margin:10px 0 5px}.nti-input{width:100%;background:#1A222C;border:1px solid #242E38;border-radius:9px;padding:11px;color:#EDF1F5;font-size:14px}
      .nti-row{display:flex;gap:8px;align-items:end}.nti-row>*{flex:1}.nti-swap{flex:none;width:42px;height:42px;border-radius:50%;border:1px solid rgba(79,195,217,.35);background:rgba(79,195,217,.08);color:#4FC3D9;font-size:18px}
      .nti-info{margin-top:9px;padding:9px 10px;border-radius:9px;background:rgba(79,195,217,.07);color:#8A96A5;font-size:11.5px;line-height:1.45}
      .nti-actions{display:flex;gap:8px;margin-top:16px}.nti-btn{flex:1;border-radius:10px;padding:12px;border:1px solid #242E38;background:transparent;color:#8A96A5;font-weight:600}.nti-btn.primary{background:#4FC3D9;color:#04141a;border-color:#4FC3D9}
      .nti-historique{margin-top:16px;padding-top:12px;border-top:1px solid #242E38}.nti-hist-item{font-size:11.5px;color:#8A96A5;padding:7px 0;border-bottom:1px solid rgba(36,46,56,.55)}.nti-hist-item b{color:#EDF1F5}
    `;
    document.head.appendChild(style);

    const btn = document.getElementById('nexusTransfertInterneBtn');
    const outils = document.getElementById('nexusOutilsStock');
    if (!btn || !outils) return;
    outils.hidden = false;

    const modal = document.createElement('div');
    modal.id = 'nexusTransfertInterneModal';
    const zoneOptions = ctx.zones.map(z => `<option value="${z.id}" data-code="${echapper(z.code)}">${echapper(z.nom)}</option>`).join('');
    modal.innerHTML = `
      <div class="nti-card">
        <div class="nti-titre">Transfert interne</div>
        <div class="nti-sub">Déplacer un produit d'un lieu à un autre. Le stock global ne change pas et le mouvement reste horodaté.</div>
        ${ctx.quart ? '' : '<div class="nti-info" style="color:#F5A623">Aucun quart du jour trouvé. Ouvrez un quart avant d’enregistrer un transfert.</div>'}
        <div class="nti-label">Produit</div>
        <select id="ntiProduit" class="nti-input">${optionsProduits(ctx.produits)}</select>
        <div class="nti-row">
          <div><div class="nti-label">Depuis</div><select id="ntiSource" class="nti-input">${zoneOptions}</select></div>
          <button id="ntiSwap" class="nti-swap" type="button" aria-label="Inverser">⇄</button>
          <div><div class="nti-label">Vers</div><select id="ntiDestination" class="nti-input">${zoneOptions}</select></div>
        </div>
        <div class="nti-row">
          <div><div class="nti-label">Quantité</div><input id="ntiQuantite" class="nti-input" type="number" min="0.01" step="1" inputmode="decimal" value="1"></div>
          <div><div class="nti-label">Unité saisie</div><select id="ntiUnite" class="nti-input"><option value="paquet">Paquet / unité</option><option value="cartouche">Cartouche</option><option value="carton">Carton</option><option value="caisse">Caisse</option></select></div>
        </div>
        <div id="ntiFacteurBloc" style="display:none"><div class="nti-label">Unités par conditionnement</div><input id="ntiFacteur" class="nti-input" type="number" min="1" step="1" value="10"></div>
        <div id="ntiResume" class="nti-info"></div>
        <div class="nti-label">Note facultative</div><input id="ntiJustification" class="nti-input" type="text" placeholder="Ex. surplus en caisse, retour au bureau…">
        <div class="nti-actions"><button id="ntiFermer" class="nti-btn" type="button">Annuler</button><button id="ntiValider" class="nti-btn primary" type="button" ${ctx.quart ? '' : 'disabled'}>Enregistrer</button></div>
        <div class="nti-historique"><div class="nti-label" style="margin-top:0">Derniers transferts du quart</div><div id="ntiHistorique">Chargement…</div></div>
      </div>`;
    document.body.appendChild(modal);

    const source = modal.querySelector('#ntiSource');
    const dest = modal.querySelector('#ntiDestination');
    const unite = modal.querySelector('#ntiUnite');
    const facteur = modal.querySelector('#ntiFacteur');
    const quantite = modal.querySelector('#ntiQuantite');
    const resume = modal.querySelector('#ntiResume');

    // Préférence ergonomique du site : Bureau -> Boutique quand ces deux zones existent.
    const bureau = ctx.zones.find(z => z.code === 'bureau');
    const boutique = ctx.zones.find(z => z.code === 'boutique');
    if (bureau) source.value = bureau.id;
    if (boutique) dest.value = boutique.id;
    if (source.value === dest.value && ctx.zones.length > 1) dest.value = ctx.zones.find(z => z.id !== source.value).id;

    function majResume() {
      const u = unite.value;
      const conditionne = u !== 'paquet';
      modal.querySelector('#ntiFacteurBloc').style.display = conditionne ? 'block' : 'none';
      if (u === 'cartouche' && (!facteur.value || Number(facteur.value) === 1)) facteur.value = '10';
      const q = Math.max(0, Number(quantite.value) || 0);
      const f = conditionne ? Math.max(1, Number(facteur.value) || 1) : 1;
      const total = q * f;
      const s = source.options[source.selectedIndex] ? source.options[source.selectedIndex].text : '—';
      const d = dest.options[dest.selectedIndex] ? dest.options[dest.selectedIndex].text : '—';
      resume.textContent = `${s} → ${d} · ${q || 0} ${u}${q > 1 ? 's' : ''}${conditionne ? ` = ${total} unités de stock` : ''}. Aucun impact sur le stock global.`;
    }

    async function chargerHistorique() {
      const zoneMap = Object.fromEntries(ctx.zones.map(z => [z.id, z.nom]));
      const produitMap = Object.fromEntries(ctx.produits.map(p => [p.id, p.designation]));
      const hist = modal.querySelector('#ntiHistorique');
      if (!ctx.quart) { hist.textContent = 'Aucun quart actif.'; return; }
      const { data, error } = await nexusClient.from('inventaire_mouvements')
        .select('id, produit_id, quantite, quantite_saisie, unite_saisie, facteur_conditionnement, zone_source_id, zone_destination_id, cree_le')
        .eq('site', ctx.employee.site_id).eq('quart_id', ctx.quart.id).eq('type_mouvement', 'transfert')
        .order('cree_le', { ascending: false }).limit(8);
      if (error) { hist.textContent = 'Historique indisponible.'; return; }
      if (!data || !data.length) { hist.textContent = 'Aucun transfert enregistré sur ce quart.'; return; }
      hist.innerHTML = data.map(m => {
        const heure = new Date(m.cree_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const qAff = m.quantite_saisie != null ? `${m.quantite_saisie} ${m.unite_saisie || 'unité'}` : `${m.quantite} unité(s)`;
        return `<div class="nti-hist-item"><b>${heure}</b> · ${echapper(produitMap[m.produit_id] || 'Produit')}<br>${echapper(zoneMap[m.zone_source_id] || '—')} → ${echapper(zoneMap[m.zone_destination_id] || '—')} · ${echapper(qAff)}</div>`;
      }).join('');
    }

    btn.addEventListener('click', () => { modal.classList.add('actif'); chargerHistorique(); majResume(); });
    modal.querySelector('#ntiFermer').addEventListener('click', () => modal.classList.remove('actif'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('actif'); });
    modal.querySelector('#ntiSwap').addEventListener('click', () => { const v = source.value; source.value = dest.value; dest.value = v; majResume(); });
    [source, dest, unite, facteur, quantite].forEach(el => el.addEventListener('input', majResume));

    modal.querySelector('#ntiValider').addEventListener('click', async () => {
      if (!ctx.quart) return;
      if (!source.value || !dest.value || source.value === dest.value) { alert('Choisissez deux lieux différents.'); return; }
      const qSaisie = Number(quantite.value);
      if (!(qSaisie > 0)) { alert('Saisissez une quantité supérieure à 0.'); return; }
      const estConditionnement = unite.value !== 'paquet';
      const facteurValeur = estConditionnement ? Math.max(1, Number(facteur.value) || 1) : 1;
      const qBase = qSaisie * facteurValeur;
      const produitId = modal.querySelector('#ntiProduit').value;
      if (!produitId) return;
      const valider = modal.querySelector('#ntiValider');
      valider.disabled = true; valider.textContent = 'Enregistrement…';
      const payload = {
        site: ctx.employee.site_id,
        quart_id: ctx.quart.id,
        produit_id: produitId,
        type_mouvement: 'transfert',
        quantite: qBase,
        employee_id: ctx.employee.id,
        justification: modal.querySelector('#ntiJustification').value.trim() || null,
        reason_code: 'transfert_interne',
        statut_validation: 'valide',
        valide_par: ctx.employee.id,
        valide_le: new Date().toISOString(),
        zone_source_id: source.value,
        zone_destination_id: dest.value,
        unite_saisie: unite.value,
        quantite_saisie: qSaisie,
        facteur_conditionnement: facteurValeur,
        idempotency_key: crypto.randomUUID()
      };
      const { error } = await nexusClient.from('inventaire_mouvements').insert(payload);
      if (error) {
        console.error('Transfert interne:', error);
        alert('Le transfert n’a pas pu être enregistré.');
      } else {
        const s = source.options[source.selectedIndex].text;
        const d = dest.options[dest.selectedIndex].text;
        alert(`Transfert enregistré : ${s} → ${d}.`);
        modal.querySelector('#ntiJustification').value = '';
        await chargerHistorique();
      }
      valider.disabled = false; valider.textContent = 'Enregistrer';
    });

    majResume();
  }

  async function installer() {
    if (!global.location || global.location.pathname.split('/').pop() !== PAGE) return;
    if (new URLSearchParams(global.location.search).has('test_role')) return;
    try {
      const ctx = await contexte();
      if (!ctx || ctx.zones.length < 2 || !ctx.produits.length) return;
      creerUI(ctx);
    } catch (e) {
      console.error('NEXUS transferts internes:', e);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installer, { once: true });
  else installer();
})(typeof window !== 'undefined' ? window : globalThis);
