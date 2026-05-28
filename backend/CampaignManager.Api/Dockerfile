# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore dependencies first (layer-cached unless .csproj changes)
COPY CampaignManager.Api.csproj ./
RUN dotnet restore

# Copy source and publish
COPY . .
RUN dotnet publish -c Release -o /app/publish

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Create data directory for SQLite volume mount
RUN mkdir -p /app/data

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "CampaignManager.Api.dll"]
