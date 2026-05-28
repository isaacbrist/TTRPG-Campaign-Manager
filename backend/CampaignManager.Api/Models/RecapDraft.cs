using System.ComponentModel.DataAnnotations;

namespace CampaignManager.Api.Models;

/// <summary>
/// A "Previously on…" recap that is not attached to any session.
/// Created automatically when a recap is generated or when one is detached from a session.
/// </summary>
public class RecapDraft
{
    public int Id { get; set; }

    [Required]
    public int CampaignId { get; set; }

    [Required]
    public string Text { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Campaign? Campaign { get; set; }
}
