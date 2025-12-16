// Simple PostgreSQL connection test
const { Client } = require('pg')

//const connectionString = 'postgresql://cmx_user:cmx_pass_dev@postgres:5432/cmx_db'
//const connectionString ='postgresql://cmx_user:cmx_pass_dev@localhost:5432/cmx_db'
//const connectionString = 'postgresql://cmx_user:cmx_pass_dev@localhost:5432/cmx_db'
const connectionString = 'postgresql://cmx_user:cmx_pass_dev@127.0.0.1:5432/cmx_db'

console.log('Testing PostgreSQL connection...')
console.log('Connection string:', connectionString.replace(/:[^:@]+@/, ':****@'))

const client = new Client({ connectionString })

client.connect((err) => {
  if (err) {
    console.error('❌ Connection failed!')
    console.error('Error:', err.message)
    console.error('Code:', err.code)
    process.exit(1)
  }

  console.log('✅ Connected successfully!')

  client.query('SELECT version()', (err, res) => {
    if (err) {
      console.error('❌ Query failed:', err.message)
    } else {
      console.log('✅ Query successful!')
      console.log('PostgreSQL version:', res.rows[0].version)
    }

    client.end()
  })
})
