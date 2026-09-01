# VAL-EPUB-CONTAINMENT: Block privileged book behavior

Surface: browser and network.
Needs: VAL-READER-ENGINE, VAL-READER-OPEN, production build, malicious EPUB with per-capability sentinels, and controlled exfiltration sink.
Behavior: The production-delivered enforceable CSP applies to EPUB child content and blocks inline/packaged book scripts plus forbidden navigation, form, object, and connection routes while readable packaged content remains available. The fixture contains and attempts script execution, parent marker mutation, local/session storage reads/writes, popup/top navigation, form submission, nested browsing, and privileged bridge discovery; no parent/storage mutation, popup/navigation, submission, bridge access, or exfiltration succeeds.
Evidence: Actual production response/meta policy and DevTools policy state; fixture manifest proving script instructions and every sentinel are present; violation/sentinel logs; parent/storage before/after; popup/navigation/form observations; controlled sink request count of zero; readable-content screenshot.
