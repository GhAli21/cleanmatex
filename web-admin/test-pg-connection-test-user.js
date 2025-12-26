// Test with cmx_test user
const { Client } = require('pg')

const connectionString = 'postgresql://cmx_test:testpass123@127.0.0.1:5432/cmx_db'

console.log('Testing with cmx_test user...')

const client = new Client({ connectionString })

client.connect((err) => {
  if (err) {
    console.error('❌ Failed:', err.message)
    process.exit(1)
  }

  console.log('✅ Connected!')
  client.query('SELECT current_user', (err, res) => {
    if (err) console.error('Query error:', err.message)
    else console.log('Current user:', res.rows[0].current_user)
    client.end()
  })
})
