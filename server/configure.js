//==================
//CONFIGURATION
//===================
const path = require('path')
require('dotenv').config({
    path: path.resolve(__dirname, '../.env'),
})

const requiredEnvVars = [
    'SITE_URL',
    'COREAPI_URL',
    'COREAPI_CLIENT_ID',
    'COREAPI_SECRET',
    'COREAPI_SCOPE',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
]

//==================
//DEPENDENCIES
//===================
const session = require('express-session')
const FileStore = require('session-file-store')(session)
const SQLiteStore = require('connect-sqlite3')(session)
const Sentry = require('@sentry/node')
const bodyParser = require('body-parser')
const coreapi = require('./coreapi/coreapi')

module.exports = (app) => {
    app.set('rootPath', path.resolve(__dirname, '../'))

    // Make sure the client IP is set correctly behind proxies
    app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal'])

    requiredEnvVars.forEach((key) => {
        if (process.env[key] === undefined) {
            throw new Error(
                `Missing var '${key}' in .env.  Required vars: ${requiredEnvVars.join(
                    ', '
                )}.`
            )
        }
    })

    // Setup default env vars
    if (!process.env.APP_SECRET) {
        process.env.APP_SECRET = 'h3un3n893yn89c3g49y83n#$%VQ#q3v'
    }

    if (!process.env.SESSION_DRIVER) {
        process.env.SESSION_DRIVER = 'memory'
    }

    // Sentry error reporting for Express / Node.js
    if (process.env.SENTRY_DSN) {
        Sentry.init({
            dsn: process.env.SENTRY_DSN,
        })

        // The request handler must be the first middleware on the app
        app.use(Sentry.Handlers.requestHandler())
    }

    //==================
    // Session Management
    //==================
    let secureCookies = false
    if (app.get('env') === 'production') {
        secureCookies = true
    }

    let sessionConfig = {
        resave: true,
        secret: process.env.APP_SECRET,
        secure: secureCookies,
        saveUninitialized: true,
    }

    switch (process.env.SESSION_DRIVER) {
        case 'memory':
            break
        case 'files':
            // Reference: https://www.npmjs.com/package/session-file-store
            sessionConfig.store = new FileStore({
                path:
                    path.resolve(process.env.SESSION_STORAGE_PATH) ||
                    os.tmpdir(),
            })
            break
        case 'sqlite':
            // Reference: https://www.npmjs.com/package/connect-sqlite3
            sessionConfig.store = new SQLiteStore({
                dir:
                    path.resolve(process.env.SESSION_STORAGE_PATH) ||
                    os.tmpdir(),
                db: 'sessions.sqlite3',
            })
            break
        default:
            throw new Error(
                `Invalid session store: ${process.env.SESSION_DRIVER}`
            )
    }

    app.use(session(sessionConfig))

    //==================
    // CoreAPI
    //==================
    coreapi.setCredentials(
        process.env.COREAPI_URL,
        process.env.COREAPI_CLIENT_ID,
        process.env.COREAPI_SECRET,
        process.env.COREAPI_SCOPE
    )

    coreapi
        .getAccessToken()
        .then(() => console.log('CoreAPI access token obtained'))
        .catch((err) =>
            console.error(
                `Failed to get CoreAPI access token: ${err}.  All functions requiring the CoreAPI will fail!`
            )
        )

    //==================
    // MIDDLEWARE
    //==================
    app.use(bodyParser.json())
    app.use(bodyParser.urlencoded({ extended: true }))

    //==================
    // CONTROLLERS
    //==================
    app.use('/robots.txt', require('./controllers/robots'))
    app.use('/api/v1/coreapi', require('./controllers/coreapi'))
    app.use('/api/v1/auth/sso', require('./controllers/sso'))


    // Sentry error reporting error handler
    if (process.env.SENTRY_DSN !== false) {
        // The error handler must be before any other error middleware
        // and after all controllers
        app.use(Sentry.Handlers.errorHandler())
    }
}
