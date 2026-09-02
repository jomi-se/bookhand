import { useCallback, useMemo, useState } from 'react'

import type { BookCatalogEntry } from './domain/index.ts'
import './library/library.css'
import './reader/reader.css'
import './study/study.css'
import { LibraryScreen } from './library/LibraryScreen.tsx'
import { useLibrary } from './library/useLibrary.ts'
import { ReaderScreen } from './reader/ReaderScreen.tsx'
import { createAppRuntime } from './app/runtime.ts'
import type { BookhandCommands } from './app/commands.ts'
import {
  readCoarsePointer,
  readViewportClass,
  summarizePresentation,
} from './webmcp/design-context.ts'
import { createDesignContextTool } from './webmcp/design-context-tool.ts'
import { createLibraryTools } from './webmcp/library-tools.ts'
import { createBookhandTools } from './webmcp/tools.ts'
import { useWebMcpTools, type ToolCallReporter } from './webmcp/useWebMcpTools.ts'

/**
 * The tools whose calls change how something looks. `get_design_context`
 * reports these so an agent knows what is actually reachable right now rather
 * than inferring it from the surface it happens to be on.
 */
const DESIGN_BEARING_TOOLS = new Set([
  'set_reading_style',
  'upsert_study_item',
  'set_study_board_view',
])

/** The style is unavailable rather than invented while a book is still opening. */
function safeReadingStyle(commands: BookhandCommands) {
  try {
    return commands.getReadingStyle()
  } catch {
    return undefined
  }
}

function App() {
  const runtime = useMemo(() => createAppRuntime(), [])
  const library = useLibrary({ client: runtime.client, ports: runtime.ports })
  const [reading, setReading] = useState<BookCatalogEntry>()
  const [readerCommands, setReaderCommands] = useState<BookhandCommands>()

  const books = library.books
  const diagnostics = library.diagnostics

  // The design context and library tools are offered from first load, so an
  // agent arriving at the library can see what is here, open something, and
  // find out how to compose inside it. A book's own tools join them once it is
  // open. The design context reads live state through the runtime store rather
  // than through props, so changing the text size does not re-register the
  // whole tool set.
  const designState = runtime.designState
  const createTools = useCallback(
    (report: ToolCallReporter) => {
      const bookTools = readerCommands
        ? createBookhandTools({ commands: readerCommands, onCall: report })
        : []
      const designBearing = bookTools
        .map((tool) => tool.name)
        .filter((name) => DESIGN_BEARING_TOOLS.has(name))
      return [
        createDesignContextTool({
          report,
          state: () => {
            const reader = designState.current
            // Read from the adapter, not from React: a tool call changes the
            // style without passing through React state, so React's copy can
            // be stale until W2 routes both paths through one command.
            const style = readerCommands ? safeReadingStyle(readerCommands) : undefined
            return {
              activeSurface: reader?.surface ?? 'library',
              viewport: readViewportClass(),
              coarsePointer: readCoarsePointer(),
              mutationTools: designBearing,
              ...(style ? { presentation: summarizePresentation(style) } : {}),
              ...(reader?.boardView ? { boardView: reader.boardView } : {}),
            }
          },
        }),
        ...createLibraryTools({
          books: () => books,
          diagnostics: () => diagnostics,
          openBook: setReading,
          report,
        }),
        ...bookTools,
      ]
    },
    [books, designState, diagnostics, readerCommands],
  )

  const agent = useWebMcpTools({ createTools })

  const exitReader = useCallback(() => {
    setReading(undefined)
    designState.clear()
    void library.refresh()
  }, [designState, library])

  if (reading) {
    return (
      <ReaderScreen
        entry={reading}
        client={runtime.client}
        ports={runtime.ports}
        bridge={runtime.reader}
        onExit={exitReader}
        onCommandsReady={setReaderCommands}
        designState={designState}
        agent={agent}
      />
    )
  }

  return (
    <LibraryScreen
      {...library}
      onOpenBook={setReading}
      onImportFile={(file) => void library.importFile(file)}
      onRetry={() => void library.retry()}
      onDismissNotice={library.dismissNotice}
      agentStatus={agent.status}
    />
  )
}

export default App
