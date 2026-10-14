import jwt from 'jsonwebtoken';
import Company from '../models/Company.js';

export const protectCompany = async (req, res, next) => {

    const token = req.headers.token

    if(!token){
        return res.json({success:false, message:'Not Authorized, Login Again'})
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const company = await Company.findById(decoded.id).select('-password')

        // Reject missing accounts, suspended accounts and sessions revoked by a password reset
        if (!company || company.status === 'suspended' || (decoded.tv || 0) !== (company.tokenVersion || 0)) {
            return res.json({success:false, message:'Not Authorized, Login Again'})
        }

        req.company = company
        next()

    } catch (error) {
        res.json({success:false, message:'Not Authorized, Login Again'})
    }
}
