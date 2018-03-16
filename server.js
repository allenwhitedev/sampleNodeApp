const express = require('express')
const app = express()
app.use(express.json()) // allows JSON-encoded bodies (req.body - can be used for more complex post operations)
app.use(express.urlencoded({ extended: true })) // allows URL-encoded bodies from post/patch, etc. (req.body, also note form-data is allowed but not handled in express routes)
const MongoClient = require('mongodb').MongoClient
const config = require('./.config.js')
const bcrypt = require('bcrypt')

// node/express/mongo initialization
let PORT = 8002
if ( process.env.PORT )
	PORT = process.env.PORT
app.listen(PORT, () => console.log(`Node app listening on port ${ PORT }`) )

// declare imported config variables 
const mongoUrl = config.mongoUrl 
const databaseName = config.databaseName 
const saltRounds = config.saltRounds

let globalDatabase = null // database is property of databases returned from MongoClient.connect() if using mongo v>3.4
MongoClient.connect(mongoUrl, (err, databases) =>
{
	if (err) 
		throw err
	else
		globalDatabase = databases.db(databaseName) // globalDatabse variable is used by express routes to interact with the mongo database
})

// express routes
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
		if ( err ) console.log(err)

		res.send(result)
	} )
})

app.post('/signup', (req, res) =>
{
	if ( req.body && req.body.username && req.body.password )
	{
		bcrypt.hash( req.body.password, saltRounds, (err, hash) => // hash user's password before storing in db
		{
			globalDatabase.collection('users').insertOne({ username: req.body.username, password: hash, createdAt: Date.now() }, (err, result) =>
			{
				if (err) 
				{
					console.log(err) // move to error logging when implemented 
					res.send({error: `Error: Database error, could not create user '${req.body.username}' `, result})
				}
				else
					res.send({ message: `Success! Created user '${req.body.username}'`, result }) // successfully create user
			})
		})
	}
	else
		res.send({error: true, message: `Error: /signup requires a body with valid fields: 'username', 'password' `})
})
