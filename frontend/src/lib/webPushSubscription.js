import { API_BASE_URL } from "../config/api";
import { getToken } from "./storage";
function key(v){const s=atob(v.replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(s,c=>c.charCodeAt(0));}
export async function subscribeWebPush() {
  const vapid=import.meta.env.VITE_VAPID_PUBLIC_KEY; if(!vapid||!navigator.serviceWorker||!("PushManager"in window))return false;
  const reg=await navigator.serviceWorker.register("/sw.js");
  const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key(vapid)});
  await fetch(`${API_BASE_URL}/api/web-push/subscription`,{method:"POST",headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},body:JSON.stringify(sub)});
  return true;
}
