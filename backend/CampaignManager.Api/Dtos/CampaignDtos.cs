using System.ComponentModel.DataAnnotations;
using CampaignManager.Api.Models;

namespace CampaignManager.Api.Dtos;

/// <summary>Request body for POST /api/campaigns.</summary>
public record CreateCampaignRequest(
    [Required(ErrorMessage = "Campaign name is required.")]
    [StringLength(200, MinimumLength = 1)]
    string Name,
    [StringLength(2000)] string? Description = null,
    [StringLength(200)]  string? Setting     = null
);

/// <summary>Request body for PUT /api/campaigns/{id}.</summary>
public record UpdateCampaignRequest(
    [Required(ErrorMessage = "Campaign name is required.")]
    [StringLength(200, MinimumLength = 1)]
    string Name,
    [StringLength(2000)] string? Description = null,
    [StringLength(200)]  string? Setting     = null,
    string? Notes = null
);

/// <summary>
/// Response for GET /api/campaigns/{id}.
/// Returns aggregate counts rather than loading full NPC/Session collections.
/// </summary>
public record CampaignDetailResponse(
    int         Id,
    string      Name,
    string?     Description,
    string?     Setting,
    string?     Notes,
    DateTime    CreatedAt,
    string?     UserId,
    int         NpcCount,
    int         SessionCount,
    DateTime?   LastPlayedOn
)
{
    public static CampaignDetailResponse From(Campaign c, int npcCount, int sessionCount, DateTime? lastPlayedOn) =>
        new(c.Id, c.Name, c.Description, c.Setting, c.Notes, c.CreatedAt, c.UserId,
            npcCount, sessionCount, lastPlayedOn);
};
