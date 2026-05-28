using System.ComponentModel.DataAnnotations;

namespace CampaignManager.Api.Models;

public class Npc
{
    public int Id { get; set; }

    [Required]
    public int CampaignId { get; set; }

    [Required(ErrorMessage = "NPC name is required.")]
    [StringLength(200, MinimumLength = 1, ErrorMessage = "Name must be between 1 and 200 characters.")]
    public string Name { get; set; } = string.Empty;

    [StringLength(100, ErrorMessage = "Race cannot exceed 100 characters.")]
    public string? Race { get; set; }

    [StringLength(200, ErrorMessage = "Role cannot exceed 200 characters.")]
    public string? Role { get; set; }             // e.g. "Innkeeper", "Quest Giver", "Villain"

    [StringLength(1000, ErrorMessage = "Description cannot exceed 1000 characters.")]
    public string? Description { get; set; }      // Appearance

    [StringLength(1000, ErrorMessage = "Personality cannot exceed 1000 characters.")]
    public string? Personality { get; set; }

    [StringLength(500, ErrorMessage = "Quirk cannot exceed 500 characters.")]
    public string? Quirk { get; set; }            // Voice, habit, memorable trait

    [StringLength(1000, ErrorMessage = "Secret cannot exceed 1000 characters.")]
    public string? Secret { get; set; }

    [StringLength(100, ErrorMessage = "RelationshipToParty cannot exceed 100 characters.")]
    public string? RelationshipToParty { get; set; } // "Friendly", "Hostile", "Unknown"

    public string? Notes { get; set; }
    public bool IsAlive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Campaign? Campaign { get; set; }
}
