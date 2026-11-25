import Mailgen from "mailgen";
import nodemailer from "nodemailer";

const sendEmail = async (options) => {
    
    const mailGenerator = new Mailgen({
        theme: "default",
        product: {
            name: "Project Camp App",
            link: "https://yourapp.com",
            copyright: "Copyright © 2023 Project Camp App. All rights reserved.",
        },
    });
    const emailTextualContent = mailGenerator.generatePlaintext(options.mailGeneratorContent);
    const emailHtmlContent = mailGenerator.generate(options.mailGeneratorContent);
    const transporter = nodemailer.createTransport({
        host: process.env.MAILTRAP_SMTP_HOST,
        port: process.env.MAILTRAP_SMTP_PORT,
        auth: {
            user: process.env.MAILTRAP_SMTP_USERNAME,
            pass: process.env.MAILTRAP_SMTP_PASSWORD,
        },
    })

    const mail = {
        from: process.env.SMTP_FROM_EMAIL,
        to: options.email,
        subject: options.subject,
        text: emailTextualContent,
        html: emailHtmlContent,
    }
    try {
        await transporter.sendMail(mail);
        console.log("Email sent successfully");
    } catch (error) {
        console.error("Error sending email:", error);
    }

};
const emailVerificationMailgenContent = (userName, verificationLink) => {
    return {
        subject: "Verify your email address",
        body: {
            name: userName,
            intro: "Welcome to our app! Please verify your email address by clicking the button below.",
            action: {
                instructions: "Click the button to verify your email:",
                button: {
                    text: "Verify Email",
                    link: verificationLink,
                    color: "#22BC66", // Optional: customize the button color
                },
            },
            outro: "If you did not request this email, please ignore it.",
        },
    };
};

const forgotPasswordMailgenContent = (userName, resetLink) => {
    return {
        subject: "Reset your password",
        body: {
            name: userName,
            intro: "You have requested to reset your password. Please click the button below to proceed.",
            action: {
                instructions: "Click the button to reset your password:",
                button: {
                    text: "Reset Password",
                    link: resetLink,
                    color: "#FF0000", // Optional: customize the button color
                },
            },
            outro: "If you did not request this email, please ignore it.",
        },
    };
};

export { emailVerificationMailgenContent, forgotPasswordMailgenContent, sendEmail };   