/**
 * Nexus - Offline productivity suite
 * Copyright (C) 2026 Danang Estutomoaji
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

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
