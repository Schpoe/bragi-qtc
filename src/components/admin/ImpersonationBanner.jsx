import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { AlertCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ImpersonationBanner() {
  const { user, actualUser, stopImpersonation } = useAuth();

  if (!user?._impersonating || !actualUser) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-amber-500/10 border-b border-amber-500/30 px-4 py-3 flex items-center justify-between gap-4 z-50">
      <div className="flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600" />
        <div>
          <p className="text-sm font-medium text-amber-900">
            Impersonating <span className="font-semibold">{user.full_name || user.email}</span>
          </p>
          <p className="text-xs text-amber-800">
            Logged in as: <span className="font-semibold">{actualUser.full_name || actualUser.email}</span>
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={stopImpersonation}
        className="border-amber-600 text-amber-900 hover:bg-amber-50"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Stop Impersonation
      </Button>
    </div>
  );
}