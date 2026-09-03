# ChatGPT Desktop test checklist

Date: 2026-09-03

Use this checklist against the deployed Bookhand origin in a fresh ChatGPT
Desktop browser tab. These are live model tests: do not substitute Playwright
or manually name WebMCP tools in the prompts.

Record failures in `findings.txt` with the exact prompt, ChatGPT's response,
the visible result, any error text, whether retrying duplicated work, whether
reload changed the result, and a screenshot for visual problems.

## Preflight

1. Push and deploy current `main`; record the deployed commit.
2. Open *Calculus Made Easy*.
3. Reset the current chapter to Original.
4. Use the default Light theme and an empty Study board.
5. Ask:

> What book and chapter am I looking at? Briefly tell me what you can help me
> do here.

Pass when ChatGPT discovers Bookhand's page tools and correctly reports the
current reading context. If it cannot discover tools, stop and diagnose the
deployment or tab; the rest of the run is not meaningful.

## 1. Full document remaster — the hero

Open Chapter I, *To Deliver You from the Preliminary Terrors*, and ask:

> This chapter is an old technical EPUB whose equations are images and whose
> markup feels mechanically converted. Inspect the chapter's actual document
> source, then remaster the whole chapter into clean, accessible semantic HTML
> and native MathML. Preserve every word, link, and the author's character.
> Improve reflow, hierarchy, equation semantics, and restrained typography—not
> just the reading theme. Use your judgment, save the result, and briefly tell
> me what you changed.

Pass when:

- ChatGPT reads the actual section source before writing.
- It rewrites the document rather than merely applying CSS.
- The agent operation leaves the current book readable and reports that a
  rewrite is ready.
- The person can select **Rewritten** to reveal the saved revision.
- Formula images become native MathML.
- All original prose and links remain.
- The remaster disclosure attributes the change to an agent.
- Original, Rewritten, Undo, Reset, and the disclosure collapse all work.
- Reload preserves the rewrite; Reset survives another reload.

If it stops after converting equations, ask:

> The equations are repaired, but the complete document still needs editorial
> attention. Review the current source and finish its semantic structure,
> accessibility, reflow, and restrained typography while preserving the text.

## 2. Surgical remaster editing

After a successful remaster, ask:

> The chapter is good. Change only the chapter heading to sentence case and
> correct one obvious typographical problem. Leave everything else untouched.

Pass when it makes a targeted edit rather than returning the complete chapter,
creates one reversible revision, and Undo removes only that revision.

## 3. Original versus Rewritten

Alternate manually between Original and Rewritten.

Pass when:

- The visible state changes correctly and the difference is obvious.
- The publisher's original document remains intact.
- Switching versions does not discard the rewrite.
- The controls remain usable at a narrow viewport.
- Switching never leaves the book blank or stuck loading.

## 4. Reader controls on both versions

Test Original and Rewritten independently.

Pass when:

- The visible − and + controls resize prose, headings, and mathematics.
- Zoom remains visible and usable on a compact/mobile viewport.
- Text settings can select Auto, Single, and Spread page layout.
- Single produces one column on desktop; compact reading remains one column.
- Left/Right and Page Up/Page Down turn pages while ordinary chrome buttons
  have focus, but do not turn an obscured book while a panel is open.
- Zoom and page layout persist after reload.

## 5. Live tutoring

Move somewhere else in the book, then ask:

> Where does the author explain what the integral sign really means? Take me
> to the exact passage and point it out without creating a permanent highlight.

Pass when:

- ChatGPT searches the book and moves to the correct passage.
- One calm transient cue marks the exact words.
- The Tutor strip explains what is being shown.
- **Back** restores the prior location.
- **Stop** leaves the reader at the shown passage.
- Reload does not resurrect the temporary cue.

Repeat once, then turn a page manually while guidance is active. Manual
takeover must not trap the reader, and Back/Stop must remain understandable.

## 6. Search without navigation

Ask:

> Find the three most relevant passages about the slope of a curve, but don't
> move me yet.

Pass when it returns grounded passages without moving the reader. Then ask:

> Show me the most relevant one and point at it.

Pass when the chosen search result becomes an exact passage focus without a
schema error or permanent annotation.

## 7. Composed Study lesson

While focused on a useful passage, ask:

> Build me a compact three-part study lesson from this explanation: the
> author's key quotation, a plain-language explanation, and one check question.
> Keep the parts together and link them to the book.

Pass when:

- It appears as one titled lesson rather than unrelated records.
- The quotation retains book/serif typography.
- The question has a usable answer reveal.
- Source links return to the book.
- Study opens at the lesson title.
- Tool logs or agent activity do not appear inside Study.
- The lesson survives reload.
- Any Undo remains explicit and controlled by the person.

## 8. Grounding refusal — the trust moment

Ask:

> Save this as an exact quotation from the current passage: “The derivative is
> a tiny machine for predicting tomorrow.”

Pass when Bookhand refuses the false source claim, no highlight, annotation, or
Study item is created, and ChatGPT reports that the claimed quotation was not
found. The refusal must come from Bookhand's source verification rather than
only from model caution.

## 9. Themes

Try Light, Sepia, and Dark while viewing equations, Search, Study, tutor
guidance, and the remaster disclosure.

Pass when:

- The whole application changes theme, not only the EPUB page.
- No light seams remain around the dark reader.
- Equations remain visible in Dark.
- All panels and transient surfaces inherit the theme.
- Applied themes persist after reload; an un-applied preview does not.

## 10. Recovery and concurrency

Exercise Back and Stop during tutoring; Undo one remaster revision; Reset the
remaster; switch Original/Rewritten without deleting either; undo an
agent-created Study change if offered; and reload after each persistent action.

Finally, start a remaster request and use ordinary reader controls while the
agent works. Pass when the mounted book remains readable, the saved rewrite is
offered only when ready, and the person can reveal or ignore it without clearing
browser storage.

## Must-win report

Record a simple pass/fail for these five moments before recording the video:

- Full semantic remaster and native MathML.
- Original/Rewritten comparison with a reliable way back.
- Zoom and page navigation on the rewritten chapter.
- Tutor pointing with Back.
- False-quotation refusal.

If these five land cleanly, proceed to the filming sequence in
`docs/submission/demo-runbook.md`.
