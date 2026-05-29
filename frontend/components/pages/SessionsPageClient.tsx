"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getSessions, createSession, updateSession, deleteSession,
  processSessionNotes, getRecap,
  saveSessionRecap, clearSessionRecap,
  clearSessionNotes, clearSessionSummary,
  getRecapDrafts, deleteRecapDraft, attachRecapDraft,
  type Session, type RecapDraft,
  RateLimitError,
  apiErrorMessage,
} from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { Pagination } from "@/components/Pagination";

/** Which destructive action is awaiting inline confirmation (single-item actions). */
type ConfirmAction = "deleteSession" | "clearNotes" | "clearSummary" | "detachRecap" | null;

export default function SessionsPageClient() {
  const { id } = useParams<{ id: string }>();
  const campaignId = Number(id);
  const toast = useToast();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Session | null>(null);
  const [notes, setNotes] = useState("");
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [recapDraft, setRecapDraft] = useState("");
  const [editingRecap, setEditingRecap] = useState(false);

  // Unattached recap drafts
  const [drafts, setDrafts] = useState<RecapDraft[]>([]);
  const [draftsOpen, setDraftsOpen] = useState(true);
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(null);

  // Inline confirmation state
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  /** ID of the draft currently awaiting delete confirmation. */
  const [confirmingDeleteDraftId, setConfirmingDeleteDraftId] = useState<number | null>(null);
  /** ID of the draft awaiting "replace existing recap" confirmation before attaching. */
  const [confirmingAttachDraftId, setConfirmingAttachDraftId] = useState<number | null>(null);

  const aiErrHandler = (err: unknown) => {
    if (err instanceof RateLimitError) toast.rateLimitError(err.retryAfter);
    else toast.error(apiErrorMessage(err, "AI request failed. Check the backend logs."));
  };

  const [processing, runProcess] = useAsyncAction(aiErrHandler);
  const [generatingRecap, runGenerateRecap] = useAsyncAction(aiErrHandler);
  const [savingNotes, runSaveNotes] = useAsyncAction(
    (err) => toast.error(apiErrorMessage(err, "Failed to save notes."))
  );
  const [savingSummary, runSaveSummary] = useAsyncAction(
    (err) => toast.error(apiErrorMessage(err, "Failed to save summary."))
  );
  const [savingRecap, runSaveRecap] = useAsyncAction(
    (err) => toast.error(apiErrorMessage(err, "Failed to save recap."))
  );

  // ── Voice recording ───────────────────────────────────────────────────────
  const [recording, setRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const shouldRecordRef = useRef(false);

  function stopRecording() {
    shouldRecordRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
    setInterimText("");
  }

  function handleToggleRecording() {
    if (recording) {
      stopRecording();
      return;
    }

    const SpeechRecognitionCtor: typeof SpeechRecognition | undefined =
      typeof window !== "undefined"
        ? (window.SpeechRecognition ?? (window as any).webkitSpeechRecognition)
        : undefined;

    if (!SpeechRecognitionCtor) {
      toast.error("Voice notes aren't supported in this browser. Try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          setNotes((prev) => prev + (prev.trim() ? " " : "") + transcript.trim());
          setInterimText("");
        } else {
          interim += transcript;
        }
      }
      if (interim) setInterimText(interim);
    };

    recognition.onend = () => {
      if (shouldRecordRef.current) {
        try { recognition.start(); } catch { /* ignore restart race */ }
      } else {
        setInterimText("");
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "not-allowed") {
        toast.error("Microphone access denied — check your browser permissions.");
        shouldRecordRef.current = false;
        setRecording(false);
        setInterimText("");
      }
    };

    shouldRecordRef.current = true;
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }

  const loadDrafts = useCallback(() => {
    getRecapDrafts(campaignId)
      .then(setDrafts)
      .catch(() => {/* silently ignore — drafts panel is non-critical */});
  }, [campaignId]); // `page` was erroneously listed here — it is never used inside

  useEffect(() => {
    setLoading(true); // reset loading indicator on every page change, not just initial mount
    getSessions(campaignId, { page, pageSize: 10 })
      .then((result) => {
        setSessions(result.items);
        setTotalPages(result.totalPages);
        if (result.items.length > 0) selectSession(result.items[0]);
      })
      .catch((err) => toast.error(apiErrorMessage(err, "Failed to load sessions.")))
      .finally(() => setLoading(false));
    loadDrafts();
  }, [campaignId, page]);

  function selectSession(s: Session) {
    stopRecording();
    setSelected(s);
    setNotes(s.rawNotes ?? "");
    setSummaryDraft(s.summary ?? "");
    setRecapDraft(s.savedRecap ?? "");
    setEditingSummary(false);
    setEditingRecap(false);
    setConfirmAction(null);
  }

  function syncSession(updated: Session) {
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setSelected(updated);
    setNotes(updated.rawNotes ?? "");
    setSummaryDraft(updated.summary ?? "");
    setRecapDraft(updated.savedRecap ?? "");
  }

  async function handleNewSession() {
    try {
      const session = await createSession(campaignId, {
        playedOn: new Date().toISOString(),
      });
      setPage(1);
      const result = await getSessions(campaignId, { page: 1, pageSize: 10 });
      setSessions(result.items);
      setTotalPages(result.totalPages);
      selectSession(session);
      toast.success(`Session ${session.sessionNumber} added.`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to create session."));
    }
  }

  async function handleDeleteSession() {
    if (!selected) return;
    try {
      await deleteSession(campaignId, selected.id);
      const targetPage = sessions.length === 1 && page > 1 ? page - 1 : page;
      const result = await getSessions(campaignId, { page: targetPage, pageSize: 10 });
      setSessions(result.items);
      setTotalPages(result.totalPages);
      setPage(targetPage);
      if (result.items.length > 0) selectSession(result.items[0]);
      else setSelected(null);
      toast.success("Session deleted.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to delete session."));
    } finally {
      setConfirmAction(null);
    }
  }

  async function handleDateChange(dateStr: string) {
    if (!selected) return;
    try {
      const updated = await updateSession(campaignId, selected.id, {
        ...selected,
        playedOn: new Date(dateStr).toISOString(),
      });
      syncSession(updated);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to update date."));
    }
  }

  async function handleSaveNotes() {
    if (!selected) return;
    await runSaveNotes(async () => {
      const updated = await updateSession(campaignId, selected.id, { ...selected, rawNotes: notes });
      syncSession(updated);
      toast.success("Notes saved.");
    });
  }

  async function handleProcess() {
    if (!selected) return;
    await runProcess(async () => {
      await updateSession(campaignId, selected.id, { ...selected, rawNotes: notes });
      const processed = await processSessionNotes(campaignId, selected.id);
      syncSession(processed);
      toast.success("Session notes processed.");
    });
  }

  async function handleClearNotes() {
    if (!selected) return;
    try {
      const updated = await clearSessionNotes(campaignId, selected.id);
      syncSession(updated);
      toast.success("Notes cleared.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to clear notes."));
    } finally {
      setConfirmAction(null);
    }
  }

  async function handleClearSummary() {
    if (!selected) return;
    try {
      const updated = await clearSessionSummary(campaignId, selected.id);
      syncSession(updated);
      toast.success("Summary cleared.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to clear summary."));
    } finally {
      setConfirmAction(null);
    }
  }

  async function handleSaveSummary() {
    if (!selected) return;
    await runSaveSummary(async () => {
      const updated = await updateSession(campaignId, selected.id, { ...selected, summary: summaryDraft });
      syncSession(updated);
      setEditingSummary(false);
      toast.success("Summary saved.");
    });
  }

  async function handleGenerateRecap() {
    await runGenerateRecap(async () => {
      const { recap, draftId } = await getRecap(campaignId);
      setRecapDraft(recap);
      setCurrentDraftId(draftId);
      setEditingRecap(true);
      loadDrafts();
      toast.success("Recap ready — review and save to attach it to this session.");
    });
  }

  async function handleSaveRecap() {
    if (!selected) return;
    await runSaveRecap(async () => {
      const updated = await saveSessionRecap(campaignId, selected.id, recapDraft);
      syncSession(updated);
      setEditingRecap(false);

      if (currentDraftId !== null) {
        try {
          await deleteRecapDraft(campaignId, currentDraftId);
        } catch {
          // Non-fatal
        }
        setCurrentDraftId(null);
        loadDrafts();
      }

      toast.success("Recap attached to session.");
    });
  }

  async function handleCancelRecap() {
    setEditingRecap(false);
    setRecapDraft(selected?.savedRecap ?? "");
    if (currentDraftId !== null) {
      setCurrentDraftId(null);
      loadDrafts();
    }
  }

  async function handleDetachRecap() {
    if (!selected) return;
    try {
      const updated = await clearSessionRecap(campaignId, selected.id);
      syncSession(updated);
      loadDrafts();
      toast.success("Recap detached and saved to the unattached recaps folder.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to detach recap."));
    } finally {
      setConfirmAction(null);
    }
  }

  async function handleAttachDraft(draft: RecapDraft) {
    if (!selected) {
      toast.error("Select a session first, then attach the recap to it.");
      return;
    }
    try {
      const updated = await attachRecapDraft(campaignId, draft.id, selected.id);
      syncSession(updated);
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      toast.success(`Recap attached to Session ${selected.sessionNumber}.`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to attach recap."));
    } finally {
      setConfirmingAttachDraftId(null);
    }
  }

  async function handleDeleteDraft(draft: RecapDraft) {
    try {
      await deleteRecapDraft(campaignId, draft.id);
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      toast.success("Recap draft deleted.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to delete recap draft."));
    } finally {
      setConfirmingDeleteDraftId(null);
    }
  }

  const storyBeats: string[] = selected?.storyBeats ? JSON.parse(selected.storyBeats) : [];
  const newNpcs: string[] = selected?.newNpcsFound ? JSON.parse(selected.newNpcsFound) : [];

  return (
    <div>
      <p className="text-stone-500 text-sm mb-2">
        <Link href={`/campaigns/${campaignId}`} className="hover:text-amber-400 transition-colors">Campaign</Link>
        {" / Session Log"}
      </p>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-cinzel text-3xl text-amber-400">Session Log</h1>
        <button
          onClick={handleNewSession}
          className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          + New Session
        </button>
      </div>

      <div className="flex gap-6">
        {/* Left column: session list + unattached recaps */}
        <div className="w-48 shrink-0 space-y-2">
          {loading ? (
            <p role="status" aria-label="Loading" className="text-stone-500 text-sm">Loading…</p>
          ) : sessions.length === 0 ? (
            <p className="text-stone-600 text-sm italic">No sessions yet.</p>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSession(s)}
                aria-current={selected?.id === s.id ? "true" : undefined}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                  selected?.id === s.id
                    ? "border-amber-600 bg-amber-900/20"
                    : "border-stone-700 bg-stone-900 hover:border-stone-600"
                }`}
              >
                <p className="text-stone-100 font-medium text-sm">Session {s.sessionNumber}</p>
                <p className="text-stone-500 text-xs mt-0.5">
                  {(() => {
                    const [y, m, d] = s.playedOn.slice(0, 10).split("-");
                    return `${parseInt(m)}/${parseInt(d)}/${y}`;
                  })()}
                </p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {s.summary && <span className="text-amber-600 text-xs">✓ Summary</span>}
                  {s.savedRecap && <span className="text-blue-400 text-xs">✓ Recap</span>}
                </div>
              </button>
            ))
          )}

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

          {/* Unattached Recaps folder */}
          <div className="pt-3">
            <button
              onClick={() => setDraftsOpen((o) => !o)}
              aria-expanded={draftsOpen}
              className="w-full flex items-center justify-between text-left text-stone-500 hover:text-stone-300 transition-colors text-xs uppercase tracking-wider pb-1"
            >
              <span>Unattached Recaps</span>
              <span className="flex items-center gap-1">
                {drafts.length > 0 && (
                  <span className="bg-blue-900/50 text-blue-400 rounded-full px-1.5 py-0.5 text-xs font-medium leading-none">
                    {drafts.length}
                  </span>
                )}
                <span aria-hidden="true">{draftsOpen ? "▴" : "▾"}</span>
              </span>
            </button>

            {draftsOpen && (
              <div className="space-y-1.5 mt-1">
                {drafts.length === 0 ? (
                  <p className="text-stone-700 text-xs italic px-1">None saved.</p>
                ) : (
                  drafts.map((draft) => (
                    <div
                      key={draft.id}
                      className="bg-stone-900 border border-stone-700 rounded-lg px-2.5 py-2 text-xs space-y-1.5"
                    >
                      <p className="text-stone-500 leading-none">
                        {new Date(draft.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-stone-300 leading-snug line-clamp-3">{draft.text}</p>
                      <div className="flex gap-2 pt-0.5 flex-wrap">
                        {/* Attach with confirm if session already has a recap */}
                        {confirmingAttachDraftId === draft.id ? (
                          <span className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-stone-400">Replace recap?</span>
                            <button
                              onClick={() => handleAttachDraft(draft)}
                              disabled={!selected}
                              className="text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmingAttachDraftId(null)}
                              className="text-stone-600 hover:text-stone-400 transition-colors"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              if (!selected) {
                                toast.error("Select a session first, then attach the recap to it.");
                                return;
                              }
                              if (selected.savedRecap) {
                                setConfirmingAttachDraftId(draft.id);
                              } else {
                                handleAttachDraft(draft);
                              }
                            }}
                            disabled={!selected}
                            className="text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Attach
                          </button>
                        )}

                        {/* Delete draft with inline confirm */}
                        {confirmingDeleteDraftId === draft.id ? (
                          <span className="flex items-center gap-1.5">
                            <span className="text-stone-400">Delete?</span>
                            <button
                              onClick={() => handleDeleteDraft(draft)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmingDeleteDraftId(null)}
                              className="text-stone-600 hover:text-stone-400 transition-colors"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmingDeleteDraftId(draft.id)}
                            className="text-stone-600 hover:text-red-400 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Session detail */}
        {selected ? (
          <div className="flex-1 space-y-5 min-w-0">
            {/* Session header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-cinzel text-xl text-amber-400">Session {selected.sessionNumber}</h2>
                <input
                  type="date"
                  aria-label="Session date"
                  value={selected.playedOn.slice(0, 10)}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="mt-0.5 bg-transparent border-none text-stone-500 text-sm focus:outline-none focus:text-amber-400 cursor-pointer"
                />
              </div>
              <div className="flex gap-2 items-center flex-wrap justify-end">
                <button
                  onClick={handleProcess}
                  disabled={processing || !notes.trim()}
                  className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  {processing ? "Processing with Claude…" : "✨ Process with AI"}
                </button>

                {/* Delete session with inline confirm */}
                {confirmAction === "deleteSession" ? (
                  <span className="flex items-center gap-2">
                    <span className="text-stone-400 text-xs whitespace-nowrap">Delete session?</span>
                    <button
                      onClick={handleDeleteSession}
                      className="text-red-400 hover:text-red-300 text-xs px-2.5 py-1.5 rounded-lg hover:bg-stone-800 border border-red-900/50 transition-colors"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={() => setConfirmAction(null)}
                      className="text-stone-500 hover:text-stone-300 text-xs px-2 py-1.5 transition-colors"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmAction("deleteSession")}
                    className="text-stone-600 hover:text-red-400 text-xs px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-colors"
                  >
                    Delete Session
                  </button>
                )}
              </div>
            </div>

            {/* Voice recorder */}
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <button
                  type="button"
                  onClick={handleToggleRecording}
                  aria-label={recording ? "Stop voice recording" : "Start voice recording"}
                  aria-pressed={recording}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    recording
                      ? "bg-red-900/40 border border-red-700/60 text-red-400 hover:bg-red-900/60 animate-pulse"
                      : "bg-stone-800 border border-stone-700 text-stone-400 hover:border-stone-600 hover:text-stone-200"
                  }`}
                >
                  <span aria-hidden="true">{recording ? "⏹" : "🎙"}</span>
                  <span>{recording ? "Stop Recording" : "Voice Notes"}</span>
                </button>
                {recording && interimText && (
                  <p className="text-stone-500 text-xs italic truncate flex-1" aria-live="polite">{interimText}</p>
                )}
              </div>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={6}
                placeholder="Paste or dictate your session notes here…"
                aria-label="Session notes"
                className="w-full bg-stone-800/60 border border-stone-700 rounded-lg px-4 py-3 text-stone-100 placeholder-stone-700 focus:outline-none focus:border-amber-600/60 focus:ring-1 focus:ring-amber-600/20 resize-y text-sm leading-relaxed transition-colors"
              />

              <div className="flex gap-2 mt-2 flex-wrap">
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes || notes === (selected.rawNotes ?? "")}
                  className="bg-stone-700 hover:bg-stone-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 px-3 py-1.5 rounded-lg text-sm text-stone-200 transition-all"
                >
                  {savingNotes ? "Saving…" : "Save Notes"}
                </button>
                {selected.rawNotes && (
                  <>
                    {confirmAction === "clearNotes" ? (
                      <span className="flex items-center gap-2">
                        <span className="text-stone-400 text-xs">Clear notes?</span>
                        <button
                          onClick={handleClearNotes}
                          className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-stone-800 border border-red-900/50 transition-colors"
                        >
                          Yes, clear
                        </button>
                        <button
                          onClick={() => setConfirmAction(null)}
                          className="text-stone-500 hover:text-stone-300 text-xs px-2 transition-colors"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmAction("clearNotes")}
                        className="text-stone-600 hover:text-red-400 text-xs px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-colors"
                      >
                        Clear Notes
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* AI Results: story beats + new NPCs */}
            {(storyBeats.length > 0 || newNpcs.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {storyBeats.length > 0 && (
                  <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
                    <p className="text-stone-500 text-xs uppercase tracking-wider mb-2">Story Beats</p>
                    <ul className="space-y-1">
                      {storyBeats.map((beat, i) => (
                        <li key={i} className="text-stone-300 text-sm leading-relaxed flex gap-2">
                          <span className="text-amber-700 shrink-0" aria-hidden="true">▸</span>
                          <span>{beat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {newNpcs.length > 0 && (
                  <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
                    <p className="text-stone-500 text-xs uppercase tracking-wider mb-2">NPCs Mentioned</p>
                    <ul className="space-y-1">
                      {newNpcs.map((npc, i) => (
                        <li key={i} className="text-stone-300 text-sm"><span aria-hidden="true">🧙</span> {npc}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* AI Summary */}
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3 gap-3">
                <p className="text-stone-400 text-xs uppercase tracking-wider">AI Summary</p>
                <div className="flex gap-2 flex-wrap justify-end">
                  {selected.summary && !editingSummary && (
                    <button
                      onClick={() => { setSummaryDraft(selected.summary ?? ""); setEditingSummary(true); }}
                      className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  {selected.summary && (
                    <>
                      {confirmAction === "clearSummary" ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-stone-400 text-xs">Clear summary?</span>
                          <button
                            onClick={handleClearSummary}
                            className="text-red-400 hover:text-red-300 text-xs border border-red-900/50 px-1.5 py-0.5 rounded transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmAction(null)}
                            className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmAction("clearSummary")}
                          className="text-stone-600 hover:text-red-400 text-xs transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {editingSummary ? (
                <div>
                  <textarea
                    value={summaryDraft}
                    onChange={(e) => setSummaryDraft(e.target.value)}
                    rows={4}
                    aria-label="Edit summary"
                    className="w-full bg-stone-800/60 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-600/60 resize-y text-sm leading-relaxed transition-colors"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleSaveSummary}
                      disabled={savingSummary}
                      className="bg-stone-700 hover:bg-stone-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 px-3 py-1.5 rounded-lg text-sm text-stone-200 transition-all"
                    >
                      {savingSummary ? "Saving…" : "Save Summary"}
                    </button>
                    <button
                      onClick={() => setEditingSummary(false)}
                      className="text-stone-500 hover:text-stone-300 text-xs px-2 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : selected.summary ? (
                <p className="text-stone-300 text-sm leading-relaxed whitespace-pre-wrap">{selected.summary}</p>
              ) : (
                <p className="text-stone-600 text-sm italic">
                  No summary yet. Add notes above and click ✨ Process with AI.
                </p>
              )}
            </div>

            {/* Recap */}
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3 gap-3">
                <p className="text-stone-400 text-xs uppercase tracking-wider">Session Recap</p>
                <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                  <button
                    onClick={handleGenerateRecap}
                    disabled={generatingRecap}
                    className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-stone-950 font-semibold px-3 py-1 rounded-lg text-xs transition-all"
                  >
                    {generatingRecap ? "Generating…" : "✨ Generate"}
                  </button>
                  {selected.savedRecap && !editingRecap && (
                    <>
                      {confirmAction === "detachRecap" ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-stone-400 text-xs">Detach recap?</span>
                          <button
                            onClick={handleDetachRecap}
                            className="text-red-400 hover:text-red-300 text-xs border border-red-900/50 px-1.5 py-0.5 rounded transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmAction(null)}
                            className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmAction("detachRecap")}
                          className="text-stone-600 hover:text-red-400 text-xs transition-colors"
                        >
                          Detach
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {editingRecap ? (
                <div>
                  <textarea
                    value={recapDraft}
                    onChange={(e) => setRecapDraft(e.target.value)}
                    rows={5}
                    aria-label="Edit recap"
                    className="w-full bg-stone-800/60 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-600/60 resize-y text-sm leading-relaxed transition-colors"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleSaveRecap}
                      disabled={savingRecap}
                      className="bg-stone-700 hover:bg-stone-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 px-3 py-1.5 rounded-lg text-sm text-stone-200 transition-all"
                    >
                      {savingRecap ? "Saving…" : "Attach to Session"}
                    </button>
                    <button
                      onClick={handleCancelRecap}
                      className="text-stone-500 hover:text-stone-300 text-xs px-2 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : selected.savedRecap ? (
                <p className="text-stone-300 text-sm leading-relaxed whitespace-pre-wrap">{selected.savedRecap}</p>
              ) : (
                <p className="text-stone-600 text-sm italic">
                  No recap attached. Generate one or attach from the Unattached Recaps folder.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-stone-700 bg-stone-900/40 border border-dashed border-stone-800 rounded-xl p-8">
            <p className="italic text-sm">Select a session to view its details.</p>
          </div>
        )}
      </div>
    </div>
  );
}
