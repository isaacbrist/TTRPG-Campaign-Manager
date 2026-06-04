using CampaignManager.Api.Models;
using CampaignManager.Api.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace CampaignManager.Tests;

/// <summary>
/// Unit tests for ClaudeService.
/// The Anthropic HTTP client is replaced with a Moq mock so no real API calls
/// are made and tests run without a key.
/// </summary>
public class ClaudeServiceTests
{
    private static ClaudeService CreateService(IAnthropicMessageClient client)
        => new(client, NullLogger<ClaudeService>.Instance);

    // ── ProcessSessionNotesAsync ─────────────────────────────────────────────

    [Fact]
    public async Task ProcessSessionNotesAsync_ValidJson_ParsesFieldsCorrectly()
    {
        // Arrange
        const string validJson = """
            {
              "summary": "The party descended into the Sunken Vault and defeated the golem.",
              "storyBeats": ["The party found the hidden entrance.", "A golem guardian was defeated."],
              "newNpcs": ["Mira the Archivist"]
            }
            """;

        var mockClient = new Mock<IAnthropicMessageClient>();
        mockClient
            .Setup(c => c.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(validJson);

        var session = new Session
        {
            Id = 1,
            CampaignId = 1,
            SessionNumber = 3,
            PlayedOn = DateTime.UtcNow,
            RawNotes = "We found the vault and fought a golem. Met Mira the Archivist."
        };

        var sut = CreateService(mockClient.Object);

        // Act
        await sut.ProcessSessionNotesAsync(session);

        // Assert
        Assert.Equal(
            "The party descended into the Sunken Vault and defeated the golem.",
            session.Summary);

        Assert.NotNull(session.StoryBeats);
        Assert.Contains("The party found the hidden entrance.", session.StoryBeats);

        Assert.NotNull(session.NewNpcsFound);
        Assert.Contains("Mira the Archivist", session.NewNpcsFound);
    }

    [Fact]
    public async Task ProcessSessionNotesAsync_ApiThrows_WrapsExceptionWithUsefulMessage()
    {
        // Arrange — simulate a network / auth failure from the Anthropic API
        var mockClient = new Mock<IAnthropicMessageClient>();
        mockClient
            .Setup(c => c.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("Connection refused"));

        var session = new Session
        {
            Id = 2,
            CampaignId = 1,
            SessionNumber = 4,
            PlayedOn = DateTime.UtcNow,
            RawNotes = "Some notes"
        };

        var sut = CreateService(mockClient.Object);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => sut.ProcessSessionNotesAsync(session));

        Assert.Contains("Failed to reach the Claude API", ex.Message);
        Assert.Contains("Connection refused", ex.Message);
        Assert.IsType<HttpRequestException>(ex.InnerException);
    }

    [Fact]
    public async Task ProcessSessionNotesAsync_MalformedJson_ThrowsWithUsefulMessage()
    {
        // Arrange — API responds but with garbage (e.g. a truncated response)
        var mockClient = new Mock<IAnthropicMessageClient>();
        mockClient
            .Setup(c => c.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("This is definitely not JSON {{{");

        var session = new Session
        {
            Id = 3,
            CampaignId = 1,
            SessionNumber = 5,
            PlayedOn = DateTime.UtcNow,
            RawNotes = "Some notes"
        };

        var sut = CreateService(mockClient.Object);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => sut.ProcessSessionNotesAsync(session));

        Assert.Contains("could not be parsed", ex.Message);
    }

    // ── GenerateRecapAsync ───────────────────────────────────────────────────

    [Fact]
    public async Task GenerateRecapAsync_ValidSessions_ReturnsRecapText()
    {
        // Arrange
        const string expectedRecap = "Previously, the brave heroes ventured into the dark...";

        var mockClient = new Mock<IAnthropicMessageClient>();
        mockClient
            .Setup(c => c.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedRecap);

        var sessions = new List<Session>
        {
            new() { SessionNumber = 1, Summary = "Session one summary." },
            new() { SessionNumber = 2, Summary = "Session two summary." }
        };

        var sut = CreateService(mockClient.Object);

        // Act
        var result = await sut.GenerateRecapAsync(sessions);

        // Assert
        Assert.Equal(expectedRecap, result);
    }

