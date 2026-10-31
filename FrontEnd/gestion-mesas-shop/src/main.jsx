// Punto de entrada del navegador: monta React dentro del <div id='root'> de index.html.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// StrictMode ejecuta dos veces ciertas rutinas en desarrollo para detectar errores.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
