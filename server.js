const express = require('express')
const app = express()
app.use(express.json()) // allows JSON-encoded bodies (req.body - can be used for more complex post operations)
app.use(express.urlencoded({ extended: true })) // allows URL-encoded bodies from post/patch, etc. (req.body, also note form-data is allowed but not handled in express routes)
const MongoClient = require('mongodb').MongoClient
const ObjectId = require('mongodb').ObjectId // used for automatic _id field generated in each mongo document
const config = require('./.config.js')
const bcrypt = require('bcrypt')
const uuidv1 = require('uuid/v1') // use uuid for unique session ids
app.use( authenticateUser ) // called before each route app.use()

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

// user authentication (runs prior to any route requiring authentication)
function authenticateUser(req, res, next) // app.use() does not allow arrow function syntax
{
	if ( req.path === '/' || req.path === '/test' || (req.path === '/tests' && !req.query.requiresAuthentication) || req.path === '/signup' || req.path === '/login') // authentication whitelist - do not authenticate for these routes
		return next() 
	else
		verifySession(req.headers.session) 

	function verifySession(session)
	{
		let sessionId = parseValueFromCookieString('sessionId', session)
		let userId = parseValueFromCookieString('userId', session)
		let sessionVerification = false // session must exist, have a valid id, and not be expired to allow authentication 

		if ( !ObjectId.isValid( userId ) ) // verify userId is of valid format for ObjectId, otherwise ugly 500 error will be returned to client
		 return res.status(403).send({error: true, message: `Error: Could not authenticate user with invalid userId format ('${userId}') and sessionId '${sessionId}' `}) 

		globalDatabase.collection('users').findOne({_id: ObjectId(userId), 'session.sessionId': sessionId }, (error, result) => 
		{
			if ( error || !result )
				res.status(403).send({error: true, message: `Error: Could not authenticate user with userId '${userId}' and sessionId '${sessionId}' `})
			else
			{
				if ( Date.now() > result.session.expiresAt ) // session was valid, but is now expired. user most log back in
					res.status(401).send({error: true, message: 'Error: Your session has expired due to inactivity. Please log back in.'})
				else	
				{
					// refresh session expiration to last an hour from now (date of last backend operation)
					let now = new Date()
					let expiresAt = now.setHours( now.getHours() + 1 )  // session expires in 1 hour 
					globalDatabase.collection('users').update( {_id: ObjectId(userId), 'session.sessionId': sessionId}, {$set: { 'session.expiresAt': expiresAt } }, (error, updateExpirationResult) =>
					{
						if (error)
							console.log(`Error refreshing session for userId '${userId}' using sessionId '${sessionId}' `) // move to error logging when implemented 
					})

					next() // authentication successful, move on to route
				}
			}
		})
	}	

}

function parseValueFromCookieString(key, wholeString)
{
	let keyPortionOfString = RegExp("" + key + "[^;]+").exec(wholeString) // get key followed by anything other than semicolon
	return decodeURIComponent(!!keyPortionOfString ? keyPortionOfString.toString().replace(/^[^=]+./, '') : '') // return everything after equal sign, otherwise return empty string
}


// express routes
app.get('/', (req, res) =>
{
	res.send({error: null, message: `Success! from / route of sampleNodeApp on port ${ PORT }`})
})

// test routes
app.get('/test', (req, res) =>
{
	res.send({error: null, message: `Success! from /test route of sampleNodeApp on port ${ PORT }`})
})

app.get('/tests', (req, res) => // does not require authentication unless querystring includes requiresAuthentication=true
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
	else
		res.send({error: true, message: `Error: /signup requires a body with valid fields: 'username', 'password' `})
})

app.post('/login', (req, res) =>
{
	if ( req.body && req.body.username && req.body.password )
			globalDatabase.collection('users').findOne({username: req.body.username}, (err, result) => // check if user exists in db
			{
				console.log('findOne result:', result)
				if (err)
				{
					console.log(err) // move to error logging when implemented 
					res.send({error: true, message: `Error: Database error, could not find user '${req.body.username}' `, result})
				}
				else
					bcrypt.compare( req.body.password, result.password, (err, compareResult) => // compare password submitted to /login to user's db password
					{
						if ( compareResult )
						{
							let userId = result._id // _id
							let sessionId = uuidv1() // unique uuid 
							let now = new Date()
							let expiresAt = now.setHours( now.getHours() + 1 )  // session expires in 1 hour

							globalDatabase.collection('users').update({username: req.body.username}, {$set: { session: { sessionId, expiresAt } }  }, (err, updateResult) => // add new session to user in db and send sessionId to client
							{
								if (err)
								{
									console.log(err)
									res.send({error: true, message: 'Error: Could not initialize user session'})
								} 
								else
									res.send({message: `Success! Logged in user '${req.body.username}'`, session: {sessionId, expiresAt, userId } })
							})

						}
						else // user exists, but wrong password
							res.send({error: true, message: `Error: Invalid username/password`})
					})			
			})
	else
		res.send({error: true, message: `Error: /signup requires a body with valid fields: 'username', 'password' `})
})


app.post('/posts', (req, res) => // required used to be logged in (valid session must be passed by client -> server)
{
	console.log('req.body:', req.body)
	if ( req.body && req.body.session && req.body.session.sessionId && req.body.post && req.body.post.title && req.body.session.userId )
		globalDatabase.collection('posts').insertOne({title: req.body.post.title, content: req.body.post.content, createdBy: req.body.session.userId }, (err, result) =>
		{
			if (err)
			{
				console.log(err)
				res.send({error: true, message: 'Error: Could not create post'})
			}
			else
				res.send({message: `Success! Created post with title ${req.body.post.title}`, result})
		})
	else
	{
		if ( !req.body || !req.body.post || !req.body.post.title )
			res.send({error: true, message: 'Error: A post requires a valid title'})
		else
			res.status(403).send({error: true, message: 'Error: You must be logged in to perform this request'})
	}
})

