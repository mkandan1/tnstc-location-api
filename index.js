import { WebSocketServer } from "ws";
import express from "express";
import http from "http";
import ScheduledBus from "./model/scheduledbus.model.js";
import { haversineDistance, calculateSpeed } from "./utils/time.js";
import dotenv from "dotenv";
import BusStop from "./model/stops.model.js";
import connectDB from "./database.js";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
dotenv.config();
connectDB();

wss.on("connection", (ws) => {
  console.log("🚍 Client connected for location updates");

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "locationUpdate") {
        // Driver is sending a location update
        const { scheduledBusId, latitude, longitude } = data;

        if (!scheduledBusId || latitude === undefined || longitude === undefined) {
          return ws.send(JSON.stringify({ error: "Invalid data format" }));
        }

        const updatedBus = await updateBusLocation(scheduledBusId, latitude, longitude);

        const buses = await ScheduledBus.find().populate("route driver bus");

        wss.clients.forEach((client) => {
          if (client.readyState === ws.OPEN) {
            client.send(JSON.stringify({ type: "busUpdate", buses }));
          }
        });
      }

      if (data.type === "busStopRequest") {
        // Passenger is requesting buses for a specific stop
        const { busStopId, status } = data;
        if (!busStopId) {
          return ws.send(JSON.stringify({ error: "Bus stop ID is required" }));
        }
        const options = {
          page: 1,
          limit: 10,
          sortBy: 'createdAt:asc',
          populate: 'driver,route,bus,route.stops.stopId', // Ensure stops are populated correctly
        };
        let schedules = await ScheduledBus.paginate({}, options);

        // Populate origin and destination after querying
        schedules.results = await ScheduledBus.populate(schedules.results, {
          path: 'route.origin route.destination',
          model: 'BusStop', // Ensure 'BusStop' matches your Mongoose model name
        });

        if (busStopId) {
          schedules = schedules.results.filter((schedule) => {
            const stopMatches = schedule.route.stops.some((stop) =>
              stop.stopId._id.toString() === busStopId
            );
            return stopMatches;
          });
        }

        if (status && status.length > 0) {
          schedules = schedules.filter((schedule) => status.includes(schedule.status));
        }

        if (schedules.length === 0) {
          console.log('No scheduled buses found for the provided bus stop or status.');
        }

        ws.send(JSON.stringify({ type: "busStopResponse", buses: schedules }));
      }

    } catch (error) {
      console.error("❌ Error processing WebSocket message:", error);
      ws.send(JSON.stringify({ error: "Failed to process request" }));
    }
  });

  ws.on("close", () => {
    console.log("❌ Client disconnected from WebSocket");
  });
});



const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Location WebSocket Server running on port ${PORT}`));

const updateBusLocation = async (scheduledBusId, latitude, longitude) => {
  try {
    const scheduledBus = await ScheduledBus.findById(scheduledBusId)
      .populate({
        path: 'route',
        populate: [
          { path: 'origin', model: 'BusStop' },
          { path: 'destination', model: 'BusStop' }
        ]
      });

    if (!scheduledBus) throw new Error("Scheduled bus not found");

    const { location, route, leftAt = [] } = scheduledBus;
    if (!route || !route.origin || !route.destination || !route.stops || !route.totalDistance) {
      throw new Error("Route data is invalid or missing required details");
    }

    const stops = await BusStop.find({ '_id': { $in: route.stops.map(stop => stop.stopId) } });
    if (!stops.length) throw new Error("No stops found for this route");

    const prevLat = location?.latitude;
    const prevLng = location?.longitude;
    const prevTimestamp = location.lastUpdated ? new Date(location.lastUpdated).getTime() : null;

    // Distance calculations
    const distanceFromOrigin = haversineDistance(
      route.origin.coordinates.lat, route.origin.coordinates.lng, latitude, longitude
    );

    let remainingDistance = haversineDistance(
      latitude, longitude, route.destination.coordinates.lat, route.destination.coordinates.lng
    );

    let completionPercentage = (distanceFromOrigin / route.totalDistance) * 100;
    remainingDistance = Math.max(remainingDistance, 0);
    completionPercentage = Math.max(0, Math.min(completionPercentage, 100));

    // Speed calculation
    const speed = calculateSpeed(prevLat, prevLng, prevTimestamp, latitude, longitude);

    // Check for nearest stop
    const THRESHOLD_DISTANCE = 0.01; // 50 meters
    const passedStop = stops.find(stop => {
      return haversineDistance(latitude, longitude, stop.coordinates.lat, stop.coordinates.lng) < THRESHOLD_DISTANCE;
    });

    if (passedStop) {
      const stopId = passedStop._id;

      // Ensure stop is not already recorded
      const alreadyRecorded = leftAt.some(entry => entry.stop.toString() === stopId.toString());

      if (!alreadyRecorded) {
        leftAt.push({
          stop: stopId,
          time: new Date()
        });
      }
    }

    // Prepare update fields
    const updateFields = {
      "location.latitude": latitude,
      "location.longitude": longitude,
      "location.lastUpdated": new Date(),
      distanceTraveled: distanceFromOrigin.toFixed(2),
      distanceRemaining: remainingDistance.toFixed(2),
      journeyCompletion: completionPercentage.toFixed(2),
      leftAt
    };

    if (speed !== null) updateFields.speed = speed;

    const updatedBus = await ScheduledBus.findByIdAndUpdate(
      scheduledBusId,
      { $set: updateFields },
      { new: true }
    );

    return updatedBus;
  } catch (error) {
    console.error("❌ Error updating bus location:", error.message);
    throw new Error("Error updating bus location");
  }
};

