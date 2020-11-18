const express = require('express')
const coreapi = require('../coreapi/coreapi')
const asyncroutes = require('../middleware/asyncroutes')
const maxmind = require('maxmind')
const { OAuth2Client } = require('google-auth-library')
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
const router = express.Router()

// The characters used in auto-generated passwords
const passwordCharset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_=+:;,.<>/?|*^%$#@!'
const generatedPasswordLength = 16

// The characters used in auto-generated ImageEngine domains
const domainCharset = 'abcdefghijklmnopqrstuvwxyz0123456789'
const generatedDomainLength = 8
const generatedDomainTLD = 'cdn'

let geoipLookup = {
    get() {
        console.log(
            'GeoIP module not loaded, please check the env var GEOIP2_DATABASE'
        )
    },
}

if (process.env.GEOIP2_DATABASE) {
    maxmind
        .open(process.env.GEOIP2_DATABASE)
        .then((l) => (geoipLookup = l))
        .catch((e) => console.log('Unable to load GeoIP database', e))
}

// Promise version of the session destroy function
const logoutPromise = (req) => {
    return new Promise((resolve, reject) => {
        req.session.destroy((err) => (err ? reject(err) : resolve()))
    })
}

const getMissingFields = (requiredFields, obj, allowEmpty) => {
    let missing = []
    requiredFields.forEach((field) => {
        if (obj[field] === undefined || (!allowEmpty && obj[field] == '')) {
            missing.push(field)
        }
    })
    return missing
}

const verifyGoogleToken = async (token, email) => {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
    })
    /* Example payload:
     * {
     *   iss: 'accounts.google.com',
     *   azp:
     *   'qwertyuiopasdfghjklxcvbnm.apps.googleusercontent.com',
     *   aud:
     *   'qwertyuiopasdfghjklxcvbnm.apps.googleusercontent.com',
     *   sub: '01234567890123456789',
     *   email: 'stevekamerman@gmail.com',
     *   email_verified: true,
     *   at_hash: 'qwertyuiopasdfghjklxcvbnm',
     *   name: 'Steve Kamerman',
     *   picture:
     *   'https://lh3.googleusercontent.com/a-/qwertyuiopasdfghjklxcvbnm',
     *   given_name: 'Steve',
     *   family_name: 'Kamerman',
     *   locale: 'en',
     *   iat: 1576115199,
     *   exp: 1576118799,
     *   jti: 'qwertyuiopasdfghjklxcvbnm'
     * }
     */
    const payload = ticket.getPayload()
    if (email.toLowerCase() !== payload.email.toLowerCase()) {
        throw new Error('user identity forging detected')
    }

    return payload
}

