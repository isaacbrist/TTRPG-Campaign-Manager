namespace CampaignManager.Api.Services;

/// <summary>
/// Thin abstraction over the Anthropic SDK so that ClaudeService can be unit-tested
/// without making real HTTP calls.
/// </summary>
public interface IAnthropicMessageClient
{
    /// <summary>
    /// Sends a single-turn user message to Claude and returns the raw assistant text.
    /// </summary>
    Task<string> SendMessageAsync(
        string prompt,
        string model,
        int maxTokens,
        CancellationToken cancellationToken = default);
}
