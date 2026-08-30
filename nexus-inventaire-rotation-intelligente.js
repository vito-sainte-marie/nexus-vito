(function (global) {
  'use strict';
  const MODE = 'rotation_intelligente';
  const CIBLE_DEFAUT = 6;

  function installerMoteur() {
    const M = global.NexusInventaireMoteur;
    const PD = global.NexusInventairePlanDonnees;
    if (!M || !PD || M.__rotationCategorieInstallee) return;

    if (typeof PD.chargerIngredientsSelection === 'function' && !PD.__rotationCategorieInstallee) {
      const chargerOriginal = PD.chargerIngredientsSelection;
      PD.chargerIngredientsSelection = async function (client, site, dateISO) {
        const ingredients = await chargerOriginal(client, site, dateISO);
        if (!ingredients) return ingredients;
        const { data: cats, error } = await client.from('inventaire_categories')
          .select('id, mode_comptage, nombre_references_rotation, controle_aleatoire')
          .eq('site', site).eq('actif', true);
        if (error) { console.error('Rotation intelligente — catégories:', error); return ingredients; }
        const parCat = Object.fromEntries((cats || []).map(c => [c.id, c]));
        (ingredients.produits || []).forEach(p => {
          const c = parCat[p.categorie_id];
          if (!c) return;
          ingredients.reglesParProduit[p.id] = Object.assign({}, ingredients.reglesParProduit[p.id] || {}, {
            mode_comptage: c.mode_comptage || 'fixe',
            nombre_references_rotation: c.nombre_references_rotation,
            controle_aleatoire: c.controle_aleatoire,
          });
        });
        return ingredients;
      };
      PD.__rotationCategorieInstallee = true;
    }

    const selectionOriginale = M.selectionnerPerimetreMission;
    if (typeof selectionOriginale !== 'function') return;
    M.selectionnerPerimetreMission = function (missionRule, produits, derniers, seed, contexte) {
      const regles = (contexte && contexte.reglesParProduit) || {};
      const rotation = (produits || []).filter(p => regles[p.id] && regles[p.id].mode_comptage === MODE);
      if (!rotation.length) return selectionOriginale(missionRule, produits, derniers, seed, contexte);

      const idsRotation = new Set(rotation.map(p => p.id));
      const resultat = new Set(selectionOriginale(missionRule, (produits || []).filter(p => !idsRotation.has(p.id)), derniers, seed, contexte));
      const groupes = new Map();
      rotation.forEach(p => {
        const cle = p.categorie_id || '__sans_categorie__';
        if (!groupes.has(cle)) groupes.set(cle, []);
        groupes.get(cle).push(p);
      });
      groupes.forEach((liste, categorieId) => {
        const r = regles[liste[0].id] || {};
        const cible = Number(r.nombre_references_rotation) > 0 ? Number(r.nombre_references_rotation) : CIBLE_DEFAUT;
        const surprise = r.controle_aleatoire === true;
        const regleIntelligente = Object.assign({}, missionRule, {
          mode_selection: 'intelligent', nombre_references: cible,
          inclure_surprise: surprise, nombre_surprises: surprise ? 1 : null,
        });
        selectionOriginale(regleIntelligente, liste, derniers, `${seed}|cat|${categorieId}`, contexte).forEach(id => resultat.add(id));
      });
      return Array.from(resultat);
    };
    M.__rotationCategorieInstallee = true;
  }

  function categorieId(select) {
    const card = select && select.closest('.card');
    const head = card && card.querySelector('[data-categorie-regle]');
    return head ? head.dataset.categorieRegle : null;
  }

  function optionsRotation(select, actif, cible) {
    const parent = select.closest('.regle-champ-row');
    if (!parent) return;
    let bloc = parent.querySelector('[data-options-rotation-intelligente]');
    if (!actif) { if (bloc) bloc.remove(); return; }
    if (!bloc) {
      bloc = document.createElement('div');
      bloc.dataset.optionsRotationIntelligente = '1';
      bloc.style.cssText = 'margin-top:9px;padding:10px 11px;border:1px solid rgba(79,195,217,.25);border-radius:9px;background:rgba(79,195,217,.06)';
      bloc.innerHTML = '<div style="font-size:11.5px;color:var(--cyan);font-weight:600;margin-bottom:7px">NEXUS choisit les références à contrôler</div><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;color:var(--text-mid)"><span>Nombre cible de références</span><input data-rotation-cible type="number" min="1" max="999" class="mouv-qte" style="width:72px;flex:none"></div><div style="font-size:10.8px;color:var(--text-dim);line-height:1.45;margin-top:7px">Priorité aux références en retard, à surveiller ou les moins récemment contrôlées. Une référence surprise peut être intégrée si « Contrôle aléatoire » est activé.</div>';
      parent.appendChild(bloc);
      bloc.querySelector('[data-rotation-cible]').addEventListener('change', async e => {
        const id = categorieId(select);
        const n = Math.max(1, parseInt(e.target.value, 10) || CIBLE_DEFAUT);
        e.target.value = n;
        if (id) await nexusClient.from('inventaire_categories').update({ nombre_references_rotation: n }).eq('id', id);
      });
    }
    bloc.querySelector('[data-rotation-cible]').value = cible || CIBLE_DEFAUT;
  }

  async function chargerMode(select, id) {
    if (!id || select.dataset.rotationChargee === id) return;
    select.dataset.rotationChargee = id;
    const { data } = await nexusClient.from('inventaire_categories')
      .select('mode_comptage, nombre_references_rotation').eq('id', id).maybeSingle();
    if (!data) return;
    if (data.mode_comptage === MODE) select.value = MODE;
    optionsRotation(select, data.mode_comptage === MODE, data.nombre_references_rotation || CIBLE_DEFAUT);
  }

  function installerUI() {
    if (!global.location || !/NEXUS-Parametres-Inventaire-v1\.html$/i.test(global.location.pathname)) return;
    const traiter = () => {
      const select = document.getElementById('catRegleComptage');
      if (!select) return;
      if (!select.querySelector(`option[value="${MODE}"]`)) {
        const option = document.createElement('option');
        option.value = MODE; option.textContent = 'Rotation intelligente';
        select.appendChild(option);
        select.addEventListener('change', async e => {
          const id = categorieId(select);
          if (!id) return;
          if (e.target.value === MODE) {
            e.stopImmediatePropagation();
            await nexusClient.from('inventaire_categories').update({
              mode_comptage: MODE, nombre_references_rotation: CIBLE_DEFAUT, quarts_comptage: null,
            }).eq('id', id);
            optionsRotation(select, true, CIBLE_DEFAUT);
          } else {
            await nexusClient.from('inventaire_categories').update({ mode_comptage: 'fixe' }).eq('id', id);
            optionsRotation(select, false, null);
          }
        }, true);
      }
      chargerMode(select, categorieId(select));
    };
    new MutationObserver(traiter).observe(document.documentElement, { childList: true, subtree: true });
    traiter();
  }

  installerMoteur();
  if (global.addEventListener) global.addEventListener('load', () => { installerMoteur(); installerUI(); }, { once: true });
})(typeof window !== 'undefined' ? window : globalThis);
