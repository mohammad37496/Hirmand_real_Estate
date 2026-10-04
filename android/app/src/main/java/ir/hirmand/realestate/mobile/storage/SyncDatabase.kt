package ir.hirmand.realestate.mobile.storage

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.util.UUID

data class PendingEvent(
    val id: Long,
    val clientEventId: String,
    val eventType: String,
    val occurredAt: String,
    val payloadJson: String,
)

class SyncDatabase(context: Context) : SQLiteOpenHelper(
    context.applicationContext,
    "hirmand_mobile.db",
    null,
    1,
) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            create table pending_events (
                id integer primary key autoincrement,
                client_event_id text not null unique,
                event_type text not null,
                occurred_at text not null,
                payload_json text not null
            )
            """.trimIndent(),
        )
        db.execSQL("create index idx_pending_events_id on pending_events(id)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

    @Synchronized
    fun enqueue(eventType: String, occurredAt: String, payloadJson: String) {
        writableDatabase.execSQL(
            "insert or ignore into pending_events(client_event_id,event_type,occurred_at,payload_json) values(?,?,?,?)",
            arrayOf(UUID.randomUUID().toString(), eventType, occurredAt, payloadJson),
        )
    }

    @Synchronized
    fun peek(limit: Int): List<PendingEvent> {
        val result = mutableListOf<PendingEvent>()
        readableDatabase.query(
            "pending_events",
            arrayOf("id", "client_event_id", "event_type", "occurred_at", "payload_json"),
            null,
            null,
            null,
            null,
            "id asc",
            limit.toString(),
        ).use { cursor ->
            while (cursor.moveToNext()) {
                result += PendingEvent(
                    id = cursor.getLong(0),
                    clientEventId = cursor.getString(1),
                    eventType = cursor.getString(2),
                    occurredAt = cursor.getString(3),
                    payloadJson = cursor.getString(4),
                )
            }
        }
        return result
    }

    @Synchronized
    fun delete(ids: List<Long>) {
        if (ids.isEmpty()) return
        val db = writableDatabase
        db.beginTransaction()
        try {
            ids.forEach { db.delete("pending_events", "id = ?", arrayOf(it.toString())) }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    @Synchronized
    fun count(): Int {
        readableDatabase.rawQuery("select count(*) from pending_events", null).use { cursor ->
            return if (cursor.moveToFirst()) cursor.getInt(0) else 0
        }
    }
}
