# Bookhand Context

Bookhand is a local-first ebook reader where ordinary reading remains primary
and an optional AI can understand, teach from, and improve the reader's own
copy of a book.

## Books and repair

**Publisher original**:
The immutable EPUB the reader imported.
_Avoid_: Source revision, base branch

**Personal copy**:
The reader's current form of the book, including every repair they chose to
keep.
_Avoid_: Accepted revision, working tree

**Book health**:
A quiet, plain-language assessment of whether Bookhand knows about anything
that may impair reading, navigation, or accessibility. It is not a score, task
list, or claim that the book is perfect.
_Avoid_: Validation dashboard, quality score

**Book issue**:
A specific concern in Book Health, either detected automatically or raised
deliberately by the reader or their AI.
_Avoid_: Finding, ticket, lint error

**Compatibility handling**:
General behavior Bookhand applies automatically so ordinary EPUBs remain safe
and pleasant to read. It does not rewrite the meaning of a particular book.
_Avoid_: Automatic repair

**Book repair**:
A durable, reversible change that improves the reader's personal copy,
including accessibility improvements as well as visible fixes.
_Avoid_: Remediation ticket, automated cleanup

**Repair workspace**:
Temporary work prepared away from the current personal copy while the reader
continues reading.
_Avoid_: Branch, staging area

**Repair proposal**:
A coherent group of proposed repairs that the reader can experience and choose
whether to keep.
_Avoid_: Patch set, commit

## Product surfaces

**Reading surface**:
The visible book and its immediate reading controls.
_Avoid_: Renderer UI

**Notebook**:
The place to browse everything about one book (artifacts, highlights,
memories, and conversations) without searching the book itself.
_Avoid_: Study surface, study board, library

**Tutor surface**:
Conversation and live guidance with an agent, including cues that may appear on
the reading surface. Nothing on it disappears unless the reader dismisses or
deletes it.
_Avoid_: Study board, transient tutor, chat

## Learning with an agent

**Conversation**:
An exchange between the reader and an agent about a book. It is kept, but it
is the process rather than the thing the reader returns to.
_Avoid_: Chat log, transcript, session

**Artifact**:
Anything the reader or an agent makes about a book that should outlive the
conversation that produced it, anchored to passages, a chapter, or the whole book. It may take any shape,
from a note the reader typed to an interactive visual, and may leave markings on
the book.
_Avoid_: Lesson, card, block, study item

**Highlight**:
A mark the reader places on a passage. It is part of the book's surface, not an
artifact, though artifacts may be anchored to it.
_Avoid_: Annotation

**Marking**:
A visible sign an artifact leaves on the book, such as a highlight, a margin
stroke, or a pin, that leads back to the artifact.
_Avoid_: Badge, indicator

**Memory**:
Something an agent should know about this reader and this book in future
conversations: what they understood, where they struggled, what they think of
the material, and how they like to be taught.
_Avoid_: History, profile, context

## Reader control

**Keep**:
Turn something from a conversation into an artifact immediately, without
asking the agent.
_Avoid_: Save, bookmark, pin

**Dismiss**:
Remove something from view while keeping it findable later. It is the ordinary
way agent cues, explanations, and conversations leave the screen.
_Avoid_: Close, clear, delete

**Delete**:
Deliberately destroy something the reader owns. It is the only way Bookhand
loses learning material.
_Avoid_: Dismiss, remove
