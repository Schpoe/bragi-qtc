import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Key } from "lucide-react";

export default function PasswordResetInfo() {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm">Password Reset</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          Users can reset their password by clicking <strong>"Forgot password?"</strong> on the login screen.
        </p>
        <div className="flex items-start gap-2 mt-3 p-3 bg-background rounded-md border">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-medium text-foreground">If users don't receive the reset email:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li>Check spam/junk folders</li>
              <li>Wait a few minutes for delivery</li>
              <li>Ensure email is entered correctly (lowercase)</li>
              <li>Use the "Resend" option on login screen</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}