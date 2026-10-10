// La couche de données tient-elle sans la colonne qui n'existe pas encore ?
//
// LE DÉFAUT QUE CETTE ÉPREUVE INTERDIT. `audits_caisse.employes_renfort` est
// créée par la migration du 09/10/2026, qui n'est appliquée nulle part et
// attend sa gate humaine. Demandée dans le select principal de Paye, une
// colonne inexistante fait échouer TOUTE la requête : Paye ne s'ouvrirait plus
// du tout, et le mois entier deviendrait illisible faute d'une colonne qui ne
// sert qu'à une rubrique.
//
// Ces vérifications jouent les deux états de la base — avant la migration et
// après — sur le MÊME code. Avant : le chargement aboutit, le rapport dit que
// les renforts ne sont pas lisibles. Après : les renforts arrivent, et rien
// d'autre ne change.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['nexus-paye-moteur.js', 'nexus-paye-donnees.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), ctx);
}
// La couche de données appelle le module des écarts consolidés ; ici il ne
// doit rien inventer, juste ne pas manquer.
ctx.NexusEcartsDonnees = { chargerEcartsConsolides: async () => [] };

const D = ctx.NexusPayeDonnees;
const SITE = 'vito-sainte-marie';
const PERIODE = '2026-09-01';

const EMPLOYES = [
  { id: 'e-caisse', nom: 'Camille', role: 'caissier', actif: true, site_id: SITE },
  { id: 'e-renfort', nom: 'Angélique', role: 'renfort', actif: true, site_id: SITE },
];
const REGLAGES = [
  { employee_id: 'e-caisse', site_id: SITE, inclus_paye: true, mode_presence: 'automatique' },
  { employee_id: 'e-renfort', site_id: SITE, inclus_paye: true, mode_presence: 'automatique' },
];
// Mardi 01/09/2026 : la caissière est en boutique, un renfort est déclaré.
const AUDIT = { id: 'a1', date: '2026-09-01', quart: '1', statut: 'cloture',
                employes_piste: [], employes_boutique: ['e-caisse'] };

// 08:00 -> 16:30 moins 30 min de pause = 8 h nettes, et NON 7 h.
//
// Le choix de cet horaire n'est pas cosmétique. Avec les 9 h - 17 h de la
// station, le renfort vaut 7 h — exactement ce que le moteur rend aussi
// quand on ne lui transmet AUCUN horaire, par repli. Une épreuve bâtie sur
// 7 h passait donc même en coupant la transmission des horaires : je l'ai
// mesuré. Un horaire distinct du repli est ce qui rend la mutation visible.
const HORAIRES = {
  renfort: { debut: '08:00', fin: '16:30', pause_debut: '12:00', pause_fin: '12:30' },
};

/**
 * Un client Supabase simulé, à la seule fin de jouer la présence ou l'absence
 * d'une colonne. `colonneRenfort` à false reproduit l'erreur PostgREST 42703.
 */
function client({ colonneRenfort }) {
  const appels = [];
  const table = nom => {
    const requete = {
      colonnes: '',
      select(c) { this.colonnes = c; appels.push(`${nom}:${c}`); return this; },
      eq() { return this; }, gte() { return this; }, lt() { return this; },
      lte() { return this; }, order() { return this; },
      maybeSingle() { return this.then ? this : this.resoudre(true); },
      resoudre(unique) {
        const d = donnees(nom, this.colonnes, unique);
        return Promise.resolve(d);
      },
      then(ok, ko) { return this.resoudre(false).then(ok, ko); },
    };
    return requete;
  };
  const donnees = (nom, colonnes, unique) => {
    if (nom === 'audits_caisse' && /employes_renfort/.test(colonnes)) {
      if (!colonneRenfort) {
        return { data: null, error: { code: '42703',
          message: 'column audits_caisse.employes_renfort does not exist' } };
      }
      return { data: [{ id: 'a1', date: '2026-09-01', quart: '1',
                        employes_renfort: ['e-renfort'] }], error: null };
    }
    const par = {
      employees: EMPLOYES,
      nexus_paye_employee_settings: REGLAGES,
      planning_shifts: [],
      pointages: [],
      employee_indisponibilites: [],
      audits_caisse: [AUDIT],
      nexus_paye_items: [],
      nexus_paye_periodes: null,
      station_config: { paye_config: {}, horaires: HORAIRES, planning_source: 'nexus',
                        planning_google_sheet_url: null, planning_google_sheet_id: null },
    };
    const d = par[nom];
    return { data: unique ? d : (Array.isArray(d) ? d : d), error: null };
  };
  return { from: table, appels };
}

let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

(async () => {
  // ── Avant la migration : la colonne manque ───────────────────────────────
  const avant = await D.chargerRapport(client({ colonneRenfort: false }), SITE, PERIODE);
  verifier('sans la colonne, le chargement aboutit quand même',
    avant && Array.isArray(avant.employes) && avant.employes.length === 2);
  verifier('et le rapport DIT que les renforts ne sont pas lisibles',
    avant.renfortsLisibles === false);
  verifier('la journée de caisse, elle, est bien calculée : mardi -> 7 h',
    avant.employes.find(f => f.employee.id === 'e-caisse').heuresConfirmees === 7);
  verifier('et le renfort, faute de source, n’a aucune heure inventée',
    avant.employes.find(f => f.employee.id === 'e-renfort').heuresConfirmees === 0);

  // ── Après la migration : la colonne répond ───────────────────────────────
  const apres = await D.chargerRapport(client({ colonneRenfort: true }), SITE, PERIODE);
  verifier('avec la colonne, les renforts sont déclarés lisibles',
    apres.renfortsLisibles === true);
  verifier('le renfort déclaré à la clôture Verify est retenu : 8 h nettes',
    apres.employes.find(f => f.employee.id === 'e-renfort').heuresConfirmees === 8);
  verifier('ces heures viennent de l’horaire de la station, pas du repli de 7 h',
    apres.employes.find(f => f.employee.id === 'e-renfort').heuresConfirmees
      !== ctx.NexusPayeMoteur.HEURES_RENFORT_DEFAUT);
  verifier('ces heures sont ventilées en heures de renfort, pas de caisse',
    apres.employes.find(f => f.employee.id === 'e-renfort').heuresRenfort === 8
    && apres.employes.find(f => f.employee.id === 'e-renfort').heuresCaisse === 0);
  verifier('et la caissière garde exactement les mêmes heures qu’avant',
    apres.employes.find(f => f.employee.id === 'e-caisse').heuresConfirmees === 7);

  // ── Les horaires standards viennent bien des Paramètres Station ──────────
  const client2 = client({ colonneRenfort: true });
  await D.chargerRapport(client2, SITE, PERIODE);
  verifier('les horaires de la station sont demandés, pas devinés',
    client2.appels.some(a => /^station_config:.*\bhoraires\b/.test(a)));
  verifier('et la colonne renfort n’est JAMAIS demandée dans le select principal',
    client2.appels.some(a => a.startsWith('audits_caisse:') && !/employes_renfort/.test(a))
    && !client2.appels.includes('audits_caisse:id, date, quart, statut, employes_piste, employes_boutique, employes_renfort'));

  console.log(`\n${ok}/${ok} vérifications passées — une colonne absente ne doit pas fermer le mois.`);
})().catch(e => { console.error(e); process.exit(1); });
