import { useEffect, useState } from "react";
import { CalendarDays, RotateCcw, X } from "lucide-react";
import { DayPicker, faIR } from "react-day-picker/persian";
import "react-day-picker/style.css";
import {
  dateOnlyToLocalDate,
  formatPersianDateWithWeekday,
  localDateToDateOnly,
} from "@/lib/persian-date";

type PersianDatePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  title?: string;
  minValue?: string;
  disabled?: boolean;
};

export function PersianDatePicker({
  id,
  value,
  onChange,
  placeholder = "انتخاب تاریخ شمسی",
  hint = "تاریخ با تقویم شمسی انتخاب می‌شود.",
  title = "انتخاب تاریخ",
  minValue,
  disabled = false,
}: PersianDatePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = dateOnlyToLocalDate(value);
  const minDate = minValue ? dateOnlyToLocalDate(minValue) : undefined;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function selectDate(date: Date | undefined) {
    const nextValue = localDateToDateOnly(date);
    onChange(nextValue);
    if (date) setOpen(false);
  }

  return (
    <div className="persian-date-picker">
      <button
        id={id}
        type="button"
        className={"persian-date-picker-trigger" + (value ? " has-value" : "")}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
      >
        <CalendarDays size={18} aria-hidden="true" />
        <span>{value ? formatPersianDateWithWeekday(value) : placeholder}</span>
      </button>

      {hint ? <small className="form-hint">{hint}</small> : null}

      {value ? (
        <button
          type="button"
          className="persian-date-picker-clear"
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
          disabled={disabled}
          aria-label="پاک کردن تاریخ"
          title="پاک کردن تاریخ"
        >
          <X size={15} aria-hidden="true" />
        </button>
      ) : null}

      {open ? (
        <div className="persian-date-picker-popover" role="dialog" aria-label="انتخاب تاریخ شمسی">
          <div className="persian-date-picker-head">
            <div>
              <span>{title}</span>
              <strong>{value ? formatPersianDateWithWeekday(value) : "یک تاریخ انتخاب کنید"}</strong>
            </div>
            <button
              type="button"
              className="persian-date-picker-close"
              onClick={() => setOpen(false)}
              aria-label="بستن تقویم"
              title="بستن"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="persian-date-picker-calendar-guide">
            <span>ماه و سال را از بالا انتخاب کنید</span>
            <b>سپس روز موردنظر را انتخاب کنید</b>
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
            showOutsideDays={false}
            disabled={minDate ? { before: minDate } : undefined}
          />

          {value ? (
            <button type="button" className="persian-date-picker-reset" onClick={() => onChange("")}>
              <RotateCcw size={14} aria-hidden="true" />
              حذف تاریخ انتخاب‌شده
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
