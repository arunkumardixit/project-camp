import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./db/index.js";
 dotenv.config(({
        path: "./.env"
    }));

connectDB()
.then(() => {
    console.log("Connected to the database");
   

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
})
.catch((err) => {
    console.error(`Error connecting to the database: ${err.message}`);
    process.exit(1);
});

