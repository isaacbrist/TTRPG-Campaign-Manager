namespace CampaignManager.Api.Dtos;

/// <summary>Generic paginated response wrapper returned by list endpoints.</summary>
public record PaginatedResult<T>(
    IEnumerable<T> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages
);
