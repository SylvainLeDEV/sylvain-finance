import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

import { apiClient } from '../utils/apiClient';

const COLORS = ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948'];

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

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? 'La récupération des données a échoué.';
  }
  return 'Une erreur inattendue est survenue.';
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) {
    return '—';
  }
  const parsed = new Date(dateString);
  return Number.isNaN(parsed.valueOf()) ? dateString : parsed.toLocaleDateString('fr-FR');
}

export type NetWorthPoint = {
  date: string;
  value: number;
};

export type AllocationAccount = {
  id: string;
  name: string;
  type: string;
  currency: string;
  value: number;
};

export type AllocationSlice = {
  type: string;
  value: number;
};

export type DashboardData = {
  summary: {
    totalValue: number;
    accountCount: number;
    lastUpdated: string | null;
  };
  netWorthHistory: NetWorthPoint[];
  allocationByAccount: AllocationAccount[];
  allocationByType: AllocationSlice[];
};

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchInsights() {
      setLoading(true);
      try {
        const response = await apiClient.get<{ data: DashboardData }>('/accounts/insights');
        if (!cancelled) {
          setData(response.data.data);
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

    void fetchInsights();
    return () => {
      cancelled = true;
    };
  }, []);

  const netWorthHistory = data?.netWorthHistory ?? [];
  const allocationByAccount = data?.allocationByAccount ?? [];
  const allocationByType = data?.allocationByType ?? [];

  const averageAccountValue = useMemo(() => {
    if (!data || data.summary.accountCount === 0) {
      return 0;
    }
    return data.summary.totalValue / data.summary.accountCount;
  }, [data]);

  return (
    <section>
      <header className="page-header">
        <div>
          <h2>Tableau de bord</h2>
          <p>Suivez vos comptes en temps réel grâce aux données de la base.</p>
        </div>
      </header>

      {error ? (
        <div className="status-banner error">{error}</div>
      ) : (
        <div className="status-banner success">
          {loading ? 'Chargement des données…' : 'Données de comptes synchronisées avec l’API'}
        </div>
      )}

      <div className="stat-grid">
        <div className="card stat-card">
          <h4>Valeur totale suivie</h4>
          <p>{data ? formatCurrency(data.summary.totalValue) : '—'}</p>
          <small>Dernière mise à jour : {formatDate(data?.summary.lastUpdated)}</small>
        </div>
        <div className="card stat-card">
          <h4>Nombre de comptes</h4>
          <p>{data ? data.summary.accountCount : '—'}</p>
          <small>Comptes actifs dans la base</small>
        </div>
        <div className="card stat-card">
          <h4>Valeur moyenne par compte</h4>
          <p>{data ? formatCurrency(averageAccountValue) : '—'}</p>
          <small>Calculé à partir des dernières valorisations</small>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3>Évolution du patrimoine</h3>
          {netWorthHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={netWorthHistory} margin={{ top: 12, right: 24, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" tickFormatter={(value) => formatDate(value)} />
                <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k €`} />
                <Tooltip
                  labelFormatter={(value) => `Date: ${formatDate(value)}`}
                  formatter={(value: number) => [formatCurrency(value), 'Patrimoine']}
                />
                <Line type="monotone" dataKey="value" stroke="#4E79A7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="chart-placeholder">Aucune valorisation historique disponible.</p>
          )}
        </div>
        <div className="card">
          <h3>Répartition par type de compte</h3>
          {allocationByType.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={allocationByType} dataKey="value" nameKey="type" outerRadius={110} label>
                  {allocationByType.map((slice, index) => (
                    <Cell key={`slice-${slice.type}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name) => [formatCurrency(value), name as string]} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="chart-placeholder">Ajoutez des comptes pour visualiser leur répartition.</p>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Détail des comptes</h3>
        {allocationByAccount.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Type</th>
                <th>Devise</th>
                <th>Valeur actuelle</th>
              </tr>
            </thead>
            <tbody>
              {allocationByAccount.map((account) => (
                <tr key={account.id}>
                  <td>{account.name}</td>
                  <td>{account.type}</td>
                  <td>{account.currency}</td>
                  <td>{formatCurrency(account.value, account.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="chart-placeholder">Aucun compte n’a encore été enregistré.</p>
        )}
      </div>
    </section>
  );
}
