import { useMemo, useState } from 'react'

import type { BookCatalogEntry } from './domain/index.ts'
import './library/library.css'
import { LibraryScreen } from './library/LibraryScreen.tsx'
import { useLibrary } from './library/useLibrary.ts'
import { createAppRuntime } from './app/runtime.ts'

function App() {
  const runtime = useMemo(() => createAppRuntime(), [])
  const library = useLibrary({ client: runtime.client, ports: runtime.ports })
  const [, setOpenBook] = useState<BookCatalogEntry>()

  return (
    <LibraryScreen
      {...library}
      onOpenBook={setOpenBook}
      onImportFile={(file) => void library.importFile(file)}
      onRetry={() => void library.retry()}
      onDismissNotice={library.dismissNotice}
    />
  )
}

export default App
