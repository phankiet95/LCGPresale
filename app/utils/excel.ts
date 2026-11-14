import type { MetaResponse, OppItem } from '#shared/types'
import { EXCEL_COLUMNS, EXCEL_SHEET, type ImportRow } from '#shared/excel-columns'

// exceljs is ~1 MB: loaded only when someone exports or imports.
const loadExcel = async () => (await import('exceljs')).default

const PRIMARY = 'FF1E4FC2'
const GREY = 'FF8A93A1'

function cellValue(o: OppItem, key: string): string | number | Date | null {
  const d = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`) : null)
  switch (key) {
    case 'market': return o.marketCode
    case 'salesOwner': return o.salesOwner
    case 'actionOwner': return o.actionOwner
    case 'expectedCloseDate': return d(o.expectedCloseDate)
    case 'dueDate': return d(o.dueDate)
    case 'latestUpdateDate': return d(o.latestUpdateDate)
    case 'activityType':
    case 'activityContent': return null
    default: {
      const v = (o as unknown as Record<string, unknown>)[key]
      return v === undefined || v === null ? null : (v as string | number)
    }
  }
}

/** Export the given opps to an .xlsx that can be edited and imported back. */
export async function exportOppsToExcel(items: OppItem[], meta: MetaResponse | null | undefined, fileName: string) {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'LCG Opportunity Management'
  wb.created = new Date()

  const ws = wb.addWorksheet(EXCEL_SHEET, { views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }] })
  ws.columns = EXCEL_COLUMNS.map(c => ({ key: c.key, width: c.width }))
  const head = ws.getRow(1)
  EXCEL_COLUMNS.forEach((c, i) => {
    const cell = head.getCell(i + 1)
    cell.value = c.required ? `${c.header} *` : c.header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.ro ? GREY : PRIMARY } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.note = [c.ro ? 'Read-only: ignored on import.' : '', c.note ?? ''].filter(Boolean).join('\n') || undefined as unknown as string
  })
  head.height = 32

  for (const o of items) {
    const r = ws.addRow(EXCEL_COLUMNS.map(c => cellValue(o, c.key)))
    EXCEL_COLUMNS.forEach((c, i) => {
      const cell = r.getCell(i + 1)
      if (c.kind === 'date') cell.numFmt = 'yyyy-mm-dd'
      if (c.key === 'amount' || c.key === 'amountUsd') cell.numFmt = '#,##0.##'
      if (c.kind === 'longtext') cell.alignment = { wrapText: true, vertical: 'top' }
      if (c.ro) cell.font = { color: { argb: 'FF5B6472' } }
    })
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: EXCEL_COLUMNS.length } }

  // Drop-down lists, kept on a hidden sheet (list literals are limited to 255 characters)
  const lists: Record<string, string[]> = {
    market: (meta?.allMarkets ?? meta?.markets ?? []).map(m => m.code),
    partner: (meta?.partners ?? []).map(p => p.name),
    dealType: meta?.lookups.deal_type ?? [],
    priority: meta?.lookups.priority ?? [],
    currency: meta?.currencies ?? ['USD'],
    stage: ['O', 'D', 'C', 'B', 'A'],
    activityType: meta?.lookups.activity_type ?? [],
  }
  const ls = wb.addWorksheet('Lists', { state: 'hidden' })
  Object.entries(lists).forEach(([key, values], i) => {
    const col = i + 1
    ls.getCell(1, col).value = key
    values.forEach((v, j) => (ls.getCell(j + 2, col).value = v))
    const colIdx = EXCEL_COLUMNS.findIndex(c => c.key === key) + 1
    if (!colIdx || !values.length) return
    const letter = ls.getColumn(col).letter
    const range = `Lists!$${letter}$2:$${letter}$${values.length + 1}`
    const target = ws.getColumn(colIdx).letter
    // validation for the existing rows + 300 blank rows for new opps
    for (let row = 2; row <= items.length + 301; row++) {
      ws.getCell(`${target}${row}`).dataValidation = { type: 'list', allowBlank: true, formulae: [range], showErrorMessage: false }
    }
  })

  const help = wb.addWorksheet('How to import')
  help.columns = [{ width: 110 }]
  ;[
    'How to update opportunities with this file',
    '',
    '1. Edit the cells in the "Opportunities" sheet. Blue headers can be edited; grey headers are read-only and ignored on import.',
    '2. To change an opportunity, keep its OPP code. Only cells that differ from the app are applied.',
    '3. To add a new opportunity, fill a new row and leave "OPP code" empty (Customer, Market, Partner, Deal type and Expected close are required).',
    '4. To log what happened, fill "New activity" (and optionally its type): it is saved as an activity dated on the import day and refreshes the health.',
    '5. Stage can be moved between O, D, C, B and A. Won / Lost / On hold / Reopen are done with the buttons in the app.',
    '6. People are FPT accounts (e.g. SonTV16). An unknown account is created as an inactive user.',
    '7. In the app: Pipeline → Import Excel → choose the file. You see a preview of every change before anything is saved. Nothing is ever deleted by an import.',
  ].forEach((t, i) => {
    const c = help.getCell(i + 1, 1)
    c.value = t
    c.alignment = { wrapText: true }
    if (i === 0) c.font = { bold: true, size: 14 }
  })

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

/** Read an exported (and edited) workbook back into rows for /api/opportunities/import. */
export async function readOppsExcel(file: File): Promise<ImportRow[]> {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.getWorksheet(EXCEL_SHEET) ?? wb.worksheets[0]
  if (!ws) throw new Error('The file has no worksheet')

  const byHeader = new Map(EXCEL_COLUMNS.map(c => [c.header.toLowerCase(), c]))
  const colKey = new Map<number, (typeof EXCEL_COLUMNS)[number]>()
  ws.getRow(1).eachCell((cell, col) => {
    const h = String(cell.text ?? '').replace(/\s*\*\s*$/, '').trim().toLowerCase()
      .replace(/^vi owner \(account\)$/, 'vi owner') // older exports
    const c = byHeader.get(h)
    if (c) colKey.set(col, c)
  })
  if (![...colKey.values()].some(c => c.key === 'oppCode') || ![...colKey.values()].some(c => c.key === 'name')) {
    throw new Error('This is not an exported Pipeline file: the "OPP code" and "Opportunity name" columns were not found in row 1.')
  }

  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const rows: ImportRow[] = []
  ws.eachRow({ includeEmpty: false }, (row, rowNo) => {
    if (rowNo === 1) return
    const out: ImportRow = { row: rowNo }
    colKey.forEach((c, col) => {
      if (c.ro && c.key !== 'oppCode') return
      const cell = row.getCell(col)
      let v: unknown = cell.value
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        const o = v as { result?: unknown, richText?: { text: string }[], text?: string }
        v = o.result ?? (o.richText ? o.richText.map(t => t.text).join('') : o.text ?? cell.text)
      }
      if (c.kind === 'date') {
        if (v instanceof Date) v = iso(v)
        else if (typeof v === 'number') v = iso(new Date(Math.round((v - 25569) * 864e5)))
        else if (typeof v === 'string') {
          const m = v.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
          v = m ? `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}` : v.trim()
        }
      }
      else if ((c.kind === 'number' || c.kind === 'percent') && typeof v === 'string' && v.trim() !== '') {
        const x = Number(v.replace(/[,\s%]/g, ''))
        v = Number.isFinite(x) ? x : v
      }
      out[c.key] = v === undefined || v === '' ? null : (v as string | number | null)
    })
    rows.push(out)
  })
  return rows
}
