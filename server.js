// import environment variables from file
require('dotenv').config()

// base
const express    = require('express')
const debug      = require('debug')('app:*')
const open_db    = require('./db')



// authentication
const passport       = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const session        = require('express-session')


/* --- FRONTEND --- */

const app = express()
app.set('view engine', 'ejs')
app.use('/static', express.static('static'))
app.use(session({
    secret: process.env['SESSION_SECRET'] ?? 'anything',
    resave: false,
    saveUninitialized: false
}))


// google auth plumbing
app.use(passport.initialize())
app.use(passport.session());
passport.use(
    new GoogleStrategy({
        clientID: process.env['GOOGLE_CLIENT_ID'],
        clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
        callbackURL: process.env['GOOGLE_CALLBACK_URL']
    },
    (access_token, refresh_token, profile, cb) => {
        debug('successfully authenticated with google!')

        // simplify profile response
        let lensed = profile => ({
            id: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
            email_verified: profile.emails[0].verified,
            photo: profile.photos[0]?.value
        })

        cb(null, lensed(profile))
    })
)

// serialize the profile directly into the session (d i r t y)
passport.serializeUser((user, done) => done(null, JSON.stringify(user)))
passport.deserializeUser((user, done) => done(null, JSON.parse(user)))

app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback',
    passport.authenticate('google', {failureRedirect: '/auth/failed'}),
    (req, res) => {
        // successful authentication
        res.redirect('/dashboard')
    }
)
app.get('/auth/failed', (req, res) => {
    res.send('auth failed!')
})
app.get('/auth/logout', (req, res) => {
    req.logout()
    res.redirect('/')
})

const login_guard = (req, res, next) => {
    // short circuit
    if (!req.user && false) {
        res.redirect('/')
    } else {
        req.user = {
            name: 'Patrick Kage',
            email: 'patrick@comp-soc.com',
            photo: 'https://placekitten.com/256/256'
        }
        next()
    }
}


// homepage
app.get('/', (req, res) => {
    res.render('index')
})


const {mail_app, MailDB} = require('./email')
app.use(login_guard, mail_app)

const {assets_app, AssetsDB} = require('./assets')
app.use('/assets', login_guard, assets_app)

// dashboard
app.get('/dashboard',
    login_guard,
    async (req, res) => {
        const db = await open_db()
        const mail = new MailDB(db)
        const assets = new AssetsDB(db)

        emails = await mail.getAllEmails()

        res.render('dashboard', {
            user: req.user,
            emails: emails,
            templates: emails.filter(e => e.is_template),
            assets: await assets.listAssets()
        })
    }
)

app.get('/docs',
    login_guard,
    async (req, res) => {
        res.render('docs', {
            user: req.user
        })
    }
)
app.get('/404',
    login_guard,
    async (req, res) => {
        res.render('404', {
            user: req.user
        })
    }
)
app.get('/*',
    login_guard,
    async (req, res) => {
        res.render('404', {
            user: req.user
        })
    }
)



// launch the app!
app.listen(process.env['APP_PORT'], () => debug(`committee sso template listening on port ${process.env['APP_PORT']}!`))

