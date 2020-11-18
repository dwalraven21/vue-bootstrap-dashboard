/**
 * @file
 * Provides connectivity to the ScientiaMobile CoreAPI
 */

const os = require('os')
const fs = require('fs')
const axios = require('axios')
const crypto = require('crypto')
const oauth2Client = require('simple-oauth2')
const userAgent = `imageengine.io (Server/nodejs-${process.version}; +https://imageengine.io/)`
const apiPrefix = '/api/v2'
const accessTokenPath = '/oauth/token'

const credentials = {
    apiURL: '',
    clientID: '',
    secret: '',
    scopes: '',
}

const cacheDataTemplate = {
    token_type: '',
    expires_in: 0,
    access_token: '',
    hash: '',
}

// Directory in which to store the access token
let cacheDir = os.tmpdir()
let cacheFile = 'njs-coreapi-access-token.json'
let accessToken = null
let oauth2 = null

/**
 * Returns true if the given object has all the given keys
 * @param {Object} obj - The object to be checked
 * @param {Array} keys - The required keys
 * @return {Boolean}
 */
const hasAllKeys = (obj, keys) => {
    for (let key in keys) {
        if (key in obj) {
            return false
        }
    }

    return true
}

/**
 * Gets the full path to the cache file on disk
 *
 * @return {string}
 */
const getCacheFilepath = () => {
    return cacheDir + '/' + cacheFile
}

/**
 * Computes a hash that uniquely identifies the set of credentials.
 * This hash can be used to determine if the cached data was created
 * from the current credentials
 *
 * @return {string}
 */
const getCacheIntegrityHash = () => {
    let hash = crypto.createHash('sha256')
    hash.update(credentials.apiURL)
    hash.update(credentials.clientID)
    hash.update(credentials.secret)
    hash.update(credentials.scopes)
    return hash.digest('hex')
}

/**
 * Sets the credentials used to contact the CoreAPI
 *
 * @param {string} apiURL - URL to the CoreAPI, including scheme, ex: https://staging-core.scientiamobile.com
 * @param {string} clientID - OAuth2 Client ID
 * @param {string} secret - OAuth2 Secret
 * @param {string} scopes - OAuth2 Scopes, delimited by spaces
 */
const setCredentials = (apiURL, clientID, secret, scopes) => {
    if (accessToken !== null) {
        throw new Error(
            'You must call setCredentials() before getAccessToken()'
        )
    }

    credentials.apiURL = apiURL
    credentials.clientID = clientID
    credentials.secret = secret
    credentials.scopes = scopes

    clientConfig = {
        client: {
            id: credentials.clientID,
            secret: credentials.secret,
        },
        auth: {
            tokenHost: credentials.apiURL,
            tokenPath: accessTokenPath,
        },
        http: {
            headers: {
                'user-agent': userAgent,
            },
        },
    }

    oauth2 = oauth2Client.create(clientConfig)
}

/**
 * Sets the cache directory
 * @param {string} dir
 */
const setCacheDir = (dir) => {
    if (accessToken !== null) {
        throw new Error('You must call setCacheDir() before getAccessToken()')
    }
    cacheDir = dir
}

/**
 * Gets the cached access token
 * @return {Token}
 */
const getCachedAccessToken = () => {
    const cacheFile = getCacheFilepath()
    const contents = fs.readFileSync(cacheFile)
    let cacheData = {}

    try {
        cacheData = JSON.parse(contents)
    } catch (err) {
        fs.unlinkSync(cacheFile)
        throw new Error('Unable to parse cache data file')
    }

    if (!hasAllKeys(cacheData, Object.keys(cacheDataTemplate))) {
        fs.unlinkSync(cacheFile)
        throw new Error('Unable to parse cache data file')
    }

    const hash = getCacheIntegrityHash()
    if (cacheData.hash != hash) {
        fs.unlinkSync(cacheFile)
        throw new Error(
            'Cached access token was generated with different credentials, removing'
        )
    }

    return oauth2.accessToken.create(cacheData)
}

