using Anthropic.SDK;
using Anthropic.SDK.Messaging;

namespace CampaignManager.Api.Services;

/// <summary>
/// Production implementation: delegates to the real Anthropic.SDK client.
/// </summary>
public class AnthropicMessageClientWrapper(IConfiguration config) : IAnthropicMessageClient
{
    private readonly AnthropicClient _client = new(
        config["Anthropic:ApiKey"]
            ?? throw new InvalidOperationException("Anthropic:ApiKey is not configured."));

    public async Task<string> SendMessageAsync(
        string prompt,
        string model,
        int maxTokens,
        CancellationToken cancellationToken = default)
    {
        var response = await _client.Messages.GetClaudeMessageAsync(new MessageParameters
        {
            Model = model,
            MaxTokens = maxTokens,
            Messages =
            [
                new Message
                {
                    Role = RoleType.User,
                    Content = [new TextContent { Text = prompt }]
                }
            ]
        });

        return ((TextContent)response.Content[0]).Text;
    }
}
