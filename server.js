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
	res.sendStatus(200);
})

app.get('/api/', authCheck, (req, res) => {
  res.sendStatus(200);
})

app.get('/login/google/', passport.authenticate('google', { scope: ['profile'], accessType: 'offline' }));
app.get('/login/google/redirct', passport.authenticate('google', { session:false }), async (req, res) => {
  const { accessToken, refreshToken } = await authenticateUser(req.user);
  res.send('thanks!');
});

app.listen(3000, () => {
	console.log('app is running.')
})




async function authCheck(req, res) {
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
     return res.status(401).json({ msg: error.message });
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
  console.log(user);
  // daving the user if deosnt exists
  const profile = user.profile._json;

  const exists = await getUser(profile.sub);
  if(exists == null) {
    const userinfo = {
      username: profile.name,
      avatar: profile.picture,
      googleid: profile.sub
    };

    await createUser(userinfo);
  }
  
  const accessToken = user.accessToken;
  const refreshToken = user.refreshToken;
  return { accessToken, refreshToken};
}