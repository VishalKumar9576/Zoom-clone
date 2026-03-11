import httpStatus from "http-status";
import { User } from "../models/user.model.js";
import bcrypt, { hash } from "bcrypt"
import mongoose from "mongoose";
import crypto from "crypto"
import { Meeting } from "../models/meeting.model.js";
const login = async (req, res) => {

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Please Provide" })
    }

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "User Not Found" })
        }


        let isPasswordCorrect = await bcrypt.compare(password, user.password)

        if (isPasswordCorrect) {
            let token = crypto.randomBytes(20).toString("hex");

            user.token = token;
            await user.save();
            return res.status(httpStatus.OK).json({ token: token })
        } else {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid Username or password" })
        }

    } catch (e) {
        return res.status(500).json({ message: `Something went wrong ${e}` })
    }
}


const register = async (req, res) => {
    const { name, username, password } = req.body;

    // Validate input
    if (!name || !username || !password) {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Please provide name, username, and password" });
    }

    try {
        // Check MongoDB connection
        if (mongoose.connection.readyState !== 1) {
            console.error("MongoDB is not connected. Connection state:", mongoose.connection.readyState);
            return res.status(httpStatus.SERVICE_UNAVAILABLE).json({ message: "Database connection not available" });
        }

        console.log(`Attempting to register user: ${username}`);
        console.log(`MongoDB Connection State: ${mongoose.connection.readyState}`);
        console.log(`Database Name: ${mongoose.connection.name}`);

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            console.log(`User ${username} already exists`);
            return res.status(httpStatus.CONFLICT).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name: name,
            username: username,
            password: hashedPassword
        });

        console.log(`Saving user to database: ${username}`);
        const savedUser = await newUser.save();
        
        console.log(`User saved successfully!`);
        console.log(`User ID: ${savedUser._id}`);
        console.log(`User Name: ${savedUser.name}`);
        console.log(`Username: ${savedUser.username}`);
        console.log(`Database: ${mongoose.connection.name}`);
        console.log(`Collection: ${savedUser.collection.name}`);

        // Verify the user was saved by querying it back
        const verifyUser = await User.findById(savedUser._id);
        if (verifyUser) {
            console.log(`Verification: User found in database with ID: ${verifyUser._id}`);
        } else {
            console.error(`Warning: User was not found after save!`);
        }

        res.status(httpStatus.CREATED).json({ 
            message: "User Registered Successfully",
            userId: savedUser._id 
        });

    } catch (e) {
        console.error("Registration error:", e);
        console.error("Error details:", {
            message: e.message,
            code: e.code,
            name: e.name,
            stack: e.stack
        });
        
        if (e.code === 11000) {
            return res.status(httpStatus.CONFLICT).json({ message: "Username already exists" });
        }
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ 
            message: `Something went wrong: ${e.message}`,
            error: process.env.NODE_ENV === 'development' ? e.stack : undefined
        });
    }

}


const getUserHistory = async (req, res) => {
    const { token } = req.query;

    try {
        const user = await User.findOne({ token: token });
        const meetings = await Meeting.find({ user_id: user.username })
        res.json(meetings)
    } catch (e) {
        res.json({ message: `Something went wrong ${e}` })
    }
}

const addToHistory = async (req, res) => {
    const { token, meeting_code } = req.body;

    try {
        const user = await User.findOne({ token: token });

        const newMeeting = new Meeting({
            user_id: user.username,
            meetingCode: meeting_code
        })

        await newMeeting.save();

        res.status(httpStatus.CREATED).json({ message: "Added code to history" })
    } catch (e) {
        res.json({ message: `Something went wrong ${e}` })
    }
}


export { login, register, getUserHistory, addToHistory }