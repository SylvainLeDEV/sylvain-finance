import axios from 'axios';
import {
  Fragment,
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useState
} from 'react';

import { Link } from 'react-router-dom';

import { apiClient } from '../utils/apiClient';
import {
  type AccountContribution,
  type ContributionFormState,
  createContributionDraft,
  createLocalId,
  persistStoredActions,
  readStoredActions
} from '../utils/accountActions';

type Account = {
  id: string;
  name: string;
  type: string;
  currency: string;
  value: number;
};

type FormState = {
  name: string;
  type: string;
  currency: string;
  initialValue: string;
  initialDate: string;
};

type AccountContribution = {
  id: string;
  label: string;
  amount: number;
  kind: 'deposit' | 'withdrawal';
  date: string;
};

type ContributionFormState = {
  label: string;
  amount: string;
  date: string;
  kind: 'deposit' | 'withdrawal';
};

const emptyFormState: FormState = {
  name: '',
  type: '',
  currency: 'EUR',
  initialValue: '',
  initialDate: ''
};

const ACTIONS_STORAGE_KEY = 'sy-finance:account-actions';

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(emptyFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [accountActions, setAccountActions] = useState<Record<string, AccountContribution[]>>(
    () => readStoredActions()
  );
  const [actionDrafts, setActionDrafts] = useState<Record<string, ContributionFormState>>({});
  const [actionErrors, setActionErrors] = useState<Record<string, string | null>>({});

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<{ data: Account[] }>('/accounts');
      setAccounts(response.data.data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    persistStoredActions(accountActions);
  }, [accountActions]);

  function openCreateForm() {
    setFormState(emptyFormState);
    setEditingAccount(null);
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEditForm(account: Account) {
    setFormState({
      name: account.name,
      type: account.type,
      currency: account.currency,
      initialValue: '',
      initialDate: ''
    });
    setEditingAccount(account);
    setFormError(null);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setFormError(null);
    setEditingAccount(null);
    setFormState(emptyFormState);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  }

  function toggleAccountDetails(accountId: string) {
    setExpandedAccountId((current) => (current === accountId ? null : accountId));
  }

  function getContributionDraft(accountId: string): ContributionFormState {
    return actionDrafts[accountId] ?? createContributionDraft();
  }

  function handleContributionDraftChange(
    accountId: string,
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;
    const field = name as keyof ContributionFormState;
    setActionDrafts((prev) => {
      const baseDraft = prev[accountId] ?? createContributionDraft();
      return {
        ...prev,
        [accountId]: { ...baseDraft, [field]: value }
      };
    });
  }

  function handleAddContribution(accountId: string) {
    const draft = getContributionDraft(accountId);
    if (!draft.label.trim()) {
      setActionErrors((prev) => ({ ...prev, [accountId]: 'Donnez un nom au mouvement.' }));
      return;
    }
    const amountValue = Number(draft.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setActionErrors((prev) => ({ ...prev, [accountId]: 'Indiquez un montant valide.' }));
      return;
    }
    const contribution: AccountContribution = {
      id: createLocalId(),
      label: draft.label.trim(),
      amount: amountValue,
      kind: draft.kind,
      date: draft.date || new Date().toISOString().slice(0, 10),
      cadence: draft.cadence
    };
    setAccountActions((prev) => {
      const existing = prev[accountId] ?? [];
      const updated = [contribution, ...existing].sort((a, b) => (a.date < b.date ? 1 : -1));
      return { ...prev, [accountId]: updated };
    });
    setActionDrafts((prev) => ({
      ...prev,
      [accountId]: {
        label: '',
        amount: '',
        date: draft.date,
        kind: draft.kind,
        cadence: draft.cadence
      }
    }));
    setActionErrors((prev) => ({ ...prev, [accountId]: null }));
  }

  function handleRemoveContribution(accountId: string, contributionId: string) {
    setAccountActions((prev) => {
      const existing = prev[accountId] ?? [];
      return { ...prev, [accountId]: existing.filter((item) => item.id !== contributionId) };
    });
  }

  function getAccountContributions(accountId: string) {
    return accountActions[accountId] ?? [];
  }

  function getAccountFlowSummary(accountId: string) {
    const contributions = getAccountContributions(accountId);
    if (!contributions.length) {
      return 0;
    }
    return contributions
      .filter((contribution) => contribution.cadence === 'monthly')
      .reduce(
        (sum, contribution) =>
          sum + (contribution.kind === 'withdrawal' ? -contribution.amount : contribution.amount),
        0
      );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      if (editingAccount) {
        await apiClient.put(`/accounts/${editingAccount.id}`, {
          name: formState.name,
          type: formState.type,
          currency: formState.currency
        });
      } else {
        const payload: Record<string, unknown> = {
          name: formState.name,
          type: formState.type,
          currency: formState.currency
        };

        if (formState.initialValue) {
          payload.initialValue = Number(formState.initialValue);
          if (formState.initialDate) {
            payload.initialDate = formState.initialDate;
          }
        }

        await apiClient.post('/accounts', payload);
      }

      await fetchAccounts();
      closeForm();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasAccounts = accounts.length > 0;

  return (
    <section>
      <header className="page-header">
        <div>
          <h2>Comptes</h2>
          <p>Gérez vos comptes et suivez leur valeur courante.</p>
        </div>
        <button type="button" className="primary" onClick={openCreateForm}>
          Ajouter un compte
        </button>
      </header>

      {error ? (
        <div className="status-banner error">{error}</div>
      ) : (
        <div className="status-banner success">
          {loading ? 'Connexion à l’API…' : `Backend connecté – ${accounts.length} compte(s) chargé(s)`}
        </div>
      )}

      {isFormOpen && (
        <div className="card form-card">
          <form onSubmit={handleSubmit} className="form-grid">
            <div>
              <label htmlFor="name">Nom</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formState.name}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="type">Type</label>
              <input
                id="type"
                name="type"
                type="text"
                required
                value={formState.type}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="currency">Devise</label>
              <input
                id="currency"
                name="currency"
                type="text"
                required
                maxLength={3}
                value={formState.currency}
                onChange={handleChange}
              />
            </div>
            {!editingAccount && (
              <>
                <div>
                  <label htmlFor="initialValue">Valeur initiale</label>
                  <input
                    id="initialValue"
                    name="initialValue"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.initialValue}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label htmlFor="initialDate">Date de valorisation</label>
                  <input
                    id="initialDate"
                    name="initialDate"
                    type="date"
                    value={formState.initialDate}
                    onChange={handleChange}
                  />
                </div>
              </>
            )}

            {formError && <p className="form-error">{formError}</p>}

            <div className="form-actions">
              <button type="button" className="secondary" onClick={closeForm}>
                Annuler
              </button>
              <button type="submit" className="primary" disabled={isSubmitting}>
                {isSubmitting ? 'Enregistrement…' : editingAccount ? 'Mettre à jour' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p>Chargement des comptes…</p>
      ) : hasAccounts ? (
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Type</th>
                <th>Devise</th>
                <th>Valeur actuelle</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const isExpanded = expandedAccountId === account.id;
                const contributions = getAccountContributions(account.id);
                const monthlyFlow = getAccountFlowSummary(account.id);
                return (
                  <Fragment key={account.id}>
                    <tr className={isExpanded ? 'expanded-row' : undefined}>
                      <td>
                        <div className="account-cell">
                          <Link to={`/accounts/${account.id}`} className="account-link">
                            {account.name}
                          </Link>
                          <span className={`flow-pill ${monthlyFlow >= 0 ? 'positive' : 'negative'}`}>
                            Flux mensuel :
                            <strong>
                              {monthlyFlow >= 0 ? '+' : ''}
                              {monthlyFlow.toLocaleString('fr-FR', {
                                style: 'currency',
                                currency: account.currency
                              })}
                              /mois
                            </strong>
                          </span>
                        </div>
                      </td>
                      <td>{account.type}</td>
                      <td>{account.currency}</td>
                      <td>
                        {account.value.toLocaleString('fr-FR', {
                          style: 'currency',
                          currency: account.currency
                        })}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="tertiary" onClick={() => toggleAccountDetails(account.id)}>
                            {isExpanded ? 'Masquer le suivi' : 'Suivi & versements'}
                          </button>
                          <button type="button" className="secondary" onClick={() => openEditForm(account)}>
                            Modifier
                          </button>
                          <Link to={`/accounts/${account.id}`} className="ghost-button">
                            Ouvrir
                          </Link>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="account-details-row">
                        <td colSpan={5}>
                          <div className="account-details-card">
                            <div className="account-details-header">
                              <div>
                                <h4>Suivi des actions</h4>
                                <p>
                                  Programmez vos versements récurrents et notez les opérations ponctuelles pour garder
                                  une trace fidèle des mouvements.
                                </p>
                              </div>
                              <div className={`flow-pill ${monthlyFlow >= 0 ? 'positive' : 'negative'}`}>
                                Flux mensuel suivi :
                                <strong>
                                  {monthlyFlow >= 0 ? '+' : ''}
                                  {monthlyFlow.toLocaleString('fr-FR', {
                                    style: 'currency',
                                    currency: account.currency
                                  })}
                                  /mois
                                </strong>
                              </div>
                            </div>

                            <div className="action-form">
                              <div>
                                <label htmlFor={`label-${account.id}`}>Intitulé</label>
                                <input
                                  id={`label-${account.id}`}
                                  name="label"
                                  type="text"
                                  placeholder="Versement mensuel"
                                  value={getContributionDraft(account.id).label}
                                  onChange={(event) => handleContributionDraftChange(account.id, event)}
                                />
                              </div>
                              <div>
                                <label htmlFor={`amount-${account.id}`}>Montant</label>
                                <input
                                  id={`amount-${account.id}`}
                                  name="amount"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={getContributionDraft(account.id).amount}
                                  onChange={(event) => handleContributionDraftChange(account.id, event)}
                                />
                              </div>
                              <div>
                                <label htmlFor={`kind-${account.id}`}>Action</label>
                                <select
                                  id={`kind-${account.id}`}
                                  name="kind"
                                  value={getContributionDraft(account.id).kind}
                                  onChange={(event) => handleContributionDraftChange(account.id, event)}
                                >
                                  <option value="deposit">Ajouter</option>
                                  <option value="withdrawal">Retirer</option>
                                </select>
                              </div>
                              <div>
                                <label htmlFor={`cadence-${account.id}`}>Fréquence</label>
                                <select
                                  id={`cadence-${account.id}`}
                                  name="cadence"
                                  value={getContributionDraft(account.id).cadence}
                                  onChange={(event) => handleContributionDraftChange(account.id, event)}
                                >
                                  <option value="monthly">Chaque mois</option>
                                  <option value="one-time">Ponctuel</option>
                                </select>
                              </div>
                              <div>
                                <label htmlFor={`date-${account.id}`}>Début</label>
                                <input
                                  id={`date-${account.id}`}
                                  name="date"
                                  type="date"
                                  value={getContributionDraft(account.id).date}
                                  onChange={(event) => handleContributionDraftChange(account.id, event)}
                                />
                              </div>
                              <div className="form-actions">
                                <button type="button" className="primary" onClick={() => handleAddContribution(account.id)}>
                                  Ajouter au suivi
                                </button>
                              </div>
                              {actionErrors[account.id] && (
                                <p className="form-error">{actionErrors[account.id]}</p>
                              )}
                            </div>

                            <div className="timeline">
                              {contributions.length === 0 ? (
                                <p className="chart-placeholder">
                                  Aucun mouvement suivi pour l’instant. Ajoutez votre premier versement récurrent ou une
                                  opération ponctuelle.
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
                                          currency: account.currency
                                        })}
                                        {contribution.cadence === 'monthly' ? '/mois' : ''}
                                      </span>
                                      <span className="cadence-tag">
                                        {contribution.cadence === 'monthly' ? 'Automatique' : 'Ponctuel'}
                                      </span>
                                      <button
                                        type="button"
                                        className="tertiary"
                                        onClick={() => handleRemoveContribution(account.id, contribution.id)}
                                      >
                                        Supprimer
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Aucun compte pour le moment. Ajoutez-en un pour commencer à suivre votre patrimoine.</p>
      )}
    </section>
  );
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? 'La requête a échoué.';
  }
  return 'Une erreur inattendue est survenue.';
}

function formatTimelineDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }
  return parsed.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
}
x