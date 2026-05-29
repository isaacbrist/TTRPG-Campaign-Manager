"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getCampaigns, createCampaign, updateCampaign, deleteCampaign, type Campaign, apiErrorMessage } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { inputClass } from "@/lib/ui";
import { FormField } from "@/components/FormField";
import { Pagination } from "@/components/Pagination";

export default function HomePageClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", setting: "" });
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", setting: "" });
  /** Inline validation / API error shown inside the modal. */
  const [modalError, setModalError] = useState<string | null>(null);
  /** ID of the campaign pending inline delete confirmation. */
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const toast = useToast();

  // Single pending state drives both create and edit modals (only one is open at a time).
  const [submitting, runSubmit] = useAsyncAction(
    (err) => setModalError(apiErrorMessage(err, "Failed to save campaign."))
  );

  useEffect(() => {
    setLoading(true);
    getCampaigns({ page, pageSize: 20 })
      .then((result) => {
        setCampaigns(result.items);
        setTotalPages(result.totalPages);
      })
      .catch((err) => toast.error(apiErrorMessage(err, "Failed to load campaigns.")))
      .finally(() => setLoading(false));
  }, [page]);

  /** Validate the campaign name field; returns an error string or null. */
  function validateCampaignName(name: string): string | null {
    if (!name.trim()) return "Campaign name is required.";
    if (name.trim().length > 120) return "Campaign name must be 120 characters or fewer.";
    return null;
  }

  async function handleCreate() {
    const nameErr = validateCampaignName(form.name);
    if (nameErr) { setModalError(nameErr); return; }
    setModalError(null);
    await runSubmit(async () => {
      const campaign = await createCampaign(form);
      // New campaigns sort newest-first, so always land on page 1.
      // Re-fetch page 1 and reset the page cursor so the new item is visible.
      const result = await getCampaigns({ page: 1, pageSize: 20 });
      setCampaigns(result.items);
      setTotalPages(result.totalPages);
      setPage(1);
      setForm({ name: "", description: "", setting: "" });
      setCreating(false);
      toast.success(`"${campaign.name}" created.`);
    });
  }

  function startEdit(c: Campaign) {
    setEditing(c);
    setEditForm({ name: c.name, description: c.description ?? "", setting: c.setting ?? "" });
    setModalError(null);
  }

  async function handleEdit() {
    if (!editing) return;
    const nameErr = validateCampaignName(editForm.name);
    if (nameErr) { setModalError(nameErr); return; }
    setModalError(null);
    await runSubmit(async () => {
      const updated = await updateCampaign(editing.id, { ...editing, ...editForm });
      setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditing(null);
      toast.success(`"${updated.name}" saved.`);
      // Re-fetch to keep ordering fresh after a name edit
      const result = await getCampaigns({ page, pageSize: 20 });
      setCampaigns(result.items);
      setTotalPages(result.totalPages);
    });
  }

  async function handleDelete(id: number, name: string) {
    try {
      await deleteCampaign(id);
      // Re-fetch — if the current page is now empty, go back one page
      const targetPage = campaigns.length === 1 && page > 1 ? page - 1 : page;
      const result = await getCampaigns({ page: targetPage, pageSize: 20 });
      setCampaigns(result.items);
      setTotalPages(result.totalPages);
      setPage(targetPage);
      toast.success(`"${name}" deleted.`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to delete campaign."));
    } finally {
      setConfirmingDeleteId(null);
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="font-cinzel text-3xl text-amber-400 tracking-wide">Your Campaigns</h1>
          <p className="text-stone-500 mt-1.5 text-sm">Select a campaign to continue, or start a new adventure.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="shrink-0 bg-amber-600 hover:bg-amber-500 active:scale-95 text-stone-950 font-semibold px-4 py-2 rounded-lg transition-all shadow-md hover:shadow-amber-900/30 text-sm"
        >
          + New Campaign
        </button>
      </div>

      {/* Modals */}
      {creating && (
        <CampaignModal
          title="New Campaign"
          form={form}
          error={modalError}
          submitting={submitting}
          onChange={(field, value) => { setForm((prev) => ({ ...prev, [field]: value })); setModalError(null); }}
          onSubmit={handleCreate}
          onClose={() => { setCreating(false); setModalError(null); }}
        />
      )}
      {editing && (
        <CampaignModal
          title="Edit Campaign"
          form={editForm}
          error={modalError}
          submitting={submitting}
          onChange={(field, value) => { setEditForm((prev) => ({ ...prev, [field]: value })); setModalError(null); }}
          onSubmit={handleEdit}
          onClose={() => { setEditing(null); setModalError(null); }}
        />
      )}

      {/* Campaign list */}
      {loading ? (
        <div
          role="status"
          aria-label="Loading"
          className="flex items-center gap-3 text-stone-500 py-16 justify-center"
        >
          <span className="text-2xl animate-pulse" aria-hidden="true">⚔</span>
          <span>Loading your campaigns…</span>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-stone-800 rounded-2xl bg-stone-900/30">
          <p className="text-5xl mb-4" aria-hidden="true">🗺</p>
          <p className="text-stone-300 font-cinzel text-lg">No campaigns yet</p>
          <p className="text-stone-600 text-sm mt-2">Create your first campaign to begin your adventure.</p>
          <button
            onClick={() => setCreating(true)}
            className="mt-6 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold px-5 py-2 rounded-lg transition-all text-sm"
          >
            + New Campaign
          </button>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {campaigns.map((c) => (
              <li
                key={c.id}
                className="group bg-stone-900 border border-stone-800 rounded-xl hover:border-amber-800/50 hover:bg-stone-900/80 hover:shadow-xl hover:shadow-amber-950/20 transition-all"
              >
                <div className="flex items-center gap-4 p-5">
                  {/* Campaign icon */}
                  <div className="w-10 h-10 rounded-lg bg-amber-900/30 border border-amber-900/40 flex items-center justify-center shrink-0" aria-hidden="true">
                    <span className="text-amber-500 text-lg leading-none">⚔</span>
                  </div>

                  {/* Campaign info — clicking navigates */}
                  <Link href={`/campaigns/${c.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-cinzel text-lg text-amber-400 group-hover:text-amber-300 transition-colors truncate">
                        {c.name}
                      </h2>
                      <span className="text-stone-700 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all text-sm shrink-0" aria-hidden="true">
                        →
                      </span>
                    </div>
                    {c.setting && (
                      <p className="text-stone-400 text-xs mt-0.5 uppercase tracking-wide">{c.setting}</p>
                    )}
                    {c.description && (
                      <p className="text-stone-500 text-sm mt-1 truncate">{c.description}</p>
                    )}
                  </Link>

                  {/* Actions */}
                  {confirmingDeleteId === c.id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-stone-400 text-xs">Delete &ldquo;{c.name}&rdquo;?</span>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        className="text-red-400 hover:text-red-300 text-xs px-2.5 py-1.5 rounded-lg hover:bg-stone-800 transition-colors border border-red-900/50"
                      >
                        Yes, delete
                      </button>
                      <button
                        onClick={() => setConfirmingDeleteId(null)}
                        className="text-stone-500 hover:text-stone-300 text-xs px-2.5 py-1.5 rounded-lg hover:bg-stone-800 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(c)}
                        className="text-stone-400 hover:text-amber-400 text-xs px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmingDeleteId(c.id)}
                        className="text-stone-500 hover:text-red-400 text-xs px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}

// ── Campaign modal ──────────────────────────────────────────────────────────────

interface ModalForm { name: string; description: string; setting: string }

function CampaignModal({
  title,
  form,
  error,
  submitting,
  onChange,
  onSubmit,
  onClose,
}: {
  title: string;
  form: ModalForm;
  error?: string | null;
  submitting?: boolean;
  onChange: (field: keyof ModalForm, value: string) => void;
  onSubmit: () => void | Promise<void>;
  onClose: () => void;
}) {
  const dialogRef = useFocusTrap<HTMLDivElement>();
  const headingId = "campaign-modal-title";
  const isNew = title === "New Campaign";

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="bg-stone-900 border border-stone-700/80 rounded-2xl p-8 w-full max-w-lg shadow-2xl shadow-black/70"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id={headingId} className="font-cinzel text-xl text-amber-400">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-stone-600 hover:text-stone-300 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
          <FormField label="Campaign Name" required id="campaign-name">
            <input
              id="campaign-name"
              type="text"
              placeholder="e.g. Curse of Strahd"
              value={form.name}
              onChange={(e) => onChange("name", e.target.value)}
              className={`${inputClass}${error && !form.name.trim() ? " border-red-600 focus:border-red-500 ring-red-600/20" : ""}`}
            />
          </FormField>
          <FormField label="Setting" id="campaign-setting">
            <input
              id="campaign-setting"
              type="text"
              placeholder="Forgotten Realms, Eberron, Homebrew…"
              value={form.setting}
              onChange={(e) => onChange("setting", e.target.value)}
              className={inputClass}
            />
          </FormField>
          <FormField label="Description" id="campaign-description">
            <input
              id="campaign-description"
              type="text"
              placeholder="A short description of the campaign…"
              value={form.description}
              onChange={(e) => onChange("description", e.target.value)}
              className={inputClass}
            />
          </FormField>

          {error && (
            <p role="alert" className="text-red-400 text-sm bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-amber-600 hover:bg-amber-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-semibold py-2.5 rounded-lg text-sm transition-all"
            >
              {submitting ? "Saving…" : isNew ? "Create Campaign" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-stone-400 hover:text-stone-200 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
