"use strict";
const router=require("express").Router(); const {requireAuth}=require("../middleware/auth"); const supabase=require("../db/supabase");
router.post("/subscription",requireAuth,async(req,res)=>{const s=req.body||{}; if(!s.endpoint||!s.keys?.p256dh||!s.keys?.auth)return res.status(400).json({message:"Invalid subscription"}); const {error}=await supabase.from("web_push_subscriptions").upsert({user_id:req.user.id,endpoint:s.endpoint,p256dh:s.keys.p256dh,auth:s.keys.auth,last_seen:new Date().toISOString()}); if(error)return res.status(500).json({message:"Could not save subscription"}); res.status(204).end();});
router.delete("/subscription",requireAuth,async(req,res)=>{await supabase.from("web_push_subscriptions").delete().eq("user_id",req.user.id).eq("endpoint",req.body?.endpoint||"");res.status(204).end();});
module.exports=router;
