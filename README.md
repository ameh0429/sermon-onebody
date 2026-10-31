# OneBody

Sermon library, weekly growth plans, private reflections, fellowship, and pastor/admin tools for a community growing together.

- [`backend-sermon-api`](backend-sermon-api/README.md): Express + TypeScript + PostgreSQL API and Swagger documentation.
- [`frontend-sermon-app`](frontend-sermon-app/README.md): React + Tailwind responsive member web app and PWA.

Start PostgreSQL and the API in one terminal, then the frontend in another:

```bash
# Terminal 1 (configure backend .env first)
cd backend-sermon-api
npm ci
npm run dev
```

```bash
# Terminal 2 (from the repository root)
cd frontend-sermon-app
npm ci
npm run dev
```

Open http://localhost:5173 for the frontend. The default frontend development proxy connects to the API on port 3000. See the component READMEs for setup, authentication, testing, and deployment. Frontend sessions currently end on refresh; lesson progress remains saved on the server.
