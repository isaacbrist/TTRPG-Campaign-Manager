using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CampaignManager.Api.Data;
using CampaignManager.Api.Dtos;
using CampaignManager.Api.Models;

namespace CampaignManager.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CampaignsController(AppDbContext db) : ControllerBase
{
    private string? CurrentUserId =>
        User.FindFirstValue(ClaimTypes.NameIdentifier);

    // ── Shared authorization helper ──────────────────────────────────────────
    // Extracted because the same find-check-forbid logic appeared in every
    // mutating action. Returns (campaign, null) on success or (null, result) on failure.

    private async Task<(Campaign? campaign, IActionResult? error)> FindAuthorizedAsync(int id)
    {
        var campaign = await db.Campaigns.FindAsync(id);
        if (campaign is null) return (null, NotFound());
        if (campaign.UserId != CurrentUserId) return (null, Forbid());
        return (campaign, null);
    }

    // ── GET /api/campaigns ───────────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var campaigns = await db.Campaigns
            .Where(c => c.UserId == CurrentUserId)
            .ToListAsync();
        return Ok(campaigns);
    }

    // ── GET /api/campaigns/{id} ──────────────────────────────────────────────

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var campaign = await db.Campaigns
            .Include(c => c.Npcs)
            .Include(c => c.Sessions.OrderBy(s => s.SessionNumber))
            .FirstOrDefaultAsync(c => c.Id == id);

        if (campaign is null) return NotFound();
        if (campaign.UserId != CurrentUserId) return Forbid();

        return Ok(campaign);
    }

    // ── POST /api/campaigns ──────────────────────────────────────────────────

    [HttpPost]
    public async Task<IActionResult> Create(CreateCampaignRequest request)
    {
        var campaign = new Campaign
        {
            Name        = request.Name,
            Description = request.Description,
            Setting     = request.Setting,
            UserId      = CurrentUserId,
        };

        db.Campaigns.Add(campaign);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = campaign.Id }, campaign);
    }

    // ── PUT /api/campaigns/{id} ──────────────────────────────────────────────

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, UpdateCampaignRequest request)
    {
        var (campaign, error) = await FindAuthorizedAsync(id);
        if (error is not null) return error;

        campaign!.Name        = request.Name;
        campaign.Description  = request.Description;
        campaign.Setting      = request.Setting;
        campaign.Notes        = request.Notes;

        await db.SaveChangesAsync();
        return Ok(campaign);
    }

    // ── DELETE /api/campaigns/{id} ───────────────────────────────────────────

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var (campaign, error) = await FindAuthorizedAsync(id);
        if (error is not null) return error;

        db.Campaigns.Remove(campaign!);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
