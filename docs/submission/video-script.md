# Bookhand Demo Video Script (Target: 2:40)

Date: 2026-09-03  
Submission: WebMCP Challenge  
Target Duration: 2 minutes 40 seconds (Hard limit: under 3:00)

---

## Pre-Flight Setup & Environment

* **Screen Setup:** ChatGPT Desktop on the right, Bookhand on the left (side-by-side or split window).
* **Target Book:** *Calculus Made Easy* by Silvanus Thompson (bundled), Chapter I: *"To Deliver You from the Preliminary Terrors"*.
* **Initial State:** Light mode, default publisher version, empty Study board, no prior chapter rewrite (click `Reset` beforehand if tested earlier).
* **Recording Strategy:** Record screen actions silently first, then record/dub voiceover on top for perfect timing.

---

## The 4-Act Storyboard

```
[0:00 - 1:05] ACT 1: The Hook & The Document Remaster (Hero Moment)
[1:05 - 1:40] ACT 2: The Semantic Tutor (Verified Guidance & Back Button)
[1:40 - 2:10] ACT 3: The Composed Study Board (Durable Knowledge Primitives)
[2:10 - 2:30] ACT 4: The Mic Drop (The Book Fact-Checks the AI)
[2:30 - 2:40] OUTRO: Local-First Sovereign Reader Wrap-up
```

---

### ACT 1: The Hook & The Document Remaster (0:00 – 1:05)

#### 🎥 On Screen Action:
* Open Bookhand in the browser. Zoom in slightly on Chapter I.
* Drag a selection across a sentence containing a formula to show that the
  equation behaves as a separate image rather than selectable mathematics.
* Briefly increase text size to show the equation image scaling separately from
  the surrounding type. Only show Dark Mode if the publisher version has a
  clearly visible contrast problem in the final deployed build.

#### 🎙️ Voiceover (0:00 – 0:25):
> "Bolting a ChatGPT sidebar onto an ebook reader is lazy. 
> This is Bookhand—a 100% local-first EPUB reader that turns reading into an active, collaborative workspace using native browser WebMCP.
> Look at this 1910 calculus textbook. Its equations and even individual variables are stored as thousands of separate SVG images. They interrupt selection, hide mathematical meaning from text search, leave assistive technology with image alternatives instead of structured mathematics, and scale separately from the surrounding type."

#### 💬 Prompt into ChatGPT:
> "Inspect this chapter's document source, then remaster it into clean, accessible semantic HTML5 and native MathML. Preserve every word, but fix the equations, headings, and typography. Tell me what you changed."

#### 🎥 On Screen Action (0:25 – 0:45):
* Show the model calling `get_section_source` and `edit_section` (or `rewrite_section`).
* **The Magic Moment:** The book visibly re-renders *in place*.
* The equation images vanish, replaced by native MathML equations.
* Select a math equation with your mouse to prove it is now real selectable text.
* Show the Remaster banner at the top displaying the agent's summary.

#### 🎙️ Voiceover (0:45 – 1:05):
> "Instead of putting a theme over a broken file, the agent uses WebMCP to read and rewrite the chapter's actual XHTML source.
> Notice what happened: the image-based equations are now native, scalable MathML. You can select the formulas, assistive technology can interpret their structure, and they inherit the reader's typography and colour naturally.
> And the user stays in complete control: with one click, I can toggle between the Original publisher version and the Remaster, or hit Reset at any time."
*(Click "Original" then "Rewritten" on screen to demonstrate instant comparison).*

---

### ACT 2: The Tutor & Exact Cues (1:05 – 1:40)

#### 💬 Prompt into ChatGPT:
> "Where does the author explain what a differential really means? Take me to the exact passage and point it out without saving a permanent highlight."

#### 🎥 On Screen Action:
* The book automatically navigates to the exact paragraph.
* A warm transient highlight settles over the verified sentence.
* The top guidance bar shows: **Tutor** with **[Back]** and **[Stop]** controls.
* **Click [Back]:** The reader smoothly jumps back to where you were originally reading.

#### 🎙️ Voiceover (1:05 – 1:40):
> "Because WebMCP gives the agent real book semantics instead of DOM-scraping, it can act as a true tutor. 
> It didn't just dump text into the chat. It verified the exact passage against the open book, navigated there, and drew a temporary visual cue over the words.
> And notice: it didn't hijack my reading session. I click 'Back', and Bookhand immediately returns me to where I was reading before."

---

### ACT 3: The Composed Study Board (1:40 – 2:10)

#### 💬 Prompt into ChatGPT:
> "Build me a compact three-part study note from this concept: a key quotation, a plain-English explanation, and an active-recall question. Link it back to the book."

#### 🎥 On Screen Action:
* The Study Board slides open, docked beside the book.
* A clean, unified study card appears containing:
  1. An attributed quotation.
  2. A prose explanation.
  3. A collapsible *"Show Answer"* question card.
* Click the lesson's compact source link—it jumps right to that passage in the text.

#### 🎙️ Voiceover (1:40 – 2:10):
> "When you want to retain what you're learning, the agent synthesizes structured, native study material directly onto your Study Board.
> These aren't raw chat transcripts or tool logs. They are permanent, composable primitives—quotes, explanations, and flashcards—stored locally in SQLite and linked back to the exact passage in the book so you can always re-verify the source."

---

### ACT 4: The Mic Drop—The Book Fact-Checks the Agent (2:10 – 2:30)

#### 🎥 Setup:
* Select the real sentence **"But here comes in a curious point."** in the
  source passage.

#### 💬 Prompt into ChatGPT:
> "Save the selected passage as this exact quotation, without correcting my wording: 'But here comes in a crucial point.'"

#### 🎥 On Screen Action:
* The agent attempts to call `save_annotation`.
* **The Refusal:** Bookhand immediately returns an error: *"That quotation does not match the text at that location."*
* Nothing is written to the book or the study board.

#### 🎙️ Voiceover (2:10 – 2:30):
> "And here is the most important part: the book fact-checks the AI.
> I changed one plausible word in the selected sentence and asked the model to save it as an exact quotation.
> In Bookhand, the application verifies the text fingerprint against the actual open book. If the words aren't there, the write is refused, and nothing touches your database."

---

### OUTRO (2:30 – 2:40)

#### 🎥 On Screen Action:
* Zoom out to show the complete interface (clean typography, open Study Board, local-first library).
* Show the URL / GitHub link card on screen.

#### 🎙️ Voiceover:
> "Bookhand keeps the library, reading position, annotations, remasters, and study material in this browser using SQLite WASM and OPFS—without an application backend, account, or cloud upload. It proves that with WebMCP, books don't have to be dead files—they can be living, collaborative, and self-repairing.
> Try it live at bookhand.dev."

---

## Filming Checklist & Tips

1. **Keep it under 2:45:** Devpost requires the finished public YouTube video
   to be under 3:00 and to include explanatory audio. Aiming for 2:40 leaves a
   safety buffer.
2. **Silent Take First:** Record the screen interactions cleanly using Canvid or Cap.so with auto-zoom on the clicks.
3. **Voiceover Second:** Record the narration while watching the exported video (using Audacity or Clipchamp).
4. **No Spoilers in Prompts:** Never name tool names (`save_annotation`, `edit_section`, CFI) in the prompts typed on screen. The prompts must remain purely intent-driven.
5. **Protect the application-level refusal:** Use a take only if Bookhand visibly
   rejects the altered quotation. If ChatGPT notices the changed word and
   declines before attempting the write, reset and record this act separately;
   do not describe a model-side refusal as Bookhand fact-checking it.
