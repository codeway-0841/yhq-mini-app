import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Russian textbook entry route', () => {
  it('opens the course map at the real textbook URL and redirects the preview URL', () => {
    const app = fs.readFileSync(path.resolve(__dirname, '../../../src/App.tsx'), 'utf8')

    expect(app).toContain('<Route path="/darslik/rus-tili" element={<CourseMapPage />} />')
    expect(app).toContain('<Route path="/darslik/xarita" element={<Navigate to="/darslik/rus-tili" replace />} />')
    expect(app).not.toContain('<Route path="/darslik/rus-tili" element={<RussianDarslikPage />} />')
  })
})
