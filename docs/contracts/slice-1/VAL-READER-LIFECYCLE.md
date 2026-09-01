# VAL-READER-LIFECYCLE: Safe adapter and database lifecycle

Surface: browser and data.
Needs: deterministic fixture, React StrictMode development build, persistent database mode.
Behavior: Repeated open/close, StrictMode setup/cleanup, rapid competing opens, and section changes do not duplicate viewers/listeners, leak stale selection/location state, or accept stale async results.
Evidence: Focused lifecycle tests, listener/viewer counts from browser instrumentation, rapid-open delay-injection trace, repeated-open memory/resource observations, and stale-selection checks after navigation.
