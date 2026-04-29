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

import styles from './Toggle.module.css'

/** Apple HIG Toggle (pill switch) */
export default function Toggle({ checked, onChange, disabled, label, id }) {
  const uid = id || `toggle-${Math.random().toString(36).slice(2)}`
  return (
    <label className={`${styles.wrapper} ${disabled ? styles.disabled : ''}`} htmlFor={uid}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={`${styles.track} ${checked ? styles.on : ''}`}>
        <div className={styles.thumb} />
        <input
          id={uid}
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          className={styles.input}
        />
      </div>
    </label>
  )
}
