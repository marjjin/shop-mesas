// Comportamiento global de los campos numéricos.
export function setupNumberInputs(root = document) {
  // La ruedita del mouse no cambia el importe: se quita el foco y la página sigue desplazándose.
  root.addEventListener('wheel', (event) => {
    const input = event.target
    if (input instanceof HTMLInputElement && input.type === 'number' && input === document.activeElement) input.blur()
  }, { passive: true })
  // Al entrar al campo se selecciona su contenido (por ejemplo un 0), así lo reemplaza lo que se escribe.
  root.addEventListener('focusin', (event) => {
    const input = event.target
    if (input instanceof HTMLInputElement && input.type === 'number' && input.value !== '') input.select()
  })
}
