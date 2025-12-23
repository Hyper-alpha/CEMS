require('dotenv').config();
const mysql = require('mysql2/promise');

(async function() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cems_database',
    waitForConnections: true,
    connectionLimit: 2
  });

  try {
    console.log('Shifting existing events to future dates (event_date = CURDATE() + id*7 days)...');
    // Use a safe update: calculate new date based on id to avoid collisions
    await pool.execute("UPDATE events SET event_date = DATE_ADD(CURDATE(), INTERVAL id*7 DAY)");

    const [rows] = await pool.execute("SELECT id, title, DATE_FORMAT(event_date, '%Y-%m-%d') as event_date, status FROM events ORDER BY id");
    console.log('Events after shift:');
    console.table(rows);
  } catch (err) {
    console.error('DB ERR:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
