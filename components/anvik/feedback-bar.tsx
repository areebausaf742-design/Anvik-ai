"use client";

import { useEffect, useState } from "react";
import { Check, GraduationCap, ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import {
  mirrorLearning,
  recordCorrection,
  recordFeedback,
  type Verdict,
} from "@/lib/learning";

/**
 * The strip under an AI reply: the checker's verdict, the credit label, and
 * like / dislike / teach.
 *
 * All three write only through lib/learning.ts, which redacts secrets and
 * phone numbers before anything is stored.
 */
export default function FeedbackBar({
  question,
  answer,
  checked,
  fixed,
  credit,
  verdict,
  taught,
  onVerdict,
  onTaught,
  onError,
}: {
  question: string;
  answer: string;
  checked?: boolean;
  fixed?: boolean;
  credit?: string;
  verdict?: Verdict;
  taught?: boolean;
  onVerdict: (verdict: Verdict | undefined) => void;
  onTaught: () => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(""), 4000);
    return () => window.clearTimeout(timer);
  }, [note]);

  function vote(next: Verdict) {
    const active = verdict === next ? undefined : next;
    const { redacted } = recordFeedback({ question, answer, verdict: next });
    mirrorLearning({ verdict: next, question, answer });
    onVerdict(active);
    setOpen(active === "dislike");
    if (active === "dislike") {
      setNote("Thanks — tell ANVIK what the right answer was.");
    } else if (active === "like") {
      setNote("Saved. ANVIK will reuse this answer for the same question.");
    } else {
      setNote("");
    }
    if (redacted.length > 0) {
      onError(
        `Not stored: ANVIK removed ${redacted.join(", ")} from what you sent. It never keeps keys, passwords or phone numbers.`,
      );
    }
  }

  function teach() {
    const text = draft.trim();
    if (!text) return;
    const { redacted } = recordCorrection({ question, answer, correction: text });
    mirrorLearning({ verdict: "correction", question, answer, correction: text });
    onTaught();
    setDraft("");
    setOpen(false);
    if (redacted.length > 0) {
      setNote(`Taught, with ${redacted.join(", ")} removed before saving.`);
    } else {
      setNote("Learned. Ask this again and you'll get your version.");
    }
  }

  return (
    <div className="feedback-strip">
      <div className="feedback-left">
        {checked && (
          <span
            className={`check-badge${fixed ? " check-badge-fixed" : ""}`}
            title={
              fixed
                ? "ANVIK found an issue and corrected it before showing this answer."
                : "ANVIK checked the language, links, phone numbers and formatting."
            }
          >
            <ShieldCheck aria-hidden="true" />
            {fixed ? "Checked & corrected" : "Checked"}
          </span>
        )}
        {credit && <span className="credit-note">{credit}</span>}
      </div>

      <div className="feedback-actions">
        <button
          type="button"
          className={`feedback-button${verdict === "like" ? " feedback-on" : ""}`}
          aria-pressed={verdict === "like"}
          aria-label="This answer helped"
          onClick={() => vote("like")}
        >
          <ThumbsUp aria-hidden="true" />
          <span>Helpful</span>
        </button>
        <button
          type="button"
          className={`feedback-button${verdict === "dislike" ? " feedback-on" : ""}`}
          aria-pressed={verdict === "dislike"}
          aria-label="This answer was wrong or unhelpful"
          onClick={() => vote("dislike")}
        >
          <ThumbsDown aria-hidden="true" />
          <span>Not right</span>
        </button>
        {!open && (
          <button type="button" className="feedback-button" onClick={() => setOpen(true)} aria-expanded={open}>
            <GraduationCap aria-hidden="true" />
            <span>{taught ? "Teach again" : "Teach ANVIK"}</span>
          </button>
        )}
      </div>

      {open && (
        <div className="teach-box">
          <label htmlFor="teach-input">
            What should I have said?
            <small>Saved on this device. Keys, passwords and phone numbers are removed first.</small>
          </label>
          <div className="teach-row">
            <textarea
              id="teach-input"
              rows={2}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write the answer you wanted, in your own words."
            />
            <button type="button" className="teach-save" onClick={teach} disabled={!draft.trim()}>
              <Check aria-hidden="true" /> Save
            </button>
            <button type="button" className="teach-cancel" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {note && (
        <p className="feedback-note" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
