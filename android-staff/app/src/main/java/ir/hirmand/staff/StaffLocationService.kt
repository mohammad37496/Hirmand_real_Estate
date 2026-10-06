package ir.hirmand.staff

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import android.content.pm.ServiceInfo
import androidx.core.content.ContextCompat
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

class StaffLocationService:Service(){
    private lateinit var locationManager:LocationManager
    private var currentBatch=JSONArray()
    private var activeVisitId:String?=null
    private var targetLat:Double?=null
    private var targetLng:Double?=null
    private var radius=120.0
    private var arrivalSent=false

    override fun onCreate(){
        super.onCreate()
        createChannel()
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    4310,
                    notification(),
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
                )
            } else {
                startForeground(4310, notification())
            }
        }.onFailure { stopSelf() }
        val prefs=getSharedPreferences("hirmand_staff",MODE_PRIVATE)
        activeVisitId=prefs.getString("active_visit_id",null)
        targetLat=prefs.getString("active_visit_lat",null)?.toDoubleOrNull()
        targetLng=prefs.getString("active_visit_lng",null)?.toDoubleOrNull()
        radius=prefs.getFloat("active_visit_radius",120f).toDouble()
        locationManager=getSystemService(LocationManager::class.java)
    }

    override fun onStartCommand(intent:Intent?,flags:Int,startId:Int):Int{requestUpdates();return START_STICKY}

    private fun requestUpdates(){
        val fine=ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED
        val coarse=ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED
        if(!fine&&!coarse){stopSelf();return}
        try{
            locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER,60_000L,50f,listener)
            if(coarse||fine)locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER,60_000L,100f,listener)
        }catch(_:SecurityException){stopSelf()}
    }

    private val listener=object:LocationListener{
        override fun onLocationChanged(location:Location){
            val item=JSONObject().put("latitude",location.latitude).put("longitude",location.longitude)
                .put("accuracyM",location.accuracy).put("altitudeM",location.altitude).put("speedMps",location.speed)
                .put("provider",location.provider?:"").put("observedAt",Instant.ofEpochMilli(location.time).toString())
                .put("clientEventId",UUID.randomUUID().toString())
            currentBatch.put(item)
            if(currentBatch.length()>=5){flush();currentBatch=JSONArray()}
            maybeAutoArrive(location)
        }
    }

    private fun maybeAutoArrive(location:Location){
        val visitId=activeVisitId?:return
        val lat=targetLat?:return;val lng=targetLng?:return
        if(arrivalSent)return
        val out=FloatArray(1);Location.distanceBetween(location.latitude,location.longitude,lat,lng,out)
        if(out[0]<=radius){
            arrivalSent=true
            Thread{StaffOperations.visitStatus(this,visitId,"arrived",location.latitude,location.longitude)}.start()
        }
    }

    private fun flush(){
        val payload=currentBatch
        Thread{StaffOperations.sendLocations(this,payload)}.start()
    }

    override fun onDestroy(){
        runCatching{if(currentBatch.length()>0)flush()}
        runCatching{locationManager.removeUpdates(listener)}
        super.onDestroy()
    }
    override fun onBind(intent:Intent?):IBinder?=null

    private fun createChannel(){
        if(Build.VERSION.SDK_INT>=26)getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel("hirmand_location","مکان‌یابی عملیات هیرمند",NotificationManager.IMPORTANCE_LOW)
        )
    }
    private fun notification():Notification=NotificationCompat.Builder(this,"hirmand_location")
        .setSmallIcon(R.drawable.ic_hirmand_staff).setContentTitle("املاک هیرمند · مرکز عملیات")
        .setContentText("مکان‌یابی مأموریت فعال است و با اعلان قابل مشاهده اجرا می‌شود.")
        .setOngoing(true).build()
}
