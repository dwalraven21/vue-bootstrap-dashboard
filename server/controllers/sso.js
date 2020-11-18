const axios = require('axios')
const crypto = require('crypto')
const express = require('express')
const asyncroutes = require('../middleware/asyncroutes')
const router = express.Router()
const axiosClient = axios.create({
    timeout: 5000,
    headers: {
        'user-agent': 'ImageEngine by ScientiaMobile +https//imageengine.io',
    },
})

router.get(
    '/github-url',
    asyncroutes(async (req, res) => {
        // Generate a random state var
        const state = crypto.randomBytes(8).toString('hex')

        // Save the state in the user's session for later usage
        req.session.githubState = state

        const params = new URLSearchParams({
            client_id: process.env.GITHUB_CLIENT_ID,
            scope: 'user:email',
            redirect_uri: `${process.env.SITE_URL}/api/v1/auth/sso/github`,
            state: state,
        })

        const baseURL = 'https://github.com/login/oauth/authorize'
        const githubURL = `${baseURL}?${params.toString()}`

        // Redirect the user to Github's OAuth page
        res.redirect(302, githubURL)
    })
)

router.get(
    '/github',
    asyncroutes(async (req, res) => {
        console.log('Github callback received')

        // if (req.session.githubState === undefined) {
        //     // TODO: Cleanup with HTML
        //     res.status(400).send('Unauthorized [no state]')
        //     return
        // }

        // if (req.session.githubState !== req.query.state) {
        //     // TODO: Cleanup with HTML
        //     res.status(400).send('Unauthorized [invalid state]')
        //     return
        // }

        if (!req.query.code) {
            // TODO: Cleanup with HTML
            res.status(400).send('Unauthorized [invalid code]')
            return
        }

        const params = new URLSearchParams({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code: req.query.code,
            state: req.query.state,
        })

        const baseURL = 'https://github.com/login/oauth/access_token'
        const githubURL = `${baseURL}?${params.toString()}`

        try {
            const resp = await axiosClient.get(githubURL)
            const respParams = new URLSearchParams(resp.data)
            const err = respParams.get('error_description')
            if (err !== null) {
                // TODO: Cleanup with HTML
                res.status(400).send(`Unauthorized [${err}]`)
                return
            }

            const accessToken = respParams.get('access_token')
            if (accessToken === null) {
                // TODO: Cleanup with HTML
                res.status(400).send(`Unauthorized [invalid access token]`)
                return
            }

            // access_token = 5c07d009f69a7ed7bcd729a517981fb8cc02dfee & scope=user % 3Aemail & token_type=bearer
            // Authorization: token OAUTH-TOKEN
            const authHeaders = {
                headers: { authorization: 'token ' + accessToken },
            }

            const userDetails = await axiosClient.get(
                'https://api.github.com/user',
                authHeaders
            )
            if (
                !userDetails.data.email ||
                !userDetails.data.email.match('/@/')
            ) {
                // There is no email in the profile, go looking deeper
                let chosenEmail = ''
                console.log('Fetching other emails from Github')
                try {
                    const userEmails = await axiosClient.get(
                        'https://api.github.com/user/emails',
                        authHeaders
                    )
                    if (userEmails.data.forEach !== undefined) {
                        let candidates = []
                        candidates = userEmails.data.filter((a) => a.primary)
                        if (candidates.length > 0) {
                            chosenEmail = candidates[0].email
                        } else {
                            candidates = userEmails.data.filter(
                                (a) => a.verified
                            )
                            if (candidates.length > 0) {
                                chosenEmail = candidates[0].email
                            }
                        }
                    }
                } catch (err) {
                    console.log(
                        `Failed to fetch user email address from Github API: ${err}`
                    )
                }

                if (!chosenEmail) {
                    // TODO: Cleanup with HTML
                    res.status(400).send(
                        `Unauthorized [unable to determine email address]`
                    )
                    return
                }

                userDetails.data.email = chosenEmail
            }

            req.session.githubUserDetails = userDetails.data

            // Tell the child window to clise
            res.send(
                '<!DOCTYPE html><html><head></head><body onload="window.opener.completeGithub(); window.close()"></body></html>'
            )
        } catch (err) {
            // TODO: Cleanup with HTML
            res.status(400).send(`Unauthorized [${err}]`)
        }
    })
)

module.exports = router
