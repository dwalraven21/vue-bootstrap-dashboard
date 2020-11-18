const express = require('express')
const router = express.Router()

const productionValue = `
User-agent: *
Disallow:
Sitemap: ${process.env.SITE_URL}/sitemap.xml
`

const nonProductionValue = `
User-agent: *
Disallow: /
`

router.get('/', (req, res) => {
    res.setHeader('content-type', 'text/plain')
    if (process.env.NODE_ENV === 'production') {
        res.send(productionValue)
        return
    }

    res.send(nonProductionValue)
})

module.exports = router
