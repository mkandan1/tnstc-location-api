import mongoose from 'mongoose';
import { paginate } from './plugins/index.js';
import routeModel from './route.model.js';
import BusStop from './stops.model.js';
import User from './user.model.js';
import Bus from './bus.model.js'

const { Schema } = mongoose;

const scheduledBusSchema = new Schema(
  {
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Bus"
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User"
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      required: true,
    },
    scheduleTime: {
      type: Date,
      required: true,
    },
    actualTime: {
      type: Date,
    },
    scheduledArrivalTime: {
      type: Date,
    },
    estimatedArrivalTime: {
      type: Date
    },
    distanceTraveled: {
      type: Number
    },
    distanceRemaining: {
      type: Number
    },
    speed: {
      type: Number,
    },
    journeyCompletion: {
      type: Number
    },
    status: {
      type: String,
      enum: ['Scheduled', 'On Route', 'Completed', 'Cancelled'],
      default: 'Scheduled',
    },
    comments: {
      type: String,
      default: '',
    },
    location: {
      latitude: {
        type: Number,
        min: -90,
        max: 90,
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180,
      },
      lastUpdated: {
        type: Date
      }
    },
    realTimeTracking: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

scheduledBusSchema.plugin(paginate);

export default mongoose.model('ScheduledBus', scheduledBusSchema);