/**
 * Saves the access token to cache
 * @param {Token} token
 */
const saveCachedAccessToken = (token) => {
    const cacheFile = getCacheFilepath()
    let cacheData = Object.assign({}, token.token, {
        hash: getCacheIntegrityHash(),
    })

    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, '', '  '))
    console.log(`CoreAPI auth cache stored successfully: ${cacheFile}`)
}

/**
 * Gets an access token from cache or the CoreAPI
 */
const getAccessToken = async () => {
    // Try to restore the token from the filesystem
    try {
        accessToken = getCachedAccessToken()
        console.log('Restored access token from cache')
    } catch (e) {
        console.log(`Unable to read access token cache file: ${e.message}`)
    }

    // Try to get a new token from the CoreAPI
    if (accessToken === null || accessToken.expired()) {
        console.log('Getting new CoreAPI token')
        await getNewAccessToken()
        return
    }
}

/**
 * Gets a new access token from the CoreAPI
 */
const getNewAccessToken = async () => {
    const tokenConfig = {
        scope: credentials.scopes,
    }

    // Optional per-call http options
    const httpOptions = {}

    // Get the access token object for the client
    try {
        const result = await oauth2.clientCredentials.getToken(
            tokenConfig,
            httpOptions
        )
        accessToken = oauth2.accessToken.create(result)
        console.log(`New CoreAPI access token obtained.`)
        // Save the access token
        saveCachedAccessToken(accessToken)
    } catch (error) {
        const msg = `Unable to retreive CoreAPI OAuth2 access token: ${error.message}`
        console.log(msg)
        throw new Error(msg)
    }
}

const doGet = async (path) => {
    return await doRequest(path, 'get')
}

const doPost = async (path, data) => {
    return await doRequest(path, 'post', data)
}

const doPatch = async (path, data) => {
    return await doRequest(path, 'patch', data)
}

const doRequest = async (path, method, data) => {
    const url = credentials.apiURL + apiPrefix + path
    const req = {
        method: method,
        url: url,
        headers: {
            'user-agent': userAgent,
            authorization: `Bearer ${accessToken.token.access_token}`,
        },
        validateStatus: (status) => {
            return status < 400 || status == 404 || status == 400
        },
    }

    if (data !== null) {
        req.headers['content-type'] = 'application/json'
        req.data = JSON.stringify(data)
    }

    console.log(`Making CoreAPI request: ${method} ${url}`)
    let resp = {}
    try {
        resp = await axios(req)
    } catch (err) {
        console.log(`CoreAPI client exception: ${err.message}`)
        if (err.response.data) {
            console.log(err.response.data)
        }
        throw err
    }
    console.log(`CoreAPI response: ${resp.status}`)

    return resp
}

const constructSearch = (terms) => {
    if (!terms) {
        return ''
    }

    let searches = []

    for (const key in terms) {
        const value = terms[key]
        if (value != '') {
            searches.push(key + '=' + encodeURIComponent(value))
        }
    }

    return `/search:(${searches.join('')})`
}

const constructWith = (terms) => {
    if (!terms) {
        return ''
    }

    return '/with:(' + terms.map(encodeURIComponent).join(',') + ')'
}

/**
 * Checks if the given credentials are valid
 * @param {string} username
 * @param {string} password
 */
const checkCredentials = async (username, password) => {
    const path = '/login'
    const payload = {
        username: username,
        password: password,
        allow_email: true,
    }
    const resp = await doPost(path, payload)
    return resp.data
}

/**
 * Gets the User object that corresponds to the given user ID
 * @param {number} userID - The user ID
 * @param {Array} withTerms - A list of relationships to include (ex: ['subscriptions', 'country'])
 */
const getUserByID = async (userID, withTerms) => {
    const path =
        `/user/${encodeURIComponent(userID)}` + constructWith(withTerms)
    const resp = await doGet(path)
    return resp.data
}

