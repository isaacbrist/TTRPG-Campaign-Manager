namespace CampaignManager.Api.Dtos;

/// <summary>Request body for POST /api/campaigns/{id}/sessions.</summary>
public record CreateSessionRequest(DateTime? PlayedOn = null);

/// <summary>Request body for PUT /api/campaigns/{id}/sessions/{sessionId}.</summary>
public record UpdateSessionRequest(
    string? RawNotes = null,
    string? Summary  = null,
    DateTime? PlayedOn = null
);

/// <summary>Request body for PUT /api/campaigns/{id}/sessions/{sessionId}/recap.</summary>
public record SaveRecapRequest(string Recap);

/// <summary>Request body for POST /api/campaigns/{id}/recap-drafts/{draftId}/attach.</summary>
public record AttachRecapDraftRequest(int SessionId);
