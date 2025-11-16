import axios from 'axios';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { apiClient } from '../utils/apiClient';
import {
  type AccountContribution,
  type ContributionFormState,
  createContributionDraft,
  createLocalId,
  persistStoredActions,
  readStoredActions
} from '../utils/accountActions';

const euroFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

function formatCurrency(value: number, currency = 'EUR') {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(value);
  } catch {
    return euroFormatter.format(value);
  }
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) {
    return '—';
  }
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.valueOf())) {
    return dateString;
  }
  return parsed.toLocaleDateString('fr-FR');
}

function formatTimelineDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }
  return parsed.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? 'La requête a échoué.';
  }
  return 'Une erreur inattendue est survenue.';
}

function calculateFlow(contributions: AccountContribution[]) {
  return contributions
    .filter((contribution) => contribution.cadence === 'monthly')
    .reduce(
      (sum, contribution) =>
        sum + (contribution.kind === 'withdrawal' ? -contribution.amount : contribution.amount),
      0
    );
}

function calculateOneTime(contributions: AccountContribution[]) {
  return contributions
    .filter((contribution) => contribution.cadence === 'one-time')
    .reduce(
      (sum, contribution) =>
        sum + (contribution.kind === 'withdrawal' ? -contribution.amount : contribution.amount),
      0
    );
}

type Account = {
  id: string;
  name: string;
  type: string;
  currency: string;
  value: number;
};

type AccountValue = {
  id: string;
  accountId: string;
  date: string;
  value: number;
  netFlows: number;
  createdAt: string;
};

type ValuationFormState = {
  date: string;
  value: string;
  netFlows: string;
};

function createValuationForm(): ValuationFormState {
  return {
    date: new Date().toISOString().slice(0, 10),
    value: '',
    netFlows: '0'
  };
}

