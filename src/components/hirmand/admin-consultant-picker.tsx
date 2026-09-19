import { Check, Handshake, Briefcase } from "lucide-react";
import { TEAM, type TeamMember } from "@/lib/site";

type Props = {
  contactName: string;
  contactPhone: string;
  onSelect: (member: TeamMember) => void;
};

export function AdminConsultantPicker({ contactName, contactPhone, onSelect }: Props) {
  return (
    <div className="admin-consultant-grid">
      {TEAM.map((person) => {
        const active =
          contactPhone.replace(/\s/g, "") === person.phone.replace(/\s/g, "") ||
          contactName === person.name;
        const Icon = person.icon === "handshake" ? Handshake : Briefcase;
        return (
          <button
            key={person.id}
            type="button"
            className={`admin-consultant-card${active ? " is-active" : ""}`}
            onClick={() => onSelect(person)}
          >
            <span className="admin-consultant-icon">
              <Icon size={18} />
            </span>
            <span className="admin-consultant-meta">
              <strong>{person.name}</strong>
              <small>{person.role}</small>
              <span dir="ltr">{person.phoneDisplay}</span>
            </span>
            {active ? (
              <span className="admin-consultant-check">
                <Check size={16} />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
