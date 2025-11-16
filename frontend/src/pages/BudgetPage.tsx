import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { apiClient } from '../utils/apiClient';
import {
  ACTIONS_STORAGE_KEY,
  type AccountContribution,
  readStoredActions
} from '../utils/accountActions';

type Envelope = {
  id: string;
  category: string;
  amount: number;
  note: string;
};

type InvestmentTarget = {
  id: string;
  product: string;
  target: number;
  monthly: number;
  comment: string;
};

type AccountSummary = {
  id: string;
  name: string;
  currency: string;
};

type MonthlyContributionDetail = AccountContribution & {
  accountId: string;
  accountName: string;
  currency: string;
};

const initialEnvelopes: Envelope[] = [
  { id: 'housing', category: 'Logement', amount: 1100, note: 'Loyer + assurance' },
  { id: 'bills', category: 'Charges fixes', amount: 480, note: 'Énergie, abonnements' },
  { id: 'food', category: 'Alimentation', amount: 450, note: 'Courses + restaurants' },
  { id: 'transport', category: 'Mobilité', amount: 160, note: 'Transport + carburant' },
  { id: 'fun', category: 'Vie perso / loisirs', amount: 220, note: 'Sport, sorties' },
  { id: 'health', category: 'Santé / bien-être', amount: 120, note: 'Mutuelle, pharmacie' }
];

const initialInvestmentTargets: InvestmentTarget[] = [
  { id: 'pea', product: 'PEA - ETF Monde', target: 40000, monthly: 350, comment: 'Horizon 10 ans' },
  { id: 'assurance-vie', product: 'Assurance-vie profil équilibré', target: 15000, monthly: 200, comment: 'Objectif vacances / projets' },
  { id: 'crypto', product: 'Allocation crypto', target: 5000, monthly: 80, comment: 'Ticket spéculatif < 5 %' }
];

const initialPlan: MonthlyPlan = {
  income: '4 200',
  recurring: '1 950',
  savings: '600',
  investments: '800',
  notes: 'Prévoir une enveloppe supplémentaire pour les vacances de mai.'
};

