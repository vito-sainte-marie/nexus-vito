// NEXUS Inventaire V2 — Contrôle ciblé du stock localisé
// Permet au manager de recompter une seule référence sur tous ses emplacements
// sans transformer ce contrôle en relevé complet de catégorie.
(function nexusStockControleCibleV2(global) {
  'use strict';

  const PAGE = 'NEXUS-Stock-Localise-v1.html';
  const ROLES = new Set(['manager', 'gerant']);
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  async function contexte() {
    const employee = await nexusRequireAuth();
    if (!employee || !ROLES.has(employee.role_reel || employee.role)) return null;
    const site = employee.site_id;
    const [cats, zones, maps, prods] = await Promise.all([
      nexusClient.from('inventaire_categories').select('id,nom,actif').eq('site', site).eq('actif', true).order('nom'),
      nexusClient.from('inventaire_zones').select('id,nom,code,ordre_affichage').eq('site', site).order('ordre_affichage'),
      nexusClient.from('inventaire_categories_zones_stock').select('categorie_id,zone_id,actif,ordre').eq('site', site).eq('actif', true).order('ordre'),
      nexusClient.from('inventaire_zone_produit').select('id,designation,categorie_id,actif').eq('site', site).eq('actif', true).order('designation')
    ]);
    for (const r of [cats, zones, maps, prods]) {
      if (r.error) throw r.error;
    }
    return { employee, site, categories: cats.data || [], zones: zones.data || [], mappings: maps.data || [], produits: prods.data || [] };
  }

  function zonesCategorie(ctx, categorieId) {
    const ids = ctx.mappings
      .filter(m => m.categorie_id === categorieId && m.actif !== false)
      .sort((a,b) => (a.ordre || 0) - (b.ordre || 0))
      .map(m => m.zone_id);
    return ids.map(id => ctx.zones.find(z => z.id === id)).filter(Boolean);
  }

  function injectStyle() {
    if ($('nexusControleCibleStyle')) return;
    const style = document.createElement('style');
    style.id = 'nexusControleCibleStyle';
    style.textContent = `
      #nexusControleCibleBtn{border-radius:10px;padding:11px 14px;border:1px solid rgba(79,195,217,.35);background:rgba(79,195,217,.06);color:#c9f7ff;font-weight:600;cursor:pointer}
      #nexusControleCibleModal{position:fixed;inset:0;z-index:520;background:rgba(5,9,13,.82);display:none;align-items:flex-end;justify-content:center;padding:12px}
      #nexusControleCibleModal.actif{display:flex}
      .ncc-card{width:100%;max-width:520px;max-height:90vh;overflow:auto;background:#141B22;border:1px solid #242E38;border-radius:16px;padding:18px;color:#EDF1F5}
      .ncc-eyebrow{font:600 9px 'IBM Plex Mono',monospace;letter-spacing:.12em;text-transform:uppercase;color:#4FC3D9}.ncc-title{font-size:19px;font-weight:700;margin:5px 0 4px}.ncc-sub{font-size:12px;line-height:1.45;color:#8A96A5;margin-bottom:14px}
      .ncc-label{font-size:10.5px;color:#8A96A5;margin:10px 0 5px}.ncc-input{width:100%;background:#1A222C;border:1px solid #242E38;border-radius:9px;padding:11px;color:#EDF1F5;font-size:14px}
      .ncc-zone{margin-top:10px;padding:12px;border:1px solid #242E38;border-radius:11px;background:#10161c}.ncc-zone-title{font-weight:700;font-size:12.5px;margin-bottom:8px}.ncc-counts{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ncc-mini{font:9px 'IBM Plex Mono',monospace;color:#57626F;margin-bottom:4px;text-align:center}
      .ncc-info{margin-top:11px;padding:9px 10px;border-radius:9px;border:1px solid rgba(79,195,217,.18);background:rgba(79,195,217,.05);color:#8A96A5;font-size:11.5px;line-height:1.45}.ncc-info b{color:#c9f7ff}
      .ncc-actions{display:flex;gap:8px;margin-top:16px}.ncc-btn{flex:1;border-radius:10px;padding:12px;border:1px solid #242E38;background:transparent;color:#8A96A5;font-weight:600;cursor:pointer}.ncc-btn.primary{background:#4FC3D9;border-color:#4FC3D9;color:#04141a}.ncc-btn:disabled{opacity:.45;cursor:not-allowed}
      .ncc-status{min-height:16px;margin-top:9px;font:10.5px 'IBM Plex Mono',monospace;color:#8A96A5}.ncc-status.err{color:#F5A623}.ncc-status.ok{color:#34D399}
      @media(min-width:761px){#nexusControleCibleModal{align-items:center}}
    `;
    document.head.appendChild(style);
  }

  function creerUI(ctx) {
    if ($('nexusControleCibleBtn')) return;
    const actions = document.querySelector('.actions');
    if (!actions) return;

    injectStyle();
    const btn = document.createElement('button');
    btn.id = 'nexusControleCibleBtn';
    btn.type = 'button';
    btn.textContent = '◎ Contrôle ciblé';
    actions.insertBefore(btn, $('status') || null);

    const modal = document.createElement('div');
    modal.id = 'nexusControleCibleModal';
    modal.innerHTML = `
      <div class="ncc-card" role="dialog" aria-modal="true" aria-labelledby="nccTitre">
        <div class="ncc-eyebrow">NEXUS · contrôle physique</div>
        <div class="ncc-title" id="nccTitre">Contrôle ciblé</div>
        <div class="ncc-sub">Recomptez une seule référence, emplacement par emplacement. NEXUS enregistre ce contrôle séparément d’un relevé complet de catégorie.</div>
        <div class="ncc-label">Catégorie</div><select id="nccCategorie" class="ncc-input"></select>
        <div class="ncc-label">Référence</div><select id="nccProduit" class="ncc-input"></select>
        <div class="ncc-label">Conditionnement</div><label class="ncc-input" style="display:flex;align-items:center;gap:8px">1 conditionnement = <input id="nccFacteur" type="number" min="1" step="1" value="10" style="width:72px;background:#10161c;border:1px solid #242E38;border-radius:7px;color:#EDF1F5;padding:7px;text-align:center"> unités</label>
        <div id="nccZones"></div>
        <div class="ncc-info"><b>Comptage aveugle :</b> le stock précédent n’est pas affiché pendant ce contrôle. Vous saisissez uniquement ce que vous voyez physiquement.</div>
        <div id="nccStatus" class="ncc-status"></div>
        <div class="ncc-actions"><button id="nccFermer" class="ncc-btn" type="button">Annuler</button><button id="nccEnregistrer" class="ncc-btn primary" type="button">Enregistrer le contrôle</button></div>
      </div>`;
    document.body.appendChild(modal);

    const catSelect = $('nccCategorie');
    const prodSelect = $('nccProduit');
    const zonesBox = $('nccZones');
    const facteur = $('nccFacteur');
    const save = $('nccEnregistrer');
    const status = $('nccStatus');

    const categoriesEligibles = ctx.categories.filter(c => zonesCategorie(ctx, c.id).length >= 2 && ctx.produits.some(p => p.categorie_id === c.id));
    catSelect.innerHTML = categoriesEligibles.map(c => `<option value="${c.id}">${esc(c.nom)}</option>`).join('');

    function setStatus(t, cls='') { status.textContent = t; status.className = 'ncc-status ' + cls; }

    function rendreProduits() {
      const catId = catSelect.value;
      const list = ctx.produits.filter(p => p.categorie_id === catId);
      prodSelect.innerHTML = list.map(p => `<option value="${p.id}">${esc(p.designation)}</option>`).join('');
      rendreZones();
    }

    function rendreZones() {
      const zs = zonesCategorie(ctx, catSelect.value);
      zonesBox.innerHTML = zs.map(z => `
        <div class="ncc-zone" data-zone="${z.id}">
          <div class="ncc-zone-title">📍 ${esc(z.nom)}</div>
          <div class="ncc-counts">
            <div><div class="ncc-mini">CONDITIONNEMENTS</div><input class="ncc-input ncc-cond" data-zone="${z.id}" type="number" min="0" step="1" inputmode="numeric" placeholder="0"></div>
            <div><div class="ncc-mini">UNITÉS</div><input class="ncc-input ncc-unit" data-zone="${z.id}" type="number" min="0" step="1" inputmode="numeric" placeholder="0"></div>
          </div>
        </div>`).join('');
      save.disabled = !prodSelect.value || zs.length < 2;
    }

    const pageCategorie = $('categorie');
    btn.addEventListener('click', () => {
      if (pageCategorie && categoriesEligibles.some(c => c.id === pageCategorie.value)) catSelect.value = pageCategorie.value;
      rendreProduits();
      setStatus('');
      modal.classList.add('actif');
    });
    $('nccFermer').addEventListener('click', () => modal.classList.remove('actif'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('actif'); });
    catSelect.addEventListener('change', rendreProduits);
    prodSelect.addEventListener('change', rendreZones);

    save.addEventListener('click', async () => {
      const produitId = prodSelect.value;
      const zs = zonesCategorie(ctx, catSelect.value);
      const f = Math.max(1, Number(facteur.value) || 1);
      if (!produitId || zs.length < 2) return;

      const rows = [];
      for (const z of zs) {
        const c = modal.querySelector(`.ncc-cond[data-zone="${z.id}"]`);
        const u = modal.querySelector(`.ncc-unit[data-zone="${z.id}"]`);
        if (!c || !u || c.value === '' || u.value === '') {
          setStatus('Complétez tous les emplacements de cette référence.', 'err');
          return;
        }
        const cond = Math.max(0, Number(c.value) || 0);
        const unit = Math.max(0, Number(u.value) || 0);
        rows.push({
          site: ctx.site,
          produit_id: produitId,
          zone_id: z.id,
          quantite_base: cond * f + unit,
          quantite_conditionnement: cond,
          quantite_unitaire: unit,
          facteur_conditionnement: f,
          unite_conditionnement: 'conditionnement',
          employee_id: ctx.employee.id,
          type_releve: 'cible',
          commentaire: 'Contrôle ciblé manager — relevé physique par emplacement.'
        });
      }

      save.disabled = true;
      save.textContent = 'Enregistrement…';
      setStatus('Enregistrement du contrôle ciblé…');
      const { error } = await nexusClient.from('inventaire_stock_localise_releves').insert(rows);
      if (error) {
        console.error('NEXUS contrôle ciblé stock localisé:', error);
        setStatus('Enregistrement impossible. Aucun contrôle n’a été validé.', 'err');
        save.disabled = false;
        save.textContent = 'Enregistrer le contrôle';
        return;
      }
      setStatus('Contrôle ciblé enregistré.', 'ok');
      save.textContent = 'Enregistré';
      setTimeout(() => global.location.reload(), 500);
    });

    if (categoriesEligibles.length) {
      if (pageCategorie && categoriesEligibles.some(c => c.id === pageCategorie.value)) catSelect.value = pageCategorie.value;
      rendreProduits();
    } else {
      btn.disabled = true;
      btn.title = 'Aucune catégorie multi-emplacement configurée.';
    }
  }

  async function init() {
    if ((global.location.pathname.split('/').pop() || '') !== PAGE) return;
    try {
      const ctx = await contexte();
      if (ctx) creerUI(ctx);
    } catch (e) {
      console.error('NEXUS contrôle ciblé stock:', e);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);