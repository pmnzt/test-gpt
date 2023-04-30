const express = require("express");
const passport = require('passport');
const dotenv = require('dotenv');
const { promises: fsp } = require('fs');
const usersdb =  'db/users.json';

// (async () => {
//    console.log(await authenticateUser({ profile: { 
//             googleid: '99', 
//             avatar: 'some', 
//             username: 'some name'
//           }
//         }));
// })();

dotenv.config();

const app = express();
app.use(express.static('public'));


const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const GoogleStrategy = require('passport-google-oauth20').Strategy;


passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: "/login/google/redirct"
  },
  function(accessToken, refreshToken, profile, cb) {
    cb(null, { accessToken, refreshToken, profile });
  }
));


app.get('/', (req, res) => {
	res.send(renderHomePage());
})

app.get('/api/', authCheck, (req, res) => {
  res.sendStatus(200);
})

app.get('/login/google/', passport.authenticate('google', { scope: ['profile'], accessType: 'offline' }));
app.get('/login/google/redirct', passport.authenticate('google', { session:false }), async (req, res) => {
  const { accessToken, refreshToken, userinfo } = await authenticateUser(req.user);
  res.send(renderHomePage({ accessToken, refreshToken, userinfo }));
});

app.get('/login', (req, res) => {
  res.send(renderLoginPage());
});

app.listen(3000, () => {
	console.log('app is running.')
})




async function authCheck(req, res, next) {
   const authHeader = req.headers['authorization']
   const token = authHeader && authHeader.split(' ')[1] 

  try {
   if(!token) {
    throw Error("Unauthorized. Please provide valid credentials in the 'Authorization' header using the format 'Bearer <token>'.");
   }

   const userinfo = await getUserInfo(token);
   const user = await getUser(userinfo.id);
   next();   
  } catch (err) {
     return res.status(401).json({ msg: err.message });
  }
     
}

async function getUserInfo() {
  return {
    id: 0
  } 
} 

async function createUser (user) {
    const username = user.username;
    const avatar = user.avatar;
    const googleid = user.googleid;

    const users = await getAllUsers();
    users.push({
      username,
      avatar,
      googleid
    });

    await fsp.writeFile(usersdb, JSON.stringify(users, null, 2));

    return { 
      username,
      avatar,
      googleid
    }
}

async function getUser(googleid) {
   const users = await getAllUsers();

   for(let i = 0; i < users.length; i++) {
     if(users[i].googleid == googleid) {
        return users[i].googleid;
     }
   }

   return null;
}

async function getAllUsers() {
  const users = JSON.parse(await fsp.readFile(usersdb, 'utf8'), null, 2);
  return users;
}

async function authenticateUser(user) {
  //console.log(user);
  // daving the user if deosnt exists
  const profile = user.profile._json;

  const exists = await getUser(profile.sub);

  const userinfo = {
      username: profile.name,
      avatar: profile.picture,
      googleid: profile.sub
    };

  if(exists == null) {
    await createUser(userinfo);
  }
  
  const accessToken = user.accessToken;
  const refreshToken = user.refreshToken;
  return { accessToken, refreshToken, userinfo };
}


function renderHomePage(user) {
  return `
    <!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title></title>
</head>
<body>
  <h1 id="title"></h1>
  <script>
 	
    const title = document.querySelector("#title");
    
    const refreshToken = localStorage.getItem("refreshToken")
    if(!refreshToken) {
      location.href = "/login"
   } 
    
  </script>
</body>
</html>
  `
}

function renderLoginPage() {
  return `
  <!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Share GPT</title>
    <link rel="stylesheet" href="styles/login.css" />
  </head>
  <body class="body">
    <div id="loading-div" class="container">
      <div class="loader"></div>
    </div>
    <div id="login-div" class="container">
      <img src="/assets/icons/icon48.png" alt="Share GPT" />
      <h1 class="title">Login to ShareGPT</h1>
      <form
        action="https://sharegpt.com/api/auth/signin/google"
        target="_blank"
        method="POST"
      >
        <input id="csrfToken-google" type="hidden" name="csrfToken" />
        <button type="submit" class="button">
          <img src="/assets/chrome.svg" alt="Google" />
          <span>Log in with Google</span>
        </button>
      </form>
      <form
        action="https://sharegpt.com/api/auth/signin/twitter"
        target="_blank"
        method="POST"
      >
        <input id="csrfToken-twitter" type="hidden" name="csrfToken" />
        <button class="button">
          <img src="/assets/twitter.svg" alt="Twitter" />
          <span>Log in with Twitter</span>
        </button>
      </form>
    </div>
    <div id="session-div" class="container">
      <img id="session-image" alt="User Profile Pic" class="profile-pic" />
      <h1 id="session-name" class="title"></h1>
      <p class="subtitle">
        You are logged in as <span id="session-username"></span>
      </p>
    </div>
  </body>
</html>

  `
}