'use strict';
// NEXUS PAYE — les scénarios de recette du cahier des charges du 09/10/2026.
//
// Le §6 interdit le double comptage, et le §11 énumère les journées qu'il
// faut savoir chiffrer. Le moteur consolide déjà : un Set de postes par
// journée, et une priorité « caisse ou piste constatée par Verify avant un
// renfort ». Du code non éprouvé n'est pourtant qu'une intention : rien ne
// signalerait son remplacement par une somme.
//
// Chaque vérification ci-dessous est un scénario du §11, nommé par son
// numéro, joué contre le VRAI moteur sur un mois construit à la main.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console: { log() {}, warn() {}, error() {} } };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-paye-moteur.js'), 'utf8'), ctx);
const M = ctx.NexusPayeMoteur;

let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

const SITE = 'vito-sainte-marie';
const PERIODE = '2026-09-01';
// Septembre 2026 : le 7 est un lundi, le 10 un jeudi, le 11 un vendredi.
const LUNDI = '2026-09-07', JEUDI = '2026-09-10', VENDREDI = '2026-09-11', SAMEDI = '2026-09-12';
const NOMS = { [LUNDI]: 'lundi', [JEUDI]: 'jeudi', [VENDREDI]: 'vendredi', [SAMEDI]: 'samedi' };
for (const d of [LUNDI, JEUDI, VENDREDI, SAMEDI])
  verifier(`le calendrier de l’épreuve est juste : le ${d.slice(8)}/09/2026 est un ${NOMS[d]}`,
    ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][new Date(`${d}T12:00:00`).getDay()] === NOMS[d]);

const EMP = {
  caisse: { id: 'e-caisse', nom: 'Camille', role: 'caissier', actif: true, site_id: SITE },
  piste: { id: 'e-piste', nom: 'Bruno', role: 'pompiste', actif: true, site_id: SITE },
  renfort: { id: 'e-renfort', nom: 'Angélique', role: 'renfort', actif: true, site_id: SITE },
};
const reglage = id => ({ employee_id: id, site_id: SITE, inclus_paye: true, mode_presence: 'automatique', confirme_le: '2026-01-02T08:00:00Z' });

// L'horaire standard du renfort vient des Paramètres Station. 08:00 -> 16:30
// moins 30 min font 8 h nettes, et non 7 h : un horaire distinct du repli
// est ce qui rend visible une rupture de transmission (leçon de l'épreuve
// du 09/10/2026 sur la couche de données).
const HORAIRES = { renfort: { debut: '08:00', fin: '16:30', pause_debut: '12:00', pause_fin: '12:30' } };

function rapport(entree) {
  return M.construireRapport(Object.assign({
    periode: PERIODE, employees: [], settings: [], planning: [], pointages: [],
    indisponibilites: [], audits: [], items: [], ecarts: [],
    config: { jours_feries: [] }, horaires: HORAIRES,
  }, entree));
}
const fiche = (r, id) => r.employes.find(f => f.employee.id === id);
const audit = (id, date, champs) => Object.assign({ id, date, quart: '1', statut: 'cloture',
  employes_piste: [], employes_boutique: [], employes_renfort: [] }, champs);
const shift = (employee_id, date, champs) => Object.assign({ employee_id, date, quart: 'quart1',
  statut: 'travail_normal', duree_heures: 7, tache: 'boutique' }, champs);

