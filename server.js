const express = require('express')
const app = express()

let PORT = 8002
if ( process.env.PORT )
	PORT = process.env.PORT

app.listen(PORT, () => console.log(`Node app listening on port ${ PORT }`) )

app.get('/', (req, res) =>
{
	res.send({error: null, message: `Success! from / route of sampleNodeApp on port ${ PORT }`})
})

app.get('/test', (req, res) =>
{
	res.send({error: null, message: `Success! from /test route of sampleNodeApp on port ${ PORT }`})
})