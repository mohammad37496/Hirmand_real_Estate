import { Check, Handshake, Briefcase } from "lucide-react";
import { TEAM, type TeamMember } from "@/lib/site";

type Props = {
  contactName: string;
  contactPhone: string;
  onSelect: (member: TeamMember) => void;
};

function normalizePhone(value: string) {
  return value.replace(/[\s\-()]/g, "").replace(/^98/, "0");
}

export function AdminConsultantPicker({ contactName, contactPhone, onSelect }: Props) {
  const phoneNorm = normalizePhone(contactPhone || "");
  const nameTrim = (contactName || "").trim();

  return (
    <div className="admin-consultant">
      <p className="admin-consultant-hint">مشاور مسئول این فایل را انتخاب کنید:</p>
      <div className="admin-consultant-grid" role="listbox" aria-label="انتخاب مشاور مسئول">
        {TEAM.map((person) => {
          const active =
            normalizePhone(person.phone) === phoneNorm ||
            person.name === nameTrim ||
            person.id === nameTrim;
          const Icon = person.icon === "handshake" ? Handshake : Briefcase;
          return (
            <button
              key={person.id}
              type="button"
              role="option"
              aria-selected={active}
              className={`admin-consultant-card${active ? " is-active" : ""}`}
              onClick={() => onSelect(person)}
            >
              <span className="admin-consultant-icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className="admin-consultant-meta">
                <strong>{person.name}</strong>
                <small>{person.role}</small>
                <span dir="ltr">{person.phoneDisplay}</span>
              </span>
              {active ? (
                <span className="admin-consultant-check" aria-hidden="true">
                  <Check size={16} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <label className="field admin-consultant-select">
        <span className="sr-only">انتخاب سریع مشاور</span>
        <select
          value={
            TEAM.find(
              (p) =>
                normalizePhone(p.phone) === phoneNorm || p.name === nameTrim,
            )?.id ?? ""
          }
          onChange={(e) => {
            const member = TEAM.find((p) => p.id === e.target.value);
            if (member) onSelect(member);
          }}
        >
          <option value="" disabled>
            انتخاب مشاور…
          </option>
          {TEAM.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name} — {person.role}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