// ── §11.1 à §11.3 : la durée de référence du jour, et elle seule ─────────
{
  const r = rapport({
    employees: [EMP.caisse, EMP.piste], settings: [reglage('e-caisse'), reglage('e-piste')],
    audits: [audit('a1', LUNDI, { employes_boutique: ['e-caisse'] }),
             audit('a2', JEUDI, { employes_piste: ['e-piste'] }),
             audit('a3', VENDREDI, { employes_boutique: ['e-caisse'] })],
  });
  const c = fiche(r, 'e-caisse'), p = fiche(r, 'e-piste');
  verifier('§11.1 — une caissière constatée le lundi vaut 7 h', c.heuresConfirmees === 15 && c.heuresCaisse === 15);
  verifier('§11.2 — un pompiste constaté le jeudi vaut 8 h', p.heuresConfirmees === 8 && p.heuresPiste === 8);
  verifier('§11.3 — une caissière constatée le vendredi vaut 8 h',
    c.items.filter(i => i.date === VENDREDI && i.heuresAttribuees === 8).length === 1);
  verifier('les heures de la caissière ne sont jamais ventilées en piste', c.heuresPiste === 0);
}

// ── §11.4 : le planning ne plafonne pas les heures justifiées ───────────
{
  const r = rapport({
    employees: [EMP.caisse], settings: [reglage('e-caisse')],
    audits: [audit('a1', VENDREDI, { employes_boutique: ['e-caisse'] })],
    planning: [shift('e-caisse', VENDREDI, { duree_heures: 7 })],
  });
  const c = fiche(r, 'e-caisse');
  const e = r.ecartsVerifyPlanning.find(i => i.date === VENDREDI);
  verifier('§11.4 — le planning prévoit 7 h, Verify constate le vendredi : 8 h retenues', c.heuresConfirmees === 8);
  verifier('§11.4 — et l’écart est signalé au manager', !!e && e.heuresPlanning === 7 && e.heuresRetenues === 8);
  verifier('§11.4 — l’écart ne retire ni ne bloque aucune heure', e.impactPaye === false && r.bloqueurs.length === 0);
  verifier('§11.4 — l’écart n’est pas une heure supplémentaire : seule la 8e heure du barème l’est (Q1), sans carte ni montant',
    e.heuresSupplementaires === 1 && c.heuresSuppBareme === 1 && e.montantCentimes == null
    && !c.items.some(i => i.typeItem === 'heure_supplementaire'));
}

// ── §11.5 : une journée absente du planning reste constatée ─────────────
{
  const r = rapport({
    employees: [EMP.caisse], settings: [reglage('e-caisse')],
    audits: [audit('a1', LUNDI, { employes_boutique: ['e-caisse'] })],
    planning: [shift('e-caisse', JEUDI)],
  });
  const c = fiche(r, 'e-caisse');
  const e = r.ecartsVerifyPlanning.find(i => i.date === LUNDI);
  verifier('§11.5 — la journée absente du planning garde ses heures', c.heuresConfirmees === 7);
  verifier('§11.5 — et produit une anomalie de concordance, pas un blocage',
    !!e && e.statut === 'information' && e.sourceFonctionPrevue === null);
  verifier('§11.5 — rien n’attend de validation pour cette journée',
    !c.items.some(i => i.date === LUNDI && i.statut === 'a_verifier'));
}

// ── §11.6 et §11.7 : le renfort déclaré, planning ou non ────────────────
{
  const r = rapport({
    employees: [EMP.renfort], settings: [reglage('e-renfort')],
    audits: [audit('a1', LUNDI, { employes_renfort: ['e-renfort'] })],
  });
  const f = fiche(r, 'e-renfort');
  verifier('§11.6 — un renfort déclaré est retenu à l’horaire standard de la station : 8 h nettes',
    f.heuresConfirmees === 8 && f.heuresRenfort === 8);
  verifier('§11.7 — aucun planning n’était disponible, la déclaration est conservée malgré tout',
    f.items.some(i => i.date === LUNDI && i.heuresAttribuees === 8));
  verifier('§11.7 — et l’absence de planning ne produit pas de blocage', r.bloqueurs.length === 0);
}

