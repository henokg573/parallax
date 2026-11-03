import { NextResponse, type NextRequest } from 'next/server'
import type { RowDataPacket } from 'mysql2/promise'
import { getAdminSession } from '@/lib/admin-auth'
import { rows } from '@/lib/db'
import { downloadStorageFile, PRIVATE_RECEIPTS_BUCKET } from '@/lib/storage'

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

  const receipts = await rows<ReceiptRow>('payment_receipts', {
    select: 'filename, mime_type, original_filename',
    eq: { id },
    limit: 1,
  })
  const receipt = receipts[0]
  if (!receipt || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(receipt.mime_type)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const content = await downloadStorageFile(PRIVATE_RECEIPTS_BUCKET, receipt.filename)
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