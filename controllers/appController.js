const bodyParser = require('body-parser')
const fs = require('fs');
const {google} = require('googleapis');
const { file } = require('googleapis/build/src/apis/file');

// permission for user for gmail privilages
// in our case  all the permission is given to user...
// to write , read or modify 
const SCOPES = ['https://mail.google.com/' , 'https://www.googleapis.com/auth/gmail.readonly'];

// access token , refresh token are stored in this json file
const TOKEN_PATH = 'token.json';


let credentials;
let oAuth2Client;
let urlencodedParser = bodyParser.urlencoded({extended : false})


// 3. method is called when there is no token.json found 
// it means it is a new user logging in
function getNewToken(oAuth2Client , res) {
    // an authentication url is generated which is basically an api call to gmail for user authentication
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    // after the url is generated , redirect it in the browser ...
    res.redirect(authUrl)
    
}


// 8. method for extracting the info of current user like name , email address etc.
async function getUser(auth){
    const gmail = google.gmail({version: 'v1' , auth});
    
    let userInfo = await gmail.users.getProfile({auth: auth , userId: 'me'})
    return userInfo
}

// to view the latest three email from the inbox
function getEmail(auth){
    console.log(auth)
    let messageList = [];
    const gmail = google.gmail({version: 'v1' , auth});
    gmail.users.messages.list({auth: auth , userId: 'me' , maxResults: 3} , function(err , response){
      if(err){
        console.log('An error occured..' + err);
        return;
      }
      response.data.messages.forEach((ob) => {
        
        gmail.users.messages.get({auth: auth , userId: 'me' , 'id': ob.id} , function(err , response){
          if(err){
            console.log|('An error occured 2 + ' + err);
            return;
          }
          message_raw = response.data.payload.body.data
        //   console.log(message_raw)
          const buff = new Buffer.from(message_raw , 'base64')
          text = buff.toString()
          console.log(text)
          messageList.push(text)
        })
      })
      
    })
    return messageList
}


// 9. method for creating format and body of the message and encoding it to base64 
function createMessage(to , from , subject , text){
    let str = ["Content-Type: text/html; charset=\"UTF-8\"\n",
                "MIME-Version: 1.0\n",
                "Content-Transfer-Encoding: 7bit\n",
                "to: ", to, "\n",
                "from: ", from, "\n",
                "subject: ", subject, "\n\n",
                text
              ].join('');
    let encodedMail = new Buffer.from(str).toString("base64").replace(/\+/g, '-').replace(/\//g, '_');
    return encodedMail
}

// 7. the method for sending the email to  another user
async function sendMail(auth , to , subject , text){
    const gmail = google.gmail({version: 'v1' , auth});
    // the current user's email address is extracted my the getUser method
    let userInfo = await getUser(auth)
    // the message body is created using createMessage method
    let raw = createMessage(to , userInfo.data.emailAddress , subject , text)
    gmail.users.messages.send({auth: auth , userId: 'me' , resource: {raw: raw} , function(err , response){
      return response
    }})
}

// 1. initially when the application starts the OAUTH2 client credentials are read from the credentials.json file
fs.readFile('credentials.json', (err, content) => {
    // if error
    if (err) return console.log('Error loading client secret file:', err);
    // if we find the content from the file the parse it into json from simple string
    credentials = JSON.parse(content)
    // extract the required credentials
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    // create an instance of google OAUTH@ client with the credentials
    oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);
})

module.exports = function(app){
    // 2. the starting route...
    app.get('/' ,  (req , res) => {
        // the token.json file is read after the credentials for OAUTH2 client is set
        fs.readFile(TOKEN_PATH, (err, token) => {
            // if the token.json file does not exist then get a new token for a new user
            if (err) 
                return getNewToken(oAuth2Client , res)
            // if the token.json file exist it means we already have the access token , refresh token
            // then set the access and refresh token to credentials of our OAUTH2 client
            oAuth2Client.setCredentials(JSON.parse(token));
            // then redirect to home page 
            res.redirect('/home')
        })

    })          
    // 4. after the user account is selected and permissions are put to 'allow' 
    // the code for authorization is extracted from the redirected url from the gmail API call
   app.get('/api/v1/' , (req, res) => {
        console.log(req.query)
        // auth code from redirected url
        const {code} = req.query
        // this auth code is then used to generate the access token and refresh token to authenticate the user
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
            
            
            // Store the token for session use...
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
                // after the authentication process is complete , redirect to home page..
                res.redirect('/home')
            });
            
              
        });
        
   })
    //5 . the home route from where we can send and view  email...
    app.get('/home' , (req , res) => {
        // ejs home template
        res.render('home')
    })

    //6.  when the submit button is clicked , the email address of the user the email is to be sent, the subject and the text of the email is extracted...
    // and is semt usinmg the sendMail method...
    app.post('/api/v1/send-mail' , urlencodedParser , (req, res) => {
        console.log(req.body)
        const {to , subject , text} = req.body
        const response = sendMail(oAuth2Client , to , subject , text)    
        if(response){
            res.redirect('/home')
        }
    })

    app.get('/show-email' , (req , res) => {
        // this is not workng that properly
        let messageList = getEmail(oAuth2Client)
        res.render('showEmail' , {messageList})
    })

    app.get('/logout' , (req , res) => {
        fs.unlink(TOKEN_PATH , (err) => {
            if(err){
                throw err;

            }
            console.log('logged out...')
        })
        res.redirect('/')
    })
    
}


