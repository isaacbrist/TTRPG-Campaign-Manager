using System.ComponentModel.DataAnnotations;

namespace CampaignManager.Api.Models;

public class Campaign
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Campaign name is required.")]
    [StringLength(200, MinimumLength = 1, ErrorMessage = "Name must be between 1 and 200 characters.")]
    public string Name { get; set; } = string.Empty;

    [StringLength(2000, ErrorMessage = "Description cannot exceed 2000 characters.")]
    public string? Description { get; set; }

    [StringLength(200, ErrorMessage = "Setting cannot exceed 200 characters.")]
    public string? Setting { get; set; }         // e.g. "Forgotten Realms", "Homebrew"

    public string? Notes { get; set; }           // Free-form lore: locations, factions, plot threads
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Ownership — nullable so existing campaigns aren't orphaned
    public string? UserId { get; set; }
    public User? User { get; set; }

    // Navigation
    public List<Npc> Npcs { get; set; } = [];
    public List<Session> Sessions { get; set; } = [];
    public List<RecapDraft> RecapDrafts { get; set; } = [];
}