    [Fact]
    public async Task GenerateRecapAsync_ApiThrows_WrapsExceptionWithUsefulMessage()
    {
        // Arrange
        var mockClient = new Mock<IAnthropicMessageClient>();
        mockClient
            .Setup(c => c.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("Timeout"));

        var sut = CreateService(mockClient.Object);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => sut.GenerateRecapAsync(new List<Session>()));

        Assert.Contains("Failed to reach the Claude API", ex.Message);
        Assert.Contains("Timeout", ex.Message);
    }

    // ── GenerateNpcAsync ─────────────────────────────────────────────────────

    [Fact]
    public async Task GenerateNpcAsync_ValidJson_ReturnsPopulatedNpc()
    {
        // Arrange
        const string npcJson = """
            {
              "name": "Bertram Hallow",
              "race": "Human",
              "role": "Innkeeper",
              "description": "A stout man with one permanently raised eyebrow.",
              "personality": "Cheerful, though he remembers every slight.",
              "quirk": "Wipes the bar even when it is already spotless.",
              "secret": "Owes a substantial debt to a local thieves guild.",
              "relationshipToParty": "Unknown"
            }
            """;

        var mockClient = new Mock<IAnthropicMessageClient>();
        mockClient
            .Setup(c => c.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(npcJson);

        var sut = CreateService(mockClient.Object);

        // Act
        var npc = await sut.GenerateNpcAsync(campaignId: 5, hints: null);

        // Assert
        Assert.Equal("Bertram Hallow", npc.Name);
        Assert.Equal("Human", npc.Race);
        Assert.Equal("Innkeeper", npc.Role);
        Assert.Equal(5, npc.CampaignId);
        Assert.Equal("Unknown", npc.RelationshipToParty);
    }

    [Fact]
    public async Task GenerateNpcAsync_MalformedJson_ThrowsWithUsefulMessage()
    {
        // Arrange
        var mockClient = new Mock<IAnthropicMessageClient>();
        mockClient
            .Setup(c => c.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("Oops, I forgot to return JSON.");

        var sut = CreateService(mockClient.Object);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => sut.GenerateNpcAsync(campaignId: 1, hints: null));

        Assert.Contains("could not be parsed", ex.Message);
    }

    // ── StripCodeFences (via ProcessSessionNotesAsync) ───────────────────────

    [Fact]
    public async Task ProcessSessionNotesAsync_ResponseInCodeFence_StripsCorrectly()
    {
        // Arrange — Claude sometimes wraps its JSON in a ```json ... ``` block
        const string fencedJson = """
            ```json
            {
              "summary": "A fenced summary.",
              "storyBeats": ["Beat one."],
              "newNpcs": []
            }
            ```
            """;

        var mockClient = new Mock<IAnthropicMessageClient>();
        mockClient
            .Setup(c => c.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(fencedJson);

        var session = new Session { Id = 10, CampaignId = 1, SessionNumber = 1,
            PlayedOn = DateTime.UtcNow, RawNotes = "Notes." };

        var sut = CreateService(mockClient.Object);

        // Act — should not throw; the fence is stripped before JSON parsing
        await sut.ProcessSessionNotesAsync(session);

        // Assert
        Assert.Equal("A fenced summary.", session.Summary);
    }

    [Fact]
    public async Task ProcessSessionNotesAsync_UnclosedCodeFence_DoesNotThrow()
    {
        // Arrange — response starts with ``` but has no closing fence.
        // Before the fix, StripCodeFences would produce a negative range and throw.
        const string unclosedFence = "```\nnot valid json at all";

        var mockClient = new Mock<IAnthropicMessageClient>();
        mockClient
            .Setup(c => c.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(unclosedFence);

        var session = new Session { Id = 11, CampaignId = 1, SessionNumber = 2,
            PlayedOn = DateTime.UtcNow, RawNotes = "Notes." };

        var sut = CreateService(mockClient.Object);

        // Act & Assert — should throw InvalidOperationException (JSON parse failure),
        // NOT ArgumentOutOfRangeException from the fence-stripping code.
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => sut.ProcessSessionNotesAsync(session));

        Assert.Contains("could not be parsed", ex.Message);
    }
}
