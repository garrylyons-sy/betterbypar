import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function ClubFeatureUnavailable({
  icon: Icon,
  eyebrow,
  title,
  description,
  primaryColor,
  accentColor
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  primaryColor: string;
  accentColor: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div
          className="grid gap-4 rounded-[18px] p-5 text-white sm:grid-cols-[72px_1fr] sm:items-center"
          style={{
            background:
              `radial-gradient(circle at 18% 18%, ${primaryColor}aa, transparent 12rem), ` +
              `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 62%, #071426 100%)`
          }}
        >
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/15 text-white ring-1 ring-white/25">
            <Icon className="h-8 w-8" />
          </span>
          <div>
            <p className="text-xs font-black uppercase text-white/65">{eyebrow}</p>
            <h2 className="mt-1 text-2xl font-black leading-tight text-white">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-white/75">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
