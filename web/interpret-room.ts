// The fragment key stays on the two devices. The relay holds opaque turn packets.
export function base64(bytes: Uint8Array) {
  let result = "";
  for (let i=0;i<bytes.length;i+=8192) result += String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(result);
}
export const bytes = (value:string) => Uint8Array.from(atob(value),c=>c.charCodeAt(0));
export async function roomKey(raw:string) { return crypto.subtle.importKey("raw",bytes(raw),"AES-GCM",false,["encrypt","decrypt"]); }
export async function seal(key:CryptoKey, value:unknown) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(JSON.stringify(value)));
  const result=new Uint8Array(12+data.byteLength); result.set(iv);result.set(new Uint8Array(data),12);
  return base64(result);
}
export async function unseal(key:CryptoKey, data:string) {
  const packed=bytes(data);
  const result=await crypto.subtle.decrypt({name:"AES-GCM",iv:packed.slice(0,12)},key,packed.slice(12));
  return JSON.parse(new TextDecoder().decode(result));
}
