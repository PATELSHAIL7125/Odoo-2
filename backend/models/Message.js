const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Sender is required']
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Recipient is required']
    },
    subject: {
        type: String,
        trim: true,
        maxlength: [200, 'Subject cannot exceed 200 characters']
    },
    content: {
        type: String,
        required: [true, 'Message content is required'],
        trim: true,
        maxlength: [5000, 'Message content cannot exceed 5000 characters']
    },
    type: {
        type: String,
        enum: ['direct', 'system', 'support', 'notification'],
        default: 'direct'
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    archivedAt: {
        type: Date
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    relatedSwapRequest: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SwapRequest'
    },
    attachments: [{
        filename: String,
        originalName: String,
        mimetype: String,
        size: Number,
        url: String
    }],
    metadata: {
        category: String,
        tags: [String],
        autoGenerated: {
            type: Boolean,
            default: false
        },
        templateId: String
    }
}, {
    timestamps: true
});

// Indexes for better query performance
messageSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ type: 1, priority: 1 });
messageSchema.index({ isArchived: 1 });
messageSchema.index({ relatedSwapRequest: 1 });

// Instance method to mark as read
messageSchema.methods.markAsRead = function() {
    if (!this.isRead) {
        this.isRead = true;
        this.readAt = new Date();
        return this.save();
    }
    return Promise.resolve(this);
};

// Instance method to archive message
messageSchema.methods.archive = function() {
    this.isArchived = true;
    this.archivedAt = new Date();
    return this.save();
};

// Static method to get conversation between two users
messageSchema.statics.getConversation = function(user1Id, user2Id, options = {}) {
    const { limit = 50, skip = 0 } = options;
    
    return this.find({
        $or: [
            { sender: user1Id, recipient: user2Id },
            { sender: user2Id, recipient: user1Id }
        ]
    })
    .populate('sender', 'name avatar')
    .populate('recipient', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

// Static method to get user's inbox
messageSchema.statics.getInbox = function(userId, options = {}) {
    const {
        limit = 20,
        skip = 0,
        unreadOnly = false,
        type = null
    } = options;

    let query = { recipient: userId };
    
    if (unreadOnly) {
        query.isRead = false;
    }
    
    if (type) {
        query.type = type;
    }

    return this.find(query)
        .populate('sender', 'name avatar role')
        .populate('relatedSwapRequest', 'skillOffered skillWanted status')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();
};

// Static method to get user's sent messages
messageSchema.statics.getSentMessages = function(userId, options = {}) {
    const { limit = 20, skip = 0 } = options;

    return this.find({ sender: userId })
        .populate('recipient', 'name avatar')
        .populate('relatedSwapRequest', 'skillOffered skillWanted status')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();
};

// Static method to create system message
messageSchema.statics.createSystemMessage = function(recipientId, content, options = {}) {
    const message = new this({
        sender: null, // System messages have no sender
        recipient: recipientId,
        content,
        type: 'system',
        subject: options.subject || 'System Notification',
        priority: options.priority || 'medium',
        relatedSwapRequest: options.relatedSwapRequest,
        metadata: {
            ...options.metadata,
            autoGenerated: true
        }
    });
    
    return message.save();
};

module.exports = mongoose.model('Message', messageSchema);