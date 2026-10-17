import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers});
 if(req.method!=="POST") return new Response(JSON.stringify({error:"POST required"}),{status:405,headers});
 const url=Deno.env.get("SUPABASE_URL")!, key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const admin=createClient(url,key);
 const authHeader=req.headers.get("Authorization")||"";
 const token=authHeader.replace(/^Bearer\s+/i,"");
 const {data:u,error:ue}=await admin.auth.getUser(token);
 if(ue||!u.user) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers});
 const userId=u.user.id; const body=await req.json(); const action=String(body.action||"");
 const itemId=body.id?String(body.id):null; const now=new Date().toISOString();
 async function audit(contentItemId:string|null,event_type:string,details:any={}){await admin.from("audit_events").insert({owner_id:userId,content_item_id:contentItemId,actor:"USER",event_type,details});}
 if(action==="CREATE_CONTENT"){
   const topic=String(body.topic||"").trim(); if(!topic) return new Response(JSON.stringify({error:"topic required"}),{status:400,headers});
   // content_id is globally unique, not per-owner. Retry on a concurrent collision.
   let data:any=null, error:any=null, contentId="";
   for(let attempt=0;attempt<5;attempt++){
     const {data:rows,error:listError}=await admin.from("content_items").select("content_id").like("content_id","HT-%").order("content_id",{ascending:false}).limit(1);
     if(listError) return new Response(JSON.stringify({error:listError.message}),{status:500,headers});
     const max=Number(String(rows?.[0]?.content_id||"HT-0000").match(/^HT-(\d+)$/)?.[1]||0);
     contentId=`HT-${String(max+1).padStart(4,"0")}`;
     const result=await admin.from("content_items").insert({owner_id:userId,content_id:contentId,topic,content_pillar:body.content_pillar||null,priority_score:Number(body.priority_score||0),overall_status:"QUEUED",current_stage:"TOPIC_INTELLIGENCE",current_agent:"AGENT_01_TOPIC_INTELLIGENCE"}).select().single();
     data=result.data; error=result.error;
     if(!error||error.code!=="23505")break;
   }
   if(error||!data) return new Response(JSON.stringify({error:error?.message||"Could not create content"}),{status:400,headers}); await audit(data.id,"CREATE_CONTENT",{content_id:contentId,topic});
   return new Response(JSON.stringify({ok:true,content:data}),{headers});
 }
 if(!itemId) return new Response(JSON.stringify({error:"id required"}),{status:400,headers});
 const {data:existing,error:ee}=await admin.from("content_items").select("*").eq("id",itemId).eq("owner_id",userId).single();
 if(ee||!existing) return new Response(JSON.stringify({error:"Content not found"}),{status:404,headers});

 if(action==="RUN_CONTENT_ENGINE"){
   await audit(itemId,action,{delegated_to:"content-engine"});
   const r=await fetch(`${url}/functions/v1/content-engine`,{method:"POST",headers:{"Content-Type":"application/json","Authorization":authHeader,"apikey":req.headers.get("apikey")||""},body:JSON.stringify({id:itemId})});
   const payload=await r.json().catch(()=>({error:"Invalid content-engine response"}));
   return new Response(JSON.stringify(payload),{status:r.status,headers});
 }

 const updates:any={updated_at:now};
 switch(action){
  case "HOLD": updates.overall_status="HOLD";updates.hold=true; break;
  case "RESEARCH_AGAIN": updates.overall_status="NEEDS_RESEARCH";updates.current_stage="RESEARCH_ROUTER";updates.current_agent="AGENT_00_CONTENT_DIRECTOR";updates.hold=false; break;
  case "REVISE": updates.overall_status="NEEDS_REVISION";updates.current_stage="REVISION_ROUTER";updates.current_agent="AGENT_00_CONTENT_DIRECTOR";updates.hold=false;updates.revision_count=(existing.revision_count||0)+1; break;
  case "APPROVE_CONTENT": updates.overall_status="APPROVED";updates.human_medical_review="APPROVED"; break;
  case "REJECT_CONTENT": updates.overall_status="REJECTED";updates.human_medical_review="REJECTED"; break;
  case "LOCK_CONTENT": if(existing.human_medical_review!=="APPROVED"||existing.evidence_gate!=="PASS"||existing.safety_gate!=="PASS"||existing.content_qa_gate!=="PASS") return new Response(JSON.stringify({error:"Evidence, safety, content QA and human medical review must pass before lock"}),{status:409,headers}); updates.overall_status="CONTENT_LOCKED";updates.content_lock="PASS"; break;
  default:return new Response(JSON.stringify({error:"Unknown action"}),{status:400,headers});
 }
 const {data,error}=await admin.from("content_items").update(updates).eq("id",itemId).eq("owner_id",userId).select().single();
 if(error)return new Response(JSON.stringify({error:error.message}),{status:400,headers}); await audit(itemId,action,{updates}); return new Response(JSON.stringify({ok:true,content:data}),{headers});
});