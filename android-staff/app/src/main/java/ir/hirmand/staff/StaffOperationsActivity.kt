package ir.hirmand.staff

import android.Manifest
import android.app.Activity
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
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
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Calendar

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
                Thread{
                    val ok=StaffOperations.createCrmContact(this,name,phone)
                    runOnUiThread{
                        Toast.makeText(this,if(ok)"مخاطب به CRM هیرمند اضافه شد و در صورت قطعی اینترنت صف می‌شود." else "افزودن مخاطب ناموفق بود.",Toast.LENGTH_LONG).show()
                        refresh()
                    }
                }.start()
            }
        }
    }

    private val cameraLauncher=registerForActivityResult(ActivityResultContracts.StartActivityForResult()){r->
        if(r.resultCode!=Activity.RESULT_OK)return@registerForActivityResult
        val bitmap=(r.data?.extras?.get("data") as? Bitmap)?:return@registerForActivityResult
        val out=ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG,82,out)
        val visitId=currentVisitId
        val propertyId=currentPropertyId
        Thread{
            val ok=StaffOperations.uploadCapture(this,out.toByteArray(),propertyId,visitId,currentCaptureCategory)
            val queued=StaffOperations.pendingSyncCount(this)>0
            runOnUiThread{
                Toast.makeText(
                    this,
                    when{
                        !ok->"ارسال تصویر ناموفق بود."
                        queued->"تصویر ذخیره شد؛ همگام‌سازی خودکار انجام می‌شود."
                        else->"تصویر برای فایل هیرمند ارسال شد."
                    },
                    Toast.LENGTH_LONG
                ).show()
                refresh()
            }
        }.start()
    }

    override fun onCreate(savedInstanceState:Bundle?){
        super.onCreate(savedInstanceState)
        StaffOperations.schedule(this)
        refresh()
    }

    override fun onResume(){
        super.onResume()
        if(snapshot!=null)refresh()
    }

    private fun dp(v:Int)= (v*resources.displayMetrics.density).toInt()

    private fun txt(value:String,size:Float=14f,bold:Boolean=false):TextView=TextView(this).apply{
        text=value;textSize=size;setTextColor(getColor(R.color.hirmand_text))
        if(bold)setTypeface(typeface,android.graphics.Typeface.BOLD)
        setPadding(dp(2),dp(2),dp(2),dp(2))
        textDirection=android.view.View.TEXT_DIRECTION_RTL
        gravity=Gravity.START
        setLineSpacing(dp(1).toFloat(),1f)
    }

    private fun button(label:String,click:()->Unit)=MaterialButton(this).apply{
        text=label;textSize=12.5f;isAllCaps=false;setOnClickListener{click()}
    }

    private fun refresh(){
        Thread{
            val result=StaffOperations.sync(this)
            runOnUiThread{
                snapshot=result
                if(result==null){
                    showError("اتصال به سامانه هیرمند انجام نشد. اگر قبلاً اطلاعاتی در گوشی ذخیره شده باشد، بعد از اتصال دوباره نمایش داده می‌شود.")
                    return@runOnUiThread
                }
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

    private fun metricCard(title:String,value:String,subtitle:String=""):MaterialCardView{
        val c=card()
        val box=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL}
        box.addView(txt(title,11.5f),lp(-1,-2))
        box.addView(txt(value,23f,true),lp(-1,-2).apply{topMargin=dp(3)})
        if(subtitle.isNotBlank())box.addView(txt(subtitle,10.5f),lp(-1,-2))
        c.addView(box)
        return c
    }

    private fun render(data:StaffOperationsSnapshot){
        val scroll=ScrollView(this).apply{setBackgroundColor(getColor(R.color.hirmand_bg))}
        val root=LinearLayout(this).apply{
            orientation=LinearLayout.VERTICAL
            layoutDirection=android.view.View.LAYOUT_DIRECTION_RTL
            setPadding(dp(16),dp(16),dp(16),dp(28))
        }
        scroll.addView(root)

        root.addView(txt(if(data.staffName.isBlank())"مرکز عملیات کارکنان" else "سلام "+data.staffName+" 👋",24f,true),lp(-1,-2))
        root.addView(txt(data.staffRole.ifBlank{"برنامه رسمی کارکنان گروه مشاورین املاک هیرمند"},13f),lp(-1,-2))

        val syncText=when{
            data.offline&&data.pendingSyncCount>0->"حالت آفلاین · "+data.pendingSyncCount.toLocaleFa()+" مورد در صف همگام‌سازی"
            data.offline->"حالت آفلاین · نمایش آخرین اطلاعات ذخیره‌شده"
            else->"آنلاین · آخرین همگام‌سازی: "+dateText(data.lastServerSyncAt)
        }
        val syncCard=card()
        syncCard.addView(txt(syncText,12f,true),lp(-1,-2))
        if(data.pendingSyncCount>0)syncCard.addView(txt("پس از برگشت اینترنت، عملیات و تصاویر به‌صورت خودکار و بدون ثبت تکراری ارسال می‌شوند.",11.5f),lp(-1,-2).apply{topMargin=dp(5)})
        root.addView(syncCard,lp(-1,-2).apply{bottomMargin=dp(10)})

        root.addView(button("بروزرسانی و تلاش برای همگام‌سازی"){refresh()},lp(-1,dp(46)).apply{bottomMargin=dp(10)})

        if(data.lostMode){
            val lost=card();lost.addView(txt("⚠ دستگاه در حالت مفقودی است\n"+data.lostMessage,14f,true));root.addView(lost,lp(-1,-2).apply{bottomMargin=dp(10)})
        }

        section(root,"داشبورد امروز")
        val kpiRow=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL}
        kpiRow.addView(metricCard("وظایف",data.daily.tasksToday.toLocaleFa(),data.daily.tasksDoneToday.toLocaleFa()+" انجام‌شده"),lp(0,-2).apply{weight=1f;marginEnd=dp(5)})
        kpiRow.addView(metricCard("بازدید",data.daily.visitsToday.toLocaleFa(),data.daily.visitsDoneToday.toLocaleFa()+" تکمیل‌شده"),lp(0,-2).apply{weight=1f;marginStart=dp(5)})
        root.addView(kpiRow,lp(-1,-2).apply{bottomMargin=dp(7)})
        val kpiRow2=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL}
        kpiRow2.addView(metricCard("تماس",data.daily.callsToday.toLocaleFa()),lp(0,-2).apply{weight=1f;marginEnd=dp(5)})
        kpiRow2.addView(metricCard("پیگیری",data.daily.followUpsDue.toLocaleFa(),data.daily.followUpsNext7.toLocaleFa()+" در ۷ روز آینده"),lp(0,-2).apply{weight=1f;marginStart=dp(5)})
        root.addView(kpiRow2,lp(-1,-2).apply{bottomMargin=dp(7)})
        val kpiRow3=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL}
        kpiRow3.addView(metricCard("تصویر امروز",data.daily.capturesToday.toLocaleFa()),lp(0,-2).apply{weight=1f;marginEnd=dp(5)})
        kpiRow3.addView(metricCard("امتیاز ۳۰روزه",data.performance.score.toLocaleFa(),"تعامل "+data.performance.interactions.toLocaleFa()),lp(0,-2).apply{weight=1f;marginStart=dp(5)})
        root.addView(kpiRow3,lp(-1,-2).apply{bottomMargin=dp(10)})

        section(root,"پیگیری‌های هوشمند")
        if(data.followUps.isEmpty()){
            root.addView(txt("موردی برای پیگیری در ۷ روز آینده ثبت نشده است.",12.5f),lp(-1,-2))
        }else{
            for(item in data.followUps.take(12)){
                val c=card()
                c.addView(txt(item.name,15f,true),lp(-1,-2))
                c.addView(txt((item.phone.ifBlank{"بدون شماره"})+" · "+(item.type.ifBlank{"مشتری"})+"\n"+(item.propertyTitle?:"بدون ملک مشخص")+" · "+dateText(item.nextFollowUpAt),12f),lp(-1,-2).apply{topMargin=dp(4)})
                val actions=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL}
                if(item.phone.isNotBlank())actions.addView(button("تماس"){startActivity(Intent(Intent.ACTION_DIAL,Uri.parse("tel:"+Uri.encode(item.phone))))},lp(0,dp(42)).apply{weight=1f;marginEnd=dp(4)})
                val contact=data.contacts.firstOrNull{it.id==item.id}
                if(contact!=null)actions.addView(button("ثبت نتیجه"){showNoteDialog(contact)},lp(0,dp(42)).apply{weight=1f;marginStart=dp(4)})
                c.addView(actions,lp(-1,dp(42)).apply{topMargin=dp(7)})
                root.addView(c,lp(-1,-2).apply{bottomMargin=dp(8)})
            }
        }

        val attend=card()
        attend.addView(txt("حضور و شروع روز کاری",17f,true),lp(-1,-2))
        attend.addView(txt(
            if(data.attendance?.startedAt!=null&&data.attendance?.endedAt==null)"حضور امروز فعال است."
            else if(data.attendance?.endedAt!=null)"حضور امروز ثبت و پایان یافته است."
            else "هنوز ورود امروز ثبت نشده است.",12.5f
        ),lp(-1,-2))
        val working=data.attendance?.startedAt!=null&&data.attendance?.endedAt==null
        attend.addView(button(if(working)"پایان حضور امروز" else "شروع حضور امروز"){
            lastLocation{loc->
                Thread{
                    StaffOperations.attendance(this,working,loc?.latitude,loc?.longitude)
                    if(working)stopLocationService() else startLocationService()
                    runOnUiThread{refresh()}
                }.start()
            }
        },lp(-1,dp(46)).apply{topMargin=dp(8)})
        root.addView(attend,lp(-1,-2).apply{bottomMargin=dp(10)})

        section(root,"وظایف")
        if(data.tasks.isEmpty())root.addView(txt("وظیفه‌ای برای شما ثبت نشده است.",12.5f),lp(-1,-2))
        for(task in data.tasks.take(30)){
            val c=card()
            c.addView(txt(task.title+(if(task.automation)" · خودکار" else ""),15f,true),lp(-1,-2))
            c.addView(txt((task.description.ifBlank{"بدون توضیح"})+"\nاولویت: "+task.priority+" · موعد: "+dateText(task.dueAt),12f),lp(-1,-2))
            if(task.customerId!=null)c.addView(txt("مشتری به وظیفه متصل است.",11f),lp(-1,-2).apply{topMargin=dp(4)})
            if(task.propertyId!=null)c.addView(txt("ملک به وظیفه متصل است.",11f),lp(-1,-2))
            if(task.status!="done"){
                c.addView(button(if(task.status=="in_progress")"انجام شد" else "شروع وظیفه"){
                    Thread{
                        if(task.status=="in_progress")StaffOperations.taskDone(this,task.id) else StaffOperations.taskStart(this,task.id)
                        runOnUiThread{refresh()}
                    }.start()
                },lp(-1,dp(43)).apply{topMargin=dp(7)})
            }
            root.addView(c,lp(-1,-2).apply{bottomMargin=dp(8)})
        }

        section(root,"بازدیدهای ملک")
        for(v in data.visits.filter{it.status!="completed"}.take(20)){
            val c=card()
            c.addView(txt(v.title,15f,true),lp(-1,-2))
            c.addView(txt(
                (v.address.ifBlank{"بدون آدرس"})+"\n"+
                (if(v.targetLat!=null)"geofence فعال · شعاع "+v.radiusM.toInt()+" متر" else "geofence تعریف نشده")+
                " · "+dateText(v.scheduledAt),
                12f
            ),lp(-1,-2))
            if(v.propertyId!=null)c.addView(txt("این بازدید به یک فایل ملکی متصل است.",11f),lp(-1,-2).apply{topMargin=dp(4)})
            if(v.outcome!="pending"||v.customerFeedback.isNotBlank()||v.customerInterestScore!=null){
                c.addView(txt(
                    "نتیجه: "+visitOutcomeLabel(v.outcome)+
                    (v.customerInterestScore?.let{" · علاقه مشتری "+it.toString()+"٪"}?:"")+
                    (if(v.customerFeedback.isNotBlank())"\n"+v.customerFeedback else ""),
                    11.5f
                ),lp(-1,-2).apply{topMargin=dp(5)})
            }
            val start=button(if(v.status=="planned")"شروع بازدید" else "پایان بازدید"){
                if(v.status=="planned"){
                    getSharedPreferences("hirmand_staff",MODE_PRIVATE).edit()
                        .putString("active_visit_id",v.id)
                        .putString("active_visit_lat",v.targetLat?.toString())
                        .putString("active_visit_lng",v.targetLng?.toString())
                        .putFloat("active_visit_radius",v.radiusM.toFloat()).apply()
                    currentVisitId=v.id;currentPropertyId=v.propertyId;startLocationService()
                    Thread{
                        val immediatelyArrived=v.targetLat==null||v.targetLng==null
                        if(immediatelyArrived)StaffOperations.visitStatus(this,v.id,"arrived")
                        runOnUiThread{
                            Toast.makeText(this,if(immediatelyArrived)"بازدید شروع شد." else "geofence بازدید فعال شد؛ ورود در محدوده ثبت می‌شود.",Toast.LENGTH_LONG).show()
                            refresh()
                        }
                    }.start()
                }else{
                    stopLocationService()
                    Thread{StaffOperations.visitStatus(this,v.id,"completed");runOnUiThread{showVisitFeedbackDialog(v)}}.start()
                }
            }
            c.addView(start,lp(-1,dp(43)).apply{topMargin=dp(7)})
            c.addView(button("نتیجه و چک‌لیست بازدید"){showVisitFeedbackDialog(v)},lp(-1,dp(43)).apply{topMargin=dp(7)})
            c.addView(button("افزودن به تقویم"){addCalendar(v)},lp(-1,dp(43)).apply{topMargin=dp(7)})
            c.addView(button("ثبت تصویر ملک"){
                val labels=arrayOf("نمای بیرونی","پذیرایی","آشپزخانه","اتاق خواب","پارکینگ/انباری","مدارک","سایر")
                android.app.AlertDialog.Builder(this).setTitle("دسته تصویر").setItems(labels){_,which->
                    currentCaptureCategory=labels[which]
                    currentVisitId=v.id;currentPropertyId=v.propertyId
                    cameraLauncher.launch(Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE))
                }.show()
            },lp(-1,dp(43)).apply{topMargin=dp(7)})
            root.addView(c,lp(-1,-2).apply{bottomMargin=dp(8)})
        }

        section(root,"CRM مشتری + ملک")
        root.addView(button("افزودن مخاطب از دفترچه تلفن"){contactPickerLauncher.launch(null)},lp(-1,dp(43)).apply{bottomMargin=dp(8)})
        for(contact in data.contacts.take(40)){
            val c=card()
            c.addView(txt(contact.name,15f,true),lp(-1,-2))
            c.addView(txt(
                (contact.phone.ifBlank{"بدون شماره"})+" · "+contact.type+
                (if(contact.leadId!=null)"\nلید: "+(contact.leadDeal?:contact.leadStatus?:"متصل")+" · امتیاز "+contact.leadScore.toLocaleFa()+"/۱۰۰" else "\nبدون لید متصل"),
                12f
            ),lp(-1,-2).apply{topMargin=dp(3)})
            if(contact.linkedProperties.isNotEmpty()){
                c.addView(txt("ملک‌های مرتبط:",11.5f,true),lp(-1,-2).apply{topMargin=dp(6)})
                for(p in contact.linkedProperties.take(4)){
                    c.addView(txt("• "+p.title+" · "+p.neighborhood+(p.areaM2?.let{" · "+it.toLocaleFa()+" متر"}?:""),11f),lp(-1,-2))
                }
            }else if(contact.propertyId!=null){
                c.addView(txt("یک ملک اصلی به پرونده متصل است.",11f),lp(-1,-2))
            }
            if(contact.recommendedProperties.isNotEmpty()){
                c.addView(txt("پیشنهاد هوشمند ملک:",11.5f,true),lp(-1,-2).apply{topMargin=dp(6)})
                for(p in contact.recommendedProperties.take(3)){
                    c.addView(
                        txt("★ "+p.title+" · تطابق "+p.score.toLocaleFa()+"٪"+(if(p.neighborhood.isNotBlank())" · "+p.neighborhood else "")+
                            (p.areaM2?.let{" · "+it.toLocaleFa()+" متر"}?:""),
                            11f),
                        lp(-1,-2)
                    )
                }
            }
            val contactInteractions=data.interactions.filter{it.contactId==contact.id}
            c.addView(txt("تعداد تعامل: "+contactInteractions.size.toLocaleFa(),11f),lp(-1,-2).apply{topMargin=dp(5)})
            for(interaction in contactInteractions.take(2)){
                c.addView(txt(
                    (if(interaction.kind=="call")"تماس" else if(interaction.kind=="meeting")"بازدید/جلسه" else "یادداشت")+
                    " · "+(interaction.note.ifBlank{"بدون شرح"})+
                    " · "+dateText(interaction.createdAt),
                    10.5f
                ),lp(-1,-2))
            }
            if(contact.phone.isNotBlank())c.addView(button("تماس با مشتری"){startActivity(Intent(Intent.ACTION_DIAL,Uri.parse("tel:"+Uri.encode(contact.phone))))},lp(-1,dp(43)).apply{topMargin=dp(7)})
            c.addView(button("ثبت نتیجه تماس / تعیین پیگیری"){showNoteDialog(contact)},lp(-1,dp(43)).apply{topMargin=dp(7)})
            root.addView(c,lp(-1,-2).apply{bottomMargin=dp(8)})
        }

        val health=card()
        health.addView(txt("سلامت و امنیت دستگاه",17f,true),lp(-1,-2))
        health.addView(txt("فقط وضعیت کاری دستگاه، شبکه، باتری، فضای ذخیره‌سازی و مجوزهای مربوط به برنامه گزارش می‌شود. اعلان‌ها و Accessibility شخصی جمع‌آوری نمی‌شوند.",12f),lp(-1,-2))
        health.addView(button("ارسال گزارش سلامت الآن"){
            Thread{
                val ok=StaffOperations.sendHealth(this)
                runOnUiThread{Toast.makeText(this,if(ok)"گزارش سلامت ثبت شد." else "در صف همگام‌سازی قرار گرفت.",Toast.LENGTH_SHORT).show();refresh()}
            }.start()
        },lp(-1,dp(43)).apply{topMargin=dp(7)})
        root.addView(health,lp(-1,-2).apply{bottomMargin=dp(8)})

        setContentView(scroll)
    }

    private fun showVisitFeedbackDialog(visit:StaffVisitItem){
        val box=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(dp(12),dp(4),dp(12),0)}
        val feedback=EditText(this).apply{hint="نظر مشتری و نتیجه بازدید";minLines=3;gravity=Gravity.TOP}
        val interest=SeekBar(this).apply{max=100;progress=50}
        val interestLabel=TextView(this).apply{text="علاقه مشتری: ۵۰٪";textSize=12f}
        interest.setOnSeekBarChangeListener(object:SeekBar.OnSeekBarChangeListener{
            override fun onProgressChanged(seekBar:SeekBar?,progress:Int,fromUser:Boolean){interestLabel.text="علاقه مشتری: "+progress.toString().toLocaleFa()+"٪"}
            override fun onStartTrackingTouch(seekBar:SeekBar?){}
            override fun onStopTrackingTouch(seekBar:SeekBar?){}
        })
        val outcome=Spinner(this)
        outcome.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,arrayOf("علاقه‌مند","مذاکره","بازدید دوم","عدم علاقه","سایر"))
        val keys=arrayOf("property_condition","price_accepted","customer_interested","photos_complete")
        val labels=arrayOf("وضعیت ملک بررسی شد","قیمت بررسی شد","علاقه مشتری مشخص شد","تصاویر لازم ثبت شد")
        val checks=Array(keys.size){CheckBox(this).also{it.text=labels[it.hashCode().let{abs->kotlin.math.abs(abs)%labels.size}]}}
        box.addView(feedback,LinearLayout.LayoutParams(-1,dp(110)))
        box.addView(interestLabel,LinearLayout.LayoutParams(-1,-2).apply{topMargin=dp(8)})
        box.addView(interest,LinearLayout.LayoutParams(-1,-2))
        box.addView(outcome,LinearLayout.LayoutParams(-1,dp(48)).apply{topMargin=dp(6)})
        val checklistBox=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL}
        for(index in labels.indices){
            val cb=CheckBox(this).apply{text=labels[index]}
            checks[index]=cb
            checklistBox.addView(cb)
        }
        box.addView(checklistBox)
        val schedule=TextView(this).apply{text="بدون پیگیری بعدی";textSize=12f;setTextColor(getColor(R.color.hirmand_muted));setPadding(0,dp(6),0,dp(6))}
        var followUpMillis:Long?=null
        schedule.setOnClickListener{
            chooseFollowUpDate{ms->followUpMillis=ms;schedule.text="پیگیری بعدی: "+java.text.DateFormat.getDateTimeInstance(java.text.DateFormat.SHORT,java.text.DateFormat.SHORT).format(java.util.Date(ms))}
        }
        box.addView(schedule)
        val dialog=android.app.AlertDialog.Builder(this).setTitle("نتیجه بازدید · "+visit.title).setView(box).setNegativeButton("انصراف",null).setPositiveButton("ذخیره",null).create()
        dialog.setOnShowListener{
            dialog.getButton(android.app.AlertDialog.BUTTON_POSITIVE).setOnClickListener{
                val outcomeCode=when(outcome.selectedItemPosition){0->"interested";1->"negotiation";2->"second_visit";3->"not_interested";else->"other"}
                val checklist=JSONArray()
                for(index in labels.indices)checklist.put(JSONObject().put("key",keys[index]).put("label",labels[index]).put("done",checks[index].isChecked))
                Thread{
                    StaffOperations.visitFeedback(this,visit.id,outcomeCode,interest.progress,feedback.text?.toString().orEmpty(),followUpMillis?.let{java.time.Instant.ofEpochMilli(it).toString()},checklist)
                    runOnUiThread{dialog.dismiss();refresh()}
                }.start()
            }
        }
        dialog.show()
    }

    private fun showNoteDialog(contact:StaffCrmContactItem){
        val box=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(dp(12),dp(4),dp(12),0)}
        val note=EditText(this).apply{hint="نتیجه تماس یا یادداشت";minLines=3;gravity=Gravity.TOP}
        val follow=TextView(this).apply{text="بدون پیگیری جدید";textSize=12f;setTextColor(getColor(R.color.hirmand_muted))}
        box.addView(note,LinearLayout.LayoutParams(-1,dp(110)))
        box.addView(follow,LinearLayout.LayoutParams(-1,-2).apply{topMargin=dp(8)})
        val dateTime=LongArray(1){-1L}
        follow.setOnClickListener{
            chooseFollowUpDate{ms->
                dateTime[0]=ms
                follow.text="پیگیری بعدی: "+java.text.DateFormat.getDateTimeInstance(java.text.DateFormat.SHORT,java.text.DateFormat.SHORT).format(java.util.Date(ms))
            }
        }
        val dialog=android.app.AlertDialog.Builder(this)
            .setTitle("ثبت پیگیری · "+contact.name)
            .setView(box)
            .setNegativeButton("انصراف",null)
            .setPositiveButton("ثبت",null)
            .create()
        dialog.setOnShowListener{
            dialog.getButton(android.app.AlertDialog.BUTTON_POSITIVE).setOnClickListener{
                val iso=if(dateTime[0]>0)java.time.Instant.ofEpochMilli(dateTime[0]).toString() else null
                Thread{
                    StaffOperations.logInteraction(this,contact.id,"note",note.text?.toString().orEmpty(),iso)
                    runOnUiThread{dialog.dismiss();refresh()}
                }.start()
            }
        }
        dialog.show()
    }

    private fun chooseFollowUpDate(callback:(Long)->Unit){
        val cal=Calendar.getInstance()
        DatePickerDialog(this,{_,year,month,day->
            TimePickerDialog(this,{_,hour,minute->
                val local=LocalDateTime.of(year,month+1,day,hour,minute)
                callback(local.atZone(ZoneId.of("Asia/Tehran")).toInstant().toEpochMilli())
            },cal.get(Calendar.HOUR_OF_DAY),cal.get(Calendar.MINUTE),true).show()
        },cal.get(Calendar.YEAR),cal.get(Calendar.MONTH),cal.get(Calendar.DAY_OF_MONTH)).show()
    }

    private fun visitOutcomeLabel(v:String):String=when(v){"interested"->"علاقه‌مند","negotiation"->"مذاکره","second_visit"->"بازدید دوم","not_interested"->"عدم علاقه","other"->"سایر","pending"->"ثبت نشده",else->v}

    private fun addCalendar(v:StaffVisitItem){
        val intent=Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI)
            .putExtra(CalendarContract.Events.TITLE,"بازدید · "+v.title)
            .putExtra(CalendarContract.Events.DESCRIPTION,(v.address+"\n"+(v.propertyId?:"")))
        v.scheduledAt?.let{runCatching{java.time.Instant.parse(it).toEpochMilli()}.getOrNull()?.let{ms->
            intent.putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME,ms)
                .putExtra(CalendarContract.EXTRA_EVENT_END_TIME,ms+3600000L)
        }}
        startActivity(intent)
        StaffOperations.post(this,JSONObject().put("action","calendar_logged").put("visitId",v.id))
    }

    private fun section(root:LinearLayout,label:String){
        root.addView(txt(label,18f,true),lp(-1,-2).apply{topMargin=dp(6);bottomMargin=dp(8)})
    }

    private fun card()=MaterialCardView(this).apply{
        radius=dp(17).toFloat()
        setCardBackgroundColor(getColor(R.color.hirmand_surface))
        strokeWidth=dp(1)
        strokeColor=getColor(R.color.hirmand_surface_2)
        setContentPadding(dp(14),dp(13),dp(14),dp(13))
    }

    private fun lp(w:Int,h:Int)=LinearLayout.LayoutParams(w,h)

    private fun dateText(v:String?):String=
        if(v.isNullOrBlank())"—"
        else runCatching{
            val formatter=DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm")
            LocalDateTime.parse(v.removeSuffix("Z").substringBeforeLast("."),formatter).toString()
        }.getOrElse{
            runCatching{
                java.text.DateFormat.getDateTimeInstance(
                    java.text.DateFormat.SHORT,
                    java.text.DateFormat.SHORT
                ).format(java.util.Date.from(java.time.Instant.parse(v)))
            }.getOrDefault("—")
        }

    private fun lastLocation(callback:(android.location.Location?)->Unit){
        val ok=ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED||
            ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED
        if(!ok){callback(null);return}
        val manager=getSystemService(android.location.LocationManager::class.java)
        val providers=listOf(android.location.LocationManager.GPS_PROVIDER,android.location.LocationManager.NETWORK_PROVIDER)
        val location=providers.asSequence().mapNotNull{p->runCatching{manager.getLastKnownLocation(p)}.getOrNull()}.maxByOrNull{it.time}
        callback(location)
    }

    private fun startLocationService(){
        if(Build.VERSION.SDK_INT>=26)ContextCompat.startForegroundService(this,Intent(this,StaffLocationService::class.java))
        else startService(Intent(this,StaffLocationService::class.java))
    }

    private fun stopLocationService(){
        stopService(Intent(this,StaffLocationService::class.java))
        getSharedPreferences("hirmand_staff",MODE_PRIVATE).edit()
            .remove("active_visit_id").remove("active_visit_lat").remove("active_visit_lng").remove("active_visit_radius").apply()
    }

    private fun showError(msg:String){
        Toast.makeText(this,msg,Toast.LENGTH_LONG).show()
        setContentView(LinearLayout(this).apply{
            orientation=LinearLayout.VERTICAL
            setPadding(dp(24),dp(28),dp(24),dp(28))
            addView(txt("مرکز عملیات",24f,true))
            addView(txt(msg,14f),lp(-1,-2))
            addView(button("تلاش دوباره"){refresh()},lp(-1,dp(48)).apply{topMargin=dp(12)})
        })
    }
}

private fun Int.toLocaleFa():String=toString().map{
    when(it){'0'->'۰';'1'->'۱';'2'->'۲';'3'->'۳';'4'->'۴';'5'->'۵';'6'->'۶';'7'->'۷';'8'->'۸';'9'->'۹';else->it}
}.joinToString("")