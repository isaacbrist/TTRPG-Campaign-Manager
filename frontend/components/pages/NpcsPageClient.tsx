"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getNpcs, createNpc, generateNpc, updateNpc, deleteNpc, type Npc, type CreateNpcRequest, RateLimitError, apiErrorMessage } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { Pagination } from "@/components/Pagination";

const RELATIONSHIP_COLORS: Record<string, string> = {
  Friendly: "text-green-400 bg-green-900/30 border-green-800/60",
  Hostile:  "text-red-400 bg-red-900/30 border-red-800/60",
  Neutral:  "text-yellow-400 bg-yellow-900/30 border-yellow-800/60",
  Unknown:  "text-stone-400 bg-stone-800/60 border-stone-700",
};

const RELATIONSHIP_CYCLE = ["Unknown", "Friendly", "Neutral", "Hostile"];

export default function NpcsPageClient() {
  const { id } = useParams<{ id: string }>();
  const campaignId = Number(id);
  const toast = useToast();

  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hints, setHints] = useState("");
  const [selected, setSelected] = useState<Npc | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newNpc, setNewNpc] = useState<Partial<CreateNpcRequest>>({ isAlive: true, relationshipToParty: "Unknown" });
  const [editingNpc, setEditingNpc] = useState(false);
  const [npcDraft, setNpcDraft] = useState<Partial<Npc>>({});
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "alive" | "deceased">("all");
  const [filterRelationship, setFilterRelationship] = useState<string>("all");
  /** ID of the NPC pending inline delete confirmation. */
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);

  // Focus trap for the Add NPC modal
  const npcModalRef = useFocusTrap<HTMLDivElement>(showCreate);

  const [generating, generate] = useAsyncAction((err) => {
    if (err instanceof RateLimitError) toast.rateLimitError((err as RateLimitError).retryAfter);
    else toast.error(apiErrorMessage(err, "Failed to generate NPC. Check the backend logs."));
  });

  const [creating, create] = useAsyncAction(
    (err) => toast.error(apiErrorMessage(err, "Failed to create NPC."))
  );

  const [savingEdit, saveEdit] = useAsyncAction(
    (err) => toast.error(apiErrorMessage(err, "Failed to save changes."))
  );

  useEffect(() => {
    setLoading(true);
    getNpcs(campaignId, {
      page,
      pageSize: 20,
      search: search || undefined,
      status: filterStatus !== "all" ? filterStatus : undefined,
      relationship: filterRelationship !== "all" ? filterRelationship : undefined,
    })
      .then((result) => {
        setNpcs(result.items);
        setTotalPages(result.totalPages);
      })
      .catch((err) => toast.error(apiErrorMessage(err, "Failed to load NPCs.")))
      .finally(() => setLoading(false));
  }, [campaignId, page, search, filterStatus, filterRelationship]);

  // Reset to page 1 whenever the search text or any filter changes so the user
  // always starts from the beginning of the (alphabetically sorted) list.
  useEffect(() => {
    setPage(1);
  }, [search, filterStatus, filterRelationship]);

  /** Shared filter params so all refetches stay consistent with active filters. */
  const activeFilters = {
    search: search || undefined,
    status: filterStatus !== "all" ? filterStatus : undefined,
    relationship: filterRelationship !== "all" ? filterRelationship : undefined,
  };

  async function handleGenerate() {
    await generate(async () => {
      const npc = await generateNpc(campaignId, hints);
      // Re-fetch page 1 (alphabetical) so the new NPC appears in correct position
      setPage(1);
      const result = await getNpcs(campaignId, { page: 1, pageSize: 20, ...activeFilters });
      setNpcs(result.items);
      setTotalPages(result.totalPages);
      setSelected(npc);
      setHints("");
      toast.success(`${npc.name} added to the roster.`);
    });
  }

  async function handleCreate() {
    await create(async () => {
      const npc = await createNpc(campaignId, newNpc as CreateNpcRequest);
      setPage(1);
      const result = await getNpcs(campaignId, { page: 1, pageSize: 20, ...activeFilters });
      setNpcs(result.items);
      setTotalPages(result.totalPages);
      setShowCreate(false);
      setNewNpc({ isAlive: true, relationshipToParty: "Unknown" });
      toast.success(`${npc.name} added to the roster.`);
    });
  }

  async function handleToggleAlive(npc: Npc) {
    try {
      const updated = await updateNpc(campaignId, npc.id, { ...npc, isAlive: !npc.isAlive });
      setNpcs((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      if (selected?.id === npc.id) setSelected(updated);
      toast.success(`${npc.name} marked as ${updated.isAlive ? "alive" : "deceased"}.`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to update status."));
    }
  }

  async function handleCycleRelationship(npc: Npc) {
    const next = RELATIONSHIP_CYCLE[
      (RELATIONSHIP_CYCLE.indexOf(npc.relationshipToParty ?? "Unknown") + 1) % RELATIONSHIP_CYCLE.length
    ];
    try {
      const updated = await updateNpc(campaignId, npc.id, { ...npc, relationshipToParty: next });
      setNpcs((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      if (selected?.id === npc.id) setSelected(updated);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to update relationship."));
    }
  }

  async function handleSaveEdit() {
    if (!selected) return;
    await saveEdit(async () => {
      const updated = await updateNpc(campaignId, selected.id, { ...selected, ...npcDraft });
      setNpcs((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      setSelected(updated);
      setEditingNpc(false);
      setNpcDraft({});
      toast.success("NPC updated.");
    });
  }

  function startEdit() {
    if (!selected) return;
    setNpcDraft({ ...selected });
    setEditingNpc(true);
  }

  function cancelEdit() {
    setEditingNpc(false);
    setNpcDraft({});
  }

  async function handleDelete(npc: Npc) {
    try {
      await deleteNpc(campaignId, npc.id);
      const targetPage = npcs.length === 1 && page > 1 ? page - 1 : page;
      const result = await getNpcs(campaignId, { page: targetPage, pageSize: 20, ...activeFilters });
      setNpcs(result.items);
      setTotalPages(result.totalPages);
      setPage(targetPage);
      if (selected?.id === npc.id) setSelected(null);
      toast.success(`${npc.name} removed.`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to remove NPC."));
    } finally {
      setConfirmingDeleteId(null);
    }
  }

  // Filtering is now server-side; npcs already contains the filtered+paginated results.
  const filteredNpcs = npcs;

  return (
    <div>
      {/* Breadcrumb */}
      <p className="text-stone-600 text-xs mb-2 flex items-center gap-1.5">
        <Link href={`/campaigns/${campaignId}`} className="hover:text-amber-400 transition-colors">Campaign</Link>
        <span aria-hidden="true">›</span>
        <span className="text-stone-500">NPC Roster</span>
      </p>

      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="font-cinzel text-3xl text-amber-400 tracking-wide">NPC Roster</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="shrink-0 bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-stone-600 px-3 py-2 rounded-lg text-sm transition-all text-stone-300"
        >
          + Add Manually
        </button>
      </div>

      {/* AI Generator */}
      <div className="bg-stone-900 border border-amber-900/30 rounded-xl p-4 mb-6 flex gap-3 items-center">
        <span className="text-2xl shrink-0" aria-hidden="true">🎲</span>
        <input
          aria-label="Hints for AI NPC generation"
          placeholder="Hints for AI (optional) — e.g. 'grumpy dwarven blacksmith with a secret'"
          value={hints}
          onChange={(e) => setHints(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
          className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-600/60 focus:ring-1 focus:ring-amber-600/20 text-sm transition-colors"
        />
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="shrink-0 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 active:scale-95 text-stone-950 font-semibold px-4 py-2 rounded-lg text-sm transition-all whitespace-nowrap"
        >
          {generating ? "Generating…" : "✨ Generate NPC"}
        </button>
      </div>

      <div className="flex gap-5">
        {/* NPC sidebar */}
        <div className="w-60 shrink-0 space-y-2">
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, race, role…"
            aria-label="Search NPCs"
            className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-600/60 text-xs transition-colors"
          />

          {/* Status filter */}
          <div className="flex gap-1" role="group" aria-label="Filter by status">
            {(["all", "alive", "deceased"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                aria-pressed={filterStatus === s}
                className={`flex-1 text-xs py-1 rounded-lg border transition-colors capitalize ${
                  filterStatus === s
                    ? "border-amber-700 bg-amber-900/20 text-amber-400"
                    : "border-stone-800 bg-stone-900 text-stone-600 hover:border-stone-700 hover:text-stone-400"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Relationship filter */}
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by relationship">
            {["all", "Friendly", "Neutral", "Hostile", "Unknown"].map((r) => (
              <button
                key={r}
                onClick={() => setFilterRelationship(r)}
                aria-pressed={filterRelationship === r}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  filterRelationship === r
                    ? "border-amber-700 bg-amber-900/20 text-amber-400"
                    : "border-stone-800 bg-stone-900 text-stone-600 hover:border-stone-700 hover:text-stone-400"
                }`}
              >
                {r === "all" ? "Any" : r}
              </button>
            ))}
          </div>

          {/* Count */}
          {!loading && npcs.length > 0 && (
            <p className="text-stone-700 text-xs px-1" aria-live="polite">
              {filteredNpcs.length} of {npcs.length} NPCs
            </p>
          )}

          {/* NPC list */}
          {loading ? (
            <p role="status" aria-label="Loading" className="text-stone-600 text-sm py-2">Loading…</p>
          ) : npcs.length === 0 ? (
            <p className="text-stone-700 text-sm italic">No NPCs yet. Generate one or add manually.</p>
          ) : filteredNpcs.length === 0 ? (
            <p className="text-stone-700 text-xs italic px-1">No NPCs match the current filters.</p>
          ) : (
            filteredNpcs.map((npc) => (
              <button
                key={npc.id}
                onClick={() => { setSelected(npc); setEditingNpc(false); setNpcDraft({}); setConfirmingDeleteId(null); }}
                aria-current={selected?.id === npc.id ? "true" : undefined}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all flex items-center gap-2.5 ${
                  selected?.id === npc.id
                    ? "border-amber-700/60 bg-amber-900/20"
                    : "border-stone-800 bg-stone-900 hover:border-stone-700"
                }`}
              >
                {/* Initials avatar */}
                <div
                  aria-hidden="true"
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    npc.isAlive ? "bg-amber-900/40 text-amber-500" : "bg-stone-800 text-stone-600"
                  }`}
                >
                  {npc.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className={`font-medium text-sm truncate ${npc.isAlive ? "text-stone-100" : "text-stone-600 line-through"}`}>
                    {npc.name}
                  </p>
                  <p className="text-stone-600 text-xs truncate">{[npc.race, npc.role].filter(Boolean).join(" · ")}</p>
                </div>
              </button>
            ))
          )}

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>

        {/* NPC Detail panel */}
        {selected ? (
          <div className="flex-1 bg-stone-900 border border-stone-800 rounded-xl p-6 min-w-0">
            {editingNpc ? (
              /* Edit Mode */
              <>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-cinzel text-xl text-amber-400">Editing NPC</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                      className="bg-amber-600 hover:bg-amber-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-semibold px-3 py-1.5 rounded-lg text-xs transition-all"
                    >
                      {savingEdit ? "Saving…" : "Save Changes"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={savingEdit}
                      className="text-stone-500 hover:text-stone-300 disabled:opacity-50 text-xs transition-colors px-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {(["name", "race", "role"] as const).map((field) => (
                    <input
                      key={field}
                      aria-label={field.charAt(0).toUpperCase() + field.slice(1)}
                      placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                      value={(npcDraft[field] as string) ?? ""}
                      onChange={(e) => setNpcDraft({ ...npcDraft, [field]: e.target.value })}
                      className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-600/60 text-sm col-span-1 transition-colors"
                    />
                  ))}
                  <div className="flex gap-2 col-span-1 items-center">
                    <span className="text-stone-600 text-xs">Status:</span>
                    <button
                      type="button"
                      onClick={() => setNpcDraft({ ...npcDraft, isAlive: !npcDraft.isAlive })}
                      aria-pressed={!!npcDraft.isAlive}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        npcDraft.isAlive
                          ? "text-green-400 border-green-800/60 bg-green-900/20"
                          : "text-stone-500 border-stone-700 bg-stone-800"
                      }`}
                    >
                      {npcDraft.isAlive ? "Alive" : "Deceased"}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 items-center mb-4">
                  <span className="text-stone-600 text-xs shrink-0">Relationship:</span>
                  {["Unknown", "Friendly", "Neutral", "Hostile"].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNpcDraft({ ...npcDraft, relationshipToParty: r })}
                      aria-pressed={npcDraft.relationshipToParty === r}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        npcDraft.relationshipToParty === r
                          ? RELATIONSHIP_COLORS[r] ?? RELATIONSHIP_COLORS.Unknown
                          : "border-stone-700 text-stone-600 hover:border-stone-600 hover:text-stone-400"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  {(["description", "personality", "quirk", "secret", "notes"] as const).map((field) => (
                    <div key={field}>
                      <label className="text-stone-600 text-xs uppercase tracking-wider block mb-1">
                        {field === "description" ? "Appearance" : field.charAt(0).toUpperCase() + field.slice(1)}
                      </label>
                      <textarea
                        value={(npcDraft[field] as string) ?? ""}
                        onChange={(e) => setNpcDraft({ ...npcDraft, [field]: e.target.value })}
                        rows={2}
                        className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-600/60 resize-y text-sm leading-relaxed transition-colors"
                      />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              /* View Mode */
              <>
                <div className="flex items-start justify-between mb-5 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div aria-hidden="true" className="w-12 h-12 rounded-full bg-amber-900/30 border border-amber-900/40 flex items-center justify-center shrink-0">
                      <span className="font-cinzel text-amber-400 text-lg font-bold">
                        {selected.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-cinzel text-2xl text-amber-400 truncate">{selected.name}</h2>
                      <p className="text-stone-500 text-sm mt-0.5">
                        {[selected.race, selected.role].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-1.5 flex-wrap justify-end shrink-0">
                    <button
                      onClick={() => handleToggleAlive(selected)}
                      aria-label={`Mark ${selected.name} as ${selected.isAlive ? "deceased" : "alive"}`}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selected.isAlive
                          ? "text-green-400 border-green-800/60 bg-green-900/20 hover:bg-green-900/40"
                          : "text-stone-500 border-stone-700 bg-stone-800 hover:bg-stone-700"
                      }`}
                    >
                      {selected.isAlive ? "● Alive" : "✕ Deceased"}
                    </button>
                    {selected.relationshipToParty && (
                      <button
                        onClick={() => handleCycleRelationship(selected)}
                        aria-label={`Relationship: ${selected.relationshipToParty}. Click to change.`}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-opacity hover:opacity-70 ${
                          RELATIONSHIP_COLORS[selected.relationshipToParty] ?? RELATIONSHIP_COLORS.Unknown
                        }`}
                      >
                        {selected.relationshipToParty}
                      </button>
                    )}
                    <button
                      onClick={startEdit}
                      className="text-stone-500 hover:text-stone-200 text-xs transition-colors px-2 py-1 rounded hover:bg-stone-800"
                    >
                      Edit
                    </button>

                    {/* Inline delete confirmation */}
                    {confirmingDeleteId === selected.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-stone-400 text-xs">Remove?</span>
                        <button
                          onClick={() => handleDelete(selected)}
                          className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-stone-800 transition-colors border border-red-900/50"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmingDeleteId(null)}
                          className="text-stone-500 hover:text-stone-300 text-xs px-2 py-1 rounded hover:bg-stone-800 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingDeleteId(selected.id)}
                        className="text-stone-600 hover:text-red-400 text-xs transition-colors px-2 py-1 rounded hover:bg-stone-800"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {selected.description && <DetailSection label="Appearance" text={selected.description} />}
                  {selected.personality && <DetailSection label="Personality" text={selected.personality} />}
                  {selected.quirk && <DetailSection label="Quirk" text={selected.quirk} />}
                  {selected.secret && (
                    <details className="group">
                      <summary className="text-stone-600 text-xs uppercase tracking-wider cursor-pointer hover:text-amber-400 transition-colors select-none">
                        ▶ Reveal Secret
                      </summary>
                      <p className="text-stone-300 mt-2 text-sm leading-relaxed italic border-l-2 border-amber-900/50 pl-3">
                        {selected.secret}
                      </p>
                    </details>
                  )}
                  {selected.notes && <DetailSection label="Notes" text={selected.notes} />}

                  {!selected.description && !selected.personality && !selected.quirk && !selected.secret && !selected.notes && (
                    <p className="text-stone-700 italic text-sm">No details recorded yet. Click Edit to add some.</p>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-stone-700 gap-3 bg-stone-900/40 border border-dashed border-stone-800 rounded-xl p-8">
            <span className="text-3xl" aria-hidden="true">🧙</span>
            <p className="text-sm italic">Select an NPC to view their details</p>
          </div>
        )}
      </div>

      {/* Manual create modal */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div
            ref={npcModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-npc-title"
            className="bg-stone-900 border border-stone-700/80 rounded-2xl w-full max-w-lg shadow-2xl shadow-black/70"
          >
            <form
              action={handleCreate}
              className="p-6 space-y-3 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-1">
                <h2 id="add-npc-title" className="font-cinzel text-xl text-amber-400">Add NPC</h2>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  aria-label="Close dialog"
                  className="text-stone-600 hover:text-stone-300 text-lg transition-colors"
                >
                  ✕
                </button>
              </div>
              {(["name", "race", "role", "description", "personality", "quirk", "secret", "notes"] as const).map((field) => (
                <input
                  key={field}
                  aria-label={`${field.charAt(0).toUpperCase() + field.slice(1)}${field === "name" ? " (required)" : ""}`}
                  placeholder={`${field.charAt(0).toUpperCase() + field.slice(1)}${field === "name" ? " *" : ""}`}
                  required={field === "name"}
                  value={(newNpc[field] as string) ?? ""}
                  onChange={(e) => setNewNpc({ ...newNpc, [field]: e.target.value })}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-600/60 text-sm transition-colors"
                />
              ))}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-semibold px-4 py-2 rounded-lg text-sm transition-all"
                >
                  {creating ? "Adding…" : "Add NPC"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-stone-400 hover:text-stone-200 text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Detail section ──────────────────────────────────────────────────────────

function DetailSection({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-stone-600 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className="text-stone-300 text-sm leading-relaxed">{text}</p>
    </div>
  );
}
