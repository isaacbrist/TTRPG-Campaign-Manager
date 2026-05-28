# D&D Campaign Manager — Frontend

The Next.js web client for the D&D Campaign Manager. For full setup instructions (prerequisites, running the backend, environment setup), see the [root README](../README.md).

## Tech stack

- **Next.js 15** with the App Router
- **TypeScript**
- **Tailwind CSS**
- **Turbopack** (used automatically in dev via `--turbopack`)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server at http://localhost:3000 |
| `npm run build` | Production build |
| `npm test` | Run the Jest test suite |

## Backend API URL

The backend URL is configured via the `NEXT_PUBLIC_API_URL` environment variable in `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

Change this value to point at a different backend (e.g. a staging server) without touching any source files.
