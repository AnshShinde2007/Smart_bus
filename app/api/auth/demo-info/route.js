import { json } from "../../../../lib/http.js";

export const dynamic="force-dynamic";
export function GET(){
  if(process.env.NODE_ENV==="production")return json({accounts:[]});
  return json({accounts:[
    {role:"Admin",email:process.env.DEMO_ADMIN_EMAIL||"admin@smartbus.test",password:process.env.DEMO_ADMIN_PASSWORD||"DemoAdmin!2026"},
    {role:"Driver",email:process.env.DEMO_DRIVER_EMAIL||"driver@smartbus.test",password:process.env.DEMO_DRIVER_PASSWORD||"DemoDriver!2026"},
    {role:"Passenger",email:process.env.DEMO_PASSENGER_EMAIL||"passenger@smartbus.test",password:process.env.DEMO_PASSENGER_PASSWORD||"DemoPassenger!2026"},
  ]});
}