/**
 * Gets a list of User objects that match the given search terms
 * @param {Object} terms - Object of key=>value pairs to search for (ex: {email: 'foo@bar.com})
 * @param {boolean} withTerms - A list of relationships to include (ex: ['subscriptions', 'country'])
 */
const searchUsers = async (terms, withTerms) => {
    const path = '/users' + constructSearch(terms) + constructWith(withTerms)
    const resp = await doGet(path)
    return resp.data
}

/**
 * Create a new ScientiaMobile user account
 * @example 'user' parameter:
 * {
 *   "username": "username",
 *   "email": "username@gmail.com",
 *   "first_name": "Foo",
 *   "last_name": "Bar",
 *   "company_name": "ScientiaMobile Inc",
 *   "country_id": 1, // We should select an default id
 *   "enabled": 1,
 *   "user_type": 0,
 *   "password": "foopass",
 *   "confirmed": 1, // 1 = User will not need to verify email
 *   "user_roles": [
 *     "user",
 *   ]
 * }
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "type": "eloquent",
 *   "message": "",
 *   "data": {
 *     "username": "foobar100",
 *     "email": "foobar100@gmail.com",
 *     "first_name": "Foo",
 *     "last_name": "Bar",
 *     "middle_name": null,
 *     "company_name": "ScientiaMobile Inc",
 *     "country_id": 1,
 *     "phone": null,
 *     "enabled": 1,
 *     "user_type": 0,
 *     "id": 23325,
 *     "cloud_subscriptions": [],
 *     "wurfljs_subscriptions": [],
 *     "user_roles": null,
 *     "subscriptions": []
 *   },
 *   "pagination": [],
 *   "debug": [],
 *   "status": 201
 * }
 * @param {Object} user - User object
 * @return {Object} CoreAPI response with newly-created user account
 */
const createUser = async (user) => {
    const payload = { data: [user] }
    const path = '/user'
    const resp = await doPost(path, payload)

    // This is used to confirm the user's account so they do not need to
    // check their email in order to login.
    if (
        user.confirmed === 1 &&
        resp.status === 201 &&
        resp.data.success &&
        resp.data.data.id !== undefined
    ) {
        confirmResp = await confirmUser(resp.data.data.id)
        if (!confirmResp.success) {
            throw new Error('Unable to automatically confirm user account')
        }
    }

    return resp.data
}

/**
 * Confirm a user account so they do not need to validate their account via email
 * Note that this is automatically called by createUser() if you pass {confirmed: 1}
 * @param {number} userID - User ID
 * @return {Object} Newly-created user object
 */
const confirmUser = async (userID) => {
    const payload = { confirmed: 1 }
    const path = '/users/' + encodeURIComponent(userID)
    const resp = await doPatch(path, payload)
    if (resp.status !== 202) {
        throw new Error(`Unable to confirm user account: ${resp.data.message}`)
    }
    return resp.data
}

