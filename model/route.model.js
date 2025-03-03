import mongoose from 'mongoose';
const { Schema } = mongoose;

const routeSchema = new Schema(
  {
    routeName: {
      type: String,
      required: true,
      unique: true,
    },
    origin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusStop', // Reference to BusStop model
      required: true,
    },
    destination: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusStop', // Reference to BusStop model
      required: true,
    },
    totalDistance: {
      type: Number,
      required: true, // Distance in kilometers
    },
    totalDuration: {
      type: Number,
      required: true, // Duration in minutes
    },
    stops: [
      {
        stopId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'BusStop', // Reference BusStop
          required: true,
        },
        stopOrder: {
          type: Number,
          required: true,
        },
        distanceFromOrigin: {
          type: Number,
          required: true
        }
      },
    ],
    routeType: {
      type: String,
      enum: ['Urban', 'Suburban', 'Intercity'],
      default: 'Urban',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Route', routeSchema);
