import { readFile } from 'node:fs/promises'
import { createConnection } from 'mysql2/promise'

const connection = await createConnection({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  multipleStatements: true,
})

try {
  const schema = await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8')
  await connection.query(schema)

  for (const table of ['experiences', 'stories', 'social_posts']) {
    const [columns] = await connection.query(
      'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [table, 'video_id'],
    )
    if (columns.length === 0) {
      await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN video_id BIGINT UNSIGNED NULL`)
    }

    const constraint = `${table}_video_fk`
    const [constraints] = await connection.query(
      'SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?',
      [table, constraint],
    )
    if (constraints.length === 0) {
      await connection.query(
        `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${constraint}\` FOREIGN KEY (video_id) REFERENCES media (id) ON DELETE SET NULL`,
      )
    }

    const [statusColumn] = await connection.query(
      'SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? AND COLUMN_TYPE NOT LIKE ?',
      [table, 'status', "%'archived'%"],
    )
    if (statusColumn.length > 0) {
      await connection.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft'`,
      )
    }
  }

  console.log('MariaDB database and Parallax tables are ready.')
} finally {
  await connection.end()
}