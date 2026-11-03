import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse, type NextRequest } from 'next/server'
import type { RowDataPacket } from 'mysql2/promise'
import { getAdminSession } from '@/lib/admin-auth'
import { rows } from '@/lib/db'

export const runtime = 'nodejs'

type ReceiptRow = RowDataPacket & {
  filename: string
  mime_type: string
  original_filename: string
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminSession()
  if (!admin || admin.role === 'check-in') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: rawID } = await params
  const id = Number(rawID)
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const receipts = await rows<ReceiptRow>(
    'SELECT p.filename, p.mime_type, p.original_filename FROM payment_receipts p JOIN registrations r ON r.receipt_id = p.id WHERE p.id = ? LIMIT 1',
    [id],
  )
  const receipt = receipts[0]
  if (!receipt || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(receipt.mime_type)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const filename = path.basename(receipt.filename)
  const filePath = path.join(process.cwd(), 'var', 'uploads', 'payment-receipts', filename)
  const content = await readFile(filePath).catch(() => null)
  if (!content) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return new NextResponse(content, {
    headers: {
      'Content-Type': receipt.mime_type,
      'Content-Disposition': `inline; filename="${receipt.original_filename.replace(/["\r\n]/g, '')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}