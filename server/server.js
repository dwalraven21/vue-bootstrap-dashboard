//==================
//DEPENDENCIES
//===================
const path = require('path')
const express = require('express')
const app = express()
const configureApp = require('./configure')
const root = path.resolve(__dirname, '../')

//====================
//PORT
//====================
const port = process.env.PORT || 3000

// app.use(prerenderNode)

// Serve prerendered index.html files if they exist
// Note: Most static files (*.jpg, *.js, etc) are served by nginx directly
const staticPath = path.join(root, 'dist')
const staticConf = {
    etag: false,
    cacheControl: false,
    acceptRanges: false,
    lastModified: false,
}
app.use(express.static(staticPath, staticConf))

// Setup backend routes
configureApp(app)

// Catch-all route for Vue routes
// Requests that end up here are not static files or API routes, serve the index.html file
const catchAllPath = path.join(staticPath, 'index.html')
app.use((req, res) => {
    // console.log("Serving catch-all")
    res.sendFile(catchAllPath)
})

//==================
// LISTENER
//==================
console.log(`Starting ImageEngine control panel on port ${port}`)
app.listen(port)
