// nexus-regularisation-saisie.js — 08/10/2026, mandat consolidé B7 (P3).
//
// Écran manager des versements de régularisation, des restitutions de
// trop-perçu et des transferts vers le coffre, ouvert depuis le détail d'un
// écart (Analyse des écarts). Les règles appartiennent au serveur
// (migrations 20261008120000, 130000, 150000) : cet écran n'en recode
// aucune qui puisse décider à sa place. Il ne fait que trois choses :
//
//   1. montrer l'état que le serveur calcule (ecart_regularisation_etat) :
//      déficit, versé, restitué, reste dû, trop-perçu, statut ;
//   2. préparer les paramètres des RPC enregistrer_* / annuler_* avec une
//      clé d'idempotence par saisie — un double appui ou une nouvelle
//      tentative après une coupure réseau renvoie la même opération, jamais
//      une seconde (§9 « aucun double ») ;
//   3. rendre chaque refus du serveur lisible : le code [XXX] devient un
//      message et un conseil, jamais « Erreur — réessayez » (§9).
//
// Les contrôles locaux (montant, justification, date et quart) évitent un
// aller-retour inutile ; ils ne remplacent aucun contrôle serveur.

(function (global) {
  'use strict';

  const MODES = [
    { value: 'especes', label: 'Espèces' },
    { value: 'carte_bancaire', label: 'Carte bancaire' },
    { value: 'cheque', label: 'Chèque' },
    { value: 'virement', label: 'Virement' },
    { value: 'autre', label: 'Autre (justification obligatoire)' },
  ];

  const EMPLACEMENTS = {
    tiroir_verify_piste: 'Tiroir piste du quart',
    tiroir_verify_boutique: 'Tiroir boutique du quart',
    tiroir_fdj: 'Tiroir FDJ du quart',
    coffre: 'Coffre',
  };

  const LIBELLES_STATUT = {
    OUVERT: 'Ouvert',
    PARTIELLEMENT_REGULARISE: 'Partiellement régularisé',
    SOLDE: 'Soldé',
  };

  const MOTIF_VERSEMENT = "Versement volontaire de régularisation d'un écart antérieur";

  // Aides (i) : ouvertes au toucher (Safari iOS n'affiche pas les « title »).
  const AIDES = {
    etat: "Le déficit est l'écart validé par le manager. Le reste dû retire les versements actifs et rajoute les restitutions. Un versement annulé ne compte plus, mais il reste visible.",
    montant: 'Au centime, jamais plus que le reste dû. Un versement partiel laisse l\'écart « partiellement régularisé ».',
    mode: 'Le mode réellement reçu : il sert à rapprocher le tiroir de sa réception réelle (espèces avec espèces, carte avec carte).',
    destination: 'Par défaut, le tiroir du quart qui reçoit l\'argent : son attendu augmente d\'autant. Le coffre n\'a ni date ni quart.',
    recepteur: 'Le quart qui reçoit : ni dans le futur, ni avant l\'écart, ni déjà validé. Si la date doit précéder l\'écart, documentez la correction de datation.',
    correction: 'Uniquement pour une datation à corriger, documentée (au moins 5 caractères). Laissez vide sinon.',
    restitution: 'Un trop-perçu n\'est jamais rendu automatiquement : un manager le valide ici, depuis le tiroir ou le coffre qui le rend.',
    tiers: 'La restitution va au payeur. Un tiers doit être nommé et l\'autorisation décrite.',
    transfert: 'Sortir du tiroir ce que le versement y a mis, vers le coffre. Plafonné à ce qui reste du versement dans le tiroir.',
    annulation: 'Rien ne se supprime : l\'annulation est une contre-écriture datée, signée, motivée.',
  };

  // Un conseil par code serveur : quoi faire, pas seulement ce qui ne va pas.
  const CONSEILS = {
    ECART_A_REVALIDER: 'Ouvrez le contrôle source et validez de nouveau la caisse, puis revenez ici.',
    ECART_NON_CLOTURE: 'Un manager doit d\'abord valider cet écart dans son contrôle source.',
    ECART_SANS_DEFICIT: 'Cet écart n\'est pas un manque : il n\'y a rien à régulariser.',
    ECART_SANS_RESPONSABLE: 'Désignez d\'abord le responsable de la caisse dans le contrôle source.',
    ECART_SOLDE: 'Rien ne reste dû. Pour corriger un versement, annulez-le puis saisissez le bon.',
    PLAFOND_DEPASSE: 'Réduisez le montant au plafond indiqué.',
    QUART_RECEPTEUR_CLOTURE: 'Choisissez un quart encore ouvert, ou le coffre.',
    QUART_RECEPTEUR_FUTUR: 'Choisissez une date qui n\'est pas dans le futur pour la station.',
    QUART_RECEPTEUR_ANTERIEUR: 'Choisissez un quart postérieur à l\'écart, ou documentez une correction de datation.',
    TIERS_NON_DESIGNE: 'Nommez la personne qui reçoit la restitution.',
    AUTORISATION_TIERS_REQUISE: 'Décrivez l\'autorisation du payeur pour rendre à ce tiers.',
    JUSTIFICATION_REQUISE: 'Complétez la justification (au moins 5 caractères).',
    DEJA_ANNULE: 'Rechargez : cette opération a déjà été annulée.',
    RESTITUTION_ACTIVE: 'Annulez d\'abord la restitution qui s\'appuie sur ce versement.',
    TRANSFERT_ACTIF: 'Annulez d\'abord le transfert vers le coffre qui porte ce versement.',
    IDEMPOTENCE_CONFLIT: 'Cette saisie a peut-être déjà été enregistrée : rechargez avant de recommencer.',
    IMMUABLE: 'Une opération enregistrée ne se modifie pas : annulez-la.',
  };

  function nouvelleCle() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID();
    // Safari iOS < 15.4 n'a pas randomUUID : uuid v4 depuis getRandomValues.
    const b = new Uint8Array(16);
    global.crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  // Une ligne d'Analyse des écarts désigne son origine : caisse Verify
  // (audit + piste/boutique) ou contrôle FDJ. Rien d'autre n'est accepté.
  function origineDepuisLigne(l) {
    if (l && l.sourceModule === 'verify' && (l.activite === 'piste' || l.activite === 'boutique')) {
      return { p_audit_id: l.sourceControlId, p_caisse: l.activite, p_fdj_cash_control_id: null };
    }
    if (l && l.sourceModule === 'fdj') {
      return { p_audit_id: null, p_caisse: null, p_fdj_cash_control_id: l.sourceControlId };
    }
    return null;
  }

  function tiroirDeLaLigne(l) {
    if (l.sourceModule === 'fdj') return 'tiroir_fdj';
    return l.activite === 'boutique' ? 'tiroir_verify_boutique' : 'tiroir_verify_piste';
  }

  // « 12,5 » → 12.5 ; refuse tout ce qui n'est pas un montant positif au centime.
  function lireMontant(texte) {
    const t = String(texte == null ? '' : texte).trim().replace(/\s/g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
    const v = Number(t);
    return v > 0 ? v : null;
  }

  function lireErreur(e) {
    const brut = (e && (e.message || e.details)) || String(e || '');
    const m = /\[([A-Z_]+)\]\s*([\s\S]*)/.exec(brut);
    if (!m) {
      const reseau = /Failed to fetch|NetworkError|Load failed/i.test(brut);
      return {
        code: reseau ? 'RESEAU' : null,
        message: reseau ? 'La connexion a été perdue avant la réponse du serveur.' : (brut || 'Refus du serveur sans motif.'),
        conseil: reseau ? 'Réessayez : la même saisie sera reconnue et ne sera jamais enregistrée deux fois.' : '',
      };
    }
    return { code: m[1], message: m[2].trim(), conseil: CONSEILS[m[1]] || '' };
  }

  function exigeQuart(emplacement) { return emplacement && emplacement !== 'coffre'; }

  function controlerQuart(s, problemes, aujourdhui) {
    if (!exigeQuart(s.emplacement)) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date || '')) problemes.push('Indiquez la date du quart.');
    else if (aujourdhui && s.date > aujourdhui) problemes.push('La date ne peut pas être dans le futur pour la station.');
    if (s.quart !== '1' && s.quart !== '2') problemes.push('Indiquez le quart (1 ou 2).');
  }

  function controlerVersement(s, etat, { aujourdhui } = {}) {
    const p = [];
    const montant = lireMontant(s.montant);
    if (montant == null) p.push('Montant invalide : un nombre positif, au centime.');
    else if (etat && etat.reste_du != null && montant > Number(etat.reste_du)) p.push(`Le versement dépasse le reste dû (${Number(etat.reste_du).toFixed(2).replace('.', ',')} €).`);
    if (!MODES.some(m => m.value === s.mode)) p.push('Choisissez le mode reçu.');
    if (s.mode === 'autre' && String(s.justificatif || '').trim().length < 5) p.push('Le mode « autre » exige une justification (au moins 5 caractères).');
    if (!EMPLACEMENTS[s.emplacement]) p.push('Choisissez où l\'argent est reçu.');
    controlerQuart(s, p, aujourdhui);
    const corr = String(s.correctionDatation || '').trim();
    if (corr && corr.length < 5) p.push('Une correction de datation se documente (au moins 5 caractères).');
    return { montant, problemes: p };
  }

  function controlerRestitution(s, etat, { aujourdhui } = {}) {
    const p = [];
    const montant = lireMontant(s.montant);
    if (montant == null) p.push('Montant invalide : un nombre positif, au centime.');
    else if (etat && etat.trop_percu != null && montant > Number(etat.trop_percu)) p.push(`La restitution dépasse le trop-perçu (${Number(etat.trop_percu).toFixed(2).replace('.', ',')} €).`);
    if (!MODES.some(m => m.value === s.mode)) p.push('Choisissez le mode de restitution.');
    if (String(s.justification || '').trim().length < 5) p.push('Une restitution exige une justification (au moins 5 caractères).');
    if (!EMPLACEMENTS[s.emplacement]) p.push('Choisissez d\'où l\'argent est rendu.');
    controlerQuart(s, p, aujourdhui);
    if (s.tiers) {
      if (!String(s.beneficiaireTiers || '').trim()) p.push('Nommez le tiers qui reçoit la restitution.');
      if (String(s.autorisationTiers || '').trim().length < 5) p.push('Décrivez l\'autorisation du payeur (au moins 5 caractères).');
    }
    return { montant, problemes: p };
  }

  function controlerTransfert(s, versement) {
    const p = [];
    const montant = lireMontant(s.montant);
    if (montant == null) p.push('Montant invalide : un nombre positif, au centime.');
    else if (versement && montant > Number(versement.reste_au_tiroir)) p.push(`Le transfert dépasse ce qui reste du versement dans le tiroir (${Number(versement.reste_au_tiroir).toFixed(2).replace('.', ',')} €).`);
    if (String(s.motif || '').trim().length < 5) p.push('Un transfert exige un motif (au moins 5 caractères).');
    return { montant, problemes: p };
  }

  function parametresVersement(origine, s, montant, cle) {
    const coffre = s.emplacement === 'coffre';
    return {
      ...origine,
      p_montant: montant,
      p_mode: s.mode,
      p_justificatif: String(s.justificatif || '').trim() || null,
      p_destination: s.emplacement,
      p_recepteur_date: coffre ? null : s.date,
      p_recepteur_quart: coffre ? null : s.quart,
      p_idempotency_key: cle,
      p_correction_datation: String(s.correctionDatation || '').trim() || null,
    };
  }

  function parametresRestitution(origine, s, montant, cle) {
    const coffre = s.emplacement === 'coffre';
    return {
      ...origine,
      p_montant: montant,
      p_mode: s.mode,
      p_justification: String(s.justification || '').trim(),
      p_source: s.emplacement,
      p_source_date: coffre ? null : s.date,
      p_source_quart: coffre ? null : s.quart,
      p_idempotency_key: cle,
      p_beneficiaire_tiers: s.tiers ? String(s.beneficiaireTiers || '').trim() : null,
      p_autorisation_tiers: s.tiers ? String(s.autorisationTiers || '').trim() : null,
    };
  }

  // Le transfert part du tiroir qui a reçu le versement, jamais d'ailleurs.
  function parametresTransfert(versement, s, montant, cle) {
    return {
      p_source: versement.destination,
      p_source_date: versement.recepteur_date,
      p_source_quart: versement.recepteur_quart,
      p_montant: montant,
      p_versement_id: versement.id,
      p_motif: String(s.motif || '').trim(),
      p_idempotency_key: cle,
    };
  }

  async function appeler(client, rpc, params) {
    const { data, error } = await client.rpc(rpc, params);
    if (error) throw error;
    return data;
  }

  function filtrerOrigine(requete, origine) {
    return origine.p_fdj_cash_control_id
      ? requete.eq('fdj_cash_control_id', origine.p_fdj_cash_control_id)
      : requete.eq('audit_id', origine.p_audit_id).eq('caisse_origine', origine.p_caisse);
  }

  // Lecture seule, sous RLS (manager ou gérant du site).
  async function chargerDossier(client, origine) {
    const etat = await appeler(client, 'ecart_regularisation_etat', origine);
    const champs = 'id, montant, annule_le, motif_annulation, created_at';
    const [v, r] = await Promise.all([
      filtrerOrigine(client.from('ecarts_versements_regularisation')
        .select(`${champs}, mode_encaissement, justificatif, destination, recepteur_date, recepteur_quart, correction_datation`), origine).order('created_at'),
      filtrerOrigine(client.from('ecarts_restitutions_trop_percu')
        .select(`${champs}, mode_restitution, justification, source, source_date, source_quart, beneficiaire_tiers`), origine).order('created_at'),
    ]);
    if (v.error) throw v.error;
    if (r.error) throw r.error;
    const versements = v.data || [];
    let transferts = [];
    const ids = versements.map(x => x.id);
    if (ids.length) {
      const t = await client.from('caisse_transferts_coffre')
        .select('id, versement_id, montant, motif, annule_le, motif_annulation, created_at').in('versement_id', ids).order('created_at');
      if (t.error) throw t.error;
      transferts = t.data || [];
    }
    return { etat, versements: annoterVersements(versements, transferts), restitutions: r.data || [], transferts };
  }

  // Ce qui reste d'un versement dans son tiroir = versement − transferts actifs.
  function annoterVersements(versements, transferts) {
    return versements.map(v => {
      const sorti = transferts.filter(t => t.versement_id === v.id && !t.annule_le).reduce((s, t) => s + Number(t.montant), 0);
      const reste = Math.round((Number(v.montant) - sorti) * 100) / 100;
      return { ...v, transfere: sorti, reste_au_tiroir: reste, transferable: !v.annule_le && v.destination !== 'coffre' && reste > 0 };
    });
  }

  // ---------------------------------------------------------------- rendu

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function eur(v) { return v == null ? '—' : `${Number(v).toFixed(2).replace('.', ',')} €`; }
  function libMode(v) { const m = MODES.find(x => x.value === v); return m ? m.label.replace(' (justification obligatoire)', '') : (v || '—'); }
  function libLieu(lieu, date, quart) { return lieu === 'coffre' ? 'Coffre' : `${EMPLACEMENTS[lieu] || lieu} · ${date || '?'} Q${quart || '?'}`; }

  let compteurAide = 0;
  function aide(cle) {
    const id = `aideRegul${++compteurAide}`;
    return {
      bouton: `<button type="button" class="aide-info regul-aide" aria-expanded="false" aria-controls="${id}" aria-label="Aide">ⓘ</button>`,
      texte: `<div class="regul-aide-texte" id="${id}" hidden>${esc(AIDES[cle])}</div>`,
    };
  }

  function champsLieu(prefixe, defaut, aujourdhui, cleAide) {
    const a = aide(cleAide);
    return `
      <label class="regul-champ">${prefixe === 'v' ? 'Reçu dans' : 'Rendu depuis'} ${a.bouton}
        <select name="emplacement">${Object.entries(EMPLACEMENTS).map(([k, lib]) => `<option value="${k}"${k === defaut ? ' selected' : ''}>${esc(lib)}</option>`).join('')}</select>
      </label>${a.texte}
      <div class="regul-quart">
        <label class="regul-champ">Date du quart <input type="date" name="date" value="${esc(aujourdhui || '')}" max="${esc(aujourdhui || '')}"></label>
        <label class="regul-champ">Quart <select name="quart"><option value="1">1</option><option value="2">2</option></select></label>
      </div>`;
  }

  function selectMode() {
    return `<select name="mode"><option value="">Choisir…</option>${MODES.map(m => `<option value="${m.value}">${esc(m.label)}</option>`).join('')}</select>`;
  }

  function renderEtat(etat) {
    const a = aide('etat');
    const statut = LIBELLES_STATUT[etat.statut_regularisation] || '—';
    return `
      <div class="regul-etat">
        <div class="regul-etat-titre">Régularisation ${a.bouton} <span class="statut-badge regul-${esc(String(etat.statut_regularisation || '').toLowerCase())}">${esc(statut)}</span></div>
        ${a.texte}
        <div class="pd-breakdown-row"><span>Déficit validé</span><b>${eur(etat.deficit)}</b></div>
        <div class="pd-breakdown-row"><span>Versé</span><b>${eur(etat.versements)}</b></div>
        <div class="pd-breakdown-row"><span>Restitué</span><b>${eur(etat.restitutions)}</b></div>
        <div class="pd-breakdown-row"><span>Reste dû</span><b class="${Number(etat.reste_du) > 0 ? 'neg' : ''}">${eur(etat.reste_du)}</b></div>
        ${Number(etat.trop_percu) > 0 ? `<div class="pd-breakdown-row"><span>Trop-perçu à restituer</span><b class="pos">${eur(etat.trop_percu)}</b></div>` : ''}
      </div>`;
  }

  // Pourquoi aucun formulaire : la raison exacte, au lieu d'un bouton grisé.
  function blocage(etat) {
    if (etat.revalidation_requise) return { code: 'ECART_A_REVALIDER', message: 'Le résultat de cette caisse a changé après sa validation.' };
    if (!etat.cloture) return { code: 'ECART_NON_CLOTURE', message: 'Cet écart n\'est pas encore validé par un manager.' };
    if (etat.sans_responsable) return { code: 'ECART_SANS_RESPONSABLE', message: 'Aucun responsable n\'est désigné pour cette caisse.' };
    return null;
  }

  function renderOperations(dossier, estManager) {
    const lignes = [];
    for (const v of dossier.versements) {
      const transferts = dossier.transferts.filter(t => t.versement_id === v.id);
      lignes.push(`
        <div class="regul-op${v.annule_le ? ' annulee' : ''}" data-op="versement" data-id="${esc(v.id)}">
          <div><b>Versement ${eur(v.montant)}</b> · ${esc(libMode(v.mode_encaissement))} · ${esc(libLieu(v.destination, v.recepteur_date, v.recepteur_quart))}</div>
          ${v.justificatif ? `<div class="regul-op-note">${esc(v.justificatif)}</div>` : ''}
          ${v.annule_le ? `<div class="regul-op-note">Annulé : ${esc(v.motif_annulation)}</div>` : ''}
          ${transferts.map(t => `<div class="regul-op-sous${t.annule_le ? ' annulee' : ''}" data-op="transfert" data-id="${esc(t.id)}">→ Coffre ${eur(t.montant)} · ${esc(t.motif)}${t.annule_le ? ` · annulé : ${esc(t.motif_annulation)}` : (estManager ? ' <button type="button" class="regul-annuler" data-rpc="annuler_transfert_coffre" data-id="' + esc(t.id) + '">Annuler</button>' : '')}</div>`).join('')}
          ${estManager && !v.annule_le ? `<div class="regul-op-actions">
            ${v.transferable ? `<button type="button" class="regul-ouvrir-transfert" data-id="${esc(v.id)}">Transférer au coffre (reste ${eur(v.reste_au_tiroir)})</button>` : ''}
            <button type="button" class="regul-annuler" data-rpc="annuler_versement_regularisation" data-id="${esc(v.id)}">Annuler</button>
          </div>` : ''}
        </div>`);
    }
    for (const r of dossier.restitutions) {
      lignes.push(`
        <div class="regul-op${r.annule_le ? ' annulee' : ''}" data-op="restitution" data-id="${esc(r.id)}">
          <div><b>Restitution ${eur(r.montant)}</b> · ${esc(libMode(r.mode_restitution))} · ${esc(libLieu(r.source, r.source_date, r.source_quart))}${r.beneficiaire_tiers ? ` · à ${esc(r.beneficiaire_tiers)}` : ''}</div>
          <div class="regul-op-note">${esc(r.justification)}</div>
          ${r.annule_le ? `<div class="regul-op-note">Annulée : ${esc(r.motif_annulation)}</div>` : (estManager ? `<div class="regul-op-actions"><button type="button" class="regul-annuler" data-rpc="annuler_restitution_trop_percu" data-id="${esc(r.id)}">Annuler</button></div>` : '')}
        </div>`);
    }
    if (!lignes.length) return '<div class="pd-note">Aucune opération enregistrée sur cet écart.</div>';
    const a = aide('annulation');
    return `<div class="regul-ops-titre">Opérations ${a.bouton}</div>${a.texte}${lignes.join('')}`;
  }

  function renderFormVersement(ligne, aujourdhui) {
    const am = aide('montant'), amo = aide('mode'), ac = aide('correction');
    return `
      <form class="regul-form" data-form="versement" data-cle="${nouvelleCle()}" novalidate>
        <div class="regul-form-titre">${esc(MOTIF_VERSEMENT)}</div>
        <label class="regul-champ">Montant versé ${am.bouton}<input type="text" inputmode="decimal" name="montant" autocomplete="off" placeholder="0,00"></label>${am.texte}
        <label class="regul-champ">Mode reçu ${amo.bouton}${selectMode()}</label>${amo.texte}
        <label class="regul-champ">Justificatif <input type="text" name="justificatif" placeholder="N° de reçu, référence de virement…"></label>
        ${champsLieu('v', tiroirDeLaLigne(ligne), aujourdhui, 'destination')}
        <label class="regul-champ">Correction de datation ${ac.bouton}<input type="text" name="correctionDatation" placeholder="Seulement si la date doit précéder l'écart"></label>${ac.texte}
        <div class="regul-erreur" role="alert" hidden></div>
        <button type="submit" class="regul-envoyer">Enregistrer le versement</button>
      </form>`;
  }

  function renderFormRestitution(aujourdhui) {
    const ar = aide('restitution'), at = aide('tiers');
    return `
      <form class="regul-form" data-form="restitution" data-cle="${nouvelleCle()}" novalidate>
        <div class="regul-form-titre">Restitution du trop-perçu ${ar.bouton}</div>${ar.texte}
        <label class="regul-champ">Montant rendu <input type="text" inputmode="decimal" name="montant" autocomplete="off" placeholder="0,00"></label>
        <label class="regul-champ">Mode ${selectMode()}</label>
        <label class="regul-champ">Justification <input type="text" name="justification" placeholder="Pourquoi ce montant est rendu"></label>
        ${champsLieu('r', 'coffre', aujourdhui, 'destination')}
        <label class="regul-champ regul-case"><input type="checkbox" name="tiers"> Rendu à un tiers ${at.bouton}</label>${at.texte}
        <div class="regul-tiers" hidden>
          <label class="regul-champ">Tiers <input type="text" name="beneficiaireTiers"></label>
          <label class="regul-champ">Autorisation du payeur <input type="text" name="autorisationTiers"></label>
        </div>
        <div class="regul-erreur" role="alert" hidden></div>
        <button type="submit" class="regul-envoyer">Valider la restitution</button>
      </form>`;
  }

  function renderFormTransfert(versement) {
    const a = aide('transfert');
    return `
      <form class="regul-form" data-form="transfert" data-versement="${esc(versement.id)}" data-cle="${nouvelleCle()}" novalidate>
        <div class="regul-form-titre">Transfert vers le coffre ${a.bouton}</div>${a.texte}
        <div class="pd-note">Depuis ${esc(libLieu(versement.destination, versement.recepteur_date, versement.recepteur_quart))} — reste ${eur(versement.reste_au_tiroir)}.</div>
        <label class="regul-champ">Montant <input type="text" inputmode="decimal" name="montant" autocomplete="off" value="${Number(versement.reste_au_tiroir).toFixed(2).replace('.', ',')}"></label>
        <label class="regul-champ">Motif <input type="text" name="motif" placeholder="Mise en sécurité au coffre"></label>
        <div class="regul-erreur" role="alert" hidden></div>
        <button type="submit" class="regul-envoyer">Transférer</button>
      </form>`;
  }

  // Tout le bloc d'un écart. `estManager` ne donne aucun droit : il décide
  // seulement de ce que l'écran propose ; la RLS et les RPC décident du reste.
  function renderDossier(dossier, ligne, { estManager, aujourdhui } = {}) {
    const etat = dossier.etat || {};
    let actions = '';
    if (!estManager) {
      actions = '<div class="pd-note">Les versements, restitutions et transferts sont réservés aux managers et gérants.</div>';
    } else {
      const b = blocage(etat);
      if (b) {
        actions = `<div class="regul-bloque" data-code="${b.code}"><b>${esc(b.message)}</b><br>${esc(CONSEILS[b.code])}</div>`;
      } else {
        if (Number(etat.reste_du) > 0) actions += renderFormVersement(ligne, aujourdhui);
        if (Number(etat.trop_percu) > 0) actions += renderFormRestitution(aujourdhui);
        if (!actions) actions = '<div class="pd-note">Écart soldé : rien ne reste dû.</div>';
      }
    }
    return `<div class="regul-dossier">${renderEtat(etat)}${renderOperations(dossier, estManager)}${actions}<div class="regul-transfert-zone"></div></div>`;
  }

  // --------------------------------------------------------- comportement

  function lireForm(form) {
    const s = {};
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

  function brancherAides(conteneur) {
    conteneur.querySelectorAll('.regul-aide').forEach(btn => {
      btn.addEventListener('click', ev => {
        ev.preventDefault();
        const cible = conteneur.querySelector('#' + btn.getAttribute('aria-controls'));
        if (!cible) return;
        cible.hidden = !cible.hidden;
        btn.setAttribute('aria-expanded', String(!cible.hidden));
      });
    });
  }

  function brancherLieu(form) {
    const sel = form.querySelector('select[name="emplacement"]');
    const bloc = form.querySelector('.regul-quart');
    if (!sel || !bloc) return;
    const maj = () => { bloc.hidden = sel.value === 'coffre'; };
    sel.addEventListener('change', maj); maj();
    const tiers = form.querySelector('input[name="tiers"]');
    if (tiers) tiers.addEventListener('change', () => { form.querySelector('.regul-tiers').hidden = !tiers.checked; });
  }

  // La clé vit sur le formulaire : un double appui, ou une nouvelle tentative
  // après un refus ou une coupure, la renvoie telle quelle. Elle ne change
  // qu'avec le formulaire, c'est-à-dire après un succès (rechargement).
  async function soumettre(form, ctx) {
    const bouton = form.querySelector('.regul-envoyer');
    if (bouton.disabled) return;
    const s = lireForm(form);
    const type = form.dataset.form;
    const cle = form.dataset.cle;
    let rpc, params, controle;
    if (type === 'versement') {
      controle = controlerVersement(s, ctx.dossier.etat, ctx);
      rpc = 'enregistrer_versement_regularisation';
      params = () => parametresVersement(ctx.origine, s, controle.montant, cle);
    } else if (type === 'restitution') {
      controle = controlerRestitution(s, ctx.dossier.etat, ctx);
      rpc = 'enregistrer_restitution_trop_percu';
      params = () => parametresRestitution(ctx.origine, s, controle.montant, cle);
    } else {
      const v = ctx.dossier.versements.find(x => x.id === form.dataset.versement);
      controle = controlerTransfert(s, v);
      rpc = 'enregistrer_transfert_coffre';
      params = () => parametresTransfert(v, s, controle.montant, cle);
    }
    if (controle.problemes.length) { montrerErreur(form, controle.problemes); return; }
    bouton.disabled = true;
    const texte = bouton.textContent;
    bouton.textContent = 'Enregistrement…';
    try {
      await appeler(ctx.client, rpc, params());
      await ctx.apresSucces();
    } catch (e) {
      montrerErreur(form, lireErreur(e));
      bouton.disabled = false; bouton.textContent = texte;
    }
  }

  function brancherDossier(conteneur, ctx) {
    brancherAides(conteneur);
    conteneur.querySelectorAll('form.regul-form').forEach(form => {
      brancherLieu(form);
      form.addEventListener('submit', ev => { ev.preventDefault(); soumettre(form, ctx); });
    });
    conteneur.querySelectorAll('.regul-ouvrir-transfert').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = ctx.dossier.versements.find(x => x.id === btn.dataset.id);
        const zone = conteneur.querySelector('.regul-transfert-zone');
        zone.innerHTML = renderFormTransfert(v);
        brancherDossier(zone, ctx);
        zone.scrollIntoView && zone.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
    conteneur.querySelectorAll('.regul-annuler').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        const motif = (ctx.demanderMotif || global.prompt)('Motif de l\'annulation (au moins 5 caractères) :');
        if (motif == null) return;
        if (String(motif).trim().length < 5) { (ctx.alerter || global.alert)('Un motif d\'annulation exige au moins 5 caractères.'); return; }
        const champ = btn.dataset.rpc === 'annuler_versement_regularisation' ? 'p_versement_id'
          : btn.dataset.rpc === 'annuler_restitution_trop_percu' ? 'p_restitution_id' : 'p_transfert_id';
        btn.disabled = true;
        try {
          await appeler(ctx.client, btn.dataset.rpc, { [champ]: btn.dataset.id, p_motif: String(motif).trim() });
          await ctx.apresSucces();
        } catch (e) {
          const err = lireErreur(e);
          (ctx.alerter || global.alert)(`${err.message}${err.conseil ? '\n' + err.conseil : ''}`);
          btn.disabled = false;
        }
      });
    });
  }

  global.NexusRegularisationSaisie = {
    MODES, EMPLACEMENTS, AIDES, CONSEILS, MOTIF_VERSEMENT,
    nouvelleCle, origineDepuisLigne, tiroirDeLaLigne, lireMontant, lireErreur,
    controlerVersement, controlerRestitution, controlerTransfert,
    parametresVersement, parametresRestitution, parametresTransfert,
    chargerDossier, annoterVersements, renderDossier, brancherDossier, blocage,
  };
})(typeof window !== 'undefined' ? window : globalThis);
