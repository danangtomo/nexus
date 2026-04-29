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

import styles from './SegmentedControl.module.css'

/**
 * Apple HIG Segmented Control
 * props: options=[{value, label, icon?}], value, onChange, size='md'|'sm'
 */
export default function SegmentedControl({ options, value, onChange, size = 'md' }) {
  return (
    <div className={`${styles.control} ${styles[size]}`} role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`${styles.segment} ${value === opt.value ? styles.selected : ''}`}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
        >
          {opt.icon && <span className={styles.icon}>{opt.icon}</span>}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  )
}
