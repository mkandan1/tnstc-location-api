import mongoose from 'mongoose';
const { Schema } = mongoose;

const busSchema = new Schema(
  {
    busNumber: {
      type: String,
      required: true,
    },
    busName: {
      type: String,
      required: true
    },
    busImage: {
      type: String,
      default: 'https://tnstc.s3.ap-south-1.amazonaws.com/uploads/buses/default.jpg'
    },
    isAc: {
      type: Boolean,
      default: false,
    },
    isLowFloor: {
      type: Boolean,
      default: false,
    },
    passengerType: {
      type: String,
      enum: ['Regular', 'Senior Citizen', 'Student', 'Differently-Abled'],
      default: 'Regular',
    },
    specialService: {
      type: Boolean,
      default: false,
    },
    isNightService: {
      type: Boolean,
      default: false,
    },
    passengerCapacity: {
      type: Number,
      required: true,
    },
    busType: {
      type: String,
      enum: ['City', 'Intercity', 'Suburban', 'Special'],
      default: 'City',
    },
    fuelType: {
      type: String,
      enum: ['Diesel', 'CNG', 'Electric', 'Hybrid'],
      default: 'Diesel',
    },
    passengerFeedback: [
      {
        rating: {
          type: Number,
          min: 1,
          max: 5,
        },
        comments: String,
        date: Date,
      },
    ],
    ticketingSystem: {
      type: String,
      enum: ['Manual', 'Online', 'Both'],
      default: 'Manual',
    },
    liveTrackingUrl: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Bus', busSchema);
