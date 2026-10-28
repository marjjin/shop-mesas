export const navigationGroups = [
  { label: 'Operación', items: [
    { section: 'salon', label: 'Plano de mesas', icon: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z' },
    { section: 'pending', label: 'Pedidos', icon: 'M9 4H5v17h14V4h-4 M9 2h6v4H9z M8 11h8 M8 16h5' },
  ] },
  { label: 'Cajas y stock', items: [
    { section: 'catalog', label: 'Artículos', icon: 'M3 3h8l10 10-8 8L3 11z M7 7h.01' },
    { section: 'cafeteria', label: 'Caja Cafetería', icon: 'M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z M16 8h2a3 3 0 0 1 0 6h-2 M3 22h16 M8 2v2 M12 2v2' },
    { section: 'cigarettes', label: 'Cigarrillos', icon: 'M3 8l9-5 9 5v10l-9 5-9-5z M3 8l9 5 9-5 M12 13v10 M8 5l9 5' },
    { section: 'suppliers', label: 'Proveedores', icon: 'M3 5h12v12H3z M15 9h4l3 4v4h-7 M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M18 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4' },
    { section: 'cash-drops', label: 'Tiradas', icon: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5' },
  ] },
  { label: 'Cierres y control', items: [
    { section: 'shift-close', label: 'Cierre de turno', icon: 'M9 4H5v17h14V4h-4 M9 2h6v4H9z M8 13l3 3 5-6' },
    { section: 'history', label: 'Historial de mesas', icon: 'M3 11a9 9 0 1 1 2 7 M3 4v7h7 M12 7v5l3 2' },
  ] },
  { label: 'Sistema', items: [
    { section: 'settings', label: 'Configuraciones', icon: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6' },
  ] },
]

export const sectionLabels = Object.fromEntries(navigationGroups.flatMap((group) => group.items.map((item) => [item.section, item.label])))
