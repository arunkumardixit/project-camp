import Router from 'express';
import { registerUser } from '../controllers/auth.controller.js';
import { userRegisterValidator, loginUserValidator } from '../validators/index.js';
import { validate } from '../middlewares/validator.middleware.js';
import { loginUser } from '../controllers/auth.controller.js';
import { logoutUser } from '../controllers/auth.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { getCurrentUser } from '../controllers/auth.controller.js';
import { changePassword } from '../controllers/auth.controller.js';
import { userChangeCurrentPasswordValidator } from '../validators/index.js';
import { forgotPassword } from '../controllers/auth.controller.js';
import { userForgotPasswordValidator } from '../validators/index.js';
import { resetPassword } from '../controllers/auth.controller.js';
import { userResetPasswordValidator } from '../validators/index.js';
import { verifyEmail } from '../controllers/auth.controller.js';
import { resendVerificationEmail } from '../controllers/auth.controller.js';
import { refreshAccessToken } from '../controllers/auth.controller.js';

const router = Router();

//unsecured routes
router.route('/register').post(userRegisterValidator(), validate, registerUser);
router.route('/login').post(loginUserValidator(), validate, loginUser);
router.route('/reset-password/:resetToken').post(userResetPasswordValidator(), validate, resetPassword);
router.route('/verify-email/:verificationToken').get(verifyEmail);
router.route('/resend-verification-email').post(resendVerificationEmail);
router.route('/forgot-password').post(userForgotPasswordValidator(), validate, forgotPassword);
router.route('/refresh-access-token').post(refreshAccessToken);

//secure route

router.route('/profile').get(verifyJWT, getCurrentUser);
router.route('/change-password').post(verifyJWT, userChangeCurrentPasswordValidator(), validate, changePassword);
router.route('/logout').post(verifyJWT,logoutUser);
router.route('/resend-verification-email').post(verifyJWT, resendVerificationEmail);
export default router;