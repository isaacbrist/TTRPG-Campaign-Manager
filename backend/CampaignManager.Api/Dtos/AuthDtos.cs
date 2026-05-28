using System.ComponentModel.DataAnnotations;

namespace CampaignManager.Api.Dtos;

public record AuthRequest(string Email, string Password);

public record ForgotPasswordRequest([Required] string Email);

public record ResetPasswordRequest([Required] string Token, [Required][MinLength(8)] string NewPassword);
