import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { isAllowedOrigin, publicCorsHeaders } from "../_shared/public-cors.ts";
import { checkRateLimit, getClientIp } from "../_shared/rate-limit.ts";
import { parseFunnelInput, readFunnelJson } from "../_shared/public-funnel.ts";
serve(async req => {
  const headers={...publicCorsHeaders(req),"Content-Type":"application/json"};
  const reply=(status:number,success:boolean)=>new Response(JSON.stringify({success}),{status,headers});
  if(req.method==="OPTIONS")return new Response("ok",{headers});
  if(req.method!=="POST")return reply(405,false);
  if(!isAllowedOrigin(req))return reply(403,false);
  if(!req.headers.get("content-type")?.includes("application/json"))return reply(415,false);
  if(Number(req.headers.get("content-length"))>2048)return reply(413,false);
  try {
    const event=parseFunnelInput(await readFunnelJson(req));
    const db=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"");
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`${new Date().toISOString().slice(0,10)}:${getClientIp(req)}`));
    const limiter=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,"0")).join("");
    if(!await checkRateLimit(db,`funnel:${limiter}`,120,60))return reply(429,false);
    const {data:branch}=await db.from("branches").select("id").eq("slug",event.branch_slug).eq("active",true).maybeSingle();
    if(!branch)return reply(400,false);
    if(event.product_id){const {data:product}=await db.from("products").select("id").eq("id",event.product_id).eq("branch_id",branch.id).maybeSingle();if(!product)return reply(400,false);}
    // Id derivado no servidor: o navegador não consegue ocupar o id determinístico de eventos SERVER.
    const hashed=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`client:${event.event_id}`))).slice(0,16);
    hashed[6]=(hashed[6]&0x0f)|0x40; hashed[8]=(hashed[8]&0x3f)|0x80;
    const hex=Array.from(hashed,value=>value.toString(16).padStart(2,"0")).join("");
    const eventId=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    const {error}=await db.from("public_funnel_events").insert({
      event_id:eventId,event_name:event.event_name,branch_id:branch.id,order_type:event.order_type,
      device:event.device,source:event.source,error_category:event.error_category??"NONE",
      payment_option:event.payment_option??null,product_id:event.product_id??null,origin:"CLIENT",
    });
    if(error&&error.code!=="23505")return reply(500,false);
    return reply(200,true);
  }catch(error){return reply(error instanceof RangeError ? 413 : 400,false);}
});
