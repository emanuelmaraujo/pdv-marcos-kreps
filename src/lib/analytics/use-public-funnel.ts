"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { pdvApi } from "@/lib/api/pdv-api";
import { funnelSource, type ClientFunnelEvent, type FunnelInput } from "../../../supabase/functions/_shared/public-funnel";
const CONSENT_KEY="pdv-public-funnel-consent";
export function usePublicFunnel(branchSlug:string,orderType:FunnelInput["order_type"],enabled:boolean) {
  const [consent,setConsentState]=useState(false);
  const seen=useRef(new Set<string>());
  useEffect(()=>{const timer=window.setTimeout(()=>{try{setConsentState(localStorage.getItem(CONSENT_KEY)==="granted");}catch{/* default desligado */}},0);return()=>clearTimeout(timer);},[]);
  const setConsent=useCallback((value:boolean)=>{setConsentState(value);try{localStorage.setItem(CONSENT_KEY,value?"granted":"denied");}catch{/* Escolha vale nesta página */}},[]);
  const context=useCallback(()=>({device:(window.innerWidth<640?"MOBILE":window.innerWidth<1024?"TABLET":"DESKTOP") as FunnelInput["device"],source:funnelSource(window.location.search)}),[]);
  const track=useCallback((event:ClientFunnelEvent,detail:Partial<Pick<FunnelInput,"product_id"|"error_category"|"payment_option">>={},once?:string)=>{
    if(!enabled||!consent)return;
    const key=once?`${branchSlug}:${event}:${once}`:null;
    if(key&&seen.current.has(key))return;
    if(key)seen.current.add(key);
    const payload:FunnelInput={consent:true,event_id:crypto.randomUUID(),event_name:event,branch_slug:branchSlug,order_type:orderType,...context(),...detail};
    void pdvApi.recordPublicFunnelEvent(payload).catch(()=>{/* Métricas nunca bloqueiam compra. */});
  },[branchSlug,orderType,enabled,consent,context]);
  return {consent,setConsent,track,context};
}
