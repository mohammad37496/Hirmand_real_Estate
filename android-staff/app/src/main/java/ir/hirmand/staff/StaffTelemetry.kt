package ir.hirmand.staff

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.SystemClock
import android.provider.Settings
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.util.UUID
import java.util.concurrent.TimeUnit

private const val STAFF_PREFS = "hirmand_staff"
private const val PREF_DEVICE_TOKEN = "device_auth_token"
private const val PREF_TELEMETRY_QUEUE = "telemetry_queue"
private const val PREF_LOCATION_TRACKING_ENABLED = "location_tracking_enabled"
private const val PREF_LOCATION_TRACKING_INITIALIZED = "location_tracking_initialized"

object StaffTelemetryStore {
    fun token(context: Context): String =
        prefs(context).getString(PREF_DEVICE_TOKEN, "").orEmpty()

    fun saveToken(context: Context, token: String) {
        prefs(context).edit().putString(PREF_DEVICE_TOKEN, token.trim()).apply()
    }

    fun locationTrackingEnabled(context: Context): Boolean =
        prefs(context).getBoolean(PREF_LOCATION_TRACKING_ENABLED, false)

    fun setLocationTrackingEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(PREF_LOCATION_TRACKING_ENABLED, enabled).apply()
    }

    fun locationTrackingInitialized(context: Context): Boolean =
        prefs(context).getBoolean(PREF_LOCATION_TRACKING_INITIALIZED, false)

    fun setLocationTrackingInitialized(context: Context, initialized: Boolean) {
        prefs(context).edit().putBoolean(PREF_LOCATION_TRACKING_INITIALIZED, initialized).apply()
    }

    @Synchronized
    fun enqueue(context: Context, eventType: String, payload: JSONObject, observedAt: String = Instant.now().toString()) {
        val items = readQueue(context)
        items.put(
            JSONObject()
                .put("clientEventId", UUID.randomUUID().toString())
                .put("eventType", eventType)
                .put("payload", payload)
                .put("observedAt", observedAt)
        )

        val maxItems = 2000
        while (items.length() > maxItems) {
            items.remove(0)
        }
        prefs(context).edit().putString(PREF_TELEMETRY_QUEUE, items.toString()).apply()
    }

    @Synchronized
    fun takeBatch(context: Context, eventType: String?, limit: Int): JSONArray {
        val all = readQueue(context)
        val batch = JSONArray()
        for (i in 0 until all.length()) {
            if (batch.length() >= limit) break
            val item = all.optJSONObject(i) ?: continue
            if (eventType == null || item.optString("eventType") == eventType) {
                batch.put(item)
            }
        }
        return batch
    }

    @Synchronized
    fun removeBatch(context: Context, batch: JSONArray) {
        if (batch.length() == 0) return
        val ids = buildSet {
            for (i in 0 until batch.length()) {
                batch.optJSONObject(i)?.optString("clientEventId")?.takeIf { it.isNotBlank() }?.let(::add)
            }
        }
        if (ids.isEmpty()) return

        val all = readQueue(context)
        val remaining = JSONArray()
        for (i in 0 until all.length()) {
            val item = all.optJSONObject(i) ?: continue
            if (!ids.contains(item.optString("clientEventId"))) {
                remaining.put(item)
            }
        }
        prefs(context).edit().putString(PREF_TELEMETRY_QUEUE, remaining.toString()).apply()
    }

    fun queueSize(context: Context): Int = readQueue(context).length()

    private fun readQueue(context: Context): JSONArray {
        val raw = prefs(context).getString(PREF_TELEMETRY_QUEUE, null) ?: return JSONArray()
        return runCatching { JSONArray(raw) }.getOrDefault(JSONArray())
    }

    private fun prefs(context: Context) =
        context.getSharedPreferences(STAFF_PREFS, Context.MODE_PRIVATE)
}

object StaffTelemetry {
    const val TELEMETRY_URL =
        "https://www.hirmandrealestate.ir/api/mobile/telemetry"
    const val LOCATION_URL =
        "https://www.hirmandrealestate.ir/api/mobile/location"

    fun schedulePeriodicSync(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = PeriodicWorkRequestBuilder<StaffTelemetryWorker>(
            15,
            TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "hirmand-staff-telemetry",
            ExistingPeriodicWorkPolicy.KEEP,
            request
        )
    }

    fun enqueueHeartbeat(context: Context) {
        StaffTelemetryStore.enqueue(
            context,
            "app_heartbeat",
            JSONObject()
                .put("appVersionName", BuildConfig.VERSION_NAME)
                .put("appVersionCode", BuildConfig.VERSION_CODE)
                .put("queueSize", StaffTelemetryStore.queueSize(context))
                .put("elapsedRealtimeMs", SystemClock.elapsedRealtime()),
        )
    }

