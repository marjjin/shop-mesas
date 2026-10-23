// Apply the saved appearance before the page paints, including on static hosting.
;(function () {
  let preference = 'system'
  try {
    const saved = localStorage.getItem('mesa-theme')
    if (['light', 'dark', 'system'].includes(saved)) preference = saved
  } catch { /* Appearance still works when browser storage is unavailable. */ }
  const theme = preference === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : preference
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
})()
