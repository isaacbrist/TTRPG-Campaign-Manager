namespace CampaignManager.Api.Models;

public class PasswordResetToken
{
    public string Id { get; set; } = Guid.NewGuid().ToString();

    public string UserId { get; set; } = "";
    public User? User { get; set; }

    /// <summary>SHA-256 hash of the raw token sent in the email URL.</summary>
    public string TokenHash { get; set; } = "";

    public DateTime ExpiresAt { get; set; }

    /// <summary>Null until the token has been successfully redeemed.</summary>
    public DateTime? UsedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