/**
 * Creates an ImageEngine subscription for with the given attributes
 * @example payload:
 * {
 *     type: 'imgeng',
 *     plan_id: 'IMAGEENGINE_BASIC',
 *     payment_type: 'TRIAL',
 *     user_id: 100,
 *     account_name: 'Some account name',
 *     pro_standard: false,
 *     use_defaults: true,
 * }
 * Example response:
 * {
 *     "success": true,
 *     "status": 201,
 *     "message": "Subscription is set successfully ...",
 *     "result": {
 *         "user": {
 *             "id": 23412,
 *             "username": "foobar115@gmail.com",
 *             "email": "foobar115@gmail.com",
 *             "first_name": null,
 *             "middle_name": null,
 *             "last_name": null,
 *             "company_name": null,
 *             "phone": null,
 *             "country_id": 1,
 *             "customer_id": null,
 *             "usage_comment": null,
 *             "enabled": 1,
 *             "user_type": 0,
 *             "date_last_modified": null,
 *             "reseller_id": null,
 *             "reseller_admin_id": null,
 *             "remember_token": null,
 *             "ns_customer_id": null,
 *             "zendesk_tier_id": null,
 *             "qb_customer_id": null,
 *             "confirmed": 1,
 *             "cloud_subscriptions": [],
 *             "wurfljs_subscriptions": [],
 *             "user_roles": null,
 *             "subscriptions": [
 *                 {
 *                     "id": 12684,
 *                     "user_id": 23412,
 *                     "account_name": "",
 *                     "vault_customer_id": null,
 *                     "vault_subscription_id": null,
 *                     "payment_type": "TRIAL",
 *                     "payment_plan": "IMAGEENGINE_BASIC",
 *                     "payment_method_token": null,
 *                     "num_capability_addons": 0,
 *                     "date_started": "2019-12-09 16:39:50",
 *                     "date_last_payment": null,
 *                     "date_expiration": null,
 *                     "status": "PENDING_PAYMENT_INFORMATION",
 *                     "status_type": null,
 *                     "date_last_modified": "2019-12-09 16:39:50",
 *                     "date_trial_end": null,
 *                     "type": "imgeng",
 *                     "image_engine_tier_id": 1,
 *                     "payment_link": "C9HuPdWeJmC0P8CH0cI61qXb19CIK9lbWkokHXVAslWnsAC6LG1a0izsU7B9",
 *                     "wit_crb_id": null,
 *                     "plan": {
 *                         "plan": "IMAGEENGINE_BASIC",
 *                         "label": "ImageEngine Basic",
 *                         "name": "ImageEngine Basic",
 *                         "key": "IMAGEENGINE_BASIC",
 *                         "url": "imageengine",
 *                         "price": 100,
 *                         "limit": 250,
 *                         "overage_fee": 0.4,
 *                         "trial_days": 30,
 *                         "addons": {
 *                             "bandwidth": {
 *                                 "name": "Bandwidth",
 *                                 "price": 0.4,
 *                                 "value": 1,
 *                                 "id": "IMAGEENGINE_BASIC_BANDWIDTH",
 *                                 "nice_name": "$0.4 per 1 GB image SmartBytes overage per month"
 *                             }
 *                         }
 *                     },
 *                     "plan_changes": [],
 *                     "extras": [],
 *                     "downgrades": {
 *                         "plan": [],
 *                         "tier": []
 *                     }
 *                 }
 *             ]
 *         },
 *         "subscription": {
 *             "user_id": 12345,
 *             "account_name": "",
 *             "payment_plan": "IMAGEENGINE_BASIC",
 *             "payment_type": "TRIAL",
 *             "date_started": {
 *                 "date": "2019-12-09 16:39:50.645250",
 *                 "timezone_type": 3,
 *                 "timezone": "America/New_York"
 *             },
 *             "date_last_modified": {
 *                 "date": "2019-12-09 16:39:50.682298",
 *                 "timezone_type": 3,
 *                 "timezone": "America/New_York"
 *             },
 *             "date_last_payment": null,
 *             "date_expiration": null,
 *             "status": "PENDING_PAYMENT_INFORMATION",
 *             "type": "imgeng",
 *             "image_engine_tier_id": 1,
 *             "wit_crb_id": null,
 *             "id": 12345,
 *             "payment_link": "dfjaljflakfjalkfjalkfj",
 *             "plan": {
 *                 "plan": "IMAGEENGINE_BASIC",
 *                 "label": "ImageEngine Basic",
 *                 "name": "ImageEngine Basic",
 *                 "key": "IMAGEENGINE_BASIC",
 *                 "url": "imageengine",
 *                 "price": 100,
 *                 "limit": 250,
 *                 "overage_fee": 0.4,
 *                 "trial_days": 30,
 *                 "addons": {
 *                     "bandwidth": {
 *                         "name": "Bandwidth",
 *                         "price": 0.4,
 *                         "value": 1,
 *                         "id": "IMAGEENGINE_BASIC_BANDWIDTH",
 *                         "nice_name": "$0.4 per 1 GB image SmartBytes overage per month"
 *                     }
 *                 }
 *             },
 *             "plan_changes": [],
 *             "extras": [],
 *             "downgrades": {
 *                 "plan": [],
 *                 "tier": []
 *             }
 *         }
 *     }
 * }
 * @param {Object} payload - New subscription properties
 * @returns {Object} Newly-created user and subscription in CoreAPI response
 */
