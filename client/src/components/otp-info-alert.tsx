import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default function OtpInfoAlert() {
  return (
    <Alert className="bg-blue-900/50 border-blue-500/50 mb-4">
      <Info className="h-4 w-4 text-blue-400" />
      <AlertDescription className="text-blue-200">
        <strong>Development Mode:</strong> OTP codes are displayed in the server console logs. 
        In production, they will be sent to your actual email/phone.
      </AlertDescription>
    </Alert>
  );
}