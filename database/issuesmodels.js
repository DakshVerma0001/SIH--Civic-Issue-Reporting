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
    //departemnt jise assign kiya gya
    assignedDepartment: {
    type: String, // ya future me ek aur collection bana sakte ho
    default: null
},

    //  AI Integration fields
    aiCategory: {
        type: String,
        default: "Uncategorized"
    },
    aiPriority: {
        type: String,
        enum: ["Low", "Medium", "High","Critical"],
        default: "Medium"
    },
     verifyToken: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model("issuesmodels", issueSchema);
