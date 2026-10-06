package ir.hirmand.staff

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.util.UUID

data class StaffLinkedPropertyItem(
    val id:String,
    val title:String,
    val slug:String,
    val neighborhood:String,
    val areaM2:Int?,
    val bedrooms:Int?,
    val transactionType:String,
    val propertyType:String,
)

data class StaffTaskItem(
    val id:String,val title:String,val description:String,val status:String,val priority:String,
    val propertyId:String?,val customerId:String?,val dueAt:String?,
)
data class StaffVisitItem(
    val id:String,val propertyId:String?,val title:String,val address:String,val targetLat:Double?,val targetLng:Double?,
    val radiusM:Double,val scheduledAt:String?,val status:String,val arrivedAt:String?,val leftAt:String?,
)
data class StaffCrmContactItem(
    val id:String,val name:String,val phone:String,val type:String,val notes:String,val leadId:String?,
    val leadStatus:String?,val leadDeal:String?,val propertyId:String?,val nextFollowUpAt:String?,
    val linkedProperties:List<StaffLinkedPropertyItem>,
)
data class StaffCrmInteractionItem(
    val id:String,val contactId:String,val kind:String,val note:String,val createdAt:String?,
)
data class StaffAttendanceItem(val id:String,val workDate:String,val startedAt:String?,val endedAt:String?)
data class StaffFollowUpItem(
    val id:String,val name:String,val phone:String,val type:String,val leadId:String?,val propertyId:String?,
    val propertyTitle:String?,val leadStatus:String?,val nextFollowUpAt:String?,
)
data class StaffDailySummary(
    val tasksToday:Int,val tasksDoneToday:Int,val overdueTasks:Int,val visitsToday:Int,val visitsDoneToday:Int,
    val callsToday:Int,val followUpsDue:Int,val followUpsNext7:Int,val capturesToday:Int,
)
data class StaffPerformanceSummary(
    val score:Int,val tasksDone:Int,val visitsDone:Int,val callsDone:Int,val attendanceDays:Int,val interactions:Int,
)
data class StaffOperationsSnapshot(
    val tasks:List<StaffTaskItem>,
    val visits:List<StaffVisitItem>,
    val contacts:List<StaffCrmContactItem>,
    val interactions:List<StaffCrmInteractionItem>,
    val attendance:StaffAttendanceItem?,
    val lostMode:Boolean,
    val lostMessage:String,
    val captures:Int,
    val followUps:List<StaffFollowUpItem>,
    val daily:StaffDailySummary,
    val performance:StaffPerformanceSummary,
    val staffName:String="",
    val staffRole:String="",
    val offline:Boolean=false,
    val lastServerSyncAt:String?=null,
    val pendingSyncCount:Int=0,
)

object StaffOperations {
    private const val PREFS="hirmand_staff"
    private const val DEVICE_ID="device_id"
    private const val ENDPOINT=BuildConfig.STAFF_OPERATIONS_URL
    private const val CAPTURE_ENDPOINT=BuildConfig.STAFF_PROPERTY_CAPTURE_URL
    private const val CLIENT_TIMEOUT=15_000

    private fun deviceId(context:Context)=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getString(DEVICE_ID,"").orEmpty()
    private fun token(context:Context)=StaffTelemetryStore.token(context)
    private fun newEventId()=UUID.randomUUID().toString()

    private fun getOnline(context:Context):Pair<Int,String?>{
        val id=deviceId(context);val auth=token(context)
        if(id.isBlank()||auth.isBlank())return -1 to null
        val connection=(URL(ENDPOINT).openConnection() as HttpURLConnection).apply{
            requestMethod="GET";connectTimeout=CLIENT_TIMEOUT;readTimeout=CLIENT_TIMEOUT;useCaches=false
            setRequestProperty("Accept","application/json")
            setRequestProperty("Authorization","Bearer "+auth)
            setRequestProperty("X-Hirmand-Device-Id",id)
        }
        return try{
            val code=connection.responseCode
            val body=runCatching{(if(code in 200..299)connection.inputStream else connection.errorStream)?.bufferedReader()?.use{it.readText()}}.getOrNull()
            code to body
        }catch(_:Throwable){-1 to null}finally{connection.disconnect()}
    }

