import {User} from '../models/user.model.js';
import {ApiResponse} from '../utils/api-response.js';
import ApiError from '../utils/api-error.js';
import {asyncHandler} from '../utils/async-handler.js';
import {sendEmail} from '../utils/mail.js';
import {emailVerificationMailgenContent} from '../utils/mail.js';

const generateAccessAndRefreshTokens = async (userId) => {
    try{
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, 'User not found', []);  
    }
     const access_token = user.generateAccessToken();
     const refresh_token = user.generateRefreshToken();
     user.refreshToken = refresh_token;
     user.access_token = access_token;
     user.save({validateBeforeSave: false});
     return { access_token, refresh_token };
    } catch (error) {
        throw new ApiError(500, 'Error generating tokens', [error.message]);
    }
};

const registerUser = asyncHandler(async (req, res, next) => {
    const {username, email, password} = req.body;

    console.log("Registering user with email:", email, "and username:", username);
    // Check if user already exists
    const existingUser = await User.findOne({
        $or: [{email: email}, {username: username}],
        });
    if (existingUser) {
        throw new ApiError(409,'User already exists',[]);
    }

    console.log("Checked user with email:", email, "and username:", username);
    const user = await User.create({
        email: email.toLowerCase(),
        password: password,
        username: username.toLowerCase().replace(/\s+/g, ''),
        isEmailVerified: false,
    });

    const { unhashedToken, hashedToken, tokenExpiry} =  user.generateTemporaryToken();

    user.emailVerificationToken = hashedToken;
    user.emailVerificationTokenExpiry = tokenExpiry;
    await user.save({validateBeforeSave: false});
    
    // const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${unhashedToken}&email=${user.email}`;
       const verificationLink = `${req.protocol}://${req.get("host")}/api/v1/auth/verify-email/${unhashedToken}`;

    await sendEmail({
        email: user?.email,
        subject: 'Verify your email address',
        mailGeneratorContent: emailVerificationMailgenContent(user.username, verificationLink),
    });

    const createdUser = await User.findById(user._id).select('-password -refreshToken -forgotPasswordToken -forgotPasswordTokenExpiry -emailVerificationToken -emailVerificationTokenExpiry');

    if (!createdUser) {
        throw new ApiError(500, 'Something went wrong. User creation failed', []);    
    }
    res.status(201).json(new ApiResponse(201, createdUser, 'User registered successfully'));
})

// 1. take data from user
// 2. validation of data
// 3. if user exists,
// 4. if password is correct
// 5. generate access token and refresh token
// 6. send tokens in cookies

const loginUser = asyncHandler(async (req, res, next) => {
    const {email, password, username} = req.body;

    if (!email && !username) {
        throw new ApiError(400, 'Email or username is required', []);
    }

    const user = await User.findOne({
        $or: [{email: email?.toLowerCase()}, {username: username?.toLowerCase()}],
    });

    if (!user) {
        throw new ApiError(404, 'User not found', []);
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
        throw new ApiError(401, 'Invalid password', []);
    }

    const { access_token, refresh_token } = await generateAccessAndRefreshTokens(user._id);



    const loggedInUser = await User.findById(user._id).select('-password -refreshToken -forgotPasswordToken -forgotPasswordTokenExpiry -emailVerificationToken -emailVerificationTokenExpiry');

   const cookieOptions = {
    httpOnly: true,
    secure: true
    };

    return res.status(200)
    .cookie('access_token', access_token, cookieOptions)
    .cookie('refresh_token', refresh_token, cookieOptions)
    .json(
        new ApiResponse(200, 
            {
                user: loggedInUser,
                access_token: access_token,
                refresh_token: refresh_token
            }, 
            'User logged in successfully')
        );


})

const logoutUser = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;

    await User.findByIdAndUpdate(userId, { refreshToken: null }, { new: true });

    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    return res.status(200).json(new ApiResponse(200, {}, 'User logged out successfully'));
});

const getCurrentUser = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;

    const user = await User.findById(userId).select('-password -refreshToken -forgotPasswordToken -forgotPasswordTokenExpiry -emailVerificationToken -emailVerificationTokenExpiry');

    if (!user) {
        throw new ApiError(404, 'User not found', []);
    }

    return res.status(200).json(new ApiResponse(200, user, 'Current user retrieved successfully'));
});

const verifyEmail = asyncHandler(async (req, res, next) => {
    const { verificationToken } = req.params;

    if (!verificationToken) {
        throw new ApiError(400, 'Verification token is missing', []);
    }

    let hashedToken;
    try {
        hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    } catch (error) {
        throw new ApiError(500, 'Error hashing verification token', [error.message]);
    }

    const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
        throw new ApiError(400, 'Invalid or expired verification token', []);
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, {}, 'Email verified successfully'));
});

