package ir.hirmand.staff

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.util.UUID

data class StaffTaskItem(val id:String,val title:String,val description:String,val status:String,val priority:String,val propertyId:String?,val dueAt:String?)
data class StaffVisitItem(val id:String,val propertyId:String?,val title:String,val address:String,val targetLat:Double?,val targetLng:Double?,val radiusM:Double,val scheduledAt:String?,val status:String,val arrivedAt:String?,val leftAt:String?)
data class StaffCrmContactItem(val id:String,val name:String,val phone:String,val type:String,val notes:String,val propertyId:String?,val nextFollowUpAt:String?)
data class StaffAttendanceItem(val id:String,val workDate:String,val startedAt:String?,val endedAt:String?)
data class StaffOperationsSnapshot(
    val tasks:List<StaffTaskItem>,val visits:List<StaffVisitItem>,val contacts:List<StaffCrmContactItem>,
    val attendance:StaffAttendanceItem?,val lostMode:Boolean,val lostMessage:String,
    val captures:Int,
)

object StaffOperations {
    private const val PREFS="hirmand_staff"
    private const val DEVICE_ID="device_id"
    private const val ENDPOINT=BuildConfig.STAFF_OPERATIONS_URL
    private val clientTimeout=15_000

    private fun deviceId(context:Context)=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getString(DEVICE_ID,"").orEmpty()
    private fun token(context:Context)=StaffTelemetryStore.token(context)

    fun sync(context:Context):StaffOperationsSnapshot?{
        val id=deviceId(context); val auth=token(context)
        if(id.isBlank()||auth.isBlank())return null
        val connection=(URL(ENDPOINT).openConnection() as HttpURLConnection).apply{
            requestMethod="GET";connectTimeout=clientTimeout;readTimeout=clientTimeout;useCaches=false
            setRequestProperty("Accept","application/json");setRequestProperty("Authorization","Bearer "+auth);setRequestProperty("X-Hirmand-Device-Id",id)
        }
        return try{
            if(connection.responseCode !in 200..299)return null
            parse(connection.inputStream.bufferedReader().use{it.readText()})
        }finally{connection.disconnect()}
    }

    private fun parse(text:String):StaffOperationsSnapshot{
        val root=JSONObject(text)
        val tasks=mutableListOf<StaffTaskItem>(); val ta=root.optJSONArray("tasks")?:JSONArray()
        for(i in 0 until ta.length()){val o=ta.getJSONObject(i);tasks+=StaffTaskItem(o.optString("id"),o.optString("title"),o.optString("description"),o.optString("status"),o.optString("priority"),o.optStringOrNull("propertyId"),o.optStringOrNull("dueAt"))}
        val visits=mutableListOf<StaffVisitItem>();val va=root.optJSONArray("visits")?:JSONArray()
        for(i in 0 until va.length()){val o=va.getJSONObject(i);visits+=StaffVisitItem(o.optString("id"),o.optStringOrNull("propertyId"),o.optString("title"),o.optString("address"),if(o.isNull("targetLat"))null else o.optDouble("targetLat"),if(o.isNull("targetLng"))null else o.optDouble("targetLng"),o.optDouble("radiusM",120.0),o.optStringOrNull("scheduledAt"),o.optString("status"),o.optStringOrNull("arrivedAt"),o.optStringOrNull("leftAt"))}
        val contacts=mutableListOf<StaffCrmContactItem>();val ca=root.optJSONArray("contacts")?:JSONArray()
        for(i in 0 until ca.length()){val o=ca.getJSONObject(i);contacts+=StaffCrmContactItem(o.optString("id"),o.optString("name"),o.optString("phone"),o.optString("type"),o.optString("notes"),o.optStringOrNull("propertyId"),o.optStringOrNull("nextFollowUpAt"))}
        val a=root.optJSONObject("attendance")?.let{o->StaffAttendanceItem(o.optString("id"),o.optString("workDate"),o.optStringOrNull("startedAt"),o.optStringOrNull("endedAt"))}
        return StaffOperationsSnapshot(tasks,visits,contacts,a,root.optBoolean("lostMode"),root.optString("lostMessage"),root.optJSONArray("captures")?.length()?:0)
    }

