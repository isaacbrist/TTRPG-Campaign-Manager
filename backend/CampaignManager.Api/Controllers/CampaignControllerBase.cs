using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using CampaignManager.Api.Data;
using CampaignManager.Api.Models;

namespace CampaignManager.Api.Controllers;

/// <summary>
/// Shared base for controllers that operate on resources belonging to a campaign.
/// Provides <see cref="AuthorizeCampaignAsync"/> to verify existence and ownership
/// before any action touches campaign-scoped data.
/// </summary>
public abstract class CampaignControllerBase(AppDbContext db) : ControllerBase
{
    protected string? CurrentUserId =>
        User.FindFirstValue(ClaimTypes.NameIdentifier);

    /// <summary>
    /// Looks up the campaign and confirms it belongs to the current user.
    /// Returns <c>(campaign, null)</c> on success, or <c>(null, errorResult)</c> on failure.
    /// </summary>
    protected async Task<(Campaign? campaign, IActionResult? error)> AuthorizeCampaignAsync(int campaignId)
    {
        var campaign = await db.Campaigns.FindAsync(campaignId);
        if (campaign is null) return (null, NotFound());
        if (campaign.UserId != CurrentUserId) return (null, Forbid());
        return (campaign, null);
    }
}
