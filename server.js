const express = require("express");
const passport = require('passport');
const dotenv = require('dotenv');
const axios = require('axios');
const cors = require('cors');
const cookieParser = require("cookie-parser");

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
app.use(cors());
app.use(cookieParser());
app.use(express.static('public'));
app.use(express.json());


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

app.get('/login/google/', passport.authenticate('google', { scope: ['profile', 'email'], accessType: 'offline', prompt: 'consent' }));
app.get('/login/google/redirct', passport.authenticate('google', { session:false }), async (req, res) => {
  console.log(req.user);
  
  const userinfo = await authenticateUser(req.user);
  res.cookie('user', JSON.stringify(userinfo), {maxAge: 1704085200 });
  res.redirect('/');
});

app.get('/login', (req, res) => {
  res.redirect('/profile');
});

app.get('/profile', (req, res) => {
  res.send(renderLoginPage());
});

app.get('/session', authCheck, (req, res) => {
  const data = {};
  if(req.cookies.user) {
    data.user = JSON.parse(req.cookies.user);
  };
  
  res.json(
    data
  );
});

app.get('/api/items', authCheck, (req, res) => { 
  const items = getItems(req.authUser);
  res.json({ items });
});

app.get('/v/', authCheck, (req, res) => { 
  const { id } = req.query;
  res.json(renderViewPage(id, req.authUser));
});

app.post('/api/items', authCheck, async (req, res) => {
  const itemData = req.body;
  itemData.id = getRandomId();
  const users = await getAllUsers();

  for(let i = 0; i < users.length; i++) { 
    const user = users[i];
    
    if(user.googleid == req.authUser.googleid) {
      
      if(users[i].items) {
        users[i].items.push(itemData);
      } else {
        users[i].items = [];
        users[i].items.push(itemData);
      } 
    } 
  } 
  
  await fsp.writeFile(usersdb, JSON.stringify(users, null, 2));
  res.json(itemData);
});

app.listen(3000, () => {
  console.log('app is running.')
})

function getRandomId () {
  return Math.random().toString(36).substr(0, 9);
}

function getItems(user) {
  return user.items;
} 


async function authCheck(req, res, next) {
  try {
   const authHeader = req.headers['authorization']
   let tokenInHeader = authHeader && authHeader.split(' ')[1];
   const userCookie = req.cookies.user;

   let userCookieJSON = {};

   if(userCookie) {
    userCookieJSON = JSON.parse(userCookie);
     if (typeof userCookieJSON === 'string') {
        userCookieJSON = JSON.parse(userCookieJSON);
     }
   }

   const refreshToken = req.cookies.user ? userCookieJSON.refreshToken : '';
    console.log(userCookieJSON);


   let tokenInCookies = '';
    
    

   if(!tokenInHeader) {
     
      const accessToken = await getAccessToken(refreshToken);
     
      tokenInCookies = accessToken;

      if(req.cookies.user) {
        userCookieJSON.accessToken = accessToken;
        res.cookie('user', JSON.stringify(userCookieJSON), {maxAge: 1704085200 });
      }

   }
    
    
    
    


   const optHeader = req.headers['use'];
   if(optHeader == "refresh_token") {
     const accessToken = await getAccessToken(tokenInHeader);
     tokenInHeader = accessToken;
   }

   const token = tokenInHeader ? tokenInHeader : tokenInCookies;

  
   if(!token) {
    throw Error("Unauthorized. Please provide valid credentials in the 'Authorization' header using the format 'Bearer <token>'.");
   }
    

   const userinfo = await getUserInfo(token);
   const user = await getUser(userinfo.id);
   
    if(user == null) {
      throw Error('this user is not registered');
    } 
    
    req.authUser = user;
   next();   
  } catch (err) {
     console.log(err.message);
     return res.status(401).json({ msg: err.message });
  }
     
}

async function getUserInfo(token) {
  const res = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`);
  let id = 0;
  const user = res.data;
  id = user.sub;
  return {
    id
  } 
} 

async function getAccessToken(refreshToken) {
  const res = await axios.post('https://www.googleapis.com/oauth2/v3/token', { 
     "client_id": process.env.GOOGLE_CLIENT_ID,
    "client_secret": process.env.GOOGLE_CLIENT_SECRET,
    "refresh_token": refreshToken,
    "grant_type": "refresh_token"
  });

  const data = res.data;
  const accessToken = data['access_token'];

  return accessToken;
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
        return users[i];
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
      googleid: profile.sub,
      accessToken: user.accessToken,
      refreshToken: user.refreshToken
    };

  if(exists == null) {
    await createUser(userinfo);
  }
  
  return userinfo;
}


function renderHomePage() {
  return `
    <!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title></title>
</head>
<body>

  <div id="title"></div>
  <script>
  
    const title = document.querySelector("#title");
    
    const user = getCookie("user");
    
    if(!user) {
      location.href = "/login"      
   } else {
      const user_json = JSON.parse(user);
       title.innerHTML = 'Welcome ' + user_json.username + ', <a href="/profile">Profile</a>';
   }
   
   
   function getCookie(cname) {
  let name = cname + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let ca = decodedCookie.split(';');
  for(let i = 0; i <ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}
    
  </script>
</body>
</html>
  `
}

function getItemById (id, items) {
  const item = items.filter((i) => {
    return id == i.id;
  })

  return item[0];
}


function renderViewPage(id, user) {
  const items = user.items;
  const item = getItemById(id, items);
  return item;
}

function renderLoginPage() {
  return `
  <!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Test GPT</title>
    <meta name="viewport" content="width=device-width,initial-scale=1.0,user-scalable=0">  
    <link rel="stylesheet" href="/styles/login.css" />
    <script src="/js/login.js"></script>
  </head>
  <body class="body">
  
    <div id="loading-div" class="container">
      <div class="loader"></div>
    </div>
   
    <div id="login-div" class="container">
      <img src="/assets/icons/icon48.png" alt="Share GPT" />
      <h1 class="title">Login to TestGPT</h1>
      <form
        action="/login/google"
        target="_blank"
        method="GET"
      >
        <input id="csrfToken-google" type="hidden" name="csrfToken" />
        <button type="submit" class="button">
          <img src="/assets/chrome.svg" alt="Google" />
          <span>Log in with Google</span>
        </button>
      </form>
      
      <!--
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
      -->
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