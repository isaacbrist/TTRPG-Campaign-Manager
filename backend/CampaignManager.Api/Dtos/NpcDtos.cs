using System.ComponentModel.DataAnnotations;

namespace CampaignManager.Api.Dtos;

/// <summary>Request body for POST /api/campaigns/{id}/npcs.</summary>
public record CreateNpcRequest(
    [Required(ErrorMessage = "NPC name is required.")]
    [StringLength(200, MinimumLength = 1)]
    string Name,
    [StringLength(100)]  string? Race                = null,
    [StringLength(200)]  string? Role                = null,
    [StringLength(1000)] string? Description         = null,
    [StringLength(1000)] string? Personality         = null,
    [StringLength(500)]  string? Quirk               = null,
    [StringLength(1000)] string? Secret              = null,
    string? Notes                                    = null,
    [StringLength(100)]  string? RelationshipToParty = "Unknown",
    bool IsAlive                                     = true
);

/// <summary>Request body for PUT /api/campaigns/{id}/npcs/{npcId}.</summary>
public record UpdateNpcRequest(
    [Required(ErrorMessage = "NPC name is required.")]
    [StringLength(200, MinimumLength = 1)]
    string Name,
    [StringLength(100)]  string? Race                = null,
    [StringLength(200)]  string? Role                = null,
    [StringLength(1000)] string? Description         = null,
    [StringLength(1000)] string? Personality         = null,
    [StringLength(500)]  string? Quirk               = null,
    [StringLength(1000)] string? Secret              = null,
    string? Notes                                    = null,
    [StringLength(100)]  string? RelationshipToParty = null,
    bool IsAlive                                     = true
);

/// <summary>Request body for POST /api/campaigns/{id}/npcs/generate.</summary>
public record GenerateNpcRequest(string Hints = "");
