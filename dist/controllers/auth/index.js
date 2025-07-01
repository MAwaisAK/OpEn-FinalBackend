"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }const Boom = require('boom');
var _user = require('../../models/user'); var _user2 = _interopRequireDefault(_user);
var _adminjs = require('../../models/admin.js'); var _adminjs2 = _interopRequireDefault(_adminjs);
var _mytribesjs = require('../../models/mytribes.js'); var _mytribesjs2 = _interopRequireDefault(_mytribesjs);
var _Messagejs = require('../../models/Message.js'); var _Messagejs2 = _interopRequireDefault(_Messagejs);
var _notificationsjs = require('../../models/notifications.js'); var _notificationsjs2 = _interopRequireDefault(_notificationsjs);
const bcrypt = require('bcrypt');




var _jwt = require('../../helpers/jwt');
var _validations = require('./validations'); var _validations2 = _interopRequireDefault(_validations);
const redis = require("../../clients/redis").default;

const nodemailer = require('nodemailer');
const crypto = require('crypto'); // For generating a unique verification token
const transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com', // Hostinger SMTP server
  port: 465,  // Port number for Hostinger SMTP (587 for TLS)
  secure: true,  // TLS/SSL setting (use 'true' for port 465, 'false' for port 587)
  auth: {
    user: "no-reply@openpreneurs.business", // Replace with your Hostinger email
    pass: "1mpactLiv!ng",  // Replace with your email password
  },
});

const { v4: uuidv4 } = require("uuid");
const admin = require("firebase-admin");

// Initialize Firebase only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const bucket = admin.storage().bucket();

