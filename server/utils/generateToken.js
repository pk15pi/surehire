import jwt from 'jsonwebtoken'

// tv = session version; bumping Company.tokenVersion (password reset) invalidates older tokens.
// Tokens issued before this change have no tv and are treated as version 0.
const generateToken = (id, tokenVersion = 0) => {
    return jwt.sign({ id, tv: tokenVersion || 0 }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    })
}

export default generateToken
