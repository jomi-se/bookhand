# VAL-AGENT-ACTIVITY-PRESENTATION: Observability stays outside Study

Surface: Study UI, diagnostics UI, genuine WebMCP runtime, and browser.
Needs: observable WebMCP call state.
Behavior: Study contains no raw tool names, call list, timestamps, connection log, diagnostics disclosure, or other agent observability. A separate, reachable diagnostics surface owns at most twenty recent call records and exposes its disclosure with correct button, keyboard, focus, and `aria-expanded` behavior. New calls never open or expand Study or diagnostics, steal focus, or change Study geometry. Contextual product errors are owned by their mutation/load contracts, not this diagnostics contract.
Evidence: Genuine multi-call trace with unchanged Study geometry; diagnostics open/close keyboard and accessibility trace; twenty-record retention and clear behavior; assertions that raw tool names are absent from Study and new calls do not steal focus or open surfaces.
