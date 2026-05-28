# D&D Campaign Manager — Setup Guide

## Prerequisites
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 18+](https://nodejs.org/)
- An [Anthropic API key](https://console.anthropic.com/)

---

## 1. Backend (ASP.NET Core)

```bash
cd backend/CampaignManager.Api
```

Add your Anthropic API key to `appsettings.json`:
```json
"Anthropic": {
  "ApiKey": "sk-ant-..."
}
```

Restore packages and run:
```bash
dotnet restore
dotnet run
```

The API will start at `http://localhost:5000`.  
Swagger UI is available at `http://localhost:5000/swagger`.

The SQLite database (`campaign_manager.db`) is created automatically on first run.

---

## 2. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## Project Structure

```
dnd-campaign-manager/
├── backend/
│   └── CampaignManager.Api/
│       ├── Controllers/       # REST API endpoints
│       ├── Models/            # Campaign, NPC, Session
│       ├── Services/          # ClaudeService (AI logic)
│       ├── Data/              # EF Core DbContext
│       └── Program.cs
└── frontend/
    ├── app/
    │   ├── page.tsx                          # Campaign list
    │   └── campaigns/[id]/
    │       ├── page.tsx                      # Campaign dashboard + recap
    │       ├── npcs/page.tsx                 # NPC roster + AI generator
    │       └── sessions/page.tsx             # Session log + AI processing
    └── lib/api.ts                            # Typed API client
```

## AI Features

| Feature | How it works |
|---|---|
| **Process Session Notes** | Paste raw notes → Claude extracts story beats, finds NPCs, writes a summary |
| **Generate Recap** | Claude writes a "Previously on..." narrative from all session summaries |
| **Generate NPC** | Claude creates a full NPC (appearance, personality, quirk, secret) from optional hints |
