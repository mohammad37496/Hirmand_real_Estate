package ir.hirmand.staff

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

class LocationTrackingService : Service() {
    private lateinit var locationManager: LocationManager

    private val listener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            StaffTelemetry.enqueueLocation(
                context = this@LocationTrackingService,
                latitude = location.latitude,
                longitude = location.longitude,
                accuracyM = if (location.hasAccuracy()) location.accuracy else null,
                altitudeM = if (location.hasAltitude()) location.altitude else null,
                speedMps = if (location.hasSpeed()) location.speed else null,
                provider = location.provider,
                observedAt = java.time.Instant.ofEpochMilli(location.time).toString(),
            )

            Thread {
                StaffTelemetry.flush(this@LocationTrackingService)
            }.start()
        }
    }

    override fun onCreate() {
        super.onCreate()
        locationManager = getSystemService(LocationManager::class.java)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            StaffTelemetryStore.setLocationTrackingEnabled(this, false)
            stopLocationUpdates()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        if (!StaffTelemetryStore.locationTrackingEnabled(this)) {
            stopSelf()
            return START_NOT_STICKY
        }

        if (
            StaffTelemetryStore.token(this).isBlank() ||
            !StaffTelemetry.hasLocationPermission(this) ||
            !isLocationEnabled()
        ) {
            stopSelf()
            return START_NOT_STICKY
        }

        val notification = buildNotification()
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            notification,
            android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
        )
        requestLocationUpdates()
        return START_STICKY
    }

    private fun requestLocationUpdates() {
        if (
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED
        ) {
            stopSelf()
            return
        }

        val providers = locationManager.allProviders.filter { provider ->
            provider == LocationManager.GPS_PROVIDER || provider == LocationManager.NETWORK_PROVIDER
        }

        for (provider in providers) {
            runCatching {
                locationManager.requestLocationUpdates(
                    provider,
                    60_000L,
                    50f,
                    listener
                )
            }
        }
    }

    private fun stopLocationUpdates() {
        runCatching { locationManager.removeUpdates(listener) }
    }

    private fun isLocationEnabled(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            locationManager.isLocationEnabled
        } else {
            locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
        }

    private fun buildNotification(): Notification {
        val stopIntent = PendingIntent.getService(
            this,
            3101,
            Intent(this, LocationTrackingService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_hirmand_staff)
            .setContentTitle("املاک هیرمند")
            .setContentText("پایش موقعیت دستگاه فعال است.")
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .addAction(0, "توقف پایش", stopIntent)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    "پایش موقعیت هیرمند",
                    NotificationManager.IMPORTANCE_LOW
                )
            )
        }
    }

    override fun onDestroy() {
        stopLocationUpdates()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val CHANNEL_ID = "hirmand_location_tracking"
        private const val NOTIFICATION_ID = 4101
        private const val ACTION_STOP = "ir.hirmand.staff.STOP_LOCATION_TRACKING"
    }
}
