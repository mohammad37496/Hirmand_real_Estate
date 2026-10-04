package ir.hirmand.realestate.mobile.sync

import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

data class RegisterResponse(
    val deviceId: String,
    val accessToken: String,
)

class HirmandApi(
    private val baseUrl: String,
) {
    fun register(
        pairingCode: String,
        deviceId: String,
        appVersion: String,
        deviceModel: String,
        osVersion: String,
        deviceLabel: String,
    ): RegisterResponse {
        val body = JSONObject()
            .put("action", "register")
            .put("pairingCode", pairingCode)
            .put("deviceId", deviceId)
            .put("platform", "android")
            .put("appVersion", appVersion)
            .put("deviceModel", deviceModel)
            .put("osVersion", osVersion)
            .put("deviceLabel", deviceLabel)
            .put("metadata", JSONObject().put("client", "hirmand-mobile"))

        val response = request(body, null)
        val json = JSONObject(response.body)
        return RegisterResponse(
            deviceId = json.getString("deviceId"),
            accessToken = json.getString("accessToken"),
        )
    }

    fun sync(token: String, events: List<QueuedEvent>) {
        val array = JSONArray()
        events.forEach { item ->
            array.put(
                JSONObject()
                    .put("clientEventId", item.clientEventId)
                    .put("eventType", item.eventType)
                    .put("occurredAt", item.occurredAt)
                    .put("payload", JSONObject(item.payloadJson)),
            )
        )

        request(
            JSONObject()
                .put("action", "sync")
                .put("events", array),
            token,
        )
    }

    private fun request(body: JSONObject, token: String?): HttpResult {
        val url = URL("${baseUrl.trimEnd('/')}/api/mobile-sync")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 20_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("Accept", "application/json")
            if (!token.isNullOrBlank()) {
                setRequestProperty("Authorization", "Bearer $token")
            }
        }

        return try {
            val bytes = body.toString().toByteArray(StandardCharsets.UTF_8)
            connection.outputStream.use { it.write(bytes) }

            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val responseBody = stream?.bufferedReader(StandardCharsets.UTF_8)?.use { it.readText() }.orEmpty()

            if (code !in 200..299) {
                val message = runCatching { JSONObject(responseBody).optString("statusMessage") }.getOrNull()
                throw ApiException(code, message?.ifBlank { null } ?: "HTTP $code")
            }

            HttpResult(code, responseBody)
        } catch (error: ApiException) {
            throw error
        } catch (error: IOException) {
            throw error
        } finally {
            connection.disconnect()
        }
    }
}

data class QueuedEvent(
    val clientEventId: String,
    val eventType: String,
    val occurredAt: String,
    val payloadJson: String,
)

data class HttpResult(
    val code: Int,
    val body: String,
)

class ApiException(
    val statusCode: Int,
    message: String,
) : IOException(message)