    fun sync(context:Context):StaffOperationsSnapshot?{
        val id=deviceId(context);val auth=token(context)
        if(id.isBlank()||auth.isBlank())return null
        val store=StaffOfflineStore.get(context)
        store.prune()
        flushQueue(context,store)
        flushCaptureQueue(context,store)

        val (code,text)=getOnline(context)
        if(code in 200..299 && !text.isNullOrBlank()){
            store.cacheSnapshot(text!!)
            return parse(text,offline=false,lastServerSyncAt=Instant.now().toString(),pendingSyncCount=store.pendingCount())
        }

        val (cached,cachedAt)=store.cachedSnapshot()
        if(!cached.isNullOrBlank()){
            val snapshot=parse(
                cached,
                offline=true,
                lastServerSyncAt=cachedAt?.let{Instant.ofEpochMilli(it).toString()},
                pendingSyncCount=store.pendingCount(),
            )
            return snapshot
        }
        return null
    }

    private fun parse(text:String,offline:Boolean,lastServerSyncAt:String?,pendingSyncCount:Int):StaffOperationsSnapshot{
        val root=JSONObject(text)
        val tasks=mutableListOf<StaffTaskItem>()
        val ta=root.optJSONArray("tasks")?:JSONArray()
        for(i in 0 until ta.length()){
            val o=ta.getJSONObject(i)
            tasks+=StaffTaskItem(
                o.optString("id"),o.optString("title"),o.optString("description"),o.optString("status"),
                o.optString("priority"),o.optStringOrNull("propertyId"),o.optStringOrNull("customerId"),o.optStringOrNull("dueAt")
            )
        }

        val visits=mutableListOf<StaffVisitItem>()
        val va=root.optJSONArray("visits")?:JSONArray()
        for(i in 0 until va.length()){
            val o=va.getJSONObject(i)
            visits+=StaffVisitItem(
                o.optString("id"),o.optStringOrNull("propertyId"),o.optString("title"),o.optString("address"),
                o.optNullableDouble("targetLat"),o.optNullableDouble("targetLng"),o.optDouble("radiusM",120.0),
                o.optStringOrNull("scheduledAt"),o.optString("status"),o.optStringOrNull("arrivedAt"),o.optStringOrNull("leftAt")
            )
        }

        val contacts=mutableListOf<StaffCrmContactItem>()
        val ca=root.optJSONArray("contacts")?:JSONArray()
        for(i in 0 until ca.length()){
            val o=ca.getJSONObject(i)
            val linked=mutableListOf<StaffLinkedPropertyItem>()
            val pa=o.optJSONArray("linkedProperties")?:JSONArray()
            for(j in 0 until pa.length()){
                val p=pa.optJSONObject(j) ?: continue
                linked+=StaffLinkedPropertyItem(
                    p.optString("id"),p.optString("title"),p.optString("slug"),p.optString("neighborhood"),
                    p.optNullableInt("areaM2"),p.optNullableInt("bedrooms"),p.optString("transactionType"),p.optString("propertyType")
                )
            }
            contacts+=StaffCrmContactItem(
                o.optString("id"),o.optString("name"),o.optString("phone"),o.optString("type"),o.optString("notes"),
                o.optStringOrNull("leadId"),o.optStringOrNull("leadStatus"),o.optStringOrNull("leadDeal"),
                o.optStringOrNull("propertyId"),o.optStringOrNull("nextFollowUpAt"),linked,
            )
        }

        val interactions=mutableListOf<StaffCrmInteractionItem>()
        val ia=root.optJSONArray("interactions")?:JSONArray()
        for(i in 0 until ia.length()){
            val o=ia.getJSONObject(i)
            interactions+=StaffCrmInteractionItem(o.optString("id"),o.optString("contactId"),o.optString("kind"),o.optString("note"),o.optStringOrNull("createdAt"))
        }

        val attendance=root.optJSONObject("attendance")?.let{o->
            StaffAttendanceItem(o.optString("id"),o.optString("workDate"),o.optStringOrNull("startedAt"),o.optStringOrNull("endedAt"))
        }

        val followUps=mutableListOf<StaffFollowUpItem>()
        val fu=root.optJSONArray("followUps")?:JSONArray()
        for(i in 0 until fu.length()){
            val o=fu.getJSONObject(i)
            followUps+=StaffFollowUpItem(
                o.optString("id"),o.optString("name"),o.optString("phone"),o.optString("type"),
                o.optStringOrNull("leadId"),o.optStringOrNull("propertyId"),o.optStringOrNull("propertyTitle"),
                o.optStringOrNull("leadStatus"),o.optStringOrNull("nextFollowUpAt")
            )
        }

        val dailyObj=root.optJSONObject("daily")?:JSONObject()
        val daily=StaffDailySummary(
            dailyObj.optInt("tasksToday"),dailyObj.optInt("tasksDoneToday"),dailyObj.optInt("overdueTasks"),
            dailyObj.optInt("visitsToday"),dailyObj.optInt("visitsDoneToday"),dailyObj.optInt("callsToday"),
            dailyObj.optInt("followUpsDue"),dailyObj.optInt("followUpsNext7"),dailyObj.optInt("capturesToday")
        )

        val perfObj=root.optJSONObject("performance")?:JSONObject()
        val performance=StaffPerformanceSummary(
            perfObj.optInt("score"),perfObj.optInt("tasksDone"),perfObj.optInt("visitsDone"),
            perfObj.optInt("callsDone"),perfObj.optInt("attendanceDays"),perfObj.optInt("interactions")
        )
        val staff=root.optJSONObject("staff")

        return StaffOperationsSnapshot(
            tasks=tasks,visits=visits,contacts=contacts,interactions=interactions,attendance=attendance,
            lostMode=root.optBoolean("lostMode"),lostMessage=root.optString("lostMessage"),
            captures=root.optJSONArray("captures")?.length()?:0,followUps=followUps,daily=daily,performance=performance,
            staffName=staff?.optString("name").orEmpty(),staffRole=staff?.optString("role").orEmpty(),
            offline=offline,lastServerSyncAt=lastServerSyncAt,pendingSyncCount=pendingSyncCount,
        )
    }

