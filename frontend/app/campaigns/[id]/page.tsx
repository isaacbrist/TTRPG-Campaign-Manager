import type { Metadata } from "next";
import CampaignDashboardClient from "@/components/pages/CampaignDashboardClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  try {
    const { id } = await params;
    const res = await fetch(`${API_BASE}/campaigns/${id}`, { cache: "no-store" });
    if (res.ok) {
      const campaign = await res.json();
      if (typeof campaign.name === "string" && campaign.name) {
        return { title: campaign.name };
      }
    }
  } catch {
    // Fall through to default
  }
  return { title: "Campaign Dashboard" };
}

export default CampaignDashboardClient;