const createImageEngineSubscription = async (payload) => {
    const path = '/wit/imageengine/admin-create'
    const resp = await doPost(path, payload)
    console.log(`Create subscription: ${resp.status}`)
    return resp.data
}

/**
 * Creates an ImageEngine origin configuration
 * @example payload:
 * {
 *     subscription_id:  12345,
 *     name: 'default', // use 'default' for the default origin
 *     url: 'https://foo.bar.com',
 *     hostname: '',
 *     url_type: 'https', // must match the url above!
 * }
 * Example successful response:
 * {
 *     "subscription_id": 12687,
 *     "name": "default",
 *     "url": "https://srkdev.com",
 *     "hostname": "",
 *     "url_type": "https",
 *     "updated_at": "2019-12-10 20:44:22",
 *     "created_at": "2019-12-10 20:44:22",
 *     "id": 294
 * }
 * @param {Object} payload - New origin configuration
 */
const createImageEngineOrigin = async (payload) => {
    const path = '/wit_origins'
    const resp = await doPost(path, payload)
    console.log(`Create origin: ${resp.status}`)
    return resp.data
}

/**
 * Creates an ImageEngine domain configuration
 * @example payload:
 * {
 *     subscription_id: 1234,
 *     url: '',
 *     hostname: '',
 *     cname: generatedDomainName,
 *     url_type: 'https', // must match the url above!
 *     origin_conf_id: 2314,
 *     iam_flag: 0,
 *     ie_only_flag: 0,
 *     allow_origin_prefix: 1,
 *     custom_wildcard_flag: 0,
 *     transition_time: 300,
 * }
 * Example successful response:
 * {
 *     "subscription_id": 12876,
 *     "url": "",
 *     "hostname": "",
 *     "cname": "fydzoku1.cdn",
 *     "url_type": "http",
 *     "iam_flag": 0,
 *     "ie_only_flag": 0,
 *     "allow_origin_prefix": 1,
 *     "custom_wildcard_flag": 0,
 *     "transition_time": 300,
 *     "updated_at": "2019-12-17 20:07:16",
 *     "created_at": "2019-12-17 20:07:16",
 *     "id": 639
 * }
 * @param {Object} payload - New domain configuration
 */
const createImageEngineDomain = async (payload) => {
    const path = '/wit_domain_confs'
    const resp = await doPost(path, payload)
    console.log(`Create domain: ${resp.status}`)
    return resp.data
}

/**
 * Creates an ImageEngine Demo Run
 * @example payload:
 * {
 *     subscription_id:  12345,
 *     date_run: '2019-12-10 20:44:22',
 *     demo_id: '5ef5b29f-94de-4bc8-a211-34e8801174b2',
 *     domain: '',
 *     url: ''
 * }
 * Example successful response:
 * {
 * }
 * @param {Object} payload - New origin configuration
 */
const createImageEngineDemoRun = async (payload) => {
    const path = '/wit/imageengine/demo-run'
    const resp = await doPost(path, payload)
    console.log(`Create Demo Run: ${resp.status}`)
    return resp.data
}

/**
 * Adds a new ImageEngine Lead Gen
 * @example payload:
 * {
 *     subscription_id:  12345,
 *     date_referred: '2019-12-10 20:44:22',
 *     campaign_name: 'Carbon Ads',
 *     url_query_string: '',
 * }
 * Example successful response:
 * {
 * }
 * @param {Object} payload - New origin configuration
 */
const createImageEngineLeadGen = async (payload) => {
    const path = '/wit/imageengine/add-lead-gen'
    const resp = await doPost(path, payload)
    console.log(`Add Lead Gen: ${resp.status}`)
    return resp.data
}

