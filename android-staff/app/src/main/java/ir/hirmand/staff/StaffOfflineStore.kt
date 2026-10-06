package ir.hirmand.staff

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlin.math.min

data class StaffPendingSync(
    val eventId:String,
    val payload:String,
    val retries:Int,
    val nextRetryAt:Long,
)

data class StaffPendingCapture(
    val eventId:String,
    val filePath:String,
    val propertyId:String?,
    val visitId:String?,
    val category:String,
    val retries:Int,
    val nextRetryAt:Long,
)

class StaffOfflineStore private constructor(context:Context):SQLiteOpenHelper(
    context.applicationContext,
    "hirmand_staff_offline.db",
    null,
    1,
){
    companion object{
        private const val KEY_ALIAS="hirmand_staff_offline_v1"
        private const val STORE="AndroidKeyStore"
        private const val SNAPSHOT_KEY="operations_snapshot"
        @Volatile private var instance:StaffOfflineStore?=null

        fun get(context:Context):StaffOfflineStore=
            instance ?: synchronized(this){instance ?: StaffOfflineStore(context).also{instance=it}}

        private fun key():SecretKey{
            val store=KeyStore.getInstance(STORE).apply{load(null)}
            val existing=store.getKey(KEY_ALIAS,null)
            if(existing is SecretKey)return existing
            val generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,STORE)
            generator.init(
                KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setRandomizedEncryptionRequired(true)
                    .build()
            )
            return generator.generateKey()
        }

        private fun encrypt(value:String):String{
            val cipher=Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE,key())
            val encrypted=cipher.doFinal(value.toByteArray(StandardCharsets.UTF_8))
            return Base64.encodeToString(cipher.iv,Base64.NO_WRAP)+"."+Base64.encodeToString(encrypted,Base64.NO_WRAP)
        }

        private fun decrypt(value:String):String?{
            return runCatching{
                val parts=value.split('.',limit=2)
                if(parts.size!=2)return@runCatching null
                val iv=Base64.decode(parts[0],Base64.NO_WRAP)
                val encrypted=Base64.decode(parts[1],Base64.NO_WRAP)
                val cipher=Cipher.getInstance("AES/GCM/NoPadding")
                cipher.init(Cipher.DECRYPT_MODE,key(),GCMParameterSpec(128,iv))
                String(cipher.doFinal(encrypted),StandardCharsets.UTF_8)
            }.getOrNull()
        }
    }

    override fun onCreate(db:SQLiteDatabase){
        db.execSQL("create table operations_snapshot(key text primary key, value text not null, updated_at integer not null)")
        db.execSQL("create table sync_queue(event_id text primary key, payload text not null, created_at integer not null, retries integer not null default 0, next_retry_at integer not null)")
        db.execSQL("create index sync_queue_retry_idx on sync_queue(next_retry_at asc)")
        db.execSQL("create table capture_queue(event_id text primary key, file_path text not null, property_id text, visit_id text, category text not null, created_at integer not null, retries integer not null default 0, next_retry_at integer not null)")
        db.execSQL("create index capture_queue_retry_idx on capture_queue(next_retry_at asc)")
    }

    override fun onUpgrade(db:SQLiteDatabase,oldVersion:Int,newVersion:Int){}

    fun cacheSnapshot(json:String){
        val values=ContentValues().apply{
            put("key",SNAPSHOT_KEY)
            put("value",encrypt(json))
            put("updated_at",System.currentTimeMillis())
        }
        writableDatabase.insertWithOnConflict("operations_snapshot",null,values,SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun cachedSnapshot():Pair<String?,Long?>{
        readableDatabase.query(
            "operations_snapshot",
            arrayOf("value","updated_at"),
            "key=?",
            arrayOf(SNAPSHOT_KEY),
            null,null,null,"1"
        ).use{
            if(!it.moveToFirst())return null to null
            return decrypt(it.getString(0)) to it.getLong(1)
        }
    }

    fun enqueue(eventId:String,payload:String){
        val now=System.currentTimeMillis()
        val values=ContentValues().apply{
            put("event_id",eventId)
            put("payload",encrypt(payload))
            put("created_at",now)
            put("retries",0)
            put("next_retry_at",now)
        }
        writableDatabase.insertWithOnConflict("sync_queue",null,values,SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun dueQueue(limit:Int=12):List<StaffPendingSync>{
        val result=mutableListOf<StaffPendingSync>()
        readableDatabase.query(
            "sync_queue",
            arrayOf("event_id","payload","retries","next_retry_at"),
            "next_retry_at<=?",
            arrayOf(System.currentTimeMillis().toString()),
            null,null,"created_at asc",
            limit.coerceIn(1,50).toString()
        ).use{
            while(it.moveToNext()){
                val payload=decrypt(it.getString(1)) ?: continue
                result+=StaffPendingSync(it.getString(0),payload,it.getInt(2),it.getLong(3))
            }
        }
        return result
    }

    fun remove(eventId:String){
        writableDatabase.delete("sync_queue","event_id=?",arrayOf(eventId))
    }

    fun markFailed(eventId:String,retries:Int){
        val next=System.currentTimeMillis()+min(6*60*60*1000L,15000L*(1L shl retries.coerceIn(0,8)))
        writableDatabase.update(
            "sync_queue",
            ContentValues().apply{put("retries",retries+1);put("next_retry_at",next)},
            "event_id=?",
            arrayOf(eventId),
        )
    }

    fun enqueueCapture(eventId:String,filePath:String,propertyId:String?,visitId:String?,category:String){
        val now=System.currentTimeMillis()
        writableDatabase.insertWithOnConflict(
            "capture_queue",
            null,
            ContentValues().apply{
                put("event_id",eventId);put("file_path",filePath);put("property_id",propertyId);put("visit_id",visitId)
                put("category",category);put("created_at",now);put("retries",0);put("next_retry_at",now)
            },
            SQLiteDatabase.CONFLICT_REPLACE,
        )
    }

    fun dueCaptures(limit:Int=4):List<StaffPendingCapture>{
        val result=mutableListOf<StaffPendingCapture>()
        readableDatabase.query(
            "capture_queue",
            arrayOf("event_id","file_path","property_id","visit_id","category","retries","next_retry_at"),
            "next_retry_at<=?",
            arrayOf(System.currentTimeMillis().toString()),
            null,null,"created_at asc",
            limit.coerceIn(1,20).toString(),
        ).use{
            while(it.moveToNext()){
                result+=StaffPendingCapture(
                    eventId=it.getString(0),
                    filePath=it.getString(1),
                    propertyId=if(it.isNull(2))null else it.getString(2),
                    visitId=if(it.isNull(3))null else it.getString(3),
                    category=it.getString(4),
                    retries=it.getInt(5),
                    nextRetryAt=it.getLong(6),
                )
            }
        }
        return result
    }

    fun removeCapture(eventId:String){
        writableDatabase.delete("capture_queue","event_id=?",arrayOf(eventId))
    }

    fun markCaptureFailed(eventId:String,retries:Int){
        val next=System.currentTimeMillis()+min(6*60*60*1000L,30000L*(1L shl retries.coerceIn(0,8)))
        writableDatabase.update(
            "capture_queue",
            ContentValues().apply{put("retries",retries+1);put("next_retry_at",next)},
            "event_id=?",
            arrayOf(eventId),
        )
    }

    fun pendingCount():Int=
        readableDatabase.rawQuery(
            "select (select count(*) from sync_queue)+(select count(*) from capture_queue)",
            null,
        ).use{if(it.moveToFirst())it.getInt(0) else 0}

    fun prune(){
        val cutoff=(System.currentTimeMillis()-14*24*60*60*1000L).toString()
        writableDatabase.delete("sync_queue","created_at<?",arrayOf(cutoff))
        writableDatabase.delete("capture_queue","created_at<?",arrayOf(cutoff))
    }
}