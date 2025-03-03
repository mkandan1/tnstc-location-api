import mongoose from 'mongoose';
import {toJSON, paginate} from './plugins/index.js'

const userSchema = mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      private: true, // used by the toJSON plugin
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      minlength: 10,
    },
    role: {
      type: String,
      enum: ['driver', 'manager', 'admin'],
      default: 'driver',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      required: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    address: {
      type: String,
    },
    emergencyContact: {
      name: String,
      contactNumber: String,
    },
    profilePicture: {
      type: String,
      default: 'https://www.shutterstock.com/image-vector/blank-avatar-photo-place-holder-600nw-1095249842.jpg'
    },
    permissions: {
      type: [String],
      enum: [
        'viewRoute', 
        'viewScheduledBus', 
        'updateLocation', 
        'viewAssignedBus', 
        'viewProfile', 
        'updateProfile',
        'manageDrivers',
        'manageManagers',
        'manageRoutes',
        'manageScheduleBus',
      ],
      default: function () {
        return this.role === 'manager'
          ? ['viewRoute', 'viewScheduledBus', 'updateLocation', 'viewAssignedBus', 'viewProfile', 'updateProfile', 'manageDrivers', 'manageRoutes', 'manageScheduleBus']
          : ['viewRoute', 'viewScheduledBus', 'updateLocation', 'viewAssignedBus', 'viewProfile', 'updateProfile'];
      },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.plugin(paginate);

// // Hash password before saving
// userSchema.pre('save', async function (next) {
//   if (this.isModified('password')) {
//     this.password = await bcrypt.hash(this.password, 8);
//   }
//   next();
// });

// // Check if email is taken
// userSchema.statics.isEmailTaken = async function (email, excludeUserId) {
//   const user = await this.findOne({ email, _id: { $ne: excludeUserId } });
//   return !!user;
// };

// // Check if password matches
// userSchema.methods.isPasswordMatch = async function (password) {
//   return bcrypt.compare(password, this.password);
// };

const User = mongoose.model('User', userSchema);

export default User;
