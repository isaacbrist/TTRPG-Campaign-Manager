# D&D Campaign Manager

A full-stack web app for Dungeon Masters to manage campaigns, track NPCs, and log sessions — with Claude AI handling the heavy lifting on summaries, story beat extraction, and recap generation.

Built as a portfolio project to showcase full-stack development with a modern React framework, a .NET API, and real-world AI agent integration.

---

## Features

### Campaign Management
- Create, edit, and delete campaigns with name, setting, and description
- Per-campaign lore notes (locations, factions, plot threads, house rules)

### NPC Roster
- Track NPCs with appearance, personality, quirk, secret, and relationship to the party
- Search by name, race, or role; filter by alive/deceased and relationship status
- **AI NPC generator** — describe what you want (or leave it blank) and Claude generates a unique NPC with randomized race, occupation, and personality to avoid repetition
- Inline editing for all NPC fields
- One-click alive/deceased toggle and relationship cycling (Unknown → Friendly → Neutral → Hostile)

### Session Log
- Log raw session notes per session with editable dates
- **AI processing** — paste your notes and Claude extracts:
  - A cohesive narrative summary
  - Key story beats
  - NPCs mentioned in the session
- Edit or clear the AI summary at any time; raw notes and summary are managed independently
- **"Previously on..." recap generator** — Claude reads all session summaries and writes a recap in the style of a TV show cold open, ready to read aloud at the table
- Attach a recap to any session for future reference, edit it before saving, or detach it

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| Backend | ASP.NET Core 8 Web API, C# |
| Database | SQLite via Entity Framework Core |
| AI | Anthropic Claude API (`claude-haiku-4-5-20251001`) via [Anthropic.SDK](https://github.com/tghamm/Anthropic.SDK) |

---

## Project Structure

```
dnd-campaign-manager/
├── frontend/                  # Next.js app
│   ├── app/
│   │   ├── page.tsx                        # Campaign list
│   │   └── campaigns/[id]/
│   │       ├── page.tsx                    # Campaign dashboard
│   │       ├── npcs/page.tsx               # NPC roster
│   │       └── sessions/page.tsx           # Session log
│   ├── components/
│   │   └── Toast.tsx                       # Toast notification system
│   └── lib/
│       └── api.ts                          # Typed API client
│
└── backend/
    └── CampaignManager.Api/
        ├── Controllers/
        │   ├── CampaignsController.cs
        │   ├── NpcsController.cs
        │   └── SessionsController.cs
        ├── Models/
        │   ├── Campaign.cs
        │   ├── Npc.cs
        │   └── Session.cs
        ├── Services/
        │   └── ClaudeService.cs            # All Claude AI interactions
        └── Data/
            └── AppDbContext.cs
```

---

## Getting Started

### Prerequisites
- [Node.js 18+](https://nodejs.org/)
- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- An [Anthropic API key](https://console.anthropic.com/)

### Run everything at once (recommended)

From the repo root, install the root dev dependencies once, then start both servers with a single command:

```bash
npm install          # installs concurrently at the repo root
npm run dev          # starts backend + frontend together
```

The backend will be at `http://localhost:5000` and the frontend at `http://localhost:3000`. Both processes share the same terminal window with colour-coded output (`cyan` = backend, `magenta` = frontend). Press `Ctrl+C` once to stop both.

### Backend (standalone)

```bash
cd backend/CampaignManager.Api

# Store your API key securely (never commit it)
dotnet user-secrets set "Anthropic:ApiKey" "sk-ant-your-key-here"

dotnet run
# API runs on http://localhost:5000
# Swagger UI at http://localhost:5000/swagger
```

The SQLite database is created automatically on first run.

### Frontend (standalone)

```bash
cd frontend
npm install
npm run dev
# App runs on http://localhost:3000
```

---

## How the AI Integration Works

All Claude interactions live in `ClaudeService.cs`. The API key is injected via .NET configuration and stored in User Secrets locally (never in source control).

**Session processing** (`ProcessSessionNotesAsync`) — sends raw notes to Claude with a structured prompt asking for a JSON object containing a narrative summary, an array of story beats, and an array of NPC names. The response is parsed and saved back to the session.

**Recap generation** (`GenerateRecapAsync`) — collects all summarized sessions in order and asks Claude to write a "Previously on..." narrative suitable for reading aloud at the start of a session.

**NPC generation** (`GenerateNpcAsync`) — uses C# to randomly pre-select a race, occupation subset, and personality subset before building the prompt. This forces variety at the code level rather than relying on Claude to pick different options each time, which it tends not to do.

---

## API Reference

The backend exposes a REST API under `/api`. Swagger UI is available at `http://localhost:5000/swagger` when running locally.

Key endpoints:

```
GET/POST        /api/campaigns
GET/PUT/DELETE  /api/campaigns/{id}

GET/POST        /api/campaigns/{id}/npcs
GET/PUT/DELETE  /api/campaigns/{id}/npcs/{npcId}
POST            /api/campaigns/{id}/npcs/generate

GET/POST        /api/campaigns/{id}/sessions
GET/PUT/DELETE  /api/campaigns/{id}/sessions/{sessionId}
POST            /api/campaigns/{id}/sessions/{sessionId}/process
GET             /api/campaigns/{id}/sessions/recap
PUT/DELETE      /api/campaigns/{id}/sessions/{sessionId}/recap
DELETE          /api/campaigns/{id}/sessions/{sessionId}/notes
DELETE          /api/campaigns/{id}/sessions/{sessionId}/summary
```


---

## Docker

Run the entire stack with a single command.

### 1. Set environment variables

Create a `.env` file at the repo root (next to `docker-compose.yml`):

```env
Anthropic__ApiKey=sk-ant-your-key-here
Jwt__SecretKey=a-long-random-secret-at-least-32-characters
Jwt__Issuer=CampaignManager
Jwt__Audience=CampaignManager
```

> `Jwt__Issuer` and `Jwt__Audience` default to `CampaignManager` if omitted.

### 2. Start the stack

```bash
docker-compose up --build
```

| Service  | URL                          |
|----------|------------------------------|
| Frontend | http://localhost:3000        |
| Backend  | http://localhost:5000        |
| Swagger  | http://localhost:5000/swagger|

### 3. Stop and clean up

```bash
docker-compose down          # stop containers (data volume kept)
docker-compose down -v       # stop containers AND delete the SQLite volume
```

### Notes

- The SQLite database is persisted in a named Docker volume (`db-data`) and survives container restarts.
- `NEXT_PUBLIC_API_URL` is baked into the frontend at build time by Next.js. If you need to point at a different backend host, change the `args` value in `docker-compose.yml` and rebuild with `docker-compose up --build`.
