

var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/admin-reports_v1-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/admin.reports.audit.readonly','https://www.googleapis.com/auth/admin.reports.usage.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'admin-reports_v1-nodejs-quickstart.json';


var TTL_FOR_WEB_HOOK = '3600';//'21600';

// Generate a v4 UUID (random) 
var uuid = require('node-uuid');
var CURRENT_UUID = uuid.v4();

// var repeat = require('repeat');
// var Repeat = repeat;


//calls function at set interval in seconds
function startInterval(callback, seconds) {
  callback();
  return setInterval(callback, seconds * 1000);
}

function callGoogleLoginWatcher() {
// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }
  // Authorize a client with the loaded credentials, then call the
  // Reports API.
  authorize(JSON.parse(content), watchLoginEvents);
});

}


/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the last 10 login events for the domain.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listLoginEvents(auth) {
  var service = google.admin('reports_v1');
  service.activities.list({
    auth: auth,
    userKey:'all',
    applicationName:'login',
    maxResults: 10,
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }

    console.log(JSON.stringify(response))
    // var activities = response.items;
    // if (activities.length == 0) {
    //   console.log('No logins found.');
    // } else {
    //   console.log('Logins:');
    //   for (var i = 0; i < activities.length; i++) {
    //     var activity = activities[i];
    //     console.log(activity.JSON);
    //   }
    // }
  });
}

/**
 *  Create webhook watcher for Google login events
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function watchLoginEvents(auth) {
  var service = google.admin('reports_v1');
  //var uuid = require('node-uuid');
  var CURRENT_UUID = uuid.v4();
  console.log(Date.now() + ` Calling web_hook. uuid: ${CURRENT_UUID}`)

  var data = {
      auth: auth,
      userKey: 'all', 
      //singleEvents: true,
      applicationName:'login',
      orderBy: 'startTime',
      resource: {
          id: CURRENT_UUID,
          //token: 'email='+_token.provider_email,
          address: 'https://nsut-dev-nodejs01.nsuok.edu/',
          type: 'web_hook',
          params: {
              ttl: TTL_FOR_WEB_HOOK
          }
      }
  };
  service.activities.watch(data, function(err, response) {
      if (err) {
          //logging.info(`watch api error  ${err}`);
          console.error('The API returned an error: ' + JSON.stringify(err));
          //console.log(JSON.stringify(response));
          return;
       }
       //apiCount += 1;
       //jsonOutput = JSON.stringify(response);
       //logging.info(`JSON response  ${response}`);
       console.log(Date.now() + ` now watching for logins: ${JSON.stringify(response)}`);
   }); 
}
// end watch logins


//Receive data from JSON POST and insert into MongoDB

var express = require('express'),
    bodyParser = require('body-parser'),
    app = express(),
    port = 8080;

var MongoClient = require('mongodb').MongoClient
var db;
var moment = require('moment');

//Establish Connection
MongoClient.connect('mongodb://localhost:27017/mydb', function (err, database) {
   if (err) 
   	throw err
   else
   {
	db = database;
	console.log('Connected to MongoDB');
	//Start app only after connection is ready
	app.listen(port);
   }
 });

//calls google login watcher 100 seconds before TTL ends
//startInterval(callGoogleLoginWatcher,TTL_FOR_WEB_HOOK - 100)

startInterval(callGoogleLoginWatcher,TTL_FOR_WEB_HOOK - 100)


app.use(bodyParser.json())

app.post('/', function (req, res) {
  JSON.stringify(req.body)
  // Insert JSON straight into MongoDB
  var date = moment();
  req.body["inserted_dt"] = date.toISOString();
  console.log(date.toISOString() + + ` Message Headers: ${JSON.stringify(req.headers)}`);
  db.collection('googleLogins', function(err, collection) {
      collection.count({ "id.uniqueQualifier": req.body.id.uniqueQualifier }, function (err, count) {
        if (count>0) {
          console.log(date.toISOString() + ` Item Already exists in mongodb, will not insert duplicate: ${JSON.stringify(req.body)}`)
        }
        //insert record
        else {
          collection.insert(req.body, function (err, result) {
            if (err) {
              res.status(500).json(`error: ${JSON.stringify(err)}`);
              console.log(date.toISOString() + ` Failed to insert into mongodb Error: ${JSON.stringify(err)}`)
            }
            else {
              res.status(200).json('Success: true');
              //console.log(date.toISOString() + ` inserted into mongodb: Result: ${JSON.stringify(result)}`)
            }
          });
        }
      });
  });
});

app.get('/', function (req, res) {
  res.send('Post only please.')
})