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

**Study surface**:
The durable lessons, notes, diagrams, and other learning material the reader
chooses to keep.
_Avoid_: Tutor history

**Tutor surface**:
Transient conversation and live guidance, including temporary cues that may
appear on the reading surface.
_Avoid_: Study board
