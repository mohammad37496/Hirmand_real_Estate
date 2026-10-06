package ir.hirmand.staff

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.CalendarContract
import android.provider.ContactsContract
import android.view.Gravity
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.time.Instant

class StaffOperationsActivity:AppCompatActivity(){
    private var snapshot:StaffOperationsSnapshot?=null
    private var currentVisitId:String?=null
    private var currentPropertyId:String?=null
    private var currentCaptureCategory:String="general"

    private val contactPickerLauncher=registerForActivityResult(ActivityResultContracts.PickContact()){uri->
        if(uri==null)return@registerForActivityResult
        val projection=arrayOf(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,ContactsContract.CommonDataKinds.Phone.NUMBER)
        contentResolver.query(uri,projection,null,null,null)?.use{cursor->
            if(cursor.moveToFirst()){
                val name=cursor.getString(0).orEmpty()
                val phone=cursor.getString(1).orEmpty()
                Thread{val ok=StaffOperations.createCrmContact(this,name,phone);runOnUiThread{Toast.makeText(this,if(ok)"مخاطب به CRM هیرمند اضافه شد." else "افزودن مخاطب ناموفق بود.",Toast.LENGTH_LONG).show();if(ok)refresh()}}.start()
            }
        }
    }

    private val cameraLauncher=registerForActivityResult(ActivityResultContracts.StartActivityForResult()){r->
        if(r.resultCode!=Activity.RESULT_OK)return@registerForActivityResult
        val bitmap=(r.data?.extras?.get("data") as? Bitmap)?:return@registerForActivityResult
        val out=ByteArrayOutputStream();bitmap.compress(Bitmap.CompressFormat.JPEG,82,out)
        val visitId=currentVisitId;val propertyId=currentPropertyId
        Thread{
            val ok=StaffOperations.uploadCapture(this,out.toByteArray(),propertyId,visitId,currentCaptureCategory)
            runOnUiThread{Toast.makeText(this,if(ok)"تصویر برای فایل هیرمند ارسال شد." else "ارسال تصویر ناموفق بود.",Toast.LENGTH_LONG).show();if(ok)refresh()}
        }.start()
    }