// ── §11.8 : l’horaire modifié par le manager recalcule la durée nette ───
{
  const r = rapport({
    employees: [EMP.renfort], settings: [reglage('e-renfort')],
    audits: [audit('a1', LUNDI, { employes_renfort: ['e-renfort'] })],
    items: [{ employee_id: 'e-renfort', periode: PERIODE, date_evenement: LUNDI, origine: 'manuel',
      type_item: 'horaire_exceptionnel', statut: 'valide', source_cle: `horaire-exceptionnel:e-renfort:${LUNDI}`,
      libelle: 'Horaire exceptionnel 10:00 à 15:00', quantite_minutes: 240, impact_paye: false,
      note: 'fermeture anticipée',
      detail: { debut: '10:00', fin: '15:00', pause_minutes: 30, motif: 'fermeture anticipée',
                auteur: 'manager-1', heures_initiales: 8 } }],
  });
  const f = fiche(r, 'e-renfort');
  verifier('§11.8 — la durée nette est recalculée depuis début, fin et pause : 4,5 h et non les 8 h standard',
    f.heuresConfirmees === 4.5);
  // Les corrections du manager sont un axe de PROVENANCE, non un quatrième
  // seau de postes : la journée corrigée compte une fois dans le total, et
  // se lit à la fois sous son poste et sous « dont corrections ». L'écran
  // doit donc dire « dont », faute de quoi 4,5 h se liraient 9 h.
  verifier('§11.8 — ces heures sont tracées comme correction du manager',
    f.heuresExceptionnelles === 4.5);
  verifier('§11.8 — elles restent rattachées au poste tenu, sans s’ajouter au total',
    f.heuresRenfort === 4.5 && f.heuresConfirmees === 4.5);
  verifier('§11.8 — la correction ne paie pas la journée une seconde fois : un seul item porte les heures',
    f.items.filter(i => i.date === LUNDI && Number(i.heuresAttribuees) > 0).length === 1);
}

// ── §11.9 : caisse constatée par Verify l’emporte sur un renfort ────────
{
  const r = rapport({
    employees: [EMP.caisse], settings: [reglage('e-caisse')],
    audits: [audit('a1', LUNDI, { employes_boutique: ['e-caisse'], employes_renfort: ['e-caisse'] })],
  });
  const f = fiche(r, 'e-caisse');
  verifier('§11.9 — la même personne en caisse ET en renfort le même jour ne compte qu’une journée : 7 h',
    f.heuresConfirmees === 7);
  verifier('§11.9 — et c’est la caisse qui l’emporte, conformément à la priorité du §6',
    f.heuresCaisse === 7 && f.heuresRenfort === 0);
  verifier('§11.9 — une seule journée est portée au calcul', f.joursConfirmes.size === 1);
}

// ── §11.10 : un renfort déclaré deux fois ne vaut qu’une journée ────────
{
  const r = rapport({
    employees: [EMP.renfort], settings: [reglage('e-renfort')],
    audits: [audit('a1', LUNDI, { employes_renfort: ['e-renfort'] }),
             audit('a2', LUNDI, { employes_renfort: ['e-renfort'] })],
  });
  const f = fiche(r, 'e-renfort');
  verifier('§11.10 — deux clôtures du même jour déclarant le même renfort ne valent qu’une journée : 8 h',
    f.heuresConfirmees === 8 && f.heuresRenfort === 8);
  verifier('§11.10 — un seul item porte les heures de cette journée',
    f.items.filter(i => i.date === LUNDI && Number(i.heuresAttribuees) > 0).length === 1);
  verifier('§11.10 — le doublon n’apparaît pas non plus comme deux journées confirmées', f.joursConfirmes.size === 1);
}

// ── §11.11 : aucun retard déduit d’une absence de pointage ──────────────
{
  const r = rapport({
    employees: [EMP.caisse], settings: [reglage('e-caisse')],
    audits: [audit('a1', LUNDI, { employes_boutique: ['e-caisse'] })],
    planning: [shift('e-caisse', LUNDI)],
  });
  const f = fiche(r, 'e-caisse');
  const v = M.variablesComptables(f);
  verifier('§11.11 — aucun pointage n’existe, le retard reste à 0 minute', v.retards.minutes === 0);
  verifier('§11.11 — et aucun retard n’est déduit de l’écart de 1 h avec le planning', v.retards.occurrences === 0 && v.retards.enAttente === 0);
  verifier('§11.11 — la journée est néanmoins confirmée et payée', f.heuresConfirmees === 7);
}

