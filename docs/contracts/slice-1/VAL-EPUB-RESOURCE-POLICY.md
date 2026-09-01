# VAL-EPUB-RESOURCE-POLICY: Allow packaged resources and block remote fetches

Surface: browser and network.
Needs: VAL-READER-ENGINE, VAL-READER-OPEN, production build, malicious resource fixture, hero EPUB, and controlled intercepted origin.
Behavior: Packaged text, styles, images, SVG, fonts, captions, and accessible alternatives render. Attempted remote image, CSS, font, form, iframe, and fetch destinations make zero requests and cannot degrade ordinary readable content into an unexplained blank surface.
Evidence: Fixture manifest with exact attempted URLs; intercepted request counts; screenshots of readable fixture and real Chapter X resources; accessible-name inspection; CSP events where emitted.
