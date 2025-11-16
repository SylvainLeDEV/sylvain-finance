import axios from 'axios';
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useState } from 'react';

import { apiClient } from '../utils/apiClient';

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

const emptyFormState: FormState = {
  name: '',
  type: '',
  currency: 'EUR',
  initialValue: '',
  initialDate: ''
};

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(emptyFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

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
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.name}</td>
                <td>{account.type}</td>
                <td>{account.currency}</td>
                <td>
                  {account.value.toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: account.currency
                  })}
                </td>
                <td>
                  <button type="button" className="secondary" onClick={() => openEditForm(account)}>
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
