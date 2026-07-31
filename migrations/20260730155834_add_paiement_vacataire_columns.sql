alter table audits_caisse
  add column if not exists paiement_vacataire_piste numeric not null default 0,
  add column if not exists paiement_vacataire_boutique numeric not null default 0;

comment on column audits_caisse.paiement_vacataire_piste is
  'Paiement en especes (vacataire ou heures supplementaires) sorti de la caisse piste. Remplace l''usage de caisse_incidents (champ desormais legacy/inactif dans Nexus Verify), qui n''entrait dans aucun calcul.';
comment on column audits_caisse.paiement_vacataire_boutique is
  'Paiement en especes (vacataire ou heures supplementaires) sorti de la caisse boutique. Remplace l''usage de caisse_incidents (champ desormais legacy/inactif dans Nexus Verify), qui n''entrait dans aucun calcul.';
