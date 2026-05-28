using System.ComponentModel.DataAnnotations;

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
