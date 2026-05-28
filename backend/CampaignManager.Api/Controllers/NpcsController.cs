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
[Route("api/campaigns/{campaignId}/npcs")]
public class NpcsController(AppDbContext db, ClaudeService claudeService) : CampaignControllerBase(db)
{
    // ── GET /api/campaigns/{campaignId}/npcs ─────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetAll(int campaignId)
    {
        var (_, error) = await AuthorizeCampaignAsync(campaignId);
        if (error is not null) return error;

        return Ok(await db.Npcs.Where(n => n.CampaignId == campaignId).ToListAsync());
    }

    // ── GET /api/campaigns/{campaignId}/npcs/{id} ────────────────────────────

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int campaignId, int id)
    {
        var (_, error) = await AuthorizeCampaignAsync(campaignId);
        if (error is not null) return error;

        var npc = await db.Npcs.FirstOrDefaultAsync(n => n.CampaignId == campaignId && n.Id == id);
        return npc is null ? NotFound() : Ok(npc);
    }

    // ── POST /api/campaigns/{campaignId}/npcs ────────────────────────────────

    [HttpPost]
    public async Task<IActionResult> Create(int campaignId, CreateNpcRequest request)
    {
        var (_, error) = await AuthorizeCampaignAsync(campaignId);
        if (error is not null) return error;

        var npc = new Npc
        {
            CampaignId           = campaignId,
            Name                 = request.Name,
            Race                 = request.Race,
            Role                 = request.Role,
            Description          = request.Description,
            Personality          = request.Personality,
            Quirk                = request.Quirk,
            Secret               = request.Secret,
            Notes                = request.Notes,
            RelationshipToParty  = request.RelationshipToParty,
            IsAlive              = request.IsAlive,
        };

        db.Npcs.Add(npc);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { campaignId, id = npc.Id }, npc);
    }

    // ── POST /api/campaigns/{campaignId}/npcs/generate ───────────────────────

    [HttpPost("generate")]
    [EnableRateLimiting(RateLimitPolicies.AiEndpoints)]
    public async Task<IActionResult> GenerateRandom(int campaignId, [FromBody] GenerateNpcRequest request)
    {
        var (_, error) = await AuthorizeCampaignAsync(campaignId);
        if (error is not null) return error;

        var npc = await claudeService.GenerateNpcAsync(campaignId, request.Hints);
        db.Npcs.Add(npc);
        await db.SaveChangesAsync();
        return Ok(npc);
    }

    // ── PUT /api/campaigns/{campaignId}/npcs/{id} ────────────────────────────

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int campaignId, int id, UpdateNpcRequest request)
    {
        var (_, error) = await AuthorizeCampaignAsync(campaignId);
        if (error is not null) return error;

        var npc = await db.Npcs.FirstOrDefaultAsync(n => n.CampaignId == campaignId && n.Id == id);
        if (npc is null) return NotFound();

        npc.Name                = request.Name;
        npc.Race                = request.Race;
        npc.Role                = request.Role;
        npc.Description         = request.Description;
        npc.Personality         = request.Personality;
        npc.Quirk               = request.Quirk;
        npc.Secret              = request.Secret;
        npc.RelationshipToParty = request.RelationshipToParty;
        npc.Notes               = request.Notes;
        npc.IsAlive             = request.IsAlive;

        await db.SaveChangesAsync();
        return Ok(npc);
    }

    // ── DELETE /api/campaigns/{campaignId}/npcs/{id} ─────────────────────────

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int campaignId, int id)
    {
        var (_, error) = await AuthorizeCampaignAsync(campaignId);
        if (error is not null) return error;

        var npc = await db.Npcs.FirstOrDefaultAsync(n => n.CampaignId == campaignId && n.Id == id);
        if (npc is null) return NotFound();

        db.Npcs.Remove(npc);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
