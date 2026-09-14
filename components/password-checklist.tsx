"use client";

import { passwordRules } from "@/lib/password-policy";

export function PasswordChecklist({ password }: { password: string }) {
  return (
    <div className="grid gap-1 rounded-xl bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2]">
      {passwordRules(password).map((rule) => (
        <div key={rule.id} className="flex items-center gap-2 text-xs font-bold">
          <span className={rule.valid ? "text-[#1b8a72]" : "text-[#6c5a73]"} aria-hidden="true">
            {rule.valid ? "✓" : "•"}
          </span>
          <span className={rule.valid ? "text-[#1b8a72]" : "text-[#6c5a73]"}>{rule.label}</span>
        </div>
      ))}
    </div>
  );
}
