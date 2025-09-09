const mongoose = require("mongoose");

const issueSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String
    },
    location: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'In Progress', 'Resolved'],
        default: 'Pending'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    //  AI Integration fields
    aiCategory: {
        type: String,
        default: "Uncategorized"
    },
    aiPriority: {
        type: String,
        enum: ["Low", "Medium", "High"],
        default: "Medium"
    }
}, { timestamps: true });

module.exports = mongoose.model("issue", issueSchema);
