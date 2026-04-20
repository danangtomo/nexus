import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext()

const systemMQ = window.matchMedia('(prefers-color-scheme: dark)')

function applyTheme(preference) {
  const isDark =
    preference === 'dark' ? true :
    preference === 'light' ? false :
    systemMQ.matches  // 'system'
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('system')

  // Load saved preference on mount
  useEffect(() => {
    window.nexus.getPref('theme').then((saved) => {
      const t = saved || 'system'
      setTheme(t)
      applyTheme(t)
    })
  }, [])

  // Re-apply whenever theme changes
  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const handler = () => applyTheme('system')
    systemMQ.addEventListener('change', handler)
    return () => systemMQ.removeEventListener('change', handler)
  }, [theme])

  const changeTheme = async (next) => {
    setTheme(next)
    applyTheme(next)
    await window.nexus.setPref('theme', next)
  }

  return (
    <ThemeContext.Provider value={{ theme, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