// Function to upload files to Firebase and get the public URL
const handleFirebaseUpload = async (file, folder, nameFormat) => {
  const fileName = `${nameFormat}-${_uuid.v4.call(void 0, )}-${file.originalname}`;
  const blob = bucket.file(`${folder}/${fileName}`);
  const blobStream = blob.createWriteStream({
    resumable: false,
    metadata: { contentType: file.mimetype },
  });

  return new Promise((resolve, reject) => {
    blobStream.on("error", (error) => reject(error));
    blobStream.on("finish", () => {
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
        folder + "/" + fileName
      )}?alt=media`;
      resolve(publicUrl);
    });
    blobStream.end(file.buffer);
  });
};

 const deleteFromFirebase = async (photoUrl) => {
  try {
    console.log(`File Path: ${photoUrl}`);
    const decodedUrl = decodeURIComponent(photoUrl);
    const pathStartIndex = decodedUrl.indexOf("/o/") + 3;
    const pathEndIndex = decodedUrl.indexOf("?alt=media");
    const filePath = decodedUrl.slice(pathStartIndex, pathEndIndex);

    // Allow only specific folders (update as needed)
    if (
      !filePath.startsWith("DisplayPhoto/") &&
      !filePath.startsWith("DisplayBanner/") &&
      !filePath.startsWith("Thumbnail/") &&
      !filePath.startsWith("CourseFiles/")
    ) {
      throw new Error("Invalid file path detected. Check folder name or URL format.");
    }

    const file = bucket.file(filePath);
    await file.delete();
    console.log(`Successfully deleted ${filePath} from Firebase Storage.`);
  } catch (error) {
    console.error("Error deleting file from Firebase Storage:", error);
    throw error;
  }
}; exports.deleteFromFirebase = deleteFromFirebase;

const Register = async (req, res, next) => {
  const input = req.body;
  console.log(input);
  
  // Validate input using your validation schema
  const { error } = _validations2.default.validate(input);
  if (error) {
    return next(Boom.badRequest(error.details[0].message));
  }

  // Ensure firstName and lastName are provided
  if (!input.firstName || !input.lastName) {
    return next(Boom.badRequest("First name and last name are required."));
  }

  try {
    // Check if the email is already in use
    const emailExists = await _user2.default.findOne({ email: input.email });
    if (emailExists) {
      return next(Boom.conflict("This e-mail is already in use."));
    }

    // Check if the username is already in use
    const usernameExists = await _user2.default.findOne({ username: input.username });
    if (usernameExists) {
      return next(Boom.conflict("This username is already in use."));
    }

    // Generate a verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Create a new user with the provided input and additional fields
    const user = new (0, _user2.default)({ ...input, verified: "No", verificationToken });
    const data = await user.save();

    const frontendUrl = input.frontendUrl || "https://openpreneurs.business";
    const verificationLink = `${frontendUrl}/verify/${verificationToken}`;

    const mailOptions = {
      from: "no-reply@openpreneurs.business",
      to: input.email,
      subject: "Verify Your Email",
      text: `Please click on the following link to verify your email: ${verificationLink}`,
    };

    try {
      await transporter.sendMail(mailOptions);
      res.json({
        message: "Registration successful! A verification email has been sent to your email address.",
      });
    } catch (emailError) {
      next(Boom.badImplementation("Could not send verification email. Please try again later."));
    }
  } catch (e) {
    next(e);
  }
};

const Login = async (req, res, next) => {
    const input = req.body;
    try {
      const user = await _user2.default.findOne({ email: input.email });
      if (!user) {
        return next(Boom.notFound("Email not found."));
      }

      if (user.status === "inactive") {
        return next(Boom.unauthorized("Account has been suspended. Please contact support for more info."));
      }
  
      const isMatched = await user.isValidPass(input.password);
      if (!isMatched) {
        return next(Boom.unauthorized("Invalid email or password."));
      }
  
      // If the user is not verified, generate a new verification token and resend email
      if (user.verified === "No") {
        // Generate a new verification token
        const verificationToken = crypto.randomBytes(32).toString("hex");
        user.verificationToken = verificationToken; // Override the previous token
        await user.save();
  
        // Send the new verification email
        const frontendUrl = input.frontendUrl || "https://openpreneurs.business";
        const verificationLink = `${frontendUrl}/verify/${verificationToken}`;
        const mailOptions = {
          from: "no-reply@openpreneurs.business",
          to: input.email, // Send to user's email
          subject: "Verify Your Email",
          text: `Please click on the following link to verify your email: ${verificationLink}`,
        };
        try {
          await transporter.sendMail(mailOptions);
          return next(
            Boom.unauthorized(
              "Account not verified. A new verification email has been sent to your email address."
            )
          );
        } catch (emailError) {
          return next(
            Boom.badImplementation("Could not send verification email. Please try again later.")
          );
        }
      }

          // 2️⃣ PROFILE COMPLETENESS CHECK
    const required = [
      "profile_pic",
      "display_banner",
      "bio",
      "primary_business",
      "business_country",
      "business_industry",
      "value_chainstake",
      "markets_covered",
      "immediate_needs"
    ];

    const isIncomplete = required.some((field) => {
      const val = user[field];
      if (Array.isArray(val)) {
        return val.length === 0;
      }
      // treat null, undefined, or empty string as missing
      return !val;
    });

    if (isIncomplete) {
      const notificationText = "Your profile isn't complete—please complete it kindly.";
      await _notificationsjs2.default.updateOne(
        { user: user._id },
        { $addToSet: { type: "incomplete", data: notificationText } },
        { upsert: true }
      );
    }
  
      const tokenExpiry = input.rememberMe ? "7d" : "1h"; // 7 days for "Remember Me", 1 hour otherwise
  
      const accessToken = await _jwt.signAccessToken.call(void 0, { user_id: user._id, role: user.role }, tokenExpiry);
      const refreshToken = await _jwt.signRefreshToken.call(void 0, user._id);
  
      // If the user is verified, proceed with login
      const userData = user.toObject();
      delete userData.password;
      delete userData.__v;
  
      // Log the logged in user data and tokens for debugging purposes
      console.log("User logged in data:", { user: userData, accessToken, refreshToken });
  
      res.json({ user: userData, accessToken, refreshToken });
    } catch (e) {
      next(e);
    }
  };
  
  const deleteUser = async (req, res, next) => {
    try {
      const userId = req.params.id;
  
      const user = await _user2.default.findByIdAndDelete(userId);
  
      if (!user) {
        return next(Boom.notFound("User not found."));
      }
  
      res.json({ message: "User deleted successfully." });
    } catch (e) {
      next(e);
    }
  };
  


const RefreshToken = async (req, res, next) => {
	const { refresh_token } = req.body;

	if (!refresh_token) {
		return next(Boom.badRequest("Refresh token missing."));
	}

	try {
		const user_id = await _jwt.verifyRefreshToken.call(void 0, refresh_token);
		const accessToken = await _jwt.signAccessToken.call(void 0, user_id);
		const newRefreshToken = await _jwt.signRefreshToken.call(void 0, user_id);

		res.json({ accessToken, refreshToken: newRefreshToken });
	} catch (e) {
		next(e);
	}
};

const Logout = async (req, res, next) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
      return next(Boom.badRequest("Refresh token missing."));
  }

  try {
      const user_id = await _jwt.verifyRefreshToken.call(void 0, refresh_token);

      if (!user_id) {
          return next(Boom.unauthorized("Invalid refresh token."));
      }

      // Correct Redis call
      const result = await redis.del(user_id.toString()); // Ensure it's a string


      res.json({ message: "Logout successful" });
  } catch (e) {
      console.error("Logout error:", e);
      next(e);
  }
};

const updateAddress = async (req, res, next) => {
    const user_id = _optionalChain([req, 'access', _ => _.payload, 'optionalAccess', _2 => _2.user_id]); // Use optional chaining to safely access user_id
    if (!user_id) {
        return res.status(401).json({ message: "User ID not found in token." }); // Return a response if user_id is not available
    }

    const { address, city, province, postcode, phone } = req.body;

    try {
        // Find the user first to ensure they exist and retrieve the current state of the arrays
        const user = await _user2.default.findById(user_id);
        if (!user) {
            return next(Boom.notFound("User not found."));
        }

        // Use the existing values or create empty strings if they do not exist
        const updatedAddress = user.address || [];
        const updatedCity = user.townOrCity || [];
        const updatedState = user.province || [];
        const updatedPostcode = user.postcode || [];
        const updatedPhone = user.phone || [];

        // Ensure the arrays have at least 2 elements (index 0 and 1)
        if (updatedAddress.length < 1) {
            updatedAddress[0] = address; // Set address at index 1
        } else {
            updatedAddress[0] = address; // Update existing index 1
        }

        if (updatedCity.length < 1) {
            updatedCity[0] = city; // Set city at index 1
        } else {
            updatedCity[0] = city; // Update existing index 1
        }

        if (updatedState.length < 1) {
            updatedState[0] = province; // Set state at index 1
        } else {
            updatedState[0] = province; // Update existing index 1
        }

        if (updatedPostcode.length < 1) {
            updatedPostcode[0] = postcode; // Set postcode at index 1
        } else {
            updatedPostcode[0] = postcode; // Update existing index 1
        }

        if (updatedPhone.length < 1) {
            updatedPhone[0] = phone; // Set phone at index 1
        } else {
            updatedPhone[0] = phone; // Update existing index 1
        }

        // Now update the user with the modified arrays
        const updatedUser = await _user2.default.findByIdAndUpdate(
            user_id,
            {
                $set: {
                    address: updatedAddress,
                    townOrCity: updatedCity,
                    province: updatedState,
                    postcode: updatedPostcode,
                    phone: updatedPhone,
                },
            },
            { new: true, runValidators: true }
        );

        res.json(updatedUser);
    } catch (e) {
        next(e);
    }
};

const getAddress = async (req, res, next) => {
    const email = req.query.email; 

    if (!email) {
        return res.status(401).json({ message: "Email not found in request." }); // Return an error if email is not provided
    }

    try {
        // Find the user by email to retrieve the address information
        const user = await _user2.default.findOne({ email }).select('firstName lastName address townOrCity province postcode phone');
        if (!user) {
            return next(Boom.notFound("User not found.")); // Return error if user is not found
        }
        // Format the response to return the user's address information
        const userAddress = {
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            address: user.address || "",
            city: user.townOrCity || "",
            province: user.province || "",
            postcode: user.postcode || "",
            phone: user.phone || "",
        };

        res.json(userAddress); // Send the user's address data as a response
    } catch (e) {
        next(e); // Pass the error to the next middleware
    }
};


 const Me = async (req, res, next) => {
  const { user_id } = req.payload || {};

  if (!user_id) {
    return res.status(401).json({ message: "Unauthorized: no user ID in token." });
  }

  try {
    // 1️⃣ Try User
    const user = await _user2.default.findById(user_id).select("-password -__v");
    if (user) {
      return res.json(user);
    }

    // 2️⃣ Fallback to Admin
    const admin = await _adminjs2.default.findById(user_id).select("-password -__v");
    if (admin) {
      return res.json(admin);
    }

    // 3️⃣ Not found in either collection
    return res.status(404).json({ message: "No user or admin found with that ID." });
  } catch (err) {
    next(err);
  }
}; exports.Me = Me;


const updateUserInfo = async (req, res, next) => {
  try {
    
    // Extract the user ID from URL params, body, or the authenticated user.
    const userId = req.params.id || req.body.id || _optionalChain([req, 'access', _3 => _3.user, 'optionalAccess', _4 => _4.id]);

    if (!userId) {
      return next(Boom.badRequest("User ID is required."));
    }

    // Fetch the user from the database.
    const user = await _user2.default.findById(userId);
    if (!user) {
      return next(Boom.notFound("User not found."));
    }

    // Destructure fields from the request body.
    // Note: For account updates, we expect the field "username" (not displayName).
    const {
      firstName,
      lastName,
      username,      // use this for account update
      aboutme,
      newPassword,
      oldPassword,
      facebook_link,
      linkedin_link,
      instagram_link,
      x_link,
      web_link,
      business_country,
      business_industry,
      value_chainstake,
      markets_covered,
      immediate_needs,
      primary_business,
      privacy, // Expected from account settings payload
    } = req.body;

    // Upload profile picture if provided.
    const profilePictureUrl = _optionalChain([req, 'access', _5 => _5.files, 'optionalAccess', _6 => _6.profile_pic])
      ? await handleFirebaseUpload(req.files.profile_pic[0], "profile_pic", "profile")
      : null;

    // Upload banner image if provided.
    const bannerUrl = _optionalChain([req, 'access', _7 => _7.files, 'optionalAccess', _8 => _8.banner_image])
      ? await handleFirebaseUpload(req.files.banner_image[0], "banners", "banner")
      : null;

    // Update user document with new details.
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (username) user.username = username;
    if (aboutme) {
      user.aboutme = aboutme;
    } else {
      user.aboutme = null;
    }
    
    if (facebook_link) {
      user.facebook_link = facebook_link;
    } else {
      user.facebook_link = null;
    }
    
    if (linkedin_link) {
      user.linkedin_link = linkedin_link;
    } else {
      user.linkedin_link = null;
    }
    
    if (instagram_link) {
      user.instagram_link = instagram_link;
    } else {
      user.instagram_link = null;
    }
    
    if (x_link) {
      user.x_link = x_link;
    } else {
      user.x_link = null;
    }
    
    if (web_link) {
      user.web_link = web_link;
    } else {
      user.web_link = null;
    }
    
    if (business_country) {
      user.business_country = business_country;
    } else {
      user.business_country = null;
    }
    
    if (business_industry) {
      user.business_industry = business_industry;
    } else {
      user.business_industry = null;
    }
    
    if (value_chainstake) {
      user.value_chainstake = value_chainstake;
    } else {
      user.value_chainstake = null;
    }
    
    if (markets_covered) {
      user.markets_covered = markets_covered;
    } else {
      user.markets_covered = null;
    }
    
    if (immediate_needs) {
      user.immediate_needs = immediate_needs;
    } else {
      user.immediate_needs = null;
    }
    
    if (primary_business) {
      user.primary_business = primary_business;
    } else {
      user.primary_business = null;
    }   

    // Update privacy if provided.
    if (privacy) user.privacy = privacy;

    // Update file URLs if the uploads succeeded.
    if (profilePictureUrl) user.profile_pic = profilePictureUrl;
    if (bannerUrl) user.display_banner = bannerUrl;

    // If a new password is provided, validate and update it.
    if (newPassword) {
      if (!oldPassword) {
        return next(Boom.badRequest("Old password is required to update your password."));
      }
      // Verify that the old password is correct.
      const isMatch = await user.isValidPass(oldPassword);
      if (!isMatch) {
        return next(Boom.unauthorized("Old password is incorrect."));
      }
      // Hash the new password explicitly.
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
    }

    // Save the updated user.
    await user.save();

    res.json({ message: "User information updated successfully.", user });
  } catch (error) {
    next(error);
  }
};


  // Helper function to get the date range based on PST
const getDateRangeInPST = (type) => {
    const now = new Date();
  
    // Adjust for Pakistan Standard Time (UTC+5)
    const utcOffset = 5 * 60 * 60 * 1000; // 5 hours in milliseconds
    const pstNow = new Date(now.getTime() + utcOffset);
  
    let start, end;
  
    switch (type) {
      case "today":
        start = new Date(pstNow.setHours(0, 0, 0, 0) - utcOffset);
        end = new Date(pstNow.setHours(23, 59, 59, 999) - utcOffset);
        break;
      case "week":
        const firstDayOfWeek = pstNow.getDate() - pstNow.getDay();
        start = new Date(new Date(pstNow.setDate(firstDayOfWeek)).setHours(0, 0, 0, 0) - utcOffset);
        end = new Date(new Date(pstNow.setDate(firstDayOfWeek + 6)).setHours(23, 59, 59, 999) - utcOffset);
        break;
      case "month":
        start = new Date(new Date(pstNow.getFullYear(), pstNow.getMonth(), 1).setHours(0, 0, 0, 0) - utcOffset);
        end = new Date(new Date(pstNow.getFullYear(), pstNow.getMonth() + 1, 0).setHours(23, 59, 59, 999) - utcOffset);
        break;
      case "year":
        start = new Date(new Date(pstNow.getFullYear(), 0, 1).setHours(0, 0, 0, 0) - utcOffset);
        end = new Date(new Date(pstNow.getFullYear(), 11, 31).setHours(23, 59, 59, 999) - utcOffset);
        break;
      default:
        throw new Error("Invalid type for date range.");
    }
  
    return { start, end };
  };

   const updateUserAdminDetails = async (req, res, next) => {
    try {
      const { userId } = req.params; // Extract userId from request params
      const { tokens, subscription, role, status, level } = req.body; // Data to update
  
      // Validate user input (Optional)
      const validSubscriptions = ["none", "basic", "premium"];
      const validRoles = ["user", "admin"];
      const validStatuses = ["active", "inactive", "suspended"];
      const validLevels = ["super", "admin", "moderator"];
  
      if (subscription && !validSubscriptions.includes(subscription)) {
        return next(Boom.badRequest("Invalid subscription type."));
      }
      if (role && !validRoles.includes(role)) {
        return next(Boom.badRequest("Invalid role."));
      }
      if (status && !validStatuses.includes(status)) {
        return next(Boom.badRequest("Invalid status."));
      }
      if (level && !validLevels.includes(level)) {
        return next(Boom.badRequest("Invalid level."));
      }
  
      // Build dynamic update object
      const updateData = {};
      if (tokens !== undefined) updateData.tokens = tokens;
      if (subscription) updateData.subscription = subscription;
      if (role) updateData.role = role;
      if (status) updateData.status = status;
      if (level) updateData.level = level;
  
      // Update the user and return the updated document
      const updatedUser = await _user2.default.findByIdAndUpdate(userId, updateData, {
        new: true, // Return the updated document
        runValidators: true, // Ensure Mongoose schema validations run
      });
  
      if (!updatedUser) {
        return next(Boom.notFound("User not found."));
      }
  
      res.status(200).json({
        success: true,
        message: "User updated successfully.",
        data: updatedUser,
      });
    } catch (error) {
      console.error("Error updating user:", error);
      next(Boom.internal("Error updating user."));
    }
  }; exports.updateUserAdminDetails = updateUserAdminDetails;
  
   const getAllAdminUsers = async (req, res, next) => {
    try {
      // Extract optional query parameters for filtering
      const { role, status, subscription, limit = 50, page = 1 } = req.query;
  
      // Build dynamic query object
      const query = {};
      if (role) query.role = role;
      if (status) query.status = status;
      if (subscription) query.subscription = subscription;
  
      // Pagination: Calculate skip value
      const skip = (page - 1) * limit;
  
      // Fetch users with filtering and pagination
      const users = await _user2.default.find(query)
        .skip(skip)
        .limit(parseInt(limit))
        .select("-password -resetPasswordToken -resetPasswordExpires") // Exclude sensitive fields
        .populate("joined_tribes", "name") // Populate joined_tribes (optional)
        .populate("mytribers", "username email") // Populate mytribers (optional)
        .populate("chat_lobby", "name"); // Populate chat_lobby (optional)
  
      // Get total count for pagination metadata
      const totalUsers = await _user2.default.countDocuments(query);
  
      res.status(200).json({
        success: true,
        totalUsers,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / limit),
        users,
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      next(Boom.internal("Error fetching users."));
    }
  }; exports.getAllAdminUsers = getAllAdminUsers;
  
  // Function to get the total number of registrations based on the date range
  const GetTotalNumberOfRegistrationsByDateRange = async (req, res, next) => {
    const { rangeType } = req.params; // e.g., 'today', 'week', 'month', 'year'
  
    try {
      const { start, end } = getDateRangeInPST(rangeType);
  
      // Count the number of registrations based on the 'createdAt' field
      const totalRegistrationsCount = await _user2.default.countDocuments({
        createdAt: { $gte: start, $lte: end },
      });
  
      res.json({
        range: rangeType,
        totalRegistrations: totalRegistrationsCount,
      });
    } catch (e) {
      next(e);
    }
  };

  const getAllUsers = async (req, res, next) => {
    try {
        const users = await _user2.default.find().select("-password -__v"); // Exclude sensitive fields
        res.json(users);
    } catch (e) {
        next(e);
    }
};

var _chatlobbyjs = require('../../models/chatlobby.js'); var _chatlobbyjs2 = _interopRequireDefault(_chatlobbyjs);
var _uuid = require('uuid');

// Returns an existing chat lobby ID if one exists between the two users,
// otherwise creates a new chat lobby and returns its ID.
const getOrCreateChatLobby = async (req, res, next) => {
  try {
    const { userId1, userId2 } = req.body;
    if (!userId1 || !userId2) {
      return res.status(400).json({ message: "Both user IDs are required." });
    }
    // Find if a chat lobby exists between these users
    const existingLobby = await _chatlobbyjs2.default.findOne({
      participants: { $all: [userId1, userId2] }
    }).populate("participants", "username profile_pic firstName lastName");
    
    if (existingLobby) {
      return res.status(200).json({ chatLobbyId: existingLobby.chatLobbyId });
    }

  } catch (error) {
    next(error);
  }
};

const getOrCreateChatLobbyTribe = async (req, res, next) => {
  try {
    const { userIds } = req.body; // expecting an array like [user1, user2, user3, ...]

    if (!userIds || !Array.isArray(userIds) || userIds.length < 2) {
      return res.status(400).json({ message: "At least two user IDs are required." });
    }

    // Step 1: Try to find an existing lobby with the same exact participants
    const existingLobby = await _chatlobbyjs2.default.findOne({
      participants: { $all: userIds, $size: userIds.length }
    }).populate("participants", "username profile_pic firstName lastName");

    if (existingLobby) {
      return res.status(200).json({ chatLobbyId: existingLobby.chatLobbyId, lobby: existingLobby });
    }

    // Step 2: If not found, create a new chat lobby
    const newLobby = new (0, _chatlobbyjs2.default)({
      participants: userIds
    });

    await newLobby.save();

    // Optionally populate users for response
    await newLobby.populate("participants", "username profile_pic firstName lastName");

    return res.status(201).json({ chatLobbyId: newLobby.chatLobbyId, lobby: newLobby });

  } catch (error) {
    next(error);
  }
};


// Get all chat lobbies for the current authenticated user
const getUserChatLobbies = async (req, res, next) => {
  try {
    const userId = req.payload.user_id; // Provided by verifyAccessToken middleware

    const chatLobbies = await _chatlobbyjs2.default.find({
      participants: userId,
      deletefor: { $ne: userId } // Exclude lobbies where userId is in deletefor
    }).populate({
      path: "participants",
      select: "username profile_pic firstName lastName"
    });

    return res.json(chatLobbies);
  } catch (error) {
    next(error);
  }
};

const createChatLobby = async (req, res, next) => {
  try {
    const { userId1, userId2 } = req.body;
    if (!userId1 || !userId2) {
      return res.status(400).json({ message: "Both user IDs are required." });
    }

    // Check if a chat lobby already exists between these two users.
    let existingLobby = await _chatlobbyjs2.default.findOne({
      participants: { $all: [userId1, userId2] }
    });

    if (existingLobby) {
      // If userId1 is in the deletefor array, remove it.
      if (existingLobby.deletefor.includes(userId1)) {
        existingLobby.deletefor = existingLobby.deletefor.filter(
          (id) => id.toString() !== userId1
        );
      }
      // Similarly, if userId2 is in the deletefor array, remove it.
      if (existingLobby.deletefor.includes(userId2)) {
        existingLobby.deletefor = existingLobby.deletefor.filter(
          (id) => id.toString() !== userId2
        );
      }
      await existingLobby.save();
      return res.status(200).json({ chatLobbyId: existingLobby.chatLobbyId });
    }

    // Otherwise, create a new chat lobby.
    const newChatLobbyId = _uuid.v4.call(void 0, );
    const newChatLobby = new (0, _chatlobbyjs2.default)({
      chatLobbyId: newChatLobbyId,
      participants: [userId1, userId2],
      messages: [],
      deletefor: [] // Initialize as an empty array
    });

    await newChatLobby.save();
    return res.status(201).json({ chatLobbyId: newChatLobbyId });
  } catch (error) {
    next(error);
  }
};




 const getChatMessages = async (req, res, next) => {
  try {
    const { chatLobbyId } = req.params;
    const userId          = req.query.userId || _optionalChain([req, 'access', _9 => _9.payload, 'optionalAccess', _10 => _10.user_id]);
    const page            = parseInt(req.query.page, 10) || 0;
    const PAGE_SIZE       = 20;

    if (!chatLobbyId) {
      return res.status(400).json({ message: "Chat Lobby ID is required." });
    }

    // fetch newest first, +1 extra to check for more
    const docs = await _Messagejs2.default.find({
      chatLobbyId,
      deletedFor: { $ne: userId },
    })
      .sort({ sentAt: -1 })
      .skip(page * PAGE_SIZE)
      .limit(PAGE_SIZE + 1)
      .populate("sender", "username")
      .lean();

    // if we got more than PAGE_SIZE, there's another page
    const hasMore = docs.length > PAGE_SIZE;
    // trim off the extra record, then reverse so client sees oldest→newest order
    const messages = docs.slice(0, PAGE_SIZE).reverse();

    return res.json({ messages, hasMore });
  } catch (error) {
    next(error);
  }
}; exports.getChatMessages = getChatMessages;


 const deleteChatLobbyForUser = async (req, res, next) => {
  try {
    const userId = req.payload.user_id; // current authenticated user id
    const { chatLobbyId } = req.params; // assuming chatLobbyId is passed as a URL parameter

    if (!chatLobbyId) {
      return res.status(400).json({ message: "Chat lobby ID is required." });
    }

    // Find all messages for this chat lobby.
    const messages = await _Messagejs2.default.find({ chatLobbyId });

    // If there are no messages, return a success response.
    if (!messages || messages.length === 0) {
      return res.status(200).json({ message: "No messages found in this chat lobby." });
    }

    // Loop over each message to update or delete it.
    for (const message of messages) {
      // Ensure that the deletedFor field exists and is an array.
      if (!Array.isArray(message.deletedFor)) {
        message.deletedFor = [];
      }

      // If the current user hasn't already "deleted" this message, add their ID.
      if (!message.deletedFor.includes(userId)) {
        message.deletedFor.push(userId);
      }

      // Check if both participants have deleted this message.
      // (Assuming a two-user chat, so length of deletedFor being 2 means both users have deleted it.)
      if (message.deletedFor.length >= 2) {
        // If the message is a file message and has a fileUrl, delete the file from Firebase.
        if (message.type === "file" && message.fileUrl) {
          try {
            await exports.deleteFromFirebase.call(void 0, message.fileUrl);
          } catch (firebaseError) {
            console.error("Error deleting file from Firebase:", firebaseError);
            // Optionally, decide whether to continue or return an error here.
          }
        }
        // Permanently remove the message from the database.
        await _Messagejs2.default.deleteOne({ _id: message._id });
      } else {
        // Otherwise, save the updated message (with the new deletedFor array).
        await message.save();
      }
    }

    return res.status(200).json({ message: "Chat lobby deleted for user successfully." });
  } catch (error) {
    next(error);
  }
}; exports.deleteChatLobbyForUser = deleteChatLobbyForUser;


/**
 * Send a friend request.
 * Adds the current user's ID (from req.user) to the target user's 'requests' array.
 */
 const sendFriendRequest = async (req, res, next) => {
  try {
    // Extract both targetUserId and currentUserId from the request body.
    const { targetUserId, currentUserId } = req.body;
    if (!targetUserId || !currentUserId) {
      return next(Boom.badRequest("Target user ID and current user ID are required."));
    }

    // Add currentUserId to the target user's 'requests' array.
    const targetUser = await _user2.default.findByIdAndUpdate(
      targetUserId,
      { $addToSet: { requests: currentUserId } },
      { new: true }
    );
    if (!targetUser) {
      return next(Boom.notFound("Target user not found."));
    }

    // Also, add targetUserId to the current user's 'sentrequests' array.
    await _user2.default.findByIdAndUpdate(
      currentUserId,
      { $addToSet: { sentrequests: targetUserId } },
      { new: true }
    );

    // --- Notification Logic for Friend Request ---
    // To display a meaningful message, look up the current user's details.
    const currentUser = await _user2.default.findById(currentUserId);
    const notificationText = `You have a new triber request from ${currentUser ? currentUser.username : 'someone'}`;
    await _notificationsjs2.default.updateOne(
      { user: targetUserId },
      { $addToSet: { type: "friendrequest", data: notificationText } },
      { upsert: true }
    );
    // --- End Notification Logic ---

    res.status(200).json({
      success: true,
      message: "Triber request sent successfully.",
      data: targetUser,
    });
  } catch (error) {
    console.error("Error sending triber request:", error);
    next(Boom.internal("Error sending triber request."));
  }
}; exports.sendFriendRequest = sendFriendRequest;



/**
 * Accept a friend request.
 * Removes the requester ID from the current user's "requests" array,
 * and from the requester's "sentrequests" array,
 * and adds them mutually to the "mytribers" array.
 */
 const acceptFriendRequest = async (req, res, next) => {
  try {
    const { targetUserId, currentUserId } = req.body;
    const requesterId = targetUserId;
    if (!requesterId || !currentUserId) {
      return next(Boom.badRequest("Requester ID and current user ID are required."));
    }

    // Remove the requester from the current user's "requests" array and add to "mytribers".
    const currentUser = await _user2.default.findByIdAndUpdate(
      currentUserId,
      {
        $pull: { requests: requesterId },
        $addToSet: { mytribers: requesterId },
      },
      { new: true }
    );
    if (!currentUser) {
      return next(Boom.notFound("Current user not found."));
    }

    // Also, remove the current user from the requester's "sentrequests" and add to the requester's "mytribers".
    await _user2.default.findByIdAndUpdate(
      requesterId,
      {
        $pull: { sentrequests: currentUserId },
        $addToSet: { mytribers: currentUserId },
      },
      { new: true }
    );

    // --- Notification Logic for Friend Request Acceptance ---
    // Notify the requester (sender) that the friend request has been accepted.
    const notificationText = `Your triber request has been accepted by ${currentUser.username}`;
    await _notificationsjs2.default.updateOne(
      { user: requesterId },
      { $addToSet: { type: "acceptrequest", data: notificationText } },
      { upsert: true }
    );
    // --- End Notification Logic ---

    res.status(200).json({
      success: true,
      message: "Triber request accepted successfully.",
      data: currentUser,
    });
  } catch (error) {
    console.error("Error accepting triber request:", error);
    next(Boom.internal("Error accepting triber request."));
  }
}; exports.acceptFriendRequest = acceptFriendRequest;


/**
 * Reject a friend request.
 * Removes the requester ID from the current user's "requests" array,
 * removes the current user's ID from the requester's "sentrequests" array,
 * and adds the requester ID to the current user's "rejectedrequests" array.
 */
 const rejectFriendRequest = async (req, res, next) => {
  try {
    const { targetUserId,currentUserId } = req.body; // the user who sent the friend request
    const requesterId =targetUserId;
    if (!requesterId || !currentUserId) {
      return next(Boom.badRequest("Requester ID and current user ID are required."));
    }

    // Remove the requester from current user's "requests" array and add to "rejectedrequests".
    const currentUser = await _user2.default.findByIdAndUpdate(
      currentUserId,
      {
        $pull: { requests: requesterId },
        $addToSet: { rejectedrequests: requesterId },
      },
      { new: true }
    );
    if (!currentUser) {
      return next(Boom.notFound("Current user not found."));
    }

    // Also, remove the current user from requester's "sentrequests" array.
    await _user2.default.findByIdAndUpdate(
      requesterId,
      { $pull: { sentrequests: currentUserId } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Triber request rejected successfully.",
      data: currentUser,
    });
  } catch (error) {
    console.error("Error rejecting triber request:", error);
    next(Boom.internal("Error rejecting triber request."));
  }
}; exports.rejectFriendRequest = rejectFriendRequest;

/**
 * Block a user.
 * Adds the target user's ID to the current user's 'blockedtribers' array,
 * and adds the current user's ID to the target user's 'blockedby' array.
 */
 const blockUser = async (req, res, next) => {
  try {
    const { targetUserId,currentUserId } = req.body;
    if (!targetUserId || !currentUserId) {
      return next(Boom.badRequest("Target user ID and current user ID are required."));
    }

    // Update current user's blockedtribers.
    const currentUser = await _user2.default.findByIdAndUpdate(
      currentUserId,
      { $addToSet: { blockedtribers: targetUserId } },
      { new: true }
    );
    // Update target user's blockedby.
    await _user2.default.findByIdAndUpdate(
      targetUserId,
      { $addToSet: { blockedby: currentUserId } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "User blocked successfully.",
      data: currentUser,
    });
  } catch (error) {
    console.error("Error blocking user:", error);
    next(Boom.internal("Error blocking user."));
  }
}; exports.blockUser = blockUser;

/**
 * Unblock a user.
 * Removes the target user's ID from the current user's 'blockedtribers' array,
 * and removes the current user's ID from the target user's 'blockedby' array.
 */
 const unblockUser = async (req, res, next) => {
  try {
    const { targetUserId, currentUserId } = req.body;
    if (!targetUserId || !currentUserId) {
      return next(Boom.badRequest("Target user ID and current user ID are required."));
    }

    // Update current user's blockedtribers.
    const currentUser = await _user2.default.findByIdAndUpdate(
      currentUserId,
      { $pull: { blockedtribers: targetUserId } },
      { new: true }
    );
    // Update target user's blockedby.
    await _user2.default.findByIdAndUpdate(
      targetUserId,
      { $pull: { blockedby: currentUserId } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "User unblocked successfully.",
      data: currentUser,
    });
  } catch (error) {
    console.error("Error unblocking user:", error);
    next(Boom.internal("Error unblocking user."));
  }
}; exports.unblockUser = unblockUser;

 const removeFriend = async (req, res, next) => {
  try {
    const { friendId, currentUserId } = req.body;
    
    if (!friendId || !currentUserId) {
      return next(Boom.badRequest("Triber ID and current user ID are required."));
    }
    
    // Remove friendId from current user's mytribers array.
    const currentUser = await _user2.default.findByIdAndUpdate(
      currentUserId,
      { $pull: { mytribers: friendId } },
      { new: true }
    );
    
    if (!currentUser) {
      return next(Boom.notFound("Current user not found."));
    }
    
    // Optionally, remove currentUserId from the friend's mytribers array.
    await _user2.default.findByIdAndUpdate(
      friendId,
      { $pull: { mytribers: currentUserId } },
      { new: true }
    );
    
    res.status(200).json({
      success: true,
      message: "Triber removed successfully.",
      data: currentUser,
    });
  } catch (error) {
    console.error("Error removing friend:", error);
    next(Boom.internal("Error removing friend."));
  }
}; exports.removeFriend = removeFriend;

 const cancelSentFriendRequest = async (req, res, next) => {
  try {
    const { targetUserId } = req.body; // the user to whom the request was sent
    const currentUserId = req.user && (req.user._id || req.user.id);
    
    if (!targetUserId || !currentUserId) {
      return next(Boom.badRequest("Target user ID and current user ID are required."));
    }
    
    // Remove targetUserId from current user's sentrequests.
    const sender = await _user2.default.findByIdAndUpdate(
      currentUserId,
      { $pull: { sentrequests: targetUserId } },
      { new: true }
    );
    
    // Remove currentUserId from target user's requests.
    const targetUser = await _user2.default.findByIdAndUpdate(
      targetUserId,
      { $pull: { requests: currentUserId } },
      { new: true }
    );
    
    res.status(200).json({
      success: true,
      message: "Sent triber request cancelled successfully.",
      data: sender,
    });
  } catch (error) {
    console.error("Error cancelling sent friend request:", error);
    next(Boom.internal("Error cancelling sent friend request."));
  }
}; exports.cancelSentFriendRequest = cancelSentFriendRequest;

/**
 * Remove a rejected friend request.
 * Removes the specified requester ID from the current user's 'rejectedrequests' array.
 */
 const removeRejectedFriendRequest = async (req, res, next) => {
  try {
    const { requesterId } = req.body; // the user whose friend request was rejected and is recorded in rejectedrequests
    const currentUserId = req.user && (req.user._id || req.user.id);
    
    if (!requesterId || !currentUserId) {
      return next(Boom.badRequest("Requester ID and current user ID are required."));
    }
    
    const currentUser = await _user2.default.findByIdAndUpdate(
      currentUserId,
      { $pull: { rejectedrequests: requesterId } },
      { new: true }
    );
    
    if (!currentUser) {
      return next(Boom.notFound("Current user not found."));
    }
    
    res.status(200).json({
      success: true,
      message: "Rejected triber request removed successfully.",
      data: currentUser,
    });
  } catch (error) {
    console.error("Error removing rejected friend request:", error);
    next(Boom.internal("Error removing rejected friend request."));
  }
}; exports.removeRejectedFriendRequest = removeRejectedFriendRequest;

 const updateUsername = async (req, res, next) => {
  try {
    // Retrieve the current user's ID from the JWT payload.
    const userId = _optionalChain([req, 'access', _11 => _11.payload, 'optionalAccess', _12 => _12.user_id]); 
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated." });
    }

    const { newUsername } = req.body;
    if (!newUsername) {
      return next(Boom.badRequest("New username is required."));
    }

    // Check if the new username already exists for another user.
    const existingUser = await _user2.default.findOne({ username: newUsername });
    if (existingUser && existingUser._id.toString() !== userId.toString()) {
      return next(Boom.conflict("Username already exists. Please choose another."));
    }

    // Update the user's username.
    const updatedUser = await _user2.default.findByIdAndUpdate(
      userId,
      { username: newUsername },
      { new: true, runValidators: true }
    );
    
    if (!updatedUser) {
      return next(Boom.notFound("User not found."));
    }

    res.status(200).json({
      success: true,
      message: "Username updated successfully.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating username:", error);
    next(Boom.internal("Error updating username."));
  }
}; exports.updateUsername = updateUsername;

 const updateUserPassword = async (req, res, next) => {
  // Extract user_id from the JWT token payload
  const user_id = _optionalChain([req, 'access', _13 => _13.payload, 'optionalAccess', _14 => _14.user_id]);
  if (!user_id) {
    return res.status(401).json({ message: "User ID not found in token." });
  }

  const { newPassword } = req.body;
  if (!newPassword) {
    return res.status(400).json({ message: "New password is required." });
  }

  try {
    // Find the user by ID
    const user = await _user2.default.findById(user_id);
    if (!user) {
      return next(Boom.notFound("User not found."));
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;

    // Save the updated user
    const updatedUser = await user.save();
    res.json({ message: "Password updated successfully.", user: updatedUser });
  } catch (error) {
    console.error("Error updating password:", error);
    next(Boom.internal("Error updating password."));
  }
}; exports.updateUserPassword = updateUserPassword;

 const updateUserProfile = async (req, res, next) => {
  try {
    // Extract user ID from the JWT payload (adjust according to your authentication middleware)
    const userId = _optionalChain([req, 'access', _15 => _15.payload, 'optionalAccess', _16 => _16.user_id]);
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated." });
    }

    // Destructure the fields from req.body
    const {
      title,
      shortintro,
      firstName,
      lastName,
      country,
      gender,
      business_country,
      business_industry,
      value_chainstake,
      markets_covered,
      immediate_needs,
      phone,
      primary_business,
      facebook_link,
      linkedin_link,
      instagram_link,
      x_link,
      web_link,
      aboutme,
    } = req.body;

    // Build the update object. You can remove keys with undefined values if needed.
    const updateData = {
      title,
      shortintro,
      firstName,
      lastName,
      country,
      gender,
      business_country,
      business_industry,
      value_chainstake,
      markets_covered,
      immediate_needs,
      phone,
      primary_business,
      facebook_link,
      linkedin_link,
      instagram_link,
      x_link,
      web_link,
      aboutme,
    };

    // Optionally remove undefined keys
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Update the user document
    const updatedUser = await _user2.default.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });
    if (!updatedUser) {
      return next(Boom.notFound("User not found."));
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    next(Boom.internal("Error updating profile."));
  }
}; exports.updateUserProfile = updateUserProfile;

 const removeUserBanner = async (req, res, next) => {
  try {
    const userId = _optionalChain([req, 'access', _17 => _17.payload, 'optionalAccess', _18 => _18.user_id]); // Get user ID from JWT payload
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated." });
    }
    
    const user = await _user2.default.findById(userId);
    if (!user) {
      return next(Boom.notFound("User not found."));
    }
    
    if (!user.display_banner) {
      return res.status(400).json({ message: "No banner to remove." });
    }
    
    // Delete banner from Firebase Storage
    await exports.deleteFromFirebase.call(void 0, user.display_banner);
    
    // Update user document by setting display_banner to null
    user.display_banner = null;
    const updatedUser = await user.save();
    
    res.status(200).json({
      success: true,
      message: "Banner removed successfully.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error removing banner:", error);
    next(Boom.internal("Error removing banner."));
  }
}; exports.removeUserBanner = removeUserBanner;

/**
 * Remove the user's profile picture.
 */
 const removeUserProfilePic = async (req, res, next) => {
  try {
    const userId = _optionalChain([req, 'access', _19 => _19.payload, 'optionalAccess', _20 => _20.user_id]); // Get user ID from JWT payload
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated." });
    }
    
    const user = await _user2.default.findById(userId);
    if (!user) {
      return next(Boom.notFound("User not found."));
    }
    
    if (!user.profile_pic) {
      return res.status(400).json({ message: "No profile picture to remove." });
    }
    
    // Delete profile picture from Firebase Storage
    await exports.deleteFromFirebase.call(void 0, user.profile_pic);
    
    // Update user document by setting profile_pic to null
    user.profile_pic = null;
    const updatedUser = await user.save();
    
    res.status(200).json({
      success: true,
      message: "Profile picture removed successfully.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error removing profile picture:", error);
    next(Boom.internal("Error removing profile picture."));
  }
}; exports.removeUserProfilePic = removeUserProfilePic;

 const updateUserMedia = async (req, res, next) => {
  try {
    // Get user ID from JWT payload
    const userId = _optionalChain([req, 'access', _21 => _21.payload, 'optionalAccess', _22 => _22.user_id]);
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated." });
    }

    let profilePicUrl, bannerUrl;
    // Upload profile picture if provided.
    if (req.files && req.files["profile_pic"]) {
      profilePicUrl = await handleFirebaseUpload(
        req.files["profile_pic"][0],
        "DisplayPhoto", // Folder for profile pics
        `User-${userId}-profile`
      );
    }
    // Upload banner if provided.
    if (req.files && req.files["display_banner"]) {
      bannerUrl = await handleFirebaseUpload(
        req.files["display_banner"][0],
        "DisplayBanner", // Ensure your firebase deletion method allows "DisplayBanner/"
        `User-${userId}-banner`
      );
    }

    const updateData = {};
    if (profilePicUrl) updateData.profile_pic = profilePicUrl;
    if (bannerUrl) updateData.display_banner = bannerUrl;

    const updatedUser = await _user2.default.findByIdAndUpdate(userId, updateData, { new: true });
    if (!updatedUser) {
      return next(Boom.notFound("User not found."));
    }

    res.status(200).json({
      success: true,
      message: "User media updated successfully.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user media:", error);
    next(Boom.internal("Error updating user media."));
  }
}; exports.updateUserMedia = updateUserMedia;

 const joinTribe = async (req, res, next) => {
  try {
    const userId = _optionalChain([req, 'access', _23 => _23.payload, 'optionalAccess', _24 => _24.user_id]);
    const { tribeId } = req.body;
    if (!userId || !tribeId) {
      return next(Boom.badRequest("User ID and Tribe ID are required."));
    }
    
    // Fetch tribe details
    const tribe = await _mytribesjs2.default.findById(tribeId);
    if (!tribe) return next(Boom.notFound("Tribe not found."));
    
    // Check if user is blocked from this tribe
    if (tribe.blockedUsers && tribe.blockedUsers.some(id => id.toString() === userId.toString())) {
      return next(Boom.forbidden("You are blocked from joining this tribe."));
    }
    
    // Check member limit if defined (>0)
    if (tribe.membersLimit > 0 && tribe.members.length >= tribe.membersLimit) {
      return next(Boom.badRequest("Member limit reached for this tribe."));
    }
    
    if (tribe.joinPolicy === "open") {
      // Direct join: update user's joined_tribes and tribe's members.
      const userUpdatePromise = _user2.default.findByIdAndUpdate(
        userId,
        { $addToSet: { joined_tribes: tribeId } },
        { new: true }
      );
      const tribeUpdatePromise = _mytribesjs2.default.findByIdAndUpdate(
        tribeId,
        { $addToSet: { members: userId } },
        { new: true }
      );
      const [updatedUser, updatedTribe] = await Promise.all([userUpdatePromise, tribeUpdatePromise]);
      if (!updatedUser) return next(Boom.notFound("User not found."));
      if (!updatedTribe) return next(Boom.notFound("Tribe not found."));
      return res.status(200).json({
        success: true,
        message: "Joined tribe successfully.",
        data: { user: updatedUser, tribe: updatedTribe },
      });
    } else {
      // Closed tribe: add join request.
      // Initialize requests array if not present.
      if (!tribe.requests) tribe.requests = [];
      // Check if already requested.
      if (tribe.requests.some(id => id.toString() === userId.toString())) {
        return next(Boom.badRequest("Join request already sent."));
      }
      tribe.requests.push(userId);
      const updatedTribe = await tribe.save();
      return res.status(200).json({
        success: true,
        message: "Join request sent. Awaiting admin approval.",
        data: updatedTribe,
      });
    }
  } catch (error) {
    console.error("Error joining tribe:", error);
    next(Boom.internal("Error joining tribe."));
  }
}; exports.joinTribe = joinTribe;

 const kickUserFromTribe = async (req, res, next) => {
  try {
    const adminId = _optionalChain([req, 'access', _25 => _25.payload, 'optionalAccess', _26 => _26.user_id]);
    const { tribeId, targetUserId } = req.body;
    
    if (!adminId || !tribeId || !targetUserId) {
      return next(Boom.badRequest("Tribe ID, target user ID and admin user ID are required."));
    }
    
    // Fetch the tribe.
    const tribe = await _mytribesjs2.default.findById(tribeId);
    if (!tribe) return next(Boom.notFound("Tribe not found."));
    
    // Verify that the current user is an admin of the tribe.
    if (!tribe.admins.some(id => id.toString() === adminId.toString())) {
      return next(Boom.forbidden("Only tribe admins can kick users."));
    }
    
    // Remove the target user from the tribe's members.
    const updatedTribe = await _mytribesjs2.default.findByIdAndUpdate(
      tribeId,
      { $pull: { members: targetUserId } },
      { new: true }
    );
    
    // Also remove the tribe from the target user's joined_tribes.
    await _user2.default.findByIdAndUpdate(
      targetUserId,
      { $pull: { joined_tribes: tribeId } },
      { new: true }
    );
    
    res.status(200).json({
      success: true,
      message: "User kicked from tribe successfully.",
      data: updatedTribe,
    });
  } catch (error) {
    console.error("Error kicking user from tribe:", error);
    next(Boom.internal("Error kicking user from tribe."));
  }
}; exports.kickUserFromTribe = kickUserFromTribe;

/**
 * Get all members of a tribe.
 * Expects the tribe ID as a route parameter.
 * Populates the 'members' field with basic information.
 */
 const getTribeMembers = async (req, res, next) => {
  try {
    const { tribeId } = req.params;
    if (!tribeId) {
      return next(Boom.badRequest("Tribe ID is required."));
    }
    const tribe = await _mytribesjs2.default.findById(tribeId).populate("members", "username profile_pic");
    if (!tribe) return next(Boom.notFound("Tribe not found."));
    res.status(200).json({
      success: true,
      members: tribe.members,
    });
  } catch (error) {
    console.error("Error fetching tribe members:", error);
    next(Boom.internal("Error fetching tribe members."));
  }
}; exports.getTribeMembers = getTribeMembers;


/**
 * Leave a tribe.
 * Removes tribeId from the user's joined_tribes array and removes userId from the tribe's members array.
 */
 const leaveTribe = async (req, res, next) => {
  try {
    const userId = _optionalChain([req, 'access', _27 => _27.payload, 'optionalAccess', _28 => _28.user_id]);
    const { tribeId } = req.body;
    if (!userId || !tribeId) {
      return next(Boom.badRequest("User ID and Tribe ID are required."));
    }
    const userUpdatePromise = _user2.default.findByIdAndUpdate(
      userId,
      { $pull: { joined_tribes: tribeId } },
      { new: true }
    );
    const tribeUpdatePromise = _mytribesjs2.default.findByIdAndUpdate(
      tribeId,
      { $pull: { members: userId } },
      { new: true }
    );
    const [updatedUser, updatedTribe] = await Promise.all([userUpdatePromise, tribeUpdatePromise]);
    if (!updatedUser) return next(Boom.notFound("User not found."));
    if (!updatedTribe) return next(Boom.notFound("Tribe not found."));
    res.status(200).json({
      success: true,
      message: "Left tribe successfully.",
      data: { user: updatedUser, tribe: updatedTribe },
    });
  } catch (error) {
    console.error("Error leaving tribe:", error);
    next(Boom.internal("Error leaving tribe."));
  }
}; exports.leaveTribe = leaveTribe;

const deleteChatForUser = async (req, res, next) => {
  try {
    const userId = req.body.userId || req.payload.user_id;
    const { chatLobbyId } = req.body;
    if (!chatLobbyId) {
      return res.status(400).json({ error: "chatLobbyId is required" });
    }
    // Update the ChatLobby document:
    const updatedLobby = await _chatlobbyjs2.default.findOneAndUpdate(
      { chatLobbyId: chatLobbyId },
      { $addToSet: { deletefor: userId } },
      { new: true }
    );
    
    if (!updatedLobby) {
      return res.status(404).json({ error: "Chat lobby not found" });
    }

    // Update all Message documents:
    await _Messagejs2.default.updateMany(
      { chatLobbyId: chatLobbyId },
      { $addToSet: { deletedFor: userId } }
    );
    return res.json({
      updatedLobby,
      message: "Chat lobby and its messages have been deleted for the current user."
    });
  } catch (error) {
    console.error("Error in deleteChatForUser:", error);
    next(error);  // This will send the 500 response with the error message
  }
};


/**
 * Accept a tribe join request.
 * Tribe admin accepts a user's join request: removes the user from the tribe's requests array,
 * and if member limit is not exceeded, adds the user to the tribe's members array and updates the user's joined_tribes.
 */
 const acceptTribeRequest = async (req, res, next) => {
  try {
    const adminUserId = _optionalChain([req, 'access', _29 => _29.payload, 'optionalAccess', _30 => _30.user_id]);
    const { tribeId, requesterId } = req.body;
    if (!adminUserId || !tribeId || !requesterId) {
      return next(Boom.badRequest("Tribe ID, requester ID, and admin user ID are required."));
    }
    
    const tribe = await _mytribesjs2.default.findById(tribeId);
    if (!tribe) return next(Boom.notFound("Tribe not found."));
    
    // Ensure current user is an admin of this tribe.
    if (!tribe.admins.includes(adminUserId)) {
      return next(Boom.forbidden("Only tribe admins can accept join requests."));
    }
    
    // Check if member limit is reached.
    if (tribe.membersLimit > 0 && tribe.members.length >= tribe.membersLimit) {
      return next(Boom.badRequest("Member limit reached for this tribe."));
    }
    
    // Verify that the requester is in the tribe's requests array.
    if (!tribe.requests.includes(requesterId)) {
      return next(Boom.badRequest("No such join request exists."));
    }
    
    tribe.requests.pull(requesterId);
    tribe.members.push(requesterId);
    const updatedTribe = await tribe.save();
    
    // Also update the requester user's joined_tribes array.
    const updatedUser = await _user2.default.findByIdAndUpdate(
      requesterId,
      { $addToSet: { joined_tribes: tribeId } },
      { new: true }
    );
    
    res.status(200).json({
      success: true,
      message: "Tribe join request accepted.",
      data: { tribe: updatedTribe, user: updatedUser },
    });
  } catch (error) {
    console.error("Error accepting tribe request:", error);
    next(Boom.internal("Error accepting tribe request."));
  }
}; exports.acceptTribeRequest = acceptTribeRequest;

/**
 * Reject a tribe join request.
 * Tribe admin rejects a user's join request by removing the user from the tribe's requests array.
 */
 const rejectTribeRequest = async (req, res, next) => {
  try {
    const adminUserId = _optionalChain([req, 'access', _31 => _31.payload, 'optionalAccess', _32 => _32.user_id]);
    const { tribeId, requesterId } = req.body;
    if (!adminUserId || !tribeId || !requesterId) {
      return next(Boom.badRequest("Tribe ID, requester ID, and admin user ID are required."));
    }
    
    const tribe = await _mytribesjs2.default.findById(tribeId);
    if (!tribe) return next(Boom.notFound("Tribe not found."));
    
    // Ensure current user is an admin of this tribe.
    if (!tribe.admins.includes(adminUserId)) {
      return next(Boom.forbidden("Only tribe admins can reject join requests."));
    }
    
    if (!tribe.requests.includes(requesterId)) {
      return next(Boom.badRequest("No such join request exists."));
    }
    
    tribe.requests.pull(requesterId);
    const updatedTribe = await tribe.save();
    
    res.status(200).json({
      success: true,
      message: "Tribe join request rejected.",
      data: updatedTribe,
    });
  } catch (error) {
    console.error("Error rejecting tribe request:", error);
    next(Boom.internal("Error rejecting tribe request."));
  }
}; exports.rejectTribeRequest = rejectTribeRequest;

/**
 * Add a course to the user's courses array.
 */
 const addCourse = async (req, res, next) => {
  try {
    const userId = _optionalChain([req, 'access', _33 => _33.payload, 'optionalAccess', _34 => _34.user_id]);
    const { courseId } = req.body;
    if (!userId || !courseId) {
      return next(Boom.badRequest("User ID and Course ID are required."));
    }
    const updatedUser = await _user2.default.findByIdAndUpdate(
      userId,
      { $addToSet: { courses: courseId } },
      { new: true }
    );
    if (!updatedUser) return next(Boom.notFound("User not found."));
    res.status(200).json({
      success: true,
      message: "Course added successfully.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error adding course:", error);
    next(Boom.internal("Error adding course."));
  }
}; exports.addCourse = addCourse;

/**
 * Remove a course from the user's courses array.
 */
 const removeCourse = async (req, res, next) => {
  try {
    const userId = _optionalChain([req, 'access', _35 => _35.payload, 'optionalAccess', _36 => _36.user_id]);
    const { courseId } = req.body;
    if (!userId || !courseId) {
      return next(Boom.badRequest("User ID and Course ID are required."));
    }
    const updatedUser = await _user2.default.findByIdAndUpdate(
      userId,
      { $pull: { courses: courseId } },
      { new: true }
    );
    if (!updatedUser) return next(Boom.notFound("User not found."));
    res.status(200).json({
      success: true,
      message: "Course removed successfully.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error removing course:", error);
    next(Boom.internal("Error removing course."));
  }
}; exports.removeCourse = removeCourse;

/**
 * Add a tool to the user's tools array.
 * (Ensure your User model includes a 'tools' field)
 */
 const addTool = async (req, res, next) => {
  try {
    const userId = _optionalChain([req, 'access', _37 => _37.payload, 'optionalAccess', _38 => _38.user_id]);
    const { toolId } = req.body;
    if (!userId || !toolId) {
      return next(Boom.badRequest("User ID and Tool ID are required."));
    }
    const updatedUser = await _user2.default.findByIdAndUpdate(
      userId,
      { $addToSet: { tools: toolId } },
      { new: true }
    );
    if (!updatedUser) return next(Boom.notFound("User not found."));
    res.status(200).json({
      success: true,
      message: "Tool added successfully.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error adding tool:", error);
    next(Boom.internal("Error adding tool."));
  }
}; exports.addTool = addTool;

/**
 * Remove a tool from the user's tools array.
 */
 const removeTool = async (req, res, next) => {
  try {
    const userId = _optionalChain([req, 'access', _39 => _39.payload, 'optionalAccess', _40 => _40.user_id]);
    const { toolId } = req.body;
    if (!userId || !toolId) {
      return next(Boom.badRequest("User ID and Tool ID are required."));
    }
    const updatedUser = await _user2.default.findByIdAndUpdate(
      userId,
      { $pull: { tools: toolId } },
      { new: true }
    );
    if (!updatedUser) return next(Boom.notFound("User not found."));
    res.status(200).json({
      success: true,
      message: "Tool removed successfully.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error removing tool:", error);
    next(Boom.internal("Error removing tool."));
  }
}; exports.removeTool = removeTool;

/**
 * Delete the current user's account.
 */
 const deleteAccount = async (req, res, next) => {
  try {
    const userId = _optionalChain([req, 'access', _41 => _41.payload, 'optionalAccess', _42 => _42.user_id]);
    if (!userId) {
      return next(Boom.unauthorized("User not authenticated."));
    }
    const deletedUser = await _user2.default.findByIdAndDelete(userId);
    if (!deletedUser) {
      return next(Boom.notFound("User not found."));
    }
    res.status(200).json({
      success: true,
      message: "Account deleted successfully.",
      data: deletedUser,
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    next(Boom.internal("Error deleting account."));
  }
}; exports.deleteAccount = deleteAccount;

 const getUserProfileForChecker = async (req, res, next) => {
  try {
    const { targetUserId } = req.params;
    const checkerUserId = _optionalChain([req, 'access', _43 => _43.payload, 'optionalAccess', _44 => _44.user_id]);
    
    if (!targetUserId || !checkerUserId) {
      return next(Boom.badRequest("Both target user ID and checker user ID are required."));
    }
    
    // Fetch target user and checker user
    const targetUser = await _user2.default.findById(targetUserId);
    if (!targetUser) {
      return next(Boom.notFound("Target user not found."));
    }
    
    // Compute totals (defaulting to 0 if arrays are missing)
    const totalMytribers = targetUser.mytribers ? targetUser.mytribers.length : 0;
    const totalCourses = targetUser.courses ? targetUser.courses.length : 0;
    const totalTribes = targetUser.joined_tribes ? targetUser.joined_tribes.length : 0;
    
    // Fetch tribe details for the joined tribes
    const joinedTribesDetails = await _mytribesjs2.default.find({ 
      _id: { $in: targetUser.joined_tribes }, 
      status: true // Only include tribes with status: true
    }).select('title tribeCategory _id thumbnail');  // Fetch name, category, _id, thumbnail
    
    // Define minimal view fields (always visible)
    const minimalFields = {
      username: targetUser.username,
      profile_pic: targetUser.profile_pic,
      email: targetUser.email,
      display_banner: targetUser.display_banner,
      title: targetUser.title,
      shortintro: targetUser.shortintro,
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      totalMytribers,
      totalCourses,
      totalTribes,
    };

    // Define full view fields (complete profile)
    const fullFields = {
      username: targetUser.username,
      profile_pic: targetUser.profile_pic,
      email: targetUser.email,
      display_banner: targetUser.display_banner,
      title: targetUser.title,
      shortintro: targetUser.shortintro,
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      country: targetUser.country,
      gender: targetUser.gender,
      business_country: targetUser.business_country,
      business_industry: targetUser.business_industry,
      value_chainstake: targetUser.value_chainstake,
      markets_covered: targetUser.markets_covered,
      immediate_needs: targetUser.immediate_needs,
      phone: targetUser.phone,
      joined_tribes: joinedTribesDetails, // Include joined tribe details
      courses: targetUser.courses,
      tools: targetUser.tools,
      primary_business: targetUser.primary_business,
      facebook_link: targetUser.facebook_link,
      linkedin_link: targetUser.linkedin_link,
      instagram_link: targetUser.instagram_link,
      x_link: targetUser.x_link,
      web_link: targetUser.web_link,
      account_avaialability: targetUser.account_avaialability,
      aboutme: targetUser.aboutme,
      mytribers: targetUser.mytribers,
      totalMytribers,
      totalCourses,
      totalTribes,
    };

    // Determine view based on privacy setting.
    // Assume targetUser.privacy exists and can be "private", "triber_only", or "public".
    const privacy = targetUser.privacy || "public";

    if (privacy === "private") {
      return res.status(200).json({ success: true, data: minimalFields });
    } else if (privacy === "triber_only") {
      // For triber_only, check if checker is mutual triber.
      const checkerUser = await _user2.default.findById(checkerUserId);
      if (!checkerUser) {
        return next(Boom.notFound("Checker user not found."));
      }
      const targetHasChecker = targetUser.mytribers.some(
        (id) => id.toString() === checkerUserId.toString()
      );
      const checkerHasTarget = checkerUser.mytribers.some(
        (id) => id.toString() === targetUserId.toString()
      );
      if (targetHasChecker && checkerHasTarget) {
        return res.status(200).json({ success: true, data: fullFields });
      } else {
        return res.status(200).json({ success: true, data: minimalFields });
      }
    } else {
      // Public: return full view.
      return res.status(200).json({ success: true, data: fullFields });
    }
  } catch (error) {
    console.error("Error fetching user profile for checker:", error);
    next(Boom.internal("Error fetching user profile."));
  }
}; exports.getUserProfileForChecker = getUserProfileForChecker;

 const getUserProfileForUser = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const excludeIds = req.body.excludeIds || [];

    const users = await _user2.default.aggregate([
      {
        $match: {
          _id: { $nin: excludeIds.map(id => new mongoose.Types.ObjectId(id)) },
        },
      },
      {
        $addFields: {
          randomSort: { $rand: {} }, // assign a random number
        },
      },
      { $sort: { randomSort: 1 } }, // sort by that random number
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          username: 1,
          title: 1,
          profile_pic: 1,
          display_banner: 1,
        },
      },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ]);

    res.status(200).json({
      success: true,
      currentPage: page,
      data: users,
    });
  } catch (error) {
    console.error("Error fetching paginated random users:", error);
    next(Boom.internal("Error fetching random users."));
  }
}; exports.getUserProfileForUser = getUserProfileForUser;



 const searchTribers = async (req, res, next) => {
  try {
    const { query } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    if (!query || query.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "Search query is required." });
    }

    const regex = new RegExp(query.trim(), "i");

    const results = await _user2.default.aggregate([
  {
    $addFields: {
      fullName: { $concat: ["$firstName", " ", "$lastName"] },
    },
  },
  {
    $match: {
      $or: [
        { fullName: regex },
        { username: regex },
      ],
    },
  },
  {
    $facet: {
      data: [
        {
          $project: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            username: 1,
            title: 1,
            profile_pic: 1,
            display_banner: 1,
          },
        },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ],
      totalCount: [{ $count: "count" }],
    },
  },
]);


    const users = results[0].data;
    const totalUsers = _optionalChain([results, 'access', _45 => _45[0], 'access', _46 => _46.totalCount, 'access', _47 => _47[0], 'optionalAccess', _48 => _48.count]) || 0;

    res.status(200).json({
      success: true,
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      data: users,
    });
  } catch (error) {
    console.error("Error searching tribers:", error);
    next(Boom.internal("Error searching tribers."));
  }
}; exports.searchTribers = searchTribers;





 const searchUsers = async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ success: false, message: "Search query is required." });
    }

    // Perform case-insensitive search across firstName, lastName, and username
    const users = await _user2.default.find({
      $or: [
        { firstName: { $regex: query, $options: "i" } },
        { lastName: { $regex: query, $options: "i" } },
        { username: { $regex: query, $options: "i" } },
      ],
    }).select('_id firstName lastName username title');

    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error("Error searching users:", error);
    next(Boom.internal("Error searching users."));
  }
}; exports.searchUsers = searchUsers;


 const getAllCoursesForUser = async (req, res, next) => {
  try {
    const userId = _optionalChain([req, 'access', _49 => _49.payload, 'optionalAccess', _50 => _50.user_id]);
    if (!userId) {
      return next(Boom.unauthorized("User not authenticated."));
    }
    // Populate courses (adjust fields if needed)
    const user = await _user2.default.findById(userId).populate("courses", "title description");
    if (!user) return next(Boom.notFound("User not found."));
    res.status(200).json({ success: true, courses: user.courses || [] });
  } catch (error) {
    console.error("Error fetching courses for user:", error);
    next(Boom.internal("Error fetching courses for user."));
  }
}; exports.getAllCoursesForUser = getAllCoursesForUser;

/**
 * Get all tribers (friends) for the current user.
 */
 const getAllTribersForUser = async (req, res, next) => {
  try {
    const userId = _optionalChain([req, 'access', _51 => _51.payload, 'optionalAccess', _52 => _52.user_id]);
    if (!userId) {
      return next(Boom.unauthorized("User not authenticated."));
    }
    // Populate mytribers with minimal info.
    const user = await _user2.default.findById(userId).populate("mytribers", "username profile_pic");
    if (!user) return next(Boom.notFound("User not found."));
    res.status(200).json({ success: true, tribers: user.mytribers || [] });
  } catch (error) {
    console.error("Error fetching tribers for user:", error);
    next(Boom.internal("Error fetching tribers for user."));
  }
}; exports.getAllTribersForUser = getAllTribersForUser;

 const getAllFriendRequests = async (req, res, next) => {
  try {
    // Get current user id from the verified token (set by verifyAccessToken)
    const currentUserId = req.user && (req.user._id || req.user.id);
    // Also get the id provided by the client in the query parameters.
    const userIdFromQuery = req.query.userId;
    
    // Populate blocked users (assume 'blockedtribers' is the field storing blocked users).
    const user = await _user2.default.findById(userIdFromQuery)
      .populate("requests", "username profile_pic");
    
    if (!user) {
      return next(Boom.notFound("User not found."));
    }
    
    res.status(200).json({ success: true, requests: user.requests || [] });
  } catch (error) {
    console.error("Error fetching blocked users:", error);
    next(Boom.internal("Error fetching blocked users."));
  }
}; exports.getAllFriendRequests = getAllFriendRequests;

 const getAllFriendList = async (req, res, next) => {
  try {
    // Get current user id from the verified token (set by verifyAccessToken)
    const currentUserId = req.user && (req.user._id || req.user.id);
    // Get the id provided by the client in the query parameters.
    const userIdFromQuery = req.query.userId;
    // Get the page number from query parameters, default to 1.
    const page = parseInt(req.query.page) || 1;
    const perPage = 10;

    // Populate friend list (assume 'mytribers' is the field storing friend relationships).
    const user = await _user2.default.findById(userIdFromQuery)
      .populate({
        path: "mytribers",
        select: "username firstName lastName profile_pic",
        options: {
          skip: (page - 1) * perPage,
          limit: perPage,
        },
      });

    if (!user) {
      return next(Boom.notFound("User not found."));
    }

    res.status(200).json({ success: true, requests: user.mytribers || [] });
  } catch (error) {
    console.error("Error fetching friend list:", error);
    next(Boom.internal("Error fetching friend list."));
  }
}; exports.getAllFriendList = getAllFriendList;
 const getFriendList = async (req, res, next) => {
  try {
    // Get current user id from the verified token (set by verifyAccessToken)
    const currentUserId = req.user && (req.user._id || req.user.id);
    // Get the id provided by the client in the query parameters.
    const userIdFromQuery = req.query.userId;

    // Populate friend list (assume 'mytribers' is the field storing friend relationships).
    const user = await _user2.default.findById(userIdFromQuery)
      .populate({
        path: "mytribers",
        select: "username firstName lastName profile_pic",
      });

    if (!user) {
      return next(Boom.notFound("User not found."));
    }

    res.status(200).json({ success: true, requests: user.mytribers || [] });
  } catch (error) {
    console.error("Error fetching friend list:", error);
    next(Boom.internal("Error fetching friend list."));
  }
}; exports.getFriendList = getFriendList;

 const getUsersChatInfo = async (req, res, next) => {
  try {
    // Accept IDs either as a comma-separated query param or as an array in the JSON body
    let { userIds } = req.query;
    if (!userIds && req.body.userIds) {
      userIds = req.body.userIds;
    }

    if (!userIds) {
      return next(Boom.badRequest('Missing userIds parameter'));
    }

    // Normalize to an array
    if (typeof userIds === 'string') {
      userIds = userIds.split(',').map((id) => id.trim());
    }

    // Query MongoDB for those users and only select the needed fields
    const users = await _user2.default.find(
      { _id: { $in: userIds } },
      'firstName lastName profile_pic'
    );

    // If you want to preserve input order, you could sort here by
    // matching the returned docs against the original userIds array.

    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users info:', error);
    next(Boom.internal('Error fetching users info.'));
  }
}; exports.getUsersChatInfo = getUsersChatInfo;

 // Adjust the import path as needed

 const getChatLobby = async (req, res, next) => {
  try {
    const currentUserId = req.query.userId;
    if (!currentUserId) {
      return next(Boom.unauthorized("User not authenticated."));
    }

    // Find all chat lobbies where the current user is a participant.
    const chatLobbies = await _chatlobbyjs2.default.find({ participants: currentUserId })
      .populate({
        path: "participants",
        select: "_id firstName lastName profile_pic", // Only select firstName and lastName
      });

    // Map over the chat lobbies and extract the other participant.
    // (Assuming a one-to-one chat lobby with two participants.)
    const lobbies = chatLobbies.map((lobby) => {
      // Filter out the current user from the participants array.
      const otherParticipant = lobby.participants.find(
        (participant) => participant._id.toString() !== currentUserId.toString()
      );
      return {
        chatLobbyId: lobby.chatLobbyId,
        // Return the other participant's first and last names (or null if not found)
        otherParticipant: otherParticipant
          ? {
              _id:otherParticipant._id,
              firstName: otherParticipant.firstName,
              lastName: otherParticipant.lastName,
              profile_pic:otherParticipant.profile_pic,
            }
          : null,
        // Optionally include messages or any other fields if needed:
        messages: lobby.messages,
      };
    });

    res.status(200).json({ success: true, lobbies });
  } catch (error) {
    console.error("Error fetching chat lobbies:", error);
    next(Boom.internal("Error fetching chat lobbies."));
  }
}; exports.getChatLobby = getChatLobby;

/**
 * Get all tribes (joined tribes) for the current user.
 */
 const getAllTribesForUser = async (req, res, next) => {
  try {
    const userId = _optionalChain([req, 'access', _53 => _53.payload, 'optionalAccess', _54 => _54.user_id]);
    if (!userId) {
      return next(Boom.unauthorized("User not authenticated."));
    }
    // Populate joined_tribes with minimal tribe info.
    const user = await _user2.default.findById(userId).populate("joined_tribes", "title shortDescription");
    if (!user) return next(Boom.notFound("User not found."));
    res.status(200).json({ success: true, tribes: user.joined_tribes || [] });
  } catch (error) {
    console.error("Error fetching tribes for user:", error);
    next(Boom.internal("Error fetching tribes for user."));
  }
}; exports.getAllTribesForUser = getAllTribesForUser;

/**
 * Get all blocked users for the current user.
 */
 const getAllBlockedForUser = async (req, res, next) => {
  try {
    // Get current user id from the verified token (set by verifyAccessToken)
    const currentUserId = req.user && (req.user._id || req.user.id);
    // Also get the id provided by the client in the query parameters.
    const userIdFromQuery = req.query.userId;
    
    // Populate blocked users (assume 'blockedtribers' is the field storing blocked users).
    const user = await _user2.default.findById(userIdFromQuery)
      .populate("blockedtribers", "username profile_pic");
    
    if (!user) {
      return next(Boom.notFound("User not found."));
    }
    
    res.status(200).json({ success: true, blocked: user.blockedtribers || [] });
  } catch (error) {
    console.error("Error fetching blocked users:", error);
    next(Boom.internal("Error fetching blocked users."));
  }
}; exports.getAllBlockedForUser = getAllBlockedForUser;

 const getTribeDetails = async (req, res, next) => {
  try {
    const { tribeId } = req.params;
    if (!tribeId) {
      return next(Boom.badRequest("Tribe ID is required."));
    }
    
    // Find the tribe and optionally populate member/admin details if needed.
    const tribe = await _mytribesjs2.default.findById(tribeId)
      .populate("members", "username profile_pic")
      .populate("admins", "username profile_pic");
      
    if (!tribe) {
      return next(Boom.notFound("Tribe not found."));
    }
    
    // Build the details object using only the requested fields.
    const details = {
      title: tribe.title,
      members: tribe.members,
      admins: tribe.admins,
      shortDescription: tribe.shortDescription,
      longDescription: tribe.longDescription,
      status: tribe.status,
      rating: tribe.rating,
      thumbnail: tribe.thumbnail,
      banner: tribe.banner,
      tribeCategory: tribe.tribeCategory,
      joinPolicy: tribe.joinPolicy,
      membersLimit: tribe.membersLimit,
    };
    
    res.status(200).json({
      success: true,
      data: details,
    });
  } catch (error) {
    console.error("Error fetching tribe details:", error);
    next(Boom.internal("Error fetching tribe details."));
  }
}; exports.getTribeDetails = getTribeDetails;

 const blockUserFromTribe = async (req, res, next) => {
  try {
    const adminId = _optionalChain([req, 'access', _55 => _55.payload, 'optionalAccess', _56 => _56.user_id]);
    const { tribeId, targetUserId } = req.body;
    if (!adminId || !tribeId || !targetUserId) {
      return next(Boom.badRequest("Tribe ID, target user ID and admin user ID are required."));
    }

    // Fetch the tribe
    const tribe = await _mytribesjs2.default.findById(tribeId);
    if (!tribe) return next(Boom.notFound("Tribe not found."));

    // Verify that the current user is an admin of the tribe
    if (!tribe.admins.some(id => id.toString() === adminId.toString())) {
      return next(Boom.forbidden("Only tribe admins can block users."));
    }

    // If the target user is currently a member, remove them from members
    await _mytribesjs2.default.findByIdAndUpdate(tribeId, { $pull: { members: targetUserId } });

    // Add the target user to the tribe's blockedUsers array (if not already present)
    const updatedTribe = await _mytribesjs2.default.findByIdAndUpdate(
      tribeId,
      { $addToSet: { blockedUsers: targetUserId } },
      { new: true }
    );
    if (!updatedTribe) return next(Boom.notFound("Tribe not found after update."));

    // Also add this tribe to the target user's blockedbytribe array
    const updatedUser = await _user2.default.findByIdAndUpdate(
      targetUserId,
      { $addToSet: { blockedbytribe: tribeId } },
      { new: true }
    );
    if (!updatedUser) return next(Boom.notFound("Target user not found."));

    res.status(200).json({
      success: true,
      message: "User blocked from tribe successfully.",
      data: { tribe: updatedTribe, user: updatedUser },
    });
  } catch (error) {
    console.error("Error blocking user from tribe:", error);
    next(Boom.internal("Error blocking user from tribe."));
  }
}; exports.blockUserFromTribe = blockUserFromTribe;

/**
 * Unblock a user from a tribe.
 * Only a tribe admin can perform this action.
 * Expects in req.body: { tribeId, targetUserId }
 */
 const unblockUserFromTribe = async (req, res, next) => {
  try {
    const adminId = _optionalChain([req, 'access', _57 => _57.payload, 'optionalAccess', _58 => _58.user_id]);
    const { tribeId, targetUserId } = req.body;
    if (!adminId || !tribeId || !targetUserId) {
      return next(Boom.badRequest("Tribe ID, target user ID and admin user ID are required."));
    }

    // Fetch the tribe
    const tribe = await _mytribesjs2.default.findById(tribeId);
    if (!tribe) return next(Boom.notFound("Tribe not found."));

    // Verify that the current user is an admin of the tribe
    if (!tribe.admins.some(id => id.toString() === adminId.toString())) {
      return next(Boom.forbidden("Only tribe admins can unblock users."));
    }

    // Remove the target user from tribe's blockedUsers array
    const updatedTribe = await _mytribesjs2.default.findByIdAndUpdate(
      tribeId,
      { $pull: { blockedUsers: targetUserId } },
      { new: true }
    );
    if (!updatedTribe) return next(Boom.notFound("Tribe not found after update."));

    // Remove this tribe from the target user's blockedbytribe array
    const updatedUser = await _user2.default.findByIdAndUpdate(
      targetUserId,
      { $pull: { blockedbytribe: tribeId } },
      { new: true }
    );
    if (!updatedUser) return next(Boom.notFound("Target user not found."));

    res.status(200).json({
      success: true,
      message: "User unblocked from tribe successfully.",
      data: { tribe: updatedTribe, user: updatedUser },
    });
  } catch (error) {
    console.error("Error unblocking user from tribe:", error);
    next(Boom.internal("Error unblocking user from tribe."));
  }
}; exports.unblockUserFromTribe = unblockUserFromTribe;



exports. default = {
	Register,
	Login,
	RefreshToken,
	Logout,
	updateAddress,
	Me: exports.Me,
  updateUserInfo,
  GetTotalNumberOfRegistrationsByDateRange,
  getAddress,
  getAllUsers,
  getOrCreateChatLobby,
  getUserChatLobbies,
  getChatMessages: exports.getChatMessages,
  removeRejectedFriendRequest: exports.removeRejectedFriendRequest,
  updateUserAdminDetails: exports.updateUserAdminDetails,
  acceptTribeRequest: exports.acceptTribeRequest,
  rejectTribeRequest: exports.rejectTribeRequest,
  createChatLobby,
  getAllAdminUsers: exports.getAllAdminUsers,
  sendFriendRequest: exports.sendFriendRequest,
  acceptFriendRequest: exports.acceptFriendRequest,
  rejectFriendRequest: exports.rejectFriendRequest,
  removeUserProfilePic: exports.removeUserProfilePic,
  blockUser: exports.blockUser,
  cancelSentFriendRequest: exports.cancelSentFriendRequest,
  unblockUser: exports.unblockUser,
  removeFriend: exports.removeFriend,
  getAllFriendList: exports.getAllFriendList,
  getFriendList: exports.getFriendList,
  updateUserPassword: exports.updateUserPassword,
  getAllFriendRequests: exports.getAllFriendRequests,
  removeUserBanner: exports.removeUserBanner,
  updateUsername: exports.updateUsername,
  joinTribe: exports.joinTribe,
  leaveTribe: exports.leaveTribe,
  addCourse: exports.addCourse,
  removeCourse: exports.removeCourse,
  addTool: exports.addTool,
  removeTool: exports.removeTool,
  deleteAccount: exports.deleteAccount,
  updateUserMedia: exports.updateUserMedia,
  getUserProfileForChecker: exports.getUserProfileForChecker,
  getAllCoursesForUser: exports.getAllCoursesForUser,
  getAllTribersForUser: exports.getAllTribersForUser,
  blockUserFromTribe: exports.blockUserFromTribe,
  getAllTribesForUser: exports.getAllTribesForUser,
  getAllBlockedForUser: exports.getAllBlockedForUser,
  unblockUserFromTribe: exports.unblockUserFromTribe,
  deleteChatForUser,
  getTribeDetails: exports.getTribeDetails,
  getTribeMembers: exports.getTribeMembers,
  deleteChatLobbyForUser: exports.deleteChatLobbyForUser,
  getUserProfileForUser: exports.getUserProfileForUser,
  kickUserFromTribe: exports.kickUserFromTribe,
  searchUsers: exports.searchUsers,
  searchTribers: exports.searchTribers,
  getChatLobby: exports.getChatLobby,
  deleteUser,
  getUsersChatInfo: exports.getUsersChatInfo,
};