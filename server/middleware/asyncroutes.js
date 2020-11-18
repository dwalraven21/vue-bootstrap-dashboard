/**
 * This middleware is used to wrap async routes and handle any thrown errors
 */

module.exports = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next)
    }
}
