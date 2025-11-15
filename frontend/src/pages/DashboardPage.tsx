import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';

const netWorthData = [
  { date: 'Jan', value: 120000 },
  { date: 'Feb', value: 125000 },
  { date: 'Mar', value: 131000 },
  { date: 'Apr', value: 137500 }
];

const allocationData = [
  { name: 'PEA', value: 45000 },
  { name: 'Assurance-vie', value: 30000 },
  { name: 'Cash', value: 20000 },
  { name: 'Crypto', value: 5000 }
];

const COLORS = ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2'];

export function DashboardPage() {
  return (
    <section>
      <h2>Tableau de bord</h2>
      <div className="grid">
        <div className="card">
          <h3>Évolution du patrimoine</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={netWorthData}>
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `€${value / 1000}k`} />
              <Tooltip formatter={(value: number) => `${value.toLocaleString('fr-FR')} €`} />
              <Line type="monotone" dataKey="value" stroke="#4E79A7" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>Répartition des actifs</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={allocationData} dataKey="value" nameKey="name" outerRadius={90} label>
                {allocationData.map((entry, index) => (
                  <Cell key={`slice-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${value.toLocaleString('fr-FR')} €`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
