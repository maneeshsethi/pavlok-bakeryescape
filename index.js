var pavlok = require('pavlok-beta-api-login');
var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var cookieSession = require('cookie-session');
var nunjucks = require('nunjucks');
var uuid = require('node-uuid');
var pg = require('pg');
pg.defaults.ssl = true;

//Setup the app
var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cookieSession({
	name: "session",
	httpOnly: false,
	keys: [ "dummy-session-key-will-change-eventually" ]
}));
app.use(function(req, res, next){
	console.log("-------------------------------");
	console.log(req.url + " requested from " + (req.connection.remoteAddress || req.ip));
	if(req.body && Object.keys(req.body).length > 0){
		console.log("Body: " + JSON.stringify(req.body));
	}
	if(req.params && Object.keys(req.params).length > 0){
		console.log("Params: " + JSON.stringify(req.params));	
	}

	res.header('X-XSS-Protection', 0);

	//We don't auth unless there's an explicit request -- that is, we're at /login
	if(req.url == "/login" && (req.session.sid === undefined || req.session.sid == null)){
		pavlok.auth(req, res); //Begin an authentication process
		return;
	}

	//Perform user lookup for the / route and the /context.js route to let 
	//these routes populate themselves as needed with user information, or redirect
	//to a proper page
   	if(req.session.sid === undefined || req.session.sid == null){ //Fine
		next();
	} else {
		setupQuery("SELECT * FROM Session s INNER JOIN Users u ON u.uid=s.uid WHERE session_id=$1",
			[req.session.sid || req.query.sid],
			function(error, rows){
				if(error || rows.length < 1){
					console.log("Session fetch error from SID!");
					next(); //We can manually auth if we need to later
				} else {
					console.log("Fetched user: " + rows[0].uid);
					req.pavuser = { //We populate the 'pavuser' object
						code: rows[0].token
					};
					next();
				}
			});
	}
});

nunjucks.configure("views", {
	autoescape: false,
	express: app
});

//Postgres connect
var client;
pg.connect(process.env.DATABASE_URL, function(err, cli){
	if(err){
		console.log("Error connecting to Postgress. Are you running in an environment without process.env.DATABASE_URL?");
	} else {
		console.log("Connected to Postgres!");
		client = cli;
		setupQuery("CREATE TABLE IF NOT EXISTS Users (uid TEXT NOT NULL, token TEXT, PRIMARY KEY (uid))", [], function(){});
		setupQuery("CREATE TABLE IF NOT EXISTS Session (uid TEXT NOT NULL, session_id TEXT NOT NULL, PRIMARY KEY (uid))", [], function(){});
	}
});

//Create a session and drop the required cookies
function establishSession(req, res, meResponse){
	var sid = uuid.v4();
	setupQuery("DELETE FROM Sessions WHERE uid=$1",
		[meResponse.uid],
		function(error, rows){
			if(error){
				res.status(500).send("Could not delete old sessions!");
			} else {
				setupQuery("INSERT INTO Session (uid, session_id) VALUES ($1, $2)",
					[meResponse.uid, sid],
					function(error, rows){
						if(error){
							res.status(500);
							res.send("Uh-oh...");
						} else {
							req.session.sid = sid;
							console.log("SID is now: " + req.session.sid );
							req.pavuser = { 
								code: req.session.pavlok_token	
							};
							serveGame(req, res);
						}
					});
			}
		});
}

//Initialize the app
pavlok.init(
	"a1d8389fd942975de0fe47a2a799aebc2d121117a8009c305aee2bd059978920", //Client ID
	"070f8eabff3a157876a1589a0f3d910ca0f7665f6282c7b1bd0fa7aa307cc1d4", { //Client secret 
		"verbose": true,
		"app": app,
		"message": "Hello from the developer playground!",
		"callbackUrl": "https://bakery-escape.herokuapp.com/auth/result",
		"callbackUrlPath": "/auth/result",
		"successPath": "/success",
		"errorPath": "/error",
		"apiUrl": "https://pavlok-mvp.herokuapp.com",
		"successWithCode": true,
		"handleSessions": false
	}
);

//Helper function for executing PostgreSQL queries
function setupQuery(queryText, params, callback){
	var query = client.query(queryText, params);
	query.on('row', function(row, result){
		result.addRow(row);
	});
	query.on('error', function(error){
		console.log("Error while executing query: " + queryText);
		console.log("Parameters were:");
		for(var i = 0 ; i < params.length; i++){
			console.log(params[i]);
		}
		console.log("Error was: " + JSON.stringify(error));
		callback(error, null);
	});
	query.on('end', function(result){
		callback(null, result.rows);
	});
}

//Serve the success page with some necessary pre-serve tweaks
app.get("/success", function(req, res){
	//Get /me from Pavlok using access token
	var token = req.query.code;
	var queryParams = {
		access_token: token
	};
	
	request({
		url: "https://pavlok-mvp.herokuapp.com/api/v1/me",
		qs: queryParams,
		method: 'GET',
	}, function(error, response, body){
		if(error){
			res.status(400);
			res.send("Internal auth error :(");
		} else {
			var meResponse;
			try {
				meResponse = JSON.parse(body);
			} catch (e) {
				res.status(400);
				res.send("Internal auth error :(");
			}
			setupQuery("SELECT FROM Users WHERE uid=$1",
				[meResponse.uid],
				function(error, rows){
					if(!error && rows.length > 0){
						//Update the user
						setupQuery("UPDATE Users SET token=$1 WHERE uid=$2",
							[token, meResponse.uid],
							function(error, rows){
								if(error){
									res.status(500).send("Failed to update the user!");
								} else {
									establishSession(req, res, meResponse);
								}
							});	
					} else {
						//Insert the user
						setupQuery("INSERT INTO Users(uid, token) VALUES ($1, $2)",
							[meResponse.uid, token],
							function(error, rows){
								if(error){
									res.status(500).send("Failed to insert the user!");
								} else {
									establishSession(req, res, meResponse);					
								}
							});
					}
				});	
		}
	});
});

app.get("/", serveGame);

function serveGame(req, res){
	if(req.pavuser !== undefined){
		return res.render("index.html", {
			code: req.pavuser.code
		});
	} else {
		return res.render("index.html", {
			code: "none"
		});
	}
}

app.use(express.static(__dirname + "/public"));

//Start the server
app.listen(process.env.PORT || 3000, function(){
	console.log("Visit the IP address of this machine, or http://localhost:3000/.");
});
