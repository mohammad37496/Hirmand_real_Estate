import { useEffect, useState } from "react";
import { CalendarDays, Clock3, RotateCcw, X } from "lucide-react";
import { DayPicker, faIR } from "react-day-picker/persian";
import "react-day-picker/style.css";
import { dateOnlyToLocalDate, formatPersianDateWithWeekday, localDateToDateOnly } from "@/lib/persian-date";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  title?: string;
  minValue?: string;
  maxValue?: string;
  disabled?: boolean;
};

export function PersianDatePicker({
  id,value,onChange,placeholder="انتخاب تاریخ شمسی",hint="تاریخ با تقویم شمسی انتخاب می‌شود.",title="انتخاب تاریخ",minValue,maxValue,disabled=false,
}: Props) {
  const [open,setOpen]=useState(false);
  const selectedDate=dateOnlyToLocalDate(value);
  const minDate=minValue?dateOnlyToLocalDate(minValue):undefined;
  const maxDate=maxValue?dateOnlyToLocalDate(maxValue):undefined;

  useEffect(()=>{
    if(!open)return;
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
    window.addEventListener("keydown",onKeyDown);
    return ()=>window.removeEventListener("keydown",onKeyDown);
  },[open]);

  function selectDate(date:Date|undefined){
    if(!date)return;
    onChange(localDateToDateOnly(date));
    setOpen(false);
  }

  return <div className="persian-date-picker">
    <button id={id} type="button" className={"persian-date-picker-trigger"+(value?" has-value":"")} onClick={()=>setOpen(v=>!v)} aria-haspopup="dialog" aria-expanded={open} disabled={disabled}>
      <CalendarDays size={18} aria-hidden="true"/>
      <span>{value?formatPersianDateWithWeekday(value):placeholder}</span>
    </button>
    {hint?<small className="form-hint">{hint}</small>:null}
    {value?<button type="button" className="persian-date-picker-clear" onClick={()=>{onChange("");setOpen(false);}} disabled={disabled} aria-label="پاک کردن تاریخ" title="پاک کردن تاریخ"><X size={15}/></button>:null}
    {open?<div className="persian-date-picker-popover" role="dialog" aria-label="انتخاب تاریخ شمسی">
      <div className="persian-date-picker-head"><div><span>{title}</span><strong>{value?formatPersianDateWithWeekday(value):"یک تاریخ انتخاب کنید"}</strong></div>
        <button type="button" className="persian-date-picker-close" onClick={()=>setOpen(false)} aria-label="بستن تقویم"><X size={16}/></button>
      </div>
      <DayPicker mode="single" selected={selectedDate} onSelect={selectDate} defaultMonth={selectedDate??new Date()} locale={faIR} dir="rtl" numerals="arabext" captionLayout="dropdown" navLayout="after" reverseYears showOutsideDays disabled={{...(minDate?{before:minDate}:{}),...(maxDate?{after:maxDate}:{})}} />
      {value?<button type="button" className="persian-date-picker-reset" onClick={()=>{onChange("");setOpen(false)}}><RotateCcw size={14}/> حذف تاریخ انتخاب‌شده</button>:null}
    </div>:null}
  </div>;
}