/**
 * Sends a password reset email to the speficied user
 * NOTE: In staging, emails are logged in the Laravel log but are not sent
 * @example payload:
 * {
 * 	"email": "foo@gmail.com",
 * 	"template": "imageengine"
 * }
 * Example successful response
 * {
 *     "success": true,
 *     "type": "eloquent",
 *     "message": "Password reset email sent",
 *     "data": [],
 *     "pagination": [],
 *     "debug": [],
 *     "status": 200
 * }
 * @param {Object} payload
 */
const sendPasswordResetEmail = async (payload) => {
    const path = '/password_reset'
    const resp = await doPost(path, payload)
    console.log(`Send password reset: ${resp.status}`)
    return resp
}

/**
 * Sends a Welcome email to the speficied user
 * NOTE: In staging, emails are logged in the Laravel log but are not sent
 * @example payload:
 * {
 * 	"subscription_id": "13380"
 * }
 * Example successful response
 * {
 *     "success": true,
 *     "type": "eloquent",
 *     "message": "Welcome email sent",
 *     "data": [],
 *     "pagination": [],
 *     "debug": [],
 *     "status": 200
 * }
 * @param {Object} payload
 */
const sendImageEngineWelcomeEmail = async (payload) => {
    const path = '/wit/imageengine/send-welcome-email'
    const resp = await doPost(path, payload)
    console.log(`Send welcome email: ${resp.status}`)
}

/**
 * Example response:
 * [
 *     {
 *         "RegionName": "us-east-1",
 *         "Deploy": "ALL"
 *     },
 *     {
 *         "RegionName": "us-east-2",
 *         "Deploy": "ALL"
 *     }
 * ],
 */
const getAWSRegions = async () => {
    const path = '/wit/imageengine/aws/regions'
    const resp = await doGet(path)
    console.log(`Get AWS Regions: ${resp.status}`)
    return resp.data
}

const getCountryID = async (countryCode) => {
    const path = `/country/search:(code=${encodeURIComponent(countryCode)})`
    const resp = await doGet(path)
    console.log(`Get Country Code: ${resp.status}`)
    if (resp.data.data.length === 0) {
        throw Error('Country could not be found')
    }
    return resp.data.data[0]
}

/**
 * Configures DNS records for an ImageEngine domain
 * @example payload:
 * {
 * 	"action": "CREATE",
 * 	"records": [
 *    {
 *       "domain": "foo.bar.com",
 *       "region": "us-east-2",
 *       "type": "A"
 *    }
 *  ]
 * }
 * Example successful response
 * {
 *     "success": true,
 *     "type": "eloquent",
 *     "message": "Password reset email sent",
 *     "data": [],
 *     "pagination": [],
 *     "debug": [],
 *     "status": 200
 * }
 * @param {Object} payload
 */
const createDNSRecords = async (records) => {
    let payload = {
        action: 'CREATE',
        records: records,
    }
    const path = '/wit/imageengine/resource/record'
    const resp = await doPost(path, payload)
    console.log(`Send password reset: ${resp.status}`)
    return resp.data
}

module.exports = {
    // CoreAPI Authenticaion
    getNewAccessToken: getNewAccessToken,
    setCredentials: setCredentials,
    getAccessToken: getAccessToken,
    // User/Account/Subscription Methods
    checkCredentials: checkCredentials,
    setCacheDir: setCacheDir,
    getUserByID: getUserByID,
    searchUsers: searchUsers,
    createUser: createUser,
    createImageEngineSubscription: createImageEngineSubscription,
    createImageEngineOrigin: createImageEngineOrigin,
    createImageEngineDomain: createImageEngineDomain,
    createImageEngineDemoRun: createImageEngineDemoRun,
    createImageEngineLeadGen: createImageEngineLeadGen,
    sendImageEngineWelcomeEmail: sendImageEngineWelcomeEmail,
    sendPasswordResetEmail: sendPasswordResetEmail,
    getAWSRegions: getAWSRegions,
    createDNSRecords: createDNSRecords,
    getCountryID: getCountryID,
}
