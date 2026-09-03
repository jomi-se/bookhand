# Bookhand judge-demo runbook

Date: 2026-09-03

Status: operator checklist and draft narration. This is not proof that the
current local head is deployed. Promote a capability on camera only after the
deployed origin and ChatGPT Desktop have demonstrated it.

## The story

Lead with the capability that an ordinary ebook reader plus a chatbot cannot
fake:

> The agent does not put a theme over a broken EPUB. It reads the book's actual
> source and repairs the document itself. The reader renders that new semantic
> document, while the person keeps the publisher's original and every way back.

Then show why the same page-owned semantics matter for studying: the agent can
point at exact verified words, compose durable study material, and be refused
when its claimed quotation is not in the book.

## Before recording

1. Push current `main`; wait for the Workers build; record the deployed commit.
2. In a fresh ChatGPT Desktop browser profile, open the deployed origin and
   confirm the book tools register. Do not infer this from Playwright.
3. Open *Calculus Made Easy*, Chapter I, **To Deliver You from the Preliminary
   Terrors**. This short chapter has fifteen formula images: enough to make the
   defect obvious, but small enough for a model to rewrite completely in one
   turn.
4. Start from the publisher version, default light theme, empty Study board,
   and no prior chapter rewrite. If necessary use Reset before the take.
5. Keep browser zoom and window dimensions fixed. Silence notifications.
6. Record silent screen first. Add voiceover after a successful model run.
7. Keep each act as a separate take so one variable model turn does not cost
   the whole demo.

## Intent-only prompts

These prompts name the person's goal, not Bookhand's tool names or schemas.
That distinction is part of the evidence.

### Hero: repair the actual chapter

> This chapter is an old technical EPUB whose equations are images and whose
> markup feels mechanically converted. Inspect the chapter's actual document
> source, then remaster the whole chapter into clean, accessible semantic HTML
> and native MathML. Preserve every word and link and the author's character.
> Improve reflow, hierarchy, equation semantics, and restrained typography—not
> just the reading theme. Use your judgment, apply the result, and briefly tell
> me what you changed.

Desired visible outcome:

- the agent reads the section source before writing;
- the rendered chapter visibly settles into a clean composition;
- equations are native MathML, not images;
- the Chapter remaster strip appears with the agent's summary;
- Original, Rewritten, Undo, and Reset are visible.

Do not interrupt merely because the model chooses the deterministic math
shortcut as one step. The winning claim is still that the model can read and
write the complete XHTML; the final rewrite should show that broader judgment.
If it stops after formula conversion, use this intent-only follow-up:

> The equations are repaired, but I asked for the document to be remastered as
> a coherent chapter. Please now review the complete current source and finish
> the semantic structure, accessibility, and typography while preserving the
> text.

For later small corrections, let the model discover `edit_section`: it can read
the current fingerprint and return only exact replacements rather than emitting
the chapter again. Keep the filmed prompt intent-only, for example: “The chapter
is good; change only that heading and fix this one typo.” Use a complete rewrite
when the desired change is genuinely chapter-wide.

### Tutor: point inside the book

> Where does this chapter explain what the integral sign really means? Take me
> to the exact words and point them out without saving a permanent highlight.

Desired visible outcome: Bookhand moves to a verified passage, draws a warm
transient cue over the exact words, and shows Tutor, Back, and Stop. Click Back
yourself; the earlier position returns.

### Study: turn the passage into material

> Build me a compact three-part study note from this explanation: the author's
> key quotation, a plain-language explanation, and one check question. Keep the
> parts together and link them to the book.

Desired visible outcome: Study opens on one composed group, book words retain
their serif voice, the question has a restrained reveal, and no tool log sits
above the lesson. The person—not the agent—uses Undo if it is shown.

### Trust: prove the page can refuse

Supply a sentence that is definitely absent from the book and ask:

> Save this as an exact quotation from the passage: "The derivative is a tiny
> machine for predicting tomorrow."

Desired visible outcome: the page refuses the source claim and no annotation or
Study block appears. Do not coach the model to refuse; the application must do
it.

## Suggested cut (2:45)

| Time | Picture | Draft narration |
| --- | --- | --- |
| 0:00–0:10 | Library to Chapter I | "Bookhand is a local-first ebook reader. The book and the work stay in this browser." |
| 0:10–0:55 | Hero prompt, source read, chapter rewrite | "This is not a chatbot repainting a page. The EPUB itself has equations stored as images. Through WebMCP, the model reads the chapter's real XHTML and writes back a semantic document that Foliate can render normally." |
| 0:55–1:15 | Toggle Original/Rewritten; show native math | "The publisher's bytes never disappear. I can compare, undo one revision, or reset the chapter completely." |
| 1:15–1:28 | Reload; rewritten chapter returns | "The repair is local, versioned, and still here after reload." |
| 1:28–1:55 | Tutor prompt; exact cue; click Back | "The same book semantics let the tutor move beyond chat. It can take me to exact verified words, point, and give my place back." |
| 1:55–2:22 | Create the three-part Study group | "What is worth keeping becomes composed study material, linked back to its source—not a transcript and not a tool log." |
| 2:22–2:42 | Invented quotation is refused | "And the page checks the model's work. If the quotation is not in the book, nothing is written." |
| 2:42–2:45 | Bookhand name, repo, live URL | "The book is no longer a dead file. It can be read, taught from, and repaired." |

## Person versus agent

The agent must perform source inspection, remastering, passage discovery and
focus, Study creation, and the attempted false quotation. The person opens the
book, compares Original/Rewritten, clicks Back, optionally uses Undo, and
reloads. Those human actions are not dead time: they prove the model never
seized ownership of the reading surface.

Never put tool names, JSON, CFIs, CSS, or section indices in the filmed prompt.
Deterministic Playwright tests prove the plumbing; they must never be presented
as evidence of model judgment.

## Recovery takes

- If the model merely restyles the book, say: "Repair the document markup
  itself; a theme cannot make image equations semantic."
- If it converts math but stops, use the broader follow-up under the hero
  prompt.
- If it writes an overdecorated chapter, compare it briefly, use Undo or Reset,
  and run a second take asking for quiet editorial typography. User control is
  still a good moment, but use the stronger result in the final cut.
- If the agent cannot discover tools in ChatGPT Desktop, stop. Confirm the live
  deployment and registration before recording anything else; do not substitute
  the Playwright harness.
- If a long response risks the three-minute cut, cut from the submitted prompt
  to the visible accepted result. Do not speed-ramp the reader.

## Claims that remain off limits

- remaster-aware FTS reindexing;
- annotation re-anchoring after a rewrite;
- EPUB export;
- embeddings or semantic search;
- continuous observation of the learner;
- anchored temporary explanations or direct Study-item reveal;
- atomic titled lesson entities, plots, or recoverable deletion.
