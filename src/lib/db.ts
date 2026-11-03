import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise'

const globalForDatabase = globalThis as typeof globalThis & {
  parallaxDatabase?: Pool
}

export const database =
  globalForDatabase.parallaxDatabase ??
  mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'parallax',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    dateStrings: true,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDatabase.parallaxDatabase = database
}

export async function rows<T extends RowDataPacket>(sql: string, values: unknown[] = []) {
  const [result] = await database.query<T[]>(sql, values)
  return result
}