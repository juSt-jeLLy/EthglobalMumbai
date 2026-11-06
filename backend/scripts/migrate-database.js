require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const { initDatabase, closeDatabase } = require('../database.js')

initDatabase()
  .then(() => console.log('Plan B PostgreSQL migrations are current.'))
  .finally(() => closeDatabase())
  .catch((error) => { console.error(error.message); process.exitCode = 1 })
