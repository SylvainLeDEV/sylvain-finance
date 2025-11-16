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
const compactEuroFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1
});
const percentFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

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

function formatAxisCurrency(value: number) {
  if (Math.abs(value) < 1000) {
    return formatCurrency(value);
  }
  return compactEuroFormatter.format(value);
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

function formatPercent(value: number) {
  return percentFormatter.format(value);
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
  const totalValue = data?.summary.totalValue ?? 0;

  const averageAccountValue = useMemo(() => {
    if (!data || data.summary.accountCount === 0) {
      return 0;
    }
    return data.summary.totalValue / data.summary.accountCount;
  }, [data]);

  const netWorthChange = useMemo(() => {
    if (netWorthHistory.length < 2) {
      return null;
    }
    const latest = netWorthHistory[netWorthHistory.length - 1]?.value ?? 0;
    const previous = netWorthHistory[netWorthHistory.length - 2]?.value ?? 0;
    const delta = latest - previous;
    const ratio = previous === 0 ? null : delta / previous;
    return { latest, previous, delta, ratio };
  }, [netWorthHistory]);

  const allocationByAccountWithPercent = useMemo(() => {
    if (allocationByAccount.length === 0) {
      return [];
    }
    const total = allocationByAccount.reduce((sum, account) => sum + account.value, 0);
    if (total === 0) {
      return allocationByAccount.map((account) => ({ ...account, percent: 0 }));
    }
    return [...allocationByAccount]
      .sort((a, b) => b.value - a.value)
      .map((account) => ({ ...account, percent: account.value / total }));
  }, [allocationByAccount]);

  const leadingAccount = allocationByAccountWithPercent[0];
  const diversificationScore = useMemo(() => {
    if (!allocationByAccountWithPercent.length) {
      return 0;
    }
    const topShare = allocationByAccountWithPercent[0]?.percent ?? 0;
    const score = Math.round((1 - topShare) * 100);
    return Math.min(100, Math.max(0, score));
  }, [allocationByAccountWithPercent]);

  return (
    <section>
      <header className="page-header dashboard-header">
        <div>
          <p className="eyebrow">Vue globale</p>
          <h2>Tableau de bord</h2>
          <p>Suivez vos comptes, vos versements et la progression de votre patrimoine d’un seul coup d’œil.</p>
        </div>
        <div className="dashboard-pills">
          <span className="pill">{data?.summary.accountCount ?? 0} compte(s) suivi(s)</span>
          <span className="pill">Dernière mise à jour : {formatDate(data?.summary.lastUpdated)}</span>
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
        <div className="card stat-card highlight-card">
          <div className="stat-card-heading">Patrimoine total suivi</div>
          <p>{data ? formatCurrency(totalValue) : '—'}</p>
          {netWorthChange && (
            <div className={`stat-change ${netWorthChange.delta >= 0 ? 'positive' : 'negative'}`}>
              {netWorthChange.delta >= 0 ? '+' : ''}
              {formatCurrency(netWorthChange.delta)}
              {typeof netWorthChange.ratio === 'number' && ` (${formatPercent(netWorthChange.ratio)})`} depuis la dernière valorisation
            </div>
          )}
          <small>Dernière mise à jour : {formatDate(data?.summary.lastUpdated)}</small>
        </div>
        <div className="card stat-card">
          <h4>Valeur moyenne par compte</h4>
          <p>{data ? formatCurrency(averageAccountValue) : '—'}</p>
          <small>Basé sur {data?.summary.accountCount ?? 0} comptes actifs</small>
        </div>
        <div className="card stat-card">
          <h4>Score de diversification</h4>
          <p>{diversificationScore}%</p>
          <div className="progress-track">
            <span className="progress-fill" style={{ width: `${diversificationScore}%` }} />
          </div>
          <small>Plus la barre est remplie, plus vos comptes sont équilibrés.</small>
        </div>
      </div>

      <div className="grid charts-grid">
        <div className="card chart-card span-2">
          <h3>Évolution du patrimoine</h3>
          {netWorthHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={netWorthHistory} margin={{ top: 12, right: 24, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" tickFormatter={(value) => formatDate(value)} />
                <YAxis tickFormatter={(value) => formatAxisCurrency(value)} />
                <Tooltip
                  labelFormatter={(value) => `Date: ${formatDate(value)}`}
                  formatter={(value: number) => [formatCurrency(value), 'Patrimoine']}
                />
                <Line type="monotone" dataKey="value" stroke="#4E79A7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="chart-placeholder">
              Aucune valorisation historique disponible. Ajoutez une valorisation depuis la page d’un compte pour
              alimenter ce graphique.
            </p>
          )}
        </div>
        <div className="card chart-card">
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
        <div className="card chart-card">
          <div className="card-header">
            <h3>Répartition par compte</h3>
            <span className="pill">{allocationByAccount.length} compte(s)</span>
          </div>
          {allocationByAccountWithPercent.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={allocationByAccountWithPercent}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={110}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {allocationByAccountWithPercent.map((account, index) => (
                      <Cell key={`account-${account.id}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name) => [formatCurrency(value), name as string]}
                    labelFormatter={(label) => `Compte : ${label}`}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="chart-legend">
                {allocationByAccountWithPercent.slice(0, 4).map((account, index) => (
                  <li key={account.id}>
                    <span
                      className="legend-dot"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div>
                      <strong>{account.name}</strong>
                      <small>
                        {formatPercent(account.percent)} • {formatCurrency(account.value, account.currency)}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="chart-placeholder">Détaillez chaque compte pour suivre son poids dans le patrimoine.</p>
          )}
        </div>
      </div>

      <div className="grid detail-grid">
        <div className="card account-ranking">
          <h3>Classement des comptes</h3>
          {leadingAccount ? (
            <p className="ranking-intro">
              {leadingAccount.name} représente {formatPercent(leadingAccount.percent)} du patrimoine suivi.
            </p>
          ) : (
            <p className="ranking-intro">Ajoutez un compte pour visualiser son poids.</p>
          )}
          {allocationByAccountWithPercent.length > 0 ? (
            <ul>
              {allocationByAccountWithPercent.slice(0, 5).map((account, index) => (
                <li key={account.id}>
                  <div className="account-progress">
                    <div className="account-progress-header">
                      <span>{index + 1}.</span>
                      <strong>{account.name}</strong>
                      <span>{formatCurrency(account.value, account.currency)}</span>
                    </div>
                    <div className="progress-track">
                      <span
                        className="progress-fill"
                        style={{ width: `${Math.round(account.percent * 100)}%` }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="chart-placeholder">Les comptes apparaîtront ici par ordre de valeur.</p>
          )}
        </div>
        <div className="card table-card">
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
      </div>
    </section>
  );
}
