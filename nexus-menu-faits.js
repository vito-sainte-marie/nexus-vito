/* Faits réels du menu latéral de l'employé (lot MENU-LATERAL-FAITS-REELS-20261124).
 *
 * Le menu latéral du bureau offrait à tout employé la liste la plus large de l'Accueil (caissière en service, tous les
 * droits). Ce module établit les faits réels de l'employé connecté, avec les mêmes règles que l'Accueil, puis les passe
 * à NexusMenuAccueil.groupes() : une seule liste, des faits vrais. Il ne crée aucun droit et n'écrit rien.
 * Règle commune : un fait illisible retire son entrée (jamais d'entrée offerte sur un fait inconnu).
 * Manager, gérant et créateur : liste complète du bureau, non touchée ici.
 */
(function (root) {
  'use strict';

  // Même matrice que CAPACITES_ROLE_DEFAUT de l'Accueil (NEXUS-App-v1.html).
  const CAPACITES_ROLE_DEFAUT = {
    fdj: { pompiste: false, caissiere: true, renfort: false, manager: true, polyvalent: true },
    reception: { pompiste: true, caissiere: false, renfort: false, manager: true, polyvalent: false },
  };
  function roleADroitModule(module, roleDuJour) {
    const t = CAPACITES_ROLE_DEFAUT[module];
    if (!t) return true;
    if (Object.prototype.hasOwnProperty.call(t, roleDuJour)) return t[roleDuJour] === true;
    return true;
  }

  // Calcul pur. lectures : { service:{role}|null, forfait:string|null, receptionRole:string|null,
  // datesCourtesActif:true|false|null, pointageActif:true|false|null }. null = illisible.
  function calculer(l) {
    const service = l && l.service;
    if (!service) return { estNiveauManager: false, enService: false };
    const role = service.role;
    const fdjApplicable = roleADroitModule('fdj', role) && l.forfait != null && l.forfait === 'professional';
    const receptionApplicable = roleADroitModule('reception', role)
      && (l.receptionRole === 'employe' || l.receptionRole === 'les_deux');
    const datesCourtesApplicable = role === 'renfort' ? true : (role === 'caissiere' && l.datesCourtesActif === true);
    return { estNiveauManager: false, enService: true, roleDuJour: role, receptionApplicable, fdjApplicable,
      datesCourtesApplicable, pointageActif: l.pointageActif === true };
  }

  // Lectures : chaque fait illisible vaut null. deps : { client, serviceCourant, forfait }.
  async function lire(employee, deps) {
    const c = deps.client;
    const sr = await deps.serviceCourant(employee);
    const service = sr && sr.service ? sr.service : null;
    if (!service) return { service: null };
    const site = employee.site_id;
    const sc = async (colonne) => {
      const { data, error } = await c.from('station_config').select(colonne).eq('site', site).maybeSingle();
      return error ? { ok: false } : { ok: true, v: data ? data[colonne] : null };
    };
    const [forfaitBrut, rec, pt, dc] = await Promise.all([
      deps.forfait ? deps.forfait.chargerForfait(site).catch(() => null) : null,
      sc('reception_carburant_role'),
      sc('pointage_actif'),
      service.role === 'caissiere'
        ? c.from('dates_courtes_acces_caissier').select('actif').eq('site', site).order('saisi_le', { ascending: false }).limit(1)
        : Promise.resolve(null),
    ]);
    return {
      service,
      forfait: forfaitBrut == null ? null : (deps.forfait.estProfessional(forfaitBrut) ? 'professional' : 'essential'),
      receptionRole: rec.ok ? (rec.v || 'employe') : null,
      pointageActif: pt.ok ? pt.v !== false : null,
      datesCourtesActif: dc === null ? null : (dc.error ? null : !!(dc.data && dc.data[0] && dc.data[0].actif)),
    };
  }

  async function faits(employee, deps) {
    try {
      if (!employee || !employee.id || !employee.site_id) return { estNiveauManager: false, enService: false };
      return calculer(await lire(employee, deps));
    } catch (e) { return { estNiveauManager: false, enService: false }; }
  }

  // Groupes du menu latéral (sans « Se déconnecter » ni fermeture, qui exigent le fil de l'Accueil).
  function groupesLateraux(menu, f) {
    return menu.groupes(f)
      .map((gr) => ({ code: gr.code, titre: gr.titre, entrees: gr.entrees.filter((e) => e.code !== 'deconnexion' && e.code !== 'fermeture') }))
      .filter((gr) => gr.entrees.length);
  }

  const api = { calculer, lire, faits, groupesLateraux, roleADroitModule, CAPACITES_ROLE_DEFAUT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.NexusMenuFaits = api;
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null));
