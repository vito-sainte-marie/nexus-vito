// nexus-regularisation-groupe.js — 13/10/2026, régularisation différée des écarts.
//
// Assistant « Enregistrer un versement de régularisation » : un salarié verse
// une somme, le manager l'affecte à un ou plusieurs anciens écarts. Les règles
// appartiennent au serveur (migration 20261013140000) : cet écran ne fait que
// proposer, contrôler localement ce qui évite un aller-retour, et rendre les
// refus lisibles. Jamais d'affectation automatique : les lignes arrivent
// décochées, le manager coche et saisit chaque montant.
//
// Le surplus (versement − affecté) reste suivi à part. Il n'est ni un écart
// régularisé ni transmis à Paye ; il n'est confirmé que par une case dédiée.

(function (global) {
  'use strict';

  const S = global.NexusRegularisationSaisie;

  const DOMAINES = [
    { value: 'verify', label: 'Boutique / piste (Verify)' },
    { value: 'fdj', label: 'FDJ' },
  ];

  const CONSEILS = {
    AFFECTATION_REQUISE: 'Cochez au moins un écart, ou confirmez que tout le versement est un surplus.',
    AFFECTATION_DOUBLON: 'Un écart ne figure qu\'une fois dans un versement.',
    AFFECTATION_SUPERIEURE_AU_VERSEMENT: 'Réduisez les montants affectés : ils ne dépassent pas ce qui a été versé.',
    DOMAINE_INCOHERENT: 'Verify et FDJ ne se mélangent pas : choisissez les écarts du bon domaine.',
    GROUPE_ACTIF: 'Annulez d\'abord le versement groupé, pas une affectation seule.',
    SURPLUS_NON_CONFIRME: 'Confirmez que le surplus reste suivi à part.',
  };

  const cents = v => Math.round(Number(v) * 100);
  const deCents = c => c / 100;
  const eur = v => `${Number(v).toFixed(2).replace('.', ',')} €`;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function cleEcart(e) {
    return e.fdj_cash_control_id || `${e.audit_id}:${e.caisse_origine}`;
  }

  function libOrigine(e) {
    if (e.module_origine === 'fdj') return 'FDJ';
    return e.caisse_origine === 'boutique' ? 'Boutique' : 'Piste';
  }

  // Lignes cochées → affectations du RPC. Le montant vide d'une ligne cochée
  // est une erreur, jamais le solde par défaut posé en silence.
  function lireAffectations(ecarts, saisies) {
    const out = []; const problemes = [];
    ecarts.forEach(e => {
      const s = saisies[cleEcart(e)];
      if (!s || !s.coche) return;
      const m = S.lireMontant(s.montant);
      if (m == null) { problemes.push(`Montant invalide pour l'écart du ${e.date_ecart} Q${e.quart_ecart}.`); return; }
      if (cents(m) > cents(e.solde)) { problemes.push(`L'écart du ${e.date_ecart} Q${e.quart_ecart} ne doit plus que ${eur(e.solde)}.`); return; }
      out.push({ audit_id: e.audit_id || null, caisse: e.caisse_origine || null, fdj_cash_control_id: e.fdj_cash_control_id || null, montant: m });
    });
    return { affectations: out, problemes };
  }

  function sommeAffectations(aff) {
    return deCents(aff.reduce((t, a) => t + cents(a.montant), 0));
  }

  function controlerGroupe(s, ecarts, { aujourdhui } = {}) {
    const p = [];
    const montant = S.lireMontant(s.montant);
    if (montant == null) p.push('Montant invalide : un nombre positif, au centime.');
    if (!S.MODES.some(m => m.value === s.mode)) p.push('Choisissez le mode reçu.');
    if (s.mode === 'autre' && String(s.justificatif || '').trim().length < 5) p.push('Le mode « autre » exige une justification (au moins 5 caractères).');
    if (!S.EMPLACEMENTS[s.emplacement]) p.push('Choisissez où l\'argent est reçu.');
    if (s.emplacement && s.emplacement !== 'coffre') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date || '')) p.push('Indiquez la date du quart.');
      else if (aujourdhui && s.date > aujourdhui) p.push('La date ne peut pas être dans le futur pour la station.');
      if (s.quart !== '1' && s.quart !== '2') p.push('Indiquez le quart (1 ou 2).');
    }
    const corr = String(s.correctionDatation || '').trim();
    if (corr && corr.length < 5) p.push('Une correction de datation se documente (au moins 5 caractères).');
    const lu = lireAffectations(ecarts, s.saisies || {});
    p.push(...lu.problemes);
    const affecte = sommeAffectations(lu.affectations);
    let surplus = 0;
    if (montant != null) {
      if (cents(affecte) > cents(montant)) p.push(`Le total affecté (${eur(affecte)}) dépasse le versement (${eur(montant)}).`);
      else surplus = deCents(cents(montant) - cents(affecte));
      if (!lu.affectations.length && !lu.problemes.length) p.push('Cochez au moins un écart à régulariser.');
      if (surplus > 0 && !s.surplusConfirme && !lu.problemes.length && lu.affectations.length) {
        p.push(`${eur(surplus)} ne sont affectés à aucun écart : confirmez qu'ils restent suivis à part.`);
      }
    }
    return { montant, affectations: lu.affectations, affecte, surplus, problemes: p };
  }

  function parametresGroupe(employeeId, domaine, s, controle, cle) {
    const coffre = s.emplacement === 'coffre';
    return {
      p_employee_id: employeeId,
      p_domaine: domaine,
      p_montant: controle.montant,
      p_mode: s.mode,
      p_justificatif: String(s.justificatif || '').trim() || null,
      p_destination: s.emplacement,
      p_recepteur_date: coffre ? null : s.date,
      p_recepteur_quart: coffre ? null : s.quart,
      p_affectations: controle.affectations,
      p_surplus_confirme: !!s.surplusConfirme,
      p_idempotency_key: cle,
      p_correction_datation: String(s.correctionDatation || '').trim() || null,
    };
  }

  function lireErreur(e) {
    const r = S.lireErreur(e);
    if (r.code && !r.conseil && CONSEILS[r.code]) r.conseil = CONSEILS[r.code];
    return r;
  }

  async function chargerEcartsOuverts(client, employeeId, domaine) {
    const { data, error } = await client.rpc('ecarts_ouverts_employe', { p_employee_id: employeeId, p_domaine: domaine });
    if (error) throw error;
    return data || [];
  }

  async function chargerGroupes(client, site, employeeId) {
    const { data, error } = await client.rpc('versements_groupes', { p_site: site, p_employee_id: employeeId || null });
    if (error) throw error;
    return data || [];
  }

  // ---------------------------------------------------------------- rendu

  function renderEcarts(ecarts, saisies) {
    if (!ecarts.length) return '<div class="pd-note">Aucun écart ouvert pour ce salarié dans ce domaine.</div>';
    return `<div class="rg-ecarts">${ecarts.map(e => {
      const k = cleEcart(e); const s = saisies[k] || {};
      return `
        <div class="rg-ligne${s.coche ? ' coche' : ''}" data-cle="${esc(k)}">
          <label class="rg-entete"><input type="checkbox" class="rg-coche"${s.coche ? ' checked' : ''}>
            <b>${esc(e.date_ecart)} · Q${esc(e.quart_ecart)}</b> · ${esc(libOrigine(e))}</label>
          <div class="rg-chiffres">
            <span>Initial <b>${eur(e.ecart_initial)}</b></span>
            <span>Corrections <b>${eur(e.corrections)}</b></span>
            <span>Déjà versé <b>${eur(e.versements_affectes)}</b></span>
            <span>Solde <b class="neg">${eur(e.solde)}</b></span>
          </div>
          <label class="regul-champ rg-montant"${s.coche ? '' : ' hidden'}>Montant affecté
            <input type="text" inputmode="decimal" class="rg-ligne-montant" autocomplete="off" value="${esc(s.montant || '')}" placeholder="0,00"></label>
        </div>`;
    }).join('')}</div>`;
  }

  function renderPied(controle) {
    const montantLu = controle.montant != null;
    return `
      <div class="rg-pied">
        <div class="pd-breakdown-row"><span>Versement</span><b>${montantLu ? eur(controle.montant) : '—'}</b></div>
        <div class="pd-breakdown-row"><span>Affecté aux écarts</span><b>${eur(controle.affecte)}</b></div>
        <div class="pd-breakdown-row"><span>Surplus suivi à part</span><b class="${controle.surplus > 0 ? 'pos' : ''}">${eur(controle.surplus)}</b></div>
      </div>
      ${controle.surplus > 0 && controle.affectations.length ? `<label class="regul-champ regul-case"><input type="checkbox" name="surplusConfirme"> Je confirme que ${eur(controle.surplus)} restent suivis à part (non transmis à Paye)</label>` : ''}`;
  }

  function renderFormulaire({ employes, aujourdhui, cle }) {
    return `
      <form class="regul-form rg-form" data-cle="${esc(cle)}" novalidate>
        <div class="regul-form-titre">Enregistrer un versement de régularisation</div>
        <div class="pd-note">Un salarié verse de l'argent pour d'anciens écarts. Rien n'est affecté sans que vous cochiez chaque écart. Paye consolide ces montants ; elle ne les saisit pas.</div>
        <label class="regul-champ">Salarié
          <select name="employeeId"><option value="">Choisir…</option>${employes.map(e => `<option value="${esc(e.id)}">${esc(e.nom)}</option>`).join('')}</select></label>
        <label class="regul-champ">Domaine des écarts
          <select name="domaine">${DOMAINES.map(d => `<option value="${d.value}">${esc(d.label)}</option>`).join('')}</select></label>
        <div class="rg-liste"><div class="pd-note">Choisissez un salarié pour voir ses écarts ouverts.</div></div>
        <label class="regul-champ">Montant versé <input type="text" inputmode="decimal" name="montant" autocomplete="off" placeholder="0,00"></label>
        <label class="regul-champ">Mode reçu <select name="mode"><option value="">Choisir…</option>${S.MODES.map(m => `<option value="${m.value}">${esc(m.label)}</option>`).join('')}</select></label>
        <label class="regul-champ">Justificatif <input type="text" name="justificatif" placeholder="N° de reçu, référence de virement…"></label>
        <label class="regul-champ">Reçu dans
          <select name="emplacement">${Object.entries(S.EMPLACEMENTS).map(([k, lib]) => `<option value="${k}">${esc(lib)}</option>`).join('')}</select></label>
        <div class="regul-quart">
          <label class="regul-champ">Date du quart <input type="date" name="date" value="${esc(aujourdhui || '')}" max="${esc(aujourdhui || '')}"></label>
          <label class="regul-champ">Quart <select name="quart"><option value="1">1</option><option value="2">2</option></select></label>
        </div>
        <label class="regul-champ">Correction de datation <input type="text" name="correctionDatation" placeholder="Seulement si la date doit précéder l'écart"></label>
        <div class="rg-pied-zone"></div>
        <div class="regul-erreur" role="alert" hidden></div>
        <button type="submit" class="regul-envoyer">Enregistrer le versement</button>
      </form>`;
  }

  function renderGroupes(groupes, nomEmploye) {
    if (!groupes.length) return '';
    return `<div class="regul-ops-titre">Versements groupés récents</div>${groupes.map(g => `
      <div class="regul-op${g.annule_le ? ' annulee' : ''}" data-groupe="${esc(g.id)}">
        <div><b>${eur(g.montant)}</b> · ${esc(nomEmploye(g.employee_id) || '—')} · ${esc(g.domaine === 'fdj' ? 'FDJ' : 'Verify')} · ${g.nb_affectations} écart(s)</div>
        <div class="regul-op-note">Affecté ${eur(g.affecte)}${Number(g.surplus) > 0 ? ` · <b>surplus ${eur(g.surplus)}</b> suivi à part` : ''}</div>
        ${g.annule_le ? `<div class="regul-op-note">Annulé : ${esc(g.motif_annulation)}</div>` : `<div class="regul-op-actions">
          ${Number(g.surplus) > 0 ? `<button type="button" class="rg-surplus" data-id="${esc(g.id)}">Affecter le surplus</button>` : ''}
          <button type="button" class="rg-annuler" data-id="${esc(g.id)}">Annuler le versement</button></div>`}
      </div>`).join('')}`;
  }

  // ---------------------------------------------------------- comportement

  function lireSaisie(form, saisies) {
    const s = { saisies };
    for (const el of form.elements) {
      if (!el.name) continue;
      s[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    }
    return s;
  }

  function montrerErreur(form, err) {
    const zone = form.querySelector('.regul-erreur');
    zone.hidden = false;
    zone.innerHTML = Array.isArray(err)
      ? err.map(x => `<div>${esc(x)}</div>`).join('')
      : `<div><b>${esc(err.message)}</b></div>${err.conseil ? `<div>${esc(err.conseil)}</div>` : ''}${err.code ? `<div class="regul-code">${esc(err.code)}</div>` : ''}`;
  }

  // ctx : { client, site, aujourdhui, apresSucces, nomEmploye, demanderMotif, alerter }
  function brancher(conteneur, ctx) {
    const form = conteneur.querySelector('form.rg-form');
    if (!form) return;
    let ecarts = []; const saisies = {};
    const liste = form.querySelector('.rg-liste');
    const zonePied = form.querySelector('.rg-pied-zone');
    const sel = form.elements.emplacement; const bloc = form.querySelector('.regul-quart');
    const majLieu = () => { bloc.hidden = sel.value === 'coffre'; };
    sel.addEventListener('change', majLieu); majLieu();

    function recalcul() {
      const s = lireSaisie(form, saisies);
      const confirme = s.surplusConfirme;
      const c = controlerGroupe(Object.assign(s, { surplusConfirme: false }), ecarts, ctx);
      zonePied.innerHTML = renderPied(c);
      const cb = zonePied.querySelector('input[name="surplusConfirme"]');
      if (cb) { cb.checked = !!confirme; }
    }

    function dessiner() {
      liste.innerHTML = renderEcarts(ecarts, saisies);
      liste.querySelectorAll('.rg-ligne').forEach(div => {
        const k = div.dataset.cle;
        const coche = div.querySelector('.rg-coche'); const champ = div.querySelector('.rg-ligne-montant');
        coche.addEventListener('change', () => {
          const e = ecarts.find(x => cleEcart(x) === k);
          saisies[k] = { coche: coche.checked, montant: coche.checked ? String(Number(e.solde).toFixed(2)).replace('.', ',') : '' };
          dessiner(); recalcul();
        });
        champ.addEventListener('input', () => { saisies[k].montant = champ.value; recalcul(); });
      });
      recalcul();
    }

    async function chargerEcarts() {
      const emp = form.elements.employeeId.value; const dom = form.elements.domaine.value;
      for (const k of Object.keys(saisies)) delete saisies[k];
      ecarts = [];
      if (!emp) { liste.innerHTML = '<div class="pd-note">Choisissez un salarié pour voir ses écarts ouverts.</div>'; recalcul(); return; }
      liste.innerHTML = '<div class="chargement">Chargement…</div>';
      try { ecarts = await chargerEcartsOuverts(ctx.client, emp, dom); }
      catch (e) { const r = lireErreur(e); liste.innerHTML = `<div class="regul-erreur"><b>${esc(r.message)}</b></div>`; return; }
      dessiner();
    }
    form.elements.employeeId.addEventListener('change', chargerEcarts);
    form.elements.domaine.addEventListener('change', chargerEcarts);
    ['montant', 'mode', 'justificatif'].forEach(n => form.elements[n].addEventListener('input', recalcul));
    zonePied.addEventListener('change', recalcul);
    recalcul();

    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const bouton = form.querySelector('.regul-envoyer');
      if (bouton.disabled) return;
      const s = lireSaisie(form, saisies);
      const c = controlerGroupe(s, ecarts, ctx);
      if (!form.elements.employeeId.value) c.problemes.unshift('Choisissez le salarié.');
      if (c.problemes.length) { montrerErreur(form, c.problemes); return; }
      bouton.disabled = true; const texte = bouton.textContent; bouton.textContent = 'Enregistrement…';
      try {
        const { error } = await ctx.client.rpc('enregistrer_versement_groupe',
          parametresGroupe(form.elements.employeeId.value, form.elements.domaine.value, s, c, form.dataset.cle));
        if (error) throw error;
        await ctx.apresSucces();
      } catch (e) {
        montrerErreur(form, lireErreur(e));
        bouton.disabled = false; bouton.textContent = texte;
      }
    });
  }

  function brancherGroupes(conteneur, ctx, groupes) {
    conteneur.querySelectorAll('.rg-annuler').forEach(btn => btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      const motif = (ctx.demanderMotif || global.prompt)('Motif de l\'annulation (au moins 5 caractères) :');
      if (motif == null) return;
      if (String(motif).trim().length < 5) { (ctx.alerter || global.alert)('Un motif d\'annulation exige au moins 5 caractères.'); return; }
      btn.disabled = true;
      try {
        const { error } = await ctx.client.rpc('annuler_versement_groupe', { p_groupe_id: btn.dataset.id, p_motif: String(motif).trim() });
        if (error) throw error;
        await ctx.apresSucces();
      } catch (e) {
        const r = lireErreur(e);
        (ctx.alerter || global.alert)(`${r.message}${r.conseil ? '\n' + r.conseil : ''}`);
        btn.disabled = false;
      }
    }));
    conteneur.querySelectorAll('.rg-surplus').forEach(btn => btn.addEventListener('click', () => {
      const g = groupes.find(x => x.id === btn.dataset.id);
      if (g && ctx.ouvrirSurplus) ctx.ouvrirSurplus(g);
    }));
  }

  global.NexusRegularisationGroupe = {
    DOMAINES, CONSEILS, cleEcart, libOrigine, lireAffectations, sommeAffectations,
    controlerGroupe, parametresGroupe, lireErreur, chargerEcartsOuverts, chargerGroupes,
    renderFormulaire, renderEcarts, renderPied, renderGroupes, brancher, brancherGroupes,
  };
})(typeof window !== 'undefined' ? window : globalThis);
