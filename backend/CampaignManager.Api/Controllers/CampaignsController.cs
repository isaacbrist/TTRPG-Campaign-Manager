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
public class CampaignsController(AppDbContext db) : CampaignControllerBase(db)
{
    // ── GET /api/campaigns ───────────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        page     = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.Campaigns
            .Where(c => c.UserId == CurrentUserId)
            .OrderByDescending(c => c.CreatedAt);

        var totalCount = await query.CountAsync();
        var items      = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        return Ok(new PaginatedResult<Campaign>(items, page, pageSize, totalCount, totalPages));
    }

    // ── GET /api/campaigns/{id} ──────────────────────────────────────────────
    // Uses a custom query with Includes, so we run the ownership check inline
    // rather than calling AuthorizeCampaignAsync (which uses FindAsync).

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var campaign = await db.Campaigns.FindAsync(id);
        if (campaign is null) return NotFound();
        if (campaign.UserId != CurrentUserId) return Forbid();

        // Compute aggregate counts in the DB rather than loading full collections.
        var npcCount     = await db.Npcs.CountAsync(n => n.CampaignId == id);
        var sessionCount = await db.Sessions.CountAsync(s => s.CampaignId == id);
        var lastPlayedOn = await db.Sessions
            .Where(s => s.CampaignId == id)
            .OrderByDescending(s => s.SessionNumber)
            .Select(s => (DateTime?)s.PlayedOn)
            .FirstOrDefaultAsync();

        return Ok(CampaignDetailResponse.From(campaign, npcCount, sessionCount, lastPlayedOn));
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
        var (campaign, error) = await AuthorizeCampaignAsync(id);
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
        var (campaign, error) = await AuthorizeCampaignAsync(id);
        if (error is not null) return error;

        db.Campaigns.Remove(campaign!);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
