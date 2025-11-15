const placeholderAccounts = [
  { id: '1', name: 'PEA Boursorama', type: 'PEA', currency: 'EUR', value: 45000 },
  { id: '2', name: 'Assurance-vie Linxea', type: 'Assurance-vie', currency: 'EUR', value: 30000 },
  { id: '3', name: 'Binance', type: 'Crypto', currency: 'EUR', value: 5000 }
];

export function AccountsPage() {
  return (
    <section>
      <header className="page-header">
        <div>
          <h2>Comptes</h2>
          <p>Gérez vos comptes et suivez leur valeur courante.</p>
        </div>
        <button type="button" className="primary">
          Ajouter un compte
        </button>
      </header>
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
          {placeholderAccounts.map((account) => (
            <tr key={account.id}>
              <td>{account.name}</td>
              <td>{account.type}</td>
              <td>{account.currency}</td>
              <td>{account.value.toLocaleString('fr-FR')} €</td>
              <td>
                <button type="button" className="secondary">
                  Modifier
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