export function AccountDetailsPage() {
  const { id } = useParams();
  const [account, setAccount] = useState<Account | null>(null);
  const [valuations, setValuations] = useState<AccountValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [valuationForm, setValuationForm] = useState<ValuationFormState>(() => createValuationForm());
  const [valuationError, setValuationError] = useState<string | null>(null);
  const [isSavingValuation, setIsSavingValuation] = useState(false);
  const [accountActions, setAccountActions] = useState<Record<string, AccountContribution[]>>(
    () => readStoredActions()
  );
  const [actionDraft, setActionDraft] = useState<ContributionFormState>(() => createContributionDraft());
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    persistStoredActions(accountActions);
  }, [accountActions]);

  useEffect(() => {
    let cancelled = false;
    async function fetchDetails() {
      if (!id) {
        return;
      }
      setLoading(true);
      try {
        const [accountResponse, valuationResponse] = await Promise.all([
          apiClient.get<{ data: Account }>(`/accounts/${id}`),
          apiClient.get<{ data: AccountValue[] }>(`/values`, { params: { accountId: id } })
        ]);
        if (!cancelled) {
          setAccount(accountResponse.data.data);
          setValuations(valuationResponse.data.data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function handleValuationChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setValuationForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleValuationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) {
      return;
    }
    const valueNumber = Number(valuationForm.value);
    if (!Number.isFinite(valueNumber) || valueNumber <= 0) {
      setValuationError('Indiquez une valorisation valide.');
      return;
    }
    const netFlowsNumber = Number(valuationForm.netFlows || '0');
    setIsSavingValuation(true);
    setValuationError(null);
    try {
      await apiClient.post('/values', {
        accountId: id,
        date: valuationForm.date || new Date().toISOString().slice(0, 10),
        value: valueNumber,
        netFlows: Number.isFinite(netFlowsNumber) ? netFlowsNumber : 0
      });
      const { data } = await apiClient.get<{ data: AccountValue[] }>('/values', { params: { accountId: id } });
      setValuations(data.data);
      setValuationForm((prev) => ({ ...prev, value: '' }));
    } catch (err) {
      setValuationError(getErrorMessage(err));
    } finally {
      setIsSavingValuation(false);
    }
  }

  function handleContributionChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setActionDraft((prev) => ({ ...prev, [name]: value }));
  }

  function handleAddContribution() {
    if (!id) {
      return;
    }
    if (!actionDraft.label.trim()) {
      setActionError('Donnez un nom à votre mouvement.');
      return;
    }
    const amount = Number(actionDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError('Montant invalide.');
      return;
    }
    const contribution: AccountContribution = {
      id: createLocalId(),
      label: actionDraft.label.trim(),
      amount,
      kind: actionDraft.kind,
      cadence: actionDraft.cadence,
      date: actionDraft.date || new Date().toISOString().slice(0, 10)
    };
    setAccountActions((prev) => {
      const existing = prev[id] ?? [];
      const updated = [contribution, ...existing].sort((a, b) => (a.date < b.date ? 1 : -1));
      return { ...prev, [id]: updated };
    });
    setActionDraft((prev) => ({ ...prev, label: '', amount: '' }));
    setActionError(null);
  }

  function handleRemoveContribution(contributionId: string) {
    if (!id) {
      return;
    }
    setAccountActions((prev) => {
      const existing = prev[id] ?? [];
      return { ...prev, [id]: existing.filter((item) => item.id !== contributionId) };
    });
  }

  const contributions = id ? accountActions[id] ?? [] : [];
  const monthlyFlow = useMemo(() => calculateFlow(contributions), [contributions]);
  const manualFlow = useMemo(() => calculateOneTime(contributions), [contributions]);
  const sortedValuations = useMemo(() => [...valuations].sort((a, b) => (a.date > b.date ? 1 : -1)), [valuations]);
  const latestValuation = sortedValuations[sortedValuations.length - 1];
  const previousValuation =
    sortedValuations.length > 1 ? sortedValuations[sortedValuations.length - 2] : undefined;
  const valuationDelta = useMemo(() => {
    if (!latestValuation || !previousValuation) {
      return null;
    }
    const delta = latestValuation.value - previousValuation.value;
    const ratio = previousValuation.value === 0 ? null : delta / previousValuation.value;
    return { delta, ratio };
  }, [latestValuation, previousValuation]);

  const chartData = useMemo(() => {
    return [...valuations]
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .map((item) => ({ date: item.date, value: item.value }));
  }, [valuations]);

  return (
    <section>
      <header className="page-header">
        <div>
          <p className="eyebrow">Compte</p>
          <h2>{account?.name ?? 'Compte'}</h2>
          <p>
            {account?.type ?? '—'} • {account?.currency ?? '—'}
          </p>
        </div>
        <div className="header-actions">
          <Link to="/accounts" className="secondary">
            ← Retour
          </Link>
        </div>
      </header>

      {error ? (
        <div className="status-banner error">{error}</div>
      ) : (
        <div className="status-banner success">
          {loading ? 'Chargement des données du compte…' : 'Compte synchronisé avec la base'}
        </div>
      )}

      <div className="stat-grid">
        <div className="card stat-card highlight-card">
          <div className="stat-card-heading">Valeur actuelle</div>
          <p>{latestValuation ? formatCurrency(latestValuation.value, account?.currency) : '—'}</p>
          <small>Valorisé le {formatDate(latestValuation?.date)}</small>
        </div>
        <div className="card stat-card">
          <h4>Variation récente</h4>
          {valuationDelta ? (
            <p className={valuationDelta.delta >= 0 ? 'positive' : 'negative'}>
              {valuationDelta.delta >= 0 ? '+' : ''}
              {formatCurrency(valuationDelta.delta, account?.currency)}
              {typeof valuationDelta.ratio === 'number' && (
                <span> ({(valuationDelta.ratio * 100).toFixed(1)}%)</span>
              )}
            </p>
          ) : (
            <p>—</p>
          )}
          <small>Par rapport à la précédente valorisation enregistrée.</small>
        </div>
        <div className="card stat-card">
          <h4>Flux planifiés</h4>
          <p className={monthlyFlow >= 0 ? 'positive' : 'negative'}>
            {monthlyFlow >= 0 ? '+' : ''}
            {formatCurrency(monthlyFlow, account?.currency)} /mois
          </p>
          <small>Somme des versements/retraits mensuels suivis.</small>
        </div>
        <div className="card stat-card">
          <h4>Dernières opérations ponctuelles</h4>
          <p className={manualFlow >= 0 ? 'positive' : 'negative'}>
            {manualFlow === 0 ? '—' : `${manualFlow >= 0 ? '+' : ''}${formatCurrency(manualFlow, account?.currency)}`}
          </p>
          <small>Total des opérations ponctuelles enregistrées.</small>
        </div>
      </div>

      <div className="grid detail-grid">
        <div className="card chart-card span-2">
          <div className="card-header">
            <h3>Historique des valorisations</h3>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 12, right: 24, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" tickFormatter={(value) => formatDate(value)} />
                <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k €`} />
                <Tooltip formatter={(value: number) => [formatCurrency(value, account?.currency), 'Valeur']} />
                <Line type="monotone" dataKey="value" stroke="#4E79A7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="chart-placeholder">
              Aucune valorisation pour le moment. Ajoutez-en une pour alimenter le graphique et le tableau de bord global.
            </p>
          )}
        </div>
        <div className="card form-card">
          <div className="card-header">
            <div>
              <h3>Ajouter une valorisation</h3>
              <p>Mettez à jour la valeur du compte pour alimenter l’évolution du patrimoine.</p>
            </div>
          </div>
          <form onSubmit={handleValuationSubmit} className="form-grid">
            <div>
              <label htmlFor="valuation-date">Date</label>
              <input
                id="valuation-date"
                name="date"
                type="date"
                value={valuationForm.date}
                onChange={handleValuationChange}
              />
            </div>
            <div>
              <label htmlFor="valuation-value">Valeur</label>
              <input
                id="valuation-value"
                name="value"
                type="number"
                min="0"
                step="0.01"
                value={valuationForm.value}
                onChange={handleValuationChange}
                required
              />
            </div>
            <div>
              <label htmlFor="valuation-netflows">Flux nets (optionnel)</label>
              <input
                id="valuation-netflows"
                name="netFlows"
                type="number"
                step="0.01"
                value={valuationForm.netFlows}
                onChange={handleValuationChange}
              />
            </div>
            {valuationError && <p className="form-error">{valuationError}</p>}
            <div className="form-actions">
              <button type="submit" className="primary" disabled={isSavingValuation}>
                {isSavingValuation ? 'Enregistrement…' : 'Enregistrer la valorisation'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="grid detail-grid">
        <div className="card table-card">
          <div className="card-header">
            <h3>Historique détaillé</h3>
            <span className="pill">{valuations.length} entrée(s)</span>
          </div>
          {valuations.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Valeur</th>
                  <th>Flux nets</th>
                </tr>
              </thead>
              <tbody>
                {valuations.map((valuation) => (
                  <tr key={valuation.id}>
                    <td>{formatDate(valuation.date)}</td>
                    <td>{formatCurrency(valuation.value, account?.currency)}</td>
                    <td>{formatCurrency(valuation.netFlows, account?.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="chart-placeholder">
              Enregistrez une première valorisation pour créer l’historique de ce compte.
            </p>
          )}
        </div>
        <div className="card account-details-card">
          <div className="account-details-header">
            <div>
              <h3>Versements & opérations</h3>
              <p>
                Gardez la trace de vos versements automatiques et de vos opérations ponctuelles pour mieux comprendre la
                performance de ce compte.
              </p>
            </div>
            <div className={`flow-pill ${monthlyFlow >= 0 ? 'positive' : 'negative'}`}>
              Flux mensuel suivi :
              <strong>
                {monthlyFlow >= 0 ? '+' : ''}
                {formatCurrency(monthlyFlow, account?.currency)} /mois
              </strong>
            </div>
          </div>
          <div className="action-form">
            <div>
              <label htmlFor="action-label">Intitulé</label>
              <input
                id="action-label"
                name="label"
                type="text"
                placeholder="Versement mensuel"
                value={actionDraft.label}
                onChange={handleContributionChange}
              />
            </div>
            <div>
              <label htmlFor="action-amount">Montant</label>
              <input
                id="action-amount"
                name="amount"
                type="number"
                min="0"
                step="0.01"
                value={actionDraft.amount}
                onChange={handleContributionChange}
              />
            </div>
            <div>
              <label htmlFor="action-kind">Action</label>
              <select id="action-kind" name="kind" value={actionDraft.kind} onChange={handleContributionChange}>
                <option value="deposit">Ajouter</option>
                <option value="withdrawal">Retirer</option>
              </select>
            </div>
            <div>
              <label htmlFor="action-cadence">Fréquence</label>
              <select
                id="action-cadence"
                name="cadence"
                value={actionDraft.cadence}
                onChange={handleContributionChange}
              >
                <option value="monthly">Chaque mois</option>
                <option value="one-time">Ponctuel</option>
              </select>
            </div>
            <div>
              <label htmlFor="action-date">Date</label>
              <input
                id="action-date"
                name="date"
                type="date"
                value={actionDraft.date}
                onChange={handleContributionChange}
              />
            </div>
            <div className="form-actions">
              <button type="button" className="primary" onClick={handleAddContribution}>
                Ajouter au suivi
              </button>
            </div>
            {actionError && <p className="form-error">{actionError}</p>}
          </div>
          <div className="timeline">
            {contributions.length === 0 ? (
              <p className="chart-placeholder">
                Aucun mouvement suivi pour l’instant. Ajoutez un versement récurrent ou une opération ponctuelle.
              </p>
            ) : (
              contributions.map((contribution) => (
                <div key={contribution.id} className="timeline-item">
                  <div>
                    <strong>{contribution.label}</strong>
                    <p>
                      {formatTimelineDate(contribution.date)} •{' '}
                      {contribution.kind === 'deposit' ? 'Versement' : 'Retrait'}{' '}
                      {contribution.cadence === 'monthly' ? 'mensuel' : 'ponctuel'}
                    </p>
                  </div>
                  <div className="timeline-item-actions">
                    <span className={`amount-pill ${contribution.kind}`}>
                      {contribution.kind === 'deposit' ? '+' : '-'}
                      {contribution.amount.toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: account?.currency ?? 'EUR'
                      })}
                      {contribution.cadence === 'monthly' ? '/mois' : ''}
                    </span>
                    <span className="cadence-tag">
                      {contribution.cadence === 'monthly' ? 'Automatique' : 'Ponctuel'}
                    </span>
                    <button type="button" className="tertiary" onClick={() => handleRemoveContribution(contribution.id)}>
                      Supprimer
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
