"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getCampaign, getRecap, updateCampaign, type Campaign, RateLimitError, apiErrorMessage } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export default function CampaignDashboard() {
  const { id } = useParams<{ id: string }>();
  const campaignId = Number(id);
  const toast = useToast();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recap, setRecap] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const [loadingRecap, runRecap] = useAsyncAction((err) => {
    if (err instanceof RateLimitError) toast.rateLimitError(err.retryAfter);
    else toast.error(apiErrorMessage(err, "Failed to generate recap. Is the backend running?"));
  });

  const [savingNotes, saveNotes] = useAsyncAction(
    (err) => toast.error(apiErrorMessage(err, "Failed to save notes."))
  );

  useEffect(() => {
    getCampaign(campaignId)
      .then((c) => { setCampaign(c); setNotes(c.notes ?? ""); })
      .catch((err) => toast.error(apiErrorMessage(err, "Failed to load campaign.")));
  }, [campaignId]);

  async function handleRecap() {
    await runRecap(async () => {
      const { recap: generated } = await getRecap(campaignId);
      setRecap(generated);
      toast.success("Recap ready!");
    });
  }

  async function handleSaveNotes() {
    if (!campaign) return;
    await saveNotes(async () => {
      const updated = await updateCampaign(campaignId, { ...campaign, notes });
      setCampaign(updated);
      toast.success("Lore notes saved.");
    });
  }

  if (!campaign) return (
    <div className="flex items-center gap-3 text-stone-500 py-16 justify-center">
      <span className="text-2xl animate-pulse">⚔</span>
      <span>Loading campaign...</span>
    </div>
  );

  const npcCount = campaign.npcs?.length ?? 0;
  const sessionCount = campaign.sessions?.length ?? 0;
  const lastSession = campaign.sessions?.at(-1);

  return (
    <div className="space-y-8">
      {/* Breadcrumb + Header */}
      <div>
        <p className="text-stone-600 text-xs mb-2 flex items-center gap-1.5">
          <Link href="/" className="hover:text-amber-400 transition-colors">Campaigns</Link>
          <span>›</span>
          <span className="text-stone-500">{campaign.name}</span>
        </p>
        <h1 className="font-cinzel text-3xl text-amber-400 tracking-wide">{campaign.name}</h1>
        {campaign.setting && (
          <p className="text-stone-400 text-sm mt-1 uppercase tracking-wide">{campaign.setting}</p>
        )}
        {campaign.description && (
          <p className="text-stone-500 mt-2 max-w-2xl leading-relaxed">{campaign.description}</p>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard icon="👥" label="NPCs Tracked" value={npcCount} accent="amber" />
        <StatCard icon="📜" label="Sessions Logged" value={sessionCount} accent="blue" />
        <StatCard
          icon="🗓"
          label="Last Played"
          value={lastSession ? new Date(lastSession.playedOn).toLocaleDateString() : "—"}
          accent="green"
        />
      </div>

      {/* Nav tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href={`/campaigns/${campaignId}/npcs`}
          className="group bg-stone-900 border border-stone-800 hover:border-amber-700/50 rounded-xl p-6 transition-all hover:shadow-xl hover:shadow-amber-950/20 hover:-translate-y-0.5"
        >
          <p className="text-3xl mb-3">🧙</p>
          <div className="flex items-center gap-2">
            <h2 className="font-cinzel text-lg text-amber-400 group-hover:text-amber-300 transition-colors">
              NPC Roster
            </h2>
            <span className="text-stone-700 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all text-sm">→</span>
          </div>
          <p className="text-stone-500 text-sm mt-1.5 leading-relaxed">
            View, add, and AI-generate NPCs.{" "}
            {npcCount > 0 ? (
              <span className="text-stone-400">{npcCount} tracked so far.</span>
            ) : (
              "None yet."
            )}
          </p>
        </Link>
        <Link
          href={`/campaigns/${campaignId}/sessions`}
          className="group bg-stone-900 border border-stone-800 hover:border-amber-700/50 rounded-xl p-6 transition-all hover:shadow-xl hover:shadow-amber-950/20 hover:-translate-y-0.5"
        >
          <p className="text-3xl mb-3">📖</p>
          <div className="flex items-center gap-2">
            <h2 className="font-cinzel text-lg text-amber-400 group-hover:text-amber-300 transition-colors">
              Session Log
            </h2>
            <span className="text-stone-700 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all text-sm">→</span>
          </div>
          <p className="text-stone-500 text-sm mt-1.5 leading-relaxed">
            Add session notes and let AI extract story beats.{" "}
            {sessionCount > 0 ? (
              <span className="text-stone-400">{sessionCount} sessions logged.</span>
            ) : (
              "None yet."
            )}
          </p>
        </Link>
      </div>

      {/* AI Recap */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4 gap-4">
          <div>
            <h2 className="font-cinzel text-lg text-amber-400">Previously on your adventure…</h2>
            <p className="text-stone-600 text-xs mt-0.5">AI-generated recap from all session summaries</p>
          </div>
          <button
            onClick={handleRecap}
            disabled={loadingRecap || sessionCount === 0}
            className="shrink-0 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-stone-950 font-semibold px-4 py-1.5 rounded-lg text-sm transition-all"
          >
            {loadingRecap ? "Generating…" : "✨ Generate Recap"}
          </button>
        </div>
        {recap ? (
          <p className="text-stone-300 leading-relaxed whitespace-pre-wrap text-sm">{recap}</p>
        ) : (
          <p className="text-stone-600 italic text-sm">
            {sessionCount === 0
              ? "Log some sessions first, then generate a recap."
              : "Click \"Generate Recap\" to get an AI-written summary of your adventure so far."}
          </p>
        )}
      </div>

      {/* Lore Notes */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <h2 className="font-cinzel text-lg text-amber-400">Lore & World Notes</h2>
            <p className="text-stone-600 text-xs mt-0.5">
              Locations, factions, plot threads, house rules — anything worth remembering.
            </p>
          </div>
          <button
            onClick={handleSaveNotes}
            disabled={savingNotes || notes === (campaign.notes ?? "")}
            className="shrink-0 bg-stone-700 hover:bg-stone-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 px-4 py-1.5 rounded-lg text-sm transition-all text-stone-200"
          >
            {savingNotes ? "Saving…" : "Save"}
          </button>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={8}
          placeholder={"## Locations\n- The Rusted Flagon Inn — party's base in Millhaven\n\n## Factions\n- The Iron Circle — mysterious mercenary group, hostile\n\n## Plot Threads\n- Who sent the unsigned letter?"}
          className="w-full bg-stone-800/60 border border-stone-700 rounded-lg px-4 py-3 text-stone-100 placeholder-stone-700 focus:outline-none focus:border-amber-600/60 focus:ring-1 focus:ring-amber-600/20 resize-y text-sm leading-relaxed font-mono transition-colors"
        />
      </div>
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────

const ACCENT_STYLES: Record<string, { border: string; bg: string }> = {
  amber: { border: "border-amber-900/40", bg: "bg-amber-900/20" },
  blue:  { border: "border-blue-900/40",  bg: "bg-blue-900/20" },
  green: { border: "border-green-900/40", bg: "bg-green-900/20" },
};

function StatCard({ icon, label, value, accent = "amber" }: {
  icon: string;
  label: string;
  value: string | number;
  accent?: string;
}) {
  const s = ACCENT_STYLES[accent] ?? ACCENT_STYLES.amber;
  return (
    <div className={`bg-stone-900 border ${s.border} rounded-xl p-4 flex items-center gap-3`}>
      <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
        <span className="text-xl">{icon}</span>
      </div>
      <div>
        <p className="text-stone-500 text-xs uppercase tracking-wider">{label}</p>
        <p className="text-stone-100 font-semibold text-lg leading-tight mt-0.5">{value}</p>
      </div>
    </div>
  );
}
