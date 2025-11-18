# SY Finance

SY Finance est une application web auto-hébergée de suivi patrimonial inspirée de Finary.
Ce dépôt contient le frontend React, l'API Node.js et la base PostgreSQL orchestrés avec
Docker Compose pour les environnements de développement et de production.

## 🏗️ Architecture
- **Frontend** : React + Vite (TypeScript) – SPA servie par Nginx en production, Vite en développement.
- **Backend** : Express + TypeScript – API REST modulaire avec validation Zod et middleware de sécurité.
- **Base de données** : PostgreSQL 16 – schéma couvrant comptes, valorisations, transactions, catégories de budget et objectifs.
- **Infra** : Conteneurs Docker, orchestration via `docker-compose.yml` (dev) et `docker-compose.prod.yml` (prod).

## 📁 Arborescence
```
├── backend/                 # API Express TypeScript
│   ├── src/
│   │   ├── config/          # Chargement env & connexion Postgres
│   │   ├── middleware/      # Gestion des erreurs & 404
│   │   ├── routes/          # Routes REST (accounts, values, transactions, goals)
│   │   └── utils/           # Logger Pino
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig*.json
├── frontend/                # SPA React + Recharts
│   ├── src/
│   │   ├── pages/           # Dashboard, Comptes, Budget
│   │   ├── components/      # (emplacement futur)
│   │   ├── utils/           # Client API Axios
│   │   └── styles.css
│   ├── Dockerfile
│   ├── nginx.conf
│   └── vite.config.ts
├── db/
│   └── schema.sql           # Schéma PostgreSQL initial
├── docs/
│   └── PROJECT_PLAN.md      # Plan détaillé du projet
├── docker-compose.yml       # Stack développement (hot reload)
├── docker-compose.prod.yml  # Stack production (build optimisés)
└── README.md
```

## 🗄️ Schéma de base de données
Consultez [`db/schema.sql`](db/schema.sql) pour le schéma complet comprenant les tables
`accounts`, `account_values`, `budget_categories`, `transactions` et `goals` ainsi qu'un
trigger de mise à jour automatique. Le fichier est monté automatiquement dans PostgreSQL et
exécuté lors du premier démarrage. L'API exécute également, à chaque démarrage, de petites
migrations idempotentes (par exemple l'ajout de la colonne `login_url`) pour garantir que
les nouvelles fonctionnalités fonctionnent même sur une base déjà existante. Pour rejouer
manuellement le schéma complet :

```bash
docker compose exec db psql -U postgres -d sy_finance -f /docker-entrypoint-initdb.d/schema.sql
```

## 🚀 Démarrer en développement
Assurez-vous d'avoir Docker et Docker Compose installés.

```bash
docker compose up --build
```

- Frontend Vite : http://localhost:5173
- API Express : http://localhost:4000/api
- PostgreSQL : localhost:5432 (user/password : postgres/postgres)

Les services frontend et backend montent vos sources locales avec hot reload (`npm run dev`).
Les dépendances sont stockées dans des volumes nommés.

## 📦 Déploiement production
1. Configurez vos variables d'environnement (par exemple via un fichier `.env` exporté avant `docker compose`).
2. Construisez et lancez la stack optimisée :
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
3. Le frontend est servi par Nginx sur le port 3000, l'API sur 4000 et PostgreSQL conserve
   ses données dans le volume `db-data`.

Ajoutez un reverse proxy TLS (Traefik, Caddy, Nginx) si vous exposez l'application sur Internet.

## 🔧 Personnalisation & étapes suivantes
- Remplacer les endpoints placeholders par de vraies interactions avec PostgreSQL (`pg` ou ORM).
- Ajouter l'authentification (JWT, OAuth) via le dossier `routes/auth`.
- Mettre en place les tests (Jest/Vitest) et CI/CD.
- Étendre le frontend avec formulaires de saisie et graphiques dynamiques (Recharts).

## 🤝 Licence
Projet personnel – usage privé.
