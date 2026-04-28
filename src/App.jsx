import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import ToolLayout from './components/ToolLayout'
import Welcome from './components/Welcome'
import Settings from './components/Settings'
import UpdateNotification from './components/UpdateNotification'
import styles from './App.module.css'

// Phase 3 — File & image conversion
import ImageConverter from './tools/image-converter'
import ImageResizer from './tools/image-resizer'
import ImageCompressor from './tools/image-compressor'
import BackgroundRemover from './tools/background-remover'
import WatermarkTool from './tools/watermark-tool'
import PdfMerger from './tools/pdf-merger'
import PdfSplitter from './tools/pdf-splitter'
import PdfCompressor from './tools/pdf-compressor'
import PdfEncryptor from './tools/pdf-encryptor'
import OcrReader from './tools/ocr-reader'
import DocConverter from './tools/doc-converter'
import SpreadsheetConverter from './tools/spreadsheet-converter'
import VideoConverter from './tools/video-converter'
import AudioConverter from './tools/audio-converter'
import ArchiveManager from './tools/archive-manager'
import QrBarcode from './tools/qr-barcode'
import MetadataRemover from './tools/metadata-remover'

// Phase 4 — Office productivity
import RichTextEditor from './tools/rich-text-editor'
import MarkdownEditor from './tools/markdown-editor'
import CsvEditor from './tools/csv-editor'
import JsonFormatter from './tools/json-formatter'
import DiffChecker from './tools/diff-checker'
import ChartBuilder from './tools/chart-builder'
import SqlRunner from './tools/sql-runner'
import KanbanBoard from './tools/kanban-board'
import PomodoroTimer from './tools/pomodoro-timer'
import GanttChart from './tools/gantt-chart'
import TimezoneConverter from './tools/timezone-converter'

// Phase 5 — Security & utilities
import PasswordGenerator from './tools/password-generator'
import FileEncryptor from './tools/file-encryptor'
import HashGenerator from './tools/hash-generator'
import UnitConverter from './tools/unit-converter'
import ColorConverter from './tools/color-converter'
import Base64Encoder from './tools/base64-encoder'
import RegexTester from './tools/regex-tester'
import WordCounter from './tools/word-counter'

export default function App() {
  return (
    <div className={styles.app}>
      <Sidebar />
      <main className={styles.main}>
        <UpdateNotification />
        <Routes>
          <Route path="/" element={<Welcome />} />

          {/* Phase 3 */}
          <Route path="/image-converter" element={<ToolLayout title="Image Converter"><ImageConverter /></ToolLayout>} />
          <Route path="/image-resizer" element={<ToolLayout title="Image Resizer"><ImageResizer /></ToolLayout>} />
          <Route path="/image-compressor" element={<ToolLayout title="Image Compressor"><ImageCompressor /></ToolLayout>} />
          <Route path="/background-remover" element={<ToolLayout title="Background Remover"><BackgroundRemover /></ToolLayout>} />
          <Route path="/watermark-tool" element={<ToolLayout title="Watermark Tool"><WatermarkTool /></ToolLayout>} />
          <Route path="/pdf-merger" element={<ToolLayout title="PDF Merger"><PdfMerger /></ToolLayout>} />
          <Route path="/pdf-splitter" element={<ToolLayout title="PDF Splitter"><PdfSplitter /></ToolLayout>} />
          <Route path="/pdf-compressor" element={<ToolLayout title="PDF Compressor"><PdfCompressor /></ToolLayout>} />
          <Route path="/pdf-encryptor" element={<ToolLayout title="PDF Encryptor"><PdfEncryptor /></ToolLayout>} />
          <Route path="/ocr-reader" element={<ToolLayout title="OCR Reader"><OcrReader /></ToolLayout>} />
          <Route path="/doc-converter" element={<ToolLayout title="Doc Converter"><DocConverter /></ToolLayout>} />
          <Route path="/spreadsheet-converter" element={<ToolLayout title="Spreadsheet Converter"><SpreadsheetConverter /></ToolLayout>} />
          <Route path="/video-converter" element={<ToolLayout title="Video Converter"><VideoConverter /></ToolLayout>} />
          <Route path="/audio-converter" element={<ToolLayout title="Audio Converter"><AudioConverter /></ToolLayout>} />
          <Route path="/archive-manager" element={<ToolLayout title="Archive Manager"><ArchiveManager /></ToolLayout>} />
          <Route path="/qr-barcode" element={<ToolLayout title="QR & Barcode"><QrBarcode /></ToolLayout>} />
          <Route path="/metadata-remover" element={<ToolLayout title="Metadata Remover"><MetadataRemover /></ToolLayout>} />

          {/* Phase 4 */}
          <Route path="/rich-text-editor" element={<ToolLayout title="Rich Text Editor"><RichTextEditor /></ToolLayout>} />
          <Route path="/markdown-editor" element={<ToolLayout title="Markdown Editor" fill><MarkdownEditor /></ToolLayout>} />
          <Route path="/csv-editor" element={<ToolLayout title="CSV Editor" fill><CsvEditor /></ToolLayout>} />
          <Route path="/json-formatter" element={<ToolLayout title="JSON Formatter" fill><JsonFormatter /></ToolLayout>} />
          <Route path="/diff-checker" element={<ToolLayout title="Diff Checker" fill><DiffChecker /></ToolLayout>} />
          <Route path="/chart-builder" element={<ToolLayout title="Chart Builder"><ChartBuilder /></ToolLayout>} />
          <Route path="/sql-runner" element={<ToolLayout title="SQL Runner" fill><SqlRunner /></ToolLayout>} />
          <Route path="/kanban-board" element={<ToolLayout title="Kanban Board"><KanbanBoard /></ToolLayout>} />
          <Route path="/pomodoro-timer" element={<ToolLayout title="Pomodoro Timer"><PomodoroTimer /></ToolLayout>} />
          <Route path="/gantt-chart" element={<ToolLayout title="Gantt Chart"><GanttChart /></ToolLayout>} />
          <Route path="/timezone-converter" element={<ToolLayout title="Timezone Converter"><TimezoneConverter /></ToolLayout>} />

          {/* Phase 5 */}
          <Route path="/password-generator" element={<ToolLayout title="Password Generator"><PasswordGenerator /></ToolLayout>} />
          <Route path="/file-encryptor" element={<ToolLayout title="File Encryptor"><FileEncryptor /></ToolLayout>} />
          <Route path="/hash-generator" element={<ToolLayout title="Hash Generator"><HashGenerator /></ToolLayout>} />
          <Route path="/unit-converter" element={<ToolLayout title="Unit Converter"><UnitConverter /></ToolLayout>} />
          <Route path="/color-converter" element={<ToolLayout title="Color Converter"><ColorConverter /></ToolLayout>} />
          <Route path="/base64-encoder" element={<ToolLayout title="Base64 Encoder"><Base64Encoder /></ToolLayout>} />
          <Route path="/regex-tester" element={<ToolLayout title="Regex Tester"><RegexTester /></ToolLayout>} />
          <Route path="/word-counter" element={<ToolLayout title="Word Counter"><WordCounter /></ToolLayout>} />

          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
