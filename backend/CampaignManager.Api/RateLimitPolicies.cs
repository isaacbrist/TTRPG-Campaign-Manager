namespace CampaignManager.Api;

/// <summary>
/// Named rate-limiting policies referenced by
/// <see cref="Microsoft.AspNetCore.RateLimiting.EnableRateLimitingAttribute"/>.
/// Use these constants instead of inline strings to avoid typos and make
/// policy renames a single-file change.
/// </summary>
public static class RateLimitPolicies
{
    /// <summary>
    /// Fixed-window limiter applied to the three Anthropic AI endpoints:
    /// NPC generation, session-notes processing, and campaign recap.
    /// Allows 10 requests per minute per authenticated user.
    /// </summary>
    public const string AiEndpoints = "ai-endpoints";
}
