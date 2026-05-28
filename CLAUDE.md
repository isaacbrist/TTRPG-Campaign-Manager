# D&D Campaign Manager

AI-powered campaign companion built with Next.js + ASP.NET Core.

## Project Structure

- `frontend/` — Next.js 15 App Router, TypeScript, Tailwind CSS
- `backend/CampaignManager.Api/` — ASP.NET Core 8 Web API, SQLite via EF Core, Anthropic SDK

## Running Locally

```bash
# Terminal 1 — Backend (http://localhost:5000)
cd backend/CampaignManager.Api
dotnet run

# Terminal 2 — Frontend (http://localhost:3000)
cd frontend
npm run dev
```

## Secrets & Environment Variables

**Never put secrets in appsettings.json or .env.local — both are gitignored for safety.**

Backend — uses .NET User Secrets (stored outside the repo on your machine):
```bash
cd backend/CampaignManager.Api
dotnet user-secrets init
dotnet user-secrets set "Anthropic:ApiKey" "sk-ant-..."
```

Frontend — uses `.env.local` (already gitignored):
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

## Architecture

- `frontend/lib/api.ts` — typed API client; all fetch calls go through here
- `backend/Services/ClaudeService.cs` — all Claude AI calls (NPC generation, session processing, recap)
- `backend/Data/AppDbContext.cs` — EF Core context; database auto-created on startup
- `backend/Controllers/` — REST endpoints nested under `/api/campaigns/{id}/`

## Code Style

- Keep components in `app/` as page-level files; shared UI goes in `components/`
- Use Tailwind utility classes only — no custom CSS files; avoid inline `style` props
- Backend uses primary constructors and minimal APIs style where possible
- All AI prompts live in `ClaudeService.cs` — don't scatter Claude calls elsewhere
- Prefer simple, readable code over clever abstractions

## UI & Component Libraries

Before writing custom UI from scratch, prefer established libraries in this order:
1. **Tailwind utility classes** — covers most layout and styling needs
2. **shadcn/ui** — for complex components (modals, dropdowns, tooltips, tabs); add with `npx shadcn@latest add <component>`
3. **Headless UI** (`@headlessui/react`) — for accessible interactive primitives if shadcn isn't a fit
4. **Lucide React** (`lucide-react`) — for icons; already available as a peer dep of shadcn
- Avoid adding heavy UI frameworks (MUI, Chakra, Ant Design) — Tailwind + shadcn is the stack
- Don't write custom CSS animations when Tailwind's `transition-`, `animate-`, and `duration-` utilities will do

## Coding Conventions

**TypeScript / Next.js**
- Use `const` over `let` wherever possible
- Prefer named exports for components, default exports for pages (Next.js convention)
- Use early returns to reduce nesting
- Type API responses explicitly — keep all shared types in `lib/api.ts`
- Async functions in components should handle loading and error state

**C# / ASP.NET Core**
- Follow Microsoft C# naming conventions: PascalCase for types/methods, camelCase for locals
- Use `async`/`await` throughout — no `.Result` or `.Wait()`
- Return `IActionResult` from controllers; use `Ok()`, `NotFound()`, `BadRequest()` consistently
- Use record types for simple DTOs (e.g. request bodies)
- XML doc comments (`///`) on public service methods

## Assistant Behavior

- Prioritize simple, readable code over clever abstractions
- Respect existing architecture — make minimal changes to achieve the outcome
- Preserve naming conventions and patterns already in the codebase
- Include error handling and briefly explain non-obvious choices
- Ask for clarification only if the request is genuinely ambiguous — otherwise just act
- This project uses Next.js + ASP.NET Core Web API (not Razor Pages)

## AI Features

| Feature | Endpoint | Service Method |
|---|---|---|
| Process session notes | POST `/sessions/{id}/process` | `ProcessSessionNotesAsync` |
| Generate recap | GET `/sessions/recap` | `GenerateRecapAsync` |
| Generate NPC | POST `/npcs/generate` | `GenerateNpcAsync` |

## Models

- **Campaign** — top-level container, has many NPCs and Sessions
- **Npc** — race, role, description, personality, quirk, secret, relationshipToParty, isAlive
- **Session** — rawNotes (user input), summary + storyBeats + newNpcsFound (AI output)
