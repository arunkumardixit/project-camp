import {User} from '../models/user.model.js';
import {ApiResponse} from '../utils/api-response.js';
import ApiError from '../utils/api-error.js';
import {asyncHandler} from '../utils/async-handler.js';
import jwt from 'jsonwebtoken';

const verifyJWT = asyncHandler(async (req, res, next) => {
   
    const access_token = req.cookies?.access_token || req.headers?.authorization?.split(' ')[1];
    if (!access_token) {
        throw new ApiError(401, 'Unauthorized request', []);
    }

    const decodedToken = jwt.verify(access_token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedToken._id).select('-password -refreshToken');
    if (!user) {
        throw new ApiError(401, 'Invalid access token', []);
    }

    req.user = user;
    next();
});

export {verifyJWT};
