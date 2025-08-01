
// backend/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User.js");
const dotenv = require("dotenv");

dotenv.config();
const router = express.Router();

// User Login with extensive debugging
router.post("/login", async (req, res) => {
  console.log("==== LOGIN ATTEMPT STARTED ====");
  console.log("Request body:", req.body);

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      console.log("Missing credentials:", { email: !!email, password: !!password });
      return res.status(400).json({ msg: "Please provide email and password" });
    }

    // CRITICAL DEBUG: Log the exact query we're using to find the user
    console.log("Searching for user with email:", email);

    // Find user by email (case insensitive search)
    const user = await User.findOne({ email: { $regex: new RegExp('^' + email + '$', 'i') } });

    // Debug user search results
    if (!user) {
      console.log("❌ USER NOT FOUND in database. Available users:");

      // List all users in the database for debugging (REMOVE IN PRODUCTION)
      const allUsers = await User.find({}, 'email');
      console.log(allUsers.map(u => u.email));

      return res.status(404).json({ msg: "Email not found. Please check your email or sign up." });
    }

    console.log("✅ USER FOUND:", user.email);
    console.log("Stored password hash:", user.password.substring(0, 10) + "...");

    // DIRECT PASSWORD COMPARISON
    console.log("Comparing provided password with stored hash...");
    const isMatch = await bcrypt.compare(password, user.password);

    console.log("Password match result:", isMatch);

    if (!isMatch) {
      return res.status(401).json({ msg: "Incorrect password. Please try again." });
    }

    // SUCCESS PATH
    console.log("✅ Authentication successful! Generating token...");

    // Create JWT token with debugging
    const payload = { userId: user._id };
    console.log("Token payload:", payload);

    // Check if JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
      console.error("❌ CRITICAL ERROR: JWT_SECRET is not defined in environment variables!");
      return res.status(500).json({ msg: "Server configuration error. Please contact support." });
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "3d" });
    console.log("Token generated successfully:", token.substring(0, 15) + "...");

    // Return success response
    console.log("==== LOGIN ATTEMPT COMPLETED SUCCESSFULLY ====");

    return res.status(200).json({
      msg: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {
    console.error("❌ SERVER ERROR during login:", err);
    res.status(500).json({ msg: "Server error. Please try again later." });
  }
});

// backend/routes/auth.js (add below the /login route)

router.post("/signup", async (req, res) => {
  console.log("Received signup request body:", req.body);
  try {
    const {
      name,
      email,
      password,
      location,
      availability,
      skillsOffered,
      skillsWanted,
    } = req.body;

    // Validate required fields
    if (!name || !email || !password || !skillsOffered?.length || !skillsWanted?.length) {
      return res.status(400).json({ msg: "Please provide all required fields." });
    }

    // Enum check for availability
    const allowedAvailability = ["Weekdays", "Evenings", "Weekends", "Flexible"];
    if (availability && !allowedAvailability.includes(availability)) {
      return res.status(400).json({ msg: `Invalid availability. Must be one of: ${allowedAvailability.join(", ")}` });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ msg: "User already exists with this email." });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      location,
      availability,
      skillsOffered,
      skillsWanted,
    });

    await newUser.save();

    return res.status(201).json({ success: true, msg: "User registered successfully." });
  } catch (err) {
    console.error("Signup error:", err);

    // ✅ Better validation error message from Mongoose
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, msg: `Validation failed: ${errors.join(", ")}` });
    }

    return res.status(500).json({ success: false, msg: "Server error during signup." });
  }
});


module.exports = router;
