"use client";
import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Waves, Phone, Mail, MapPin, Shield, Heart } from "lucide-react";
import { EMERGENCY_CONTACTS } from "@/lib/constants";
import { Disclaimer } from "@/components/app/disclaimer";
import { useApi } from "./use-api";

export interface FooterContactPublicData {
  isEnabled: boolean;
  email: string | null;
  phones: Array<{ id: string; number: string; label: string; isEnabled: boolean }>;
  address: string | null;
}

export function Footer() {
  const { lang, navigate } = useApp();
  const { data: contactData, refetch: refetchContact } = useApi<FooterContactPublicData>("/footer-contact");

  // Immediately reflect admin changes across the application
  useEffect(() => {
    const handleUpdate = () => {
      refetchContact();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("godavari_footer_contact_updated", handleUpdate);
      return () => {
        window.removeEventListener("godavari_footer_contact_updated", handleUpdate);
      };
    }
  }, [refetchContact]);

  const isEnabled = contactData?.isEnabled ?? true;
  const email = isEnabled && contactData?.email?.trim() ? contactData.email.trim() : null;
  const phones =
    isEnabled && Array.isArray(contactData?.phones)
      ? contactData.phones.filter((p) => p && p.isEnabled && p.number && p.number.trim().length > 0)
      : [];
  const address = isEnabled && contactData?.address?.trim() ? contactData.address.trim() : null;
  const hasAnyContact = !!(email || phones.length > 0 || address);

  return (
    <footer className="mt-auto border-t bg-muted/30">
      <div className="container mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
                <Waves className="size-4" />
              </span>
              <span className="font-bold">{t(lang, "brand")}</span>
            </div>
            <p className="text-sm text-muted-foreground">{t(lang, "footerNote")}</p>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-3">{t(lang, "explore")}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><button className="hover:text-primary text-left" onClick={() => navigate({ name: "directory" })}>{t(lang, "directory")}</button></li>
              <li><button className="hover:text-primary text-left" onClick={() => navigate({ name: "directory", category: "GHAT" })}>{t(lang, "ghatsLabel")}</button></li>
              <li><button className="hover:text-primary text-left" onClick={() => navigate({ name: "directory", category: "RESTAURANT" })}>{t(lang, "restaurants")}</button></li>
              <li><button className="hover:text-primary text-left" onClick={() => navigate({ name: "directory", category: "HOTEL" })}>{t(lang, "hotels")}</button></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-3">{t(lang, "emergencyContacts")}</h3>
            <ul className="space-y-2 text-sm">
              {EMERGENCY_CONTACTS.slice(0, 4).map((c) => (
                <li key={c.number} className="flex items-center gap-2">
                  <Phone className="size-3 text-destructive" />
                  <a href={`tel:${c.number}`} className="hover:text-primary">
                    <span>{lang === "te" ? c.teName : c.name}</span>
                    <span className="ml-2 font-medium">{c.number}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-3">{t(lang, "contactUs")}</h3>
            {hasAnyContact && (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {email && (
                  <li className="flex items-center gap-2">
                    <Mail className="size-3 shrink-0 text-muted-foreground" />
                    <a
                      href={`mailto:${email}`}
                      className="hover:text-primary transition-colors break-all"
                    >
                      {email}
                    </a>
                  </li>
                )}
                {phones.map((phone) => (
                  <li key={phone.id || phone.number} className="flex items-center gap-2">
                    <Phone className="size-3 shrink-0 text-muted-foreground" />
                    <a
                      href={`tel:${phone.number.replace(/[^0-9+]/g, "")}`}
                      className="hover:text-primary transition-colors"
                    >
                      <span>{phone.number}</span>
                      {phone.label && (
                        <span className="text-xs text-muted-foreground ml-1.5">
                          ({phone.label})
                        </span>
                      )}
                    </a>
                  </li>
                ))}
                {address && (
                  <li className="flex items-start gap-2">
                    <MapPin className="size-3 shrink-0 mt-0.5 text-muted-foreground" />
                    <span className="leading-snug">{address}</span>
                  </li>
                )}
              </ul>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={() => navigate({ name: "admin-login" })} className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                <Shield className="size-3" /> {t(lang, "admin")}
              </button>
            </div>
          </div>
        </div>

        <Disclaimer />

        <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© 2027 {t(lang, "brand")} · {t(lang, "tagline")}</p>
          <p className="flex items-center gap-1">
            <Heart className="size-3 text-destructive" /> Built for public service
          </p>
        </div>

        <div className="mt-4 pt-4 border-t border-border/40 text-center">
          <p className="text-xs text-muted-foreground tracking-wide">
            Designed & Developed by{" "}
            <span className="font-semibold text-primary">
              SAI MOHIT.ANGARA
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
