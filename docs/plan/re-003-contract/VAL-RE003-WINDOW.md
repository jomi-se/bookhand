# VAL-RE003-WINDOW: Continuous scrolling has a hard resident-frame bound

Surface: browser.
Needs: a reflowable EPUB with more than sixteen linear spine sections.
Behavior: natural forward and backward scrolling crosses many section boundaries while at most eight unique section frames are mounted, no section is duplicated, and retired section resources and document listeners are released.
Evidence: frame and section identities sampled after every boundary in both directions, plus transform scrutiny of the single admission/eviction owner.
Fail: any observed ninth frame, refill oscillation, duplicate section, or dead end fails the assertion.