    fun enqueueUsageSnapshot(context: Context) {
        if (!hasUsageAccess(context)) return

        val usageManager = context.getSystemService(UsageStatsManager::class.java) ?: return
        val end = System.currentTimeMillis()
        val start = end - 24L * 60L * 60L * 1000L
        val stats = usageManager.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY,
            start,
            end
        ).orEmpty()

        val apps = JSONArray()
        stats
            .filter { it.totalTimeInForeground > 0L }
            .sortedByDescending { it.totalTimeInForeground }
            .take(20)
            .forEach {
                apps.put(
                    JSONObject()
                        .put("packageName", it.packageName)
                        .put("foregroundMs", it.totalTimeInForeground)
                )
            }

        StaffTelemetryStore.enqueue(
            context,
            "usage_snapshot",
            JSONObject()
                .put("windowStart", Instant.ofEpochMilli(start).toString())
                .put("windowEnd", Instant.ofEpochMilli(end).toString())
                .put("apps", apps)
        )
    }

    fun enqueuePermissionState(context: Context, states: JSONObject) {
        StaffTelemetryStore.enqueue(
            context,
            "permission_state",
            states,
        )
    }

    fun enqueueLocation(
        context: Context,
        latitude: Double,
        longitude: Double,
        accuracyM: Float?,
        altitudeM: Double?,
        speedMps: Float?,
        provider: String?,
        observedAt: String = Instant.now().toString(),
    ) {
        StaffTelemetryStore.enqueue(
            context,
            "location",
            JSONObject()
                .put("latitude", latitude)
                .put("longitude", longitude)
                .put("accuracyM", accuracyM)
                .put("altitudeM", altitudeM)
                .put("speedMps", speedMps)
                .put("provider", provider.orEmpty()),
            observedAt,
        )
    }

    fun hasUsageAccess(context: Context): Boolean {
        val appOps = context.getSystemService(AppOpsManager::class.java) ?: return false
        val mode = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                context.applicationInfo.uid,
                context.packageName
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                context.applicationInfo.uid,
                context.packageName
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    fun hasLocationPermission(context: Context): Boolean =
        androidx.core.content.ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED ||
            androidx.core.content.ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

    fun sendBatch(
        context: Context,
        url: String,
        batch: JSONArray,
        fieldName: String,
    ): Boolean {
        val token = StaffTelemetryStore.token(context)
        if (token.isBlank() || batch.length() == 0) return false

        val body = JSONObject().put(fieldName, batch).toString()
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 8_000
            readTimeout = 15_000
            doOutput = true
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("Authorization", "Bearer " + token)
            setRequestProperty(
                "X-Hirmand-Device-Id",
                context.getSharedPreferences(STAFF_PREFS, Context.MODE_PRIVATE)
                    .getString("device_id", "")
                    .orEmpty()
            )
        }

        return try {
            connection.outputStream.bufferedWriter(Charsets.UTF_8).use { it.write(body) }
            connection.responseCode in 200..299
        } finally {
            connection.disconnect()
        }
    }

    fun flush(context: Context): Boolean {
        var success = true

        repeat(4) {
            val batch = StaffTelemetryStore.takeBatch(context, "telemetry", 50)
            // "telemetry" is not an event type; this branch is intentionally unused.
            if (batch.length() > 0) break
        }

        val eventBatch = JSONArray()
        val all = StaffTelemetryStore.takeBatch(context, null, 50)
        val locationBatch = JSONArray()
        for (i in 0 until all.length()) {
            val item = all.optJSONObject(i) ?: continue
            if (item.optString("eventType") == "location") {
                locationBatch.put(
                    JSONObject()
                        .put("clientEventId", item.optString("clientEventId"))
                        .put("latitude", item.optJSONObject("payload")?.optDouble("latitude"))
                        .put("longitude", item.optJSONObject("payload")?.optDouble("longitude"))
                        .put("accuracyM", item.optJSONObject("payload")?.optDouble("accuracyM"))
                        .put("altitudeM", item.optJSONObject("payload")?.optDouble("altitudeM"))
                        .put("speedMps", item.optJSONObject("payload")?.optDouble("speedMps"))
                        .put("provider", item.optJSONObject("payload")?.optString("provider").orEmpty())
                        .put("observedAt", item.optString("observedAt"))
                )
            } else {
                eventBatch.put(item)
            }
        }

        if (eventBatch.length() > 0) {
            val ok = sendBatch(context, TELEMETRY_URL, eventBatch, "events")
            if (ok) {
                StaffTelemetryStore.removeBatch(context, eventBatch)
            } else {
                success = false
            }
        }

        if (locationBatch.length() > 0) {
            val ok = sendBatch(context, LOCATION_URL, locationBatch, "points")
            if (ok) {
                StaffTelemetryStore.removeBatch(context, all)
            } else {
                success = false
            }
        }

        return success
    }
}
