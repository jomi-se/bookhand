import { useCallback, useMemo, useState } from 'react'

import type { BookCatalogEntry } from './domain/index.ts'
import './library/library.css'
import './reader/reader.css'
import './study/study.css'
import { LibraryScreen } from './library/LibraryScreen.tsx'
import { useLibrary } from './library/useLibrary.ts'
import { ReaderScreen } from './reader/ReaderScreen.tsx'
import { createAppRuntime } from './app/runtime.ts'

function App() {
  const runtime = useMemo(() => createAppRuntime(), [])
  const library = useLibrary({ client: runtime.client, ports: runtime.ports })
  const [reading, setReading] = useState<BookCatalogEntry>()

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
    />
  )
}

export default App
