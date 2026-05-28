using System.Net;
using System.Net.Http.Json;
using CampaignManager.Api.Data;
using CampaignManager.Api.Models;
using CampaignManager.Api.Services;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace CampaignManager.Tests;

/// <summary>
/// Integration tests for CampaignsController.
/// Each test gets its own in-memory database (via a fresh factory) so there
/// is no shared state between tests.
/// </summary>
public class CampaignsControllerTests : IAsyncLifetime
{
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    // ── Test lifecycle ────────────────────────────────────────────────────────

    public Task InitializeAsync()
    {
        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    // Replace the real SQLite DB with an isolated in-memory database
                    services.RemoveAll<DbContextOptions<AppDbContext>>();
                    services.RemoveAll<AppDbContext>();
                    services.AddDbContext<AppDbContext>(options =>
                        options.UseInMemoryDatabase(Guid.NewGuid().ToString()));

                    // Replace the real Anthropic client so no API key is required
                    services.RemoveAll<IAnthropicMessageClient>();
                    services.AddSingleton<IAnthropicMessageClient>(
                        Mock.Of<IAnthropicMessageClient>());
                });
            });

        _client = _factory.CreateClient();
        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<Campaign> CreateCampaignAsync(
        string name = "Test Campaign",
        string? description = "A test",
        string? setting = "Homebrew")
    {
        var response = await _client.PostAsJsonAsync("/api/campaigns", new { name, description, setting });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<Campaign>())!;
    }

    // ── GET /api/campaigns ────────────────────────────────────────────────────

    [Fact]
    public async Task GetAll_EmptyDatabase_ReturnsEmptyList()
    {
        var response = await _client.GetAsync("/api/campaigns");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var campaigns = await response.Content.ReadFromJsonAsync<List<Campaign>>();
        Assert.NotNull(campaigns);
        Assert.Empty(campaigns);
    }

    [Fact]
    public async Task GetAll_AfterCreating_ReturnsAllCampaigns()
    {
        await CreateCampaignAsync("Dragon Coast Chronicles");
        await CreateCampaignAsync("Underdark Descent");

        var response = await _client.GetAsync("/api/campaigns");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var campaigns = await response.Content.ReadFromJsonAsync<List<Campaign>>();
        Assert.NotNull(campaigns);
        Assert.Equal(2, campaigns.Count);
        Assert.Contains(campaigns, c => c.Name == "Dragon Coast Chronicles");
        Assert.Contains(campaigns, c => c.Name == "Underdark Descent");
    }

    // ── POST /api/campaigns ───────────────────────────────────────────────────

    [Fact]
    public async Task Create_ValidPayload_Returns201WithCampaign()
    {
        var payload = new { name = "Lost Mine of Phandelver", description = "Starter adventure", setting = "Forgotten Realms" };
        var response = await _client.PostAsJsonAsync("/api/campaigns", payload);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var created = await response.Content.ReadFromJsonAsync<Campaign>();
        Assert.NotNull(created);
        Assert.Equal("Lost Mine of Phandelver", created.Name);
        Assert.Equal("Starter adventure", created.Description);
        Assert.Equal("Forgotten Realms", created.Setting);
        Assert.True(created.Id > 0);
    }

    [Fact]
    public async Task Create_MissingName_Returns400()
    {
        // Name is [Required] so an empty name should fail model validation
        var response = await _client.PostAsJsonAsync("/api/campaigns", new { name = "", description = "desc" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── GET /api/campaigns/{id} ───────────────────────────────────────────────

    [Fact]
    public async Task GetById_ExistingId_ReturnsCampaign()
    {
        var created = await CreateCampaignAsync("Curse of Strahd");

        var response = await _client.GetAsync($"/api/campaigns/{created.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var campaign = await response.Content.ReadFromJsonAsync<Campaign>();
        Assert.NotNull(campaign);
        Assert.Equal(created.Id, campaign.Id);
        Assert.Equal("Curse of Strahd", campaign.Name);
    }

    [Fact]
    public async Task GetById_NonExistentId_Returns404()
    {
        var response = await _client.GetAsync("/api/campaigns/99999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ── DELETE /api/campaigns/{id} ────────────────────────────────────────────

    [Fact]
    public async Task Delete_ExistingCampaign_Returns204AndRemovesIt()
    {
        var created = await CreateCampaignAsync("Tomb of Annihilation");

        var deleteResponse = await _client.DeleteAsync($"/api/campaigns/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        // Verify it is gone
        var getResponse = await _client.GetAsync($"/api/campaigns/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }

    [Fact]
    public async Task Delete_NonExistentId_Returns404()
    {
        var response = await _client.DeleteAsync("/api/campaigns/88888");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ── PUT /api/campaigns/{id} ───────────────────────────────────────────────

    [Fact]
    public async Task Update_ExistingCampaign_Returns200WithUpdatedValues()
    {
        var created = await CreateCampaignAsync("Old Name", "Old desc", "Old Setting");

        var updatePayload = new
        {
            name        = "New Name",
            description = "New description",
            setting     = "New Setting",
            notes       = (string?)null
        };

        var response = await _client.PutAsJsonAsync($"/api/campaigns/{created.Id}", updatePayload);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var updated = await response.Content.ReadFromJsonAsync<Campaign>();
        Assert.NotNull(updated);
        Assert.Equal("New Name", updated.Name);
        Assert.Equal("New description", updated.Description);
        Assert.Equal("New Setting", updated.Setting);
    }
}