    private fun flushQueue(context:Context,store:StaffOfflineStore){
        for(item in store.dueQueue(12)){
            val payload=runCatching{JSONObject(item.payload)}.getOrNull()
            if(payload==null){store.remove(item.eventId);continue}
            payload.put("clientEventId",item.eventId)
            when(val code=postOnline(context,payload)){
                in 200..299 -> store.remove(item.eventId)
                in 400..499 -> store.remove(item.eventId)
                else -> store.markFailed(item.eventId,item.retries)
            }
        }
    }

    private fun flushCaptureQueue(context:Context,store:StaffOfflineStore){
        for(item in store.dueCaptures(4)){
            val file=File(item.filePath)
            if(!file.exists()){store.removeCapture(item.eventId);continue}
            val code=uploadCaptureOnline(context,file.readBytes(),item.propertyId,item.visitId,item.category,item.eventId)
            when(code){
                in 200..299 -> {store.removeCapture(item.eventId);runCatching{file.delete()}}
                in 400..499 -> {store.removeCapture(item.eventId);runCatching{file.delete()}}
                else -> store.markCaptureFailed(item.eventId,item.retries)
            }
        }
    }

    private fun postOnline(context:Context,payload:JSONObject):Int{
        val id=deviceId(context);val auth=token(context)
        if(id.isBlank()||auth.isBlank())return -1
        val eventId=payload.optString("clientEventId").ifBlank{newEventId().also{payload.put("clientEventId",it)}}
        val connection=(URL(ENDPOINT).openConnection() as HttpURLConnection).apply{
            requestMethod="POST";connectTimeout=CLIENT_TIMEOUT;readTimeout=CLIENT_TIMEOUT;doOutput=true;useCaches=false
            setRequestProperty("Accept","application/json");setRequestProperty("Content-Type","application/json; charset=utf-8")
            setRequestProperty("Authorization","Bearer "+auth);setRequestProperty("X-Hirmand-Device-Id",id)
            setRequestProperty("X-Hirmand-Client-Event-Id",eventId)
        }
        return try{
            connection.outputStream.bufferedWriter(Charsets.UTF_8).use{it.write(payload.toString())}
            connection.responseCode
        }catch(_:Throwable){-1}finally{connection.disconnect()}
    }

