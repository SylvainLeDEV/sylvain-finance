import { NavLink, Route, Routes } from 'react-router-dom';

import { AccountDetailsPage } from './pages/AccountDetailsPage';
import { AccountsPage } from './pages/AccountsPage';
import { BudgetPage } from './pages/BudgetPage';
import { DashboardPage } from './pages/DashboardPage';

export function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <h1>SY Finance</h1>
        <nav>
          <NavLink to="/" end>
            Tableau de bord
          </NavLink>
          <NavLink to="/accounts">Comptes</NavLink>
          <NavLink to="/budget">Budget</NavLink>
        </nav>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/accounts/:id" element={<AccountDetailsPage />} />
          <Route path="/budget" element={<BudgetPage />} />
        </Routes>
      </main>
    </div>
  );
}
