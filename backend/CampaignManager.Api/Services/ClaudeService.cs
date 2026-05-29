using CampaignManager.Api.Models;
using System.Text.Json;

namespace CampaignManager.Api.Services;

/// <summary>
/// Wraps Claude AI calls for all AI-powered features.
/// Uses IAnthropicMessageClient so callers can be unit-tested without
/// making real HTTP requests to the Anthropic API.
/// </summary>
public class ClaudeService(IAnthropicMessageClient messageClient, ILogger<ClaudeService> logger)
{
    private const string ModelId = "claude-haiku-4-5-20251001";

    // ── Shared helpers ─────────────────────────────────────────────────────

    private static string StripCodeFences(string text)
    {
        var trimmed = text.Trim();
        if (!trimmed.StartsWith("```")) return trimmed;
        var start = trimmed.IndexOf('\n') + 1;
        var end   = trimmed.LastIndexOf("```");
        // If there's no closing fence (end points back at the opening one), return as-is.
        if (end <= start) return trimmed;
        return trimmed[start..end].Trim();
    }

    /// <summary>
    /// Calls Claude and returns the stripped response text.
    /// Wraps the three-line try/catch/log/rethrow that every caller previously duplicated.
    /// </summary>
    private async Task<string> InvokeClaudeAsync(string prompt, int maxTokens, string operationDescription)
    {
        try
        {
            var raw = await messageClient.SendMessageAsync(prompt, ModelId, maxTokens);
            return StripCodeFences(raw);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Claude API call failed during: {Operation}", operationDescription);
            throw new InvalidOperationException(
                $"Failed to reach the Claude API during \"{operationDescription}\": {ex.Message}", ex);
        }
    }

    // ── Public methods ─────────────────────────────────────────────────────

