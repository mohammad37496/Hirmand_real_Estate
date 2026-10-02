import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, X } from "lucide-react";
import { DayPicker, faIR } from "react-day-picker/persian";
import "react-day-picker/style.css";
import { dateOnlyToLocalDate, formatPersianDate, localDateToDateOnly } from "@/lib/persian-date";

type PersianDateTimePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  title?: string;
  minValue?: string;
  disabled?: boolean;
};

function splitValue(value: string) {
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

export function PersianDateTimePicker({
  id,
  value,
  onChange,
  placeholder = "انتخاب تاریخ و ساعت",
  hint = "تاریخ با تقویم شمسی و ساعت به‌صورت جداگانه انتخاب می‌شود.",
  title = "انتخاب تاریخ و ساعت",
  minValue,
  disabled = false,
}: PersianDateTimePickerProps) {
  const parts = useMemo(() => splitValue(value), [value]);
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState(parts.time || "12:00");
  const selectedDate = dateOnlyToLocalDate(parts.date);
  const minDate = minValue ? dateOnlyToLocalDate(minValue.split("T")[0]) : undefined;

  useEffect(() => {
    if (open) setTime(parts.time || "12:00");
  }, [open, parts.time]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function update(nextDate: string, nextTime = time) {
    if (!nextDate) {
      onChange("");
      return;
    }
    onChange(nextDate + "T" + (nextTime || "12:00"));
  }

  function selectDate(date: Date | undefined) {
    if (!date) return;
    update(localDateToDateOnly(date), time);
  }

  const label = parts.date
    ? formatPersianDate(parts.date, false) + " · " + (parts.time || "12:00")
    : placeholder;

  return (
    <div className="persian-date-time-picker">
      <button
        id={id}
        type="button"
        className={"persian-date-time-picker-trigger" + (value ? " has-value" : "")}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
      >
        <CalendarDays size={18} aria-hidden="true" />
        <span>{label}</span>
      </button>

      {hint ? <small className="form-hint">{hint}</small> : null}

      {value ? (
        <button
          type="button"
          className="persian-date-time-picker-clear"
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
          disabled={disabled}
          aria-label="پاک کردن تاریخ و ساعت"
          title="پاک کردن تاریخ و ساعت"
        >
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}

      {open ? (
        <div className="persian-date-time-picker-popover" role="dialog" aria-label="انتخاب تاریخ و ساعت شمسی">
          <div className="persian-date-time-picker-head">
            <div>
              <span>{title}</span>
              <strong>
                {parts.date
                  ? formatPersianDate(parts.date, true) + " · " + (parts.time || "12:00")
                  : "یک تاریخ و ساعت انتخاب کنید"}
              </strong>
            </div>
            <button
              type="button"
              className="persian-date-time-picker-close"
              onClick={() => setOpen(false)}
              aria-label="بستن تقویم"
              title="بستن"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={selectDate}
            defaultMonth={selectedDate ?? new Date()}
            locale={faIR}
            dir="rtl"
            numerals="arabext"
            captionLayout="dropdown"
            navLayout="after"
            reverseYears
            showOutsideDays
            disabled={minDate ? { before: minDate } : undefined}
          />

          <div className="persian-date-time-picker-time">
            <label>
              <Clock3 size={15} aria-hidden="true" />
              <span>ساعت</span>
              <input
                type="time"
                value={time}
                onChange={(event) => {
                  const nextTime = event.target.value;
                  setTime(nextTime);
                  if (parts.date) update(parts.date, nextTime);
                }}
              />
            </label>
          </div>

          {parts.date ? (
            <button
              type="button"
              className="persian-date-time-picker-reset"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              <X size={14} aria-hidden="true" />
              پاک کردن
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
