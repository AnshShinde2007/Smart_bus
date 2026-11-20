import db from "./db.js";

export const TRIP_SELECT = `SELECT t.id,t.journey_date,t.departure_time,t.arrival_time,t.fare_paise,t.status,
  b.id AS bus_id,b.registration_number AS bus,b.bus_name,b.capacity,b.bus_type,
  r.id AS route_id,r.route_name,r.source,r.destination,u.name AS driver_name
  FROM trips t JOIN buses b ON b.id=t.bus_id JOIN routes r ON r.id=t.route_id LEFT JOIN users u ON u.id=t.driver_id`;

export function listTrips({from,to,date}) {
  const trips=db.prepare(`${TRIP_SELECT} WHERE (?='' OR r.source=?) AND (?='' OR r.destination=?) AND (?='' OR t.journey_date=?) AND t.status IN ('scheduled','active') ORDER BY t.journey_date,t.departure_time`)
    .all(from||"",from||"",to||"",to||"",date||"",date||"");
  const stops=db.prepare("SELECT stop_name,latitude,longitude,stop_order FROM stops WHERE route_id=? ORDER BY stop_order");
  return trips.map((trip)=>({...trip,stops:stops.all(trip.route_id)}));
}

export function getTrip(id) {
  const trip=db.prepare(`${TRIP_SELECT} WHERE t.id=?`).get(id);
  return trip?{...trip,stops:db.prepare("SELECT stop_name,latitude,longitude,stop_order FROM stops WHERE route_id=? ORDER BY stop_order").all(trip.route_id)}:null;
}

export function hasScheduleConflict({date,departure,arrival,busId,driverId,excludeId}){
  const shiftDate=(value,days)=>{const date=new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);};
  const rows=db.prepare("SELECT id,bus_id,driver_id,journey_date,departure_time,arrival_time FROM trips WHERE status IN ('scheduled','active') AND journey_date IN (?,?,?) AND id<>?").all(shiftDate(date,-1),date,shiftDate(date,1),excludeId||"");
  const minutes=(time)=>{const [h,m]=time.split(":").map(Number);return h*60+m;};
  const overlaps=(start,end,otherStart,otherEnd)=>{const end1=end<=start?end+1440:end;const end2=otherEnd<=otherStart?otherEnd+1440:otherEnd;return [-1440,0,1440].some((offset)=>start<end2+offset&&otherStart+offset<end1);};
  return rows.some((trip)=>{
    if(trip.bus_id!==busId&&(!driverId||trip.driver_id!==driverId))return false;
    const dayOffset=trip.journey_date<date?-1440:trip.journey_date>date?1440:0;
    return overlaps(minutes(departure),minutes(arrival),minutes(trip.departure_time)+dayOffset,minutes(trip.arrival_time)+dayOffset);
  });
}

export function seatsForTrip(tripId,userId) {
  db.prepare("DELETE FROM seat_holds WHERE expires_at<=?").run(Date.now());
  const trip = db.prepare("SELECT capacity FROM buses JOIN trips ON trips.bus_id=buses.id WHERE trips.id=?").get(tripId);
  if (!trip) return null;
  const booked = new Set(db.prepare("SELECT seat_number FROM booking_seats WHERE trip_id=?").all(tripId).map((row)=>row.seat_number));
  const holds = new Map(db.prepare("SELECT seat_number,user_id,expires_at FROM seat_holds WHERE trip_id=?").all(tripId).map((row)=>[row.seat_number,row]));
  return Array.from({length:trip.capacity},(_,i)=>`A${String(i+1).padStart(2,"0")}`).map((number)=>{
    const hold=holds.get(number);
    return {number,status:booked.has(number)?"booked":hold?(hold.user_id===userId?"held":"unavailable"):"available",expiresAt:hold?.user_id===userId?hold.expires_at:null};
  });
}
