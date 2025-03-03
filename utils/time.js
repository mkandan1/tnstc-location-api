function calculateScheduledArrival(scheduleTime, totalDistance, avgSpeed = 20) {
    const scheduleDate = new Date(scheduleTime); 
    const timeRequiredMinutes = (totalDistance / avgSpeed) * 60; 

    scheduleDate.setMinutes(scheduleDate.getMinutes() + timeRequiredMinutes);

    return scheduleDate.toISOString();
}

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (angle) => (Math.PI / 180) * angle;
  const R = 6371; // Radius of Earth in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

const calculateSpeed = (prevLat, prevLng, prevTimestamp, newLat, newLng) => {
    if (!prevLat || !prevLng || !prevTimestamp) return null; // Skip speed calculation if data is missing
  
    const currentTimestamp = Date.now();
    const timeDiff = (currentTimestamp - prevTimestamp) / 1000; // Time in seconds
  
    if (timeDiff < 1) return null; // Ignore updates that are too frequent
  
    const R = 6371; // Earth's radius in km
    const toRad = (deg) => (deg * Math.PI) / 180;
  
    const dLat = toRad(newLat - prevLat);
    const dLng = toRad(newLng - prevLng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(prevLat)) * Math.cos(toRad(newLat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
  
    const speed = (distance / (timeDiff / 3600)).toFixed(2); // Speed in km/h
  
    return parseFloat(speed); // Return speed as a number
  };
  

export {
    calculateScheduledArrival,
    calculateSpeed,
    haversineDistance
}