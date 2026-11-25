import './app/csp-runtime.ts'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/source-serif-4/wght.css'
import './index.css'
import App from './App.tsx'
import { isPairingPopup } from './ai/pending-intent.ts'

if (isPairingPopup) window.close()
else createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