const randomString = (length, charset) => {
    let retVal = ''
    for (let i = 0; i < length; i++) {
        retVal += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    return retVal
}

const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

router.get(
    '/checkemail/:email',
    asyncroutes(async (req, res) => {
        const details = await coreapi.searchUsers({
            email: req.params.email.toLowerCase(),
        })

        res.send({
            exists: details.data.length > 0,
        })
    })
)

router.post(
    '/login',
    asyncroutes(async (req, res) => {
        let response = {
            success: false,
            status: 400,
            message: null,
            result: {},
        }

        if (req.session.userContext) {
            response.message = 'You must logout to access this resource'
            res.status(response.status).send(response)
            return
        }

        const requiredFields = ['email', 'password']
        const missingFields = getMissingFields(requiredFields, req.body, false)
        if (missingFields.length > 0) {
            response.message = `Missing required field(s): ${missingFields.join(
                ', '
            )}`
            res.status(response.status).send(response)
            return
        }

        const email = req.body.email.toLowerCase()
        if (!emailRegex.test(email)) {
            response.message = 'Invalid email address provided'
            res.status(response.status).send(response)
            return
        }

        try {
            const result = await coreapi.checkCredentials(
                email,
                req.body.password
            )

            // Authentication failed
            if (result.status === 400) {
                response.success = true
                response.status = 400
                response.message = 'User authentication failed'
                res.status(response.status).send(response)
                return
            }

            if (result.status !== 200) {
                response.success = result.success
                response.status = result.status
                response.message = result.message
                res.status(response.status).send(response)
                return
            }

            // Successful
            response.message = 'Login successful'
            response.success = result.success
            response.status = result.status
            response.result.user_id = result.data.id
            response.result.email = result.data.email

            // Log in user
            req.session.userContext = {
                loggedIn: true,
                isSSO: false,
                justRegistered: true,
                userID: result.data.id,
                email: result.data.email,
            }

            res.status(response.status).send(response)
            return
        } catch (err) {
            response.success = false
            response.status = 500
            response.message = 'Authentication server error'
            res.status(response.status).send(response)
            return
        }
    })
)

router.get(
    '/logout',
    asyncroutes(async (req, res) => {
        let response = {}

        try {
            await logoutPromise(req)
            response = {
                success: true,
                status: 200,
                message: 'Logged out successful',
            }
        } catch (err) {
            response = {
                success: false,
                status: 400,
                message: 'Logout failed',
            }
        }

        res.status(response.status).send(response)
    })
)

// Create a new user
// POST /api/v1/coreapi/user
// {
//     "email": "foobar104@gmail.com",
//     "password": "foopass"
// }
// Successful Response:
// Status Code: 201
// {
//     success: true,
//     status: 201,
//     message: "User created sucessfully",
//     result: {
//         user_id: 12345
//     }
// }
// Failed Response:
// {
//     "success": false,
//     "status": 400,
//     "message": "Duplicate entry: This user already exists",
//     "result": {}
// }
router.post(
    '/user',
    asyncroutes(async (req, res) => {
        let response = {
            success: false,
            status: 400,
            message: null,
            result: {
                userExists: false,
            },
        }

        // Force user to logout if they are trying to create a new user
        if (req.session.userContext) {
            req.session.userContext = null
        }

        let requiredFields = ['email', 'password', 'country_id']
        let randomPassword = null
        let isSSO = false

        let email = ''
        let password = ''
        let additionalAttributes = {}

        // Create the account using Google account information
        if (req.body.google_token) {
            isSSO = true
            additionalAttributes.first_name = req.body.first_name
            additionalAttributes.last_name = req.body.last_name
            // Don't check for password when using SSO
            requiredFields = ['email']
            email = req.body.email
            try {
                await verifyGoogleToken(req.body.google_token, email)
                // Setup the user with a random password since we don't have one to use
                password = randomString(
                    generatedPasswordLength,
                    passwordCharset
                )
            } catch (err) {
                response.message = 'Google token verification failed'
                res.status(response.status).send(response)
                return
            }
        }

        // Create the account using Github account information
        if (req.body.github) {
            isSSO = true
            // Don't check for email or password when using SSO
            requiredFields = []
            password = randomString(generatedPasswordLength, passwordCharset)

            if (req.session.githubUserDetails.email === undefined) {
                response.message = 'Github verification failed'
                res.status(response.status).send(response)
                return
            }

            email = req.session.githubUserDetails.email
            const name = req.session.githubUserDetails.name

            if (email === undefined || email === null) {
                response.message =
                    'Github verification failed (unable to get user email)'
                res.status(response.status).send(response)
                return
            }

            if (name !== undefined && name !== null && name.length > 0) {
                const nameParts = name.split(' ', 2)

                if (nameParts.length === 2) {
                    additionalAttributes.first_name = nameParts[0].trim()
                    additionalAttributes.last_name = nameParts[1].trim()
                }
            }
        }

        const missingFields = getMissingFields(requiredFields, req.body, false)
        if (missingFields.length > 0) {
            response.message = `Missing required field(s): ${missingFields.join(
                ', '
            )}`
            res.status(response.status).send(response)
            return
        }

        if (!isSSO) {
            email = req.body.email.toLowerCase()
            if (!emailRegex.test(email)) {
                response.message = 'Invalid email address provided'
                res.status(response.status).send(response)
                return
            }

            password = req.body.password
            if (password.length < 5 || password.length > 32) {
                response.message = 'Invalid password'
                res.status(response.status).send(response)
                return
            }
        }

        // New user model
        let newUser = {
            username: email, // Use their email for the username
            email: email,
            country_id: req.body.country_id, // We should select a default id
            enabled: 1,
            user_type: 0,
            password: password,
            user_roles: ['user'],
            // If the user is signed in via SSO (Google, Github), we will send them
            // a "password reset" email, otherwise we will send them a "verify your account" email.
            confirmed: isSSO ? 0 : 1, // 1 = User will not need to verify email
        }

        // Add additional attributes to user (probably from SSO)
        for (let key in additionalAttributes) {
            newUser[key] = additionalAttributes[key]
        }

        // Check if email is already registered
        // We don't really need to do this since the account creation step will also do it
        const details = await coreapi.searchUsers({ email: email })
        if (details.data.length > 0) {
            // User is already registered, check their password
            response.result.userExists = true

            if (isSSO) {
                // The user was successfully logged in via SSO, no need to check the password
                // Log in user
                req.session.userContext = {
                    loggedIn: true,
                    isSSO: isSSO,
                    justRegistered: false,
                    userID: details.data[0].id,
                    email: details.data[0].email,
                }

                response.result.user_id = details.data[0].id
                response.result.email = details.data[0].email
                response.success = true
                response.status = 200
                response.message = 'User login successful'
                res.status(response.status).send(response)
                return
            }

            try {
                const result = await coreapi.checkCredentials(email, password)

                if (result.status === 200) {
                    // Log in user
                    req.session.userContext = {
                        loggedIn: true,
                        isSSO: isSSO,
                        justRegistered: false,
                        userID: result.data.id,
                        email: result.data.email,
                    }

                    response.result.user_id = result.data.id
                    response.result.email = result.data.email
                    response.success = true
                    response.status = 200
                    response.message = 'User login successful'
                    res.status(response.status).send(response)
                    return
                }

                // Authentication failed
                response.success = true
                response.status = 400
                response.message = 'User authentication failed'
                res.status(response.status).send(response)
                return
            } catch (err) {
                response.message = 'Unable to create user'
                response.success = false
                response.status = 500
                res.status(response.status).send(response)
                return
            }
        }

        try {
            // Create the user
            const result = await coreapi.createUser(newUser)

            response.success = result.success
            response.status = result.status
            response.message = result.message
            response.result.user_id = result.data.id
            response.result.email = email

            if (result.status === 201 && result.data.id) {
                response.message = 'User created sucessfully'

                // Log in user
                req.session.userContext = {
                    loggedIn: true,
                    isSSO: isSSO,
                    justRegistered: true,
                    userID: result.data.id,
                    email: email,
                }
            }
            res.status(response.status).send(response)
            return
        } catch (err) {
            response.message = err.message
            response.success = false
            response.status = 500
            res.status(response.status).send(response)
            return
        }
    })
)

router.get(
    '/location',
    asyncroutes(async (req, res) => {
        let response = {
            success: false,
            status: 400,
            message: null,
            result: {
                countryName: 'Unknown',
                countryCode: 'US',
                countryID: 230,
            },
        }

        const geo = geoipLookup.get(req.ip)
        // const geo = geoipLookup.get('73.45.22.34')
        if (geo) {
            response.status = 200
            response.success = true

            const countryRes = await coreapi.getCountryID(geo.country.iso_code)
            response.result.countryCode = countryRes.code
            response.result.countryID = countryRes.country_id
            response.result.countryName = countryRes.name
        }

        res.status(response.status).send(response)
    })
)

router.post(
    '/imageengine',
    asyncroutes(async (req, res) => {
        let response = {
            success: false,
            status: 400,
            message: null,
            result: {},
        }

        if (!req.session.userContext || !req.session.userContext.userID) {
            response.message = 'You must be logged in to access this resource'
            res.status(response.status).send(response)
            return
        }

        const userID = req.session.userContext.userID
        const requiredFields = ['accountName', 'origin']
        const missingFields = getMissingFields(requiredFields, req.body, false)
        if (missingFields.length > 0) {
            response.message = `Missing required field(s): ${missingFields.join(
                ', '
            )}`
            res.status(response.status).send(response)
            return
        }

        let originURL = ''
        try {
            originURL = new URL(req.body.origin)
        } catch (err) {
            response.message = 'Unable to parse origin URL'
            response.success = false
            response.status = 400
            res.status(response.status).send(response)
            return
        }

        // New subscription model
        let newSub = {
            type: 'imgeng',
            plan_id: 'IMAGEENGINE_BASIC',
            payment_type: 'TRIAL',
            user_id: userID,
            account_name: req.body.accountName,
            demo_id: req.body.demoID,
            pro_standard: false,
            use_defaults: true,
        }

        const originURLStr = originURL.toString().replace(/\/+$/, '')

        const originType = originURL.protocol.replace(/:$/, '')

        // New domain model
        const generatedDomainName =
            randomString(generatedDomainLength, domainCharset) +
            '.' +
            generatedDomainTLD
        let newDomain = {
            subscription_id: -1,
            url: originURLStr,
            hostname: '',
            cname: generatedDomainName,
            url_type: originType,
            origin_conf_id: 0,
            iam_flag: 0,
            ie_only_flag: 0,
            allow_origin_prefix: 1,
            custom_wildcard_flag: 0,
            transition_time: 300,
        }

        // New origin model
        let newOrigin = {
            // Origin details
            subscription_id: -1,
            name: 'default',
            url: originURLStr,
            hostname: '',
            url_type: originType,
            origin_conf_id: 0, // this must be set to the domain_conf ID above (I know it looks wrong)
        }

        // New image_engine_demo_runs model
        let newDemoRun = {
            subscription_id: -1,
            demo_id: req.body.demoID,
            domain: req.body.domain,
            url: req.body.origin,
        }

        let leadGenReferrer = {
            data: null,
        }

        try {
            // Create the ImageEngine subscription
            const result = await coreapi.createImageEngineSubscription(newSub)
            const user = result.data.user
            const subscription = result.data.subscription

            response.success = result.success
            response.status = result.status
            response.message = result.message

            // Create the domain configuration
            newDomain.subscription_id = subscription.id
            const domainResult = await coreapi.createImageEngineDomain(
                newDomain
            )

            // Create the origin configuration
            newOrigin.subscription_id = subscription.id
            newOrigin.origin_conf_id = domainResult.data.id
            const originResult = await coreapi.createImageEngineOrigin(
                newOrigin
            )

            // Create the ImageEngine Demo Run
            newDemoRun.subscription_id = subscription.id
            const demoRunResults = await coreapi.createImageEngineDemoRun(
                newDemoRun
            )

            // Add the ImageEngine Lead Gen Referrer
            if (req.body.queryString) {
                // New image_engine_lead_generation_referrer model
                let newLeadGen = {
                    subscription_id: subscription.id,
                    campaign_name: req.body.campaignName
                        ? req.body.campaignName
                        : '',
                    url_query_string: req.body.queryString,
                }
                leadGenReferrer = await coreapi.createImageEngineLeadGen(
                    newLeadGen
                )
            }

            // Send Password Reset Email if signed in via SSO AND a new user was created
            if (
                req.session.userContext.isSSO &&
                req.session.userContext.justRegistered
            ) {
                await coreapi.sendPasswordResetEmail({
                    email: user.email,
                    template: 'imageengine',
                })
            }

            // Get the DNS regions
            let regions = await coreapi.getAWSRegions()
            let records = []
            regions.data.forEach((region) => {
                if (region.Deploy != 'ALL') {
                    return
                }
                records.push({
                    domain: generatedDomainName,
                    region: region.RegionName,
                    type: 'A',
                })
            })
            dnsResult = await coreapi.createDNSRecords(records)

            response.result = {
                user: user,
                subscription: subscription,
                origin: originResult.data,
                domain: domainResult.data,
                dns: dnsResult.data,
                demo: demoRunResults.data,
                leadGen: leadGenReferrer.data,
            }

            res.status(response.status).send(response)
            return
        } catch (err) {
            response.message = err.message
            response.success = false
            response.status = 500
            res.status(response.status).send(response)
            return
        }
    })
)

router.post(
    '/send-welcome-email',
    asyncroutes(async (req, res) => {
        let response = {
            success: false,
            status: 400,
            message: null,
            data: {},
        }

        let newWelcomeEmail = {
            subscription_id: req.body.subscription_id,
            user_id: req.body.user_id,
            website: req.body.website,
            demo_id: req.body.demo_id,
            current_cms: req.body.currentCMS,
            delivery_address: req.body.delivery_address,
            country: req.body.country,
        }

        try {
            let emailResponse = await coreapi.sendImageEngineWelcomeEmail(
                newWelcomeEmail
            )
            response.data = emailResponse
            response.success = true
            response.status = 200
            response.message = 'Sent welcome email.' + emailResponse
            res.status(response.status).send(response)
            return
        } catch (err) {
            response.message = 'Unable to send welcome email: ' + err
            res.status(response.status).send(response)
            return
        }
    })
)

module.exports = router
