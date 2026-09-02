# VAL-DEPLOYMENT-HEADERS: Deployment matches the storage and embed decision

Surface: deployed HTTPS response and judged embedded browser.
Needs: ADR 0002, ADR 0003, and the deployed commit hash.
Behavior: The deployment sends neither COOP nor COEP unless a superseding ADR records and validates the change; CSP and existing security headers remain intact. Storage and WebMCP still initialize in deployed Chromium, and the owner separately confirms initialization in the judged ChatGPT desktop browser before judged-surface claims are complete.
Evidence: Header capture from the deployed commit; ADR check; deployed Chromium storage/tool/console/network trace; required owner-witnessed ChatGPT desktop storage mode and tool-registration observation.
