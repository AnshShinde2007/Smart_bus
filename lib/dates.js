export const APP_TIME_ZONE=process.env.APP_TIME_ZONE||"Asia/Kolkata";
export function dateInAppZone(value=new Date()){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:APP_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(value);
  const values=Object.fromEntries(parts.map((part)=>[part.type,part.value]));return `${values.year}-${values.month}-${values.day}`;
}
export function isDateOnly(value){
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T00:00:00.000Z`);return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}
