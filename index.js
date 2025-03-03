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
          {
            path: 'origin', // Populating the origin field in the route
            model: 'BusStop' // Make sure 'BusStop' matches the name of your BusStop model
          },
          {
            path: 'destination', // Populating the destination field in the route
            model: 'BusStop' // Make sure 'BusStop' matches the name of your BusStop model
          }
        ]
      });
    if (!scheduledBus) throw new Error("Scheduled bus not found");

    const { location, route } = scheduledBus;
    if (!route || !route.origin || !route.destination || !route.stops || !route.totalDistance) {
      throw new Error("Route data is invalid or missing required details");
    }

    const stops = await BusStop.find({ '_id': { $in: route.stops.map(stop => stop.stopId) } });
    if (!stops || stops.length === 0) {
      throw new Error("No stops found for this route");
    }
    // Verify that the route origin and destination have valid coordinates
    if (!route.origin.coordinates || !route.origin.coordinates.lat || !route.origin.coordinates.lng) {
      throw new Error("Origin coordinates are missing or invalid");
    }
    if (!route.destination.coordinates || !route.destination.coordinates.lat || !route.destination.coordinates.lng) {
      throw new Error("Destination coordinates are missing or invalid");
    }

    const prevLat = location?.latitude;
    const prevLng = location?.longitude;
    const prevTimestamp = location.lastUpdated ? new Date(location.lastUpdated).getTime() : null;

    // Step 1: Calculate Distance from Origin to Current Location
    const distanceFromOrigin = haversineDistance(
      route.origin.coordinates.lat,
      route.origin.coordinates.lng,
      latitude,
      longitude
    );

    // Step 2: Calculate Remaining Distance to Destination
    let remainingDistance = haversineDistance(
      latitude,
      longitude,
      route.destination.coordinates.lat,
      route.destination.coordinates.lng
    );

    // Step 3: Calculate Completion Percentage
    let completionPercentage = (distanceFromOrigin / route.totalDistance) * 100;

    // Ensure values are within valid range
    remainingDistance = Math.max(remainingDistance, 0);
    completionPercentage = Math.max(0, Math.min(completionPercentage, 100));

    // Step 4: Calculate Speed
    const speed = calculateSpeed(prevLat, prevLng, prevTimestamp, latitude, longitude);

    // Step 5: Update Database
    const updateFields = {
      "location.latitude": latitude,
      "location.longitude": longitude,
      "location.lastUpdated": new Date(),
      distanceTraveled: distanceFromOrigin.toFixed(2),
      distanceRemaining: remainingDistance.toFixed(2),
      journeyCompletion: completionPercentage.toFixed(2),
    };

    if (speed !== null) updateFields.speed = speed;

    const THRESHOLD_DISTANCE = 0.5; // 100 meters

    if (!busData.leftAt) {
      busData.leftAt = [];
  }

  // Find the closest stop within threshold
  const passedStop = stops.find(stop => {
      const distanceToStop = haversineDistance(latitude, longitude, stop.coordinates.lat, stop.coordinates.lng);
      return distanceToStop < THRESHOLD_DISTANCE;
  });

  if (passedStop) {
      const stopId = passedStop._id; // Assuming stops have an `_id` field

      const alreadyRecorded = busData.leftAt.some(entry => entry.stop.$oid === stopId);

      if (!alreadyRecorded) {
          busData.leftAt.push({
              stop: { "$oid": stopId },
              time: { "$date": new Date() },
          });
      }
  }


    const updatedBus = await ScheduledBus.findByIdAndUpdate(
      scheduledBusId,
      { $set: updateFields, $push: { leftAt: { $each: passedStops.map(stop => ({ stop: stop._id, time: new Date() })) } } },
      { new: true }
    );

    return updatedBus;
  } catch (error) {
    console.error("❌ Error updating bus location:", error.message);
    throw new Error("Error updating bus location");
  }
};
