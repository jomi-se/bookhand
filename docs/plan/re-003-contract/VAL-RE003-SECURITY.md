# VAL-RE003-SECURITY: Extra reader frames do not weaken containment

Surface: browser.
Needs: a production build and the hostile EPUB fixture.
Behavior: Scroll mode uses only Bookhand same-origin reader frames and imported content cannot run packaged scripts, exfiltrate, mutate the parent, open a popup, or navigate the application.
Evidence: the existing hostile-EPUB sentinels run in Scroll mode with network, page, parent-state, and CSP observations.
