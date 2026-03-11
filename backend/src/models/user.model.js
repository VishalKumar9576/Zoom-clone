import mongoose, { Schema } from "mongoose";

const userScheme = new Schema(
    {
        name: { type: String, required: true },
        username: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        token: { type: String }
    },
    {
        timestamps: true // Automatically adds createdAt and updatedAt fields
    }
)

const User = mongoose.model("User", userScheme);

export { User };