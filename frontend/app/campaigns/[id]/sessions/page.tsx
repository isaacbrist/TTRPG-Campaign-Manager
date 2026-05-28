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

export default function SessionLogPage() {
  const { id } = useParams<{ id: string }>();
  const campaignId = Number(id);
  const toast = useToast();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Session | null>(null);
  const [notes, setNotes] = useState("");
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [recapDraft, setRecapDraft] = useState("");
  const [editingRecap, setEditingRecap] = useState(false);

  // Unattached recap drafts
  const [drafts, setDrafts] = useState<RecapDraft[]>([]);
  const [draftsOpen, setDraftsOpen] = useState(true);
  // ID of the RecapDraft created when the user last clicked "Generate"
  // — used to clean it up if the user then saves the recap to a session.
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(null);

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
  // Holds the live SpeechRecognition instance
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Separate ref so the onend callback can check "should still be recording"
  // without capturing a stale closure over `recording` state
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

    // Browser support check
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

    // Web Speech API stops automatically after a pause in speech.
    // Auto-restart as long as the user hasn't manually clicked Stop.
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
      // "no-speech" and "aborted" are non-fatal; onend will handle restart
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
  }, [campaignId]);

  useEffect(() => {
    getSessions(campaignId)
      .then((data) => { setSessions(data); if (data.length > 0) selectSession(data.at(-1)!); })
      .catch((err) => toast.error(apiErrorMessage(err, "Failed to load sessions.")))
      .finally(() => setLoading(false));
    loadDrafts();
  }, [campaignId]);

  function selectSession(s: Session) {
    stopRecording(); // don't carry a live mic across sessions
    setSelected(s);
    setNotes(s.rawNotes ?? "");
    setSummaryDraft(s.summary ?? "");
    setRecapDraft(s.savedRecap ?? "");
    setEditingSummary(false);
    setEditingRecap(false);
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
      setSessions((prev) => [...prev, session]);
      selectSession(session);
      toast.success(`Session ${session.sessionNumber} added.`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to create session."));
    }
  }

  async function handleDeleteSession() {
    if (!selected) return;
    if (!confirm(`Delete Session ${selected.sessionNumber}? This cannot be undone.`)) return;
    try {
      await deleteSession(campaignId, selected.id);
      const remaining = sessions.filter((s) => s.id !== selected.id);
      setSessions(remaining);
      if (remaining.length > 0) selectSession(remaining.at(-1)!);
      else setSelected(null);
      toast.success("Session deleted.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to delete session."));
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
      // Save notes first so the backend has the latest content
      await updateSession(campaignId, selected.id, { ...selected, rawNotes: notes });
      const processed = await processSessionNotes(campaignId, selected.id);
      syncSession(processed);
      toast.success("Session notes processed.");
    });
  }

  async function handleClearNotes() {
    if (!selected || !confirm("Clear raw notes? The AI summary will be kept.")) return;
    try {
      const updated = await clearSessionNotes(campaignId, selected.id);
      syncSession(updated);
      toast.success("Notes cleared.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to clear notes."));
    }
  }

  async function handleClearSummary() {
    if (!selected || !confirm("Clear the AI summary and story beats?")) return;
    try {
      const updated = await clearSessionSummary(campaignId, selected.id);
      syncSession(updated);
      toast.success("Summary cleared.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to clear summary."));
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
      loadDrafts(); // show the new draft in the folder immediately
      toast.success("Recap ready — review and save to attach it to this session.");
    });
  }

  async function handleSaveRecap() {
    if (!selected) return;
    await runSaveRecap(async () => {
      const updated = await saveSessionRecap(campaignId, selected.id, recapDraft);
      syncSession(updated);
      setEditingRecap(false);

      // If this recap came from Generate, remove it from the drafts folder
      // since it's now attached to a session.
      if (currentDraftId !== null) {
        try {
          await deleteRecapDraft(campaignId, currentDraftId);
        } catch {
          // Non-fatal — draft may have already been deleted
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
    // If we generated a recap, clear the tracking ID but leave the draft in the folder
    if (currentDraftId !== null) {
      setCurrentDraftId(null);
      // Reload so the draft shows as unattached in the panel
      loadDrafts();
    }
  }

  async function handleDetachRecap() {
    if (!selected || !confirm("Detach the recap from this session? It will be saved to the unattached recaps folder.")) return;
    try {
      const updated = await clearSessionRecap(campaignId, selected.id);
      syncSession(updated);
      loadDrafts(); // refresh to show the newly-detached draft
      toast.success("Recap detached and saved to the unattached recaps folder.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to detach recap."));
    }
  }

  // ── Recap drafts panel actions ─────────────────────────────────────────────

  async function handleAttachDraft(draft: RecapDraft) {
    if (!selected) {
      toast.error("Select a session first, then attach the recap to it.");
      return;
    }
    if (selected.savedRecap && !confirm(
      `Session ${selected.sessionNumber} already has a recap. Replace it with this draft?`
    )) return;

    try {
      const updated = await attachRecapDraft(campaignId, draft.id, selected.id);
      syncSession(updated);
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      toast.success(`Recap attached to Session ${selected.sessionNumber}.`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to attach recap."));
    }
  }

  async function handleDeleteDraft(draft: RecapDraft) {
    if (!confirm("Permanently delete this unattached recap?")) return;
    try {
      await deleteRecapDraft(campaignId, draft.id);
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      toast.success("Recap draft deleted.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to delete recap draft."));
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
            <p className="text-stone-500 text-sm">Loading...</p>
          ) : sessions.length === 0 ? (
            <p className="text-stone-600 text-sm italic">No sessions yet.</p>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSession(s)}
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

          {/* Unattached Recaps folder */}
          <div className="pt-3">
            <button
              onClick={() => setDraftsOpen((o) => !o)}
              className="w-full flex items-center justify-between text-left text-stone-500 hover:text-stone-300 transition-colors text-xs uppercase tracking-wider pb-1"
            >
              <span>Unattached Recaps</span>
              <span className="flex items-center gap-1">
                {drafts.length > 0 && (
                  <span className="bg-blue-900/50 text-blue-400 rounded-full px-1.5 py-0.5 text-xs font-medium leading-none">
                    {drafts.length}
                  </span>
                )}
                <span>{draftsOpen ? "▴" : "▾"}</span>
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
                      <div className="flex gap-2 pt-0.5">
                        <button
                          onClick={() => handleAttachDraft(draft)}
                          disabled={!selected}
                          className="text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Attach
                        </button>
                        <button
                          onClick={() => handleDeleteDraft(draft)}
                          className="text-stone-600 hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
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
                  value={selected.playedOn.slice(0, 10)}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="mt-0.5 bg-transparent border-none text-stone-500 text-sm focus:outline-none focus:text-amber-400 cursor-pointer"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleProcess}
                  disabled={processing || !notes.trim()}
                  className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  {processing ? "Processing with Claude…" : "✨ Process with AI"}
                </button>
                <button
                  onClick={handleDeleteSession}
                  className="text-stone-600 hover:text-red-400 text-xs transition-colors px-2"
                >
                  Delete session
                </button>
              </div>
            </div>

            {/* Raw notes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-stone-500 text-xs uppercase tracking-wider">Session Notes</label>
                <div className="flex gap-3 items-center">
                  {/* Mic button */}
                  <button
                    onClick={handleToggleRecording}
                    title={recording ? "Stop recording" : "Record a voice note"}
                    className={`flex items-center gap-1.5 text-xs transition-colors ${
                      recording
                        ? "text-red-400 hover:text-red-300"
                        : "text-stone-400 hover:text-stone-200"
                    }`}
                  >
                    {recording ? (
                      <>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                        Stop
                      </>
                    ) : (
                      <>🎤 Record</>
                    )}
                  </button>
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="text-stone-400 hover:text-stone-200 disabled:opacity-50 text-xs transition-colors"
                  >
                    {savingNotes ? "Saving…" : "Save notes"}
                  </button>
                  {selected.rawNotes && (
                    <button onClick={handleClearNotes} className="text-stone-600 hover:text-red-400 text-xs transition-colors">
                      Clear notes
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={7}
                placeholder="Paste or type your raw session notes here. AI will extract story beats, find NPCs, and write a summary."
                className={`w-full bg-stone-900 border rounded-lg px-4 py-3 text-stone-100 placeholder-stone-600 focus:outline-none resize-y text-sm leading-relaxed transition-colors ${
                  recording
                    ? "border-red-800 focus:border-red-600"
                    : "border-stone-700 focus:border-amber-500"
                }`}
              />
              {/* Live interim transcript preview */}
              {interimText && (
                <p className="mt-1.5 px-1 text-stone-500 text-sm italic leading-relaxed">
                  {interimText}
                  <span className="inline-block w-0.5 h-3.5 bg-stone-500 ml-0.5 align-middle animate-pulse" />
                </p>
              )}
            </div>

            {/* AI Summary */}
            <div className="bg-stone-900 border border-stone-700 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-cinzel text-amber-400">AI Summary</h3>
                <div className="flex gap-3">
                  {selected.summary && !editingSummary && (
                    <button onClick={() => setEditingSummary(true)} className="text-stone-400 hover:text-stone-200 text-xs transition-colors">
                      Edit
                    </button>
                  )}
                  {editingSummary && (
                    <>
                      <button
                        onClick={handleSaveSummary}
                        disabled={savingSummary}
                        className="text-amber-400 hover:text-amber-300 disabled:opacity-50 text-xs transition-colors"
                      >
                        {savingSummary ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => { setEditingSummary(false); setSummaryDraft(selected.summary ?? ""); }}
                        disabled={savingSummary}
                        className="text-stone-500 hover:text-stone-300 disabled:opacity-50 text-xs transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {selected.summary && (
                    <button onClick={handleClearSummary} className="text-stone-600 hover:text-red-400 text-xs transition-colors">Clear</button>
                  )}
                </div>
              </div>

              {editingSummary ? (
                <textarea
                  value={summaryDraft}
                  onChange={(e) => setSummaryDraft(e.target.value)}
                  rows={5}
                  className="w-full bg-stone-800 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500 resize-y text-sm leading-relaxed"
                />
              ) : selected.summary ? (
                <p className="text-stone-300 text-sm leading-relaxed">{selected.summary}</p>
              ) : (
                <p className="text-stone-600 italic text-sm">No summary yet — paste notes and click "Process with AI".</p>
              )}

              {storyBeats.length > 0 && !editingSummary && (
                <div>
                  <p className="text-stone-500 text-xs uppercase tracking-wider mb-2">Story Beats</p>
                  <ul className="space-y-1">
                    {storyBeats.map((beat, i) => (
                      <li key={i} className="text-stone-300 text-sm flex gap-2">
                        <span className="text-amber-600 shrink-0">◆</span>{beat}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {newNpcs.length > 0 && !editingSummary && (
                <div>
                  <p className="text-stone-500 text-xs uppercase tracking-wider mb-2">NPCs Mentioned</p>
                  <div className="flex flex-wrap gap-2">
                    {newNpcs.map((name, i) => (
                      <span key={i} className="bg-stone-800 border border-stone-600 text-stone-300 text-xs px-2 py-1 rounded-full">{name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recap management */}
            <div className="bg-stone-900 border border-stone-700 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-cinzel text-amber-400">Session Recap</h3>
                  <p className="text-stone-500 text-xs mt-0.5">"Previously on..." — saved to this session for reference at the table.</p>
                </div>
                <div className="flex gap-2">
                  {/* "Write" is a creation action — only show it when no recap exists yet */}
                  {!selected.savedRecap && !editingRecap && (
                    <button
                      onClick={() => { setRecapDraft(""); setEditingRecap(true); }}
                      className="text-stone-400 hover:text-stone-200 text-xs transition-colors px-2"
                    >
                      Write
                    </button>
                  )}
                  <button
                    onClick={handleGenerateRecap}
                    disabled={generatingRecap}
                    className="bg-stone-700 hover:bg-stone-600 disabled:opacity-40 text-stone-200 text-xs px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {generatingRecap ? "Generating recap…" : "✨ Generate"}
                  </button>
                  {selected.savedRecap && !editingRecap && (
                    <>
                      {/* Explicitly reseed recapDraft so Edit is always safe even if state drifted */}
                      <button
                        onClick={() => { setRecapDraft(selected.savedRecap!); setEditingRecap(true); }}
                        className="text-stone-400 hover:text-stone-200 text-xs transition-colors px-2"
                      >
                        Edit
                      </button>
                      <button onClick={handleDetachRecap} className="text-stone-600 hover:text-red-400 text-xs transition-colors px-2">Detach</button>
                    </>
                  )}
                  {editingRecap && (
                    <>
                      <button
                        onClick={handleSaveRecap}
                        disabled={savingRecap || !recapDraft.trim()}
                        className="text-amber-400 hover:text-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-xs transition-colors"
                      >
                        {savingRecap ? "Saving…" : "Save Recap"}
                      </button>
                      <button
                        onClick={handleCancelRecap}
                        disabled={savingRecap}
                        className="text-stone-500 hover:text-stone-300 disabled:opacity-50 text-xs transition-colors px-2"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              {editingRecap ? (
                <textarea
                  value={recapDraft}
                  onChange={(e) => setRecapDraft(e.target.value)}
                  rows={5}
                  className="w-full bg-stone-800 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500 resize-y text-sm leading-relaxed"
                />
              ) : selected.savedRecap ? (
                <p className="text-stone-300 text-sm leading-relaxed whitespace-pre-wrap">{selected.savedRecap}</p>
              ) : (
                <p className="text-stone-600 italic text-sm">No recap saved — generate one, write your own above, or attach one from the Unattached Recaps folder.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-stone-700 gap-3 py-20">
            <span className="text-3xl">📖</span>
            <p className="text-sm italic">Select or create a session to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