    private fun JSONObject.optStringOrNull(key:String):String?=if(isNull(key))null else optString(key).ifBlank{null}

    fun post(context:Context,payload:JSONObject):Boolean{
        val id=deviceId(context);val auth=token(context);if(id.isBlank()||auth.isBlank())return false
        val c=(URL(ENDPOINT).openConnection() as HttpURLConnection).apply{
            requestMethod="POST";connectTimeout=clientTimeout;readTimeout=clientTimeout;doOutput=true;useCaches=false
            setRequestProperty("Accept","application/json");setRequestProperty("Content-Type","application/json; charset=utf-8")
            setRequestProperty("Authorization","Bearer "+auth);setRequestProperty("X-Hirmand-Device-Id",id)
        }
        return try{c.outputStream.bufferedWriter(Charsets.UTF_8).use{it.write(payload.toString())};c.responseCode in 200..299}finally{c.disconnect()}
    }

    fun taskDone(context:Context,id:String)=post(context,JSONObject().put("action","task_status").put("id",id).put("status","done"))
    fun taskStart(context:Context,id:String)=post(context,JSONObject().put("action","task_status").put("id",id).put("status","in_progress"))
    fun visitStatus(context:Context,id:String,status:String,lat:Double?=null,lng:Double?=null):Boolean{
        val p=JSONObject().put("action","visit_status").put("id",id).put("status",status);if(lat!=null)p.put("latitude",lat);if(lng!=null)p.put("longitude",lng);return post(context,p)
    }
    fun attendance(context:Context,start:Boolean,lat:Double?=null,lng:Double?=null):Boolean{
        val p=JSONObject().put("action",if(start)"attendance_start" else "attendance_stop");if(lat!=null)p.put("latitude",lat);if(lng!=null)p.put("longitude",lng);return post(context,p)
    }
    fun logInteraction(context:Context,contactId:String,kind:String,note:String)=post(context,JSONObject().put("action","crm_interaction").put("contactId",contactId).put("kind",kind).put("note",note))
    fun sendHealth(context:Context)=post(context,JSONObject().put("action","health").put("observedAt",Instant.now().toString()).put("payload",StaffHealth.snapshot(context)))
    fun sendLocations(context:Context,locations:JSONArray)=post(context,JSONObject().put("action","locations").put("items",locations))

    fun uploadCapture(context:Context,jpeg:ByteArray,propertyId:String?,visitId:String?,category:String):Boolean{
        val id=deviceId(context);val auth=token(context);if(id.isBlank()||auth.isBlank()||jpeg.isEmpty())return false
        val c=(URL(BuildConfig.STAFF_PROPERTY_CAPTURE_URL).openConnection() as HttpURLConnection).apply{
            requestMethod="POST";connectTimeout=clientTimeout;readTimeout=clientTimeout;doOutput=true;useCaches=false
            setRequestProperty("Authorization","Bearer "+auth);setRequestProperty("X-Hirmand-Device-Id",id)
            setRequestProperty("X-Hirmand-File-Mime","image/jpeg");setRequestProperty("X-Hirmand-Capture-Category",category)
            if(!propertyId.isNullOrBlank())setRequestProperty("X-Hirmand-Property-Id",propertyId)
            if(!visitId.isNullOrBlank())setRequestProperty("X-Hirmand-Visit-Id",visitId)
            setRequestProperty("Content-Type","image/jpeg")
        }
        return try{c.outputStream.use{it.write(jpeg)};c.responseCode in 200..299}finally{c.disconnect()}
    }

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
            JSONObject().put("connected",true).put("transport",when{cap.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI)->"wifi";cap.hasTransport(android.net.NetworkCapabilities.TRANSPORT_CELLULAR)->"cellular";else->"other"})
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
}