    fun post(context:Context,payload:JSONObject):Boolean{
        val store=StaffOfflineStore.get(context)
        val prepared=JSONObject(payload.toString())
        val eventId=prepared.optString("clientEventId").ifBlank{newEventId().also{prepared.put("clientEventId",it)}}
        val code=postOnline(context,prepared)
        if(code in 200..299)return true
        if(code in 400..499)return false
        store.enqueue(eventId,prepared.toString())
        applyOptimisticMutation(store,prepared)
        return true
    }

    private fun applyOptimisticMutation(store:StaffOfflineStore,payload:JSONObject){
        val cached=store.cachedSnapshot().first ?: return
        runCatching{
            val root=JSONObject(cached)
            when(payload.optString("action")){
                "task_status" -> {
                    val items=root.optJSONArray("tasks")?:JSONArray()
                    for(i in 0 until items.length()){
                        val item=items.optJSONObject(i)?:continue
                        if(item.optString("id")==payload.optString("id")){
                            item.put("status",payload.optString("status"))
                            if(payload.optString("status")=="done")item.put("completedAt",Instant.now().toString())
                            break
                        }
                    }
                }
                "visit_status" -> {
                    val items=root.optJSONArray("visits")?:JSONArray()
                    for(i in 0 until items.length()){
                        val item=items.optJSONObject(i)?:continue
                        if(item.optString("id")==payload.optString("id")){
                            item.put("status",payload.optString("status"))
                            if(payload.optString("status")=="arrived")item.put("arrivedAt",Instant.now().toString())
                            if(payload.optString("status")=="completed")item.put("leftAt",Instant.now().toString())
                            break
                        }
                    }
                }
                "attendance_start","attendance_stop" -> {
                    val a=root.optJSONObject("attendance")?:JSONObject().also{root.put("attendance",it)}
                    if(payload.optString("action")=="attendance_start"){
                        a.put("id",a.optString("id").ifBlank{newEventId()})
                        a.put("startedAt",Instant.now().toString())
                        a.put("endedAt",JSONObject.NULL)
                    }else{
                        a.put("endedAt",Instant.now().toString())
                    }
                }
                "crm_create_contact" -> {
                    val items=root.optJSONArray("contacts")?:JSONArray().also{root.put("contacts",it)}
                    val c=JSONObject()
                        .put("id",payload.optString("entityId"))
                        .put("name",payload.optString("name"))
                        .put("phone",payload.optString("phone"))
                        .put("type",payload.optString("type","customer"))
                        .put("notes","ثبت آفلاین؛ بعد از اتصال اینترنت همگام می‌شود.")
                        .put("leadId",payload.optStringOrNull("leadId"))
                        .put("leadStatus",JSONObject.NULL)
                        .put("leadDeal",JSONObject.NULL)
                        .put("propertyId",JSONObject.NULL)
                        .put("nextFollowUpAt",payload.optStringOrNull("nextFollowUpAt"))
                        .put("linkedProperties",JSONArray())
                    items.put(c)
                }
                "crm_interaction" -> {
                    val items=root.optJSONArray("interactions")?:JSONArray().also{root.put("interactions",it)}
                    items.put(
                        JSONObject()
                            .put("id",payload.optString("clientEventId"))
                            .put("contactId",payload.optString("contactId"))
                            .put("kind",payload.optString("kind","note"))
                            .put("note",payload.optString("note"))
                            .put("createdAt",Instant.now().toString())
                    )
                    if(payload.has("followUpAt")){
                        val contacts=root.optJSONArray("contacts")?:JSONArray()
                        for(i in 0 until contacts.length()){
                            val c=contacts.optJSONObject(i)?:continue
                            if(c.optString("id")==payload.optString("contactId")){
                                c.put("nextFollowUpAt",payload.opt("followUpAt")?:JSONObject.NULL)
                                break
                            }
                        }
                    }
                }
            }
            store.cacheSnapshot(root.toString())
        }.getOrNull()
    }

