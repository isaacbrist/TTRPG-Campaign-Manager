using System.ComponentModel.DataAnnotations;

namespace CampaignManager.Api.Models;

public class Session
{
    public int Id { get; set; }

    [Required]
    public int CampaignId { get; set; }

    // Auto-assigned on creation — clients should not send this value.
    public int SessionNumber { get; set; }

    public DateTime PlayedOn { get; set; } = DateTime.UtcNow;

    public string? RawNotes { get; set; }         // Pasted raw session notes
    public string? Summary { get; set; }          // AI-generated cohesive summary
    public string? StoryBeats { get; set; }       // AI-extracted key beats (JSON array)
    public string? NewNpcsFound { get; set; }     // AI-extracted NPC names from notes
    public string? SavedRecap { get; set; }       // "Previously on..." recap saved/attached to this session

    // Navigation
    public Campaign? Campaign { get; set; }
}
