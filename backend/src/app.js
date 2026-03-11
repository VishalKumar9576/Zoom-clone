import express from "express";
import { createServer } from "node:http";

import { Server } from "socket.io";

import mongoose from "mongoose";
import { connectToSocket } from "./controllers/socketManager.js";

import cors from "cors";
import userRoutes from "./routes/users.routes.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = connectToSocket(server);


app.set("port", (process.env.PORT || 8000))
app.use(cors());
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.use("/api/v1/users", userRoutes);

/**
 * Validates MongoDB connection string format
 * @param {string} uri - MongoDB connection URI
 * @returns {object} - { valid: boolean, error: string }
 */
const validateMongoUri = (uri) => {
    if (!uri) {
        return { valid: false, error: "MONGODB_URI is not defined in environment variables" };
    }

    // Check if it's a valid MongoDB URI format
    const mongoUriPattern = /^mongodb(\+srv)?:\/\//;
    if (!mongoUriPattern.test(uri)) {
        return { 
            valid: false, 
            error: "Invalid MongoDB URI format. Must start with 'mongodb://' or 'mongodb+srv://'" 
        };
    }

    // Check for required components
    if (!uri.includes('@') && !uri.includes('localhost') && !uri.includes('127.0.0.1')) {
        return { 
            valid: false, 
            error: "MongoDB URI appears to be missing authentication or host information" 
        };
    }

    return { valid: true, error: null };
};

/**
 * Starts the server and connects to MongoDB
 * Provides detailed error messages if connection fails
 */
const start = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI;
        
        // Validate MongoDB URI format
        const validation = validateMongoUri(mongoUri);
        if (!validation.valid) {
            console.error("✗ MongoDB Connection Error:");
            console.error(`  ${validation.error}`);
            console.error("\nPlease check your .env file and ensure MONGODB_URI is set correctly.");
            console.error("Example format: mongodb://username:password@host:port/database");
            console.error("Or for MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/database");
            process.exit(1);
        }

        console.log("Attempting to connect to MongoDB...");
        const maskedUri = mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
        console.log("Connection URI:", maskedUri);
        
        // Set up connection event handlers
        mongoose.connection.on('connected', () => {
            console.log('✓ Mongoose connected to MongoDB');
            console.log(`  - Database: ${mongoose.connection.name}`);
            console.log(`  - Host: ${mongoose.connection.host}`);
        });

        mongoose.connection.on('error', (err) => {
            console.error('✗ Mongoose connection error:', err.message);
            if (err.message.includes('authentication failed')) {
                console.error('  → Check your username and password in MONGODB_URI');
            } else if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
                console.error('  → Check your MongoDB host address in MONGODB_URI');
            } else if (err.message.includes('timeout')) {
                console.error('  → Connection timeout - check your network or MongoDB server status');
            }
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠ Mongoose disconnected from MongoDB');
        });
        
        // Attempt connection with timeout
        const connectionDb = await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000, // Timeout after 10s
            connectTimeoutMS: 10000,
        });
        
        console.log(`✓ MongoDB Connected Successfully!`);
        console.log(`  - DB Host: ${connectionDb.connection.host}`);
        console.log(`  - Database Name: ${connectionDb.connection.name}`);
        console.log(`  - Connection State: ${connectionDb.connection.readyState} (1 = connected)`);
        
        // Verify connection is ready
        if (connectionDb.connection.readyState === 1) {
            console.log(`✓ Database connection is ready for operations`);
            
            // List all collections to verify we're connected to the right database
            try {
                const collections = await connectionDb.connection.db.listCollections().toArray();
                console.log(`  - Collections in database: ${collections.map(c => c.name).join(', ') || 'None (empty database)'}`);
            } catch (collectionError) {
                console.warn(`  - Could not list collections: ${collectionError.message}`);
            }
        } else {
            console.warn(`⚠ Warning: Connection state is ${connectionDb.connection.readyState}`);
            console.warn(`  Expected: 1 (connected), Got: ${connectionDb.connection.readyState}`);
        }
        
        server.listen(app.get("port"), () => {
            console.log(`✓ Server listening on port ${app.get("port")}`);
        });
    } catch (error) {
        console.error("\n✗ Error connecting to MongoDB:");
        console.error(`  ${error.message}`);
        
        // Provide specific error messages based on error type
        if (error.message.includes('authentication failed')) {
            console.error("\n  → Authentication failed. Please check:");
            console.error("     - Username and password in MONGODB_URI");
            console.error("     - Database user has proper permissions");
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
            console.error("\n  → Host not found. Please check:");
            console.error("     - MongoDB host address in MONGODB_URI");
            console.error("     - Network connectivity");
            console.error("     - For MongoDB Atlas: Check cluster URL");
        } else if (error.message.includes('timeout')) {
            console.error("\n  → Connection timeout. Please check:");
            console.error("     - MongoDB server is running");
            console.error("     - Network connectivity");
            console.error("     - Firewall settings");
            console.error("     - For MongoDB Atlas: Check IP whitelist");
        } else if (error.message.includes('Invalid connection string')) {
            console.error("\n  → Invalid connection string format. Please check:");
            console.error("     - MONGODB_URI format in .env file");
            console.error("     - Example: mongodb://user:pass@host:port/db");
        } else {
            console.error("\n  → Please verify your MONGODB_URI in .env file");
        }
        
        console.error("\nFull error details:", error);
        console.error("\nPlease fix the MongoDB connection issue and restart the server.");
        process.exit(1);
    }
}



start();