    override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState);StaffOperations.schedule(this);refresh()}
    private fun dp(v:Int)= (v*resources.displayMetrics.density).toInt()
    private fun txt(value:String,size:Float=14f,bold:Boolean=false):TextView=TextView(this).apply{text=value;textSize=size;setTextColor(getColor(R.color.hirmand_text));if(bold)setTypeface(typeface,android.graphics.Typeface.BOLD);setPadding(dp(2),dp(2),dp(2),dp(2));textDirection=android.view.View.TEXT_DIRECTION_RTL}
    private fun button(label:String,click:()->Unit)=MaterialButton(this).apply{text=label;textSize=12.5f;isAllCaps=false;setOnClickListener{click()}}

    private fun refresh(){
        Thread{
            val result=StaffOperations.sync(this)
            runOnUiThread{
                snapshot=result
                if(result==null){showError("اتصال به سامانه هیرمند انجام نشد.");return@runOnUiThread}
                if(result.lostMode)handleLostMode(result)
                StaffBusinessNotifier.notifySummary(this,result)
                render(result)
            }
        }.start()
    }

    private fun handleLostMode(data:StaffOperationsSnapshot){
        val prefs=getSharedPreferences("hirmand_staff",MODE_PRIVATE)
        if(prefs.getBoolean("lost_lock_applied",false))return
        if(DeviceOwnerManager.isDeviceOwner(this)){
            runCatching{getSystemService(android.app.admin.DevicePolicyManager::class.java)?.lockNow()}
            prefs.edit().putBoolean("lost_lock_applied",true).apply()
        }else{
            Toast.makeText(this,data.lostMessage.ifBlank{"این دستگاه توسط مدیریت هیرمند مفقود علامت‌گذاری شده است."},Toast.LENGTH_LONG).show()
        }
    }

    private fun render(data:StaffOperationsSnapshot){
        val scroll=ScrollView(this).apply{setBackgroundColor(getColor(R.color.hirmand_bg))}
        val root=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;layoutDirection=android.view.View.LAYOUT_DIRECTION_RTL;setPadding(dp(18),dp(18),dp(18),dp(28))}
        scroll.addView(root)
        root.addView(txt("مرکز عملیات کارکنان",24f,true),lp(-1,-2))
        root.addView(txt("مأموریت، بازدید ملک، CRM، حضور و سلامت دستگاه",13f),lp(-1,-2))
        root.addView(button("بروزرسانی اطلاعات"){refresh()},lp(-1,dp(46)).apply{topMargin=dp(10);bottomMargin=dp(12)})
        if(data.lostMode){
            val lost=card();lost.addView(txt("⚠ دستگاه در حالت مفقودی است\n"+data.lostMessage,14f,true));root.addView(lost,lp(-1,-2).apply{bottomMargin=dp(12)})
        }
        val attend=card()
        attend.addView(txt("حضور و شروع روز کاری",17f,true),lp(-1,-2))
        attend.addView(txt(if(data.attendance?.startedAt!=null&&data.attendance?.endedAt==null)"حضور امروز فعال است." else if(data.attendance?.endedAt!=null)"حضور امروز ثبت و پایان یافته است." else "هنوز ورود امروز ثبت نشده است.",12.5f),lp(-1,-2))
        val attendButton=button(if(data.attendance?.startedAt!=null&&data.attendance?.endedAt==null)"پایان حضور امروز" else "شروع حضور امروز"){
            lastLocation{loc->
                Thread{StaffOperations.attendance(this,data.attendance?.startedAt!=null&&data.attendance?.endedAt==null,loc?.latitude,loc?.longitude);if(data.attendance?.startedAt!=null&&data.attendance?.endedAt==null)stopLocationService() else startLocationService();refresh()}.start()
            }
        }
        attend.addView(attendButton,lp(-1,dp(46)).apply{topMargin=dp(8)});root.addView(attend,lp(-1,-2).apply{bottomMargin=dp(12)})

        section(root,"وظایف امروز")
        if(data.tasks.isEmpty())root.addView(txt("وظیفه‌ای برای شما ثبت نشده است.",12.5f),lp(-1,-2))
        for(task in data.tasks.take(30)){
            val c=card();c.addView(txt(task.title,15f,true),lp(-1,-2));c.addView(txt((task.description.ifBlank{"بدون توضیح"})+"\\nاولویت: "+task.priority+" · موعد: "+dateText(task.dueAt),12f),lp(-1,-2))
            if(task.status!="done"){c.addView(button(if(task.status=="in_progress")"انجام شد" else "شروع وظیفه"){Thread{if(task.status=="in_progress")StaffOperations.taskDone(this,task.id) else StaffOperations.taskStart(this,task.id);refresh()}.start()},lp(-1,dp(43)).apply{topMargin=dp(7)})}
            root.addView(c,lp(-1,-2).apply{bottomMargin=dp(9)})
        }

        section(root,"بازدیدهای ملک")
        for(v in data.visits.filter{it.status!="completed"}.take(20)){
            val c=card();c.addView(txt(v.title,15f,true),lp(-1,-2));c.addView(txt((v.address.ifBlank{"بدون آدرس"})+"\\n"+(if(v.targetLat!=null)"geofence فعال · شعاع "+v.radiusM.toInt()+" متر" else "geofence تعریف نشده")+" · "+dateText(v.scheduledAt),12f),lp(-1,-2))
            val start=button(if(v.status=="planned")"شروع بازدید" else "پایان بازدید"){
                if(v.status=="planned"){
                    getSharedPreferences("hirmand_staff",MODE_PRIVATE).edit().putString("active_visit_id",v.id).putString("active_visit_lat",v.targetLat?.toString()).putString("active_visit_lng",v.targetLng?.toString()).putFloat("active_visit_radius",v.radiusM.toFloat()).apply()
                    currentVisitId=v.id;currentPropertyId=v.propertyId;startLocationService()
                    Thread{
                        val immediatelyArrived=v.targetLat==null || v.targetLng==null
                        if(immediatelyArrived) StaffOperations.visitStatus(this,v.id,"arrived")
                        runOnUiThread{
                            Toast.makeText(this,if(immediatelyArrived)"بازدید شروع شد." else "geofence بازدید فعال شد؛ با رسیدن به محدوده، ورود خودکار ثبت می‌شود.",Toast.LENGTH_LONG).show()
                            refresh()
                        }
                    }.start()
                }else{
                    stopLocationService();Thread{StaffOperations.visitStatus(this,v.id,"completed");runOnUiThread{refresh()}}.start()
                }
            }
            c.addView(start,lp(-1,dp(43)).apply{topMargin=dp(7)})
            val cal=button("افزودن بازدید به تقویم"){addCalendar(v)}
            c.addView(cal,lp(-1,dp(43)).apply{topMargin=dp(7)})
            val photo=button("ثبت تصویر ملک"){
                val labels=arrayOf("نمای بیرونی","پذیرایی","آشپزخانه","اتاق خواب","پارکینگ/انباری","مدارک","سایر")
                android.app.AlertDialog.Builder(this).setTitle("دسته تصویر را انتخاب کنید").setItems(labels){_,which->
                    currentCaptureCategory=labels[which]
                    currentVisitId=v.id;currentPropertyId=v.propertyId
                    cameraLauncher.launch(Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE))
                }.show()
            }
            c.addView(photo,lp(-1,dp(43)).apply{topMargin=dp(7)})
            root.addView(c,lp(-1,-2).apply{bottomMargin=dp(9)})
        }

        section(root,"CRM مشتریان")
        root.addView(button("افزودن مخاطب از دفترچه تلفن"){contactPickerLauncher.launch(ContactsContract.CommonDataKinds.Phone.CONTENT_URI)},lp(-1,dp(43)).apply{bottomMargin=dp(9)})
        for(contact in data.contacts.take(40)){
            val c=card();c.addView(txt(contact.name,15f,true),lp(-1,-2));c.addView(txt((contact.phone.ifBlank{"بدون شماره"})+" · "+contact.type+"\\nپیگیری: "+dateText(contact.nextFollowUpAt),12f),lp(-1,-2))
            if(contact.phone.isNotBlank())c.addView(button("تماس با مشتری"){startActivity(Intent(Intent.ACTION_DIAL,Uri.parse("tel:"+Uri.encode(contact.phone))))},lp(-1,dp(43)).apply{topMargin=dp(7)})
            c.addView(button("ثبت پیگیری"){showNoteDialog(contact)},lp(-1,dp(43)).apply{topMargin=dp(7)})
            root.addView(c,lp(-1,-2).apply{bottomMargin=dp(9)})
        }

        val health=card();health.addView(txt("سلامت و امنیت دستگاه",17f,true),lp(-1,-2));health.addView(txt("سلامت دستگاه، وضعیت شبکه، باتری، فضای ذخیره‌سازی و مجوزها به‌صورت محدود و کاری گزارش می‌شود. اعلان‌ها و Accessibility شخصی جمع‌آوری نمی‌شوند.",12f),lp(-1,-2));health.addView(button("ارسال گزارش سلامت الآن"){Thread{StaffOperations.sendHealth(this);runOnUiThread{Toast.makeText(this,"گزارش سلامت ارسال شد.",Toast.LENGTH_SHORT).show()}}.start()},lp(-1,dp(43)).apply{topMargin=dp(7)});root.addView(health,lp(-1,-2).apply{bottomMargin=dp(9)})
        setContentView(scroll)
    }

    private fun showNoteDialog(contact:StaffCrmContactItem){
        val input=EditText(this).apply{hint="یادداشت پیگیری";minLines=3;gravity=Gravity.TOP}
        android.app.AlertDialog.Builder(this).setTitle("ثبت پیگیری · "+contact.name).setView(input).setNegativeButton("انصراف",null).setPositiveButton("ثبت"){_,_->Thread{StaffOperations.logInteraction(this,contact.id,"note",input.text?.toString().orEmpty());runOnUiThread{refresh()}}.start()}.show()
    }
    private fun addCalendar(v:StaffVisitItem){
        val intent=Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI)
            .putExtra(CalendarContract.Events.TITLE,"بازدید · "+v.title)
            .putExtra(CalendarContract.Events.DESCRIPTION,(v.address+"\\n"+(v.propertyId?:"")))
        v.scheduledAt?.let{runCatching{Instant.parse(it).toEpochMilli()}.getOrNull()?.let{ms->intent.putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME,ms).putExtra(CalendarContract.EXTRA_EVENT_END_TIME,ms+3600000L)}}
        startActivity(intent)
        Thread{StaffOperations.post(this,JSONObject().put("action","calendar_logged").put("visitId",v.id))}.start()
    }
    private fun section(root:LinearLayout,label:String){root.addView(txt(label,18f,true),lp(-1,-2).apply{topMargin=dp(8);bottomMargin=dp(8)})}
    private fun card()=MaterialCardView(this).apply{radius=dp(17).toFloat();setCardBackgroundColor(getColor(R.color.hirmand_surface));strokeWidth=dp(1);strokeColor=getColor(R.color.hirmand_surface_2);setContentPadding(dp(14),dp(13),dp(14),dp(13))}
    private fun lp(w:Int,h:Int)=LinearLayout.LayoutParams(w,h)
    private fun dateText(v:String?):String=if(v.isNullOrBlank())"—" else runCatching{java.text.DateFormat.getDateTimeInstance(java.text.DateFormat.SHORT,java.text.DateFormat.SHORT).format(java.util.Date.from(Instant.parse(v)))}.getOrDefault("—")
    private fun lastLocation(callback:(android.location.Location?)->Unit){
        val ok=ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED||ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED
        if(!ok){callback(null);return}
        val manager=getSystemService(android.location.LocationManager::class.java)
        val providers=listOf(android.location.LocationManager.GPS_PROVIDER,android.location.LocationManager.NETWORK_PROVIDER)
        val location=providers.asSequence().mapNotNull{p->runCatching{manager.getLastKnownLocation(p)}.getOrNull()}.maxByOrNull{it.time}
        callback(location)
    }
    private fun startLocationService(){if(Build.VERSION.SDK_INT>=26){ContextCompat.startForegroundService(this,Intent(this,StaffLocationService::class.java))}else startService(Intent(this,StaffLocationService::class.java))}
    private fun stopLocationService(){stopService(Intent(this,StaffLocationService::class.java));getSharedPreferences("hirmand_staff",MODE_PRIVATE).edit().remove("active_visit_id").remove("active_visit_lat").remove("active_visit_lng").remove("active_visit_radius").apply()}
    private fun showError(msg:String){Toast.makeText(this,msg,Toast.LENGTH_LONG).show();setContentView(LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(dp(24),dp(28),dp(24),dp(28));addView(txt("مرکز عملیات",24f,true));addView(txt(msg,14f),lp(-1,-2));addView(button("تلاش دوباره"){refresh()},lp(-1,dp(48)).apply{topMargin=dp(12)})})}
}
