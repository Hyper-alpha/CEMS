require('dotenv').config();
const mysql = require('mysql2/promise');

(async function(){
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cems_database',
    waitForConnections: true,
    connectionLimit: 2
  });

  try {
    const [all] = await pool.execute("SELECT id, title, event_date, status, start_time, end_time, venue_id FROM events ORDER BY event_date DESC LIMIT 100");
    console.log('ALL_EVENTS_COUNT:', all.length);
    console.log(all);

    const [approved] = await pool.execute("SELECT id, title, event_date, status, start_time, end_time, venue_id FROM events WHERE status='approved' AND event_date>=CURDATE() ORDER BY event_date ASC LIMIT 100");
    console.log('APPROVED_FUTURE_COUNT:', approved.length);
    console.log(approved);

  } catch (err) {
    console.error('DB ERR:', err);
  } finally {
    await pool.end();
  }
})();
