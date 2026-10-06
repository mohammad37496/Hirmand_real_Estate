package ir.hirmand.staff

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat

object StaffBusinessNotifier{
    private const val CHANNEL="hirmand_business"
    fun notifySummary(context:Context,snapshot:StaffOperationsSnapshot){
        val manager=context.getSystemService(NotificationManager::class.java)
        if(android.os.Build.VERSION.SDK_INT>=26){
            manager.createNotificationChannel(NotificationChannel(CHANNEL,"اعلان‌های کاری هیرمند",NotificationManager.IMPORTANCE_DEFAULT))
        }
        val overdue=snapshot.tasks.count{it.status!="done"&&it.dueAt!=null&&runCatching{java.time.Instant.parse(it.dueAt)}.getOrNull()?.isBefore(java.time.Instant.now())==true}
        val upcomingVisits=snapshot.visits.count{it.status=="planned"&&it.scheduledAt!=null&&runCatching{java.time.Instant.parse(it.scheduledAt)}.getOrNull()?.isBefore(java.time.Instant.now().plusSeconds(3600))==true}
        val dueFollowUps=snapshot.daily.followUpsDue
        if(overdue==0&&upcomingVisits==0&&dueFollowUps==0)return
        val text=buildString{
            if(overdue>0)append("وظایف عقب‌افتاده: ").append(overdue.toString()).append("  ")
            if(upcomingVisits>0)append("بازدید نزدیک: ").append(upcomingVisits.toString()).append("  ")
            if(dueFollowUps>0)append("پیگیری سررسید: ").append(dueFollowUps.toString())
        }
        manager.notify(4311,NotificationCompat.Builder(context,CHANNEL)
            .setSmallIcon(R.drawable.ic_hirmand_staff).setContentTitle("هشدارهای کاری هیرمند")
            .setContentText(text.trim()).setAutoCancel(true).build())
    }
}