export function BudgetPage() {
  const [netIncome, setNetIncome] = useState(3500);
  const [envelopes, setEnvelopes] = useState<Envelope[]>(initialEnvelopes);
  const [investmentTargets, setInvestmentTargets] = useState<InvestmentTarget[]>(initialInvestmentTargets);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [accountActions, setAccountActions] = useState<Record<string, AccountContribution[]>>(
    () => readStoredActions()
  );

  useEffect(() => {
    let isMounted = true;
    const fetchAccounts = async () => {
      try {
        const response = await apiClient.get<{ data: AccountSummary[] }>('/accounts');
        if (isMounted) {
          setAccounts(response.data.data);
        }
      } catch {
        // silently ignore, budget view still works with stored contributions
      }
    };
    void fetchAccounts();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === ACTIONS_STORAGE_KEY) {
        setAccountActions(readStoredActions());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const monthlyContributionFlow = useMemo(() => {
    return Object.values(accountActions).reduce((sum, contributions) => {
      if (!contributions) {
        return sum;
      }
      const monthlySum = contributions
        .filter((contribution) => contribution.cadence === 'monthly')
        .reduce(
          (subTotal, contribution) =>
            subTotal + (contribution.kind === 'withdrawal' ? -contribution.amount : contribution.amount),
          0
        );
      return sum + monthlySum;
    }, 0);
  }, [accountActions]);

  const monthlyContributionDetails = useMemo(() => {
    const accountIndex = accounts.reduce<Record<string, AccountSummary>>((acc, account) => {
      acc[account.id] = account;
      return acc;
    }, {});
    return Object.entries(accountActions).reduce<MonthlyContributionDetail[]>((acc, [accountId, contributions]) => {
      if (!contributions) {
        return acc;
      }
      const meta = accountIndex[accountId];
      const mapped = contributions
        .filter((contribution) => contribution.cadence === 'monthly')
        .map((contribution) => ({
          ...contribution,
          accountId,
          accountName: meta?.name ?? 'Compte non identifié',
          currency: meta?.currency ?? 'EUR'
        }));
      return [...acc, ...mapped];
    }, []);
  }, [accountActions, accounts]);

  const sortedMonthlyContributionDetails = useMemo(() => {
    return [...monthlyContributionDetails].sort((a, b) => {
      if (a.accountName === b.accountName) {
        return a.label.localeCompare(b.label);
      }
      return a.accountName.localeCompare(b.accountName);
    });
  }, [monthlyContributionDetails]);

  const totals = useMemo(() => {
    const totalEnvelopes = envelopes.reduce((acc, envelope) => acc + envelope.amount, 0);
    const investableBeforeTrackedPlans = netIncome - totalEnvelopes;
    const investableAfterPlans = investableBeforeTrackedPlans - monthlyContributionFlow;
    const coverage = netIncome === 0 ? 0 : (totalEnvelopes / netIncome) * 100;
    return { totalEnvelopes, coverage, investableBeforeTrackedPlans, investableAfterPlans };
  }, [envelopes, netIncome, monthlyContributionFlow]);

  const handleEnvelopeChange = (id: string, field: 'category' | 'amount' | 'note', value: string) => {
    setEnvelopes((prev) =>
      prev.map((envelope) =>
        envelope.id === id
          ? {
              ...envelope,
              [field]: field === 'amount' ? Number(value) || 0 : value
            }
          : envelope
      )
    );
  };

  const handleAddEnvelope = () => {
    setEnvelopes((prev) => [
      ...prev,
      {
        id: `envelope-${Date.now()}`,
        category: 'Nouvelle enveloppe',
        amount: 0,
        note: ''
      }
    ]);
  };

  const handleRemoveEnvelope = (id: string) => {
    setEnvelopes((prev) => prev.filter((envelope) => envelope.id !== id));
  };

  const handleInvestmentTargetChange = (
    id: string,
    field: keyof InvestmentTarget,
    value: string
  ) => {
    setInvestmentTargets((prev) =>
      prev.map((target) =>
        target.id === id
          ? {
              ...target,
              [field]: field === 'target' || field === 'monthly' ? Number(value) || 0 : value
            }
          : target
      )
    );
  };

  const handleAddInvestmentTarget = () => {
    setInvestmentTargets((prev) => [
      ...prev,
      {
        id: `invest-${Date.now()}`,
        product: 'Nouveau support',
        target: 0,
        monthly: 0,
        comment: ''
      }
    ]);
  };

  return (
    <section className="budget-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Vue budget</p>
          <h2>Pilotez vos enveloppes et le reste à investir</h2>
          <p>
            Indiquez votre salaire net, paramétrez toutes vos enveloppes connues et visualisez
            instantanément la capacité que vous pouvez envoyer vers vos placements.
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="card stat-card highlight-card">
          <h4>Salaire net</h4>
          <p>{netIncome.toLocaleString('fr-FR')} €</p>
          <small>Montant mensuel encaissé</small>
        </div>
        <div className="card stat-card">
          <h4>Enveloppes configurées</h4>
          <p>{totals.totalEnvelopes.toLocaleString('fr-FR')} €</p>
          <small>{totals.coverage.toFixed(1)} % de vos revenus</small>
        </div>
        <div className="card stat-card">
          <h4>Versements mensuels suivis</h4>
          <p>
            {monthlyContributionFlow.toLocaleString('fr-FR', {
              style: 'currency',
              currency: 'EUR'
            })}
          </p>
          <small>Flux net programmé sur vos comptes</small>
        </div>
        <div className={`card stat-card ${totals.investableAfterPlans >= 0 ? '' : 'warning-card'}`}>
          <h4>Reste à investir</h4>
          <p>{totals.investableAfterPlans.toLocaleString('fr-FR')} €</p>
          <small>
            {totals.investableAfterPlans >= 0
              ? `Après dépenses et versements (${monthlyContributionFlow.toLocaleString('fr-FR')} €/mois)`
              : 'Vous dépassez votre salaire net'}
          </small>
        </div>
        <div className="card stat-card">
          <h4>Allocation mensuelle visée</h4>
          <p>
            {investmentTargets
              .reduce((acc, target) => acc + target.monthly, 0)
              .toLocaleString('fr-FR')}{' '}
            €
          </p>
          <small>Somme des objectifs par support</small>
        </div>
      </div>

      <div className="grid budget-charts-grid">
        <div className="card chart-card">
          <div className="card-header">
            <div>
              <h3>Répartition des enveloppes</h3>
              <p>Visualisez la place occupée par chaque catégorie dans votre salaire net.</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={envelopes} barGap={8}>
              <XAxis dataKey="category" />
              <YAxis tickFormatter={(value) => `${value} €`} />
              <Tooltip formatter={(value: number) => `${value.toLocaleString('fr-FR')} €`} />
              <Bar dataKey="amount" fill="#A0C4FF" name="Enveloppe" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card budget-invest-card">
          <h3>Plan d&apos;investissement mensuel</h3>
          <p className="form-hint">
            Définissez la part de vos revenus à orienter vers l&apos;investissement après dépenses
            fixes et épargne de précaution.
          </p>
          <div className="form-grid">
            <label>
              Salaire net encaissé
              <input
                type="number"
                min={0}
                value={netIncome}
                onChange={(event) => setNetIncome(Number(event.target.value) || 0)}
              />
            </label>
            <label>
              Couverture des enveloppes
              <input type="text" value={`${totals.coverage.toFixed(1)} %`} readOnly />
            </label>
            <label>
              Capacité après enveloppes
              <input
                type="text"
                value={`${totals.investableBeforeTrackedPlans.toLocaleString('fr-FR')} €`}
                readOnly
              />
            </label>
            <label>
              Versements suivis
              <input
                type="text"
                value={`${monthlyContributionFlow.toLocaleString('fr-FR')} €/mois`}
                readOnly
              />
            </label>
            <label>
              Reste après versements
              <input
                type="text"
                value={`${totals.investableAfterPlans.toLocaleString('fr-FR')} €`}
                readOnly
              />
            </label>
            <p className="form-hint span-2">
              Ajoutez autant d&apos;enveloppes que nécessaire pour couvrir vos dépenses fixes,
              variables ou projets personnels. Les versements suivis depuis vos comptes sont
              également pris en compte dans votre reste disponible.
            </p>
          </div>
        </div>
      </div>

      <div className="card table-card">
        <div className="table-header">
          <div>
            <h3>Paramétrage des enveloppes</h3>
            <p className="form-hint">Listez toutes vos dépenses connues pour sécuriser votre budget.</p>
          </div>
          <button className="ghost-button" onClick={handleAddEnvelope} type="button">
            + Ajouter une enveloppe
          </button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Catégorie</th>
              <th>Montant mensuel</th>
              <th>Note / détails</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {envelopes.map((envelope) => (
              <tr key={envelope.id}>
                <td>
                  <input
                    className="inline-input"
                    type="text"
                    value={envelope.category}
                    onChange={(event) =>
                      handleEnvelopeChange(envelope.id, 'category', event.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    className="inline-input"
                    type="number"
                    min={0}
                    value={envelope.amount}
                    onChange={(event) =>
                      handleEnvelopeChange(envelope.id, 'amount', event.target.value)
                    }
                  />
                  €
                </td>
                <td>
                  <input
                    className="inline-input"
                    type="text"
                    value={envelope.note}
                    onChange={(event) =>
                      handleEnvelopeChange(envelope.id, 'note', event.target.value)
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="ghost-button danger"
                    onClick={() => handleRemoveEnvelope(envelope.id)}
                  >
                    Retirer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid budget-section-grid">
        <div className="card">
          <h3>Objectifs de placement par support</h3>
          <p className="form-hint">
            Définissez le montant cible et l&apos;effort mensuel pour chaque produit (PEA, assurance-vie,
            crypto, crowdfunding, etc.).
          </p>
          <div className="investment-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Support</th>
                  <th>Objectif final</th>
                  <th>Versement mensuel</th>
                  <th>Commentaire</th>
                </tr>
              </thead>
              <tbody>
                {investmentTargets.map((target) => (
                  <tr key={target.id}>
                    <td>
                      <input
                        className="inline-input"
                        type="text"
                        value={target.product}
                        onChange={(event) =>
                          handleInvestmentTargetChange(target.id, 'product', event.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="inline-input"
                        type="number"
                        min={0}
                        value={target.target}
                        onChange={(event) =>
                          handleInvestmentTargetChange(target.id, 'target', event.target.value)
                        }
                      />
                      €
                    </td>
                    <td>
                      <input
                        className="inline-input"
                        type="number"
                        min={0}
                        value={target.monthly}
                        onChange={(event) =>
                          handleInvestmentTargetChange(target.id, 'monthly', event.target.value)
                        }
                      />
                      €
                    </td>
                    <td>
                      <input
                        className="inline-input"
                        type="text"
                        value={target.comment}
                        onChange={(event) =>
                          handleInvestmentTargetChange(target.id, 'comment', event.target.value)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="ghost-button" type="button" onClick={handleAddInvestmentTarget}>
            + Ajouter un support
          </button>
        </div>
        <div className="card table-card">
          <div className="table-header">
            <div>
              <h3>Versements mensuels suivis</h3>
              <p className="form-hint">
                Visualisez vos montants programmés et l&apos;allocation par compte depuis la page comptes.
              </p>
            </div>
          </div>
          {sortedMonthlyContributionDetails.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Compte</th>
                  <th>Intitulé</th>
                  <th>Flux mensuel</th>
                  <th>Début</th>
                </tr>
              </thead>
              <tbody>
                {sortedMonthlyContributionDetails.map((contribution) => (
                  <tr key={contribution.id}>
                    <td>{contribution.accountName}</td>
                    <td>{contribution.label}</td>
                    <td>
                      <span className={`amount-pill ${contribution.kind}`}>
                        {contribution.kind === 'withdrawal' ? '-' : '+'}
                        {contribution.amount.toLocaleString('fr-FR', {
                          style: 'currency',
                          currency: contribution.currency
                        })}
                        /mois
                      </span>
                    </td>
                    <td>{new Date(contribution.date).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="chart-placeholder">
              Aucun versement mensuel suivi pour l&apos;instant. Ajoutez-les depuis vos comptes pour
              qu&apos;ils soient déduits de votre reste à investir.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
