import { MapPinned, Navigation } from "lucide-react";
import { mapLinks, type MapTarget } from "@/lib/site";

export function MapAppButtons({
  target,
  googleHref,
}: {
  target: MapTarget;
  googleHref?: string;
}) {
  const links = mapLinks(target);
  const google = googleHref ?? links.google;
  const apps = [
    { href: google, title: "گوگل مپ", text: "Google Maps" },
    { href: links.balad, title: "بلد", text: "اپلیکیشن بلد" },
    { href: links.neshan, title: "نشان", text: "اپلیکیشن نشان" },
  ];

  return (
    <div className="map-app-row">
      {apps.map((app) => (
        <a
          key={app.title}
          className="map-app-btn"
          href={app.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="icon-box sm">
            {app.title === "گوگل مپ" ? (
              <MapPinned size={15} strokeWidth={1.8} />
            ) : (
              <Navigation size={15} strokeWidth={1.8} />
            )}
          </span>
          <span>
            <strong>{app.title}</strong>
            <small>{app.text}</small>
          </span>
        </a>
      ))}
    </div>
  );
}

export function MapEmbed({ target, title }: { target: MapTarget; title: string }) {
  const links = mapLinks(target);
  return (
    <div className="map-embed">
      <iframe
        title={title}
        src={links.osm}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
