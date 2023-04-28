const express = require("express");
const passport = require('passport');
const dotenv = require('dotenv');

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
    console.log(profile);
  }
));

app.get('/', (req, res) => {
	res.sendStatus(200);
})

app.get('/login/google/', passport.authenticate('google', { scope: ['profile'] }));
app.get('/login/google/redirct', passport.authenticate('google'));

app.listen(3000, () => {
	console.log('app is running.')
})