const resendVerificationEmail = asyncHandler(async (req, res, next) => {
    const { email } = req.body;

    if (!email) {
        throw new ApiError(400, 'Email is required', []);
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
        throw new ApiError(404, 'User not found', []);
    }

    if (user.isEmailVerified) {
        throw new ApiError(400, 'Email is already verified', []);
    }

    const { unhashedToken, hashedToken, tokenExpiry } = user.generateTemporaryToken();

    user.emailVerificationToken = hashedToken;
    user.emailVerificationTokenExpiry = tokenExpiry;
    await user.save({ validateBeforeSave: false });

    const verificationLink = `${req.protocol}://${req.get("host")}/api/v1/auth/verify-email/${unhashedToken}`;

    await sendEmail({
        email: user.email,
        subject: 'Verify your email address',
        mailGeneratorContent: emailVerificationMailgenContent(user.username, verificationLink),
    });

    return res.status(200).json(new ApiResponse(200, {}, 'Verification email resent successfully'));
});

const refreshAccessToken = asyncHandler(async (req, res, next) => {
    const incoming_refresh_token = req.cookies?.refresh_token || req.body.refresh_token;

    if (!incoming_refresh_token) {
        throw new ApiError(401, 'Refresh token is missing', []);
    }

    let decodedToken;
    try {
        decodedToken = jwt.verify(incoming_refresh_token, process.env.REFRESH_TOKEN_SECRET);
    

    const user = await User.findById(decodedToken._id);

    if (!user) {
        throw new ApiError(401, 'Invalid refresh token', []);
    }
    if(user.refreshToken !== incoming_refresh_token){
        throw new ApiError(401, 'Refresh token expired', []);
    }

    const { access_token, refresh_token: new_refresh_token } = await generateAccessAndRefreshTokens(user._id);

    const cookieOptions = {
        httpOnly: true,
        secure: true
    };

    user.refreshToken = new_refresh_token;
    user.access_token = access_token;
    await user.save({ validateBeforeSave: false });

    return res.status(200)
        .cookie('access_token', access_token, cookieOptions)
        .cookie('refresh_token', new_refresh_token, cookieOptions)
        .json(
            new ApiResponse(200, 
                {
                    access_token: access_token,
                    refresh_token: new_refresh_token
                }, 
                'Access token refreshed successfully')
            );
    } catch (error) {
        throw new ApiError(401, 'Invalid refresh token', [error.message]);
    
    }
});

const forgotPassword = asyncHandler(async (req, res, next) => {
    const { email } = req.body;

    if (!email) {
        throw new ApiError(400, 'Email is required', []);
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
        throw new ApiError(404, 'User not found', []);
    }

    const { unhashedToken, hashedToken, tokenExpiry } = user.generateTemporaryToken();

    user.forgotPasswordToken = hashedToken;
    user.forgotPasswordTokenExpiry = tokenExpiry;
    await user.save({ validateBeforeSave: false });

    const resetLink = `${process.env.FORGOT_PASSWORD_REDIRECT_URL}/${unhashedToken}`;

    await sendEmail({
        email: user.email,
        subject: 'Reset your password',
        mailGeneratorContent: `Click the following link to reset your password: ${resetLink}`,
    });

    return res.status(200).json(new ApiResponse(200, {}, 'Password reset email sent successfully'));
});


const resetPassword = asyncHandler(async (req, res, next) => {
    const { resetToken } = req.params;
    const { newPassword } = req.body;

    if (!resetToken) {
        throw new ApiError(400, 'Reset token is missing', []);
    }

    if (!newPassword) {
        throw new ApiError(400, 'New password is required', []);
    }

    let hashedToken;
    try {
        hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    } catch (error) {
        throw new ApiError(500, 'Error hashing reset token', [error.message]);
    }

    const user = await User.findOne({
        forgotPasswordToken: hashedToken,
        forgotPasswordTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
        throw new ApiError(400, 'Invalid or expired reset token', []);
    }

    user.password = newPassword;
    user.forgotPasswordToken = undefined;
    user.forgotPasswordTokenExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, {}, 'Password reset successfully'));
});

const changePassword = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        throw new ApiError(400, 'Current and new passwords are required', []);
    }

    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, 'User not found', []);
    }

    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
        throw new ApiError(401, 'Invalid current password', []);
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, {}, 'Password changed successfully'));
});

export {registerUser, loginUser, logoutUser, getCurrentUser, verifyEmail, resendVerificationEmail, refreshAccessToken, forgotPassword, resetPassword, changePassword};
