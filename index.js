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
    const scheduledBus = await ScheduledBus.findById(scheduledBusId).populate("route");
    if (!scheduledBus) throw new Error("Scheduled bus not found");

    const { location, distanceTravelled = 0, route } = scheduledBus;
    if (!route || !route.origin || !route.destination || !route.totalDistance) {
      throw new Error("Route data is invalid or missing required details");
    }

    const prevLat = location?.latitude;
    const prevLng = location?.longitude;
    const prevTimestamp = location.lastUpdated ? new Date(location.lastUpdated).getTime() : null;

    // Calculate distance moved using haversine formula
    let distanceIncrement = 0;
    if (prevLat && prevLng) {
      distanceIncrement = haversineDistance(prevLat, prevLng, latitude, longitude);
    }

    // **Fix 1: Use the total planned route distance instead of accumulated small distances**
    const newDistanceTravelled = Math.min(distanceTravelled + distanceIncrement, route.totalDistance);

    // **Fix 2: Calculate remaining distance using route stops**
    const stops = await BusStop.find({ _id: { $in: route.stops } }).sort("order");
    let remainingDistance = 0;

    for (let i = 0; i < stops.length - 1; i++) {
      const stop = stops[i];
      const nextStop = stops[i + 1];

      if (haversineDistance(latitude, longitude, stop.coordinates.lat, stop.coordinates.lng) < 
          haversineDistance(latitude, longitude, nextStop.coordinates.lat, nextStop.coordinates.lng)) {
        // If the bus is between this stop and the next one, sum remaining distance
        for (let j = i + 1; j < stops.length; j++) {
          remainingDistance += haversineDistance(
            stops[j - 1].coordinates.lat,
            stops[j - 1].coordinates.lng,
            stops[j].coordinates.lat,
            stops[j].coordinates.lng
          );
        }
        break;
      }
    }

    // Ensure remaining distance is never negative
    remainingDistance = Math.max(remainingDistance, 0);

    // **Fix 3: Calculate completion percentage correctly**
    let completionPercentage = (newDistanceTravelled / route.totalDistance) * 100;
    completionPercentage = Math.max(0, Math.min(completionPercentage, 100));

    // Calculate speed
    const speed = calculateSpeed(prevLat, prevLng, prevTimestamp, latitude, longitude);

    const updateFields = {
      "location.latitude": latitude,
      "location.longitude": longitude,
      "location.lastUpdated": new Date(),
      distanceTraveled: newDistanceTravelled.toFixed(2),
      distanceRemaining: remainingDistance.toFixed(2),
      journeyCompletion: completionPercentage.toFixed(2),
    };

    if (speed !== null) updateFields.speed = speed;

    const updatedBus = await ScheduledBus.findByIdAndUpdate(scheduledBusId, { $set: updateFields }, { new: true });

    return updatedBus;
  } catch (error) {
    console.error("❌ Error updating bus location:", error.message);
    throw new Error("Error updating bus location");
  }
};


