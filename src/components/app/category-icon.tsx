"use client";
import {
  UtensilsCrossed,
  BedDouble,
  Waves,
  Stethoscope,
  Bus,
  Landmark,
  Home,
  Soup,
  Flame,
  type LucideIcon,
} from "lucide-react";
import type { ListingCategory } from "@/lib/constants";

const ICONS: Record<string, LucideIcon> = {
  UtensilsCrossed,
  BedDouble,
  Waves,
  Stethoscope,
  Bus,
  Landmark,
  Home,
  Soup,
  Flame,
};

export function CategoryIcon({
  category,
  className,
}: {
  category: ListingCategory;
  className?: string;
}) {
  const name =
    category === "RESTAURANT" ? "UtensilsCrossed" :
    category === "HOTEL" ? "BedDouble" :
    category === "GHAT" ? "Waves" :
    category === "HOSPITAL" ? "Stethoscope" :
    category === "TRANSPORT" ? "Bus" :
    category === "FREE_ACCOMMODATION" ? "Home" :
    category === "ANNADANAM" ? "Soup" :
    category === "CEREMONY" ? "Flame" :
    "Landmark";
  const Icon = ICONS[name] || Landmark;
  return <Icon className={className} />;
}
