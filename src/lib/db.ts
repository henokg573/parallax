// src/lib/database.ts (or wherever this file lives)
//
// Drop-in replacement for the old MySQL helper.
// Exposes `rows()` so existing call sites keep working,
// but backed by Supabase (PostgreSQL).

import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export const database = null // kept only so old imports don't break

/**
 * Old MySQL signature: rows("SELECT ...", [values])
 * New signature (Supabase): rows('table_name', { select: '...', eq: { col: val } })
 *
 * Because the SQL string API is completely different, you must update
 * every call site anyway. Below is the helper you should migrate to.
 */
export async function rows<T = any>(
  table: string,
  options?: {
    select?: string
    eq?: Record<string, unknown>
    in?: Record<string, unknown[]>
    gte?: Record<string, unknown>
    notNull?: string[]
    order?: { column: string; ascending?: boolean }
    limit?: number
  }
): Promise<T[]> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  let query = supabase.from(table).select(options?.select ?? '*')

  if (options?.eq) {
    for (const [col, val] of Object.entries(options.eq)) {
      query = query.eq(col, val)
    }
  }

  if (options?.in) {
    for (const [col, values] of Object.entries(options.in)) {
      query = query.in(col, values)
    }
  }

  if (options?.gte) {
    for (const [col, val] of Object.entries(options.gte)) {
      query = query.gte(col, val)
    }
  }

  if (options?.notNull) {
    for (const col of options.notNull) {
      query = query.not(col, 'is', null)
    }
  }

  if (options?.order) {
    query = query.order(options.order.column, {
      ascending: options.order.ascending ?? true,
    })
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as T[]
}

export async function update(
  table: string,
  values: Record<string, unknown>,
  eq: Record<string, unknown>,
) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  let query = supabase.from(table).update(values)

  for (const [col, val] of Object.entries(eq)) {
    query = query.eq(col, val)
  }

  const { error } = await query
  if (error) throw new Error(error.message)
}