// ── §11.14 : une clôture modifiée reste cohérente ───────────────────────
{
  const commun = { employees: [EMP.caisse, EMP.renfort], settings: [reglage('e-caisse'), reglage('e-renfort')] };
  const avant = rapport(Object.assign({}, commun, {
    audits: [audit('a1', LUNDI, { employes_boutique: ['e-caisse'] })] }));
  // La même clôture, rouverte, voit s'ajouter un renfort oublié.
  const apres = rapport(Object.assign({}, commun, {
    audits: [audit('a1', LUNDI, { employes_boutique: ['e-caisse'], employes_renfort: ['e-renfort'] })] }));
  verifier('§11.14 — la clôture modifiée n’altère pas les heures déjà justifiées de la caissière',
    fiche(avant, 'e-caisse').heuresConfirmees === fiche(apres, 'e-caisse').heuresConfirmees);
  verifier('§11.14 — et le renfort ajouté est pris en compte sans recalcul manuel',
    fiche(avant, 'e-renfort').heuresConfirmees === 0 && fiche(apres, 'e-renfort').heuresConfirmees === 8);
}

// ── §6 : les postes sont consolidés avant calcul, jamais additionnés ────
{
  const r = rapport({
    employees: [EMP.caisse], settings: [reglage('e-caisse')],
    audits: [audit('a1', JEUDI, { employes_piste: ['e-caisse'] }),
             audit('a2', JEUDI, { employes_boutique: ['e-caisse'] }),
             audit('a3', JEUDI, { employes_renfort: ['e-caisse'] })],
  });
  const f = fiche(r, 'e-caisse');
  verifier('§6 — trois postes sur la même journée ne font pas trois journées : 8 h, pas 24 h',
    f.heuresConfirmees === 8);
  verifier('§6 — la piste constatée l’emporte, et la ventilation par poste égale le total',
    Math.round((f.heuresCaisse + f.heuresPiste + f.heuresRenfort) * 100) / 100 === f.heuresConfirmees
    && f.heuresPiste === 8);
  verifier('§6 — la priorité est bien celle du cahier des charges, lue dans le moteur',
    M.posteDuJour('e-caisse', null, [], EMP.caisse, new Set(['renfort', 'caissier'])) === 'caissier'
    && M.posteDuJour('e-caisse', null, [], EMP.caisse, new Set(['renfort'])) === 'renfort');
}

// ── La synthèse du mois reste la somme des fiches ────────────────────────
{
  const r = rapport({
    employees: [EMP.caisse, EMP.piste, EMP.renfort],
    settings: [reglage('e-caisse'), reglage('e-piste'), reglage('e-renfort')],
    audits: [audit('a1', LUNDI, { employes_boutique: ['e-caisse'], employes_renfort: ['e-renfort'] }),
             audit('a2', JEUDI, { employes_piste: ['e-piste'] })],
  });
  const total = r.employes.reduce((s, f) => s + f.heuresConfirmees, 0);
  verifier('la synthèse du mois ventile caisse, piste et renfort sans perdre d’heure',
    Math.round((r.synthese.heuresCaisse + r.synthese.heuresPiste + r.synthese.heuresRenfort) * 100) / 100 === Math.round(total * 100) / 100);
  verifier('et les 7 h de caisse, 8 h de piste et 8 h de renfort s’y lisent séparément',
    r.synthese.heuresCaisse === 7 && r.synthese.heuresPiste === 8 && r.synthese.heuresRenfort === 8);
}

console.log(`\nNEXUS PAYE — scénarios de recette du 09/10/2026 : ${ok}/${ok} vérifications passent.`);