    /// <summary>
    /// Processes raw session notes: extracts story beats, finds NPCs, and generates a summary.
    /// </summary>
    public async Task ProcessSessionNotesAsync(Session session)
    {
        var prompt = $"""
            You are a D&D campaign assistant. Analyze these session notes and return a JSON object with three fields:
            - "summary": A cohesive, narrative 2-3 paragraph summary of what happened this session, written in past tense.
            - "storyBeats": An array of strings, each being a key story beat or event (5-10 bullets).
            - "newNpcs": An array of strings containing any NPC names mentioned that might be new characters.

            Session Notes:
            {session.RawNotes}

            Respond with only valid JSON, no markdown formatting.
            """;

        var content = await InvokeClaudeAsync(prompt, 1500, $"processing notes for session {session.Id}");

        try
        {
            var parsed = JsonSerializer.Deserialize<JsonElement>(content);
            session.Summary      = parsed.GetProperty("summary").GetString();
            session.StoryBeats   = parsed.GetProperty("storyBeats").GetRawText();
            session.NewNpcsFound = parsed.GetProperty("newNpcs").GetRawText();
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Failed to parse Claude JSON for session {SessionId}. Raw response: {Content}",
                session.Id, content);
            throw new InvalidOperationException(
                "Claude returned a response that could not be parsed as the expected JSON. " +
                "The raw response has been logged for debugging.", ex);
        }
    }

    /// <summary>
    /// Generates a "Previously on…" recap from all session summaries.
    /// </summary>
    public async Task<string> GenerateRecapAsync(List<Session> sessions)
    {
        var summariesText = string.Join("\n\n", sessions.Select(s =>
            $"Session {s.SessionNumber}: {s.Summary}"));

        var prompt = $"""
            You are a D&D campaign narrator writing a "Previously on our adventure..." recap
            to read aloud to players at the start of a session.

            STRICT RULES — these override everything else:
            • Use ONLY the events, characters, and details explicitly stated in the session summaries below.
            • Do NOT invent events, add characters, or speculate about motivations that are not mentioned.
            • Do NOT embellish beyond what is written — if a detail isn't in the summaries, leave it out.
            • If the summaries are sparse, write a shorter recap; do not pad it with invented content.

            STYLE:
            • 2–3 paragraphs, written in past tense, as if speaking directly to the players.
            • Clear and engaging prose — you can vary sentence rhythm and use vivid verbs, but stay faithful to the facts.
            • Plain prose only — no markdown, no asterisks, no bold, no bullet points.

            SESSION SUMMARIES:
            {summariesText}
            """;

        return await InvokeClaudeAsync(prompt, 800, $"generating recap for {sessions.Count} sessions");
    }

    /// <summary>
    /// Generates a random NPC with optional hints (e.g. "grumpy dwarf blacksmith").
    /// </summary>
    public async Task<Npc> GenerateNpcAsync(int campaignId, string? hints)
    {
        string hintText;

        if (!string.IsNullOrWhiteSpace(hints))
        {
            hintText = $"Generate an NPC with these characteristics: {hints}";
        }
        else
        {
            var race        = Sample(Races, 1)[0];
            var occupations = Sample(Occupations, 4);
            var personality = Sample(Personalities, 1)[0];
            var quirkEx     = Sample(QuirkExamples, 2);

            hintText = $"""
                Generate a {race} NPC.

                OCCUPATION — choose one of these four options (they range from mundane to unusual — any is valid):
                {string.Join(", ", occupations)}

                PERSONALITY — use this as the core trait: {personality}

                QUIRK — must be hyper-specific. Here are two examples of the right style (do NOT use these verbatim):
                • {quirkEx[0]}
                • {quirkEx[1]}

                SECRET — can be completely mundane: a petty embarrassment, a small debt, a harmless lie, a crush on someone. Not every NPC has a dark past.
                """;
        }

        var prompt = $"""
            You are a D&D campaign assistant. {hintText}
            Return a JSON object with these fields:
            - "name": Full name fitting their race and background — avoid overused names like "Aria", "Thorin", "Zara", or "Kael"
            - "race": Fantasy race
            - "role": Their occupation or role
            - "description": 1-2 sentences on physical appearance — include one specific, memorable visual detail
            - "personality": 1-2 sentences on personality and demeanor
            - "quirk": One hyper-specific quirk or habit
            - "secret": A secret (can be mundane or significant)
            - "relationshipToParty": "Unknown"

            Respond with only valid JSON, no markdown formatting.
            """;

        var content = await InvokeClaudeAsync(prompt, 600, $"generating NPC for campaign {campaignId}");

        try
        {
            var parsed = JsonSerializer.Deserialize<JsonElement>(content);
            return new Npc
            {
                CampaignId          = campaignId,
                Name                = parsed.GetProperty("name").GetString() ?? "Unknown",
                Race                = parsed.GetProperty("race").GetString(),
                Role                = parsed.GetProperty("role").GetString(),
                Description         = parsed.GetProperty("description").GetString(),
                Personality         = parsed.GetProperty("personality").GetString(),
                Quirk               = parsed.GetProperty("quirk").GetString(),
                Secret              = parsed.GetProperty("secret").GetString(),
                RelationshipToParty = parsed.GetProperty("relationshipToParty").GetString() ?? "Unknown",
            };
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Failed to parse Claude JSON for NPC generation (campaign {CampaignId}). Raw: {Content}",
                campaignId, content);
            throw new InvalidOperationException(
                "Claude returned a response that could not be parsed as the expected NPC JSON. " +
                "The raw response has been logged for debugging.", ex);
        }
    }

    // ── NPC generation tables ──────────────────────────────────────────────

    private static readonly string[] Races =
    [
        "Human", "Human", "Human",
        "Elf", "Dwarf", "Halfling", "Gnome", "Tiefling", "Dragonborn",
        "Half-Orc", "Half-Elf", "Aasimar", "Tabaxi", "Kenku",
        "Lizardfolk", "Goliath", "Firbolg", "Air Genasi", "Fire Genasi",
        "Water Genasi", "Earth Genasi",
    ];

    private static readonly string[] Occupations =
    [
        "baker", "farmer", "innkeeper", "blacksmith", "carpenter", "fisherman",
        "laundress", "cobbler", "miller", "shepherd", "butcher", "weaver",
        "stable hand", "dockworker", "street sweeper", "candle maker", "cook",
        "fruit seller", "guard", "courier",
        "rat catcher", "ink maker", "bone carver", "toll collector", "astrologer",
        "wool dyer", "glassblower", "plague doctor", "falconer", "chimney sweep",
        "mapmaker", "tooth puller", "ferryman", "bookbinder", "perfumer",
        "professional mourner", "debt collector", "pawnbroker", "tattooist",
        "grave digger", "poison taster", "leech collector", "census taker",
        "weather watcher", "siege engineer", "dog trainer", "salt merchant",
    ];

    private static readonly string[] Personalities =
    [
        "quiet and keeps to themselves", "cheerful and quick to laugh",
        "tired and just wants to get through the day", "practical and no-nonsense",
        "friendly but a little nosy", "shy around strangers but warm with regulars",
        "proud of their work and happy to talk about it", "a bit of a gossip",
        "easily flustered", "generally content with their lot in life",
        "cautious and slow to trust", "straightforward to the point of bluntness",
        "paranoid about small things", "deeply bored by everything",
        "obsessively competitive", "pathologically honest",
        "nostalgic to the point of sadness", "aggressively generous",
        "nervously talkative", "quietly judgmental",
        "convinced of their own importance", "perpetually exhausted",
        "terrified of silence", "unable to admit being wrong",
    ];

    private static readonly string[] QuirkExamples =
    [
        "always smells faintly of vinegar and insists it's a medicinal tonic",
        "refers to their tools or wares by name as if they're old friends",
        "ends every sentence with a small apologetic laugh",
        "keeps touching the same spot on their collar when nervous",
        "refuses to look anyone in the eye but is otherwise perfectly confident",
        "speaks very quietly and seems surprised when people can't hear them",
        "compulsively straightens things that aren't crooked",
        "uses old-fashioned words that no one else uses anymore",
        "always has a small snack on them and offers it immediately",
        "asks deeply personal follow-up questions to small talk",
    ];

    private static string[] Sample(string[] source, int count)
    {
        var rng = Random.Shared;
        return [.. source.OrderBy(_ => rng.Next()).Take(count)];
    }
}