    fun taskDone(context:Context,id:String)=post(context,JSONObject().put("action","task_status").put("id",id).put("status","done"))
    fun taskStart(context:Context,id:String)=post(context,JSONObject().put("action","task_status").put("id",id).put("status","in_progress"))

    fun visitStatus(context:Context,id:String,status:String,lat:Double?=null,lng:Double?=null):Boolean{
        val p=JSONObject().put("action","visit_status").put("id",id).put("status",status)
        if(lat!=null)p.put("latitude",lat)
        if(lng!=null)p.put("longitude",lng)
        return post(context,p)
    }

    fun attendance(context:Context,start:Boolean,lat:Double?=null,lng:Double?=null):Boolean{
        val p=JSONObject().put("action",if(start)"attendance_start" else "attendance_stop")
        if(lat!=null)p.put("latitude",lat)
        if(lng!=null)p.put("longitude",lng)
        return post(context,p)
    }

    fun logInteraction(context:Context,contactId:String,kind:String,note:String,followUpAt:String?=null):Boolean{
        val p=JSONObject().put("action","crm_interaction").put("contactId",contactId).put("kind",kind).put("note",note)
        if(!followUpAt.isNullOrBlank())p.put("followUpAt",followUpAt)
        return post(context,p)
    }

    fun createCrmContact(
        context:Context,name:String,phone:String,type:String="customer",leadId:String?=null,
        propertyIds:List<String> = emptyList(),followUpAt:String?=null
    ):Boolean{
        val entityId=newEventId()
        val p=JSONObject().put("action","crm_create_contact").put("entityId",entityId).put("name",name).put("phone",phone).put("type",type)
        if(!leadId.isNullOrBlank())p.put("leadId",leadId)
        if(propertyIds.isNotEmpty())p.put("propertyIds",JSONArray(propertyIds))
        if(!followUpAt.isNullOrBlank())p.put("nextFollowUpAt",followUpAt)
        return post(context,p)
    }

    fun linkCrmContact(context:Context,contactId:String,leadId:String?,propertyIds:List<String>,replaceProperties:Boolean=false):Boolean{
        val p=JSONObject().put("action","crm_link").put("contactId",contactId).put("replaceProperties",replaceProperties)
        if(!leadId.isNullOrBlank())p.put("leadId",leadId)
        p.put("propertyIds",JSONArray(propertyIds))
        return post(context,p)
    }

    fun sendHealth(context:Context):Boolean=
        post(context,JSONObject().put("action","health").put("observedAt",Instant.now().toString()).put("payload",StaffHealth.snapshot(context)))

    fun sendLocations(context:Context,locations:JSONArray):Boolean=
        post(context,JSONObject().put("action","locations").put("items",locations))

