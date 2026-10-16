const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    // Lowercase copy so "Kavya" and "kavya" can't both register.
    usernameKey: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    avatar: { type: String, default: 'fox' },
  },
  { timestamps: true },
);

userSchema.methods.toPublic = function toPublic() {
  return { id: this._id.toString(), username: this.username, email: this.email, avatar: this.avatar, createdAt: this.createdAt };
};

const scoreSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    game: { type: String, required: true },
    score: { type: Number, required: true, min: 0 },
    // Extra numbers a game reports, e.g. distance and coins.
    stats: { type: Map, of: Number, default: {} },
    durationMs: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

// Leaderboards read the best scores per game, newest first within a period.
scoreSchema.index({ game: 1, score: -1 });
scoreSchema.index({ game: 1, createdAt: -1 });
scoreSchema.index({ user: 1, game: 1, score: -1 });

module.exports = {
  User: mongoose.model('User', userSchema),
  Score: mongoose.model('Score', scoreSchema),
};
