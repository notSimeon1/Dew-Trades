import { createRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start/client'
import { getRouter } from './router'

const router = getRouter()

const root = createRoot(document.getElementById('root')!)

root.render(
  <StartClient router={router} />
)
