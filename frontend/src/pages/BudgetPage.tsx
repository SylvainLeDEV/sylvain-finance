import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const budgetData = [
  { category: 'Logement', spent: 900, budget: 1000 },
  { category: 'Alimentation', spent: 450, budget: 500 },
  { category: 'Transport', spent: 120, budget: 150 },
  { category: 'Loisirs', spent: 200, budget: 300 }
];

export function BudgetPage() {
  return (
    <section>
      <h2>Budget mensuel</h2>
      <p>Visualisez vos dépenses par catégorie et comparez-les à vos enveloppes.</p>
      <div className="card">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={budgetData}>
            <XAxis dataKey="category" />
            <YAxis tickFormatter={(value) => `${value} €`} />
            <Tooltip formatter={(value: number) => `${value.toLocaleString('fr-FR')} €`} />
            <Bar dataKey="budget" fill="#A0C4FF" name="Budget" />
            <Bar dataKey="spent" fill="#FF99C8" name="Dépensé" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
