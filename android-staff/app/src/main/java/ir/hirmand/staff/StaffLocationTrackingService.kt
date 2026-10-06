package ir.hirmand.staff

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

class StaffLocationTrackingService : Service() {

    companion object {
        private const val CHANNEL_ID = "hirmand_location_tracking"
        private const val NOTIFICATION_ID = 4107
        private const val INTERVAL_MS = 60_000L

        fun start(context: Context) {
            val intent = Intent(context, StaffLocationTrackingService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, StaffLocationTrackingService::class.java))
        }
    }

    private val locationManager by lazy {
        getSystemService(LocationManager::class.java)
    }

    private val listener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            if (!hasLocationAccess()) {
                stopSelf()
                return
            }

            val payload = org.json.JSONObject()
                .put("latitude", location.latitude)
                .put("longitude", location.longitude)
                .put("accuracyM", location.accuracy.toDouble())
                .put("altitudeM", if (location.hasAltitude()) location.altitude else org.json.JSONObject.NULL)
                .put("speedMps", if (location.hasSpeed()) location.speed.toDouble() else org.json.JSONObject.NULL)
                .put("provider", location.provider.orEmpty())

            StaffTelemetryStore.enqueue(
                applicationContext,
                "location",
                payload,
                observedAt = java.time.Instant.ofEpochMilli(location.time).toString(),
            )

            Thread {
                StaffTelemetry.flush(applicationContext)
            }.start()
        }
    }

    override fun onCreate() {
        super.onCreate()
        if (!canTrack()) {
            stopSelf()
            return
        }

        createNotificationChannel()
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
            )
        } else {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, 0)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!canTrack()) {
            stopSelf()
            return START_NOT_STICKY
        }

        runCatching {
            locationManager?.requestLocationUpdates(
                LocationManager.GPS_PROVIDER,
                INTERVAL_MS,
                0f,
                listener,
                Looper.getMainLooper(),
            )
        }

        runCatching {
            if (locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    INTERVAL_MS,
                    0f,
                    listener,
                    Looper.getMainLooper(),
                )
            }
        }

        return START_NOT_STICKY
    }

    override fun onDestroy() {
        runCatching { locationManager?.removeUpdates(listener) }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun canTrack(): Boolean {
        val prefs = getSharedPreferences("hirmand_staff", Context.MODE_PRIVATE)
        val agreementAccepted = prefs.getString("accepted_agreement_version", null) == "1.1"
        val deviceStatus = prefs.getString("device_registration_status", null) == "active"
        return agreementAccepted && deviceStatus && hasLocationAccess()
    }

    private fun hasLocationAccess(): Boolean {
        val fine = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!fine && !coarse) return false

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            locationManager?.isLocationEnabled == true
        } else {
            true
        }
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_hirmand_staff)
            .setContentTitle("املاک هیرمند")
            .setContentText("اشتراک موقعیت مکانی با سامانه هیرمند فعال است.")
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java) ?: return
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "ردیابی موقعیت هیرمند",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "نمایش فعال بودن اشتراک موقعیت مکانی دستگاه با سامانه هیرمند"
            }
        )
    }
}
