# TaskFlow — Plateforme de gestion de projets

## 1. Présentation

TaskFlow est une plateforme de gestion de projets pensée pour les équipes et les particuliers. Elle permet de créer des projets, organiser les tâches, gérer les membres, suivre les échéances et suivre les statuts via un tableau de bord moderne.

## 2. Objectifs

- Gérer des projets et des tâches.
- Travailler avec des rôles et permissions.
- Créer des tableaux de bord utiles.
- Collaborer avec commentaires et notifications.
- Utiliser le tableau de chaque projet, répartir les tâches par statut et les assigner aux membres.
- Inviter des personnes par adresse email ou avec un lien de projet partageable valable 7 jours.
- Fournir une API robuste et une interface utilisateur moderne.

Les invitations email sont conservées dans l’application et génèrent un lien à copier et à transmettre manuellement. Aucun envoi SMTP n’est configuré.

## 3. Stack technique

- Frontend : React + Vite + TypeScript + Tailwind CSS
- Backend : Express + TypeScript + Mongoose + JWT + Zod
- Base de données : MongoDB
- Tests : Vitest + Supertest + Testing Library
- Authentification : cookies HTTP-only + JWT

## 4. Architecture

- `client/` : application React
- `server/` : API Express et modèles Mongoose
- `docs/` : documentation

## 5. Prérequis

- Node.js 20+
- npm 10+
- MongoDB local ou MongoDB Atlas

## 6. Installation

### Windows

```powershell
cd C:\path\to\TaskFlow
npm install
copy .env.example .env
```

### Linux / macOS

```bash
cd /path/to/TaskFlow
npm install
cp .env.example .env
```

## 7. Configuration des variables d’environnement

Renseignez les fichiers `.env` créés.
Le serveur lit les variables depuis le `.env` racine ou `server/.env`. Ne copiez
pas ce fichier dans `client/` : les secrets MongoDB et JWT doivent rester côté
serveur. En production, `JWT_SECRET` doit contenir au moins 32 caractères et
`CLIENT_URL` doit être l’origine HTTPS exacte du frontend. Les cookies
d’authentification sont automatiquement `HttpOnly`, `SameSite=Lax` et `Secure`
en production. Chaque connexion crée une session serveur; la déconnexion
révoque uniquement cette session, et un changement de mot de passe révoque
toutes les sessions du compte. Les index de la collection des sessions sont
créés au démarrage du serveur.

Exemple de `.env` racine :

```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/taskflow
JWT_SECRET=replace_with_a_strong_secret
JWT_EXPIRES_IN=1d
COOKIE_NAME=taskflow_token
```

Pour un déploiement derrière un reverse proxy, configurez le proxy pour router
`/api` vers le serveur. Le client compilé utilise `/api/v1` par défaut; si
l’API est sur une origine différente, définissez `VITE_API_URL` au moment du
build et configurez `CLIENT_URL` sur le serveur avec l’origine HTTPS exacte du
client. N’incluez aucun secret dans `VITE_*`.

## 8. MongoDB Atlas

1. Créez un cluster MongoDB Atlas.
2. Récupérez la chaîne de connexion.
3. Activez les accès réseau et l’authentification.
4. Copiez l’URI dans `server/.env` ou `.env`.
5. Limitez les règles réseau Atlas aux adresses de sortie nécessaires; évitez
   `0.0.0.0/0` en production.
6. Utilisez un utilisateur de base de données avec les seuls droits nécessaires
   sur la base TaskFlow, activez TLS et ne publiez jamais l’URI.
7. Renouvelez manuellement les identifiants qui auraient été exposés et
   remplacez l’URI dans l’environnement privé; ne les collez pas dans le chat.

## 9. MongoDB local

```bash
mongod --dbpath /path/to/data
```

Ensuite configurez :

```env
MONGODB_URI=mongodb://127.0.0.1:27017/taskflow
```

## 10. Migrations

```bash
npm run db:migrate
```

## 11. Seed

Le seed ajoute sans supprimer de données un compte QA, un projet, quatre tâches
(un par statut), un commentaire, une notification et des entrées d’activité.
Il est idempotent pour la même adresse e-mail. Si le compte n’existe pas encore,
fournissez son mot de passe via l’environnement; le secret n’est ni codé en dur
ni affiché. Les données restent dans la base configurée par `MONGODB_URI`.

PowerShell :

```powershell
$env:TASKFLOW_SEED_EMAIL = "taskflow.qa@taskflow.dev"
$env:TASKFLOW_SEED_PASSWORD = Read-Host "Mot de passe QA (8 à 128 caractères)"
npm run db:seed
Remove-Item Env:TASKFLOW_SEED_PASSWORD
```

Conservez le mot de passe choisi dans un gestionnaire sécurisé si vous voulez
vous connecter ensuite avec le compte QA. Ne lancez le seed que sur la base de
données que vous souhaitez enrichir.

Commande équivalente depuis la racine :

```bash
npm run db:seed
```

## 12. Développement

```bash
npm run dev
```

## 13. Build production

```bash
npm run build
```

## 14. Tests

```bash
npm test
npm run lint
npm run typecheck
```

## 15. API

### Authentification

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `PATCH /api/v1/auth/me`
- `PATCH /api/v1/auth/change-password`

### Projets

- `GET /api/v1/projects`
- `POST /api/v1/projects`
- `GET /api/v1/projects/:projectId`
- `PATCH /api/v1/projects/:projectId`
- `DELETE /api/v1/projects/:projectId`
- `POST /api/v1/projects/:projectId/invitations`
- `POST /api/v1/projects/:projectId/invitation-link`
- `DELETE /api/v1/projects/:projectId/invitations/:invitationId`

### Invitations

- `GET /api/v1/invitations/pending`
- `POST /api/v1/invitations/:invitationId/accept`
- `POST /api/v1/invitations/link-preview` — le corps contient `{ "token": "…" }`
- `POST /api/v1/invitations/accept-link` — le corps contient `{ "token": "…" }`

### Tâches

- `GET /api/v1/tasks`
- `GET /api/v1/projects/:projectId/tasks`
- `POST /api/v1/projects/:projectId/tasks`
- `PATCH /api/v1/projects/:projectId/tasks/:taskId`
- `PATCH /api/v1/projects/:projectId/tasks/:taskId/status`

### Notifications

- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/:notificationId/read`
- `PATCH /api/v1/notifications/read-all`

### Dashboard

- `GET /api/v1/dashboard/summary`
- `GET /api/v1/dashboard/activity`

### Santé

- `GET /api/v1/health`

## 16. Matrice des rôles

| Rôle | Permissions |
|---|---|
| Owner | Gestion du projet, membres, suppression, droits complets |
| Admin | Gestion des tâches et des membres selon politique |
| Member | Consultation et contribution sur les tâches |

## 17. Sécurité

- Cookies HTTP-only
- JWT avec expiration
- CORS explicite
- Helmet
- Rate limiting
- Validation Zod
- Hashage bcrypt

## 18. Checklist de soumission CodeAlpha

- [ ] README complet
- [ ] API fonctionnelle
- [ ] Frontend fonctionnel
- [ ] Tests exécutés
- [ ] Variables d’environnement documentées
- [ ] Projet propre et sans secrets

## 19. Déploiement GitHub

```bash
git init
git add .
git commit -m "Initial TaskFlow commit"
git branch -M main
git remote add origin <votre-url-github>
git push -u origin main
```

## 20. Conseils pour démonstration

- Capturer un écran du tableau de bord.
- Montrer la création d’un projet.
- Montrer l’ajout d’un membre.
- Montrer un flux de tâches et commentaires.