    fun uploadCapture(context:Context,jpeg:ByteArray,propertyId:String?,visitId:String?,category:String):Boolean{
        if(jpeg.isEmpty())return false
        val eventId=newEventId()
        val code=uploadCaptureOnline(context,jpeg,propertyId,visitId,category,eventId)
        if(code in 200..299)return true
        if(code in 400..499)return false

        val dir=File(context.filesDir,"offline-captures").apply{mkdirs()}
        val file=File(dir,eventId+".jpg")
        return runCatching{
            file.writeBytes(jpeg)
            StaffOfflineStore.get(context).enqueueCapture(eventId,file.absolutePath,propertyId,visitId,category)
            true
        }.getOrDefault(false)
    }

    private fun uploadCaptureOnline(
        context:Context,jpeg:ByteArray,propertyId:String?,visitId:String?,category:String,eventId:String
    ):Int{
        val id=deviceId(context);val auth=token(context)
        if(id.isBlank()||auth.isBlank())return -1
        val c=(URL(CAPTURE_ENDPOINT).openConnection() as HttpURLConnection).apply{
            requestMethod="POST";connectTimeout=CLIENT_TIMEOUT;readTimeout=CLIENT_TIMEOUT;doOutput=true;useCaches=false
            setRequestProperty("Authorization","Bearer "+auth)
            setRequestProperty("X-Hirmand-Device-Id",id)
            setRequestProperty("X-Hirmand-Client-Event-Id",eventId)
            setRequestProperty("X-Hirmand-File-Mime","image/jpeg")
            setRequestProperty("X-Hirmand-Capture-Category",category)
            if(!propertyId.isNullOrBlank())setRequestProperty("X-Hirmand-Property-Id",propertyId)
            if(!visitId.isNullOrBlank())setRequestProperty("X-Hirmand-Visit-Id",visitId)
            setRequestProperty("Content-Type","image/jpeg")
        }
        return try{
            c.outputStream.use{it.write(jpeg)}
            c.responseCode
        }catch(_:Throwable){-1}finally{c.disconnect()}
    }

    fun pendingSyncCount(context:Context)=StaffOfflineStore.get(context).pendingCount()
    fun schedule(context:Context)=StaffOperationsWorker.schedule(context)
}

object StaffHealth {
    fun snapshot(context:Context):JSONObject{
        val battery=context.getSystemService(android.os.BatteryManager::class.java)?.let{bm->
            val cap=bm.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY)
            JSONObject().put("batteryPercent",cap.takeIf{it in 0..100})
        }?:JSONObject()
        val stat=android.os.StatFs(context.filesDir.absolutePath)
        val connectivity=context.getSystemService(android.net.ConnectivityManager::class.java)
        val network=connectivity?.activeNetwork?.let{n->connectivity.getNetworkCapabilities(n)?.let{cap->
            JSONObject().put("connected",true).put("transport",when{
                cap.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI)->"wifi"
                cap.hasTransport(android.net.NetworkCapabilities.TRANSPORT_CELLULAR)->"cellular"
                else->"other"
            })
        }}?:JSONObject().put("connected",false)
        return JSONObject()
            .put("appVersionName",BuildConfig.VERSION_NAME)
            .put("appVersionCode",BuildConfig.VERSION_CODE)
            .put("manufacturer",android.os.Build.MANUFACTURER)
            .put("model",android.os.Build.MODEL)
            .put("androidVersion",android.os.Build.VERSION.RELEASE.orEmpty())
            .put("sdkInt",android.os.Build.VERSION.SDK_INT)
            .put("managementMode",DeviceOwnerManager.state(context).mode.name.lowercase())
            .put("battery",battery)
            .put("storageAvailableBytes",stat.availableBytes)
            .put("network",network)
            .put("permissions",StaffPermissionTelemetry.snapshot(context))
    }
}

private fun JSONObject.optStringOrNull(key:String):String?=
    if(isNull(key))null else optString(key).ifBlank{null}

private fun JSONObject.optNullableDouble(key:String):Double?=
    if(isNull(key))null else optDouble(key).takeIf{!it.isNaN()}

private fun JSONObject.optNullableInt(key:String):Int?=
    if(isNull(key))null else optInt(key).takeIf{it!=0||opt(key)!=null}
