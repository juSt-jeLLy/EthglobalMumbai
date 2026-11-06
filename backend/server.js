// Routes
const express = require('express')
const cors = require('cors')
const { flashProxyCtrl } = require('./flash.js')
const { interceptaTokenCtrl, interceptaTransactionCtrl } = require('./intercepta.js')
const { getKickbackCtrl, rpContextCtrl, registerCtrl } = require('./kickbacks.js')
const app = express()
const port = process.env.PORT || 8000

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => res.send('Plan B backend OK'))
app.all('/flash/:endpoint', flashProxyCtrl)
app.get('/intercepta/token/:chainId/:address', interceptaTokenCtrl)
app.post('/intercepta/transaction/:chainId', interceptaTransactionCtrl)
app.post('/kickbacks/rp-context', rpContextCtrl)
app.post('/kickbacks/register', registerCtrl)
app.get('/kickbacks/:handle', getKickbackCtrl)

app.listen(port, () => {
  console.log(`Plan B backend listening on port ${port}`)
})
