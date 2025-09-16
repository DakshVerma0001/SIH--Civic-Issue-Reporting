import mongoose from "mongoose";

const issueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    image: {
      type: String,
    },

    location: {
      type: String,
      required: true,
    },

    latitude: Number,
    longitude: Number,

    // ✅ Updated status to support admin actions
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "in progress", "resolved"],
      default: "pending",
    },

    // ✅ New AI fields
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "low",
    },

    category: {
      type: String, // e.g., "Road", "Water", etc.
      default: "General",
    },

    // Custom ID for public reference
    customId: {
      type: String,
      unique: true,
      default: function () {
        return "CFU" + Math.floor(100000 + Math.random() * 900000);
      },
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
  },
  { timestamps: true }
);

// pre-save hook for customId (safety net)
issueSchema.pre("save", function (next) {
  if (!this.customId) {
    this.customId =
      "CFU" + Math.floor(100000 + Math.random() * 900000); // CFU + 6 digits
  }
  next();
});

const issueModel = mongoose.model("Issue", issueSchema);
export default issueModel;
