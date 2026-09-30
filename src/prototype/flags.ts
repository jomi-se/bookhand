/**
 * The book artifacts prototype runs in development builds, or in a build made
 * with VITE_ARTIFACT_PROTOTYPE=1. `?proto=off` and `?proto=on` toggle it.
 */
export function prototypeEnabled(): boolean {
  if (!(import.meta.env.DEV || import.meta.env.VITE_ARTIFACT_PROTOTYPE === '1')) return false
  try {
    const flag = new URLSearchParams(window.location.search).get('proto')
    if (flag === 'off') localStorage.setItem('bookhand-proto-off', '1')
    if (flag === 'on') localStorage.removeItem('bookhand-proto-off')
    return localStorage.getItem('bookhand-proto-off') !== '1'
  } catch {
    return true
  }
}
