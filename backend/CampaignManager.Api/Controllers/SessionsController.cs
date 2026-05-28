using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using CampaignManager.Api.Data;
using CampaignManager.Api.Dtos;
using CampaignManager.Api.Models;
using CampaignManager.Api.Services;

namespace CampaignManager.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/campaigns/{campaignId}/sessions")]
public class SessionsController(AppDbContext db, ClaudeService claudeService) : CampaignControllerBase(db)
{
    // ── GET /api/campaigns/{campaignId}/sessions ─────────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetAll(int campaignId)
    {
        var (_, error) = await AuthorizeCampaignAsync(campaignId);
        if (error is not null) return error;

        return Ok(await db.Sessions
            .Where(s => s.CampaignId == campaignId)
            .OrderBy(s => s.SessionNumber)
            .ToListAsync());
    }

    // ── GET /api/campaigns/{campaignId}/sessions/{id} ────────────────────────

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int campaignId, int id)
    {
        var (_, error) = await AuthorizeCampaignAsync(campaignId);
        if (error is not null) return error;

        var session = await db.Sessions.FirstOrDefaultAsync(s => s.CampaignId == campaignId && s.Id == id);
        return session is null ? NotFound() : Ok(session);
    }

    // ── POST /api/campaigns/{campaignId}/sessions ────────────────────────────

    [HttpPost]
    public async Task<IActionResult> Create(int campaignId, CreateSessionRequest request)
    {
        var (_, error) = await AuthorizeCampaignAsync(campaignId);
        if (error is not null) return error;

        // Auto-assign SessionNumber: max existing + 1, defaulting to 1.
        var maxNumber = await db.Sessions
            .Where(s => s.CampaignId == campaignId)
            .Select(s => (int?)s.SessionNumber)
            .MaxAsync();

        var session = new Session
        {
            CampaignId    = campaignId,
            SessionNumber = (maxNumber ?? 0) + 1,
            PlayedOn      = request.PlayedOn ?? DateTime.UtcNow,
        };

        db.Sessions.Add(session);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { campaignId, id = session.Id }, session);
    }

    // ── PUT /api/campaigns/{campaignId}/sessions/{id} ────────────────────────

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int campaignId, int id, UpdateSessionRequest request)
    {
        var (_, error) = await AuthorizeCampaignAsync(campaignId);
        if (error is not null) return error;

        var session = await db.Sessions.FirstOrDefaultAsync(s => s.CampaignId == campaignId && s.Id == id);
        if (session is null) return NotFound();

        session.RawNotes = request.RawNotes;
        session.Summary  = request.Summary;
        if (request.PlayedOn.HasValue) session.PlayedOn = request.PlayedOn.Value;

        await db.SaveChangesAsync();
        return Ok(session);
    }

    // ── DELETE /api/campaigns/{campaignId}/sessions/{id} ─────────────────────

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int campaignId, int id)
    {
        var (_, error) = await AuthorizeCampaignAsync(campaignId);
        if (error is not null) return error;

        var session = await db.Sessions.FirstOrDefaultAsync(s => s.CampaignId == campaignId && s.Id == id);
        if (session is null) return NotFound();

        db.Sessions.Remove(session);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ── POST /api/campaigns/{campaignId}/sessions/{id}/process ───────────────

    /// <summary>Submit raw notes — Claude extracts beats, NPCs, and a summary.</summary>
    [HttpPost("{id}/process")]
    [EnableRateLimiting(RateLimitPolicies.AiEndpoints)]
    public async Task<IActionResult> ProcessNotes(int campaignId, int id)
    {
        var (_, error) = await AuthorizeCampaignAsync(campaignId);
        if (error is not null) return error;

        var session = await db.Sessions.FirstOrDefaultAsync(s => s.CampaignId == campaignId && s.Id == id);
        if (session is null) return NotFound();
        if (string.IsNullOrWhiteSpace(session.RawNotes)) return BadRequest("No raw notes to process.");

        await claudeService.ProcessSessionNotesAsync(session);
        await db.SaveChangesAsync();
        return Ok(session);
    }

    // ── GET /api/campaigns/{campaignId}/sessions/recap ───────────────────────

    /// <summary>
    /// Generate a "Previously on…" recap from all summarised sessions.
    /// The generated text is automatically saved as an unattached RecapDraft
    /// so it is never silently lost — the draft id is returned alongside the text.
    /// </summary>
    [HttpGet("recap")]
    [EnableRateLimiting(RateLimitPolicies.AiEndpoints)]
    public async Task<IActionResult> GetRecap(int campaignId)
    {
        var (_, error) = await AuthorizeCampaignAsync(campaignId);
        if (error is not null) return error;

        var sessions = await db.Sessions
            .Where(s => s.CampaignId == campaignId && s.Summary != null)
            .OrderBy(s => s.SessionNumber)
            .ToListAsync();

        if (sessions.Count == 0) return Ok(new { recap = "No sessions have been summarized yet.", draftId = (int?)null });

        var recap = await claudeService.GenerateRecapAsync(sessions);

        // Auto-save as an unattached draft so the user never loses a generated recap.
        var draft = new RecapDraft { CampaignId = campaignId, Text = recap };
        db.RecapDrafts.Add(draft);
        await db.SaveChangesAsync();

        return Ok(new { recap, draftId = draft.Id });
    }

    // ── PUT /api/campaigns/{campaignId}/sessions/{id}/recap ──────────────────

    /// <summary>Save or replace the recap attached to a specific session.</summary>
    [HttpPut("{id}/recap")]
    public async Task<IActionResult> SaveRecap(int campaignId, int id, [FromBody] SaveRecapRequest request)
    {
        var (_, error) = await AuthorizeCampaignAsync(campaignId);
        if (error is not null) return error;

        var session = await db.Sessions.FirstOrDefaultAsync(s => s.CampaignId == campaignId && s.Id == id);
        if (session is null) return NotFound();

        session.SavedRecap = request.Recap;
        await db.SaveChangesAsync();
        return Ok(session);
    }

    // ── DELETE /api/campaigns/{campaignId}/sessions/{id}/recap ───────────────

    /// <summary>
    /// Detach (clear) the recap from a session.
    /// The recap text is moved into the campaign's unattached RecapDraft folder
    /// rather than being permanently deleted.
    /// </summary>
    [HttpDelete("{id}/recap")]
    public async Task<IActionResult> ClearRecap(int campaignId, int id)
    {
        var (_, error) = await AuthorizeCampaignAsync(campaignId);
        if (error is not null) return error;

        var session = await db.Sessions.FirstOrDefaultAsync(s => s.CampaignId == campaignId && s.Id == id);
        if (session is null) return NotFound();

        // Preserve the recap text as an unattached draft instead of discarding it.
        if (!string.IsNullOrWhiteSpace(session.SavedRecap))
        {
            db.RecapDrafts.Add(new RecapDraft { CampaignId = campaignId, Text = session.SavedRecap });
        }

        session.SavedRecap = null;
        await db.SaveChangesAsync();
        return Ok(session);
    }

    // ── DELETE /api/campaigns/{campaignId}/sessions/{id}/notes ───────────────

    /// <summary>Clear only the raw notes (keeps AI summary).</summary>
    [HttpDelete("{id}/notes")]
    public async Task<IActionResult> ClearNotes(int campaignId, int id)
    {
        var (_, error) = await AuthorizeCampaignAsync(campaignId);
        if (error is not null) return error;

        var session = await db.Sessions.FirstOrDefaultAsync(s => s.CampaignId == campaignId && s.Id == id);
        if (session is null) return NotFound();

        session.RawNotes = null;
        await db.SaveChangesAsync();
        return Ok(session);
    }

    // ── DELETE /api/campaigns/{campaignId}/sessions/{id}/summary ─────────────

    /// <summary>Clear AI summary, story beats, and NPC list (keeps raw notes).</summary>
    [HttpDelete("{id}/summary")]
    public async Task<IActionResult> ClearSummary(int campaignId, int id)
    {
        var (_, error) = await AuthorizeCampaignAsync(campaignId);
        if (error is not null) return error;

        var session = await db.Sessions.FirstOrDefaultAsync(s => s.CampaignId == campaignId && s.Id == id);
        if (session is null) return NotFound();

        session.Summary      = null;
        session.StoryBeats   = null;
        session.NewNpcsFound = null;
        await db.SaveChangesAsync();
        return Ok(session);
    }
}
