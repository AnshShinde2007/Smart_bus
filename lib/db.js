import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { hashPassword } from "./password.js";
import { dateInAppZone } from "./dates.js";

const schema=`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL DEFAULT '', password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('passenger','driver','admin')), created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS auth_attempts (attempt_key TEXT NOT NULL, attempted_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS buses (
    id INTEGER PRIMARY KEY, registration_number TEXT NOT NULL UNIQUE,
    bus_name TEXT NOT NULL, capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 100), bus_type TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY, route_name TEXT NOT NULL, source TEXT NOT NULL, destination TEXT NOT NULL,
    UNIQUE(source,destination)
  );
  CREATE TABLE IF NOT EXISTS stops (
    id INTEGER PRIMARY KEY, route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    stop_name TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, stop_order INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY, bus_id INTEGER NOT NULL REFERENCES buses(id), driver_id INTEGER REFERENCES users(id),
    route_id INTEGER NOT NULL REFERENCES routes(id), journey_date TEXT NOT NULL,
    departure_time TEXT NOT NULL, arrival_time TEXT NOT NULL, fare_paise INTEGER NOT NULL CHECK(fare_paise >= 100),
    status TEXT NOT NULL CHECK(status IN ('scheduled','active','completed','cancelled')) DEFAULT 'scheduled'
  );
  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), trip_id TEXT NOT NULL REFERENCES trips(id),
    reference TEXT NOT NULL UNIQUE, passenger_name TEXT NOT NULL, passenger_phone TEXT NOT NULL,
    hold_token TEXT NOT NULL, total_paise INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','confirmed','cancelled')), created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS seat_holds (
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, seat_number TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id), hold_token TEXT NOT NULL, expires_at INTEGER NOT NULL,
    PRIMARY KEY(trip_id,seat_number)
  );
  CREATE TABLE IF NOT EXISTS booking_seats (
    trip_id TEXT NOT NULL REFERENCES trips(id), seat_number TEXT NOT NULL,
    booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    PRIMARY KEY(trip_id,seat_number)
  );
  CREATE TABLE IF NOT EXISTS booking_items (
    booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    trip_id TEXT NOT NULL REFERENCES trips(id), seat_number TEXT NOT NULL,
    PRIMARY KEY(booking_id,seat_number)
  );
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY, booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id),
    provider_order_id TEXT NOT NULL UNIQUE, provider_payment_id TEXT UNIQUE,
    amount_paise INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('created','paid','failed','refund_pending','refunded')), updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS location_updates (
    id INTEGER PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90), longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
    accuracy REAL NOT NULL CHECK(accuracy >= 0), recorded_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_trips_search ON trips(journey_date,status,route_id);
  CREATE INDEX IF NOT EXISTS idx_location_latest ON location_updates(trip_id,id DESC);
  CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_auth_attempts ON auth_attempts(attempt_key,attempted_at);
`;

function seedDemoData(db){
  if(process.env.NODE_ENV==="production"){
    const email=process.env.SMARTBUS_ADMIN_EMAIL?.trim().toLowerCase(),password=process.env.SMARTBUS_ADMIN_PASSWORD;
    if(email&&password&&password.length>=16)db.prepare("INSERT OR IGNORE INTO users(name,email,password_hash,role,created_at) VALUES(?,?,?,'admin',?)").run("SmartBus Admin",email,hashPassword(password),new Date().toISOString());
    return;
  }
  const insertUser=db.prepare("INSERT OR IGNORE INTO users(name,email,phone,password_hash,role,created_at) VALUES(?,?,?,?,?,?)");
  const accounts=[
    ["SmartBus Admin",process.env.DEMO_ADMIN_EMAIL||"admin@smartbus.test","+91 90000 00001",process.env.DEMO_ADMIN_PASSWORD||"DemoAdmin!2026","admin"],
    ["Rohan Mehta",process.env.DEMO_DRIVER_EMAIL||"driver@smartbus.test","+91 90000 00002",process.env.DEMO_DRIVER_PASSWORD||"DemoDriver!2026","driver"],
    ["Ananya Rao",process.env.DEMO_PASSENGER_EMAIL||"passenger@smartbus.test","+91 90000 00003",process.env.DEMO_PASSENGER_PASSWORD||"DemoPassenger!2026","passenger"],
  ];
  for(const [name,email,phone,password,role] of accounts)insertUser.run(name,email.toLowerCase(),phone,hashPassword(password),role,new Date().toISOString());
  db.prepare("INSERT OR IGNORE INTO buses(id,registration_number,bus_name,capacity,bus_type) VALUES(1,'MH 12 QX 4821','Western Line Express',36,'AC Sleeper')").run();
  db.prepare("INSERT OR IGNORE INTO buses(id,registration_number,bus_name,capacity,bus_type) VALUES(2,'MH 04 KN 7510','Terra Travels',36,'AC Seater')").run();
  db.prepare("INSERT OR IGNORE INTO routes(id,route_name,source,destination) VALUES(1,'Mumbai–Pune Express','Mumbai','Pune')").run();
  const insertStop=db.prepare("INSERT OR IGNORE INTO stops(id,route_id,stop_name,latitude,longitude,stop_order) VALUES(?,?,?,?,?,?)");
  [[1,"Mumbai Central",18.9690,72.8205,1],[2,"Vashi Depot",19.0770,73.0000,2],[3,"Panvel Station",18.9894,73.1175,3],[4,"Lonavala",18.7546,73.4062,4],[5,"Pune Central",18.5204,73.8567,5]].forEach(([id,name,latitude,longitude,order])=>insertStop.run(id,1,name,latitude,longitude,order));
  const driverId=db.prepare("SELECT id FROM users WHERE email=?").get(accounts[1][1].toLowerCase()).id;
  const insertTrip=db.prepare("INSERT OR IGNORE INTO trips(id,bus_id,driver_id,route_id,journey_date,departure_time,arrival_time,fare_paise,status) VALUES(?,?,?,?,?,?,?,?, 'scheduled')");
  const today=dateInAppZone();
  const date=(offset)=>{const value=new Date(`${today}T12:00:00Z`);value.setUTCDate(value.getUTCDate()+offset);return value.toISOString().slice(0,10);};
  for(let offset=0;offset<14;offset++){
    insertTrip.run(`SB-204-${date(offset)}`,1,driverId,1,date(offset),"08:15","11:45",68000,"scheduled");
    insertTrip.run(`SB-318-${date(offset)}`,2,null,1,date(offset),"09:00","12:50",52000,"scheduled");
  }
}

function openDatabase(){
  if(globalThis.__smartbusDb)return globalThis.__smartbusDb;
  const dataPath=process.env.SMARTBUS_DB_PATH||join(process.cwd(),"data","smartbus.sqlite");mkdirSync(dirname(dataPath),{recursive:true});
  const db=new Database(dataPath);globalThis.__smartbusDb=db;
  db.pragma("busy_timeout=5000");db.pragma("journal_mode=WAL");db.pragma("foreign_keys=ON");db.exec(schema);
  seedDemoData(db);return db;
}

const db=new Proxy({}, {get(_target,property){const connection=openDatabase();const value=connection[property];return typeof value==="function"?value.bind(connection):value;}});
export default db;
