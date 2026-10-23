export const welcomeMessageDefaults = Object.freeze({
  businessName: 'SHOP FAMILY',
  greetingText: 'Hola {nombre}, bienvenido/a a Shop Family.',
  messageText: 'Ya registramos tu pedido.',
  conditionsText: 'Tu tiempo de mesa es de 1 hora.\n\nPasado ese tiempo podrás renovar tu pedido o solo abonar el servicio de mesa sin consumición.',
  minimumLabel: 'Costo mínimo de consumo',
  footerText: '¡Gracias por elegirnos!',
})

export const welcomeTextFields = [
  { key: 'businessName', label: 'Encabezado', maxLength: 100, required: true, help: 'Título que aparece en la parte superior del ticket.' },
  { key: 'greetingText', label: 'Bienvenida', maxLength: 300, required: true, rows: 2, help: 'Primera frase del mensaje. Usá {nombre} para incluir al cliente.' },
  { key: 'messageText', label: 'Mensaje principal', maxLength: 500, rows: 2, help: 'Texto debajo de la bienvenida. Dejalo vacío para ocultarlo.' },
  { key: 'conditionsText', label: 'Información adicional', maxLength: 1500, rows: 5, help: 'Detalles que quieras comunicar. Podés usar saltos de línea o dejarlo vacío.' },
  { key: 'minimumLabel', label: 'Descripción del importe', maxLength: 100, required: true, help: 'Frase que acompaña al valor en pesos.' },
  { key: 'footerText', label: 'Mensaje final', maxLength: 300, rows: 2, help: 'Texto al pie del ticket. Dejalo vacío para ocultarlo.' },
]

export function welcomeMessageContent(settings, customerName) {
  const content = Object.fromEntries(welcomeTextFields.map(({ key }) => [key, settings?.[key] ?? welcomeMessageDefaults[key]]))
  return { ...content, greetingText: content.greetingText.replaceAll('{nombre}', () => customerName) }
}

export function requireWelcomeMessageSettings(settings) {
  if (!settings || !Number.isFinite(settings.amount) || welcomeTextFields.some(({ key }) => typeof settings[key] !== 'string'))
    throw new Error('La API necesita actualizarse para editar los textos del ticket. Reiniciá el backend actualizado o desplegá su nueva versión.')
  return settings
}
