using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CampaignManager.Api.Data;
using CampaignManager.Api.Dtos;
using CampaignManager.Api.Models;

namespace CampaignManager.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/campaigns/{campaignId}/recap-drafts")]
public class RecapDraftsController(AppDbContext db) : CampaignControllerBase(db)
{
    // ── GET /api/campaigns/{campaignId}/recap-drafts ──────────────────────────

    /// <summary>List all unattached recap drafts for a campaign, newest first.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(int campaignId)
    {
        var (_, error) = await AuthorizeCampaignAsync(campaignId);
        if (error is not null) return error;

        var drafts = await db.RecapDrafts
            .Where(r => r.CampaignId == campaignId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        return Ok(drafts);
    }

    // ── DELETE /api/campaigns/{campaignId}/recap-drafts/{id} ─────────────────

    /// <summary>Permanently delete an unattached recap draft.</summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int campaignId, int id)
    {
        var (_, error) = await AuthorizeCampaignAsync(campaignId);
        if (error is not null) return error;

        var draft = await db.RecapDrafts.FirstOrDefaultAsync(r => r.CampaignId == campaignId && r.Id == id);
        if (draft is null) return NotFound();

        db.RecapDrafts.Remove(draft);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ── POST /api/campaigns/{campaignId}/recap-drafts/{id}/attach ────────────

    /// <summary>
    /// Attach a draft to a session: saves the draft text as the session's recap
    /// and removes the draft from the unattached folder.
    /// </summary>
    [HttpPost("{id}/attach")]
    public async Task<IActionResult> Attach(int campaignId, int id, [FromBody] AttachRecapDraftRequest request)
    {
        var (_, error) = await AuthorizeCampaignAsync(campaignId);
        if (error is not null) return error;

        var draft = await db.RecapDrafts.FirstOrDefaultAsync(r => r.CampaignId == campaignId && r.Id == id);
        if (draft is null) return NotFound("Recap draft not found.");

        var session = await db.Sessions.FirstOrDefaultAsync(s => s.CampaignId == campaignId && s.Id == request.SessionId);
        if (session is null) return NotFound("Session not found.");

        session.SavedRecap = draft.Text;
        db.RecapDrafts.Remove(draft);
        await db.SaveChangesAsync();

        return Ok(session);
    }
}
