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
import { createLibraryTools } from './webmcp/library-tools.ts'
import { createBookhandTools } from './webmcp/tools.ts'
import { useWebMcpTools, type ToolCallReporter } from './webmcp/useWebMcpTools.ts'

function App() {
  const runtime = useMemo(() => createAppRuntime(), [])
  const library = useLibrary({ client: runtime.client, ports: runtime.ports })
  const [reading, setReading] = useState<BookCatalogEntry>()
  const [readerCommands, setReaderCommands] = useState<BookhandCommands>()

  const books = library.books
  const diagnostics = library.diagnostics

  // Library tools are offered from first load, so an agent arriving at the
  // library can see what is here and open something. A book's own tools join
  // them once it is open.
  const createTools = useCallback(
    (report: ToolCallReporter) => [
      ...createLibraryTools({
        books: () => books,
        diagnostics: () => diagnostics,
        openBook: setReading,
        report,
      }),
      ...(readerCommands
        ? createBookhandTools({ commands: readerCommands, onCall: report })
        : []),
    ],
    [books, diagnostics, readerCommands],
  )

  const agent = useWebMcpTools({ createTools })

  const exitReader = useCallback(() => {
    setReading(undefined)
    void library.refresh()
  }, [library])

  if (reading) {
    return (
      <ReaderScreen
        entry={reading}
        client={runtime.client}
        ports={runtime.ports}
        bridge={runtime.reader}
        onExit={exitReader}
        onCommandsReady={setReaderCommands}
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
