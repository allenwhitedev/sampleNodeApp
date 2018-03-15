const express = require('express')
const app = express()
const MongoClient = require('mongodb').MongoClient
const config = require('./.config.js')

// node/express/mongo initialization
let PORT = 8002
if ( process.env.PORT )
	PORT = process.env.PORT
app.listen(PORT, () => console.log(`Node app listening on port ${ PORT }`) )

const mongoUrl = config.mongoUrl 
const databaseName = config.databaseName 

let globalDatabase = null // database is property of databases returned from MongoClient.connect() if using mongo v>3.4
MongoClient.connect(mongoUrl, (err, databases) =>
{
	if (err) 
		throw err
	else
		globalDatabase = databases.db(databaseName)
})


app.get('/', (req, res) =>
{
	res.send({error: null, message: `Success! from / route of sampleNodeApp on port ${ PORT }`})
})

app.get('/test', (req, res) =>
{
	res.send({error: null, message: `Success! from /test route of sampleNodeApp on port ${ PORT }`})
})

app.get('/tests', (req, res) =>
{
	globalDatabase.collection('tests').find().toArray( (err, result) =>
	{
		if ( err ) throw err

		res.send(result)
	} )
})